import { Module } from '@nestjs/common';
import { UniversalAuthController } from './universal-auth.controller';
import { UniversalAuthService } from './universal-auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, EmailModule, AuthModule],
  controllers: [UniversalAuthController],
  providers: [UniversalAuthService]
})
export class UniversalAuthModule {}
