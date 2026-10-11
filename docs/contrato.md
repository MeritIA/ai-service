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
  "modelo": "gemini-3.5-flash"
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

## Detección de inyección (paquete 4.2)

Antes de armar el prompt, la entrega pasa por las capas 1 y 2 del Plan de
Seguridad §6.1. La capa 3 (contexto aislado, instrucción de defensa y
validación del JSON) ya estaba desde el 4.4.

**No bloquea: marca.** El riesgo que señala la ficha del propio paquete son los
falsos positivos —una entrega legítima cuyo ejercicio trata justamente de
prompts—, así que el resultado es un puntaje graduado con banderas y la entrega
se evalúa igual. Bloquear en automático convertiría un falso positivo en un
candidato descartado sin que nadie lo revise.

| Qué se detecta | Peso |
|---|---|
| Frases de evasión («ignora las instrucciones anteriores», «ignore previous») | 40 |
| Pedir la nota directamente («pon la nota máxima», «give full marks») | 35 |
| Cambio de rol («a partir de ahora eres», «you are now») | 30 |
| Texto oculto: caracteres invisibles o de control | 30 |
| Mención del sistema («system prompt», «override», «bypass») | 25 |
| Intento de cerrar el delimitador de la entrega | 20 |
| Exigencia de formato («output only», «no menciones») | 15 |
| Línea desmesurada (más de 5000 caracteres) | 10 |

Cada código cuenta **una sola vez** por mucho que se repita: diez copias de la
misma frase no son diez ataques, y contarlas así dispararía el puntaje de un
fichero que repite una línea. El riesgo sale del puntaje: 0 ninguno, 1 a 29
bajo, 30 a 59 medio, 60 o más alto.

**Dos evasiones cerradas:** el texto se normaliza (NFKC) antes de comparar, así
que las variantes tipográficas no sirven; y se eliminan los caracteres
invisibles, así que `ig<zero-width>nora` tampoco.

**Qué viaja en la respuesta** (campo `seguridad`): riesgo, puntaje, banderas con
su archivo y número de ocurrencias, y las **versiones** de las reglas y de la
lista negra. Nunca el texto del candidato: si logró manipular al modelo, ese
texto es justo lo que no debe acabar copiado en un log o en una base de datos.

**Con indicios, el modelo recibe un aviso de texto fijo** pidiéndole que aplique
la rúbrica igual y lo mencione en la evidencia. Fijo a propósito: repetirle lo
que escribió el candidato sería darle el ataque por segunda vez.

**La lista negra está versionada** (`lista-negra.ts`). Se amplía añadiendo el
término y subiendo la versión; nunca se reescribe, porque las evaluaciones
viejas siguieron otras reglas.

## Calibración de la calificación (paquete 4.3)

El Diccionario de la EDT pide, como tercer entregable del paquete, un "conjunto
de pruebas con entregas de referencia". Son cinco entregas contra una misma
rúbrica, cada una elegida para aislar una cosa distinta, en
`test/calibracion/entregas-de-referencia.ts`.

```
CALIBRACION=1 npm run test:calibracion
```

**No corre con el resto de la suite ni en la integración continua**, y eso es
deliberado: gasta cuota del proveedor y su resultado no es determinista. Sin
`CALIBRACION=1` y sin `GEMINI_API_KEY` se salta entera.

### Qué se afirma, y qué no

No se exige un número exacto: un modelo de lenguaje no es determinista y una
prueba que pida 82 falla el martes. Se exige:

1. **Los invariantes del contrato sobre una respuesta real**, no simulada: la
   nota es la suma ponderada —recalculada en la prueba, sin usar la función del
   servicio—, cada criterio trae evidencia, y los criterios son exactamente los
   de la rúbrica, en su orden.
2. **Bandas amplias**: lo que resuelve el ejercicio no puede sacar 20, y lo que
   no viene al caso no puede sacar 80.
3. **El orden entre entregas**, que es lo que de verdad usa un reclutador.
4. **Que el desglose discrimine**. Si el modelo pusiera la misma nota a todos
   los criterios, la rúbrica sería un adorno.

**Si una banda falla, la primera pregunta es si la banda está mal.** Son un
juicio del equipo sobre estas cinco entregas, no una verdad medida.

### Última corrida

Con `gemini/gemini-3.5-flash`, el 2026-10-05:

| Entrega | Nota | Corrección (70) | Claridad (30) |
|---|---|---|---|
| `correcta` | 100 | 5/5 | 5/5 |
| `correcta_ilegible` | 75 | 4,5/5 | 2/5 |
| `mutante` | 44 | 1/5 | 5/5 |
| `falla_en_vacia` | 40 | 2/5 | 2/5 |
| `irrelevante` | 0 | 0/5 | 0/5 |

Las dos filas que demuestran que la rúbrica funciona:

- **`mutante`** invierte la lista pero modifica la original, que es lo único que
  el enunciado prohíbe. Saca **1/5 en corrección y 5/5 en claridad**: el código
  está limpio y el modelo lo dice, pero no cumple el enunciado y el modelo
  también lo dice. Un número solo —44— escondería las dos cosas.
- **`correcta_ilegible`** funciona perfecto y está escrita de forma ilegible:
  4,5 contra 2. El desglose separa "no sirve" de "sirve pero no se entiende",
  que son dos conversaciones distintas con el candidato.

### Cuando el proveedor dice "ahora no"

Gemini devuelve 503 con el modelo saturado y 429 al pasarse de cuota. La suite
reintenta tres veces con espera creciente y, si sigue, **falla diciendo que es
del proveedor y no de la calificación**. Sin esa distinción, una saturación de
dos minutos se lee como "la calibración falló", y una suite que se malinterpreta
así deja de mirarse.

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
