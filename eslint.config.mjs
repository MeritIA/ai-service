// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Mismas reglas que el backend: sin `any`, sin errores tragados, sin
      // promesas sueltas.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      // Express reconoce un manejador de errores por tener cuatro parametros;
      // el ultimo no se usa y se marca con guion bajo.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // ---------------------------------------------------------------------
    // Excepcion acotada, con motivo: la deteccion anti inyeccion del paquete
    // 4.2 existe PARA tratar caracteres invisibles y de control. Son
    // exactamente lo que un atacante usa para esconder instrucciones, asi que
    // aqui no son un descuido de tecleo sino el objeto del codigo.
    //
    // No alcanza al resto del proyecto: fuera de estos archivos siguen siendo
    // un error.
    // ---------------------------------------------------------------------
    files: [
      'src/evaluacion/dominio/deteccion-de-inyeccion.ts',
      'src/evaluacion/dominio/deteccion-de-inyeccion.spec.ts',
      'test/seguridad-inyeccion.e2e-spec.ts',
    ],
    rules: {
      'no-irregular-whitespace': 'off',
      'no-control-regex': 'off',
    },
  },
  {
    // supertest declara `response.body` como `any`: excepcion acotada a pruebas.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
