import { Test, TestingModule } from '@nestjs/testing';
import { GlobalUsersController } from './global-users.controller';

describe('GlobalUsersController', () => {
  let controller: GlobalUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalUsersController],
    }).compile();

    controller = module.get<GlobalUsersController>(GlobalUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
