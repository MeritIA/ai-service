import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'es_publico';

/** Marca un endpoint que no exige la clave de acceso. Solo el de salud. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
