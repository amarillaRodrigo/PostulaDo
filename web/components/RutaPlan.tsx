'use client';

import { useEffect, useState } from 'react';
import { pedirRuta, type NodoRuta, type Ruta } from '@/lib/api';
import { colorDeTema } from '@/lib/themes';

/**
 * LA RUTA DEL OFICIO, VISTA
 *
 * El plan dice qué falta; esto dice por dónde empezar. Un flujo vertical: los
 * temas en orden de estudio, cada uno con las ofertas que lo piden (el mismo
 * denominador del plan), lo que conviene aprender antes y lo que destraba,
 * y fuentes reales para empezar. Sin OpenAI y sin nada generado: el orden es
 * determinista y los datos son los del corpus del usuario.
 *
 * El progreso vive en localStorage: es la opinión del usuario sobre su propia
 * práctica, no dato de la cuenta. Si cambia de dispositivo, la ruta se
 * recalcula igual y arranca de nuevo — como un cuaderno de estudio.
 */

export type ProgresoNodo = 'pendiente' | 'en-curso' | 'lista';

const ETIQUETA: Record<ProgresoNodo, string> = {
  pendiente: 'Pendiente',
  'en-curso': 'En curso',
  lista: 'Lista',
};

const SIGUIENTE: Record<ProgresoNodo, ProgresoNodo> = {
  pendiente: 'en-curso',
  'en-curso': 'lista',
  lista: 'pendiente',
};

const CLAVE_PROGRESO = 'postulado.ruta-progreso';
const CLAVE_PASOS = 'postulado.ruta-pasos';

type Progreso = Record<string, ProgresoNodo>;

/**
 * El avance de los pasos del plan, por nodo: guardar los índices hechos es
 * simple y tolera que el plan crezca (los índices viejos siguen siendo viejos,
 * los nuevos aparecen sin marcar).
 */
type PasosHechos = Record<string, number[]>;

function leerProgreso(): Progreso {
  try {
    const crudo = localStorage.getItem(CLAVE_PROGRESO);
    if (!crudo) return {};

    const objeto = JSON.parse(crudo) as Progreso;
    // Solo los valores que la UI sabe renderizar: el resto es historia vieja.
    return Object.fromEntries(
      Object.entries(objeto).filter(([, v]) => v in ETIQUETA) as [
        string,
        ProgresoNodo,
      ][],
    );
  } catch {
    return {};
  }
}

function leerPasosHechos(): PasosHechos {
  try {
    const crudo = localStorage.getItem(CLAVE_PASOS);
    if (!crudo) return {};

    const objeto = JSON.parse(crudo) as PasosHechos;
    // Solo listas de números: lo demás es historia vieja o ruido.
    return Object.fromEntries(
      Object.entries(objeto).filter(
        ([, v]) => Array.isArray(v) && v.every((x) => typeof x === 'number'),
      ),
    ) as PasosHechos;
  } catch {
    return {};
  }
}

/**
 * `ids === null` pregunta la ruta del corpus entero; con ids, la del lote
 * abierto. Es la convención exacta del plan.
 */
