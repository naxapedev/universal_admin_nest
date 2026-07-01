import { Test, TestingModule } from '@nestjs/testing';
import { UniversalAuthService } from './universal-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';

describe('UniversalAuthService', () => {
  let service: UniversalAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UniversalAuthService, { provide: PrismaService, useValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }, { provide: EmailService, useValue: { sendEmail: jest.fn() } }, { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } }],
    }).compile();

    service = module.get<UniversalAuthService>(UniversalAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
