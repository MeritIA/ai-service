import type { AnalisisDeSeguridad } from './deteccion-de-inyeccion.js';

/**
 * Contrato del servicio de IA: lo que recibe y lo que devuelve.
 *
 * El servicio no consulta nada por su cuenta. Todo lo que necesita para evaluar
 * llega en la peticion, que es lo que permite aislarlo: no tiene credenciales
 * de la base de datos ni del almacenamiento, ni forma de pedir datos de otro
 * candidato.
 */

/** Un criterio de la rubrica, con la misma forma que en el backend (paquete 2.3). */
export interface CriterioDeRubrica {
  readonly nombre: string;
  readonly descripcion: string;
  /** Aporte a la nota final. Los pesos suman 100. */
  readonly peso: number;
  /** El puntaje del criterio va de 0 a este valor. */
  readonly escalaMaxima: number;
}

/** Un archivo de la entrega, ya como texto. */
export interface ArchivoDeEntrega {
  readonly ruta: string;
  readonly contenido: string;
}

export interface SolicitudDeEvaluacion {
  /** Lo asigna el backend; se devuelve tal cual para correlacionar. */
  readonly idEvaluacion: string;
  readonly enunciado: string;
  readonly criterios: readonly CriterioDeRubrica[];
  readonly archivos: readonly ArchivoDeEntrega[];
}

export interface CalificacionDeCriterio {
  readonly criterio: string;
  readonly puntaje: number;
  readonly escalaMaxima: number;
  readonly peso: number;
  /** Por que ese puntaje, con referencia a la entrega. Nunca vacia. */
  readonly evidencia: string;
}

export interface ResultadoDeEvaluacion {
  /**
   * Analisis anti inyeccion de la entrega (paquete 4.2).
   *
   * Viaja con el resultado para que el backend lo persista: una nota se
   * puede disputar meses despues, y entonces hay que poder decir con que
   * reglas se marco la entrega.
   */
  readonly seguridad: AnalisisDeSeguridad;
  readonly idEvaluacion: string;
  /** Suma ponderada de los criterios, de 0 a 100, con dos decimales. */
  readonly notaFinal: number;
  /** En el orden de la rubrica. */
  readonly criterios: readonly CalificacionDeCriterio[];
  readonly proveedor: string;
  readonly modelo: string;
}
