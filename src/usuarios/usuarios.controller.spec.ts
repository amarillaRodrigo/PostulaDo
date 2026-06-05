import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

const mockUsuariosService = {
  user: jest.fn().mockResolvedValue(null),
  users: jest.fn().mockResolvedValue([]),
  createUser: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'id', ...dto })),
  updateUser: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
  deleteUser: jest.fn().mockImplementation(({ id }) => Promise.resolve({ id })),
};

describe('UsuariosController', () => {
  let controller: UsuariosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [{ provide: UsuariosService, useValue: mockUsuariosService }],
    }).compile();

    controller = module.get<UsuariosController>(UsuariosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
