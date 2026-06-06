import { Test, TestingModule } from '@nestjs/testing';
import { PostulacionesService } from './postulaciones.service';
import { PrismaService } from '../prisma.service';

const mockPrisma = {
  postulacion: {
    create: jest
      .fn()
      .mockImplementation((args) =>
        Promise.resolve({ id: 'postulacion-id', ...args.data }),
      ),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('PostulacionesService', () => {
  let service: PostulacionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostulacionesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PostulacionesService>(PostulacionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should extract technologies and create a new application', async () => {
      const dto = {
        url: 'https://example.com/jobs/1',
        title: 'Full Stack NestJS Developer',
        description:
          'We need a programmer with React, TypeScript, and Docker skills.',
      };
      const userId = 'user-uuid';

      await service.create(dto, userId);

      expect(mockPrisma.postulacion.create).toHaveBeenCalledWith({
        data: {
          url: dto.url,
          title: dto.title,
          description: dto.description,
          rawRequirements: ['TypeScript', 'NestJS', 'React', 'Docker'],
          user: { connect: { id: userId } },
        },
      });
    });
  });

  describe('getLearningAnalysis', () => {
    it('should return learning suggestions based on applications', async () => {
      const userId = 'user-uuid';
      mockPrisma.postulacion.findMany.mockResolvedValueOnce([
        { rawRequirements: ['React', 'NestJS'] },
        { rawRequirements: ['React', 'Docker'] },
        { rawRequirements: ['React', 'NestJS'] },
      ]);

      const result = await service.getLearningAnalysis(userId);

      expect(result.totalApplicationsAnalizadas).toBe(3);
      expect(result.tecnologiasMasDemandadas[0]).toEqual({
        name: 'React',
        count: 3,
        percentage: 100,
      });
      expect(result.sugerenciaAprendizaje).toContain('React');
    });
  });
});
