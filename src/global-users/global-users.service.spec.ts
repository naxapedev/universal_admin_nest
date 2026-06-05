import { Test, TestingModule } from '@nestjs/testing';
import { GlobalUsersService } from './global-users.service';

describe('GlobalUsersService', () => {
  let service: GlobalUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalUsersService],
    }).compile();

    service = module.get<GlobalUsersService>(GlobalUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
