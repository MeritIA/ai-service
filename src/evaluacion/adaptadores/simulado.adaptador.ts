import type { ProveedorDeModelo, SolicitudAlModelo } from '../dominio/proveedor-de-modelo.js';

/**
 * Proveedor sin modelo, para desarrollar sin API key.
 *
 * Devuelve puntaje 0 en todos los criterios con una evidencia que lo dice. No
 * finge una evaluacion: una nota plausible e inventada es peor que una nota
 * obviamente vacia. La configuracion lo prohibe en produccion.
 */
export class ProveedorSimulado implements ProveedorDeModelo {
  readonly nombre = 'simulado';
  readonly modelo = 'ninguno';

  generarJson(solicitud: SolicitudAlModelo): Promise<string> {
    const esquema = solicitud.esquemaDeRespuesta as {
      properties?: { criterios?: { items?: { properties?: { criterio?: { enum?: unknown } } } } };
    };
    const enumeracion = esquema.properties?.criterios?.items?.properties?.criterio?.enum;
    const nombres = Array.isArray(enumeracion)
      ? enumeracion.filter((n): n is string => typeof n === 'string')
      : [];

    return Promise.resolve(
      JSON.stringify({
        criterios: nombres.map((criterio) => ({
          criterio,
          puntaje: 0,
          evidencia: 'Evaluacion simulada: ningun modelo reviso esta entrega.',
        })),
      }),
    );
  }
}
