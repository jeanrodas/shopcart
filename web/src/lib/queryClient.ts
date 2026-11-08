import { QueryClient } from '@tanstack/react-query';

// Estado de servidor con TanStack Query: datos frescos por 30 s, un reintento.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