export function RutaPlan({ ids }: { ids: string[] | null }) {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [falla, setFalla] = useState(false);
  const [progreso, setProgreso] = useState<Progreso>({});
  const [pasos, setPasos] = useState<PasosHechos>({});

  useEffect(() => {
    setProgreso(leerProgreso());
    setPasos(leerPasosHechos());
  }, []);

  function siguienteNodo(key: string) {
    const pro = progreso[key] ?? 'pendiente';
    const nuevo = { ...progreso, [key]: SIGUIENTE[pro] };

    setProgreso(nuevo);
    localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(nuevo));
  }

  function alternarPaso(key: string, index: number) {
    const hechos = new Set(pasos[key] ?? []);
    if (hechos.has(index)) hechos.delete(index);
    else hechos.add(index);

    const nuevo = { ...pasos, [key]: [...hechos].sort((a, b) => a - b) };
    setPasos(nuevo);
    localStorage.setItem(CLAVE_PASOS, JSON.stringify(nuevo));
  }

  /** El primer paso sin hacer: la única acción priorizada del nodo. */
  const proximoPaso = (key: string): number => {
    const hechos = new Set(pasos[key] ?? []);
    const total = ruta?.nodos.find((n) => n.key === key)?.plan.pasos.length ?? 0;
    for (let i = 0; i < total; i++) if (!hechos.has(i)) return i;
    return -1;
  };

  // La ruta se pide solo la primera vez que se abre: después queda viva
  // hasta que la pestaña se recargue (igual que el detalle del lote).
  function cargandoRuta(siSeAbre: boolean) {
    if (!siSeAbre || ruta || falla) return;

    void pedirRuta(ids)
      .then((r) => {
        if (r) setRuta(r);
        else setFalla(true);
      })
      .catch(() => setFalla(true));
  }

  function textoFila(nodo: NodoRuta, total: number): string {
    if (!nodo.presenteEnCorpus) {
      return 'No aparece en tus ofertas: entra porque hace falta antes.';
    }

    const oferta = total === 1 ? 'oferta' : 'ofertas';
    const conNodos = nodo.piden === 1 ? '1' : String(nodo.piden);

    return `Aparece en ${conNodos} de tus ${total} ${oferta}`;
  }

  const progresoDe = (nodo: NodoRuta) => progreso[nodo.key] ?? 'pendiente';
  const labelDe = new Map(
    (ruta?.nodos ?? []).map((n) => [n.key, n.label] as const),
  );
  const listasCount = ruta
    ? ruta.nodos.filter(
        (n) => progresoDe(n) === 'lista',
      ).length
    : 0;

  return (
    <details
      className="ruta"
      onToggle={(e) => {
        const seAbrio = (e.currentTarget as HTMLDetailsElement).open;
        cargandoRuta(seAbrio);
      }}
    >
      <summary>
        <span>La ruta, en orden de estudio</span>
        {listasCount > 0 ? (
          <span className="ruta__progreso">
            {listasCount} {listasCount === 1 ? 'lista' : 'listas'}
          </span>
        ) : null}
      </summary>

      {falla ? (
        <p className="ruta__aviso">
          No pudimos traer la ruta. Probá de nuevo en un rato.
        </p>
      ) : null}

      {!ruta && !falla ? (
        <p className="ruta__aviso">Leyendo el oficio que pide tu cuenta…</p>
      ) : null}

      {ruta && ruta.nodos.length === 0 ? (
        <p className="ruta__aviso">
          Tu plan todavía no tiene temas ordenables. Agregá ofertas y la ruta
          se arma con lo que piden.
        </p>
      ) : null}

      {ruta && ruta.nodos.length > 0 ? (
        <>
          <p className="ruta__nota">
            El orden sale de qué tema necesita qué otro, no de un ranking
            inventado. Cuánto lo pide el mercado sale del mismo denominador
            del plan: {ruta.totalOfertasAnalizadas}{' '}
            {ruta.totalOfertasAnalizadas === 1 ? 'oferta' : 'ofertas'}
            {ruta.ecosistema ? ` · ${ruta.ecosistema}` : ''}.
          </p>

          <ol className="ruta__lista">
            {ruta.nodos.map((nodo) => {
              const pro = progresoDe(nodo);
              const claseProgreso =
                pro === 'lista'
                  ? ' is-lista'
                  : pro === 'en-curso'
                  ? ' is-curso'
                  : '';

              return (
                <li
                  key={nodo.key}
                  className={`ruta__nodo${claseProgreso}${nodo.empiezaAca ? ' is-raiz' : ''}${
                    nodo.presenteEnCorpus ? '' : ' is-ghost'
                  }`}
                >
                  <span
                    className="ruta__punto"
                    style={{ background: colorDeTema(nodo.key) }}
                    aria-hidden="true"
                  />
                  <div className="ruta__caja">
                    <div className="ruta__caja-top">
                      <span className="ruta__label">{nodo.label}</span>
                      {nodo.empiezaAca && nodo.presenteEnCorpus ? (
                        <span className="ruta__badge">Empezá acá</span>
                      ) : null}
                      <span className="ruta__cobertura">
                        {nodo.cobertura}%
                      </span>
                      <button
                        type="button"
                        className={`ruta__estado${claseProgreso}`}
                        aria-label={`Progreso de ${nodo.label}: ${ETIQUETA[pro]}. Click para pasar a ${ETIQUETA[SIGUIENTE[pro]].toLowerCase()}.`}
                        onClick={() => siguienteNodo(nodo.key)}
                      >
                        {ETIQUETA[pro]}
                      </button>
                    </div>

                    <div className="ruta__meta">
                      {textoFila(nodo, ruta.totalOfertasAnalizadas)} ·{' '}
                      {nodo.summary}
                    </div>

                    <div className="ruta__plan">
                      <div className="ruta__plan-objetivo">
                        <span className="ruta__plan-titulo">El entregable:</span>{' '}
                        {nodo.plan.objetivo}{' '}
                        <span className="ruta__plan-horas">
                          ≈ {nodo.plan.horas} h en total
                        </span>
                      </div>

                      <ol className="ruta__pasos">
                        {nodo.plan.pasos.map((paso, index) => {
                          const hecho =
                            (pasos[nodo.key] ?? []).includes(index);
                          const esProximo = proximoPaso(nodo.key) === index;

                          return (
                            <li
                              key={index}
                              className={`ruta__paso${hecho ? ' is-hecho' : ''}${
                                esProximo ? ' is-proximo' : ''
                              }`}
                            >
                              <button
                                type="button"
                                className="ruta__paso-boton"
                                aria-pressed={hecho}
                                aria-label={`Paso ${index + 1} de ${nodo.label}${
                                  hecho ? ': hecho.' : ': péndiente.'
                                }`}
                                onClick={() => alternarPaso(nodo.key, index)}
                              >
                                <span className="ruta__paso-marca" aria-hidden="true">
                                  {hecho ? '✓' : String(index + 1)}
                                </span>
                                <span className="ruta__paso-texto">
                                  {esProximo && !hecho ? (
                                    <strong className="ruta__paso-siguiente">
                                      Tu próxima acción:{' '}
                                    </strong>
                                  ) : null}
                                  {paso}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {nodo.prerequisitos.length > 0 ? (
                      <div className="ruta__relacion">
                        Conviene antes:{' '}
                        <b>
                          {nodo.prerequisitos
                            .map((k) => labelDe.get(k) ?? k)
                            .join(' · ')}
                        </b>
                      </div>
                    ) : null}
                    {nodo.desbloquea.length > 0 ? (
                      <div className="ruta__relacion">
                        Te prepara para:{' '}
                        <b>
                          {nodo.desbloquea
                            .map((k) => labelDe.get(k) ?? k)
                            .join(' · ')}
                        </b>
                      </div>
                    ) : null}

                    <details className="ruta__fuentes-desplegable">
                      <summary>Dónde leer (docs de las alternativas)</summary>
                      <ul className="ruta__fuentes">
                        {nodo.fuentes.map((f) => (
                          <li key={f.url}>
                            <a href={f.url} target="_blank" rel="noreferrer">
                              {f.titulo}
                            </a>
                            <span className="ruta__tipo"> · {f.tipo}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </details>
  );
}
