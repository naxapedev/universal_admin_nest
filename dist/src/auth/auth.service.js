"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const email_service_1 = require("../email/email.service");
const bcrypt = __importStar(require("bcryptjs"));
const crypto = __importStar(require("crypto"));
const ALLOWED_PORTAL_ROLES = ['superadmin', 'lead', 'developer'];
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    emailService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService, emailService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }
    async createSendToken(user, statusCode, req, res, additionalData = {}, rememberMe = false) {
        const expiresIn = rememberMe
            ? (process.env.REMEMBER_ME_JWT_EXPIRES_IN ?? '30d')
            : (process.env.JWT_EXPIRES_IN ?? '1d');
        const cookieMaxAge = rememberMe
            ? 30 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
        const accessToken = this.jwtService.sign({
            id: user.id,
            role: user.role,
            companyId: user.companyId ?? null,
        }, { expiresIn: expiresIn });
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: cookieMaxAge,
            sameSite: 'lax',
            path: '/',
        });
        const refreshTokenString = crypto.randomBytes(40).toString('hex');
        const refreshExpiresInDays = rememberMe ? 30 : 7;
        const refreshExpiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000);
        await this.prisma.universalRefreshToken.create({
            data: {
                token: refreshTokenString,
                global_user_id: user.id,
                expiresAt: refreshExpiresAt,
                userAgent: req.headers['user-agent'] ?? 'unknown',
                ipAddress: req.ip ?? 'unknown',
            },
        });
        res.cookie('refreshToken', refreshTokenString, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: refreshExpiresAt.getTime() - Date.now(),
            sameSite: 'lax',
            path: '/',
        });
        const { password_hash: _pw, ...safeUser } = user;
        res.status(statusCode).json({
            status: 'success',
            data: {
                user: {
                    ...safeUser,
                    role: user.role,
                    first_name: user.first_name,
                    last_name: user.last_name,
                },
                ...additionalData,
            },
        });
    }
    async login(dto, req, res) {
        const { email, password, rememberMe = false } = dto;
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                memberships: { where: { is_deleted: false } },
            },
        });
        if (!user) {
            throw new common_1.BadRequestException('Incorrect email, please try with a different email!');
        }
        const allRoles = [
            ...new Set(user.memberships.flatMap((m) => m.role)),
        ];
        const hasPortalAccess = allRoles.some((r) => ALLOWED_PORTAL_ROLES.includes(r));
        if (!hasPortalAccess) {
            throw new common_1.BadRequestException('Only authorized users can login to this portal!');
        }
        if (user.memberships.some((m) => m.status === 'suspended')) {
            throw new common_1.BadRequestException('This user has been suspended, please contact support.');
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new common_1.BadRequestException('Invalid password!');
        }
        if (allRoles.includes('superadmin') && !allRoles.includes('lead')) {
            const now = Date.now();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            const lastVerifiedAt = user.lastVerifiedAt
                ? new Date(user.lastVerifiedAt).getTime()
                : 0;
            const sevenDaysPassed = now - lastVerifiedAt > oneWeek;
            if (sevenDaysPassed) {
                const verificationCode = crypto.randomInt(100000, 999999);
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        isVerified: false,
                        verificationCode,
                        verificationCodeExpiresAt: new Date(now + 24 * 60 * 60 * 1000),
                    },
                });
                await this.emailService.sendVerificationEmail(user.email, verificationCode);
                throw new common_1.BadRequestException('Your verification has expired. A new code has been sent to your email. Please verify again to continue.');
            }
            if (!user.isVerified) {
                throw new common_1.BadRequestException('Please verify your email to continue. Check your inbox for the verification code.');
            }
        }
        let metaData = {};
        const primaryMembership = user.memberships[0];
        if (allRoles.includes('admin')) {
            const adminMembership = user.memberships.find((m) => m.role.includes('admin'));
            if (adminMembership?.company_id) {
                const company = await this.prisma.company.findUnique({
                    where: { id: adminMembership.company_id },
                    select: { domain: true, db_uri: true },
                });
                if (company) {
                    metaData = { company: { domain: company.domain, dbUri: company.db_uri } };
                }
            }
        }
        const enrichedUser = {
            ...user,
            role: allRoles,
            companyId: user.memberships.find((m) => m.role.includes('admin'))?.company_id ?? null,
            first_name: primaryMembership?.first_name ?? null,
            last_name: primaryMembership?.last_name ?? null,
        };
        await this.prisma.user.update({
            where: { id: user.id },
            data: { updatedAt: new Date() },
        });
        await this.createSendToken(enrichedUser, 200, req, res, metaData, rememberMe);
    }
    async setNewPassword(userId, dto, res) {
        const { oldPassword, newPassword } = dto;
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found!');
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch)
            throw new common_1.BadRequestException('Invalid old password!');
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        const membership = await this.prisma.userCompanyMembership.findFirst({
            where: { user_id: userId },
        });
        if (membership?.company_id) {
            await this.prisma.company.update({
                where: { id: membership.company_id },
                data: { status: 'active' },
            });
        }
        res.status(200).json({
            status: 'success',
            message: 'Password updated and account activated successfully!',
            data: { userId, companyStatus: 'active' },
        });
    }
    async changeCompanyStatus(companyId, status, currentUserRoles, res) {
        const isSuperAdmin = Array.isArray(currentUserRoles)
            ? currentUserRoles.includes('superadmin')
            : currentUserRoles === 'superadmin';
        if (!isSuperAdmin) {
            throw new common_1.ForbiddenException('Only super admin has this access!');
        }
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company)
            throw new common_1.NotFoundException('Company not found');
        await this.prisma.company.update({
            where: { id: companyId },
            data: { status: status || 'inactive' },
        });
        await this.prisma.userCompanyMembership.updateMany({
            where: { company_id: companyId },
            data: { status: status || 'inactive', is_active: status === 'active' },
        });
        res.status(200).json({
            status: 'success',
            message: 'Company and user status updated successfully',
        });
    }
    async verifySuperAdmin(dto, req, res) {
        const { email, code } = dto;
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { memberships: { where: { is_deleted: false } } },
        });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const allRoles = [...new Set(user.memberships.flatMap((m) => m.role))];
        if (!allRoles.includes('superadmin')) {
            throw new common_1.ForbiddenException('Access denied. Only super admin can verify.');
        }
        if (user.verificationCode !== parseInt(code, 10)) {
            throw new common_1.BadRequestException('Invalid verification code');
        }
        if (user.verificationCodeExpiresAt &&
            Date.now() > new Date(user.verificationCodeExpiresAt).getTime()) {
            throw new common_1.BadRequestException('Verification code expired');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                lastVerifiedAt: new Date(),
                verificationCode: null,
                verificationCodeExpiresAt: null,
            },
        });
        const enrichedUser = {
            ...user,
            role: allRoles,
            first_name: user.memberships[0]?.first_name ?? null,
            last_name: user.memberships[0]?.last_name ?? null,
        };
        await this.createSendToken(enrichedUser, 200, req, res);
    }
    async completeRegistration(token, dto, req, res) {
        let decoded;
        try {
            decoded = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET,
            });
        }
        catch {
            throw new common_1.BadRequestException('Invalid or expired registration token.');
        }
        if (!decoded?.userId) {
            throw new common_1.BadRequestException('Invalid token payload.');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { memberships: true },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const hashedPassword = await bcrypt.hash(dto.password, 12);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { email: dto.email, password: hashedPassword },
        });
        const membership = user.memberships[0];
        if (membership) {
            await this.prisma.userCompanyMembership.update({
                where: { id: membership.id },
                data: { status: 'active', is_active: true },
            });
            if (membership.company_id) {
                await this.prisma.company.update({
                    where: { id: membership.company_id },
                    data: { status: 'active' },
                });
            }
        }
        const allRoles = [...new Set(user.memberships.flatMap((m) => m.role))];
        const enrichedUser = {
            ...user,
            email: dto.email,
            role: allRoles,
            first_name: membership?.first_name ?? null,
            last_name: membership?.last_name ?? null,
        };
        await this.createSendToken(enrichedUser, 200, req, res);
    }
    async logout(req, res) {
        const { refreshToken } = req.cookies;
        if (refreshToken) {
            await this.prisma.universalRefreshToken.updateMany({
                where: { token: refreshToken },
                data: { revoked: true },
            });
        }
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        };
        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);
        res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
    }
    async refreshSession(req, res) {
        const { refreshToken } = req.cookies;
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('No refresh token provided.');
        }
        const tokenRecord = await this.prisma.universalRefreshToken.findUnique({
            where: { token: refreshToken },
        });
        if (!tokenRecord ||
            tokenRecord.revoked ||
            tokenRecord.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token.');
        }
        const user = await this.prisma.user.findFirst({
            where: { id: tokenRecord.global_user_id },
            include: { memberships: { where: { is_deleted: false } } },
        });
        if (!user) {
            throw new common_1.ForbiddenException('User not found or suspended.');
        }
        const allRoles = [...new Set(user.memberships.flatMap((m) => m.role))];
        await this.prisma.universalRefreshToken.update({
            where: { id: tokenRecord.id },
            data: { revoked: true },
        });
        let metaData = {};
        const primaryMembership = user.memberships[0];
        if (allRoles.includes('admin')) {
            const adminMembership = user.memberships.find((m) => m.role.includes('admin'));
            if (adminMembership?.company_id) {
                const company = await this.prisma.company.findUnique({
                    where: { id: adminMembership.company_id },
                    select: { domain: true, db_uri: true },
                });
                if (company) {
                    metaData = { company: { domain: company.domain, dbUri: company.db_uri } };
                }
            }
        }
        const enrichedUser = {
            ...user,
            role: allRoles,
            companyId: user.memberships.find((m) => m.role.includes('admin'))?.company_id ?? null,
            first_name: primaryMembership?.first_name ?? null,
            last_name: primaryMembership?.last_name ?? null,
        };
        await this.createSendToken(enrichedUser, 200, req, res, metaData, true);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map