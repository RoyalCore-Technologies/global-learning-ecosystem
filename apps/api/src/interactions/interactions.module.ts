import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller.js';
import { BookmarksController } from './bookmarks.controller.js';
import { InteractionsService } from './interactions.service.js';

@Module({
  controllers: [InteractionsController, BookmarksController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
