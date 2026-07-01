import { Test, TestingModule } from '@nestjs/testing';
import { UniversalAuthController } from './universal-auth.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UniversalAuthService } from './universal-auth.service';

describe('UniversalAuthController', () => {
  let controller: UniversalAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UniversalAuthController],
      providers: [{ provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } }, { provide: PrismaService, useValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }, { provide: UniversalAuthService, useValue: {} }],
    }).compile();

    controller = module.get<UniversalAuthController>(UniversalAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
