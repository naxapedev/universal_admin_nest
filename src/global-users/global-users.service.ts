import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGlobalUserStatusDto } from './dto/update-global-user-status.dto';

@Injectable()
export class GlobalUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns only regular product users (platform_role = 'User').
   * Company admins (platform_role = 'CompanyAdmin') are shown via GET /company.
   */
  async getGlobalUsers() {
    const globalUsers = await this.prisma.globalUser.findMany({
      where: {
        platform_role: 'User',
      },
      select: {
        id: true,
        global_user_id: true,
        username: true,
        email: true,
        platform_role: true,
        global_company_id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const usersWithVisas = await Promise.all(
      globalUsers.map(async (user) => {
        const visas = await this.prisma.visa.findMany({
          where: { globalUserId: user.global_user_id },
        });

        const visasWithProductDetails = await Promise.all(
          visas.map(async (visa) => {
            const product = await this.prisma.productRegistry.findUnique({
              where: { product_id: visa.productId },
              select: { name: true },
            });
            return {
              ...visa,
              product_name: product?.name || visa.productId,
            };
          }),
        );

        return {
          ...user,
          visas: visasWithProductDetails,
        };
      }),
    );

    return {
      status: 'success',
      total: usersWithVisas.length,
      data: usersWithVisas,
    };
  }

  async updateGlobalUserStatus(globalUserId: string, dto: UpdateGlobalUserStatusDto) {
    const { status } = dto;

    const updatedUser = await this.prisma.globalUser.update({
      where: { global_user_id: globalUserId },
      data: { status },
      select: {
        id: true,
        global_user_id: true,
        username: true,
        email: true,
        platform_role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => null);

    if (!updatedUser) {
      throw new NotFoundException('Global user not found.');
    }

    return {
      status: 'success',
      message: `Global user status updated to ${status}`,
      data: updatedUser,
    };
  }
}
