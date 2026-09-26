import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IndexModule } from './index/index.module.js';
import { ArbitrageModule } from './arbitrage/arbitrage.module.js';
import { NansenModule } from './nansen/nansen.module.js';
import { BacktestModule } from './backtest/backtest.module.js';
import { ConfigModule } from './config/config.module.js';
import { CacheModule } from './cache/cache.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [ConfigModule, CacheModule, DatabaseModule, IndexModule, ArbitrageModule, NansenModule, BacktestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
