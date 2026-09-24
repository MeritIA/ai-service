# MeritIA · Servicio de evaluación con IA

Evalúa entregas de candidatos contra la rúbrica de su ejercicio y devuelve un
puntaje por criterio con evidencia. Se despliega aparte del backend y solo el
módulo de evaluación del backend lo invoca.

- **Contrato, errores, defensas y aislamiento:** [`docs/contrato.md`](docs/contrato.md)
- **Especificación OpenAPI:** [`docs/openapi.json`](docs/openapi.json)

## Arrancar en local

```bash
cp .env.example .env
# Rellena CLAVE_DE_ACCESO (32 bytes aleatorios en hexadecimal).
# Con PROVEEDOR_IA=simulado no hace falta API key.
npm ci
npm run start:dev
```

Con Docker, igual que en producción:

```bash
docker compose up --build
```

Para evaluar con Gemini, `PROVEEDOR_IA=gemini` y `GEMINI_API_KEY` de
<https://aistudio.google.com/apikey>.

## Verificar

```bash
npm run lint && npm run format:check
npm run build && node scripts/exportar-openapi.mjs --check
npm run test:cov
```

Las pruebas no necesitan API key ni red: el proveedor se sustituye por dobles.
