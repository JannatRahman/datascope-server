import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: process.env['CLIENT_URL'] ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = Number(process.env['NEST_PORT'] ?? '5001');
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[NestJS] DataScope NestJS server running on port ${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('[NestJS] Fatal bootstrap error:', err);
  process.exit(1);
});
