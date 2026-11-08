'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cerrarTodasLasSesiones,
  listarLotes,
  miPerfil,
  reenviarVerificacion,
  type LoteGuardado,
  type SesionGuardada,
} from '@/lib/api';

type Aviso =
  | { tipo: 'ok'; texto: string }
  | { tipo: 'espera'; texto: string }
  | { tipo: 'error'; texto: string }
  | null;

function fecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CuentaPanel({
  sesion,
  onAbrir,
  onSalir,
  onVerificado,
}: {
  sesion: SesionGuardada;
  onAbrir: (lote: LoteGuardado) => void;
  onSalir: () => void;
  onVerificado: () => void;
}) {
  const [lotes, setLotes] = useState<LoteGuardado[] | null>(null);
  const [verificado, setVerificado] = useState(sesion.emailVerificado);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoTodo, setConfirmandoTodo] = useState(false);
  const [cerrandoTodo, setCerrandoTodo] = useState(false);

  // Los callbacks del padre cambian de identidad en cada render. Se guardan en
  // refs para que el efecto de abajo corra una sola vez y no pida en loop.
  const onVerificadoRef = useRef(onVerificado);
  const confirmadoRef = useRef(sesion.emailVerificado);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    onVerificadoRef.current = onVerificado;
  }, [onVerificado]);

  // "Entrar" del header cuando ya hay un plan a la vista: se abre Mi cuenta.
  useEffect(() => {
    function alEntrar() {
      const panel = detailsRef.current;
      if (!panel) return;

      panel.open = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    window.addEventListener('postulado:entrar', alEntrar);
    return () => window.removeEventListener('postulado:entrar', alEntrar);
  }, []);

  const refrescarPerfil = useCallback(async () => {
    const perfil = await miPerfil();
    if (!perfil) return;

    const confirmado = Boolean(perfil.emailVerifiedAt);
    if (confirmado === confirmadoRef.current) return;

    confirmadoRef.current = confirmado;
    setVerificado(confirmado);
    if (confirmado) onVerificadoRef.current();
  }, []);

  useEffect(() => {
    let vigente = true;

    void listarLotes().then((lista) => {
      if (vigente) setLotes(lista);
    });

    void refrescarPerfil();

    // Si confirmás el correo en otra pestaña, el estado se actualiza al volver.
    const alVolver = () => void refrescarPerfil();
    window.addEventListener('focus', alVolver);

    return () => {
      vigente = false;
      window.removeEventListener('focus', alVolver);
    };
  }, [refrescarPerfil]);

  async function reenviar() {
    setEnviando(true);
    setAviso(null);

    try {
      const r = await reenviarVerificacion();

      if (r.yaVerificado) {
        setVerificado(true);
        onVerificado();
        setAviso({ tipo: 'ok', texto: 'Tu correo ya estaba confirmado.' });
      } else if (r.enviado) {
        setAviso({
          tipo: 'ok',
          texto: `Te mandamos otro mail a ${sesion.email}. Revisá spam si no aparece.`,
        });
      } else if (r.esperaSegundos) {
        setAviso({
          tipo: 'espera',
          texto: `Esperá ${r.esperaSegundos} s antes de pedir otro.`,
        });
      } else {
        setAviso({
          tipo: 'error',
          texto:
            'El servidor no pudo enviar el correo. Probá de nuevo en un rato.',
        });
      }
    } catch {
      setAviso({
        tipo: 'error',
        texto: 'No pudimos reenviar el correo. Probá de nuevo en un rato.',
      });
    } finally {
      setEnviando(false);
    }
  }

  async function cerrarEnTodos() {
    setCerrandoTodo(true);
    setAviso(null);

    const resultado = await cerrarTodasLasSesiones();
    setCerrandoTodo(false);

    if (!resultado) {
      setAviso({
        tipo: 'error',
        texto:
          'No pudimos cerrar las otras sesiones. Probá de nuevo en un rato; esta sesión sigue abierta.',
      });
      setConfirmandoTodo(false);
      return;
    }

    // La sesión local ya se borró dentro de `cerrarTodasLasSesiones`; el padre
    // limpia el estado de la pantalla.
    onSalir();
  }

  return (
    <details className="cuenta" ref={detailsRef}>
      <summary className="cuenta__sum">
        <span className="cuenta__mail">{sesion.email}</span>
        <span
          className={`cuenta__badge ${verificado ? 'is-ok' : 'is-pending'}`}
        >
          {verificado ? 'Correo confirmado' : 'Correo sin confirmar'}
        </span>
        <span className="cuenta__open" aria-hidden="true">
          Mi cuenta
        </span>
      </summary>

      <div className="cuenta__body">
        {!verificado ? (
          <div className="cuenta__pending">
            <p>
              <b>Confirmá tu correo.</b> Es lo que permite recuperar este plan
              desde otro dispositivo o si cambiás de navegador.
            </p>
            <button
              type="button"
              className="cuenta__action"
              onClick={() => void reenviar()}
              disabled={enviando}
            >
              {enviando ? 'Enviando…' : 'Reenviar el mail'}
            </button>
          </div>
        ) : null}

        {aviso ? (
          <p
            className={`cuenta__aviso is-${aviso.tipo}`}
            role={aviso.tipo === 'error' ? 'alert' : 'status'}
          >
            {aviso.texto}
          </p>
        ) : null}

        <div className="cuenta__lotes">
          <div className="cuenta__lotes-head">
            <span>Tus planes</span>
            <span>
              {lotes === null
                ? 'Cargando…'
                : `${lotes.length} ${lotes.length === 1 ? 'lote' : 'lotes'}`}
            </span>
          </div>

          {lotes?.length === 0 ? (
            <p className="cuenta__empty">
              Todavía no hay lotes guardados en esta cuenta.
            </p>
          ) : null}

          {lotes?.map((lote) => {
            // El plan que ya está a la vista no se reabre: "Abrir plan" sobre
            // el lote abierto repintaba el mismo resultado y se leía como
            // recarga constante.
            const abierto = sesion.loteId === lote.id;

            return (
              <div key={lote.id} className="cuenta__lote">
                <span className="cuenta__lote-nombre">
                  {lote.nombre ?? 'Lote sin nombre'}
                </span>
                <span className="cuenta__lote-meta">
                  {lote.ids.length}{' '}
                  {lote.ids.length === 1 ? 'oferta' : 'ofertas'} ·{' '}
                  {fecha(lote.createdAt)}
                </span>
                {abierto ? (
                  <span className="cuenta__lote-abierto">
                    Viendo este plan
                  </span>
                ) : (
                  <button
                    type="button"
                    className="cuenta__action"
                    onClick={() => onAbrir(lote)}
                  >
                    Abrir plan
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="cuenta__foot">
          {confirmandoTodo ? (
            <>
              <span className="cuenta__confirm" role="status">
                ¿Cerrar también en tus otros dispositivos?
              </span>
              <button
                type="button"
                className="cuenta__action"
                onClick={() => void cerrarEnTodos()}
                disabled={cerrandoTodo}
              >
                {cerrandoTodo ? 'Cerrando…' : 'Sí, cerrar todas'}
              </button>
              <button
                type="button"
                className="cuenta__action"
                onClick={() => setConfirmandoTodo(false)}
                disabled={cerrandoTodo}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cuenta__action" onClick={onSalir}>
                Cerrar sesión en este dispositivo
              </button>
              <button
                type="button"
                className="cuenta__action cuenta__action--soft"
                onClick={() => setConfirmandoTodo(true)}
              >
                Cerrar sesión en todos
              </button>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
