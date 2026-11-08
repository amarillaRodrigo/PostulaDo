import { armarRuta, FUENTES, PREREQUISITOS } from './ruta';
import { temaPorKey } from './taxonomy';

describe('ruta (orden de estudio del oficio)', () => {
  describe('armarRuta', () => {
    it('pone los prerequisitos antes de lo que dependen de ellos', () => {
      // Corpus típico de Cloud Engineering: la ruta tiene que dejar backend,
      // testing y containers antes de ci, y ci antes de cloud.
      const conteo = new Map([
        ['cloud', 5],
        ['ci', 4],
        ['containers', 3],
        ['testing', 2],
        ['backend', 3],
      ]);

      const ruta = armarRuta(conteo, 6, 'Cloud Engineering');

      const posicion = new Map(ruta.nodos.map((n, i) => [n.key, i]));
      const p = (k: string) => posicion.get(k) as number;

      expect(p('backend')).toBeLessThan(p('containers'));
      expect(p('containers')).toBeLessThan(p('ci'));
      expect(p('testing')).toBeLessThan(p('ci'));
      expect(p('ci')).toBeLessThan(p('cloud'));
    });

    it('trae los prerequisitos que nadie pidió, con cobertura 0 y honestos', () => {
      // Ninguna oferta pidió_frontend, pero testing lo necesita.
      const conteo = new Map([
        ['testing', 2],
        ['backend', 3],
      ]);

      const ruta = armarRuta(conteo, 4, 'Ingeniería de Calidad');

      const frontend = ruta.nodos.find((n) => n.key === 'frontend');
      expect(frontend).toBeDefined();
      expect(frontend?.presenteEnCorpus).toBe(false);
      expect(frontend?.cobertura).toBe(0);
      expect(frontend?.piden).toBe(0);
    });

    it('desempata entre raíces por demanda y después por nombre', () => {
      const conteo = new Map([
        ['backend', 2],
        ['frontend', 3],
      ]);

      const ruta = armarRuta(conteo, 5, null);

      expect(ruta.nodos[0].key).toBe('frontend');
      expect(ruta.nodos[1].key).toBe('backend');
    });

    it('marca empezarAca solo en los temas sin prerequisitos del grafo', () => {
      const conteo = new Map([
        ['cloud', 1],
        ['data', 1],
      ]);

      const ruta = armarRuta(conteo, 2, 'Backend Engineering');

      const conMarca = ruta.nodos.filter((n) => n.empiezaAca === true);
      expect(new Set(conMarca.map((n) => n.key))).toEqual(
        new Set(['backend', 'frontend']),
      );

      const cloud = ruta.nodos.find((n) => n.key === 'cloud');
      expect(cloud?.empiezaAca).toBe(false);
      expect(cloud?.prerequisitos).toEqual(
        expect.arrayContaining(['ci', 'containers']),
      );
    });

    it('dice qué desbloquea cada tema dentro de la ruta', () => {
      const conteo = new Map([
        ['containers', 2],
        ['cloud', 2],
        ['ci', 2],
      ]);

      const ruta = armarRuta(conteo, 2, 'Ingeniería de Plataforma');

      const containers = ruta.nodos.find((n) => n.key === 'containers');
      expect(containers?.desbloquea).toEqual(
        expect.arrayContaining(['ci', 'cloud']),
      );
    });

    it('trae las fuentes curadas de cada tema presente', () => {
      const conteo = new Map([['data', 1]]);

      const ruta = armarRuta(conteo, 1, null);

      const data = ruta.nodos.find((n) => n.key === 'data');
      expect(data?.fuentes.length).toBeGreaterThan(0);
      expect(FUENTES.data).toEqual(data?.fuentes);
    });

    it('con un corpus vacío, la ruta no promete nada', () => {
      const ruta = armarRuta(new Map(), 0, null);

      expect(ruta.nodos).toEqual([]);
      expect(ruta.totalOfertasAnalizadas).toBe(0);
    });

    it('los prerequisitos versionados no forman un ciclo y usan temas reales', () => {
      for (const [key, prereqs] of Object.entries(PREREQUISITOS)) {
        expect(temaPorKey(key)).toBeDefined();

        for (const p of prereqs) {
          expect(temaPorKey(p)).toBeDefined();
        }
      }

      // Con todos los temas y demanda uniforme, el orden tiene que resolver
      // sin tirar el error del ciclo.
      const todos = new Map(Object.keys(PREREQUISITOS).map((k) => [k, 1]));
      expect(() =>
        armarRuta(todos, Object.keys(todos).length, null),
      ).not.toThrow();
    });
  });
});
