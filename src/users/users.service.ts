import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update the status of a PortalUser (lead / developer).
   * Superadmin can activate, suspend, or deactivate portal staff accounts.
   */
  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const { status } = dto;

    const user = await this.prisma.portalUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.portalUser.update({
      where: { id: userId },
      data: { status },
    });

    return {
      status: 'success',
      message: `User status updated to ${status}`,
    };
  }

  /**
   * Restore a soft-deleted PortalUser (lead / developer).
   */
  async undeleteUser(userId: string) {
    const user = await this.prisma.portalUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.portalUser.update({
      where: { id: userId },
      data: { is_deleted: false, status: 'active' },
    });

    return {
      status: 'success',
      message: 'User restored successfully',
    };
  }
}
