import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ResultadoEnvio = {
  enviado: boolean;
  motivo?: 'sin-proveedor' | 'rechazado' | 'red';
};

/**
 * Envío de correo transaccional.
 *
 * Usa la API HTTP de Resend (sin SDK, sin dependencias nuevas). Si no hay
 * `RESEND_API_KEY`, no inventa: devuelve `enviado: false` y lo deja en el log,
 * para que la landing pueda decir la verdad en vez de "te mandamos un mail".
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /** Base pública de la landing, sin barra final. */
  private basePublica(): string {
    const configurada =
      this.config.get<string>('APP_PUBLIC_URL')?.trim() ||
      'https://rodrigoamarilla.tech/postulado';

    return configurada.replace(/\/+$/, '');
  }

  enlaceVerificacion(token: string): string {
    return `${this.basePublica()}/verificar/?token=${encodeURIComponent(token)}`;
  }

  enlaceRecuperacion(token: string): string {
    return `${this.basePublica()}/recuperar/?token=${encodeURIComponent(token)}`;
  }

  async enviarVerificacion(
    destinatario: string,
    nombre: string | null,
    token: string,
  ): Promise<ResultadoEnvio> {
    const enlace = this.enlaceVerificacion(token);
    const saludo = nombre?.trim() ? `Hola, ${nombre.trim()}.` : 'Hola.';

    return this.enviar({
      destinatario,
      asunto: 'Confirmá tu correo en PostulaDo',
      enlace,
      texto: `${saludo}\n\nConfirmá tu correo para poder recuperar tus planes desde cualquier dispositivo:\n\n${enlace}\n\nEl enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.`,
      html: this.plantilla({
        saludo,
        titulo: 'Confirmá tu correo',
        cuerpo:
          'Confirmá tu correo para poder recuperar tus planes desde cualquier dispositivo.',
        boton: 'Confirmar mi correo',
        enlace,
        pie: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.',
      }),
    });
  }

  async enviarRecuperacion(
    destinatario: string,
    nombre: string | null,
    token: string,
  ): Promise<ResultadoEnvio> {
    const enlace = this.enlaceRecuperacion(token);
    const saludo = nombre?.trim() ? `Hola, ${nombre.trim()}.` : 'Hola.';

    return this.enviar({
      destinatario,
      asunto: 'Restablecé tu contraseña de PostulaDo',
      enlace,
      texto: `${saludo}\n\nPediste restablecer la contraseña de tu cuenta:\n\n${enlace}\n\nEl enlace vence en 1 hora y sirve una sola vez. Si no fuiste vos, ignorá este mensaje: tu contraseña actual sigue funcionando.`,
      html: this.plantilla({
        saludo,
        titulo: 'Restablecé tu contraseña',
        cuerpo:
          'Pediste restablecer la contraseña de tu cuenta. Elegí una nueva con el botón de abajo.',
        boton: 'Elegir nueva contraseña',
        enlace,
        pie: 'El enlace vence en 1 hora y sirve una sola vez. Si no fuiste vos, ignorá este mensaje: tu contraseña actual sigue funcionando.',
      }),
    });
  }

  private plantilla(opciones: {
    saludo: string;
    titulo: string;
    cuerpo: string;
    boton: string;
    enlace: string;
    pie: string;
  }): string {
    const { saludo, titulo, cuerpo, boton, enlace, pie } = opciones;

    return `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16181a">
        <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#61656b;margin:0 0 24px">PostulaDo</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 16px">${titulo}</h1>
        <p style="font-size:15px;line-height:1.6;color:#3c4045;margin:0 0 24px">
          ${saludo} ${cuerpo}
        </p>
        <p style="margin:0 0 28px">
          <a href="${enlace}" style="display:inline-block;background:#16181a;color:#f7f5f0;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600">
            ${boton}
          </a>
        </p>
        <p style="font-size:13px;line-height:1.6;color:#61656b;margin:0 0 8px">
          ${pie}
        </p>
        <p style="font-size:12px;line-height:1.6;color:#8c8e92;margin:16px 0 0;word-break:break-all">
          ${enlace}
        </p>
      </div>
    `;
  }

  private async enviar(mensaje: {
    destinatario: string;
    asunto: string;
    enlace: string;
    texto: string;
    html: string;
  }): Promise<ResultadoEnvio> {
    const { destinatario, asunto, enlace, texto, html } = mensaje;
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();

    if (!apiKey) {
      // Sin proveedor el flujo sigue andando; el enlace queda en el log para
      // poder probar en local. Nunca se muestra en la respuesta HTTP.
      this.logger.warn(
        `Sin RESEND_API_KEY: no se envió el correo a ${destinatario}. Enlace: ${enlace}`,
      );
      return { enviado: false, motivo: 'sin-proveedor' };
    }

    const from =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      'PostulaDo <no-reply@rodrigoamarilla.tech>';

    try {
      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [destinatario],
          subject: asunto,
          text: texto,
          html,
        }),
      });

      if (!respuesta.ok) {
        const detalle = (await respuesta.text()).slice(0, 300);
        this.logger.error(
          `Resend rechazó el envío a ${destinatario} (${respuesta.status}): ${detalle}`,
        );
        return { enviado: false, motivo: 'rechazado' };
      }

      return { enviado: true };
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo a ${destinatario}: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
      return { enviado: false, motivo: 'red' };
    }
  }
}
