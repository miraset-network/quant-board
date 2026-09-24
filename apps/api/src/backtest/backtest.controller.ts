import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { BacktestService } from './backtest.service.js';

@Controller('api/backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Get('run')
  run(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.backtestService.run(days);
  }
}
