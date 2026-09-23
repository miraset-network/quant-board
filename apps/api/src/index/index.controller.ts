import { Controller, Get } from '@nestjs/common';
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
}
