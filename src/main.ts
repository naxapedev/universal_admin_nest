import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');

async function startServer() {
  const app = await NestFactory.create(AppModule);

  // Allow cookie-based auth (reads req.cookies in guards)
  app.use(cookieParser());

  // Automatically validate and transform incoming request DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties from body
      forbidNonWhitelisted: true,
      transform: true,       // Auto-transform plain objects to DTO class instances
    }),
  );

  // CORS for frontend clients
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-log-secret'],
  });

  await app.listen(process.env.PORT!);
}
startServer();
