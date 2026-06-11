import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoPostulacion } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from '../src/common/interceptors/strip-password.interceptor';

jest.setTimeout(30000);

describe('Integracion postulaciones', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const createUserPayload = (email: string, password: string) => ({
    email,
    password,
    birthDate: '1990-01-01',
    name: 'Usuario Integracion',
    countryCode: 'AR',
  });

  const createPostulacionPayload = (suffix: string) => ({
    url: `https://example.com/jobs/${suffix}`,
    title: `Postulación ${suffix}`,
    description: `Descripción ${suffix}`,
  });

  const registerAndLogin = async (email: string, password = 'Password123!') => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(email, password))
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    return {
      user: registerResponse.body.user,
      token: loginResponse.body.access_token as string,
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new StripPasswordInterceptor(),
    );

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.postulacion.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea, lista y filtra postulaciones propias', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);
    const other = await registerAndLogin(`other-${unique()}@test.com`);

    const firstPostulacion = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(createPostulacionPayload(`one-${unique()}`))
      .expect(201);

    expect(firstPostulacion.body).toMatchObject({
      userId: owner.user.id,
      status: EstadoPostulacion.ENVIADO,
      isArchived: false,
    });

    const secondPostulacion = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(createPostulacionPayload(`two-${unique()}`))
      .expect(201);

    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${other.token}`)
      .send(createPostulacionPayload(`other-${unique()}`))
      .expect(201);

    await prisma.postulacion.update({
      where: { id: secondPostulacion.body.id },
      data: {
        status: EstadoPostulacion.ENTREVISTA,
        isArchived: true,
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body).toHaveLength(2);
    expect(
      listResponse.body.every(
        (postulacion: any) => postulacion.userId === owner.user.id,
      ),
    ).toBe(true);

    const filteredResponse = await request(app.getHttpServer())
      .get('/postulaciones')
      .query({
        status: EstadoPostulacion.ENTREVISTA,
        isArchived: true,
      })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(filteredResponse.body).toHaveLength(1);
    expect(filteredResponse.body[0]).toMatchObject({
      id: secondPostulacion.body.id,
      status: EstadoPostulacion.ENTREVISTA,
      isArchived: true,
      userId: owner.user.id,
    });
  });

  it('permite leer y actualizar solo las postulaciones propias', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);
    const other = await registerAndLogin(`other-${unique()}@test.com`);

    const ownerPostulacion = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(createPostulacionPayload(`owner-${unique()}`))
      .expect(201);

    const otherPostulacion = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${other.token}`)
      .send(createPostulacionPayload(`other-${unique()}`))
      .expect(201);

    const getOwnerResponse = await request(app.getHttpServer())
      .get(`/postulaciones/${ownerPostulacion.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(getOwnerResponse.body).toMatchObject({
      id: ownerPostulacion.body.id,
      userId: owner.user.id,
      url: ownerPostulacion.body.url,
    });

    await request(app.getHttpServer())
      .get(`/postulaciones/${otherPostulacion.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);

    const updateResponse = await request(app.getHttpServer())
      .put(`/postulaciones/${ownerPostulacion.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        title: 'Nueva postulación',
        description: 'Descripción actualizada',
        status: EstadoPostulacion.OFERTA,
        isArchived: true,
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      id: ownerPostulacion.body.id,
      title: 'Nueva postulación',
      description: 'Descripción actualizada',
      status: EstadoPostulacion.OFERTA,
      isArchived: true,
      userId: owner.user.id,
    });

    await request(app.getHttpServer())
      .put(`/postulaciones/${otherPostulacion.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        title: 'No debería aplicar',
      })
      .expect(403);
  });

  it('rechaza payload inválido al crear una postulación', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);

    const response = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'no-es-una-url',
      })
      .expect(400);

    expect(response.body.message).toBeDefined();
  });

  it('extrae tecnologías automáticamente al crear una postulación', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);

    const response = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/extract',
        title: 'Full Stack Developer',
        description:
          'Buscamos desarrollador con conocimientos en React, NestJS, Docker y PostgreSQL.',
      })
      .expect(201);

    expect(response.body.rawRequirements).toBeDefined();
    expect(response.body.rawRequirements).toEqual(
      expect.arrayContaining(['React', 'NestJS', 'Docker', 'PostgreSQL']),
    );
  });

  it('realiza el análisis de aprendizaje correctamente', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);

    // Crear 3 postulaciones activas con distintas tecnologías
    // React (3/3 = 100%), NestJS (2/3 = 67%), Docker (1/3 = 33%)
    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/a',
        title: 'Dev A',
        description: 'React y NestJS',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/b',
        title: 'Dev B',
        description: 'React y NestJS y Docker',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/c',
        title: 'Dev C',
        description: 'React',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/postulaciones/analisis-aprendizaje')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      totalApplicationsAnalizadas: 3,
    });

    expect(response.body.tecnologiasMasDemandadas).toEqual(
      expect.arrayContaining([
        { name: 'React', count: 3, percentage: 100 },
        { name: 'NestJS', count: 2, percentage: 67 },
        { name: 'Docker', count: 1, percentage: 33 },
      ]),
    );

    expect(response.body.sugerenciaAprendizaje).toContain('React');
    expect(response.body.sugerenciaAprendizaje).toContain('NestJS');
  });

  it('excluye postulaciones archivadas del análisis de aprendizaje', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);

    // Postulación activa: React y NestJS
    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/active',
        title: 'Active Dev',
        description: 'React y NestJS',
      })
      .expect(201);

    // Postulación archivada: Python y Django
    const archPost = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: 'https://example.com/jobs/archived',
        title: 'Archived Dev',
        description: 'Python y Django',
      })
      .expect(201);

    // Archivarla
    await prisma.postulacion.update({
      where: { id: archPost.body.id },
      data: { isArchived: true },
    });

    const response = await request(app.getHttpServer())
      .get('/postulaciones/analisis-aprendizaje')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body.totalApplicationsAnalizadas).toBe(1);
    expect(
      response.body.tecnologiasMasDemandadas.some(
        (t: any) => t.name === 'Python',
      ),
    ).toBe(false);
  });

  it('retorna estructura vacía/sugerencia inicial si no hay postulaciones', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);

    const response = await request(app.getHttpServer())
      .get('/postulaciones/analisis-aprendizaje')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(response.body).toEqual({
      totalApplicationsAnalizadas: 0,
      tecnologiasMasDemandadas: [],
      sugerenciaAprendizaje:
        'Aún no tienes postulaciones guardadas para analizar. Registra tus ofertas para ver recomendaciones de aprendizaje.',
    });
  });

  it('rechaza el acceso no autorizado a analisis-aprendizaje', async () => {
    await request(app.getHttpServer())
      .get('/postulaciones/analisis-aprendizaje')
      .expect(401);
  });

  it('analiza una oferta de trabajo y devuelve el reporte estructurado de SGLang de forma asíncrona', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);
    const other = await registerAndLogin(`other-${unique()}@test.com`);

    // Actualizamos el profileText del usuario para la personalización de la IA
    await prisma.user.update({
      where: { id: owner.user.id },
      data: {
        profileText:
          'Desarrollador Full Stack con 3 años de experiencia en TypeScript y NestJS.',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/postulaciones/analizar')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ url: 'https://example.com/jobs/nestjs-dev' })
      .expect(201);

    expect(response.body).toMatchObject({
      jobId: expect.any(String),
      status: 'queued',
    });

    const jobId = response.body.jobId;

    // Verificar que otro usuario no puede acceder al estado del trabajo
    await request(app.getHttpServer())
      .get(`/postulaciones/analizar/status/${jobId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);

    // Esperar a que el trabajo sea procesado en segundo plano
    let jobStatus: any;
    const maxAttempts = 15;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await request(app.getHttpServer())
        .get(`/postulaciones/analizar/status/${jobId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      jobStatus = statusRes.body;
      if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(jobStatus.status).toBe('completed');
    expect(jobStatus.result).toMatchObject({
      url: 'https://example.com/jobs/nestjs-dev',
      datosOferta: {
        tecnologias: expect.arrayContaining([
          'React',
          'NestJS',
          'Docker',
          'PostgreSQL',
        ]),
        aniosExperiencia: 3,
        responsabilidades: expect.any(Array),
        tonoEmpresa: expect.any(String),
      },
      analisis: expect.any(String),
      coverLetter: expect.any(String),
      cvOptimizado: expect.any(String),
    });
  });
});
