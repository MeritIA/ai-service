import { GoogleGenAI } from '@google/genai';
import type { ConfigService } from '@nestjs/config';
import { ProveedorIa } from '../../config/entorno.js';
import type { ProveedorDeModelo } from '../dominio/proveedor-de-modelo.js';
import { ProveedorGemini } from './gemini.adaptador.js';
import { ProveedorSimulado } from './simulado.adaptador.js';

/** El que usa la documentacion del SDK. Se cambia con GEMINI_MODELO sin tocar codigo. */
export const MODELO_GEMINI_POR_OMISION = 'gemini-2.5-flash';

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
