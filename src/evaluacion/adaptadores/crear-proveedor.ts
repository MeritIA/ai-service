import { GoogleGenAI } from '@google/genai';
import type { ConfigService } from '@nestjs/config';
import { ProveedorIa } from '../../config/entorno.js';
import type { ProveedorDeModelo } from '../dominio/proveedor-de-modelo.js';
import { ProveedorGemini } from './gemini.adaptador.js';
import { ProveedorSimulado } from './simulado.adaptador.js';

/**
 * Modelo por omision. Se cambia con GEMINI_MODELO sin tocar codigo.
 *
 * Era gemini-2.5-flash, el que usa el README del SDK, pero Google dejo de
 * servirlo a cuentas nuevas: responde 404 diciendo que ya no esta
 * disponible. Verificado el 2026-10-03 con una clave recien creada.
 *
 * Se elige un Flash completo y no un Flash-Lite porque califica codigo
 * contra una rubrica. Los mas nuevos (3.7 y 3.8) devolvian 503 por
 * demanda; la cola los reintentaria, pero no sirven de valor por omision.
 */
export const MODELO_GEMINI_POR_OMISION = 'gemini-3.5-flash';

/**
 * Elige el adaptador segun PROVEEDOR_IA.
 *
 * Es el unico sitio que conoce a los proveedores concretos. Anadir uno es
 * escribir su adaptador, sumar su valor a ProveedorIa y un caso aqui.
 */
export function crearProveedor(config: ConfigService): ProveedorDeModelo {
  const proveedor = config.getOrThrow<ProveedorIa>('PROVEEDOR_IA');
  if (proveedor === ProveedorIa.Simulado) return new ProveedorSimulado();

  const cliente = new GoogleGenAI({ apiKey: config.getOrThrow<string>('GEMINI_API_KEY') });
  return new ProveedorGemini(
    cliente,
    config.get<string>('GEMINI_MODELO') || MODELO_GEMINI_POR_OMISION,
  );
}
