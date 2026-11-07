'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_CONFIGURADA, resetPassword } from '@/lib/api';

type Estado =
  | { kind: 'form' }
  | { kind: 'saving' }
  | { kind: 'ok'; email: string }
  | { kind: 'error'; message: string }
  | { kind: 'sin-token' };

export default function RecuperarPage() {
  const [estado, setEstado] = useState<Estado>({ kind: 'form' });
  const [token, setToken] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const valor = new URLSearchParams(window.location.search).get('token');

    if (!valor) {
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

    setToken(valor);
  }, []);

  async function guardar(password: string, repetida: string) {
    if (!token) return;

    if (password.length < 8) {
      setAviso('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }

    if (password !== repetida) {
      setAviso('Las dos contraseñas no coinciden.');
      return;
    }

    setAviso(null);
    setEstado({ kind: 'saving' });

    try {
      const r = await resetPassword(token, password);
      setEstado({ kind: 'ok', email: r.email });
    } catch (e) {
      setEstado({
        kind: 'error',
        message:
          e instanceof Error
            ? e.message
            : 'No pudimos cambiar tu contraseña. Probá de nuevo.',
      });
    }
  }

  return (
    <main className="verify">
      <div className="verify__card">
        <Link className="verify__mark" href="/">
          PostulaDo
        </Link>

        {estado.kind === 'form' || estado.kind === 'saving' ? (
          <>
            <p className="verify__eyebrow">Nueva contraseña</p>
            <h1>Elegí una contraseña nueva</h1>
            <p className="verify__text">
              El enlace sirve una sola vez. Cuando la guardes, tu contraseña
              anterior deja de funcionar.
            </p>

            <form
              className="verify__form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void guardar(
                  String(form.get('password') ?? ''),
                  String(form.get('repetida') ?? ''),
                );
              }}
            >
              <div className="field">
                <label htmlFor="recuperar-password">Contraseña nueva</label>
                <input
                  id="recuperar-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="mínimo 8 caracteres"
                />
              </div>

              <div className="field">
                <label htmlFor="recuperar-repetida">Repetila</label>
                <input
                  id="recuperar-repetida"
                  name="repetida"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="la misma contraseña"
                />
              </div>

              {aviso ? (
                <p className="verify__error" role="alert">
                  {aviso}
                </p>
              ) : null}

              <button
                className="btn btn--ink btn--caustic"
                type="submit"
                disabled={estado.kind === 'saving'}
              >
                {estado.kind === 'saving'
                  ? 'Guardando…'
                  : 'Guardar y volver a entrar'}
              </button>
            </form>
          </>
        ) : null}

        {estado.kind === 'ok' ? (
          <>
            <p className="verify__eyebrow">Listo</p>
            <h1>Contraseña actualizada</h1>
            <p className="verify__text">
              Ya podés entrar con la contraseña nueva en <b>{estado.email}</b>.
            </p>
            <Link className="btn btn--ink btn--caustic" href="/">
              Volver a PostulaDo
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
              Pedir un enlace nuevo
            </Link>
          </>
        ) : null}

        {estado.kind === 'sin-token' ? (
          <>
            <p className="verify__eyebrow">Falta el enlace</p>
            <h1>Este enlace está incompleto</h1>
            <p className="verify__text">
              Abrí el enlace tal cual llegó en el correo. Si lo perdiste, podés
              pedir otro desde <b>¿Olvidaste tu contraseña?</b> en la landing.
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
