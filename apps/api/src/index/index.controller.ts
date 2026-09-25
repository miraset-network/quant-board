import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndexService } from './index.service.js';

@Controller('api/index')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get('current')
  current() {
    return this.indexService.current();
  }

  @Get('rebalance')
  rebalance() {
    return this.indexService.rebalance();
  }

  @Get('token/:chain/:address')
  tokenDetails(
    @Param('chain') chain: string,
    @Param('address') address: string,
    @Query('days') days?: string,
  ) {
    return this.indexService.tokenDetails(chain, address, Number(days ?? 30));
  }

  @Get('token/:chain/:address/risk')
  tokenRisk(@Param('chain') chain: string, @Param('address') address: string) {
    return this.indexService.tokenRisk(chain, address);
  }
}
