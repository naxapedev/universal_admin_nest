import { Injectable, Logger } from '@nestjs/common';
import { Prisma, GlobalUser, Company } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExceptionLogDto } from './dto/create-exception-log.dto';

// ─────────────────────────────────────────────────────────────────────────────
// LogsService — Exception Log Writer & Reader
// ─────────────────────────────────────────────────────────────────────────────
//
// This service owns all exception log operations:
//   Write: writeExceptionLog() — called fire-and-forget by LogsController on
//          POST /logs/errors from external platforms (Express, PHP, etc.)
//   Read:  getExceptionLogs()  — serves paginated exception logs to the
//          super-admin frontend (LogsPage → "Exception Logs" tab)
//
// Activity log read operations have been moved to ActivityLogsService.
// ─────────────────────────────────────────────────────────────────────────────

export interface LogQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  action?: string;
  module?: string;
  companyName?: string;
  platform?: string;
  source?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  severity?: string;
  productId?: string;
}

interface NormalizedLogItem {
  _id: string;
  productId?: string;
  action?: string;
  module?: string;
  payload?: unknown;
  previousData?: unknown;
  errorDetails?: unknown;
  ip?: string;
  userObjectId?: string;
  userId?: string;
  message?: string;
  platform?: string;
  source?: string;
  role?: string[];
  companyName?: string;
  companyDb_uri?: string;
  companyDbName?: string;
  severity?: 'low' | 'medium' | 'high';
  createdAt?: string;
  updatedAt?: string;
  admin?: {
    _id?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: string[];
  };
}

