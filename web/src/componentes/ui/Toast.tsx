import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconoAlerta, IconoCerrar, IconoCheck, IconoInfo } from '../iconos';

export type VarianteToast = 'exito' | 'error' | 'info';

interface Toast {
  id: number;
  variante: VarianteToast;
  mensaje: string;
}

interface ToastContextValor {
  mostrar: (mensaje: string, variante?: VarianteToast) => void;
}

const ToastContext = createContext<ToastContextValor | null>(null);

const ESTILOS: Record<VarianteToast, string> = {
  exito: 'border-exito/40 bg-white text-exito-texto',
  error: 'border-error/40 bg-white text-error-texto',
  info: 'border-marino-600/30 bg-white text-marino-700',
};

function Icono({ variante }: { variante: VarianteToast }) {
  const clase = 'h-5 w-5 shrink-0';
  if (variante === 'exito') return <IconoCheck className={clase} />;
  if (variante === 'error') return <IconoAlerta className={clase} />;
  return <IconoInfo className={clase} />;
}

function ToastItem({ toast, alCerrar }: { toast: Toast; alCerrar: () => void }) {
  return (
    <div
      role="status"
      className={clsx(
        'anim-fade flex items-start gap-3 rounded-12 border bg-white px-4 py-3 shadow-elevada',
        ESTILOS[toast.variante],
      )}
    >
      <Icono variante={toast.variante} />
      <p className="text-sm font-medium text-texto">{toast.mensaje}</p>
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar notificacion"
        className="ml-2 grid h-6 w-6 shrink-0 place-items-center rounded-pill text-apagado hover:bg-fondo-2"
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
    (mensaje: string, variante: VarianteToast = 'info') => {
      const id = siguienteId.current++;
      setToasts((lista) => [...lista, { id, variante, mensaje }]);
      window.setTimeout(() => quitar(id), 4000);
    },
    [quitar],
  );

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} alCerrar={() => quitar(t.id)} />
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
