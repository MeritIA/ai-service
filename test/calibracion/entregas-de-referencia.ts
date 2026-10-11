import type { CriterioDeRubrica } from '../../src/evaluacion/dominio/contrato.js';

/**
 * Entregas de referencia para calibrar la calificacion (paquete 4.3).
 *
 * El Diccionario de la EDT pide, como tercer entregable del paquete, un
 * "conjunto de pruebas con entregas de referencia". Esto es ese conjunto.
 *
 * QUE ES CALIBRAR, Y QUE NO
 *
 * No se comprueba que el modelo saque un numero exacto: un modelo de lenguaje
 * no es determinista y una prueba que exija 82 fallaria el martes. Se comprueba
 * lo que si tiene que cumplirse siempre:
 *
 *   1. Los invariantes del contrato, en una respuesta REAL y no simulada: la
 *      nota es la suma ponderada, cada criterio trae evidencia, y los criterios
 *      son exactamente los de la rubrica, en su orden.
 *   2. Bandas amplias: una entrega que resuelve el ejercicio no puede sacar 20,
 *      y una que no tiene nada que ver no puede sacar 80.
 *   3. El ORDEN entre entregas, que es lo que de verdad usa un reclutador: la
 *      correcta por encima de la que incumple el enunciado, y esa por encima de
 *      la que no viene al caso.
 *   4. Que el desglose DISCRIMINA: una entrega correcta pero ilegible tiene que
 *      sacar mas en correccion que en claridad. Si el modelo pusiera la misma
 *      nota a los dos criterios, el desglose seria decorativo.
 *
 * SI UNA BANDA FALLA, LA PRIMERA PREGUNTA ES SI LA BANDA ESTA MAL. Son un
 * juicio del equipo sobre estas cinco entregas, no una verdad medida. La suite
 * imprime la tabla de notas justamente para poder revisarlas con datos.
 */

/** Un ejercicio pequeño y sin ambiguedad: lo que se califica es la rubrica. */
export const ENUNCIADO =
  'Implementa la funcion invertir(lista) que devuelva una lista NUEVA con los ' +
  'elementos en orden inverso, sin modificar la lista original. Tiene que ' +
  'funcionar tambien con la lista vacia.';

export const RUBRICA: readonly CriterioDeRubrica[] = [
  {
    nombre: 'Correccion funcional',
    descripcion:
      'Devuelve los elementos en orden inverso, NO modifica la lista original y ' +
      'funciona con la lista vacia.',
    peso: 70,
    escalaMaxima: 5,
  },
  {
    nombre: 'Claridad del codigo',
    descripcion:
      'Nombres descriptivos, estructura simple, y un comentario o docstring ' +
      'cuando aporta algo.',
    peso: 30,
    escalaMaxima: 5,
  },
];

export interface EntregaDeReferencia {
  readonly clave: string;
  /** Que se espera de ella y por que. Es la parte que un humano revisa. */
  readonly queMide: string;
  readonly archivos: readonly { ruta: string; contenido: string }[];
  /** Banda esperada de la nota final, de 0 a 100. Amplia a proposito. */
  readonly banda: { min: number; max: number };
}

export const ENTREGAS: readonly EntregaDeReferencia[] = [
  {
    clave: 'correcta',
    queMide: 'Resuelve el ejercicio completo y esta bien escrita. Es el techo de la escala.',
    banda: { min: 70, max: 100 },
    archivos: [
      {
        ruta: 'invertir.py',
        contenido: [
          'def invertir(lista: list) -> list:',
          '    """Devuelve una lista nueva con los elementos en orden inverso.',
          '',
          '    No modifica la lista recibida. Con la lista vacia devuelve [].',
          '    """',
          '    return lista[::-1]',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    clave: 'mutante',
    queMide:
      'Invierte, pero MODIFICA la lista original, que es lo unico que el enunciado ' +
      'prohibe expresamente. Mide si el modelo califica contra el enunciado o solo ' +
      'reconoce codigo que "parece" correcto.',
    banda: { min: 5, max: 60 },
    archivos: [
      {
        ruta: 'invertir.py',
        contenido: [
          'def invertir(lista: list) -> list:',
          '    """Invierte la lista."""',
          '    lista.reverse()',
          '    return lista',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    clave: 'falla_en_vacia',
    queMide:
      'Invierte bien cualquier lista con elementos, pero revienta con la lista ' +
      'vacia, que el enunciado pide explicitamente. Es el caso parcial.',
    banda: { min: 15, max: 75 },
    archivos: [
      {
        ruta: 'invertir.py',
        contenido: [
          'def invertir(lista):',
          '    # Se arranca desde el ultimo elemento.',
          '    resultado = [lista[0]]',
          '    for i in range(len(lista) - 2, -1, -1):',
          '        resultado.append(lista[i])',
          '    resultado[0] = lista[len(lista) - 1]',
          '    return resultado',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    clave: 'irrelevante',
    queMide:
      'No tiene nada que ver con el ejercicio. Es el piso de la escala: si esto no ' +
      'saca muy poco, la nota no significa nada.',
    banda: { min: 0, max: 25 },
    archivos: [
      {
        ruta: 'main.py',
        contenido: [
          'def saludar(nombre):',
          '    print("Hola " + nombre)',
          '',
          '',
          'saludar("mundo")',
          '',
        ].join('\n'),
      },
    ],
  },
  {
    clave: 'correcta_ilegible',
    queMide:
      'Funciona perfecto y esta escrita de forma ilegible. No se mira su nota, se ' +
      'mira que el DESGLOSE discrimine: correccion muy por encima de claridad.',
    banda: { min: 40, max: 95 },
    archivos: [
      {
        ruta: 'x.py',
        contenido: ['def f(l):', ' return l[::-1]', ''].join('\n'),
      },
    ],
  },
];
