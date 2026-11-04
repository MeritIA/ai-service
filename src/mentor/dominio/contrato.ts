/**
 * Contrato del mentor.
 *
 * El servicio no guarda estado ni conversaciones: cada llamada trae un
 * resumen compacto del historial del candidato, los ultimos turnos y la
 * pregunta. Esa es la forma de gastar pocos tokens: el modelo nunca recibe
 * entregas, enunciados ni rubricas completas, solo lo que hace falta para
 * aconsejar.
 */
export const MAX_CRITERIOS_EN_PERFIL = 12;
export const MAX_RECIENTES = 3;
export const MAX_TURNOS = 6;
export const MAX_CARACTERES_POR_TURNO = 400;
export const MAX_CARACTERES_DE_PREGUNTA = 500;
export const MAX_CARACTERES_DE_EVIDENCIA = 160;
/**
 * Tope duro de la llamada, pensamiento incluido: los modelos Gemini 3 gastan
 * ~400 tokens razonando y con un tope menor el JSON sale cortado (MAX_TOKENS).
 * La respuesta visible sigue acotada a 1500 caracteres al validar.
 */
export const MAX_TOKENS_DE_SALIDA = 1500;

export interface CriterioDelPerfil {
  readonly nombre: string;
  /** Promedio de este criterio en todas sus evaluaciones, 0-100. */
  readonly porcentaje: number;
  /** En cuantas evaluaciones aparece. */
  readonly veces: number;
}

export interface EvaluacionReciente {
  readonly reto: string;
  readonly nota: number;
  readonly flojo?: {
    readonly criterio: string;
    readonly porcentaje: number;
    readonly evidencia: string;
  };
}

export interface ContextoDelCandidato {
  readonly totalEvaluaciones: number;
  readonly promedio: number;
  readonly perfil: readonly CriterioDelPerfil[];
  readonly recientes: readonly EvaluacionReciente[];
}

export interface TurnoDeConversacion {
  readonly rol: 'candidato' | 'mentor';
  readonly texto: string;
}

export interface SolicitudDeMentor {
  readonly contexto: ContextoDelCandidato;
  readonly historial: readonly TurnoDeConversacion[];
  readonly pregunta: string;
}

export interface RespuestaDeMentor {
  readonly respuesta: string;
  readonly sugerencias: readonly string[];
  readonly proveedor: string;
  readonly modelo: string;
}
