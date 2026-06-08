import { Test, TestingModule } from '@nestjs/testing';
import { JobAnalyzerService } from './job-analyzer.service';
import axios from 'axios';

// Mock del cliente OpenAI a nivel de módulo
const mockCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: mockCompletionsCreate,
        },
      },
    };
  });
});

describe('JobAnalyzerService', () => {
  let service: JobAnalyzerService;
  let originalEnvNodeEnv: string | undefined;

  beforeAll(() => {
    originalEnvNodeEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnvNodeEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobAnalyzerService],
    }).compile();

    service = module.get<JobAnalyzerService>(JobAnalyzerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrapeUrl', () => {
    it('debería limpiar el HTML y extraer solo el texto legible de la oferta', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>body { font-family: sans-serif; }</style>
            <script>console.log("no deberia aparecer");</script>
          </head>
          <body>
            <header>
              <nav><a href="/home">Home</a></nav>
            </header>
            <main>
              <h1>Software Developer</h1>
              <p>Buscamos desarrollador experto en <strong>Node.js</strong> y <strong>React</strong>.</p>
              <svg>icon</svg>
              <iframe>publicidad_anuncio</iframe>
            </main>
            <footer>
              <p>Copyright 2026</p>
            </footer>
          </body>
        </html>
      `;

      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockHtml });

      const result = await service.scrapeUrl('https://example.com/job/1');

      // Verificamos que se removieron las etiquetas de script, style, nav, footer, etc.
      expect(result).not.toContain('console.log');
      expect(result).not.toContain('sans-serif');
      expect(result).not.toContain('Home');
      expect(result).not.toContain('Copyright');
      expect(result).not.toContain('publicidad_anuncio');
      // Debe contener la información del main
      expect(result).toContain('Software Developer');
      expect(result).toContain(
        'Buscamos desarrollador experto en Node.js y React.',
      );
    });

    it('debería lanzar un InternalServerErrorException si la petición HTTP falla', async () => {
      jest
        .spyOn(axios, 'get')
        .mockRejectedValueOnce(new Error('Conexión fallida'));

      await expect(
        service.scrapeUrl('https://example.com/job/1'),
      ).rejects.toThrow('Error al obtener o parsear la URL: Conexión fallida');
    });
  });

  describe('analyzeJob', () => {
    it('debería retornar el mock de desarrollo inmediatamente si NODE_ENV es test', async () => {
      // Configuramos el entorno como test
      process.env.NODE_ENV = 'test';
      const spyScrape = jest.spyOn(service, 'scrapeUrl');

      const result = await service.analyzeJob(
        'https://example.com/job/1',
        'Mi perfil profesional',
      );

      expect(spyScrape).not.toHaveBeenCalled();
      expect(result).toHaveProperty('datosOferta');
      expect(result.datosOferta.tecnologias).toEqual(
        expect.arrayContaining(['React', 'NestJS', 'Docker', 'PostgreSQL']),
      );
      expect(result.datosOferta.aniosExperiencia).toBe(3);
    });

    it('debería ejecutar la llamada real a SGLang y retornar los resultados en formato JSON estructurado', async () => {
      // Simulamos que estamos en producción/desarrollo sin mocks por defecto
      process.env.NODE_ENV = 'production';
      process.env.MOCK_SGLANG = 'false';

      // Mock de scraping
      const scrapeSpy = jest
        .spyOn(service, 'scrapeUrl')
        .mockResolvedValueOnce('Texto de la vacante');

      // Mock de las respuestas de SGLang (OpenAI API)
      // 1. Respuesta estructurada
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                tecnologias: ['Java', 'Spring Boot', 'Kubernetes'],
                aniosExperiencia: 5,
                responsabilidades: [
                  'Diseñar microservicios',
                  'Gestionar despliegues',
                ],
                tonoEmpresa: 'Formal y estructurado',
              }),
            },
          },
        ],
      });

      // 2, 3, 4. Respuestas para análisis, cover letter y cv
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Enfoques sugeridos...' } }],
      });
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Estimado reclutador...' } }],
      });
      mockCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'CV Optimizado...' } }],
      });

      const result = await service.analyzeJob(
        'https://example.com/job/real',
        'Mi perfil Java',
      );

      // Verificamos que se ejecutó el scrape
      expect(scrapeSpy).toHaveBeenCalledWith('https://example.com/job/real');

      // Verificamos que SGLang recibió las llamadas y estructuró bien
      expect(result.datosOferta).toEqual({
        tecnologias: ['Java', 'Spring Boot', 'Kubernetes'],
        aniosExperiencia: 5,
        responsabilidades: ['Diseñar microservicios', 'Gestionar despliegues'],
        tonoEmpresa: 'Formal y estructurado',
      });
      expect(result.analisis).toBe('Enfoques sugeridos...');
      expect(result.coverLetter).toBe('Estimado reclutador...');
      expect(result.cvOptimizado).toBe('CV Optimizado...');
    });

    it('debería recuperarse con fallback graceful si SGLang lanza un error de red o timeout', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MOCK_SGLANG = 'false';

      jest
        .spyOn(service, 'scrapeUrl')
        .mockResolvedValueOnce('Texto de la vacante');

      // Simulamos fallo en SGLang
      mockCompletionsCreate.mockRejectedValueOnce(new Error('SGLang Timeout'));

      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const result = await service.analyzeJob(
        'https://example.com/job/error',
        'Mi perfil',
      );

      // Debe haber advertido en consola del fallo
      expect(consoleWarnSpy).toHaveBeenCalled();
      // Debe haber retornado el mock de resiliencia
      expect(result).toHaveProperty('datosOferta');
      expect(result.datosOferta.tecnologias).toEqual(
        expect.arrayContaining(['React', 'NestJS', 'Docker', 'PostgreSQL']),
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
