import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const { status } = dto;

    const memberships = await this.prisma.userCompanyMembership.findMany({
      where: { user_id: userId },
    });

    if (memberships.length === 0) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.userCompanyMembership.updateMany({
      where: { user_id: userId },
      data: { status, is_active: status === 'active' },
    });

    return {
      status: 'success',
      message: `User status updated to ${status}`,
    };
  }

  async undeleteUser(userId: string) {
    const memberships = await this.prisma.userCompanyMembership.findMany({
      where: { user_id: userId },
    });

    if (memberships.length === 0) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.userCompanyMembership.updateMany({
      where: { user_id: userId },
      data: { is_deleted: false },
    });

    return {
      status: 'success',
      message: 'User restored successfully',
    };
  }
}
