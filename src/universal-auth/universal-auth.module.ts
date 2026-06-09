import { Module } from '@nestjs/common';
import { UniversalAuthController } from './universal-auth.controller';
import { UniversalAuthService } from './universal-auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, EmailModule, JwtModule.register({})],
  controllers: [UniversalAuthController],
  providers: [UniversalAuthService]
})
export class UniversalAuthModule {}
