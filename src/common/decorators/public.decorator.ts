import { SetMetadata } from '@nestjs/common';

/**
 * Decorator para marcar rutas como públicas
 * Las rutas marcadas con @Public() no requieren autenticación
 */
export const Public = () => SetMetadata('isPublic', true);

