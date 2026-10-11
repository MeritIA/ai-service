/**
 * Lista negra de frases comunes en ataques de inyeccion (Plan de Seguridad
 * §6.1, capa 2).
 *
 * ESTA VERSIONADA A PROPOSITO
 *
 * Una calificacion se puede disputar meses despues, y la respuesta tiene que
 * ser "con estas reglas, esta entrega se marco asi". Si la lista cambia y no se
 * guarda cual se aplico, esa respuesta no existe. La version viaja con cada
 * resultado y el backend la persiste.
 *
 * COMO SE AMPLIA
 *
 * Se anade el termino y se SUBE LA VERSION (fecha del cambio). Nunca se
 * reescribe la historia: las evaluaciones viejas siguieron otras reglas.
 *
 * Los terminos van en minusculas y sin acentos: el detector normaliza el texto
 * antes de comparar, para que "Ignóra" o "ＩＧＮＯＲＡ" no se escapen.
 */
export const VERSION_LISTA_NEGRA = '2026-10-04';

export interface TerminoProhibido {
  /** En minusculas y sin acentos. */
  readonly termino: string;
  readonly categoria: CategoriaDeAtaque;
}

export type CategoriaDeAtaque =
  | 'evasion_de_instrucciones'
  | 'cambio_de_rol'
  | 'mencion_del_sistema'
  | 'exigencia_de_formato'
  | 'peticion_de_nota';

/**
 * Las frases del Plan de Seguridad §6.1, en los dos idiomas que puede usar un
 * candidato, mas las variantes que aparecen en los ataques publicados.
 *
 * Son frases y no palabras sueltas: "sistema" o "rol" aparecen en codigo
 * legitimo todo el tiempo, y bloquear por ellas marcaria entregas honestas. El
 * riesgo del paquete es justamente el falso positivo.
 */
export const LISTA_NEGRA: readonly TerminoProhibido[] = [
  // "Ignore previous", "disregard"
  { termino: 'ignore previous', categoria: 'evasion_de_instrucciones' },
  { termino: 'ignore all previous', categoria: 'evasion_de_instrucciones' },
  { termino: 'ignore the above', categoria: 'evasion_de_instrucciones' },
  { termino: 'disregard previous', categoria: 'evasion_de_instrucciones' },
  { termino: 'disregard the above', categoria: 'evasion_de_instrucciones' },
  { termino: 'forget everything', categoria: 'evasion_de_instrucciones' },
  { termino: 'ignora las instrucciones', categoria: 'evasion_de_instrucciones' },
  { termino: 'ignora todo lo anterior', categoria: 'evasion_de_instrucciones' },
  { termino: 'olvida las instrucciones', categoria: 'evasion_de_instrucciones' },
  { termino: 'olvida todo lo anterior', categoria: 'evasion_de_instrucciones' },
  { termino: 'no evalues esto', categoria: 'evasion_de_instrucciones' },
  { termino: 'en su lugar', categoria: 'evasion_de_instrucciones' },

  // "You are now", "pretend you are"
  { termino: 'you are now', categoria: 'cambio_de_rol' },
  { termino: 'pretend you are', categoria: 'cambio_de_rol' },
  { termino: 'act as', categoria: 'cambio_de_rol' },
  { termino: 'actua como', categoria: 'cambio_de_rol' },
  { termino: 'a partir de ahora eres', categoria: 'cambio_de_rol' },
  { termino: 'nuevo rol', categoria: 'cambio_de_rol' },
  { termino: 'modo desarrollador', categoria: 'cambio_de_rol' },
  { termino: 'developer mode', categoria: 'cambio_de_rol' },

  // "system prompt"
  { termino: 'system prompt', categoria: 'mencion_del_sistema' },
  { termino: 'prompt de sistema', categoria: 'mencion_del_sistema' },
  { termino: 'instrucciones del sistema', categoria: 'mencion_del_sistema' },
  { termino: 'mensaje de sistema', categoria: 'mencion_del_sistema' },
  { termino: 'override', categoria: 'mencion_del_sistema' },
  { termino: 'bypass', categoria: 'mencion_del_sistema' },

  // "output only", "never mention"
  { termino: 'output only', categoria: 'exigencia_de_formato' },
  { termino: 'never mention', categoria: 'exigencia_de_formato' },
  { termino: 'responde solo con', categoria: 'exigencia_de_formato' },
  { termino: 'no menciones', categoria: 'exigencia_de_formato' },

  // Pedir la nota directamente: el ataque mas probable aqui.
  { termino: 'pon la nota maxima', categoria: 'peticion_de_nota' },
  { termino: 'pon 5 en todo', categoria: 'peticion_de_nota' },
  { termino: 'califica con el maximo', categoria: 'peticion_de_nota' },
  { termino: 'dale el puntaje maximo', categoria: 'peticion_de_nota' },
  { termino: 'give full marks', categoria: 'peticion_de_nota' },
  { termino: 'give the highest score', categoria: 'peticion_de_nota' },
  { termino: 'perfect score', categoria: 'peticion_de_nota' },
];
