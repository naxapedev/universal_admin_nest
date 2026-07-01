import { Test, TestingModule } from '@nestjs/testing';
import { OauthController } from './oauth.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OauthService } from './oauth.service';

describe('OauthController', () => {
  let controller: OauthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OauthController],
      providers: [{ provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } }, { provide: PrismaService, useValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }, { provide: OauthService, useValue: {} }],
    }).compile();

    controller = module.get<OauthController>(OauthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
