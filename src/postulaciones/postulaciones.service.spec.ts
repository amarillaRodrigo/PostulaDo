import { Test, TestingModule } from '@nestjs/testing';
import { PostulacionesService } from './postulaciones.service';
import { PrismaService } from '../prisma.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

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
  user: {
    findUnique: jest.fn(),
  },
};

const mockJobAnalyzer = {
  analyzeJob: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

describe('PostulacionesService', () => {
  let service: PostulacionesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostulacionesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobAnalyzerService, useValue: mockJobAnalyzer },
        { provide: getQueueToken('analisis-trabajo'), useValue: mockQueue },
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
          company: undefined,
          rawRequirements: ['TypeScript', 'NestJS', 'React', 'Docker'],
          tecnologias: ['TypeScript', 'NestJS', 'React', 'Docker'],
          aniosExperiencia: undefined,
          responsabilidades: [],
          tonoEmpresa: undefined,
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

  describe('analyze', () => {
    it('should add a job to the queue and return jobId', async () => {
      const url = 'https://example.com/jobs/1';
      const userId = 'user-uuid';
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        profileText: 'My Profile',
      });
      mockQueue.add.mockResolvedValueOnce({ id: 'job-id' });

      const result = await service.analyze(url, userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'analizar-url',
        { url, userId, profileText: 'My Profile' },
        {
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: { age: 24 * 3600 },
        },
      );
      expect(result).toEqual({ jobId: 'job-id', status: 'queued' });
    });
  });

  describe('getJobStatus', () => {
    const userId = 'user-uuid';
    const jobId = 'job-id';

    it('should throw NotFoundException if job is not found', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if job belongs to another user', async () => {
      const mockJob = {
        data: { userId: 'other-user-uuid' },
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return completed status and result if job is completed', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('completed'),
        returnvalue: { url: 'https://example.com', datosOferta: {} },
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'completed',
        result: mockJob.returnvalue,
      });
    });

    it('should return failed status and error if job failed', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('failed'),
        failedReason: 'SGLang Timeout Error',
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'failed',
        error: 'SGLang Timeout Error',
      });
    });

    it('should return state status for active/waiting jobs', async () => {
      const mockJob = {
        id: jobId,
        data: { userId },
        getState: jest.fn().mockResolvedValueOnce('active'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toEqual({
        jobId,
        status: 'active',
      });
    });
  });
});
