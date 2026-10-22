import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import type { Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.disable('x-powered-by');
  app.use((_req: unknown, res: Response, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const frontendOrigins = process.env.FRONTEND_URL?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (frontendOrigins?.length) {
    app.enableCors({ origin: frontendOrigins });
  }
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
