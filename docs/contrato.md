# Servicio de evaluación con IA

> Paquete **4.4** de la EDT: servicio de IA independiente e interfaz de proveedor.
> Plan de Seguridad §6.

Componente desplegado aparte del monolito. Recibe una entrega y su rúbrica, y
devuelve un puntaje por criterio con su evidencia y la nota ponderada. Solo lo
invoca el módulo de evaluación del backend.

## Criterios de aceptación

| Criterio | Cómo se cumple |
|---|---|
| El servicio se despliega y escala sin tocar el monolito | Repositorio, imagen, pipeline y `compose.yaml` propios. No comparte base de datos, cola ni código con el backend: solo este contrato HTTP. Es sin estado, así que escala con más réplicas detrás de un balanceador. |
| Un ataque exitoso contra el servicio no compromete el backend | Ver *Aislamiento* abajo. |
| Cambiar de proveedor es reemplazar el adaptador, sin tocar negocio | El dominio solo conoce `ProveedorDeModelo`. Gemini vive en `adaptadores/gemini.adaptador.ts`; `PROVEEDOR_IA` elige cuál se usa. |

## Contrato

La especificación completa, generada desde el código, está en
[`openapi.json`](openapi.json). Con el servicio en marcha fuera de producción,
también en `/api/docs`.

### `POST /api/v1/evaluaciones`

Cabecera `Authorization: Bearer <CLAVE_DE_ACCESO>`.

```json
{
  "idEvaluacion": "7f1c2b8e-3d4a-4c5b-9e6f-1a2b3c4d5e6f",
  "enunciado": "Implementa una funcion que invierta una lista.",
  "criterios": [
    { "nombre": "Correccion", "descripcion": "Invierte cualquier lista.", "peso": 60, "escalaMaxima": 5 },
    { "nombre": "Claridad", "descripcion": "Codigo legible y ordenado.", "peso": 40, "escalaMaxima": 10 }
  ],
  "archivos": [{ "ruta": "main.py", "contenido": "def invertir(l):\n    return l[::-1]\n" }]
}
```

Respuesta `200`:

```json
{
  "idEvaluacion": "7f1c2b8e-3d4a-4c5b-9e6f-1a2b3c4d5e6f",
  "notaFinal": 68,
  "criterios": [
    { "criterio": "Correccion", "puntaje": 4, "escalaMaxima": 5, "peso": 60, "evidencia": "..." },
    { "criterio": "Claridad", "puntaje": 5, "escalaMaxima": 10, "peso": 40, "evidencia": "..." }
  ],
  "proveedor": "gemini",
  "modelo": "gemini-2.5-flash"
}
```

Límites: 1 a 20 criterios con pesos que suman 100; 1 a 200 archivos de hasta
500 000 caracteres cada uno; cuerpo de hasta 2 MB.

### Errores

Todos con el mismo formato e incluyen `reintentable`, que es lo que la cola del
backend (paquete 4.1) usa para decidir:

| HTTP | `codigo` | `reintentable` | Cuándo |
|---|---|---|---|
| 400 | `VALIDACION`, `JSON_MAL_FORMADO`, `RUBRICA_INVALIDA` | no | La petición está mal |
| 401 | `NO_AUTENTICADO` | no | Falta la clave o no coincide |
| 413 | `CUERPO_DEMASIADO_GRANDE` | no | Más de 2 MB |
| 422 | `SOLICITUD_RECHAZADA_POR_PROVEEDOR` | no | Clave del proveedor inválida, modelo inexistente, contenido bloqueado por sus filtros |
| 502 | `SALIDA_INVALIDA` | **sí** | El modelo respondió algo que no cumple el contrato |
| 503 | `PROVEEDOR_NO_DISPONIBLE` | **sí** | Caída, sobrecarga (429/5xx), red o tiempo agotado |
| 500 | `INTERNO` | no | Error no previsto; el detalle queda en el log con la `referencia` |

En el backend, un error no reintentable corresponde a
`EvaluacionNoReintentableError`, y uno reintentable a `ServicioDeIaNoDisponibleError`.

## Defensas en la evaluación

1. **La rúbrica se valida** aunque el backend ya la validó: pesos que suman 100
   y nombres únicos.
2. **Instrucción y entrega por canales distintos.** La instrucción de defensa
   del Plan de Seguridad §6.1 va en el canal de sistema del proveedor; la
   entrega, en el contenido.
3. **Delimitador aleatorio por petición** (128 bits) alrededor de la entrega.
   Con uno fijo, una entrega podría cerrarlo y escribir "instrucciones" fuera.
4. **Esquema JSON exigido al modelo**, con los nombres de criterio como `enum`.
5. **La salida se valida sin confiar en el esquema**: JSON válido, cada
   criterio exactamente una vez, puntajes dentro de su escala y evidencia no
   vacía. Los campos extra se descartan.
6. **La nota la calcula el servicio**, no el modelo.
7. **Temperatura 0**, para que dos entregas iguales saquen la misma nota.
8. **Tiempo máximo por llamada** (`TIEMPO_MAXIMO_MS`, 90 s), menor que el del
   backend, y cancelación de la llamada de red al vencer.

Las capas de detección sobre la entrada (lista negra, puntaje de riesgo) y el
registro forense de cada evaluación son del **paquete 4.2**.

## Aislamiento

- **Sin credenciales ajenas.** No tiene acceso a la base de datos, a Redis, al
  almacenamiento de objetos ni a claves del backend. Lo que no tiene, no lo
  puede filtrar.
- **No consulta nada.** Todo llega en la petición: no hay forma de pedir datos
  de otro candidato.
- **El backend no confía en su respuesta.** Solo la llama el módulo de
  evaluación, y la respuesta es un JSON que se valida; nunca se ejecuta.
- **Contenedor endurecido** (`compose.yaml`): sistema de ficheros de solo
  lectura, sin capacidades del kernel, sin escalada de privilegios, límites de
  CPU y memoria, usuario sin privilegios.
- **Red propia**: otro proyecto de compose, sin ruta a los servicios del backend.
- **Sin CORS**: ningún navegador tiene nada que hacer aquí.
- **Errores sin detalle**: ni trazas, ni mensajes del proveedor, ni el texto del
  modelo salen en las respuestas.

## Añadir un proveedor

1. Escribir `src/evaluacion/adaptadores/<proveedor>.adaptador.ts` implementando
   `ProveedorDeModelo`. Debe traducir sus errores a
   `ProveedorNoDisponibleError` (reintentable) o
   `ProveedorRechazoLaSolicitudError` (no reintentable), y respetar la `senal`.
2. Añadir su valor a `ProveedorIa` y sus variables en `config/entorno.ts`.
3. Añadir el caso en `adaptadores/crear-proveedor.ts`.

El dominio, el controlador y el backend no cambian.

## Configuración

Ver [`.env.example`](../.env.example). `PROVEEDOR_IA=simulado` permite
desarrollar sin API key: devuelve puntaje 0 con una evidencia que lo dice, y
está prohibido en producción.

## Lo que falta para usarlo de extremo a extremo

- **Paquete 4.5 (backend):** el adaptador de `Evaluador` que descarga la
  entrega, arma esta petición, la envía y persiste el resultado.
- **Decisión pendiente: extraer texto de las entregas.** Hoy el contrato recibe
  archivos como texto. Las entregas pueden ser `.zip`, `.tar.gz` o `.pdf`. Hay
  que decidir quién los descomprime y extrae: hacerlo en este servicio mantiene
  el análisis de archivos no confiables fuera del backend, que es la idea del
  aislamiento, pero exige defenderse de bombas de descompresión.
