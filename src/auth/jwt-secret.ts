import { ConfigService } from '@nestjs/config';

const MIN_JWT_SECRET_LENGTH = 32;

/** Fail closed: never let the application sign tokens with a public fallback. */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim();

  if (!secret || Buffer.byteLength(secret, 'utf8') < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be configured with at least ${MIN_JWT_SECRET_LENGTH} characters.`,
    );
  }

  return secret;
}
