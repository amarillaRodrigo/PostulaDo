import { ConfigService } from '@nestjs/config';

import { normalizarRedisUrl, redisConnection } from './redis.config';

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('redisConnection', () => {
  it('lee una URL con TLS de un Redis gestionado', () => {
    const connection = redisConnection(
      config({ REDIS_URL: 'rediss://default:s3cr3t@redis-1234.cloud:6380' }),
    );

    expect(connection).toMatchObject({
      host: 'redis-1234.cloud',
      port: 6380,
      username: 'default',
      password: 's3cr3t',
      tls: {},
    });
    expect(connection.maxRetriesPerRequest).toBeNull();
  });

  it('decodifica credenciales con caracteres escapados', () => {
    const connection = redisConnection(
      config({ REDIS_URL: 'rediss://us%40r:p%3Ass@host:6379' }),
    );

    expect(connection.username).toBe('us@r');
    expect(connection.password).toBe('p:ss');
  });

  it('acepta el comando que copia Redis Cloud en vez de la URL', () => {
    const connection = redisConnection(
      config({
        REDIS_URL:
          'redis-cli -u redis://default:s3cr3t@redis-1234.db.redis.io:15509',
      }),
    );

    expect(connection).toMatchObject({
      host: 'redis-1234.db.redis.io',
      port: 15509,
      username: 'default',
      password: 's3cr3t',
    });
  });

  it('acepta la URL entre comillas o con el nombre de la variable', () => {
    expect(normalizarRedisUrl('"redis://default:s3cr3t@host:6379"')).toBe(
      'redis://default:s3cr3t@host:6379',
    );
    expect(
      normalizarRedisUrl('REDIS_URL=redis://default:s3cr3t@host:6379'),
    ).toBe('redis://default:s3cr3t@host:6379');
  });

  it('explica el error sin filtrar la contraseña', () => {
    expect(() =>
      redisConnection(config({ REDIS_URL: 'redis-cli -u no-es-una-url' })),
    ).toThrow(/REDIS_URL/);

    try {
      redisConnection(config({ REDIS_URL: 'redis-cli -u no-es-una-url' }));
    } catch (error) {
      expect((error as Error).message).not.toContain('no-es-una-url');
    }
  });

  it('rechaza un esquema que no sea redis:', () => {
    expect(() =>
      redisConnection(config({ REDIS_URL: 'http://host:6379' })),
    ).toThrow(/redis:\/\//);
  });

  it('usa host y puerto cuando no hay URL', () => {
    const connection = redisConnection(
      config({ REDIS_HOST: '127.0.0.1', REDIS_PORT: '6380' }),
    );

    expect(connection).toMatchObject({ host: '127.0.0.1', port: 6380 });
    expect(connection.tls).toBeUndefined();
  });

  it('cae a localhost:6379 sin configuración', () => {
    const connection = redisConnection(config({}));

    expect(connection).toMatchObject({ host: 'localhost', port: 6379 });
  });
});
