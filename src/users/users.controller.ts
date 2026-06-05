import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('server1/api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin') // Only superadmin can manage users globally here
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':userId/status')
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(userId, dto);
  }

  @Patch(':userId/restore')
  async undeleteUser(@Param('userId') userId: string) {
    return this.usersService.undeleteUser(userId);
  }
}
