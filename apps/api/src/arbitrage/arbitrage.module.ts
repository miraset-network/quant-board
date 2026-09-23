import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service.js';
import { ArbitrageController } from './arbitrage.controller.js';
import { IndexModule } from '../index/index.module.js';

@Module({
  imports: [IndexModule],
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
})
export class ArbitrageModule {}
