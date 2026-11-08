import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { IconoAlerta, IconoCerrar, IconoCheck, IconoInfo } from '../iconos';

export type VarianteToast = 'exito' | 'error' | 'info';

/** Accion opcional del toast: un enlace a una ruta (p. ej. "Ver carrito"). */
export interface AccionToast {
  texto: string;
  a: string;
}

interface Toast {
  id: number;
  variante: VarianteToast;
  mensaje: string;
  accion?: AccionToast;
}

interface ToastContextValor {
  mostrar: (mensaje: string, variante?: VarianteToast, accion?: AccionToast) => void;
}

const ToastContext = createContext<ToastContextValor | null>(null);

/** Color del icono por variante (22 px). */
const COLOR_ICONO: Record<VarianteToast, string> = {
  exito: 'text-[#FFD166]',
  error: 'text-[#FCA5A5]',
  info: 'text-[#93C5FD]',
};

function Icono({ variante }: { variante: VarianteToast }) {
  const clase = clsx('h-[22px] w-[22px] shrink-0', COLOR_ICONO[variante]);
  if (variante === 'exito') return <IconoCheck className={clase} />;
  if (variante === 'error') return <IconoAlerta className={clase} />;
  return <IconoInfo className={clase} />;
}

function ToastItem({ toast, quitar }: { toast: Toast; quitar: (id: number) => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const duracion = toast.accion ? 6000 : 4000;
  const restante = useRef(duracion);
  const inicio = useRef(0);
  const timer = useRef<number>();

  // Inicia la salida (fade) y quita el toast al terminar la animacion.
  const cerrar = useCallback(() => {
    setSaliendo(true);
    window.setTimeout(() => quitar(toast.id), 180);
  }, [quitar, toast.id]);

  const reanudar = useCallback(() => {
    inicio.current = Date.now();
    timer.current = window.setTimeout(cerrar, restante.current);
  }, [cerrar]);

  // Pausa el temporizador mientras el puntero esta encima (descuenta lo transcurrido).
  const pausar = useCallback(() => {
    window.clearTimeout(timer.current);
    restante.current -= Date.now() - inicio.current;
  }, []);

  useEffect(() => {
    reanudar();
    return () => window.clearTimeout(timer.current);
  }, [reanudar]);

  return (
    <div
      onMouseEnter={pausar}
      onMouseLeave={reanudar}
      className={clsx(
        'pointer-events-auto flex items-center gap-3 rounded-16 border border-[rgba(255,255,255,.12)]',
        'bg-degradado-marino px-[18px] py-[14px] text-white shadow-marino',
        saliendo ? 'toast-sale' : 'toast-entra',
      )}
    >
      <Icono variante={toast.variante} />
      <p className="flex-1 text-[15px] font-semibold leading-snug">{toast.mensaje}</p>
      {toast.accion && (
        <Link
          to={toast.accion.a}
          onClick={cerrar}
          className="shrink-0 rounded-pill bg-degradado-acento px-3 py-1.5 text-sm font-bold text-marino-900 hover:brightness-105"
        >
          {toast.accion.texto}
        </Link>
      )}
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar notificacion"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-pill text-white/70 hover:bg-white/10 hover:text-white"
      >
        <IconoCerrar className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const siguienteId = useRef(1);

  const quitar = useCallback((id: number) => {
    setToasts((lista) => lista.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensaje: string, variante: VarianteToast = 'info', accion?: AccionToast) => {
      const id = siguienteId.current++;
      setToasts((lista) => [...lista, { id, variante, mensaje, accion }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      {/* Centrado horizontal; 88 px sobre el borde en movil (encima de la barra inferior),
          24 px en escritorio. Ancho 320–480 px. pointer-events-none deja pasar los clics
          salvo en los propios toasts. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-[88px] left-1/2 z-50 flex w-[min(92vw,480px)] min-w-[320px] -translate-x-1/2 flex-col gap-2 lg:bottom-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} quitar={quitar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValor {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return ctx;
}
