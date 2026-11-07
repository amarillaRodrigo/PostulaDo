import { ConfigService } from '@nestjs/config';

import { redisConnection } from './redis.config';

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
