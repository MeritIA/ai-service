import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Calibracion contra el modelo real (paquete 4.3).
 *
 * Configuracion aparte y no un patron mas en la de siempre, por tres razones:
 * gasta cuota del proveedor, tarda minutos en vez de segundos, y su resultado
 * no es determinista. Nada de eso puede entrar en la integracion continua.
 *
 *     CALIBRACION=1 npm run test:calibracion
 *
 * Sin cobertura: medir cobertura de cinco llamadas a un modelo externo no
 * dice nada, y el umbral del proyecto se mide con la suite de siempre.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/calibracion/**/*.calibracion-spec.ts'],
    setupFiles: ['./test/preparar.ts'],
    // Una llamada al modelo puede tardar bastante; el montaje hace cinco.
    testTimeout: 120_000,
    hookTimeout: 600_000,
    // Sin interceptar la consola: la tabla de notas se imprime desde el
    // montaje, y vitest se la traga si no se le dice esto. Esa tabla es la
    // parte que revisa una persona, asi que tiene que verse.
    disableConsoleIntercept: true,
    // En serie: el proveedor responde 429 si se le habla de a cinco.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
