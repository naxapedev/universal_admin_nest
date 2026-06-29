import { Test, TestingModule } from '@nestjs/testing';
import { GlobalUsersService } from './global-users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GlobalUsersService', () => {
  let service: GlobalUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalUsersService, { provide: PrismaService, useValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }],
    }).compile();

    service = module.get<GlobalUsersService>(GlobalUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
