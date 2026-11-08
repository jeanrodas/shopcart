import { useContext } from 'react';
import { AuthContext, type AuthContextValor } from './AuthContext';

export function useAuth(): AuthContextValor {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
