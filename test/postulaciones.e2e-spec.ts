import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EstadoPostulacion } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

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

    // El total de registros que matchean el filtro: es lo que le dice al
    // cliente cuántas páginas hay, sin tener que deducirlo del tamaño.
    expect(listResponse.headers['x-total-count']).toBe('2');

    // La lista es de una sesión: no se cachea.
    expect(listResponse.headers['cache-control']).toBe('private, no-store');

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

    // El total cuenta lo mismo que la página: un registro, no dos.
    expect(filteredResponse.headers['x-total-count']).toBe('1');

    // "isArchived=false" llega como el texto "false": Boolean("false") es
    // true, así que el filtro correcto exige comparar el texto.
    const noArchivadas = await request(app.getHttpServer())
      .get('/postulaciones')
      .query({ isArchived: false })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(noArchivadas.body).toHaveLength(1);
    expect(noArchivadas.body[0]).toMatchObject({
      id: firstPostulacion.body.id,
      isArchived: false,
    });
  });

  it('responde 200 con lista vacía cuando la cuenta no tiene postulaciones', async () => {
    const user = await registerAndLogin(`vacia-${unique()}@test.com`);

    const respuesta = await request(app.getHttpServer())
      .get('/postulaciones')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    // La lista vacía no es un error: es un 200 con array vacío.
    expect(respuesta.body).toEqual([]);
    // Y el total dice 0, explícitamente.
    expect(respuesta.headers['x-total-count']).toBe('0');
    // Sin filas, no hay página siguiente.
    expect(respuesta.headers['x-next-cursor']).toBeUndefined();
  });

  it('rechaza un límite de página por encima del tope', async () => {
    const owner = await registerAndLogin(`limite-${unique()}@test.com`);

    // 422: el pedido se entiende pero su contenido no cumple las reglas.
    await request(app.getHttpServer())
      .get('/postulaciones')
      .query({ limit: 1000 })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);

    await request(app.getHttpServer())
      .get('/postulaciones')
      .query({ page: 0 })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);
  });

  it('pagina con cursor sin duplicar ni saltar ofertas', async () => {
    const owner = await registerAndLogin(`cursor-${unique()}@test.com`);

    const creadas: string[] = [];
    for (const url of ['a', 'b', 'c']) {
      const res = await request(app.getHttpServer())
        .post('/postulaciones')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ url: `https://example.com/jobs/${url}-${unique()}` })
        .expect(201);
      creadas.push(res.body.id);
    }

    // Se recorre con el cursor hasta que el servidor deje de mandar uno.
    const vistas: string[] = [];
    let cursor: string | undefined;
    let paginas = 0;

    for (;;) {
      const res = await request(app.getHttpServer())
        .get('/postulaciones')
        .query({ limit: 1, ...(cursor ? { cursor } : {}) })
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      vistas.push(res.body[0].id);

      cursor = res.headers['x-next-cursor'];
      paginas += 1;

      if (!cursor) break;
      expect(paginas).toBeLessThan(10);
    }

    // Tres ofertas, tres páginas, cada una una vez: ni se duplica ni se
    // saltea ninguna.
    expect(paginas).toBe(3);
    expect(vistas).toHaveLength(3);
    expect(new Set(vistas).size).toBe(3);
    expect([...vistas].sort()).toEqual([...creadas].sort());
  });

  it('rechaza un cursor roto', async () => {
    const owner = await registerAndLogin(`cursor-roto-${unique()}@test.com`);

    await request(app.getHttpServer())
      .get('/postulaciones')
      .query({ cursor: 'no-es-un-cursor' })
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);
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
      .expect(422);

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
      .expect(202);

    expect(response.body).toMatchObject({
      jobId: expect.any(String),
      status: 'queued',
      // El perfil con el que se va a analizar viaja en la respuesta: el
      // resultado depende de él y el cliente tiene que poder decirlo.
      profileText:
        'Desarrollador Full Stack con 3 años de experiencia en TypeScript y NestJS.',
      perfilPorDefecto: false,
      // El intervalo de polling va en el body, no en un `Retry-After`.
      pollAfterMs: 2000,
    });

    // El 202 le dice al cliente dónde preguntar por el resultado.
    expect(response.headers['location']).toBe(
      `/postulaciones/analizar/status/${response.body.jobId}`,
    );

    // Y NO lleva `Retry-After`: ese header significa "reintentá esta request".
    // Un cliente genérico que reintenta lo mismo duplicaría jobs.
    expect(response.headers['retry-after']).toBeUndefined();

    // El jobId es un UUID: opaco, no enumerable.
    expect(response.body.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const jobId = response.body.jobId;

    // Otro usuario no puede ver el trabajo: 403. Los `jobId` son UUID, así
    // que no hay nada que enumerar y el 403 no filtra la existencia de nada.
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

  it('rechaza una URL que no es una URL', async () => {
    const user = await registerAndLogin(`url-invalida-${unique()}@test.com`);

    // 422: el pedido se entiende pero su contenido no cumple las reglas.
    // Es un test de regresión para que nadie baje el 422 a 400.
    await request(app.getHttpServer())
      .post('/postulaciones/analizar')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ url: 'no-es-una-url' })
      .expect(422);

    // Y tampoco encola nada.
    const respuesta = await request(app.getHttpServer())
      .post('/postulaciones/analizar')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ url: 'no-es-una-url' })
      .expect(422);

    expect(respuesta.body).not.toHaveProperty('jobId');
  });

  it('avisa que usó el perfil por defecto cuando el usuario no tiene', async () => {
    const user = await registerAndLogin(`sin-perfil-${unique()}@test.com`);

    const response = await request(app.getHttpServer())
      .post('/postulaciones/analizar')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ url: 'https://example.com/jobs/sin-perfil' })
      .expect(202);

    expect(response.body.perfilPorDefecto).toBe(true);
    expect(response.body.profileText).toBe(
      'Desarrollador de software interesado en nuevas tecnologías.',
    );
  });

  it('no deja que otro usuario consulte el trabajo de otro', async () => {
    const owner = await registerAndLogin(`dueno-${unique()}@test.com`);
    const other = await registerAndLogin(`intruso-${unique()}@test.com`);

    const encolado = await request(app.getHttpServer())
      .post('/postulaciones/analizar')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ url: 'https://example.com/jobs/privada' })
      .expect(202);

    // El trabajo ajeno da 403, no 404: los `jobId` son UUID, así que no hay
    // nada que enumerar y el 403 no filtra la existencia de ningún trabajo.
    await request(app.getHttpServer())
      .get(`/postulaciones/analizar/status/${encolado.body.jobId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(403);

    // El dueño sí lo ve.
    await request(app.getHttpServer())
      .get(`/postulaciones/analizar/status/${encolado.body.jobId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
  });

  it('responde 404 cuando el jobId nunca existió', async () => {
    const user = await registerAndLogin(`inexistente-${unique()}@test.com`);

    await request(app.getHttpServer())
      .get(
        '/postulaciones/analizar/status/9f2c1d84-3b6a-4f1e-9c2b-7a5e0d3f8b11',
      )
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);
  });

  it('responde 404 al consultar un job inexistente sin token', async () => {
    await request(app.getHttpServer())
      .get('/postulaciones/analizar/status/1')
      .expect(404);
  });

  it('analiza un lote con el denominador del lote, no del historial', async () => {
    const owner = await registerAndLogin(`lote-${unique()}@test.com`);

    const crear = async (tecnologias: string[]) => {
      const res = await request(app.getHttpServer())
        .post('/postulaciones')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          url: `https://example.com/jobs/${unique()}`,
          tecnologias: tecnologias,
        })
        .expect(201);
      return res.body.id as string;
    };

    // Esta entra en el lote. Esta otra queda en el historial y NO cuenta.
    const enElLote = await crear(['Docker', 'Kubernetes', 'AWS', 'CI/CD']);
    await crear(['React']);

    const lote = await request(app.getHttpServer())
      .get(`/postulaciones/analisis-lote?ids=${enElLote}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(lote.body.totalOfertasAnalizadas).toBe(1);
    expect(lote.body.ecosistema).toBeTruthy();
    expect(lote.body.temas.length).toBeGreaterThan(0);
    expect(lote.body.temas[0].alternativas.length).toBeGreaterThan(0);
    expect(lote.body.sugerenciaAprendizaje).toEqual(expect.any(String));

    // Frontend solo esta en el historial: si el denominador fuera el
    // historial del usuario, apareceria aqui.
    expect(
      lote.body.temas.some(
        (t: { label: string }) => t.label === 'Frontend y experiencia',
      ),
    ).toBe(false);
  });

  it('no deja que otro usuario lea el lote de otro', async () => {
    const owner = await registerAndLogin(`lote-owner-${unique()}@test.com`);
    const otro = await registerAndLogin(`lote-otro-${unique()}@test.com`);

    const creada = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        url: `https://example.com/jobs/${unique()}`,
        tecnologias: ['Docker', 'AWS'],
      })
      .expect(201);

    const lote = await request(app.getHttpServer())
      .get(`/postulaciones/analisis-lote?ids=${creada.body.id}`)
      .set('Authorization', `Bearer ${otro.token}`)
      .expect(200);

    expect(lote.body.totalOfertasAnalizadas).toBe(0);
    expect(lote.body.temas).toEqual([]);
  });

  it('analiza el corpus completo cuando no se pasan ids', async () => {
    const owner = await registerAndLogin(`corpus-${unique()}@test.com`);

    const crear = async (tecnologias: string[]) => {
      const res = await request(app.getHttpServer())
        .post('/postulaciones')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          url: `https://example.com/jobs/${unique()}`,
          tecnologias,
        })
        .expect(201);
      return res.body.id as string;
    };

    await crear(['Docker', 'Kubernetes', 'AWS', 'CI/CD']);
    const archivada = await crear(['React']);

    // Archivar saca la oferta del corpus: denominador de lo que queda en pie.
    await prisma.postulacion.update({
      where: { id: archivada },
      data: { isArchived: true },
    });

    const corpus = await request(app.getHttpServer())
      .get('/postulaciones/analisis-lote')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(corpus.body.totalOfertasAnalizadas).toBe(1);
    expect(corpus.body.ecosistema).toBeTruthy();
    expect(corpus.body.temas.length).toBeGreaterThan(0);
    expect(
      corpus.body.temas.some(
        (t: { label: string }) => t.label === 'Frontend y experiencia',
      ),
    ).toBe(false);
  });

  it('arma la ruta del lote en orden de estudio, con prerequisitos y fuentes', async () => {
    const owner = await registerAndLogin(`ruta-${unique()}@test.com`);

    const crear = async (tecnologias: string[]) => {
      const res = await request(app.getHttpServer())
        .post('/postulaciones')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          url: `https://example.com/jobs/${unique()}`,
          tecnologias,
        })
        .expect(201);
      return res.body.id as string;
    };

    // Una sola oferta de Cloud Engineering: la ruta completa de su ecosistema.
    const enElLote = await crear(['Docker', 'Kubernetes', 'AWS', 'CI/CD']);

    const ruta = await request(app.getHttpServer())
      .get(`/postulaciones/analisis-ruta?ids=${enElLote}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    // El cierre trae lo implícito: cloud necesita ci y containers, ci
    // necesita testing, y containers/testing/backend salen del mismo hilo.
    const keys = ruta.body.nodos.map((n: { key: string }) => n.key);
    for (const esperado of [
      'backend',
      'testing',
      'containers',
      'ci',
      'cloud',
    ]) {
      expect(keys).toContain(esperado);
    }

    const posicion = new Map(
      ruta.body.nodos.map((n: { key: string }, i: number) => [n.key, i]),
    );
    const p = (k: string) => posicion.get(k) as number;
    expect(p('containers')).toBeLessThan(p('ci'));
    expect(p('ci')).toBeLessThan(p('cloud'));

    // Denominador honesto: nadie pidió testing, así que entra con 0%.
    const testing = ruta.body.nodos.find(
      (n: { key: string }) => n.key === 'testing',
    );
    expect(testing?.presenteEnCorpus).toBe(false);
    expect(testing?.cobertura).toBe(0);

    // cloud sí la pidió: 100% del único denominador.
    const cloud = ruta.body.nodos.find(
      (n: { key: string }) => n.key === 'cloud',
    );
    expect(cloud?.cobertura).toBe(100);
    expect(cloud?.fuentes.length).toBeGreaterThan(0);

    // backend no tiene prerequisitos dentro del grafo: empiezaAca.
    const backend = ruta.body.nodos.find(
      (n: { key: string }) => n.key === 'backend',
    );
    expect(backend?.empiezaAca).toBe(true);
  });

  it('la ruta del corpus completo usa el mismo denominador que el plan', async () => {
    const owner = await registerAndLogin(`ruta-corpus-${unique()}@test.com`);

    const crear = async (tecnologias: string[]) => {
      const res = await request(app.getHttpServer())
        .post('/postulaciones')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          url: `https://example.com/jobs/${unique()}`,
          tecnologias,
        })
        .expect(201);
      return res.body.id as string;
    };

    await crear(['NestJS', 'PostgreSQL']);
    const archivada = await crear(['React']);

    await prisma.postulacion.update({
      where: { id: archivada },
      data: { isArchived: true },
    });

    const ruta = await request(app.getHttpServer())
      .get('/postulaciones/analisis-ruta')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(ruta.body.totalOfertasAnalizadas).toBe(1);
    // React quedó archivado: frontend no entra por el lado implícito ni explícito.
    expect(
      ruta.body.nodos.some((n: { key: string }) => n.key === 'frontend'),
    ).toBe(false);

    // Los pedidos están, más backend como prerequisito del dato.
    const presentes = ruta.body.nodos
      .filter((n: { presenteEnCorpus: boolean }) => n.presenteEnCorpus)
      .map((n: { key: string }) => n.key);
    expect(presentes).toEqual(expect.arrayContaining(['backend', 'data']));

    // cache no lo pidió nadie y no es prerequisito de nada en la ruta: fuera.
    expect(presentes).not.toContain('cache');
  });

  it('la ruta sin ofertas no promete mostrar nada', async () => {
    const owner = await registerAndLogin(`ruta-vacia-${unique()}@test.com`);

    const ruta = await request(app.getHttpServer())
      .get('/postulaciones/analisis-ruta')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(ruta.body.totalOfertasAnalizadas).toBe(0);
    expect(ruta.body.nodos).toEqual([]);
  });

  it('crea una postulación pegando el texto, sin URL', async () => {
    const owner = await registerAndLogin(`texto-${unique()}@test.com`);

    const pegada = await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        title: 'Backend Developer',
        description:
          'Buscamos alguien con experiencia en NestJS, PostgreSQL y Docker para APIs en producción.',
      })
      .expect(201);

    expect(pegada.body.url).toBeNull();
    expect(pegada.body.title).toBe('Backend Developer');
    // El extractor local hace su trabajo con el texto pegado.
    expect(pegada.body.tecnologias).toEqual(
      expect.arrayContaining(['NestJS', 'PostgreSQL', 'Docker']),
    );
  });

  it('rechaza una postulación sin URL ni texto', async () => {
    const owner = await registerAndLogin(`vacia-${unique()}@test.com`);

    await request(app.getHttpServer())
      .post('/postulaciones')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(422);
  });
});
