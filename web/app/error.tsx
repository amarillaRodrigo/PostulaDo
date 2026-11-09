'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * La frontera de error de la app.
 *
 * Sin este archivo, una excepcion durante el render desmontaba el arbol
 * entero y la persona veia una pagina en blanco. Aca se explica que paso y se
 * ofrecen las dos salidas utiles: reintentar el segmento o volver al plan.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en la consola para diagnosticar; la persona ve el mensaje util.
    console.error(error);
  }, [error]);

  return (
    <main className="fallo">
      <div className="fallo__caja">
        <p className="fallo__marca">PostulaDo</p>
        <h1 className="fallo__titulo">Se rompió algo en esta pantalla</h1>
        <p className="fallo__texto">
          Lo que estabas haciendo no llegó a completarse. Tus ofertas y tus
          lotes siguen guardados en tu cuenta: podés probar de nuevo o volver al
          plan y seguir desde ahí.
        </p>
        <div className="fallo__acciones">
          <button type="button" className="btn btn--ink" onClick={reset}>
            Probar de nuevo
          </button>
          <Link className="btn btn--ghost" href="/">
            Volver al plan
          </Link>
        </div>
        {error.digest ? (
          <p className="fallo__pie">Referencia del error: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
