import { Controller, Post, Get, Body, Req, Res, UseGuards, Query, Logger } from '@nestjs/common';
import { OauthService } from './oauth.service';
import { AuthorizeDto, TokenExchangeDto } from './dto/oauth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request, Response } from 'express';

const logger = new Logger('OauthController');

@Controller('server1/api/v1/oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  async authorize(@Body() dto: AuthorizeDto, @Req() req: any) {
    const globalUserId = req.user.global_user_id || req.user.sub;
    logger.log(`[AUTHORIZE] POST authorize for globalUserId=${globalUserId} client_id=${dto.client_id}`);
    return this.oauthService.authorize(dto, globalUserId);
  }

  @Post('token')
  async exchangeToken(@Body() dto: TokenExchangeDto) {
    logger.log(`[TOKEN] Token exchange attempt for client_id=${dto.client_id}`);
    return this.oauthService.exchangeToken(dto);
  }

  /**
   * GET /oauth/silent-authorize
   *
   * The cross-product SSO entry point. No JWT Bearer token required.
   * Instead, it reads the HttpOnly 'uai_session' cookie that was set by UAI
   * when the user logged into any product.
   *
   * Flow:
   *   1. Product B's login page redirects the browser here with PKCE params.
   *   2. UAI reads the uai_session cookie.
   *   3a. Cookie valid  → generate auth code → redirect to redirect_uri?code=...
   *   3b. Cookie missing/invalid → redirect to redirect_uri?error=login_required
   */
  @Get('silent-authorize')
  async silentAuthorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const sessionToken = req.cookies?.['uai_session'];

    if (!sessionToken) {
      logger.warn(`[SILENT-AUTHORIZE] No uai_session cookie found. Returning login_required to ${redirectUri}`);
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'login_required');
      if (state) url.searchParams.set('state', state);
      return res.redirect(url.toString());
    }

    logger.log(`[SILENT-AUTHORIZE] Cookie found. Attempting silent authorize for client_id=${clientId}`);

    try {
      const result = await this.oauthService.silentAuthorize({
        sessionToken,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        state,
      });
      logger.log(`[SILENT-AUTHORIZE] ✅ Auth code generated. Redirecting to ${result.redirectUrl}`);
      return res.redirect(result.redirectUrl);
    } catch (err: any) {
      logger.warn(`[SILENT-AUTHORIZE] ❌ Failed: ${err.message}. Returning login_required to ${redirectUri}`);
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'login_required');
      url.searchParams.set('error_description', err.message || 'Session invalid or expired');
      if (state) url.searchParams.set('state', state);
      return res.redirect(url.toString());
    }
  }

  @Get('silent-check')
  @UseGuards(JwtAuthGuard)
  async silentCheck(@Query('client_id') clientId: string, @Req() req: any) {
    const globalUserId = req.user.global_user_id || req.user.sub;
    return this.oauthService.silentCheck(clientId, globalUserId);
  }

  @Get('userinfo')
  @UseGuards(JwtAuthGuard)
  async getUserInfo(@Req() req: any) {
    const globalUserId = req.user.global_user_id || req.user.sub;
    return this.oauthService.getUserInfo(globalUserId);
  }

  @Get('jwks')
  async getJwks() {
    return this.oauthService.getJwks();
  }
}
