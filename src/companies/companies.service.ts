import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private splitFullName(fullName: string = '') {
    const trimmed = (fullName || '').trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      return { firstName: '', lastName: '' };
    }

    const parts = trimmed.split(' ');
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }

    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
  }

  private generateVerificationCode(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  async checkCompanyExists(company_name: string) {
    if (!company_name) return { companyExists: false, available: true };

    const normalizedName = company_name.trim().replace(/\s+/g, ' ');

    const existingCompany = await this.prisma.company.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    return {
      companyExists: !!existingCompany,
      available: !existingCompany,
    };
  }

  async checkCompanyNameAvailability(name: string) {
    const result = await this.checkCompanyExists(name);
    return {
      status: true,
      data: {
        available: result.available,
        companyExists: result.companyExists,
        company_name: name
      }
    };
  }

  async createCompany(dto: CreateCompanyDto, userId: string) {
    const { company_name, companyEmail, contactPerson } = dto;

    const existenceCheck = await this.checkCompanyExists(company_name);
    if (!existenceCheck.available) {
      throw new BadRequestException('Company already exists');
    }

    const companyPortalProductId = process.env.COMPANY_PORTAL_PRODUCT_ID;
    if (!companyPortalProductId) {
      throw new InternalServerErrorException('COMPANY_PORTAL_PRODUCT_ID is not configured');
    }

    const adminFullName = contactPerson?.name || company_name;
    const { firstName: adminFirstName, lastName: adminLastName } = this.splitFullName(adminFullName);
    const normalizedEmail = companyEmail.toLowerCase();
    const verificationCode = this.generateVerificationCode();
    const hashedPassword = await bcrypt.hash('ADMIN01', 12);
    const visaRole = process.env.COMPANY_PORTAL_VISA_ROLE || 'Admin';

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: company_name,
          admin_email: normalizedEmail,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          createdBy: userId,
          status: 'inactive',
        },
      });

      // 2. Create or Update GlobalUser (platform_role = 'CompanyAdmin')
      let globalUser = await tx.globalUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (globalUser) {
        globalUser = await tx.globalUser.update({
          where: { email: normalizedEmail },
          data: {
            verification_code: verificationCode,
            global_company_id: company.id,
            platform_role: 'CompanyAdmin',
          },
        });
      } else {
        globalUser = await tx.globalUser.create({
          data: {
            email: normalizedEmail,
            password_hash: hashedPassword,
            status: 'Active',
            platform_role: 'CompanyAdmin',
            global_company_id: company.id,
            verification_code: verificationCode,
          },
        });
      }

      // 3. Update Company with global user ID
      const updatedCompany = await tx.company.update({
        where: { id: company.id },
        data: {
          admin_global_user_id: globalUser.global_user_id,
        },
      });

      // 4. Create Visa
      const existingVisa = await tx.visa.findUnique({
        where: {
          globalUserId_productId: {
            globalUserId: globalUser.global_user_id,
            productId: companyPortalProductId,
          },
        },
      });

      if (!existingVisa) {
        await tx.visa.create({
          data: {
            globalUserId: globalUser.global_user_id,
            productId: companyPortalProductId,
            role: visaRole,
            status: 'Active',
          },
        });
      }

      return { company: updatedCompany, globalUser };
    });

    // Send Email
    await this.emailService.sendVerificationEmail(normalizedEmail, parseInt(verificationCode, 10));

    const { id, ...companyData } = result.company;

    return {
      status: true,
      message: 'Company created successfully. Verification email sent.',
      data: {
        _id: id,
        ...companyData
      },
    };
  }

  async resendCompanyRegistrationRequest(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const globalUser = await this.prisma.globalUser.findUnique({
      where: { global_user_id: company.admin_global_user_id || '' },
    });

    if (!globalUser) {
      throw new NotFoundException('Admin user not found');
    }

    const verificationCode = this.generateVerificationCode();

    await this.prisma.$transaction([
      this.prisma.globalUser.update({
        where: { id: globalUser.id },
        data: { verification_code: verificationCode },
      }),
      this.prisma.company.update({
        where: { id },
        data: { status: 'inactive' },
      }),
    ]);

    await this.emailService.sendVerificationEmail(globalUser.email, parseInt(verificationCode, 10));

    return {
      status: true,
      message: 'Verification email resent successfully.',
    };
  }

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
      },
    });

    const companyIds = companies.map(c => c.id);
    
    let userCountMap = new Map<string, number>();
    if (companyIds.length > 0) {
      const userCounts = await this.prisma.globalUser.groupBy({
        by: ['global_company_id'],
        _count: true,
        where: {
          global_company_id: { in: companyIds },
          platform_role: 'User',
          status: 'Active',
        },
      });

      for (const uc of userCounts) {
        if (uc.global_company_id) {
          userCountMap.set(uc.global_company_id, uc._count);
        }
      }
    }

    const companiesWithAdmins = companies.map((company) => {
      const userCount = userCountMap.get(company.id) || 0;

      // Admin info comes entirely from denormalised Company fields — no extra join needed
      const admin = company.admin_global_user_id
        ? {
            _id: company.admin_global_user_id,
            first_name: company.admin_first_name || '',
            last_name: company.admin_last_name || '',
            email: company.admin_email || '',
            status: company.status,
            createdAt: company.createdAt,
          }
        : null;

      const {
        id,
        admin_global_user_id,
        admin_email,
        admin_first_name,
        admin_last_name,
        ...companyData
      } = company;

      return {
        _id: id,
        ...companyData,
        userCount,
        admin,
        displayEmail: company.admin_email || null,
      };
    });

    return {
      status: true,
      total: companiesWithAdmins.length,
      data: companiesWithAdmins,
    };
  }
}
