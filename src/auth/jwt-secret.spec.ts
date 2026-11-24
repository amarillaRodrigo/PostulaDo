import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-secret';

describe('getJwtSecret', () => {
  it('accepts a configured secret of sufficient length', () => {
    const config = { get: () => 's'.repeat(32) } as unknown as ConfigService;
    expect(getJwtSecret(config)).toBe('s'.repeat(32));
  });

  it.each([undefined, '', 'short-secret'])('fails closed for %p', (secret) => {
    const config = { get: () => secret } as unknown as ConfigService;
    expect(() => getJwtSecret(config)).toThrow(/JWT_SECRET must be configured/);
  });
});
