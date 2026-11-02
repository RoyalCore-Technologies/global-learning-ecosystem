import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { validateProductionEnvironment } from './config/env-validation.js';

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule);

  // Security & Cross-Origin
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Global Input Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Global API Prefix with exclusion for base health probe
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health'],
  });

  // OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Global Learning & Social Ecosystem API')
    .setDescription(
      'Knowledge-first social and learning ecosystem backend modular monolith'
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your Supabase JWT auth token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[Platform API] Server running on port ${port}`);
  console.log(`[Platform API] Swagger documentation available at http://localhost:${port}/api/docs`);
  console.log(`[Platform API] Health check probe at http://localhost:${port}/health`);
}

bootstrap();
