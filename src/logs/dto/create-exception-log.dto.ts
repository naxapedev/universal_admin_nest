import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICATION BLOCK — strictly required for every inbound log
// These three fields are the mandatory tracing identifiers. Without them
// we cannot attribute the error to a specific platform, tenant, or actor.
// ─────────────────────────────────────────────────────────────────────────────

export class CreateExceptionLogDto {
  // ── Required: Identification ───────────────────────────────────────────────

  /** The `product_id` UUID from ProductRegistry — identifies the calling platform. */
  @IsString()
  @IsNotEmpty({ message: 'product_id is required for error attribution.' })
  product_id: string;

  /** The company/tenant ID this error occurred in. Use "N/A" if not tenant-scoped. */
  @IsString()
  @IsNotEmpty({ message: 'company_id is required for tenant tracing.' })
  company_id: string;

  /** The global_user_id of the user whose action triggered the exception. Optional. */
  @IsOptional()
  @IsString()
  user_id?: string;

  // ── Optional: Error details ────────────────────────────────────────────────

  /** JavaScript/PHP error class name: TypeError, RuntimeException, etc. */
  @IsString()
  @IsNotEmpty({ message: 'error_name is required.' })
  @MaxLength(255)
  error_name: string;

  /** Human-readable error description. */
  @IsString()
  @IsNotEmpty({ message: 'error_message is required.' })
  error_message: string;

  /** Full multi-line stack trace. Stored as TEXT — no length limit enforced here. */
  @IsOptional()
  @IsString()
  stack_trace?: string;

  // ── Optional: Request context ──────────────────────────────────────────────

  /** HTTP method of the request that caused the error: GET, POST, PUT, etc. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  method?: string;

  /** Full URL path of the failing request e.g. /api/v1/drivers/assign */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  path?: string;

  /** HTTP status code of the failing response (typically 500). */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  status_code?: number;

  // ── Optional: Runtime metadata ─────────────────────────────────────────────

  /** Platform identifier: "express", "nestjs", "laravel", etc. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  platform?: string;

  /** Runtime environment: "production", "staging", "development". */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  environment?: string;

  /** IP address of the originating request or server. */
  @IsOptional()
  @IsString()
  @MaxLength(45) // IPv6 max length
  ip_address?: string;

  /** Browser/client user agent string. */
  @IsOptional()
  @IsString()
  user_agent?: string;

  /**
   * A sanitised snapshot of the request body.
   * IMPORTANT: Callers MUST strip sensitive fields (password, token, card_number)
   * before shipping this payload. Never log raw credentials.
   */
  @IsOptional()
  @IsObject()
  request_body?: Record<string, unknown>;
}
