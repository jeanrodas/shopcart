/**
 * Nombres de rol del sistema. Deben coincidir EXACTAMENTE con dbo.Rol.Nombre
 * sembrado en db/scripts/004_Catalogos.sql.
 */
export const ROLES = {
  Cliente: 'Cliente',
  Operador: 'Operador',
  Administrador: 'Administrador',
} as const;

export type Rol = (typeof ROLES)[keyof typeof ROLES];
