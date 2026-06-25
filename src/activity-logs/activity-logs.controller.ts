import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService, LogQuery } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// ─────────────────────────────────────────────────────────────────────────────
// ActivityLogsController — Super-Admin Activity Log Reader
// ─────────────────────────────────────────────────────────────────────────────
//
// Endpoint:  GET /server1/api/v1/activity-logs
//
// Purpose: Serves paginated, filtered, enriched activity log records to the
// super-admin frontend (LogsPage → "Activity Logs" tab).
//
// Security:
//   Protected by JwtAuthGuard + RolesGuard.
//   Only authenticated super-admins can access this endpoint.
//
// Separation of concerns:
//   Write path: ActivityLogInterceptor → ActivityLogsService.writeActivityLog()
//   Read path:  this controller        → ActivityLogsService.getActivityLogs()
// ─────────────────────────────────────────────────────────────────────────────

@Controller('server1/api/v1/activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}
  

  /**
   * GET /server1/api/v1/activity-logs
   *
   * Returns paginated activity logs enriched with actor and company data.
   *
   * Supported query params:
   *   page, limit, sortBy, order, action, module, companyName,
   *   platform, source, search, startDate, endDate
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  async getActivityLogs(@Query() query: Record<string, string>): Promise<any> {
    return this.activityLogsService.getActivityLogs(query as LogQuery);
  }
}
