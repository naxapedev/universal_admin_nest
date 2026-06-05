import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { GlobalUsersService } from './global-users.service';
import { UpdateGlobalUserStatusDto } from './dto/update-global-user-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('server1/api/v1/global-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class GlobalUsersController {
  constructor(private readonly globalUsersService: GlobalUsersService) {}

  @Get()
  async getGlobalUsers() {
    return this.globalUsersService.getGlobalUsers();
  }

  @Patch(':globalUserId/status')
  async updateGlobalUserStatus(
    @Param('globalUserId') globalUserId: string,
    @Body() dto: UpdateGlobalUserStatusDto,
  ) {
    return this.globalUsersService.updateGlobalUserStatus(globalUserId, dto);
  }
}
