import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { obtenerTicketEventos } from '../api/dashboard';
import { claves } from './claves';
import type { EstadoConexionVivo, EventoVivo, TipoEventoVivo } from '../api/tipos';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TIPOS: TipoEventoVivo[] = [
  'pedido.creado',
  'pedido.estado',
  'inventario.movimiento',
  'inventario.bajoStock',
  'cupon.usado',
];
const MAX_FEED = 30;
const RECONECTAR_MS = 5000;

export interface Hola {
  /** Fecha de creacion de la BD (sys.databases.create_date); si cambia, la sesion abierta
   *  quedo apuntando a otra instalacion (p. ej. BD reinstalada) y el feed debe limpiarse. */
  instalacion?: string;
  operacion?: unknown;
  inventario?: unknown;
}

/**
 * Suscripcion SSE reutilizable. Conecta con un ticket de un solo uso y, como ese ticket no
 * sirve para el reintento NATIVO de EventSource, reconecta con uno nuevo tras cada corte.
 * Llama `onEvento(tipo, datos)` por cada evento de negocio y `onHola(datos)` al recibir el
 * estado inicial. Devuelve el estado de conexion. Los callbacks se leen por ref para que la
 * conexion no se reinicie en cada render.
 */
export function useSuscripcionEventos(
  onEvento: (tipo: TipoEventoVivo, datos: Record<string, unknown>) => void,
  onHola?: (datos: Hola) => void,
): EstadoConexionVivo {
  const [estado, setEstado] = useState<EstadoConexionVivo>('conectando');
  const esRef = useRef<EventSource | null>(null);
  const reconectarRef = useRef<number | undefined>(undefined);
  const onEventoRef = useRef(onEvento);
  const onHolaRef = useRef(onHola);
  onEventoRef.current = onEvento;
  onHolaRef.current = onHola;

  useEffect(() => {
    let vivo = true;

    const programarReconexion = (): void => {
      if (!vivo) return;
      setEstado('reconectando');
      reconectarRef.current = window.setTimeout(() => void conectar(), RECONECTAR_MS);
    };

    const conectar = async (): Promise<void> => {
      if (!vivo) return;
      try {
        const { ticket } = await obtenerTicketEventos();
        if (!vivo) return;
        const es = new EventSource(`${BASE}/api/v1/eventos?ticket=${encodeURIComponent(ticket)}`);
        esRef.current = es;
        es.onopen = () => {
          if (vivo) setEstado('conectado');
        };
        es.addEventListener('hola', (ev: MessageEvent) => {
          try {
            onHolaRef.current?.(JSON.parse(ev.data) as Hola);
          } catch {
            /* dato no-JSON: se ignora */
          }
        });
        for (const t of TIPOS) {
          es.addEventListener(t, (ev: MessageEvent) => {
            let datos: Record<string, unknown> = {};
            try {
              datos = JSON.parse(ev.data) as Record<string, unknown>;
            } catch {
              /* dato no-JSON: se ignora */
            }
            onEventoRef.current(t, datos);
          });
        }
        es.onerror = () => {
          es.close();
          esRef.current = null;
          programarReconexion();
        };
      } catch {
        programarReconexion();
      }
    };

    void conectar();

    return () => {
      vivo = false;
      window.clearTimeout(reconectarRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return estado;
}

/**
 * Feed "en vivo" del Dashboard. Mantiene los ultimos eventos y, con pequeño debounce,
 * invalida el resumen de operacion (tarjetas) y el de inventario para que el panel "Ahora
 * mismo" se actualice sin recargar. Descarta el feed si el "hola" trae una instalacion de
 * BD distinta a la que vio al abrir (p. ej. la BD fue reinstalada).
 */
export function useEventosVivo() {
  const qc = useQueryClient();
  const [feed, setFeed] = useState<EventoVivo[]>([]);
  const [total, setTotal] = useState(0);
  const idRef = useRef(0);
  const invTimer = useRef<number | undefined>(undefined);
  const instalacionRef = useRef<string | null>(null);

  const estado = useSuscripcionEventos(
    (tipo, datos) => {
      idRef.current += 1;
      setFeed((prev) => [{ id: idRef.current, tipo, datos, fecha: Date.now() }, ...prev].slice(0, MAX_FEED));
      setTotal((n) => n + 1);
      window.clearTimeout(invTimer.current);
      invTimer.current = window.setTimeout(() => {
        // Tarjetas Y tabla de operacion comparten esta invalidacion (claves.operacion.todo).
        void qc.invalidateQueries({ queryKey: claves.operacion.todo });
        void qc.invalidateQueries({ queryKey: claves.inventario.resumen });
      }, 400);
    },
    (hola) => {
      const nueva = hola.instalacion ?? null;
      if (instalacionRef.current !== null && nueva !== null && nueva !== instalacionRef.current) {
        // La BD cambio (reinstalada): lo creado antes ya no existe -> limpiar el feed.
        setFeed([]);
        setTotal(0);
        void qc.invalidateQueries({ queryKey: claves.operacion.todo });
        void qc.invalidateQueries({ queryKey: claves.inventario.resumen });
      }
      instalacionRef.current = nueva;
    },
  );

  useEffect(() => () => window.clearTimeout(invTimer.current), []);

  /** Quita un evento del feed (p. ej. cuando su pedido ya no existe). */
  const quitar = (id: number): void => setFeed((prev) => prev.filter((f) => f.id !== id));

  return { estado, feed, total, quitar };
}

/**
 * Refresco en vivo de la pantalla de operacion de pedidos: ante pedido.creado/pedido.estado
 * por SSE (o al volver el foco) invalida claves.operacion.todo, de modo que las TARJETAS y la
 * TABLA se refrescan JUNTAS (comparten la misma invalidacion). Devuelve el estado de conexion.
 */
export function useOperacionVivo(): EstadoConexionVivo {
  const qc = useQueryClient();
  const invTimer = useRef<number | undefined>(undefined);

  const refrescar = (): void => {
    window.clearTimeout(invTimer.current);
    invTimer.current = window.setTimeout(() => {
      void qc.invalidateQueries({ queryKey: claves.operacion.todo });
    }, 300);
  };

  const estado = useSuscripcionEventos((tipo) => {
    if (tipo === 'pedido.creado' || tipo === 'pedido.estado') refrescar();
  });

  useEffect(() => {
    const onFocus = () => void qc.invalidateQueries({ queryKey: claves.operacion.todo });
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearTimeout(invTimer.current);
    };
  }, [qc]);

  return estado;
}
