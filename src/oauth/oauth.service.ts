import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthorizeDto, TokenExchangeDto } from './dto/oauth.dto';
import * as crypto from 'crypto';

const logger = new Logger('OauthService');

@Injectable()
export class OauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async authorize(dto: AuthorizeDto, globalUserId: string) {
    if (dto.response_type !== 'code') {
      throw new BadRequestException('Unsupported response_type. Must be "code".');
    }

    if (dto.code_challenge_method !== 'S256') {
      throw new BadRequestException('Unsupported code_challenge_method. Must be "S256".');
    }

    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: dto.client_id },
    });

    if (!product) {
      throw new BadRequestException('Invalid client_id.');
    }

    // Verify user has visa for this product
    const visa = await this.prisma.visa.findFirst({
      where: {
        globalUserId,
        productId: dto.client_id,
        status: 'Active',
      },
    });

    if (!visa) {
      throw new ForbiddenException('User does not have access to this product.');
    }

    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        global_user_id: globalUserId,
        product_id: dto.client_id,
        redirect_uri: dto.redirect_uri,
        code_challenge: dto.code_challenge,
        expires_at: expiresAt,
      },
    });

    const redirectUrl = new URL(dto.redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (dto.state) {
      redirectUrl.searchParams.append('state', dto.state);
    }

    return { redirectUrl: redirectUrl.toString() };
  }

  /**
   * silentAuthorize — cookie-based SSO, no password needed.
   *
   * Called by GET /oauth/silent-authorize when the browser redirects here
   * from Product B's login page. Reads the uai_session cookie value (the
   * universal refresh token), validates it, and issues a standard auth code.
   */
  async silentAuthorize(params: {
    sessionToken: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
    state?: string;
  }) {
    logger.log(`[SILENT-AUTHORIZE-SVC] Validating session token for client_id=${params.client_id}`);

    if (params.code_challenge_method !== 'S256') {
      throw new BadRequestException('Unsupported code_challenge_method. Must be "S256".');
    }

    // Step 1 — Validate the session cookie against the UniversalRefreshToken table
    const refreshToken = await this.prisma.universalRefreshToken.findFirst({
      where: {
        token: params.sessionToken,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!refreshToken) {
      logger.warn(`[SILENT-AUTHORIZE-SVC] Session token not found or expired.`);
      throw new UnauthorizedException('UAI session is expired or has been revoked. Please log in again.');
    }

    logger.log(`[SILENT-AUTHORIZE-SVC] Session valid for global_user_id=${refreshToken.global_user_id}`);

    // Step 2 — Load the user and check they're active
    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: refreshToken.global_user_id! },
    });

    if (!user || user.status !== 'Active') {
      logger.warn(`[SILENT-AUTHORIZE-SVC] User not found or not active.`);
      throw new ForbiddenException('User account is not active.');
    }

    // Step 3 — Verify the user has a valid Visa for the requested product
    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: params.client_id },
    });

    if (!product) {
      throw new BadRequestException(`Product with client_id=${params.client_id} not found.`);
    }

    const visa = await this.prisma.visa.findFirst({
      where: {
        globalUserId: user.global_user_id,
        productId: params.client_id,
        status: 'Active',
      },
    });

    if (!visa) {
      logger.warn(`[SILENT-AUTHORIZE-SVC] User ${user.global_user_id} has no active Visa for product ${params.client_id}`);
      throw new ForbiddenException(`User does not have access to ${product.name}.`);
    }

    // Step 4 — Generate the PKCE authorization code (same as standard authorize)
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        global_user_id: user.global_user_id,
        product_id: params.client_id,
        redirect_uri: params.redirect_uri,
        code_challenge: params.code_challenge,
        expires_at: expiresAt,
      },
    });

    logger.log(`[SILENT-AUTHORIZE-SVC] ✅ Code generated for user=${user.email} product=${product.name}`);

    const redirectUrl = new URL(params.redirect_uri);
    redirectUrl.searchParams.append('code', code);
    if (params.state) {
      redirectUrl.searchParams.append('state', params.state);
    }

    return { redirectUrl: redirectUrl.toString() };
  }

  async exchangeToken(dto: TokenExchangeDto) {
    if (dto.grant_type !== 'authorization_code') {
      throw new BadRequestException('Unsupported grant_type. Must be "authorization_code".');
    }

    const product = await this.prisma.productRegistry.findUnique({
      where: { product_id: dto.client_id },
    });

    if (!product || product.server_api_key !== dto.client_secret) {
      throw new UnauthorizedException('Invalid client credentials.');
    }

    const authCode = await this.prisma.oAuthAuthorizationCode.findUnique({
      where: { code: dto.code },
    });

    if (!authCode) {
      throw new BadRequestException('Invalid authorization code.');
    }

    if (authCode.used) {
      throw new BadRequestException('Authorization code has already been used.');
    }

    if (authCode.expires_at < new Date()) {
      throw new BadRequestException('Authorization code has expired.');
    }

    if (authCode.redirect_uri !== dto.redirect_uri) {
      throw new BadRequestException('Invalid redirect_uri.');
    }

    if (authCode.product_id !== dto.client_id) {
      throw new BadRequestException('Invalid client_id for this code.');
    }

    // PKCE verification
    const hash = crypto.createHash('sha256').update(dto.code_verifier).digest('base64url');
    if (hash !== authCode.code_challenge) {
      throw new BadRequestException('Invalid code_verifier.');
    }

    await this.prisma.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });

    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: authCode.global_user_id },
    });

    if (!user || user.status !== 'Active') {
      throw new ForbiddenException('User is not active.');
    }

    let visa = await this.prisma.visa.findFirst({
      where: {
        globalUserId: user.global_user_id,
        productId: product.product_id,
      },
    });

    if (!visa) {
      visa = await this.prisma.visa.create({
        data: {
          globalUserId: user.global_user_id,
          productId: product.product_id,
          role: 'User',
          status: 'Active',
        },
      });
    }

    const username = user.username || user.email;

    const payload = {
      global_user_id: user.global_user_id,
      global_company_id: user.global_company_id,
      email: user.email,
      username,
      visas: [
        { product: product.name, role: visa.role, status: visa.status }
      ],
      aud: product.name
    };

    let accessToken: string;
    if (product.app_private_key) {
      accessToken = this.jwtService.sign(payload, {
        secret: product.app_private_key,
        expiresIn: '1h',
        algorithm: 'RS256',
        issuer: 'Universal-Master',
        keyid: product.product_id,
      });
    } else {
      accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'master_secret',
        expiresIn: '1h',
      });
    }

    // Reuse the user's existing active refresh token — do not create a new one.
    // The user already has a UniversalRefreshToken from when they authenticated
    // with UAI to initiate this OAuth flow. We return that same token so the
    // product can call /universal-auth/refresh-app-token when the access token expires.
    const existingRefreshToken = await this.prisma.universalRefreshToken.findFirst({
      where: {
        global_user_id: user.global_user_id,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' }, // pick the most recently issued one
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      // Only include refresh_token if an active session exists.
      // Products use this with POST /universal-auth/refresh-app-token to silently
      // get a new access token without asking the user for their password again.
      ...(existingRefreshToken && { refresh_token: existingRefreshToken.token }),
    };
  }


  async silentCheck(clientId: string, globalUserId: string) {
    const visa = await this.prisma.visa.findFirst({
      where: {
        globalUserId,
        productId: clientId,
        status: 'Active',
      },
    });

    if (!visa) {
      throw new ForbiddenException('User does not have access to this product.');
    }

    return {
      status: 'success',
      message: 'User is authorized',
    };
  }

  async getUserInfo(globalUserId: string) {
    const user = await this.prisma.globalUser.findUnique({
      where: { global_user_id: globalUserId },
      select: {
        global_user_id: true,
        email: true,
        username: true,
        platform_role: true,
        global_company_id: true,
        status: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found.');
    }

    return {
      sub: user.global_user_id,
      email: user.email,
      preferred_username: user.username,
      roles: [user.platform_role],
      company_id: user.global_company_id,
      status: user.status,
    };
  }

  async getJwks() {
    const products = await this.prisma.productRegistry.findMany({
      where: { app_public_key: { not: '' } },
    });

    const keys = products.map((p) => {
      // Clean up PEM formatting for x5c (strip headers and newlines)
      const x5cValue = (p.app_public_key || '')
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\n/g, '')
        .replace(/\r/g, '');

      return {
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: p.product_id,
        x5c: [x5cValue],
      };
    });

    return { keys };
  }
}
