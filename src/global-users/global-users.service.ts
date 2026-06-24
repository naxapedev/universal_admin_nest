import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

    const userIds = globalUsers.map((u) => u.global_user_id);
    
    let usersWithVisas = globalUsers.map((user) => ({ ...user, visas: [] as any[] }));
    
    if (userIds.length > 0) {
      const allVisas = await this.prisma.visa.findMany({
        where: { globalUserId: { in: userIds } },
      });

      const productIds = Array.from(new Set(allVisas.map((v) => v.productId)));
      const products = await this.prisma.productRegistry.findMany({
        where: { product_id: { in: productIds } },
        select: { product_id: true, name: true },
      });

      const productMap = new Map(products.map((p) => [p.product_id, p.name]));
      
      const visasByUserId = new Map<string, any[]>();
      for (const visa of allVisas) {
        const v = {
          ...visa,
          product_name: productMap.get(visa.productId) || visa.productId,
        };
        if (!visasByUserId.has(visa.globalUserId)) {
          visasByUserId.set(visa.globalUserId, []);
        }
        visasByUserId.get(visa.globalUserId)!.push(v);
      }

      usersWithVisas = globalUsers.map((user) => ({
        ...user,
        visas: visasByUserId.get(user.global_user_id) || [],
      }));
    }

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

  async assignUserToCompany(globalUserId: string, companyId: string) {
    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: globalUserId },
    });

    if (!user) {
      throw new NotFoundException('Global user not found.');
    }

    if (user.global_company_id && user.global_company_id !== companyId) {
      throw new BadRequestException('User is already assigned to a different company.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.status === 'inactive') {
      throw new BadRequestException('Cannot assign user to an inactive company.');
    }

    await this.prisma.globalUser.update({
      where: { global_user_id: globalUserId },
      data: {
        global_company_id: companyId,
        platform_role: 'User',
      },
    });

    const companyPortalProductId = process.env.COMPANY_PORTAL_PRODUCT_ID;
    if (companyPortalProductId) {
      const existingVisa = await this.prisma.visa.findFirst({
        where: {
          globalUserId,
          productId: companyPortalProductId,
        },
      });

      if (!existingVisa) {
        await this.prisma.visa.create({
          data: {
            globalUserId,
            productId: companyPortalProductId,
            role: 'User',
            status: 'Active',
          },
        });
      }
    }

    return {
      status: 'success',
      message: `User assigned to company successfully.`,
    };
  }

  async updateUserVisa(globalUserId: string, productId: string, role: string) {
    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: globalUserId },
    });

    if (!user) {
      throw new NotFoundException('Global user not found.');
    }

    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    // Upsert the Visa
    const visa = await this.prisma.visa.upsert({
      where: {
        globalUserId_productId: {
          globalUserId,
          productId,
        },
      },
      update: {
        role,
        status: 'Active',
      },
      create: {
        globalUserId,
        productId,
        role,
        status: 'Active',
      },
    });

    return {
      status: 'success',
      message: `User visa updated successfully.`,
      data: visa,
    };
  }
}
