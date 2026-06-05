import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        productIds: true,
        domain: true,
        db_uri: true,
        dbName: true,
        admin_global_user_id: true,
        admin_email: true,
        admin_first_name: true,
        admin_last_name: true,
        status: true,
        enabled_features: true,
        capacity_limits: true,
        is_trial: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: {
            role: { has: 'admin' },
            is_deleted: false,
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    const companiesWithAdmins = await Promise.all(
      companies.map(async (company) => {
        // Count global users linked to this company
        const userCount = await this.prisma.globalUser.count({
          where: {
            global_company_id: company.id,
            status: 'Active',
            NOT: {
              global_user_id: company.admin_global_user_id || 'unmatched_id',
            },
          },
        });

        // Determine admin details
        const membershipAdmin = company.memberships[0];
        let admin = null;
        let displayEmail = null;

        if (company.admin_global_user_id) {
          admin = {
            _id: company.admin_global_user_id,
            first_name: company.admin_first_name || '',
            last_name: company.admin_last_name || '',
            email: company.admin_email || '',
            status: company.status,
            createdAt: company.createdAt,
          };
          displayEmail = company.admin_email;
        } else if (membershipAdmin) {
          admin = {
            _id: membershipAdmin.user_id,
            first_name: membershipAdmin.first_name || '',
            last_name: membershipAdmin.last_name || '',
            email: membershipAdmin.user?.email || '',
            status: company.status,
            createdAt: company.createdAt,
          };
          displayEmail = membershipAdmin.user?.email;
        }

        const { memberships, ...companyData } = company;

        return {
          ...companyData,
          userCount,
          admin,
          displayEmail,
        };
      }),
    );

    return {
      status: 'success',
      total: companiesWithAdmins.length,
      data: companiesWithAdmins,
    };
  }
}
