import { ConfigService } from '@nestjs/config';

export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  /** BullMQ usa comandos bloqueantes: ioredis no debe cortar por reintentos. */
  maxRetriesPerRequest: null;
}

/**
 * Redis por URL o por host/puerto.
 *
 * Los proveedores gestionados (Redis Cloud, Upstash) entregan una sola URL,
 * muchas veces con TLS (`rediss://`). Docker local sigue usando host/puerto.
 */
export function redisConnection(config: ConfigService): RedisConnection {
  const url = config.get<string>('REDIS_URL')?.trim();

  if (url) {
    const parsed = new URL(url);
    const usaTls = parsed.protocol === 'rediss:';

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      ...(usaTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  }

  return {
    host: config.get<string>('REDIS_HOST') || 'localhost',
    port: Number.parseInt(config.get<string>('REDIS_PORT') || '6379', 10),
    maxRetriesPerRequest: null,
  };
}
