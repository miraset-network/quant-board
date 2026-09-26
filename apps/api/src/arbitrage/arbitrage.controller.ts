import { Controller, Get } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service.js';

@Controller('api/arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Get('opportunities')
  opportunities() {
    return this.arbitrageService.opportunities();
  }
}
