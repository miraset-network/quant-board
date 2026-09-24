import { Controller, Get } from '@nestjs/common';
import { NansenService } from './nansen.service.js';

@Controller('api/nansen')
export class NansenController {
  constructor(private readonly nansen: NansenService) {}

  @Get('credits')
  async credits() {
    try {
      await this.nansen.getAccount();
    } catch {
      /* header-only fallback handled in service */
    }
    const c = this.nansen.getCredits();
    const totalRemaining =
      (c.includedRemaining ?? 0) + (c.purchasedRemaining ?? 0);
    return {
      ...c,
      totalRemaining: Number.isFinite(totalRemaining) ? totalRemaining : null,
      apiCalls: this.nansen.getCallCount(),
      successfulCalls: this.nansen.getSuccessCount(),
      lastError: this.nansen.getLastError(),
    };
  }
}
