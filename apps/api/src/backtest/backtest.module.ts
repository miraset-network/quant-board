import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller.js';
import { BacktestService } from './backtest.service.js';
import { IndexModule } from '../index/index.module.js';
import { NansenModule } from '../nansen/nansen.module.js';

@Module({
  imports: [NansenModule, IndexModule],
  controllers: [BacktestController],
  providers: [BacktestService],
})
export class BacktestModule {}
