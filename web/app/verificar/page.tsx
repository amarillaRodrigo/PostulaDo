'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_CONFIGURADA, verificarEmail } from '@/lib/api';

type Estado =
  | { kind: 'checking' }
  | { kind: 'ok'; email: string; yaEstaba: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'sin-token' };

export default function VerificarPage() {
  const [estado, setEstado] = useState<Estado>({ kind: 'checking' });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setEstado({ kind: 'sin-token' });
      return;
    }

    if (!API_CONFIGURADA) {
      setEstado({
        kind: 'error',
        message: 'La API no está conectada en esta demo.',
      });
      return;
    }

    let vigente = true;

    void verificarEmail(token)
      .then((r) => {
        if (!vigente) return;
        setEstado({ kind: 'ok', email: r.email, yaEstaba: r.yaEstaba });
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setEstado({
          kind: 'error',
          message:
            e instanceof Error
              ? e.message
              : 'No pudimos confirmar tu correo.',
        });
      });

    return () => {
      vigente = false;
    };
  }, []);

  return (
    <main className="verify">
      <div className="verify__card">
        <Link className="verify__mark" href="/">
          PostulaDo
        </Link>

        {estado.kind === 'checking' ? (
          <>
            <p className="verify__eyebrow">Confirmando</p>
            <h1>Un segundo…</h1>
            <p className="verify__text">
              Estamos validando el enlace de tu correo.
            </p>
          </>
        ) : null}

        {estado.kind === 'ok' ? (
          <>
            <p className="verify__eyebrow">Listo</p>
            <h1>
              {estado.yaEstaba
                ? 'Ese correo ya estaba confirmado'
                : 'Correo confirmado'}
            </h1>
            <p className="verify__text">
              <b>{estado.email}</b> quedó verificado. Desde ahora podés abrir
              tus planes desde cualquier dispositivo.
            </p>
            <Link className="btn btn--ink btn--caustic" href="/">
              Volver a mi plan
            </Link>
          </>
        ) : null}

        {estado.kind === 'error' ? (
          <>
            <p className="verify__eyebrow">No pudimos</p>
            <h1>El enlace no funcionó</h1>
            <p className="verify__text" role="alert">
              {estado.message}
            </p>
            <Link className="btn btn--ink" href="/">
              Volver e intentar de nuevo
            </Link>
          </>
        ) : null}

        {estado.kind === 'sin-token' ? (
          <>
            <p className="verify__eyebrow">Falta el enlace</p>
            <h1>Este enlace está incompleto</h1>
            <p className="verify__text">
              Abrí el enlace tal cual llegó en el correo. Si lo perdiste, podés
              pedir otro desde <b>Mi cuenta</b>.
            </p>
            <Link className="btn btn--ink" href="/">
              Ir a PostulaDo
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}
