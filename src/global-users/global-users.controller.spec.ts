import { Test, TestingModule } from '@nestjs/testing';
import { GlobalUsersController } from './global-users.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalUsersService } from './global-users.service';

describe('GlobalUsersController', () => {
  let controller: GlobalUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalUsersController],
      providers: [{ provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } }, { provide: PrismaService, useValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }, { provide: GlobalUsersService, useValue: {} }],
    }).compile();

    controller = module.get<GlobalUsersController>(GlobalUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
