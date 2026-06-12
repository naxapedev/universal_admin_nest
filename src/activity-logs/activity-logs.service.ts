import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateActivityLogDto {
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      this.logger.error(`Failed to write activity log: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
