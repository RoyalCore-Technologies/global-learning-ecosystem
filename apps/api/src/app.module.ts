import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { PostsModule } from './posts/posts.module.js';
import { InteractionsModule } from './interactions/interactions.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { CommunitiesModule } from './communities/communities.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { AiModule } from './ai/ai.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 120, // 120 requests per minute per IP
      },
    ]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    PostsModule,
    InteractionsModule,
    CommentsModule,
    NotificationsModule,
    ModerationModule,
    CoursesModule,
    EnrollmentsModule,
    CommunitiesModule,
    ChannelsModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
