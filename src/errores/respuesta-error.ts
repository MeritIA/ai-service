/** Codigos estables de error. El backend decide por ellos, no por el texto. */
export const CODIGOS = {
  VALIDACION: 'VALIDACION',
  JSON_MAL_FORMADO: 'JSON_MAL_FORMADO',
  CUERPO_DEMASIADO_GRANDE: 'CUERPO_DEMASIADO_GRANDE',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  RUBRICA_INVALIDA: 'RUBRICA_INVALIDA',
  PROVEEDOR_NO_DISPONIBLE: 'PROVEEDOR_NO_DISPONIBLE',
  SALIDA_INVALIDA: 'SALIDA_INVALIDA',
  SOLICITUD_RECHAZADA_POR_PROVEEDOR: 'SOLICITUD_RECHAZADA_POR_PROVEEDOR',
  PETICION_INVALIDA: 'PETICION_INVALIDA',
  INTERNO: 'INTERNO',
} as const;

export interface DetalleValidacion {
  readonly campo: string;
  readonly problemas: readonly string[];
}

export interface RespuestaError {
  readonly estado: number;
  readonly codigo: string;
  readonly mensaje: string;
  /**
   * Si tiene sentido volver a intentarlo. La cola del backend lo usa para no
   * gastar reintentos (ni cuota del proveedor) en fallos que no van a cambiar.
   */
  readonly reintentable: boolean;
  readonly momento: string;
  readonly ruta: string;
  readonly referencia: string;
  readonly errores?: readonly DetalleValidacion[];
}
