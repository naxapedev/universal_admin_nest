import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { UsersModule } from './users/users.module';
import { GlobalUsersModule } from './global-users/global-users.module';
import { CompaniesModule } from './companies/companies.module';
import { ProductsModule } from './products/products.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { UniversalAuthModule } from './universal-auth/universal-auth.module';
import { LogsModule } from './logs/logs.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { ActivityLogInterceptor } from './activity-logs/activity-log.interceptor';
import { OauthModule } from './oauth/oauth.module';
import { HelpModule } from './help/help.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    EmailModule,
    UsersModule,
    GlobalUsersModule,
    CompaniesModule,
    ProductsModule,
    UniversalAuthModule,
    LogsModule, // ← Universal Log Ingestion Gateway
    ActivityLogsModule, OauthModule,
    HelpModule,
  ],
  controllers: [AppController],

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule {}

