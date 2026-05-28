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
});