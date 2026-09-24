import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IndexModule } from './index/index.module.js';
import { ArbitrageModule } from './arbitrage/arbitrage.module.js';
import { NansenModule } from './nansen/nansen.module.js';
import { ConfigModule } from './config/config.module.js';

@Module({
  imports: [ConfigModule, IndexModule, ArbitrageModule, NansenModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
