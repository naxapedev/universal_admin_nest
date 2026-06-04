import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifySuperAdminDto } from './dto/verify-superadmin.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import type { JwtPayload } from './guards/jwt-auth.guard';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, req: Request, res: Response): Promise<void>;
    setNewPassword(id: string, dto: SetPasswordDto, res: Response): Promise<void>;
    changeCompanyStatus(companyId: string, status: string, user: JwtPayload, res: Response): Promise<void>;
    completeRegistration(token: string, dto: CompleteRegistrationDto, req: Request, res: Response): Promise<void>;
    verifySuperAdmin(dto: VerifySuperAdminDto, req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    refresh(req: Request, res: Response): Promise<void>;
}
