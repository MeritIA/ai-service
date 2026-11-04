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
      properties?: {
        respuesta?: unknown;
        criterios?: { items?: { properties?: { criterio?: { enum?: unknown } } } };
      };
    };
    // El mentor pide {respuesta, sugerencias}: se contesta con un texto que dice
    // lo que es, por la misma razon que la nota 0 de arriba.
    if (esquema.properties?.respuesta !== undefined) {
      return Promise.resolve(
        JSON.stringify({
          respuesta:
            'Mentor simulado: ningun modelo leyo tu historial. Configura PROVEEDOR_IA=gemini.',
          sugerencias: [],
        }),
      );
    }
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
