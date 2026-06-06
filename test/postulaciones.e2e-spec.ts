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
});
