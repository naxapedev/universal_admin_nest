import { Test, TestingModule } from '@nestjs/testing';
import { UniversalAuthService } from './universal-auth.service';

describe('UniversalAuthService', () => {
  let service: UniversalAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UniversalAuthService],
    }).compile();

    service = module.get<UniversalAuthService>(UniversalAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
