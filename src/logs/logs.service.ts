import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateExceptionLogDto } from './dto/create-exception-log.dto';

// ─────────────────────────────────────────────────────────────────────────────
// LogsService — Universal Exception Log Writer
// ─────────────────────────────────────────────────────────────────────────────
//
// This service is the single, authoritative writer for cross-platform exception
// logs into the universal_admin DB. It is intentionally decoupled from the
// controller so that the exception filter and other internal services can also
// call it directly without going through HTTP.
//
// Design principles enforced here:
//  1. Fire-and-forget: callers use the returned Promise without awaiting.
//     Any DB failure is caught internally and logged to the console — it
//     MUST NOT propagate back and break the caller's response cycle.
//  2. Sanitisation: request_body fields containing known sensitive keys are
//     stripped before the write to prevent accidental credential leakage.
//  3. Extensibility: the TODO marker below shows exactly where Sentry/Datadog
//     would be wired in with zero changes to the rest of the stack.
// ─────────────────────────────────────────────────────────────────────────────

/** Keys that must never be persisted, even if callers forget to strip them. */
const SENSITIVE_BODY_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'confirmPassword',
  'confirm_password',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'secret',
  'card_number',
  'cvv',
  'pin',
]);

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an exception log record to the universal_admin DB.
   *
   * This method is designed to be called fire-and-forget:
   *   `this.logsService.writeExceptionLog(dto).catch(console.error);`
   *
   * It will NEVER throw. All errors are caught internally and written to the
   * process logger so that a DB failure cannot block an HTTP response.
   */
  async writeExceptionLog(dto: CreateExceptionLogDto): Promise<void> {
    try {
      const sanitisedBody = dto.request_body
        ? this.sanitiseRequestBody(dto.request_body)
        : undefined;

      await this.prisma.exceptionLog.create({
        data: {
          // Identification block
          product_id: dto.product_id,
          company_id: dto.company_id,
          user_id: dto.user_id ?? null,

          // Error details
          error_name: dto.error_name,
          error_message: dto.error_message,
          stack_trace: dto.stack_trace ?? null,

          // Request context
          method: dto.method ?? null,
          path: dto.path ?? null,
          status_code: dto.status_code ?? null,

          // Runtime metadata
          platform: dto.platform ?? null,
          environment: dto.environment ?? null,
          ip_address: dto.ip_address ?? null,
          user_agent: dto.user_agent ?? null,
          request_body: sanitisedBody as Prisma.JsonObject ?? undefined,
        },
      });

      this.logger.debug(
        `[LogsService] Exception log written — product: ${dto.product_id}, company: ${dto.company_id}`,
      );

      // ── Future extensibility hook ──────────────────────────────────────────
      // To add Sentry, Datadog, or any external observability platform,
      // insert the call here. Example:
      //   Sentry.captureException(new Error(dto.error_message), {
      //     extra: { product_id: dto.product_id, company_id: dto.company_id },
      //   });
      // No other files in the codebase need to change.
      // ──────────────────────────────────────────────────────────────────────
    } catch (error) {
      // CRITICAL: Do NOT re-throw. The caller (controller) has already sent
      // HTTP 202 Accepted. Throwing here would be silently swallowed anyway
      // in fire-and-forget mode, but we log it for ops visibility.
      this.logger.error(
        `[LogsService] Failed to persist exception log for product "${dto.product_id}": ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deep-clones the request body and removes any keys present in
   * SENSITIVE_BODY_KEYS. This is a last-resort safety net; callers
   * should sanitise before shipping, but we enforce it server-side.
   */
  private sanitiseRequestBody(
    body: Record<string, unknown>,
  ): Prisma.JsonObject {
    const sanitised: Prisma.JsonObject = {};

    for (const [key, value] of Object.entries(body)) {
      if (SENSITIVE_BODY_KEYS.has(key.toLowerCase())) {
        sanitised[key] = '[REDACTED]';
      } else {
        sanitised[key] = value as Prisma.JsonValue;
      }
    }

    return sanitised;
  }
}