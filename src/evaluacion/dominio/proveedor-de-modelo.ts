import type { EsquemaJson } from './esquema-de-respuesta.js';

/**
 * Interfaz abstracta de proveedor (paquete 4.4).
 *
 * Criterio: "el cambio de proveedor se realiza reemplazando el adaptador, sin
 * modificar los modulos de negocio". El dominio solo conoce esta interfaz; si
 * detras hay Gemini, otro proveedor o un simulador lo decide la configuracion.
 */
export const PROVEEDOR_DE_MODELO = Symbol('PROVEEDOR_DE_MODELO');

export interface SolicitudAlModelo {
  readonly instruccionDeSistema: string;
  readonly contenido: string;
  readonly esquemaDeRespuesta: EsquemaJson;
  /** Se aborta al agotarse el tiempo: el adaptador debe cancelar la llamada de red. */
  readonly senal: AbortSignal;
}

export interface ProveedorDeModelo {
  readonly nombre: string;
  readonly modelo: string;
  /**
   * Devuelve el texto crudo que produjo el modelo. NO lo interpreta: validarlo
   * es cosa del dominio, que no confia en el proveedor.
   */
  generarJson(solicitud: SolicitudAlModelo): Promise<string>;
}

/** Fallo transitorio: caida, sobrecarga (429 o 5xx), red o tiempo agotado. Reintentable. */
export class ProveedorNoDisponibleError extends Error {
  override readonly name = 'ProveedorNoDisponibleError';
}

/**
 * El proveedor rechazo la solicitud y repetirla no cambiaria nada: clave
 * invalida, modelo inexistente, contenido bloqueado por sus filtros o peticion
 * demasiado grande.
 */
export class ProveedorRechazoLaSolicitudError extends Error {
  override readonly name = 'ProveedorRechazoLaSolicitudError';
}
