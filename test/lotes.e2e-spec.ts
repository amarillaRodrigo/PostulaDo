import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

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

    await prisma.user.update({
      where: { id: registerResponse.body.user.id },
      data: { emailVerifiedAt: new Date() },
    });

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
    // El `ValidationPipe` y los interceptores están en `AppModule`
    // (`APP_PIPE` / `APP_INTERCEPTOR`): los tests usan la misma configuración
    // que producción, sin replicarla a mano.
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

    // Borrar el lote no borra las ofertas. Y no devuelve cuerpo: 204.
    const borrado = await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);
    expect(borrado.text).toBe('');

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
      .expect(422);

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

  /**
   * El contrato del DELETE, verificado por HTTP y no por el service: 204 sin
   * cuerpo cuando borra, y el envelope de error cuando no puede. El 403 y el
   * 404 los tira el service, pero el cuerpo lo arma `ApiExceptionFilter`; este
   * test es el que cruza las dos capas.
   */
  it('el DELETE responde 204 sin cuerpo, y 403/404 con el envelope', async () => {
    const owner = await registerAndLogin(`del-owner-${unique()}@test.com`);
    const other = await registerAndLogin(`del-other-${unique()}@test.com`);

    const oferta = await crearOferta(owner.token, `del-${unique()}`);
    const loteId = (
      await request(app.getHttpServer())
        .post('/lotes')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ ids: [oferta] })
        .expect(201)
    ).body.id as string;

    // Otro usuario: 403 con envelope, no con el body de Nest.
    const ajeno = await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);

    expect(ajeno.body).toMatchObject({
      statusCode: 403,
      code: 'prohibido',
      message: 'No autorizado',
      correlationId: expect.any(String),
    });
    expect(ajeno.body).not.toHaveProperty('error');
    expect(ajeno.headers['x-correlation-id']).toBe(ajeno.body.correlationId);

    // Un lote que no existe: 404 con envelope.
    const inexistente = await request(app.getHttpServer())
      .delete('/lotes/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);

    expect(inexistente.body).toMatchObject({
      statusCode: 404,
      code: 'no_encontrado',
      message: 'Lote no encontrado',
      correlationId: expect.any(String),
    });

    // El dueño borra: 204 y ningún cuerpo. Si viajara `{ borrado, id }`, acá
    // se vería el texto.
    const borrado = await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);
    expect(borrado.text).toBe('');

    // Borrar de nuevo es 404: el lote ya no existe. Fija la idempotencia.
    const otraVez = await request(app.getHttpServer())
      .delete(`/lotes/${loteId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
    expect(otraVez.body).toMatchObject({
      statusCode: 404,
      code: 'no_encontrado',
    });
  });
});
