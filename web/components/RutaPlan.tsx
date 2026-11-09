'use client';

import { useEffect, useRef, useState } from 'react';
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
 * LA RUTA ES LA LISTA. Antes el panel mostraba los mismos ocho temas dos
 * veces: una tabla ordenada por porcentaje (un ranking) y la ruta, ordenada
 * por topología (no un ranking). Dos órdenes y dos lenguas para la misma
 * pregunta. Ahora hay una sola lista: la de la ruta, con la barra de
 * cobertura de cada nodo y su denominador al lado. Arriba, una línea guía
 * dice por dónde empezar; abajo, el porqué del orden.
 *
 * LA PRÓXIMA ACCIÓN ES UNA SOLA. Antes cada nodo marcaba su primer paso sin
 * hacer con la banda de salvia y el rótulo "Tu próxima acción": ocho bandas
 * iguales al mismo tiempo, y ocho veces la misma frase en el DOM —un lector
 * de pantalla los oía todos—. Ahora la banda marca un paso en toda la ruta,
 * el primero sin hacer del nodo que toca; los demás nodos muestran sus pasos
 * en estado normal. Un nodo terminado no muestra seis renglones tachados:
 * dice "6 de 6 pasos". Y la salvia es de una sola cosa en este panel: el
 * marcador de la acción que toca, nada más.
 *
 * En reposo la ruta es una tabla de ocho filas de una línea cada una: punto
 * del tema, número, título, barra, cobertura con su denominador y estado. La
 * ruta entera entra en una pantalla y se lee de un vistazo. Sólo el nodo que
 * hay que tacklear está desplegado —con su plan completo— y abrir otro lo
 * colapsa: un pliegue por vez, como el temario de un curso.
 *
 * LA RUTA CUENTA EN UNA SOLA LENGUA. Los pasos se numeran a lo largo de todo
 * el camino —7, 8, 9…—, no se reinician en cada nodo: antes la pantalla
 * mostraba ocho "1" y sólo uno era el primero de verdad. El total vive con
 * el número: "Paso 7 de 37". Las horas también se agregan: la carga de la
 * ruta entera en el encabezado del panel y las que faltan al lado del nodo
 * que toca. Todo dato va en mono con cifras tabulares (DESIGN.md:181): las
 * horas son una medida, no una frase.
 *
 * DÓNDE ESTÁS, CON DENOMINADOR. El encabezado del panel lo dice en una
 * línea: "3 de 8 temas · 11 de 37 pasos · 34 h restantes". Antes sólo
 * aparecía "3 listas" cuando ya había algo listo, y sin denominador: un
 * número sin el total al lado no dice dónde estás.
 *
 * LA DEPENDENCIA ARRIBA, EL FUTURO ABAJO. "Conviene antes" estaba al pie de
 * un plan de 300px: lo que hay que tener antes se lee al abrir el nodo, no
 * después de leer seis pasos. "Te prepara para" habla del futuro y pesa lo
 * mismo que el entregable: baja a meta, en un segundo nivel, sin tinta
 * llena.
 * El estado se parte en dos controles: "empezar" pone el nodo en curso y
 * "marcar como lista" lo completa. Completar cuesta un click y deshacerlo
 * también — el ciclo de tres estados dejaba el "para atrás" a tres clicks.
 * Son toggles reales, no pastillas: fondo de papel, borde con presencia y
 * una forma propia (caja + check, punto lleno) además del texto.
 *
 * El progreso vive en localStorage: es la opinión del usuario sobre su propia
 * práctica, no dato de la cuenta. Si cambia de dispositivo, la ruta se
 * recalcula igual y arranca de nuevo — como un cuaderno de estudio. Por eso
 * la fila lo dice en una línea, sin prometer sincronización que no existe.
 */

export type ProgresoNodo = 'pendiente' | 'en-curso' | 'lista';

