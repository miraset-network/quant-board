import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service.js';
import { ArbitrageController } from './arbitrage.controller.js';
import { IndexModule } from '../index/index.module.js';
import { NansenModule } from '../nansen/nansen.module.js';

@Module({
  imports: [IndexModule, NansenModule],
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
})
export class ArbitrageModule {}
