'use client';

import { useEffect, useRef, useState } from 'react';
import { colorDeTema } from '@/lib/themes';
import {
  abrirLote,
  analizarLote,
  API_CONFIGURADA,
  cerrarSesion,
  crearCuenta,
  entrarCuenta,
  guardarSesion,
  leerSesion,
  listarLotes,
  listarPostulaciones,
  actualizarOferta,
  olvidePassword,
  recuperarPlan,
  SIN_API,
  type OfertaResumen,
  type LoteGuardado,
  type Resultado,
  type SesionGuardada,
} from '@/lib/api';
import { CuentaPanel } from '@/components/CuentaPanel';

const EXAMPLE = [
  '01  https://ejemplo.com/o/cloud-sre',
  '02  https://ejemplo.com/o/platform',
  '03  https://ejemplo.com/o/aws-cloud',
  '04  https://ejemplo.com/o/devops',
  '05  https://ejemplo.com/o/k8s',
].join('\n');

const MAX_URLS = 20;

type Cuenta = {
  nombre: string;
  email: string;
  password: string;
  birthDate: string;
};

type Modo = 'crear' | 'entrar';

type Detalle =
  | { estado: 'nada' }
  | { estado: 'cargando' }
  | { estado: 'listo'; ofertas: OfertaResumen[]; aviso: string | null }
  | { estado: 'error' };

const ETIQUETA_ESTADO: Record<string, string> = {
  ENVIADO: 'Enviado',
  ENTREVISTA: 'Entrevista',
  OFERTA: 'Oferta',
  RECHAZADO: 'Rechazado',
  GHOSTEADO: 'Ghosteado',
};

/** Sin título guardado, el dominio de la URL es lo más honesto que hay. */
function tituloDe(oferta: OfertaResumen): string {
  if (oferta.title) return oferta.title;

  try {
    return new URL(oferta.url).host.replace(/^www\./, '');
  } catch {
    return 'Oferta';
  }
}

type Estado =
  | { kind: 'idle' }
  | { kind: 'restoring'; texto: string }
  | { kind: 'working'; hechos: number; total: number }
  | { kind: 'error'; message: string }
  | { kind: 'needs-account'; cuenta: Cuenta; modo: Modo }
  | { kind: 'account-error'; cuenta: Cuenta; modo: Modo; message: string }
  | {
      kind: 'done';
      result: Resultado;
      sesion: SesionGuardada;
      fallidas: number;
      emailEnviado?: boolean;
    };

const CUENTA_VACIA: Cuenta = { nombre: '', email: '', password: '', birthDate: '' };

/**
 * Las URLs pegadas se guardan por pestaña: si recargás mientras el lote se
 * está analizando, el textarea no queda vacío y podés reintentar.
 */
const CLAVE_URLS = 'postulado.urls';

function leerUrlsPegadas(): string {
  if (typeof window === 'undefined') return '';

  try {
    const crudo = window.sessionStorage.getItem(CLAVE_URLS);
    if (!crudo) return '';

    const lista: unknown = JSON.parse(crudo);
    if (!Array.isArray(lista)) return '';

    return lista.filter((url): url is string => typeof url === 'string').join('\n');
  } catch {
    return '';
  }
}

function guardarUrlsPegadas(urls: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(CLAVE_URLS, JSON.stringify(urls));
  } catch {
    // Sin almacenamiento: se pierde comodidad, no funcionalidad.
  }
}

function borrarUrlsPegadas(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(CLAVE_URLS);
  } catch {
    // Nada que hacer.
  }
}

