import { Module } from '@nestjs/common';
import { GlobalUsersController } from './global-users.controller';
import { GlobalUsersService } from './global-users.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GlobalUsersController],
  providers: [GlobalUsersService],
})
export class GlobalUsersModule {}
