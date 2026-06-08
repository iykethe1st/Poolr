import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // Sentry must be initialised before the app creates its HTTP adapter
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
  }

  const app = await NestFactory.create(AppModule);

  // ── Global prefix (all routes under /api, except /health) ──────────────────
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  const extraOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [];
  app.enableCors({
    origin: [
      'http://localhost:3000', // web
      'http://localhost:3001', // admin
      ...extraOrigins,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global validation pipe ──────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global exception filter ─────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global logging interceptor ──────────────────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Swagger / OpenAPI ───────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Poolr API')
    .setDescription('Poolr savings-group platform REST API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // ── Listen ──────────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`API  →  http://localhost:${port}/api`);
  console.log(`Docs →  http://localhost:${port}/api/docs`);
}

bootstrap();
