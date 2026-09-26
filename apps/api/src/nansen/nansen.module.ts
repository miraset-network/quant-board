import { Module } from '@nestjs/common';
import { NansenService } from './nansen.service.js';
import { NansenController } from './nansen.controller.js';

@Module({
  providers: [NansenService],
  controllers: [NansenController],
  exports: [NansenService],
})
export class NansenModule {}
