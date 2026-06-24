import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { OauthService } from './oauth.service';
import { AuthorizeDto, TokenExchangeDto } from './dto/oauth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('server1/api/v1/oauth')
export class OauthController {
  constructor(private readonly oauthService: OauthService) {}

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  async authorize(@Body() dto: AuthorizeDto, @Req() req: any) {
    const globalUserId = req.user.global_user_id || req.user.sub;
    return this.oauthService.authorize(dto, globalUserId);
  }

  @Post('token')
  async exchangeToken(@Body() dto: TokenExchangeDto) {
    return this.oauthService.exchangeToken(dto);
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
