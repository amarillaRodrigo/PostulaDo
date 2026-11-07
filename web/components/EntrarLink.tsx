'use client';

import { useCallback } from 'react';

/**
 * "Entrar" del header.
 *
 * La página es un Server Component y el formulario vive en un componente
 * cliente, así que este botón no puede cambiar su estado directamente: avisa
 * con un evento y `LoteForm` decide qué hacer. Si todavía no hay sesión, pide
 * el correo y la contraseña; si ya hay una, abre el último plan guardado.
 */
export function EntrarLink({ className }: { className?: string }) {
  const entrar = useCallback(() => {
    window.dispatchEvent(new CustomEvent('postulado:entrar'));

    // En móvil el menú queda abierto tapando el formulario: se cierra antes de
    // desplazarse.
    const menu = document.querySelector<HTMLDetailsElement>('.nav__menu');
    if (menu) menu.open = false;

    document
      .getElementById('lote')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <button
      type="button"
      className={className ?? 'nav__entrar'}
      onClick={entrar}
    >
      Entrar
    </button>
  );
}