interface PaginatedLogs<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const includesText = (value: unknown, search: string) => {
  if (!search) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(search);
};

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const determineSeverity = (statusCode?: number | null): 'low' | 'medium' | 'high' => {
  if (!statusCode) return 'medium';
  if (statusCode >= 500) return 'high';
  if (statusCode >= 400) return 'medium';
  return 'low';
};

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

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated, filtered list of exception logs enriched with user
   * and company data. Called by LogsController for the super-admin UI.
   */
  async getExceptionLogs(
    query: LogQuery,
  ): Promise<{ status: string; message: string; data: PaginatedLogs<NormalizedLogItem> }> {
    const data = await this.listExceptionLogs(query);
    return {
      status: 'success',
      message: 'Exception logs fetched successfully',
      data,
    };
  }

  /**
   * Persists an exception log record to the universal_admin DB.
   *
   * Designed to be called fire-and-forget:
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
          request_body: (sanitisedBody as Prisma.JsonObject) ?? undefined,
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

  // ──────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private parsePagination(query: LogQuery) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 100);
    const sortBy =
      query.sortBy === 'action' || query.sortBy === 'module' || query.sortBy === 'createdAt'
        ? query.sortBy
        : 'createdAt';
    const order = query.order === 'asc' ? 'asc' : 'desc';

    return { page, limit, sortBy, order } as const;
  }

  private paginate<T>(items: T[], page: number, limit: number): PaginatedLogs<T> {
    const total = items.length;
    const pages = total ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      page,
      limit,
      total,
      pages,
    };
  }

  private async listExceptionLogs(query: LogQuery): Promise<PaginatedLogs<NormalizedLogItem>> {
    const { page, limit, sortBy, order } = this.parsePagination(query);
    const search = normalize(query.search);
    const action = normalize(query.action);
    const module = normalize(query.module);
    const companyName = normalize(query.companyName);
    const platform = normalize(query.platform);
    const source = normalize(query.source);
    const severity = normalize(query.severity);
    const productId = normalize(query.productId);
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    const rawLogs = await this.prisma.exceptionLog.findMany({
      orderBy: { [sortBy]: order },
    });

    const enriched = await this.enrichExceptionLogs(rawLogs);

    const filtered = enriched.filter((item) => {
      if (action && !includesText(item.action, action)) return false;
      if (module && !includesText(item.module, module)) return false;
      if (platform && !includesText(item.platform, platform)) return false;
      if (source && !includesText(item.source, source)) return false;
      if (companyName && !includesText(item.companyName, companyName)) return false;
      if (severity && !includesText(item.severity, severity)) return false;
      if (productId && !includesText(item.productId, productId)) return false;

      if (startDate || endDate) {
        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        if (createdAt && startDate && createdAt < startDate) return false;
        if (createdAt && endDate && createdAt > endDate) return false;
      }

      if (!search) return true;

      return [
        item.action,
        item.module,
        item.message,
        item.platform,
        item.source,
        item.companyName,
        item.admin?.email,
        item.admin?.first_name,
        item.admin?.last_name,
        safeJsonStringify(item.errorDetails),
      ].some((value) => includesText(value, search));
    });

    return this.paginate(filtered, page, limit);
  }

  private async enrichExceptionLogs(
    rawLogs: Array<{
      id: string;
      product_id: string;
      company_id: string;
      user_id: string | null;
      method: string | null;
      path: string | null;
      status_code: number | null;
      error_name: string;
      error_message: string;
      stack_trace: string | null;
      platform: string | null;
      environment: string | null;
      ip_address: string | null;
      user_agent: string | null;
      request_body: Prisma.JsonValue | null;
      createdAt: Date;
    }>,
  ): Promise<NormalizedLogItem[]> {
    const userIds = [
      ...new Set(
        rawLogs.map((log) => log.user_id).filter((value): value is string => Boolean(value)),
      ),
    ];
    const companyIds = [
      ...new Set(
        rawLogs
          .map((log) => log.company_id)
          .filter((value): value is string => Boolean(value) && value !== 'N/A'),
      ),
    ];

    const [globalUsers, companies] = await Promise.all([
      userIds.length
        ? this.prisma.globalUser.findMany({ where: { global_user_id: { in: userIds } } })
        : Promise.resolve([] as GlobalUser[]),
      companyIds.length
        ? this.prisma.company.findMany({ where: { id: { in: companyIds } } })
        : Promise.resolve([] as Company[]),
    ]);

    const globalUsersById = new Map(globalUsers.map((user) => [user.global_user_id, user]));
    const companiesById = new Map(companies.map((company) => [company.id, company]));

    return rawLogs.map((log) => {
      const globalUser = log.user_id ? globalUsersById.get(log.user_id) : undefined;
      const company = log.company_id !== 'N/A' ? companiesById.get(log.company_id) : undefined;
      const role = globalUser?.platform_role ? [globalUser.platform_role] : undefined;

      return {
        _id: log.id,
        productId: log.product_id,
        action: log.error_name,
        module: log.path ?? log.method ?? undefined,
        payload: log.request_body ?? undefined,
        previousData: null,
        errorDetails: {
          error_name: log.error_name,
          error_message: log.error_message,
          stack_trace: log.stack_trace,
          status_code: log.status_code,
          method: log.method,
          path: log.path,
        },
        ip: log.ip_address ?? undefined,
        userObjectId: log.user_id ?? undefined,
        userId: log.user_id ?? undefined,
        message: log.error_message,
        platform: log.platform ?? 'nestjs',
        source: log.environment ?? log.user_agent ?? 'api',
        role,
        companyName: company?.name ?? (log.company_id !== 'N/A' ? log.company_id : undefined),
        companyDb_uri: company?.db_uri ?? undefined,
        companyDbName: company?.dbName ?? undefined,
        severity: determineSeverity(log.status_code),
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.createdAt.toISOString(),
        admin: {
          _id: globalUser?.global_user_id ?? log.user_id ?? undefined,
          first_name: null,
          last_name: null,
          email: globalUser?.email ?? null,
          role,
        },
      };
    });
  }

  /**
   * Deep-clones the request body and removes any keys present in
   * SENSITIVE_BODY_KEYS. This is a last-resort safety net; callers
   * should sanitise before shipping, but we enforce it server-side.
   */
  private sanitiseRequestBody(body: Record<string, unknown>): Prisma.JsonObject {
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