import { Module } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

// ─────────────────────────────────────────────────────────────────────────────
// ActivityLogsModule
// ─────────────────────────────────────────────────────────────────────────────
//
// Owns the full lifecycle of activity logs:
//   Write: ActivityLogInterceptor (used by other modules) → ActivityLogsService
//   Read:  ActivityLogsController (GET /activity-logs)    → ActivityLogsService
//
// AuthModule is imported to satisfy JwtAuthGuard and RolesGuard used by the
// read controller. PrismaModule provides the DB connection.
//
// ActivityLogsService is exported so the ActivityLogInterceptor can be
// provided by other modules (e.g., AppModule) and injected with this service.
// ─────────────────────────────────────────────────────────────────────────────

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
