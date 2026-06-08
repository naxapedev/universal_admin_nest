import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
export interface JwtPayload {
    id: string;
    role: string[];
    email?: string;
    iat?: number;
    exp?: number;
}
export declare class JwtAuthGuard implements CanActivate {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    canActivate(context: ExecutionContext): boolean;
}
