import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from '../src/common/interceptors/strip-password.interceptor';

jest.setTimeout(30000);

describe('Integracion lotes', () => {
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

  const crearOferta = async (
    token: string,
    suffix: string,
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${token}`)
      .send(createPostulacionPayload(suffix))
      .expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalInterceptors(new StripPasswordInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('renombra y borra los lotes propios, sin tocar las ofertas', async () => {
    const owner = await registerAndLogin(`owner-${unique()}@test.com`);
    const other = await registerAndLogin(`other-${unique()}@test.com`);

    const oferta = await crearOferta(owner.token, `one-${unique()}`);

    const crear = await request(app.getHttpServer())
      .post('/lotes')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ids: [oferta] })
      .expect(201);

    const loteId = crear.body.id as string;

    // Otro usuario no puede ni renombrar ni borrar.
    await request(app.getHttpServer())
      .put(`/lotes/${loteId}/nombre`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ nombre: 'Mío ahora' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);

    const renombrado = await request(app.getHttpServer())
      .put(`/lotes/${loteId}/nombre`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ nombre: '  Backend  ' })
      .expect(200);

    expect(renombrado.body).toMatchObject({ id: loteId, nombre: 'Backend' });

    // Un nombre de puro espacios vuelve a "Lote sin nombre".
    const sinNombre = await request(app.getHttpServer())
      .put(`/lotes/${loteId}/nombre`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ nombre: '   ' })
      .expect(200);
    expect(sinNombre.body.nombre).toBeNull();

    // Borrar el lote no borra las ofertas.
    const borrado = await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(borrado.body).toMatchObject({ borrado: true, id: loteId });

    await request(app.getHttpServer())
      .get(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200)
      .expect((res) => expect(res.body).toHaveLength(1));
  });

  it('agrega ofertas propias a un lote guardado y rechaza las ajenas', async () => {
    const owner = await registerAndLogin(`add-${unique()}@test.com`);
    const other = await registerAndLogin(`other-${unique()}@test.com`);

    const primera = await crearOferta(owner.token, `p-${unique()}`);
    const segunda = await crearOferta(owner.token, `s-${unique()}`);
    const ajena = await crearOferta(other.token, `a-${unique()}`);

    const loteId = (
      await request(app.getHttpServer())
        .post('/lotes')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ ids: [primera] })
        .expect(201)
    ).body.id as string;

    await request(app.getHttpServer())
      .post(`/lotes/${loteId}/ofertas`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ids: [ajena] })
      .expect(400);

    const ampliada = await request(app.getHttpServer())
      .post(`/lotes/${loteId}/ofertas`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ ids: [segunda, primera] })
      .expect(201);

    // Sin duplicar la que ya estaba.
    expect(ampliada.body.ids).toEqual([primera, segunda]);

    // El plan del lote crece con el denominador completo.
    const plan = await request(app.getHttpServer())
      .get(`/postulaciones/analisis-lote?ids=${[primera, segunda].join(',')}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(plan.body.totalOfertasAnalizadas).toBe(2);
  });
});
