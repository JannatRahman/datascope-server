import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: [
      process.env['CLIENT_URL'] ?? 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
  });

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DataScope API')
    .setDescription('DataScope Unified Data Intelligence Platform - REST API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Bearer',
        description: 'Enter your Better Auth session token',
      },
      'bearer',
    )
    .addTag('Datasets', 'Dataset exploration and management')
    .addTag('Records', 'Dataset record querying, filtering, and relationships')
    .addTag('Admin', 'Platform administration, user management, and audit logs')
    .addTag('Dashboards', 'Role-specific dashboard overviews for Analyst and Viewer')
    .addTag('Saved Views', 'User saved queries, filters, and shared views')
    .addTag('Search History', 'User search query tracking and history replay')
    .addTag('Notifications', 'In-app notification center and alerts')
    .addTag('Analytics', 'Platform dataset distribution, performance, and trends')
    .addTag('User Preferences', 'UI themes and table display preferences')
    .addTag('Exports', 'Background data export jobs with CSV and JSON streaming')
    .addTag('Auth', 'Authentication and session verification')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env['NEST_PORT'] ?? '5001');
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`[NestJS] DataScope NestJS server running on port ${port}`);
  console.log(`[NestJS] Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  console.error('[NestJS] Fatal bootstrap error:', err);
  process.exit(1);
});
