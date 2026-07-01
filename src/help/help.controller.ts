import { Controller, Post, Get, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { HelpService } from './help.service';
import { CreateHelpRequestDto, UpdateHelpRequestStatusDto } from './dto/create-help.dto';
import { Request } from 'express';

// We'll use optional auth. If the user provides a token, we attach their ID.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('server1/api/v1/help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post()
  async createRequest(@Body() dto: CreateHelpRequestDto, @Req() req: any) {
    // Attempt to extract user id if authenticated. 
    // This allows both public (anonymous) help requests and authenticated ones.
    let globalUserId: string | undefined = undefined;
    if (req.user && (req.user.global_user_id || req.user.id)) {
      globalUserId = req.user.global_user_id || req.user.id;
    }
    
    return this.helpService.createRequest(dto, globalUserId);
  }

  // Admin endpoint to view all help requests
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin') // Only admins can see all requests
  async getAllRequests() {
    return this.helpService.getAllRequests();
  }

  // User endpoint to view their own help requests
  @Get('my-requests')
  @UseGuards(JwtAuthGuard)
  async getMyRequests(@Req() req: any) {
    const globalUserId = req.user.global_user_id || req.user.id;
    return this.helpService.getRequestsByUser(globalUserId);
  }

  // Admin endpoint to update ticket status
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateHelpRequestStatusDto) {
    return this.helpService.updateStatus(id, dto);
  }
}
