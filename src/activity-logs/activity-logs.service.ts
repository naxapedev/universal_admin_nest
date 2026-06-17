import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PortalUser, GlobalUser, Company } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// ActivityLogsService — Write + Read for Activity Logs
// ─────────────────────────────────────────────────────────────────────────────
//
// Write path: writeActivityLog() — called fire-and-forget by ActivityLogInterceptor
//             on every modifying HTTP request (POST/PUT/PATCH/DELETE).
//
// Read path:  getActivityLogs() — called by ActivityLogsController to serve
//             paginated, filtered activity log data to the super-admin frontend.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateActivityLogDto {
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

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
}

interface NormalizedActivityLogItem {
  _id: string;
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

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Write Path
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Persists an activity log record. Designed to be called fire-and-forget
   * by the ActivityLogInterceptor — failures are caught and logged internally.
   */
  async writeActivityLog(dto: CreateActivityLogDto): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          actor_id: dto.actor_id,
          action: dto.action,
          entity_type: dto.entity_type,
          entity_id: dto.entity_id,
          details: dto.details ? (dto.details as Prisma.JsonObject) : undefined,
          ip_address: dto.ip_address,
          user_agent: dto.user_agent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write activity log: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read Path
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated, filtered list of activity logs enriched with user
   * and company data. Called by ActivityLogsController for the super-admin UI.
   */
  async getActivityLogs(
    query: LogQuery,
  ): Promise<{ status: string; message: string; data: PaginatedLogs<NormalizedActivityLogItem> }> {
    const data = await this.listActivityLogs(query);
    return {
      status: 'success',
      message: 'Activity logs fetched successfully',
      data,
    };
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

  private async listActivityLogs(query: LogQuery): Promise<PaginatedLogs<NormalizedActivityLogItem>> {
    const { page, limit, sortBy, order } = this.parsePagination(query);
    const search = normalize(query.search);
    const action = normalize(query.action);
    const module = normalize(query.module);
    const companyName = normalize(query.companyName);
    const platform = normalize(query.platform);
    const source = normalize(query.source);
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    const rawLogs = await this.prisma.activityLog.findMany({
      orderBy: { [sortBy]: order },
    });

    const enriched = await this.enrichActivityLogs(rawLogs);

    const filtered = enriched.filter((item) => {
      if (action && !includesText(item.action, action)) return false;
      if (module && !includesText(item.module, module)) return false;
      if (platform && !includesText(item.platform, platform)) return false;
      if (source && !includesText(item.source, source)) return false;
      if (companyName && !includesText(item.companyName, companyName)) return false;

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
        safeJsonStringify(item.payload),
      ].some((value) => includesText(value, search));
    });

    return this.paginate(filtered, page, limit);
  }

  private async enrichActivityLogs(
    rawLogs: Array<{
      id: string;
      actor_id: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      details: Prisma.JsonValue | null;
      ip_address: string | null;
      user_agent: string | null;
      createdAt: Date;
    }>,
  ): Promise<NormalizedActivityLogItem[]> {
    const actorIds = [
      ...new Set(
        rawLogs.map((log) => log.actor_id).filter((value): value is string => Boolean(value)),
      ),
    ];

    const [portalUsers, globalUsers] = await Promise.all([
      actorIds.length
        ? this.prisma.portalUser.findMany({ where: { id: { in: actorIds } } })
        : Promise.resolve([] as PortalUser[]),
      actorIds.length
        ? this.prisma.globalUser.findMany({ where: { global_user_id: { in: actorIds } } })
        : Promise.resolve([] as GlobalUser[]),
    ]);

    const globalCompanyIds = [
      ...new Set(
        globalUsers
          .map((user) => user.global_company_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const companies = globalCompanyIds.length
      ? await this.prisma.company.findMany({ where: { id: { in: globalCompanyIds } } })
      : ([] as Company[]);

    const portalUsersById = new Map(portalUsers.map((user) => [user.id, user]));
    const globalUsersById = new Map(globalUsers.map((user) => [user.global_user_id, user]));
    const companiesById = new Map(companies.map((company) => [company.id, company]));

    return rawLogs.map((log) => {
      const portalUser = log.actor_id ? portalUsersById.get(log.actor_id) : undefined;
      const globalUser = log.actor_id ? globalUsersById.get(log.actor_id) : undefined;
      const company = globalUser?.global_company_id
        ? companiesById.get(globalUser.global_company_id)
        : undefined;
      const role =
        portalUser?.role ?? (globalUser?.platform_role ? [globalUser.platform_role] : undefined);

      return {
        _id: log.id,
        action: log.action,
        module: log.entity_type ?? undefined,
        payload: log.details ?? undefined,
        previousData: null,
        errorDetails: null,
        ip: log.ip_address ?? undefined,
        userObjectId: log.actor_id ?? undefined,
        userId: log.actor_id ?? undefined,
        message: log.action,
        platform: 'nestjs',
        source: log.user_agent ?? 'api',
        role,
        companyName: company?.name ?? undefined,
        companyDb_uri: company?.db_uri ?? undefined,
        companyDbName: company?.dbName ?? undefined,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.createdAt.toISOString(),
        admin: {
          _id: portalUser?.id ?? globalUser?.global_user_id ?? log.actor_id ?? undefined,
          first_name: portalUser?.first_name ?? null,
          last_name: portalUser?.last_name ?? null,
          email: portalUser?.email ?? globalUser?.email ?? null,
          role,
        },
      };
    });
  }
}
