'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * La red de ultimo recurso: si falla el propio layout raiz, `error.tsx` ya no
 * alcanza porque vive dentro de ese layout. Este archivo reemplaza el arbol
 * entero, asi que trae sus propios `<html>` y `<body>`.
 *
 * Los estilos van inline a proposito: si el layout raiz fallo, no conviene
 * depender de que su hoja de estilos haya cargado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px 20px',
          background: '#f5f3ee',
          color: '#16181a',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main
          style={{
            width: 'min(560px, 100%)',
            padding: 32,
            background: '#ffffff',
            border: '1px solid rgba(22, 24, 26, 0.1)',
            borderRadius: 14,
            boxShadow: '0 1px 2px rgba(22, 24, 26, 0.04), 0 8px 24px rgba(22, 24, 26, 0.06)',
          }}
        >
          <p
            style={{
              margin: '0 0 18px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#d9542b',
            }}
          >
            PostulaDo
          </p>
          <h1 style={{ margin: '0 0 12px', fontSize: 26, lineHeight: 1.2 }}>
            La app no pudo arrancar
          </h1>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: 15,
              lineHeight: 1.6,
              color: '#4d5155',
            }}
          >
            Algo falló antes de que la pantalla terminara de armarse. Tus
            ofertas y tus lotes siguen guardados en tu cuenta: probá de nuevo o
            volvé al plan.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: '1px solid transparent',
                borderRadius: 10,
                padding: '10px 18px',
                font: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                background: '#16181a',
                color: '#f5f3ee',
              }}
            >
              Probar de nuevo
            </button>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid rgba(22, 24, 26, 0.1)',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                color: '#16181a',
              }}
            >
              Volver al plan
            </Link>
          </div>
          {error.digest ? (
            <p
              style={{
                margin: '24px 0 0',
                fontSize: 12,
                color: '#8c8e92',
              }}
            >
              Referencia del error: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
