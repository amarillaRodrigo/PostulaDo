'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  borrarCuenta,
  borrarLote,
  cerrarOtrasSesiones,
  cerrarTodasLasSesiones,
  listarLotes,
  listarSesiones,
  miPerfil,
  reenviarVerificacion,
  renombrarLote,
  type LoteGuardado,
  type SesionAbierta,
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

/**
 * Una fila de lote con sus acciones renombrar, borrar y agregar ofertas. El
 * estado de cada acción vive acá: el borrar necesita su propia confirmación
 * en fila y el renombrar, un input que aparece sin recargar nada.
 */
function FilaLote({
  lote,
  abierto,
  onAbrir,
  onAgregar,
  onRenombrado,
  onLoteBorrado,
}: {
  lote: LoteGuardado;
  abierto: boolean;
  onAbrir: (lote: LoteGuardado) => void;
  onAgregar: (lote: LoteGuardado) => void;
  onRenombrado: (lote: LoteGuardado) => void;
  onLoteBorrado: (lote: LoteGuardado) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(lote.nombre ?? '');
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const mostrado = lote.nombre ?? 'Lote sin nombre';

  if (editando) {
    return (
      <div className="cuenta__lote">
        <form
          className="cuenta__form"
          onSubmit={(e) => {
            e.preventDefault();

            if (trabajando) return;
            setTrabajando(true);

            void renombrarLote(lote.id, nombre.trim()).then((r) => {
              setTrabajando(false);

              if (!r) {
                setAviso('No pudimos guardar el nombre. Probá de nuevo.');
                return;
              }

              setEditando(false);
              onRenombrado(r);
            });
          }}
        >
          <label className="sr-only" htmlFor={`nombre-${lote.id}`}>
            Nuevo nombre del lote
          </label>
          <input
            id={`nombre-${lote.id}`}
            className="cuenta__editar"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del lote (opcional)"
            autoFocus
            spellCheck={false}
          />
          <button
            type="submit"
            className="cuenta__action"
            disabled={trabajando}
          >
            {trabajando ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="cuenta__action cuenta__action--soft"
            onClick={() => {
              setEditando(false);
              setAviso(null);
              setNombre(lote.nombre ?? '');
            }}
          >
            Cancelar
          </button>
        </form>
        {aviso ? (
          <p className="cuenta__error" role="alert">
            {aviso}
          </p>
        ) : null}
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="cuenta__lote">
        <span className="cuenta__lote-nombre">{mostrado}</span>
        <span className="cuenta__lote-meta">
          ¿Borrar este lote? Las {lote.ids.length}{' '}
          {lote.ids.length === 1 ? 'oferta queda' : 'ofertas quedan'} en tu
          cuenta; solo se pierde el plan.
        </span>
        <div className="cuenta__form">
          <button
            type="button"
            className="cuenta__action"
            disabled={trabajando}
            onClick={() => {
              if (trabajando) return;
              setTrabajando(true);

              void borrarLote(lote.id).then((ok) => {
                setTrabajando(false);
                setConfirmando(false);

                if (ok) {
                  onLoteBorrado(lote);
                } else {
                  setAviso('No pudimos borrar el lote. Probá de nuevo.');
                }
              });
            }}
          >
            {trabajando ? 'Borrando…' : 'Sí, borrar'}
          </button>
          <button
            type="button"
            className="cuenta__action cuenta__action--soft"
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
        </div>
        {aviso ? (
          <p className="cuenta__error" role="alert">
            {aviso}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cuenta__lote">
      <span className="cuenta__lote-nombre">{mostrado}</span>
      <span className="cuenta__lote-meta">
        {lote.ids.length}{' '}
        {lote.ids.length === 1 ? 'oferta' : 'ofertas'} ·{' '}
        {fecha(lote.createdAt)}
      </span>
      {abierto ? (
        <span className="cuenta__lote-abierto">Viendo este plan</span>
      ) : (
        <button
          type="button"
          className="cuenta__action"
          onClick={() => onAbrir(lote)}
        >
          Abrir plan
        </button>
      )}
      <div className="cuenta__minis">
        <button
          type="button"
          className="cuenta__mini"
          onClick={() => onAgregar(lote)}
        >
          Agregar ofertas
        </button>
        <button
          type="button"
          className="cuenta__mini cuenta__mini--riesgo"
          onClick={() => {
            setNombre(lote.nombre ?? '');
            setConfirmando(true);
          }}
        >
          Borrar
        </button>
        <button
          type="button"
          className="cuenta__mini"
          onClick={() => {
            setNombre(lote.nombre ?? '');
            setEditando(true);
          }}
        >
          Renombrar
        </button>
      </div>
    </div>
  );
}

export function CuentaPanel({
  sesion,
  onAbrir,
  onAbrirCorpus,
  onAgregar,
  onLoteBorrado,
  onSalir,
  onVerificado,
}: {
  sesion: SesionGuardada;
  onAbrir: (lote: LoteGuardado) => void;
  onAbrirCorpus: () => void;
  onAgregar: (lote: LoteGuardado) => void;
  onLoteBorrado: (lote: LoteGuardado) => void;
  onSalir: () => void;
  onVerificado: () => void;
}) {
  const [lotes, setLotes] = useState<LoteGuardado[] | null>(null);
  const [sesiones, setSesiones] = useState<SesionAbierta[] | null>(null);
  const [verificado, setVerificado] = useState(sesion.emailVerificado);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoTodo, setConfirmandoTodo] = useState(false);
  const [cerrandoTodo, setCerrandoTodo] = useState(false);
  const [confirmandoOtras, setConfirmandoOtras] = useState(false);
  const [cerrandoOtras, setCerrandoOtras] = useState(false);
  const [borrarPaso, setBorrarPaso] = useState<'nada' | 'confirmando'>('nada');
  const [contraBorrado, setContraBorrado] = useState('');
  const [borrandoCuenta, setBorrandoCuenta] = useState(false);

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

    void listarSesiones().then((lista) => {
      if (vigente) setSesiones(lista);
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

  async function cerrarLasOtras() {
    setCerrandoOtras(true);
    setAviso(null);

    const resultado = await cerrarOtrasSesiones();
    setCerrandoOtras(false);
    setConfirmandoOtras(false);

    if (!resultado.ok) {
      setAviso({ tipo: 'error', texto: resultado.message });
      return;
    }

    if (resultado.cerradas > 0) {
      setAviso({
        tipo: 'ok',
        texto:
          resultado.cerradas === 1
            ? 'Cerramos la sesión del otro dispositivo.'
            : `Cerramos las sesiones de los otros ${resultado.cerradas} dispositivos.`,
      });
    }

    const lista = await listarSesiones();
    if (lista) setSesiones(lista);
  }

  /** Cuánto le queda de vida a una sesión, dicho en días honestos. */
  function venceEn(iso: string): string {
    const dias = Math.ceil(
      (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    if (Number.isNaN(dias) || dias <= 0) return 'vence pronto';
    if (dias === 1) return 'vence mañana';

    return `vence en ${dias} días`;
  }

  /** Borra la cuenta con la contraseña escrita. Irreversible: se avisa dos veces. */
  async function borrarLaCuenta() {
    if (!contraBorrado) {
      setAviso({
        tipo: 'error',
        texto: 'Escribí tu contraseña para confirmar el borrado.',
      });
      return;
    }

    setBorrandoCuenta(true);
    setAviso(null);

    const resultado = await borrarCuenta(contraBorrado);
    setBorrandoCuenta(false);

    if (!resultado.ok) {
      setAviso({
        tipo: 'error',
        texto: resultado.message ?? 'No pudimos borrar la cuenta.',
      });
      return;
    }

    // La API ya borró todo y `borrarCuenta` limpió la sesión local: el panel
    // se despide.
    onSalir();
  }

  // Un cuerpo inesperado de la API no puede tumbar el panel: si el estado no
  // es una lista, se muestra el mismo aviso que cuando la lectura falla.
  const listaSesiones = Array.isArray(sesiones) ? sesiones : null;

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

          {/* El plan del corpus entero: mismo cálculo, denominador completo. */}
          <div className="cuenta__lote">
            <span className="cuenta__lote-nombre">Todas tus ofertas</span>
            <span className="cuenta__lote-meta">
              el plan con todo lo que quedó en pie
            </span>
            {sesion.planCompleto ? (
              <span className="cuenta__lote-abierto">Viendo este plan</span>
            ) : (
              <button
                type="button"
                className="cuenta__action"
                onClick={onAbrirCorpus}
              >
                Abrir plan
              </button>
            )}
          </div>

          {lotes?.map((lote) => (
            <FilaLote
              key={lote.id}
              lote={lote}
              abierto={sesion.loteId === lote.id}
              onAbrir={(l) => {
                // El que se abre deja de estar pendiente en esta lista: el
                // cambio de nombre pudo estar editorialmente pendiente.
                setLotes((prev) =>
                  prev?.map((p) => (p.id === l.id ? { ...l } : p)) ?? null,
                );
                onAbrir(l);
              }}
              onAgregar={onAgregar}
              onRenombrado={(r) =>
                setLotes((prev) =>
                  prev?.map((p) => (p.id === r.id ? { ...p, nombre: r.nombre } : p)) ?? null,
                )
              }
              onLoteBorrado={(l) => {
                setLotes((prev) => prev?.filter((p) => p.id !== l.id) ?? null);
                onLoteBorrado(l);
              }}
            />
          ))}
        </div>

        <div className="cuenta__lotes">
          <div className="cuenta__lotes-head">
            <span>Tus sesiones</span>
            <span>
              {listaSesiones === null
                ? 'Cargando…'
                : listaSesiones.length === 0
                  ? 'ninguna abierta'
                  : `${listaSesiones.length} ${listaSesiones.length === 1 ? 'abierta' : 'abiertas'}`}
            </span>
          </div>

          {listaSesiones === null ? (
            <p className="cuenta__empty">
              No pudimos leer las sesiones de esta cuenta.
            </p>
          ) : (
            listaSesiones.map((s) => (
              <div key={s.id} className="cuenta__lote">
                <span className="cuenta__lote-nombre">
                  {s.esteDispositivo ? 'Este dispositivo' : 'Otro dispositivo'}
                </span>
                <span className="cuenta__lote-meta">
                  abierta el {fecha(s.abierta)} · {venceEn(s.vence)}
                </span>
                {s.esteDispositivo ? (
                  <span className="cuenta__lote-abierto">Estás acá</span>
                ) : null}
              </div>
            ))
          )}

          {listaSesiones !== null &&
            listaSesiones.some((s) => !s.esteDispositivo) &&
            (confirmandoOtras ? (
              <div className="cuenta__lote">
                <span className="cuenta__lote-meta">
                  ¿Cerrar las sesiones de los otros dispositivos? Esta queda
                  abierta.
                </span>
                <div className="cuenta__form">
                  <button
                    type="button"
                    className="cuenta__action"
                    disabled={cerrandoOtras}
                    onClick={() => void cerrarLasOtras()}
                  >
                    {cerrandoOtras ? 'Cerrando…' : 'Sí, cerrar las otras'}
                  </button>
                  <button
                    type="button"
                    className="cuenta__action cuenta__action--soft"
                    disabled={cerrandoOtras}
                    onClick={() => setConfirmandoOtras(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="cuenta__mini cuenta__mini--riesgo"
                onClick={() => setConfirmandoOtras(true)}
              >
                Cerrar las otras sesiones
              </button>
            ))}
        </div>

        <div className="cuenta__borrar">
          {borrarPaso === 'nada' ? (
            <>
              <p className="cuenta__borrar-texto">
                <b>Borrar la cuenta</b> borra tus ofertas, tus lotes y sus
                planes. No hay vuelta atrás.
              </p>
              <button
                type="button"
                className="cuenta__mini cuenta__mini--riesgo"
                onClick={() => {
                  setContraBorrado('');
                  setBorrarPaso('confirmando');
                }}
              >
                Borrar mi cuenta
              </button>
            </>
          ) : (
            <>
              <p className="cuenta__borrar-texto">
                Se borran{' '}
                <b>todas tus ofertas, todos tus lotes y sus planes</b>, y no
                vuelven ni pidiendo el mismo correo. Para confirmar,
                escribí tu contraseña.
              </p>
              <form
                className="cuenta__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void borrarLaCuenta();
                }}
              >
                <label className="sr-only" htmlFor="borrar-contra">
                  Tu contraseña actual, para confirmar el borrado
                </label>
                <input
                  id="borrar-contra"
                  className="cuenta__editar"
                  type="password"
                  value={contraBorrado}
                  onChange={(e) => setContraBorrado(e.target.value)}
                  placeholder="Tu contraseña actual"
                  autoFocus
                />
                <button
                  type="submit"
                  className="cuenta__action"
                  disabled={borrandoCuenta}
                >
                  {borrandoCuenta ? 'Borrando…' : 'Sí, borrar mi cuenta'}
                </button>
                <button
                  type="button"
                  className="cuenta__action cuenta__action--soft"
                  disabled={borrandoCuenta}
                  onClick={() => setBorrarPaso('nada')}
                >
                  Cancelar
                </button>
              </form>
            </>
          )}
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
