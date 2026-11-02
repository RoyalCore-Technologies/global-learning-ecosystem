import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceHealth } from '@prajeeth/types';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly configService: ConfigService) {}

  getHealth(): ServiceHealth {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    return {
      status: 'ok',
      service: 'prajeeth-ecosystem-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment: nodeEnv,
      details: {
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }
}
