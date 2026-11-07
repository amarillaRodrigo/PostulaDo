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
 * Deja la URL en la forma que espera `new URL`.
 *
 * Redis Cloud muestra el endpoint como comando (`redis-cli -u redis://...`)
 * y es facil pegarlo entero en la variable de entorno. Si eso llega tal cual,
 * el contenedor muere al arrancar con `TypeError: Invalid URL`, un error que
 * no dice nada sobre la variable culpable.
 */
export function normalizarRedisUrl(raw: string): string {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/^REDIS_URL\s*=\s*/i, '').trim();
  value = value.replace(/^redis-cli(?:\.exe)?\s+(?:-u|--uri)\s+/i, '').trim();

  return value;
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
    let parsed: URL;

    try {
      parsed = new URL(normalizarRedisUrl(url));
    } catch {
      // Sin la URL cruda a proposito: lleva la contraseña.
      throw new Error(
        'REDIS_URL no es una URL valida. Se espera redis://usuario:clave@host:puerto (o rediss:// si el proveedor usa TLS).',
      );
    }

    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      throw new Error(
        `REDIS_URL debe empezar con redis:// o rediss:// (recibido "${parsed.protocol}//").`,
      );
    }

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
