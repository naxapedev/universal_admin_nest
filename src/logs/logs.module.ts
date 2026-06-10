import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { InternalLogAuthGuard } from './guards/internal-log-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

// ─────────────────────────────────────────────────────────────────────────────
// LogsModule — Universal Log Ingestion Gateway
// ─────────────────────────────────────────────────────────────────────────────
//
// This module encapsulates the complete log ingestion boundary:
//   - InternalLogAuthGuard: validates x-log-secret against ProductRegistry
//   - LogsService:          writes exception records to the universal_admin DB
//   - LogsController:       exposes POST /api/v1/logs/errors
//
// PrismaModule is imported (not declared locally) because PrismaService is
// already a singleton provided by the global PrismaModule. This avoids
// creating a second DB connection pool just for logs.
//
// LogsService is exported so the GlobalExceptionFilter can optionally inject
// it to auto-log internal NestJS 5xx errors without duplicating write logic.
// ─────────────────────────────────────────────────────────────────────────────

@Module({
  imports: [PrismaModule],
  controllers: [LogsController],
  providers: [LogsService, InternalLogAuthGuard],
  exports: [LogsService], // Allow GlobalExceptionFilter to import LogsService
})
export class LogsModule {}
