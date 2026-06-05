import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'id', ...args.data })),
    update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
    delete: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id })),
  },
};

describe('UsuariosService', () => {
  let service: UsuariosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
