import { Controller, Get, Post, Body, Req, Query, Param, UseGuards, Patch } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('server1/api/v1/company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async getCompanies() {
    return this.companiesService.getCompanies();
  }

  @Post('create')
  async createCompany(@Body() dto: CreateCompanyDto, @Req() req: any) {
    return this.companiesService.createCompany(dto, req.user.id);
  }

  @Get('check-name-availability')
  async checkAvailability(@Query('company_name') companyName: string) {
    return this.companiesService.checkCompanyNameAvailability(companyName);
  }

  @Patch('resend-registration-request/:id')
  async resendRegistration(@Param('id') id: string) {
    return this.companiesService.resendCompanyRegistrationRequest(id);
  }
}
