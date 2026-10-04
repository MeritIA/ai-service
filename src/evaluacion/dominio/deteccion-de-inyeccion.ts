import { LISTA_NEGRA, VERSION_LISTA_NEGRA, type CategoriaDeAtaque } from './lista-negra.js';
import type { ArchivoDeEntrega } from './contrato.js';

/**
 * Deteccion de intentos de inyeccion en la entrega (paquete 4.2).
 *
 * Plan de Seguridad §6.1, capas 1 y 2: deteccion de subprompts ocultos con un
 * puntaje de riesgo, y filtrado por lista negra. La capa 3 (contexto aislado,
 * instruccion de defensa y validacion de la salida) ya existe desde el 4.4.
 *
 * NO BLOQUEA. MARCA.
 *
 * El riesgo que señala la propia ficha del paquete son los falsos positivos:
 * una entrega legitima que menciona "system prompt" porque el ejercicio trata
 * justamente de eso. Por eso el resultado es un **puntaje graduado con
 * banderas**, no un si o un no: la entrega se evalua igual, el reclutador ve la
 * marca y decide. Bloquear automaticamente convertiria un falso positivo en un
 * candidato descartado sin que nadie lo revise.
 *
 * QUE SE REGISTRA
 *
 * El codigo de la bandera, el archivo y cuantas veces. **Nunca el texto del
 * candidato**: si lograra manipular al modelo, ese texto es justo lo que no
 * debe acabar copiado en logs ni en la base de datos. El contenido original
 * sigue guardado en el almacenamiento de objetos, que es su sitio.
 */

/** Sube con cualquier cambio en patrones o pesos, igual que la lista negra. */
export const VERSION_REGLAS = '2026-10-04';

export type Riesgo = 'ninguno' | 'bajo' | 'medio' | 'alto';

export type CodigoDeBandera =
  CategoriaDeAtaque | 'texto_oculto' | 'delimitador_falso' | 'linea_desmesurada';

export interface Bandera {
  readonly codigo: CodigoDeBandera;
  /** Archivo donde aparecio, tal como lo envio el backend. */
  readonly archivo: string;
  readonly ocurrencias: number;
}

export interface AnalisisDeSeguridad {
  readonly riesgo: Riesgo;
  /** 0 a 100. Graduado a proposito: no es un semaforo de dos colores. */
  readonly puntaje: number;
  readonly banderas: readonly Bandera[];
  readonly versionReglas: string;
  readonly versionListaNegra: string;
}

/** Peso de cada bandera en el puntaje. */
const PESOS: Record<CodigoDeBandera, number> = {
  evasion_de_instrucciones: 40,
  peticion_de_nota: 35,
  cambio_de_rol: 30,
  texto_oculto: 30,
  mencion_del_sistema: 25,
  delimitador_falso: 20,
  exigencia_de_formato: 15,
  linea_desmesurada: 10,
};

export const UMBRAL_BAJO = 1;
export const UMBRAL_MEDIO = 30;
export const UMBRAL_ALTO = 60;

/** Mas alla de esto, una linea no es codigo: es ofuscacion. */
export const LONGITUD_MAXIMA_DE_LINEA = 5000;

/**
 * Caracteres invisibles con los que se esconden instrucciones: espacios de
 * ancho cero, marcas de direccion y controles. Se quitan antes de comparar,
 * porque "ig​nora" evade cualquier lista negra.
 */
const INVISIBLES = /[­​-‏‪-‮⁠-⁤﻿]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;

/** Lo que el modelo veria como un delimitador nuestro. */
const DELIMITADOR_FALSO = /<<<|>>>|ENTREGA-[0-9a-f]{4,}/gi;

export interface TextoSaneado {
  readonly texto: string;
  /** Si habia caracteres invisibles. Es una bandera por si misma. */
  readonly teniaInvisibles: boolean;
}

/**
 * Deja el texto como lo vera el modelo.
 *
 * Normaliza a NFKC para que las variantes tipograficas de una letra
 * ("ＩＧＮＯＲＡ", "ıgnora") no sirvan para esquivar la deteccion, y quita los
 * caracteres invisibles. No recorta ni reescribe lo que escribio el candidato:
 * solo elimina lo que no se puede ver.
 */
