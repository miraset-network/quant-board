import { Module } from '@nestjs/common';
import { IndexService } from './index.service.js';
import { IndexController } from './index.controller.js';
import { NansenModule } from '../nansen/nansen.module.js';

@Module({
  imports: [NansenModule],
  controllers: [IndexController],
  providers: [IndexService],
  exports: [IndexService],
})
export class IndexModule {}
