import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { StripPasswordInterceptor } from '../src/common/interceptors/strip-password.interceptor';

describe('Integracion autenticacion y usuarios', () => {
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

  it('registra, inicia sesion, obtiene su propio usuario y bloquea acceso a otro usuario', async () => {
    const emailA = `user-a-${unique()}@test.com`;
    const emailB = `user-b-${unique()}@test.com`;
    const password = 'Password123!';

    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(emailA, password))
      .expect(201);

    expect(registerA.body).toHaveProperty('access_token');
    expect(registerA.body.user).toMatchObject({
      email: emailA,
      countryCode: 'AR',
    });
    expect(registerA.body.user).not.toHaveProperty('password');

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: emailA,
        password,
      })
      .expect(201);

    expect(loginA.body).toHaveProperty('access_token');
    const tokenA = loginA.body.access_token;
    const userAId = registerA.body.user.id;

    const meA = await request(app.getHttpServer())
      .get(`/usuarios/${userAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(meA.body).toMatchObject({
      id: userAId,
      email: emailA,
    });
    expect(meA.body).not.toHaveProperty('password');

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(emailB, password))
      .expect(201);

    const userBId = registerB.body.user.id;

    await request(app.getHttpServer())
      .get(`/usuarios/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('permite acceso admin a listado y eliminacion de usuarios', async () => {
    const adminEmail = `admin-${unique()}@test.com`;
    const userEmail = `user-${unique()}@test.com`;
    const password = 'Password123!';

    const adminRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(adminEmail, password))
      .expect(201);

    const adminUserId = adminRegister.body.user.id;

    const regularRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(userEmail, password))
      .expect(201);

    const regularUserId = regularRegister.body.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'ADMIN' },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminEmail,
        password,
      })
      .expect(201);

    const adminToken = adminLogin.body.access_token;

    const listResponse = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body.length).toBeGreaterThanOrEqual(2);

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/usuarios/${regularUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteResponse.body).toMatchObject({
      id: regularUserId,
      email: userEmail,
    });

    const deletedUser = await prisma.user.findUnique({
      where: { id: regularUserId },
    });

    expect(deletedUser).toBeNull();
  });

  it('rechaza login con password incorrecta', async () => {
    const email = `bad-login-${unique()}@test.com`;
    const password = 'Password123!';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(email, password))
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'wrong-password',
      })
      .expect(401);

    expect(response.body.message).toBeDefined();
  });

  it('lista las sesiones abiertas y cierra las otras sin cerrar la actual', async () => {
    const email = `sessions-${unique()}@test.com`;
    const password = 'Password123!';

    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(email, password))
      .expect(201);
    const token = register.body.access_token as string;

    // Dos logins más representan otros dispositivos: cada uno pide su
    // propio par de tokens.
    const deviceA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const deviceB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const sinSesionActual = await request(app.getHttpServer())
      .post('/auth/sesiones')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(sinSesionActual.body).toHaveLength(3);
    expect(sinSesionActual.body.every((s: any) => !s.esteDispositivo)).toBe(
      true,
    );

    const conSesionActual = await request(app.getHttpServer())
      .post('/auth/sesiones')
      .set('Authorization', `Bearer ${token}`)
      .send({ refresh_token: register.body.refresh_token })
      .expect(201);
    const propia = conSesionActual.body.filter((s: any) => s.esteDispositivo);
    expect(propia).toHaveLength(1);

    // Sin el token de la sesión a conservar, cerrar "las otras" se niega.
    await request(app.getHttpServer())
      .post('/auth/logout-otros')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    const cerradas = await request(app.getHttpServer())
      .post('/auth/logout-otros')
      .set('Authorization', `Bearer ${token}`)
      .send({ refresh_token: register.body.refresh_token })
      .expect(201);
    expect(cerradas.body).toMatchObject({ cerradas: 2 });

    // La sesión actual sigue viva y el resto quedó cerrado.
    const restantes = await request(app.getHttpServer())
      .post('/auth/sesiones')
      .set('Authorization', `Bearer ${token}`)
      .send({ refresh_token: register.body.refresh_token })
      .expect(201);
    expect(restantes.body).toHaveLength(1);
    expect(restantes.body[0]).toMatchObject({ esteDispositivo: true });

    // Los refresh tokens de los otros dispositivos ya no renuevan.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: deviceA.body.refresh_token })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: deviceB.body.refresh_token })
      .expect(401);
  });

  it('borra la cuenta con contraseña y las cascadas se llevan todo', async () => {
    const email = `delete-me-${unique()}@test.com`;
    const password = 'Password123!';

    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send(createUserPayload(email, password))
      .expect(201);
    const token = register.body.access_token as string;
    const userId = register.body.user.id as string;

    const postulacion = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: `https://example.com/jobs/borrar-${unique()}`,
        title: 'Oferta para borrar',
        description: 'Descripción',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/lotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [postulacion.body.id], nombre: 'Lote a borrar' })
      .expect(201);

    // Contraseña equivocada: la cuenta no se toca.
    await request(app.getHttpServer())
      .post('/auth/borrar-cuenta')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'not-the-password' })
      .expect(400);

    const queda = await request(app.getHttpServer())
      .get('/auth/yo')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(queda.body.id).toBe(userId);

    // Sin contraseña no hay borrado.
    await request(app.getHttpServer())
      .post('/auth/borrar-cuenta')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    // La contraseña correcta borra la cuenta para siempre.
    await request(app.getHttpServer())
      .post('/auth/borrar-cuenta')
      .set('Authorization', `Bearer ${token}`)
      .send({ password })
      .expect(200);

    // La sesión quedó muerta y el login ya no entra.
    await request(app.getHttpServer())
      .get('/auth/yo')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    // Cascadas: no queda rastro de ofertas ni lotes.
    const ofertas = await prisma.postulacion.count({ where: { userId } });
    const lotes = await prisma.lote.count({ where: { userId } });
    expect(ofertas).toBe(0);
    expect(lotes).toBe(0);
  });
});