const ETIQUETA: Record<ProgresoNodo, string> = {
  pendiente: 'Pendiente',
  'en-curso': 'En curso',
  lista: 'Lista',
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

/** Un tramo del grafo, ya medido en píxeles dentro de la lista. */
type Conector = {
  id: string;
  d: string;
};

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
 * Los pasos hechos de un nodo: sólo los índices que su plan todavía tiene.
 * Si el plan crece, los índices viejos siguen viejos y los nuevos aparecen
 * sin marcar.
 */
function pasosHechosDe(nodo: NodoRuta, pasos: PasosHechos): number {
  const total = nodo.plan.pasos.length;
  return (pasos[nodo.key] ?? []).filter((i) => i >= 0 && i < total).length;
}

/**
 * El indicador del pliegue: dibujado, no un carácter de unicode. Apunta a la
 * derecha en reposo y gira cuando el nodo está abierto.
 */
function Chevron() {
  return (
    <svg
      className="ruta__chevron"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 3.75 L10.5 8 L6 12.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * El check del control de completar: dibujado, no un carácter de unicode.
 * Vive dentro de la caja del botón para que el estado tenga forma propia.
 */
function Check() {
  return (
    <svg
      className="ruta__check"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 8.25 L6.5 11.25 L12.5 4.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  /** El nodo desplegado: uno solo a la vez. */
  const [abierto, setAbierto] = useState<string | null>(null);
  /** Los tramos del grafo, medidos sobre la lista ya montada. */
  const [conectores, setConectores] = useState<Conector[]>([]);
  const listaRef = useRef<HTMLOListElement | null>(null);
  const puntosRef = useRef(new Map<string, HTMLSpanElement>());

  useEffect(() => {
    setProgreso(leerProgreso());
    setPasos(leerPasosHechos());
    // El panel abre con la ruta adentro: se pide sola y queda viva hasta que
    // se recargue la pestaña.
    cargandoRuta(true);
  }, []);

  /** Completar es binario: un click marca lista, otro click lo deshace. */
  function marcarLista(key: string) {
    const pro = progreso[key] ?? 'pendiente';
    const nuevo = {
      ...progreso,
      [key]: pro === 'lista' ? 'pendiente' : 'lista',
    } as Progreso;

    setProgreso(nuevo);
    localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(nuevo));

    // El nodo terminado deja de ser el que hay que tacklear: la ruta salta
    // al primero que sigue en pie.
    if (nuevo[key] === 'lista' && abierto === key) {
      const siguiente = ruta?.nodos.find(
        (n) => n.key !== key && (nuevo[n.key] ?? 'pendiente') !== 'lista',
      );
      if (siguiente) setAbierto(siguiente.key);
    }
  }

  /** "En curso" es un marcador aparte: no completa nada, sólo señala dónde
   *  estás. Encenderlo y apagarlo cuesta un click. */
  function marcarEnCurso(key: string) {
    const pro = progreso[key] ?? 'pendiente';
    const nuevo = {
      ...progreso,
      [key]: pro === 'en-curso' ? 'pendiente' : 'en-curso',
    } as Progreso;

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

  /**
   * El primer paso sin hacer de un nodo. Devuelve -1 cuando el nodo está
   * completo: no hay paso que marcar, sólo el resumen "6 de 6 pasos".
   */
  const proximoPaso = (key: string): number => {
    const hechos = new Set(pasos[key] ?? []);
    const total =
      ruta?.nodos.find((n) => n.key === key)?.plan.pasos.length ?? 0;
    for (let i = 0; i < total; i++) if (!hechos.has(i)) return i;
    return -1;
  };

  // La ruta se pide una sola vez: cuando llega, el nodo que toca se despliega
  // solo y después queda viva hasta que la pestaña se recargue (igual que el
  // detalle del lote). El ref evita el pedido doble del arranque —el panel
  // abre con la ruta adentro y el pliegue también avisa—.
  const enVuelo = useRef(false);

  function cargandoRuta(siSeAbre: boolean, forzar = false) {
    if (!siSeAbre || enVuelo.current) return;

    // Ya traida: reabrir el panel no es un reintento. El boton que aparece con
    // la falla si fuerza el pedido, asi el mensaje no es terminal.
    if (ruta && !forzar) return;

    enVuelo.current = true;

    void pedirRuta(ids)
      .then((r) => {
        if (r) {
          setRuta(r);
          setFalla(false);
        } else setFalla(true);
      })
      .catch(() => setFalla(true))
      .finally(() => {
        enVuelo.current = false;
      });
  }

  const progresoDe = (nodo: NodoRuta) => progreso[nodo.key] ?? 'pendiente';
  const labelDe = new Map(
    (ruta?.nodos ?? []).map((n) => [n.key, n.label] as const),
  );
  const totalTemas = ruta?.nodos.length ?? 0;
  const totalOfertas = ruta?.totalOfertasAnalizadas ?? 0;
  const unidadOferta = totalOfertas === 1 ? 'oferta' : 'ofertas';
  const temasListos = ruta
    ? ruta.nodos.filter((n) => progresoDe(n) === 'lista').length
    : 0;

  /**
   * LA NUMERACIÓN ES DE LA RUTA. Cada nodo sabe desde qué paso global
   * arranca: el primero de la ruta es el 1 y el último, el 37. Antes cada
   * nodo reiniciaba en 1 y la pantalla mostraba ocho "1".
   */
  const primerPasoDe = new Map<string, number>();
  let pasosAcumulados = 0;
  for (const nodo of ruta?.nodos ?? []) {
    primerPasoDe.set(nodo.key, pasosAcumulados);
    pasosAcumulados += nodo.plan.pasos.length;
  }
  const totalPasos = pasosAcumulados;

  /**
   * LAS HORAS DE UN NODO: las que quedan. Un nodo cuenta como terminado
   * cuando la persona lo marcó como lista o cuando sus pasos están todos
   * hechos: en los dos casos ya no hay carga. No se prorratean por paso —
   * repartir 20 horas entre seis pasos sería un dato inventado.
   */
  const horasRestantesDe = (nodo: NodoRuta): number => {
    if (progresoDe(nodo) === 'lista') return 0;
    const pasosDelNodo = nodo.plan.pasos.length;
    if (pasosDelNodo > 0 && pasosHechosDe(nodo, pasos) === pasosDelNodo) {
      return 0;
    }
    return nodo.plan.horas;
  };

  /** La carga de la ruta entera: la suma de los ocho planes. */
  const horasTotales =
    ruta?.nodos.reduce((total, n) => total + n.plan.horas, 0) ?? 0;

  /** Lo que queda de carga en toda la ruta. */
  const horasRestantes =
    ruta?.nodos.reduce((total, n) => total + horasRestantesDe(n), 0) ?? 0;

  /**
   * EL NODO QUE TOCA: el primero de la ruta que todavía no está listo. Es el
   * mismo criterio con el que se abre el pliegue, así que la línea guía y el
   * nodo desplegado nunca se contradicen.
   */
  const siguiente = ruta?.nodos.find((n) => progresoDe(n) !== 'lista') ?? null;
  const hayListas = temasListos > 0;
  const pasosHechos =
    ruta?.nodos.reduce((total, n) => total + pasosHechosDe(n, pasos), 0) ?? 0;

  /**
   * LA ACCIÓN GLOBAL: un solo paso en toda la ruta lleva la banda y el rótulo.
   * Es el primer paso sin hacer del nodo que toca —el mismo que nombra la
   * línea guía—, así que el panel da una respuesta y no ocho, y en el DOM hay
   * una sola frase "Tu próxima acción" en vez de una por nodo.
   */
  const accion = (() => {
    if (!siguiente) return null;
    const indice = proximoPaso(siguiente.key);
    return indice < 0 ? null : { key: siguiente.key, indice };
  })();

  /**
   * EL NODO QUE TOCA YA ESTÁ HECHO: sus pasos están todos marcados y lo que
   * falta es cerrarlo. El panel lo dice, en vez de seguir pidiendo que
   * empiece un tema que ya terminó.
   */
  const siguienteCerrado =
    siguiente !== null &&
    siguiente.plan.pasos.length > 0 &&
    pasosHechosDe(siguiente, pasos) === siguiente.plan.pasos.length;

  // El nodo abierto es el primero que no está listo: el que hay que tacklear
  // ahora. Si la persona abre otro, ese gana y el anterior se colapsa.
  useEffect(() => {
    if (!ruta || ruta.nodos.length === 0) return;

    setAbierto((previo) => {
      if (previo && ruta.nodos.some((n) => n.key === previo)) return previo;

      const siguiente = ruta.nodos.find(
        (n) => (progreso[n.key] ?? 'pendiente') !== 'lista',
      );
      return siguiente?.key ?? ruta.nodos[0].key;
    });
  }, [ruta, progreso]);

  // El grafo se mide sobre la lista real: las filas cambian de alto cuando un
  // nodo se abre, así que los conectores se recalculan con cada pliegue y con
  // cada cambio de ancho. El SVG es decorativo; el texto de cada nodo sigue
  // diciendo "Necesita" y "Te prepara para".
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || !ruta) {
      setConectores([]);
      return;
    }

    let cuadro = 0;

    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const base = lista.getBoundingClientRect();
        if (base.width === 0 || base.height === 0) return;

        const posiciones = new Map<string, { x: number; y: number }>();
        for (const [key, punto] of puntosRef.current) {
          const caja = punto.getBoundingClientRect();
          posiciones.set(key, {
            x: caja.right - base.left,
            y: caja.top - base.top + caja.height / 2,
          });
        }

        const indiceDe = new Map(
          ruta.nodos.map((nodo, i) => [nodo.key, i] as const),
        );
        const tramos: Conector[] = [];
        let arista = 0;

        // La canaleta de las aristas se mide contra el ancho real del panel:
        // en un teléfono el carril no puede pasar por debajo del título.
        const baseCarril = Math.min(22, Math.max(18, base.width * 0.028));

        for (const nodo of ruta.nodos) {
          const destino = indiceDe.get(nodo.key) ?? 0;

          for (const pre of nodo.prerequisitos) {
            const desde = posiciones.get(pre);
            const hasta = posiciones.get(nodo.key);
            if (!desde || !hasta) continue;

            const salto = Math.abs(destino - (indiceDe.get(pre) ?? destino));
            // El carril vive en la canaleta izquierda: más lejos para los
            // saltos largos, alternado para que dos aristas no se pisen.
            const carril =
              baseCarril + Math.min(salto, 4) * 2 + (arista % 2) * 1.5;

            tramos.push({
              id: `${pre}-${nodo.key}`,
              d: `M ${desde.x} ${desde.y} C ${carril} ${desde.y}, ${carril} ${hasta.y}, ${hasta.x} ${hasta.y}`,
            });
            arista += 1;
          }
        }

        setConectores((previos) =>
          previos.length === tramos.length &&
          previos.every((tramo, i) => tramo.d === tramos[i].d)
            ? previos
            : tramos,
        );
      });
    };

    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(lista);
    window.addEventListener('resize', medir);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [ruta, abierto, progreso]);

  return (
    <details
      className="ruta"
      open
      onToggle={(e) => {
        const seAbrio = (e.currentTarget as HTMLDetailsElement).open;
        cargandoRuta(seAbrio);
      }}
    >
      <summary>
        <h3 className="ruta__titulo">La ruta, en orden de estudio</h3>
        {ruta ? (
          <span className="ruta__datos">
            {/* DÓNDE ESTÁS, CON SU DENOMINADOR: una línea, tres cuentas.
                Las horas que quedan son las de los nodos que todavía no
                están terminados. */}
            <span className="ruta__progreso">
              {temasListos} de {totalTemas}{' '}
              {totalTemas === 1 ? 'tema' : 'temas'} · {pasosHechos} de{' '}
              {totalPasos} {totalPasos === 1 ? 'paso' : 'pasos'} ·{' '}
              {horasRestantes} h restantes
            </span>
            {/* LA CARGA DE LA RUTA ENTERA: la suma de los ocho planes.
                El total es el denominador de lo que queda. */}
            <span className="ruta__carga">{horasTotales} h en total</span>
          </span>
        ) : null}
        <Chevron />
      </summary>

      {falla ? (
        <p className="ruta__aviso">
          No pudimos traer la ruta. Probá de nuevo en un rato.{' '}
          <button
            type="button"
            className="ruta__reintentar"
            onClick={() => {
              setFalla(false);
              cargandoRuta(true, true);
            }}
          >
            Probar de nuevo
          </button>
        </p>
      ) : null}

      {!ruta && !falla ? (
        <p className="ruta__aviso">Leyendo el oficio que pide tu cuenta…</p>
      ) : null}

      {ruta && ruta.nodos.length === 0 ? (
        <p className="ruta__aviso">
          Tu plan todavía no tiene temas ordenables. Agregá ofertas y la ruta se
          arma con lo que piden.
        </p>
      ) : null}

      {ruta && ruta.nodos.length > 0 ? (
        <>
          {/* LA LÍNEA GUÍA: la respuesta, arriba de todo. Un solo nodo, con
              su denominador al lado. Abajo está la lista completa. */}
          <p className="ruta__guia">
            {!siguiente ? (
              <>
                Ruta completa: los <span className="dato">{totalTemas}</span>{' '}
                temas ya están.
              </>
            ) : siguienteCerrado ? (
              <>
                <strong>{siguiente.label}</strong>:{' '}
                <span className="dato">
                  {pasosHechosDe(siguiente, pasos)} de{' '}
                  {siguiente.plan.pasos.length}
                </span>{' '}
                pasos hechos. Marcá el tema como lista para seguir.
              </>
            ) : siguiente.presenteEnCorpus ? (
              <>
                {hayListas ? 'Seguí con' : 'Empezá por'}{' '}
                <strong>{siguiente.label}</strong> — aparece en{' '}
                <span className="dato">
                  {siguiente.piden} de tus {totalOfertas}
                </span>{' '}
                {unidadOferta}.
              </>
            ) : (
              <>
                {hayListas ? 'Seguí con' : 'Empezá por'}{' '}
                <strong>{siguiente.label}</strong> — no te lo pide el mercado:
                entra porque otro tema lo necesita antes.
              </>
            )}
          </p>

          <p className="ruta__nota">
            El orden sale de qué tema necesita qué otro: primero lo que
            desbloquea a lo demás. Todo lo de esta ruta está medido sobre tus{' '}
            <span className="dato">{totalOfertas}</span> {unidadOferta}
            {ruta.ecosistema ? ` · ${ruta.ecosistema}` : ''}.
          </p>

          <p className="ruta__local">
            Tu progreso se guarda en este navegador, no en tu cuenta.
          </p>

          <div className="ruta__grafo-marco">
            <svg className="ruta__grafo" aria-hidden="true" focusable="false">
              {conectores.map((tramo) => (
                <path key={tramo.id} d={tramo.d} />
              ))}
            </svg>
            <ol className="ruta__lista" ref={listaRef}>
              {ruta.nodos.map((nodo, i) => {
                const pro = progresoDe(nodo);
                const claseProgreso =
                  pro === 'lista'
                    ? ' is-lista'
                    : pro === 'en-curso'
                      ? ' is-curso'
                      : '';
                // El nodo al que le toca: el que nombra la línea guía. Sólo
                // uno lleva la marca, así el panel no da dos respuestas.
                const esElSiguiente = siguiente?.key === nodo.key;

                // Los pasos del nodo, con su cuenta. Un nodo terminado no los
                // muestra tachados: dice cuántos son.
                const totalPasosNodo = nodo.plan.pasos.length;
                const hechosNodo = pasosHechosDe(nodo, pasos);
                const nodoCompleto =
                  totalPasosNodo > 0 && hechosNodo === totalPasosNodo;

                // El primer paso del nodo en la numeración de la ruta: el 7 si
                // los seis anteriores son de otros temas.
                const primerPaso = primerPasoDe.get(nodo.key) ?? 0;

                // Las horas que faltan de este tema. Sólo el nodo que toca
                // las muestra: es el dato que sirve para decidir el día.
                const horasDelNodo = horasRestantesDe(nodo);

                // EL PASO QUE TOCA: uno en toda la ruta. La banda y el rótulo
                // van con el primer paso sin hacer del nodo que toca; el resto
                // de los pasos, de todos los nodos, en estado normal.
                const filasDePasos = nodo.plan.pasos.map((paso, index) => {
                  const hecho = (pasos[nodo.key] ?? []).includes(index);
                  const esProximo =
                    accion !== null &&
                    accion.key === nodo.key &&
                    accion.indice === index;
                  // El número que se ve es el de la ruta: el 7 de 37, no el
                  // 1 de este nodo.
                  const numero = primerPaso + index + 1;

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
                        aria-current={esProximo ? 'step' : undefined}
                        aria-label={
                          esProximo
                            ? `Paso ${numero} de ${totalPasos}, en ${nodo.label}: tu próxima acción.`
                            : `Paso ${numero} de ${totalPasos}, en ${nodo.label}: ${
                                hecho ? 'hecho.' : 'pendiente.'
                              }`
                        }
                        onClick={() => alternarPaso(nodo.key, index)}
                      >
                        <span className="ruta__paso-marca" aria-hidden="true">
                          {hecho ? <Check /> : String(numero)}
                        </span>
                        <span className="ruta__paso-texto">
                          {esProximo ? (
                            <strong className="ruta__paso-siguiente">
                              Tu próxima acción:{' '}
                            </strong>
                          ) : null}
                          {paso}
                        </span>
                      </button>
                    </li>
                  );
                });

                return (
                  <li
                    key={nodo.key}
                    className={`ruta__nodo${claseProgreso}${esElSiguiente ? ' is-raiz' : ''}${
                      nodo.presenteEnCorpus ? '' : ' is-ghost'
                    }`}
                  >
                    {/* EL PUNTO ES EL NODO DE PROCESO, no el tema: el color
                        del tema vive en el swatch de la cobertura y en su
                        barra. Acá el marcador es de la ruta —tinta— y sólo
                        la terracota señala el nodo que toca. */}
                    <span
                      ref={(punto) => {
                        if (punto) puntosRef.current.set(nodo.key, punto);
                        else puntosRef.current.delete(nodo.key);
                      }}
                      className="ruta__punto"
                      aria-hidden="true"
                    />

                    <details className="ruta__caja" open={abierto === nodo.key}>
                      <summary
                        className="ruta__fila"
                        aria-current={pro === 'en-curso' ? 'step' : undefined}
                        onClick={(e) => {
                          // El estado maneja el pliegue: si el navegador también
                          // lo alterna, el nodo se abre y se cierra en el mismo
                          // clic.
                          e.preventDefault();
                          setAbierto((previo) =>
                            previo === nodo.key ? null : nodo.key,
                          );
                        }}
                      >
                        <span className="ruta__numero" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="ruta__label">
                          <span className="ruta__nombre">{nodo.label}</span>
                          {nodo.presenteEnCorpus ? null : (
                            <span className="ruta__apoyo">De apoyo</span>
                          )}
                          {esElSiguiente && nodo.presenteEnCorpus ? (
                            <span className="ruta__badge">
                              {siguienteCerrado
                                ? 'Para cerrar'
                                : nodo.empiezaAca && !hayListas
                                  ? 'Empezá acá'
                                  : 'Ahora'}
                            </span>
                          ) : null}

                          {/* LA BARRA DE COBERTURA: la misma pista de la
                              grilla de la landing, con el color del tema.
                              Va bajo el título para que las ocho barras
                              formen una columna y se comparen de un
                              vistazo. */}
                          <span className="bar ruta__barra" aria-hidden="true">
                            <i
                              style={{
                                width: `${nodo.cobertura}%`,
                                background: colorDeTema(nodo.key),
                              }}
                            />
                          </span>
                        </span>

                        {/* EL PORCENTAJE CON SU DENOMINADOR: la misma lengua
                            que la barra y que el resto del panel. Debajo, las
                            horas que faltan del nodo que toca: la carga vive
                            en la columna de datos, no en el título. */}
                        <span className="ruta__cobertura">
                          <span className="ruta__pct">
                            {/* EL COLOR DEL TEMA, EN UN SWATCH DE 10px: el
                                acento de un tema se marca junto a su
                                porcentaje, no con una franja en el borde
                                (DESIGN.md:233). El punto de la línea queda
                                como marcador de proceso. */}
                            <span
                              className="ruta__swatch"
                              style={{ background: colorDeTema(nodo.key) }}
                              aria-hidden="true"
                            />
                            {nodo.cobertura}%
                            <span className="ruta__denom">
                              {' '}
                              · {nodo.piden}/{totalOfertas}
                            </span>
                          </span>
                          {esElSiguiente ? (
                            <span className="ruta__carga-nodo">
                              {horasDelNodo > 0 ? 'faltan ' : ''}
                              <span className="dato">{horasDelNodo} h</span>
                            </span>
                          ) : null}
                        </span>
                        <span className="ruta__acciones">
                          {pro !== 'lista' ? (
                            <button
                              type="button"
                              className="ruta__en-curso"
                              aria-pressed={pro === 'en-curso'}
                              aria-label={
                                pro === 'en-curso'
                                  ? `Quitar la marca de en curso de ${nodo.label}.`
                                  : `Poner ${nodo.label} en curso.`
                              }
                              onClick={(e) => {
                                // El botón cambia el estado del nodo; no lo pliega.
                                e.preventDefault();
                                e.stopPropagation();
                                marcarEnCurso(nodo.key);
                              }}
                            >
                              <span
                                className="ruta__en-curso-punto"
                                aria-hidden="true"
                              />
                              {pro === 'en-curso' ? 'En curso' : 'Empezar'}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className="ruta__completar"
                            aria-pressed={pro === 'lista'}
                            aria-label={
                              pro === 'lista'
                                ? `${nodo.label}: lista. Click para marcarla pendiente.`
                                : `Marcar ${nodo.label} como lista.`
                            }
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              marcarLista(nodo.key);
                            }}
                          >
                            <span
                              className="ruta__completar-marca"
                              aria-hidden="true"
                            >
                              <Check />
                            </span>
                            {pro === 'lista' ? 'Lista' : 'Marcar como lista'}
                          </button>
                        </span>
                        <Chevron />
                      </summary>

                      <div className="ruta__cuerpo">
                        {/* LA DEPENDENCIA, EN LA CABECERA DEL NODO: lo que
                            hay que tener antes se lee al abrir el nodo, no
                            al pie de un plan de 300px. */}
                        {nodo.prerequisitos.length > 0 ? (
                          <p className="ruta__necesita">
                            <span className="ruta__necesita-rotulo">
                              Necesita:
                            </span>{' '}
                            <span className="ruta__necesita-temas">
                              {nodo.prerequisitos
                                .map((k) => labelDe.get(k) ?? k)
                                .join(' · ')}
                            </span>
                          </p>
                        ) : null}

                        {nodo.fuentes.length > 0 ? (
                          <details className="ruta__fuentes-desplegable">
                            <summary>
                              <Chevron />
                              <span className="ruta__fuentes-rotulo">
                                Dónde leer
                              </span>
                              <span className="ruta__fuentes-cuenta">
                                {nodo.fuentes.length}{' '}
                                {nodo.fuentes.length === 1
                                  ? 'fuente'
                                  : 'fuentes'}
                              </span>
                            </summary>
                            <ul className="ruta__fuentes">
                              {nodo.fuentes.map((f) => (
                                <li key={f.url}>
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {f.titulo}
                                  </a>
                                  <span className="ruta__tipo">
                                    {' '}
                                    · {f.tipo}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}

                        {/* EL NODO EN UNA LÍNEA: por dónde se entra y qué es
                            el tema. Las alternativas van enteras: el plan las
                            cortaba a dos y dejaba el resto mudo. */}
                        <p className="ruta__meta">
                          {nodo.presenteEnCorpus ? null : (
                            <>
                              No aparece en tus ofertas: entra porque hace falta
                              antes.{' '}
                            </>
                          )}
                          <span className="ruta__meta-dato">
                            {(nodo.alternativas ?? []).join(' · ')}
                          </span>
                          {nodo.presenteEnCorpus ? (
                            <>
                              {' · '}
                              {nodo.summary}
                            </>
                          ) : null}
                        </p>

                        {/* "TE PREPARA PARA" ES META: habla del futuro y no
                            del trabajo de hoy. Baja a un segundo nivel, sin
                            tinta llena y sin robarle el peso al
                            entregable. */}
                        {nodo.desbloquea.length > 0 ? (
                          <p className="ruta__desbloquea">
                            Te prepara para:{' '}
                            {nodo.desbloquea
                              .map((k) => labelDe.get(k) ?? k)
                              .join(' · ')}
                          </p>
                        ) : null}

                        <div className="ruta__plan">
                          <div className="ruta__plan-objetivo">
                            <span className="ruta__plan-titulo">
                              El entregable:
                            </span>{' '}
                            {nodo.plan.objetivo}{' '}
                            <span className="ruta__plan-horas">
                              ≈ {nodo.plan.horas} h de trabajo
                            </span>
                          </div>

                          {/* LA NUMERACIÓN ES DE LA RUTA: estos pasos van del
                              7 al 12, no del 1 al 6. El total es el de los
                              37 pasos del camino. */}
                          {totalPasosNodo > 0 ? (
                            <p className="ruta__pasos-rango">
                              {totalPasosNodo === 1
                                ? `Paso ${primerPaso + 1} de ${totalPasos}`
                                : `Pasos ${primerPaso + 1}–${
                                    primerPaso + totalPasosNodo
                                  } de ${totalPasos}`}
                            </p>
                          ) : null}

                          {/* EL NODO TERMINADO: no seis renglones tachados, sino
                              la cuenta. Los pasos quedan debajo, en un pliegue,
                              por si hay que deshacer alguno. */}
                          {nodoCompleto ? (
                            <details className="ruta__pasos-cerrados">
                              <summary>
                                <Chevron />
                                <span className="ruta__pasos-cuenta">
                                  {hechosNodo} de {totalPasosNodo}
                                </span>{' '}
                                pasos
                              </summary>
                              <ol className="ruta__pasos">{filasDePasos}</ol>
                            </details>
                          ) : (
                            <ol className="ruta__pasos">{filasDePasos}</ol>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      ) : null}
    </details>
  );
}
