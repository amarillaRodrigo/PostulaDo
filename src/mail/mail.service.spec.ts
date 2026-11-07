import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MailService } from './mail.service';

function configCon(valores: Record<string, string | undefined>): ConfigService {
  return {
    get: (clave: string) => valores[clave],
  } as unknown as ConfigService;
}

describe('MailService', () => {
  const token = 'a'.repeat(64);
  let fetchOriginal: typeof fetch;

  beforeEach(() => {
    fetchOriginal = global.fetch;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('arma el enlace contra la landing publicada', () => {
    const mail = new MailService(
      configCon({ APP_PUBLIC_URL: 'https://rodrigoamarilla.tech/postulado/' }),
    );

    expect(mail.enlaceVerificacion(token)).toBe(
      `https://rodrigoamarilla.tech/postulado/verificar/?token=${token}`,
    );
  });

  it('sabe si hay proveedor configurado', () => {
    expect(new MailService(configCon({})).configurado).toBe(false);
    expect(
      new MailService(configCon({ RESEND_API_KEY: 're_test' })).configurado,
    ).toBe(true);
  });

  it('sin proveedor no manda nada y lo informa', async () => {
    const mail = new MailService(configCon({}));
    global.fetch = jest.fn();

    const resultado = await mail.enviarVerificacion('a@b.com', 'A', token);

    expect(resultado).toEqual({ enviado: false, motivo: 'sin-proveedor' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('manda el enlace por Resend cuando hay clave', async () => {
    const mail = new MailService(
      configCon({
        RESEND_API_KEY: 're_test',
        MAIL_FROM: 'PostulaDo <no-reply@rodrigoamarilla.tech>',
        APP_PUBLIC_URL: 'https://rodrigoamarilla.tech/postulado',
      }),
    );
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const resultado = await mail.enviarVerificacion('a@b.com', 'Ana', token);

    expect(resultado).toEqual({ enviado: true });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer re_test');

    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.to).toEqual(['a@b.com']);
    expect(cuerpo.from).toBe('PostulaDo <no-reply@rodrigoamarilla.tech>');
    expect(cuerpo.text).toContain('Ana');
    expect(cuerpo.html).toContain(
      `https://rodrigoamarilla.tech/postulado/verificar/?token=${token}`,
    );
  });

  it('arma el enlace de recuperación contra la landing publicada', () => {
    const mail = new MailService(
      configCon({ APP_PUBLIC_URL: 'https://rodrigoamarilla.tech/postulado/' }),
    );

    expect(mail.enlaceRecuperacion(token)).toBe(
      `https://rodrigoamarilla.tech/postulado/recuperar/?token=${token}`,
    );
  });

  it('manda el enlace de recuperación con el asunto correcto', async () => {
    const mail = new MailService(
      configCon({
        RESEND_API_KEY: 're_test',
        APP_PUBLIC_URL: 'https://rodrigoamarilla.tech/postulado',
      }),
    );
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const resultado = await mail.enviarRecuperacion('a@b.com', null, token);

    expect(resultado).toEqual({ enviado: true });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const cuerpo = JSON.parse(init.body);

    expect(cuerpo.subject).toBe('Restablecé tu contraseña de PostulaDo');
    expect(cuerpo.text).toContain('1 hora');
    expect(cuerpo.html).toContain(
      `https://rodrigoamarilla.tech/postulado/recuperar/?token=${token}`,
    );
  });

  it('sin proveedor no manda el correo de recuperación y lo informa', async () => {
    const mail = new MailService(configCon({}));
    global.fetch = jest.fn();

    const resultado = await mail.enviarRecuperacion('a@b.com', 'Ana', token);

    expect(resultado).toEqual({ enviado: false, motivo: 'sin-proveedor' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('si Resend rechaza, devuelve rechazado y no lanza', async () => {
    const mail = new MailService(configCon({ RESEND_API_KEY: 're_test' }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('domain is not verified'),
    });

    const resultado = await mail.enviarVerificacion('a@b.com', null, token);

    expect(resultado).toEqual({ enviado: false, motivo: 'rechazado' });
  });

  it('si la red falla, devuelve red y no lanza', async () => {
    const mail = new MailService(configCon({ RESEND_API_KEY: 're_test' }));
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    const resultado = await mail.enviarVerificacion('a@b.com', null, token);

    expect(resultado).toEqual({ enviado: false, motivo: 'red' });
  });
});
