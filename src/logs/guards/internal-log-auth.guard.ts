import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';

export interface VerifiedProductContext {
  product_id: string;
  product_name: string;
}

@Injectable()
export class InternalLogAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalLogAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        `[LogAuthGuard] Rejected — missing Authorization: Bearer header. IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Missing Authorization header. Expected: Authorization: Bearer <server_api_key>',
      );
    }

    const serverApiKey = authHeader.substring(7).trim();

    if (!serverApiKey) {
      throw new UnauthorizedException('Empty Bearer token provided.');
    }

    const product = await this.prisma.productRegistry.findUnique({
      where: { server_api_key: serverApiKey },
      select: {
        product_id: true,
        name: true,
      },
    });

    if (!product) {
      this.logger.warn(
        `[LogAuthGuard] Rejected — invalid server_api_key. IP: ${request.ip}`,
      );
      throw new UnauthorizedException(
        'Invalid server_api_key.',
      );
    }

    const bodyProductId = request.body?.product_id;
    if (bodyProductId && bodyProductId !== product.product_id) {
      throw new UnauthorizedException('Mismatch between server_api_key and product_id in payload.');
    }

    (request as any).verifiedProduct = {
      product_id: product.product_id,
      product_name: product.name,
    } satisfies VerifiedProductContext;

    this.logger.debug(
      `[LogAuthGuard] ✅ Authenticated: "${product.name}" (${product.product_id})`,
    );

    return true;
  }
}
