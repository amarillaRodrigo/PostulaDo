'use client';

import { useEffect, useState } from 'react';
import { colorDeTema } from '@/lib/themes';
import {
  abrirLote,
  analizarLote,
  API_CONFIGURADA,
  borrarSesion,
  crearCuenta,
  entrarCuenta,
  guardarSesion,
  leerSesion,
  recuperarPlan,
  SIN_API,
  type LoteGuardado,
  type Resultado,
  type Sesion,
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

function aSesionGuardada(sesion: Sesion, ids: string[], loteId: string | null): SesionGuardada {
  return {
    token: sesion.token,
    email: sesion.usuario.email,
    emailVerificado: Boolean(sesion.usuario.emailVerifiedAt),
    ids,
    loteId,
  };
}

export function LoteForm() {
  const [urls, setUrls] = useState('');
  const [state, setState] = useState<Estado>({ kind: 'idle' });

  // Al volver (F5, otra pestaña, otro día) se retoma el último lote. Se hace
  // en un efecto para no romper la hidratación del export estático.
  useEffect(() => {
    const pegadas = leerUrlsPegadas();
    if (pegadas) setUrls(pegadas);

    const guardada = leerSesion();
    if (!guardada) return;

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

  async function correr(
    cuenta: Cuenta,
    modo: Modo,
    origen: 'lote' | 'cuenta' = 'lote',
  ) {
    const list = parseUrls(urls);
    if (list.length === 0) {
      setState({ kind: 'error', message: 'Pegá al menos una URL de oferta.' });
      return;
    }

    setState({ kind: 'working', hechos: 0, total: list.length });
    guardarUrlsPegadas(list);

    try {
      const sesion =
        modo === 'entrar'
          ? await entrarCuenta(cuenta.email.trim(), cuenta.password)
          : await crearCuenta(cuenta);

      const { resultado, ids, loteId, fallidas } = await analizarLote(
        list,
        sesion,
        (hechos, total) => setState({ kind: 'working', hechos, total }),
      );

      setState({
        kind: 'done',
        result: resultado,
        sesion: aSesionGuardada(sesion, ids, loteId),
        fallidas,
        emailEnviado: sesion.emailEnviado,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No pudimos analizar tus ofertas.';
      // Si el problema fue la cuenta, se vuelve al paso de la cuenta con lo
      // que la persona ya había escrito, no al textarea vacío.
      if (origen === 'cuenta') {
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
      } else {
        setState({ kind: 'error', message });
      }
    }
  }

  async function abrir(lote: LoteGuardado) {
    const guardada = leerSesion();
    if (!guardada) {
      setState({ kind: 'idle' });
      return;
    }

    setState({ kind: 'restoring', texto: 'Abriendo ese lote…' });

    const result = await abrirLote(guardada.token, lote.ids);

    if (!result) {
      setState({
        kind: 'error',
        message: 'No pudimos abrir ese lote. Probá de nuevo en un rato.',
      });
      return;
    }

    const actualizada: SesionGuardada = {
      ...guardada,
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
  }

  function salir() {
    borrarSesion();
    borrarUrlsPegadas();
    setUrls('');
    setState({ kind: 'idle' });
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
          <button className="ingest__restart" type="button" onClick={salir}>
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

    return (
      <form className="ingest" onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        correr(
          {
            nombre: String(form.get('nombre') ?? ''),
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
            birthDate: String(form.get('birthDate') ?? ''),
          },
          modo,
          'cuenta',
        );
      }}>
        <div className="ingest__head">
          <span>Cargamos tu lote</span>
          <span>
            {entrando ? 'Entrá para verlo' : 'Creá una cuenta para guardarlo'}
          </span>
        </div>
        <div className="ingest__account">
          <p className="ingest__account-lead">
            {entrando
              ? 'Entrá con tu cuenta y abrimos el plan de este lote.'
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
            onClick={() =>
              setState({
                kind: 'needs-account',
                cuenta: { ...cuenta, password: '' },
                modo: entrando ? 'crear' : 'entrar',
              })
            }
          >
            {entrando
              ? 'No tengo cuenta: crear una'
              : 'Ya tengo cuenta: entrar'}
          </button>
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
    <form
      className="ingest"
      onSubmit={(e) => {
        e.preventDefault();
        if (!API_CONFIGURADA) {
          setState({ kind: 'error', message: SIN_API });
          return;
        }
        guardarUrlsPegadas(lista);
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
      {state.kind === 'error' ? (
        <p className="ingest__error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
