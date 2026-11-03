import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';

@Module({
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
