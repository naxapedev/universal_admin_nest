import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { LogsService } from './logs.service';
import { CreateExceptionLogDto } from './dto/create-exception-log.dto';
import { InternalLogAuthGuard } from './guards/internal-log-auth.guard';
import type { VerifiedProductContext } from './guards/internal-log-auth.guard';

// ─────────────────────────────────────────────────────────────────────────────
// LogsController — Universal Log Ingestion Gateway
// ─────────────────────────────────────────────────────────────────────────────
//
// Endpoint:  POST /api/v1/logs/errors
//
// Purpose: Accepts exception payloads from any registered external platform
// (Express.js, NestJS, PHP, etc.) and persists them to the universal_admin DB.
//
// Response contract:
//   HTTP 202 Accepted — returned IMMEDIATELY, before the DB write completes.
//   The Prisma insert runs out-of-band. The calling platform is unblocked
//   within milliseconds, preventing thread starvation in high-error scenarios.
//
// Security:
//   Protected by InternalLogAuthGuard (dual-layer: header secret + product_id).
//   Only platforms with a valid x-log-secret matching a registered ProductRegistry
//   record can write to this endpoint. No JWT or session cookie is needed.
//
// CRITICAL CONSTRAINT: This controller has NO read endpoints. The Super Admin
// portal cannot query tenant activity logs through this gateway. Reads are
// the exclusive concern of a future, separately secured admin dashboard module.
// ─────────────────────────────────────────────────────────────────────────────

@Controller('api/v1/logs')
export class LogsController {
  private readonly logger = new Logger(LogsController.name);

  constructor(private readonly logsService: LogsService) {}

  /**
   * POST /api/v1/logs/errors
   *
   * Ingests a cross-platform exception payload and returns 202 immediately.
   * The DB write happens asynchronously after the response is sent.
   *
   * Required headers:
   *   x-log-secret: <product_app_private_key>
   *
   * Required body fields (identification block):
   *   product_id, company_id, error_name, error_message
   */
  @Post('errors')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — fire-and-forget contract
  @UseGuards(InternalLogAuthGuard)
  ingestExceptionLog(
    @Body() dto: CreateExceptionLogDto,
    @Req() req: Request,
  ): { status: string; message: string } {
    const verifiedProduct = (req as any).verifiedProduct as VerifiedProductContext;

    this.logger.log(
      `[LogsController] Ingesting exception from product "${verifiedProduct.product_name}" ` +
        `(${dto.product_id}) — company: ${dto.company_id} — error: ${dto.error_name}`,
    );

    // ── FIRE-AND-FORGET: Do NOT await this call ───────────────────────────────
    // The DB insert runs asynchronously. Any failure is caught inside the
    // service and written to the logger — it will NEVER crash this endpoint.
    // The calling platform (Express/PHP/etc.) is unblocked before the write
    // completes, eliminating any risk of log shipping stalling production traffic.
    this.logsService
      .writeExceptionLog(dto)
      .catch((err: Error) =>
        this.logger.error(
          `[LogsController] Unexpected unhandled error in writeExceptionLog: ${err.message}`,
          err.stack,
        ),
      );

    // ── Return 202 immediately ────────────────────────────────────────────────
    return {
      status: 'accepted',
      message: 'Exception log received and queued for storage.',
    };
  }
}
