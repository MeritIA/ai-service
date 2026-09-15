/**
 * Exporta el contrato del servicio a docs/openapi.json.
 *
 *   npm run openapi:export     genera docs/openapi.json
 *   npm run openapi:check      falla si el fichero no corresponde al codigo
 *
 * El backend consume este contrato: versionarlo hace que cualquier cambio se
 * vea en la revision por pares, y que la CI falle si alguien lo cambia sin
 * regenerarlo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const destino = path.join(raiz, 'docs', 'openapi.json');
const comprobar = process.argv.includes('--check');

// Valores de relleno: la validacion de entorno corre al construir el modulo.
process.env.NODE_ENV ??= 'development';
process.env.PORT ??= '3000';
process.env.CLAVE_DE_ACCESO ??= 'x'.repeat(32);
process.env.PROVEEDOR_IA ??= 'simulado';

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configurarAplicacion } = await import('../dist/configurar-aplicacion.js');
const { construirDocumentoOpenApi } = await import('../dist/docs/openapi.js');

const app = await NestFactory.create(AppModule, { logger: false });
// Misma configuracion que main.ts, para que las rutas lleven /api y la version.
configurarAplicacion(app);
const documento = construirDocumentoOpenApi(app);
await app.close();

const json = `${JSON.stringify(documento, null, 2)}\n`;

if (comprobar) {
  if (!existsSync(destino) || readFileSync(destino, 'utf8') !== json) {
    console.error(
      'docs/openapi.json no corresponde al codigo actual. Regeneralo con:  npm run openapi:export',
    );
    process.exit(1);
  }
  console.log(`docs/openapi.json esta al dia (${Object.keys(documento.paths).length} ruta(s)).`);
  process.exit(0);
}

mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, json, 'utf8');
console.log(`Escrito docs/openapi.json con ${Object.keys(documento.paths).length} ruta(s):`);
for (const ruta of Object.keys(documento.paths)) console.log(`  ${ruta}`);
