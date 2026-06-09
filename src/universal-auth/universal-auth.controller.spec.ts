import { Test, TestingModule } from '@nestjs/testing';
import { UniversalAuthController } from './universal-auth.controller';

describe('UniversalAuthController', () => {
  let controller: UniversalAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UniversalAuthController],
    }).compile();

    controller = module.get<UniversalAuthController>(UniversalAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