function parseUrls(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export function LoteForm() {
  const [urls, setUrls] = useState('');
  const [state, setState] = useState<Estado>({ kind: 'idle' });
  const [aviso, setAviso] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const estadoRef = useRef<Estado>(state);
  const [detalle, setDetalle] = useState<Detalle>({ estado: 'nada' });
  const detalleCargadaRef = useRef(false);
  const [recuperar, setRecuperar] = useState<{
    abierto: boolean;
    enviando: boolean;
    aviso: { tipo: 'ok' | 'error'; texto: string } | null;
  }>({ abierto: false, enviando: false, aviso: null });

  // Al volver (F5, otra pestaña, otro día) se retoma el último lote. Se hace
  // en un efecto para no romper la hidratación del export estático.
  useEffect(() => {
    const pegadas = leerUrlsPegadas();
    if (pegadas) setUrls(pegadas);

    const guardada = leerSesion();
    if (!guardada) return;

    // Una sesión sin ids es un lote a medio armar (o recién entrado): no hay
    // plan que recuperar, así que se muestra el formulario sin parpadeo.
    if (guardada.ids.length === 0) return;

    let vigente = true;
    setState({ kind: 'restoring', texto: 'Recuperando tu último lote…' });

    void recuperarPlan().then((result) => {
      if (!vigente) return;
      setState(
        result
          ? { kind: 'done', result, sesion: guardada, fallidas: 0 }
          : { kind: 'idle' },
      );
    });

    return () => {
      vigente = false;
    };
  }, []);

  // El estado actual sin volver a suscribir el listener en cada render.
  useEffect(() => {
    estadoRef.current = state;
  }, [state]);

  // Con un plan propio a la vista, la landing esconde el plan de ejemplo:
  // dos tablas de cobertura distintas seguidas se leen como dos resultados.
  // Al cambiar de plan también se descarta el detalle ya cargado.
  useEffect(() => {
    document.documentElement.dataset.plan =
      state.kind === 'done' || state.kind === 'restoring' ? 'si' : 'no';

    if (state.kind !== 'done') {
      setDetalle({ estado: 'nada' });
      detalleCargadaRef.current = false;
    }

    return () => {
      delete document.documentElement.dataset.plan;
    };
  }, [state.kind]);

  // "Entrar" del header. Si ya hay sesión no se pide la contraseña de nuevo:
  // se abre el último lote guardado. Con un plan a la vista, el que se abre es
  // el panel de Mi cuenta (lo escucha `CuentaPanel`).
  useEffect(() => {
    function alEntrar() {
      const actual = estadoRef.current;

      if (
        actual.kind === 'done' ||
        actual.kind === 'restoring' ||
        actual.kind === 'working'
      ) {
        return;
      }

      setAviso(null);

      if (!leerSesion()) {
        // Si venía escribiendo el correo en el paso de cuenta, se conserva.
        const cuenta =
          actual.kind === 'needs-account' || actual.kind === 'account-error'
            ? { ...actual.cuenta, password: '' }
            : CUENTA_VACIA;

        setState({ kind: 'needs-account', cuenta, modo: 'entrar' });
        return;
      }

      void (async () => {
        const lotes = await listarLotes();

        if (lotes.length > 0) {
          await abrir(lotes[0]);
          return;
        }

        setState({ kind: 'idle' });
        setAviso(
          'Ya entraste. Tu cuenta todavía no tiene lotes guardados: pegá las ofertas y armamos el primero.',
        );
      })();
    }

    window.addEventListener('postulado:entrar', alEntrar);
    return () => window.removeEventListener('postulado:entrar', alEntrar);
  }, []);

  /** Analiza el lote con la sesión ya guardada (sin volver a pedir cuenta). */
  async function analizarConSesion(list: string[], emailEnviado?: boolean) {
    setAviso(null);
    setState({ kind: 'working', hechos: 0, total: list.length });
    guardarUrlsPegadas(list);

    try {
      const { resultado, fallidas, sesion } = await analizarLote(
        list,
        (hechos, total) => setState({ kind: 'working', hechos, total }),
      );

      setState({
        kind: 'done',
        result: resultado,
        sesion,
        fallidas,
        emailEnviado,
      });
    } catch (e) {
      // Si la API rechazó la sesión, `pedirConSesion` ya la borró: se pide
      // entrar en vez de dejar un error que no se arregla desde el formulario.
      if (!leerSesion()) {
        setState({ kind: 'needs-account', cuenta: CUENTA_VACIA, modo: 'entrar' });
        return;
      }

      setState({
        kind: 'error',
        message:
          e instanceof Error ? e.message : 'No pudimos analizar tus ofertas.',
      });
    }
  }

  async function correr(cuenta: Cuenta, modo: Modo) {
    const list = parseUrls(urls);
    if (list.length === 0) {
      setState({ kind: 'error', message: 'Pegá al menos una URL de oferta.' });
      return;
    }

    setState({ kind: 'working', hechos: 0, total: list.length });
    guardarUrlsPegadas(list);

    try {
      const entrada =
        modo === 'entrar'
          ? await entrarCuenta(cuenta.email.trim(), cuenta.password)
          : await crearCuenta(cuenta);

      await analizarConSesion(list, entrada.emailEnviado);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No pudimos analizar tus ofertas.';

      // Un correo que ya existe no es un error sin salida: se cambia a
      // "entrar" con el mail ya cargado, en vez de dejar a la persona
      // peleando con el formulario de registro.
      const yaRegistrado =
        modo === 'crear' && /ya est. registrado/i.test(message);

      setState({
        kind: 'account-error',
        cuenta,
        modo: yaRegistrado ? 'entrar' : modo,
        message: yaRegistrado
          ? 'Ese correo ya tiene cuenta. Entrá con tu contraseña.'
          : message,
      });
    }
  }

  /**
   * Entra sin lote: abre el plan más reciente de la cuenta.
   *
   * Es el camino del "Entrar" del header. Si la cuenta todavía no tiene lotes,
   * lo dice en vez de dejar una pantalla en blanco: la sesión queda abierta y
   * el formulario listo para pegar las primeras ofertas.
   */
  async function entrarSolo(cuenta: Cuenta) {
    if (!API_CONFIGURADA) {
      setState({ kind: 'error', message: SIN_API });
      return;
    }

    setAviso(null);
    setState({ kind: 'restoring', texto: 'Entrando a tu cuenta…' });

    try {
      await entrarCuenta(cuenta.email.trim(), cuenta.password);
    } catch (e) {
      setState({
        kind: 'account-error',
        cuenta,
        modo: 'entrar',
        message: e instanceof Error ? e.message : 'No pudimos entrar.',
      });
      return;
    }

    const lotes = await listarLotes();

    if (lotes.length === 0) {
      setState({ kind: 'idle' });
      setAviso(
        'Entraste. Tu cuenta todavía no tiene lotes guardados: pegá las ofertas y armamos el primero.',
      );
      return;
    }

    await abrir(lotes[0]);
  }

  async function abrir(lote: LoteGuardado) {
    const guardada = leerSesion();
    if (!guardada) {
      setState({ kind: 'idle' });
      return;
    }

    setState({ kind: 'restoring', texto: 'Abriendo ese lote…' });

    const result = await abrirLote(lote.ids);

    if (!result) {
      setState({
        kind: 'error',
        message: 'No pudimos abrir ese lote. Probá de nuevo en un rato.',
      });
      return;
    }

    // Se relee: el request pudo haber rotado los tokens por dentro.
    const actual = leerSesion() ?? guardada;
    const actualizada: SesionGuardada = {
      ...actual,
      ids: lote.ids,
      loteId: lote.id,
    };
    guardarSesion(actualizada);

    setState({
      kind: 'done',
      result,
      sesion: actualizada,
      fallidas: 0,
    });

    // Abriste otro lote desde el panel, que queda abajo: el cambio se ve
    // volviendo al plan, no esperando dónde está el panel.
    document
      .querySelector('#lote')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Lee el lote de adentro la primera vez que se abre el panel. */
  async function abrirDetalle() {
    const actual = estadoRef.current;
    if (actual.kind !== 'done' || detalleCargadaRef.current) return;

    detalleCargadaRef.current = true;
    setDetalle({ estado: 'cargando' });

    try {
      const ofertas = await listarPostulaciones(actual.sesion.ids);
      setDetalle({ estado: 'listo', ofertas, aviso: null });
    } catch {
      setDetalle({
        estado: 'error',
      });
    }
  }

  /**
   * Marca cómo va una postulación del lote. No recalcula el plan: este dato
   * es por oferta, el agregado sale del lote entero.
   */
  async function cambiarEstado(oferta: OfertaResumen, estado: string) {
    const actual = estadoRef.current;
    if (actual.kind !== 'done') return;

    const antes = oferta.status;
    const back = (aviso: string | null) => {
      setDetalle((prev) =>
        prev.estado === 'listo'
          ? {
              ...prev,
              ofertas: prev.ofertas.map((o) =>
                o.id === oferta.id ? { ...o, status: antes } : o,
              ),
              aviso,
            }
          : prev,
      );
    };

    // Optimista: si la API no acepta, la fila vuelve a su estado anterior.
    setDetalle((prev) =>
      prev.estado === 'listo'
        ? {
            ...prev,
            ofertas: prev.ofertas.map((o) =>
              o.id === oferta.id ? { ...o, status: estado } : o,
            ),
          }
        : prev,
    );

    const okCambios = await actualizarOferta(oferta.id, { status: estado });
    if (!okCambios) {
      back('No pudimos guardar ese estado. Probá de nuevo.');
    }
  }

  async function salir() {
    // Revoca el refresh token en la API y borra lo guardado. Si la API no
    // responde, `cerrarSesion` igual limpia el navegador.
    await cerrarSesion();
    borrarUrlsPegadas();
    setUrls('');
    setAviso(null);
    setState({ kind: 'idle' });
  }

  /**
   * Vuelve al formulario para armar otro lote sin cerrar la sesión.
   *
   * "Analizar otro lote" no es "cerrar sesión": la cuenta sigue abierta, así
   * que al pegar las ofertas nuevas no se vuelve a pedir la contraseña. Cerrar
   * sesión está en Mi cuenta.
   */
  function otroLote() {
    borrarUrlsPegadas();
    setUrls('');
    setAviso(null);
    setState({ kind: 'idle' });
  }

  /**
   * Pide el enlace de recuperación con el correo que está escrito arriba.
   *
   * La respuesta de la API es genérica a propósito: no confirma si el correo
   * tiene cuenta. La landing repite esa fórmula en vez de inventar un
   * "te lo mandamos" que podría ser mentira.
   */
  async function pedirEnlace() {
    const email = emailRef.current?.value.trim() ?? '';

    if (!email) {
      setRecuperar((r) => ({
        ...r,
        aviso: { tipo: 'error', texto: 'Escribí tu correo arriba.' },
      }));
      return;
    }

    setRecuperar((r) => ({ ...r, enviando: true, aviso: null }));

    try {
      const { enviado } = await olvidePassword(email);

      setRecuperar((prev) => ({
        ...prev,
        enviando: false,
        aviso: enviado
          ? {
              tipo: 'ok',
              texto: `Si ${email} tiene cuenta, te mandamos un enlace para elegir una contraseña nueva. Revisá spam: vence en 1 hora.`,
            }
          : {
              tipo: 'error',
              texto:
                'El servidor no pudo enviar el correo en este momento. Probá de nuevo en un rato.',
            },
      }));
    } catch {
      setRecuperar((prev) => ({
        ...prev,
        enviando: false,
        aviso: {
          tipo: 'error',
          texto: 'No pudimos pedir el enlace. Probá de nuevo en un rato.',
        },
      }));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Retomando el lote guardado                                        */
  /* ---------------------------------------------------------------- */
  if (state.kind === 'restoring') {
    return (
      <div className="ingest ingest--done">
        <div className="ingest__head">
          <span>Tu plan</span>
          <span>{state.texto}</span>
        </div>
        <div className="ingest__done-body">
          <p className="ingest__done-suggestion">
            Un segundo: estamos leyendo las ofertas que guardaste la última vez.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Resultado                                                         */
  /* ---------------------------------------------------------------- */
  if (state.kind === 'done') {
    const { result, sesion, fallidas } = state;

    return (
      <div className="ingest ingest--done">
        <div className="ingest__head">
          <span>Tu plan</span>
          <span>
            {result.totalOfertasAnalizadas} ofertas ·{' '}
            {result.ecosistema ?? 'sin ecosistema'}
          </span>
        </div>
        <div className="ingest__done-body">
          {fallidas > 0 ? (
            <p className="ingest__notice" role="status">
              No pudimos leer {fallidas}{' '}
              {fallidas === 1 ? 'de las ofertas' : 'de las ofertas'} que pegaste.
              El plan se calcula solo con las que sí entraron.
            </p>
          ) : null}

          {result.temas.map((tema) => (
            <div key={tema.key} className="cov">
              <div>
                <div className="cov__label">{tema.label}</div>
                <div className="bar">
                  <i
                    style={{
                      width: `${tema.porcentaje}%`,
                      background: colorDeTema(tema.key),
                    }}
                  />
                </div>
              </div>
              <div className="cov__pct">{tema.porcentaje}%</div>
              <div className="cov__alt">
                {tema.alternativas.slice(0, 2).join(' · ')}
              </div>
            </div>
          ))}
          <p className="ingest__done-suggestion">{result.sugerenciaAprendizaje}</p>

          <details
            className="lote-detalle"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) {
                void abrirDetalle();
              }
            }}
          >
            <summary>
              <span>
                Las {result.totalOfertasAnalizadas} ofertas de este lote
              </span>
            </summary>
            {detalle.estado === 'cargando' ? (
              <p className="lote-detalle__aviso">Leyendo el lote…</p>
            ) : null}
            {detalle.estado === 'error' ? (
              <p className="lote-detalle__aviso">
                No pudimos leer tus ofertas guardadas. Probá de nuevo.
              </p>
            ) : null}
            {detalle.estado === 'listo' ? (
              <div className="lote-detalle__filas">
                {detalle.aviso ? (
                  <p className="lote-detalle__aviso is-error" role="alert">
                    {detalle.aviso}
                  </p>
                ) : null}
                {detalle.ofertas.map((oferta) => (
                  <div key={oferta.id} className="lote-detalle__fila">
                    <div className="lote-detalle__top">
                      <span className="lote-detalle__titulo">
                        <a href={oferta.url} target="_blank" rel="noreferrer">
                          {tituloDe(oferta)}
                        </a>
                      </span>
                      <select
                        className="lote-detalle__select"
                        value={oferta.status}
                        onChange={(e) =>
                          void cambiarEstado(
                            oferta,
                            (e.target as HTMLSelectElement).value,
                          )
                        }
                        aria-label={`Estado de ${tituloDe(oferta)}`}
                      >
                        {Object.entries(ETIQUETA_ESTADO).map(([valor, texto]) => (
                          <option key={valor} value={valor}>
                            {texto}
                          </option>
                        ))}
                      </select>
                    </div>
                    {oferta.company || oferta.aniosExperiencia ? (
                      <div className="lote-detalle__meta">
                        {[
                          oferta.company,
                          oferta.aniosExperiencia
                            ? `${oferta.aniosExperiencia} años`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    ) : null}
                    <div className="lote-detalle__temas">
                      {oferta.tecnologias.length
                        ? oferta.tecnologias.join(' · ')
                        : 'Sin tecnologías detectadas'}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </details>

          {state.emailEnviado === false && !sesion.emailVerificado ? (
            <p className="ingest__notice" role="status">
              Tu cuenta quedó creada, pero el mail de confirmación no salió.
              Podés pedirlo de nuevo desde <b>Mi cuenta</b>.
            </p>
          ) : null}
        </div>

        <CuentaPanel
          sesion={sesion}
          onAbrir={(lote) => void abrir(lote)}
          onSalir={salir}
          onVerificado={() => {
            const guardada = leerSesion();
            if (guardada) {
              guardarSesion({ ...guardada, emailVerificado: true });
            }
            setState((prev) =>
              prev.kind === 'done'
                ? {
                    ...prev,
                    sesion: { ...prev.sesion, emailVerificado: true },
                  }
                : prev,
            );
          }}
        />

        <div className="ingest__foot">
          <span className="ingest__gets">
            <b>Quedó guardado en tu cuenta.</b>{' '}
            {sesion.emailVerificado
              ? 'Entrá desde cualquier dispositivo y abrí este plan.'
              : 'Confirmá tu correo en Mi cuenta para abrirlo desde otro dispositivo.'}
          </span>
          <button className="ingest__restart" type="button" onClick={otroLote}>
            Analizar otro lote
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Paso de cuenta                                                    */
  /* ---------------------------------------------------------------- */
  if (state.kind === 'needs-account' || state.kind === 'account-error') {
    const { cuenta, modo } = state;
    const error = state.kind === 'account-error' ? state.message : null;
    const entrando = modo === 'entrar';
    const hayUrls = parseUrls(urls).length > 0;

    return (
      <form className="ingest" onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const cuenta: Cuenta = {
          nombre: String(form.get('nombre') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          birthDate: String(form.get('birthDate') ?? ''),
        };

        // Entrar sin ofertas pegadas: se abre el último plan de la cuenta.
        if (entrando && parseUrls(urls).length === 0) {
          void entrarSolo(cuenta);
          return;
        }

        void correr(cuenta, modo);
      }}>
        <div className="ingest__head">
          <span>Cargamos tu lote</span>
          <span>
            {entrando
              ? hayUrls
                ? 'Entrá para verlo'
                : 'Entrá a tu cuenta'
              : 'Creá una cuenta para guardarlo'}
          </span>
        </div>
        <div className="ingest__account">
          <p className="ingest__account-lead">
            {entrando
              ? hayUrls
                ? 'Entrá con tu cuenta y abrimos el plan de este lote.'
                : 'Entrá con tu cuenta y abrimos tu último plan guardado.'
              : 'Tu lote queda guardado en tu cuenta, así podés volver a mirarlo desde cualquier dispositivo.'}
          </p>

          {!entrando ? (
            <div className="field">
              <label htmlFor="cuenta-nombre">Nombre</label>
              <input
                id="cuenta-nombre"
                name="nombre"
                type="text"
                required
                autoComplete="name"
                placeholder="Cómo te llamás"
                defaultValue={cuenta.nombre}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="cuenta-email">Correo</label>
            <input
              id="cuenta-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="vos@ejemplo.com"
              defaultValue={cuenta.email}
              ref={emailRef}
            />
          </div>
          <div className="field">
            <label htmlFor="cuenta-password">Contraseña</label>
            <input
              id="cuenta-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={entrando ? 'current-password' : 'new-password'}
              placeholder={entrando ? 'Tu contraseña' : 'mínimo 8 caracteres'}
              defaultValue={cuenta.password}
            />
          </div>

          {!entrando ? (
            <div className="field">
              <label htmlFor="cuenta-birth">Fecha de nacimiento</label>
              <input
                id="cuenta-birth"
                name="birthDate"
                type="date"
                required
                autoComplete="bday"
                defaultValue={cuenta.birthDate}
              />
            </div>
          ) : null}

          {error ? (
            <p className="ingest__error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className="cuenta__switch"
            onClick={() => {
              setRecuperar({ abierto: false, enviando: false, aviso: null });
              setState({
                kind: 'needs-account',
                cuenta: { ...cuenta, password: '' },
                modo: entrando ? 'crear' : 'entrar',
              });
            }}
          >
            {entrando
              ? 'No tengo cuenta: crear una'
              : 'Ya tengo cuenta: entrar'}
          </button>

          {entrando ? (
            <div className="recuperar">
              <button
                type="button"
                className="cuenta__switch"
                onClick={() =>
                  setRecuperar((r) => ({
                    ...r,
                    abierto: !r.abierto,
                    aviso: r.abierto ? null : r.aviso,
                  }))
                }
                aria-expanded={recuperar.abierto}
              >
                ¿Olvidaste tu contraseña?
              </button>

              {recuperar.abierto ? (
                <div className="recuperar__box">
                  <p className="recuperar__text">
                    Escribí tu correo arriba y te mandamos un enlace para elegir
                    una nueva. El enlace vence en 1 hora y sirve una sola vez.
                  </p>

                  {recuperar.aviso ? (
                    <p
                      className={`recuperar__aviso is-${recuperar.aviso.tipo}`}
                      role={recuperar.aviso.tipo === 'error' ? 'alert' : 'status'}
                    >
                      {recuperar.aviso.texto}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="cuenta__action"
                    onClick={() => void pedirEnlace()}
                    disabled={recuperar.enviando}
                  >
                    {recuperar.enviando ? 'Pidiendo el enlace…' : 'Mandame el enlace'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="ingest__foot">
          <span className="ingest__gets">
            <b>Vas a obtener:</b> el tipo de trabajo que comparten, los temas que lo
            cubren y por cuál empezar.
          </span>
          <button className="btn btn--ink btn--caustic" type="submit">
            {entrando ? 'Entrar y ver mi plan' : 'Crear cuenta y ver mi plan'}
          </button>
        </div>
      </form>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Paso 1: pegar el lote                                             */
  /* ---------------------------------------------------------------- */
  const lista = parseUrls(urls);
  const overflow = lista.length > MAX_URLS;
  const enCurso = state.kind === 'working';

  return (
    <>
    <form
      className="ingest"
      onSubmit={(e) => {
        e.preventDefault();
        if (!API_CONFIGURADA) {
          setState({ kind: 'error', message: SIN_API });
          return;
        }
        if (lista.length === 0) {
          setState({ kind: 'error', message: 'Pegá al menos una URL de oferta.' });
          return;
        }
        guardarUrlsPegadas(lista);

        // Si ya hay sesión, no se vuelve a pedir cuenta: se analiza directo.
        if (leerSesion()) {
          void analizarConSesion(lista);
          return;
        }

        setState({ kind: 'needs-account', cuenta: CUENTA_VACIA, modo: 'crear' });
      }}
    >
      <div className="ingest__head">
        <span>Ofertas (URL)</span>
        <span>Una por línea · pegá las tuyas</span>
      </div>
      <div className="ingest__body">
        <label className="sr-only" htmlFor="lote-urls">
          URLs de las ofertas, una por línea
        </label>
        <textarea
          id="lote-urls"
          className="ingest__textarea"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={EXAMPLE}
          rows={5}
          spellCheck={false}
        />
        {overflow ? (
          <p className="ingest__notice" role="status">
            Solo analizamos las primeras {MAX_URLS} ofertas de este lote.
          </p>
        ) : null}
      </div>
      <div className="ingest__foot">
        <span className="ingest__gets">
          <b>Vas a obtener:</b> el tipo de trabajo que comparten, los temas que lo
          cubren y por cuál empezar.
        </span>
        <button className="btn btn--ink btn--caustic" type="submit" disabled={enCurso}>
          {enCurso ? 'Leyendo…' : 'Ver mi plan'}
        </button>
      </div>
      {state.kind === 'working' ? (
        <p className="ingest__notice" role="status">
          Analizando {state.hechos} de {state.total}…
        </p>
      ) : null}
      {aviso ? (
        <p className="ingest__notice" role="status">
          {aviso}
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p className="ingest__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
    <p className="hero__micro">
      Tu lote queda guardado en tu cuenta: confirmás el correo y lo abrís desde
      cualquier dispositivo
    </p>
    </>
  );
}