export function sanear(texto: string): TextoSaneado {
  const normalizado = texto.normalize('NFKC');
  const limpio = normalizado.replace(INVISIBLES, '');
  return { texto: limpio, teniaInvisibles: limpio !== normalizado };
}

/** Para comparar: minusculas y sin acentos. */
function paraComparar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function contar(aguja: string, pajar: string): number {
  if (!aguja) return 0;
  let desde = 0;
  let veces = 0;
  for (;;) {
    const i = pajar.indexOf(aguja, desde);
    if (i === -1) return veces;
    veces++;
    desde = i + aguja.length;
  }
}

/**
 * Analiza los archivos de la entrega y devuelve el texto saneado junto con su
 * analisis de seguridad.
 *
 * Se hace ANTES de armar el prompt, que es lo que pide el criterio del paquete:
 * "una entrega que contiene instrucciones de evasion conocidas es marcada antes
 * de llegar al modelo".
 */
export function analizarEntrega(archivos: readonly ArchivoDeEntrega[]): {
  archivos: ArchivoDeEntrega[];
  analisis: AnalisisDeSeguridad;
} {
  const banderas: Bandera[] = [];
  const saneados: ArchivoDeEntrega[] = [];

  for (const archivo of archivos) {
    const { texto, teniaInvisibles } = sanear(archivo.contenido);
    saneados.push({ ruta: archivo.ruta, contenido: texto });

    const comparable = paraComparar(texto);

    // Capa 2: lista negra, agrupada por categoria para no inflar el puntaje
    // con cinco variantes de la misma frase.
    const porCategoria = new Map<CategoriaDeAtaque, number>();
    for (const { termino, categoria } of LISTA_NEGRA) {
      const veces = contar(termino, comparable);
      if (veces > 0) porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + veces);
    }
    for (const [categoria, ocurrencias] of porCategoria) {
      banderas.push({ codigo: categoria, archivo: archivo.ruta, ocurrencias });
    }

    // Capa 1: señales que no son frases concretas.
    if (teniaInvisibles) {
      banderas.push({ codigo: 'texto_oculto', archivo: archivo.ruta, ocurrencias: 1 });
    }
    const delimitadores = texto.match(DELIMITADOR_FALSO)?.length ?? 0;
    if (delimitadores > 0) {
      banderas.push({
        codigo: 'delimitador_falso',
        archivo: archivo.ruta,
        ocurrencias: delimitadores,
      });
    }
    const lineasLargas = texto
      .split('\n')
      .filter((l) => l.length > LONGITUD_MAXIMA_DE_LINEA).length;
    if (lineasLargas > 0) {
      banderas.push({
        codigo: 'linea_desmesurada',
        archivo: archivo.ruta,
        ocurrencias: lineasLargas,
      });
    }
  }

  return { archivos: saneados, analisis: puntuar(banderas) };
}

/**
 * Convierte las banderas en un puntaje.
 *
 * Cada codigo cuenta UNA vez por mucho que se repita: diez copias de la misma
 * frase no son diez ataques distintos, y contarlas asi dispararia el puntaje de
 * un fichero que casualmente repite una linea.
 */
export function puntuar(banderas: readonly Bandera[]): AnalisisDeSeguridad {
  const codigos = new Set(banderas.map((b) => b.codigo));
  let puntaje = 0;
  for (const codigo of codigos) puntaje += PESOS[codigo];
  puntaje = Math.min(100, puntaje);

  const riesgo: Riesgo =
    puntaje >= UMBRAL_ALTO
      ? 'alto'
      : puntaje >= UMBRAL_MEDIO
        ? 'medio'
        : puntaje >= UMBRAL_BAJO
          ? 'bajo'
          : 'ninguno';

  return {
    riesgo,
    puntaje,
    banderas,
    versionReglas: VERSION_REGLAS,
    versionListaNegra: VERSION_LISTA_NEGRA,
  };
}
