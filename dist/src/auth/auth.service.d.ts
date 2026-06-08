import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { Response, Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifySuperAdminDto } from './dto/verify-superadmin.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { CreateSuperAdminDto } from './dto/create-superadmin.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly emailService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, emailService: EmailService);
    private extractUniqueRoles;
    private buildEnrichedUserAndSendToken;
    private createSendToken;
    createSuperAdmin(dto: CreateSuperAdminDto, res: Response): Promise<void>;
    login(dto: LoginDto, req: Request, res: Response): Promise<void>;
    setNewPassword(userId: string, dto: SetPasswordDto, res: Response): Promise<void>;
    changeCompanyStatus(companyId: string, status: string, res: Response): Promise<void>;
    verifySuperAdmin(dto: VerifySuperAdminDto, req: Request, res: Response): Promise<void>;
    completeRegistration(token: string, dto: CompleteRegistrationDto, req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    refreshSession(req: Request, res: Response): Promise<void>;
}
