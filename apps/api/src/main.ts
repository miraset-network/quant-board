import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';

function loadEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}
loadEnv();

async function bootstrap() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(cfg.port);
}
await bootstrap();
