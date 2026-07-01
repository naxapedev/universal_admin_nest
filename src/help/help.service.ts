import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHelpRequestDto, UpdateHelpRequestStatusDto } from './dto/create-help.dto';

@Injectable()
export class HelpService {
  constructor(private prisma: PrismaService) {}

  async createRequest(dto: CreateHelpRequestDto, globalUserId?: string) {
    return this.prisma.helpRequest.create({
      data: {
        subject: dto.subject,
        message: dto.message,
        priority: dto.priority || 'Normal',
        global_user_id: globalUserId,
      },
    });
  }

  async getAllRequests() {
    return this.prisma.helpRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        globalUser: {
          select: { email: true, username: true }
        }
      }
    });
  }

  async getRequestsByUser(globalUserId: string) {
    return this.prisma.helpRequest.findMany({
      where: { global_user_id: globalUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateHelpRequestStatusDto) {
    const request = await this.prisma.helpRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Help request with ID ${id} not found`);
    }

    return this.prisma.helpRequest.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
