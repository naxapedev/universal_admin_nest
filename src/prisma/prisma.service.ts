
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static pgPool: Pool;
  private static pgAdapter: PrismaPg;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/universal_admin?schema=public';
    
    if (!PrismaService.pgPool) {
      PrismaService.pgPool = new Pool({ connectionString });
      PrismaService.pgAdapter = new PrismaPg(PrismaService.pgPool);
    }

    super({
      adapter: PrismaService.pgAdapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    // Clean up the pg pool when NestJS destroys the module
    if (PrismaService.pgPool) {
      await PrismaService.pgPool.end();
    }
  }
}
