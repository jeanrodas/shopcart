import { useRef, useState, type DragEvent } from 'react';
import clsx from 'clsx';
import { subirImagen } from '../../api/archivos';
import { resolverImagen } from '../../lib/imagenes';
import { ErrorApi } from '../../api/clienteHttp';

interface Props {
  valor: string | null;
  onCambio: (url: string | null) => void;
  soloLectura?: boolean;
  etiqueta?: string;
}

function IconoCamara({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.2l.8-1.3A1 1 0 0 1 8.4 5h7.2a1 1 0 0 1 .9.5l.8 1.5h1.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Carga de una imagen (clic o arrastrar) 96x96. Sube de inmediato a /archivos/imagenes
 * y devuelve la URL al formulario (no se persiste hasta Guardar). Solo Administrador;
 * en modo solo lectura muestra la imagen sin controles.
 */
export function CargadorImagen({ valor, onCambio, soloLectura = false, etiqueta }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const procesar = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const r = await subirImagen(archivo);
      onCambio(r.url);
    } catch (err) {
      const status = err instanceof ErrorApi ? err.status : 0;
      setError(
        status === 415 || status === 413
          ? 'Solo JPG, PNG o WebP de hasta 2 MB'
          : err instanceof ErrorApi
            ? err.mensaje
            : 'No se pudo subir la imagen',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    if (soloLectura || subiendo) return;
    void procesar(e.dataTransfer.files?.[0]);
  };

  const tieneImagen = Boolean(valor);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={soloLectura || subiendo}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => !soloLectura && e.preventDefault()}
        onDrop={alSoltar}
        aria-label={etiqueta ?? 'Subir imagen'}
        className={clsx(
          'grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-16 border text-apagado transition-colors',
          tieneImagen ? 'border-borde bg-fondo-2' : 'border-dashed border-marino-600/40 bg-fondo',
          !soloLectura && 'hover:border-marino-600 hover:text-marino-700',
          (soloLectura || subiendo) && 'cursor-default',
        )}
      >
        {subiendo ? (
          <span className="text-[11px] font-semibold">Subiendo…</span>
        ) : tieneImagen ? (
          <img src={resolverImagen(valor)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-1 text-center">
            <IconoCamara className="h-6 w-6" />
            <span className="text-[10px] font-semibold leading-tight">Sin imagen propia · se usa la del producto</span>
          </span>
        )}
      </button>

      {!soloLectura && (
        <div className="flex gap-2 text-[11px] font-semibold">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo} className="text-marino-700 hover:underline disabled:opacity-50">
            {tieneImagen ? 'Cambiar' : 'Subir'}
          </button>
          {tieneImagen && (
            <button type="button" onClick={() => onCambio(null)} disabled={subiendo} className="text-error-texto hover:underline disabled:opacity-50">
              Quitar
            </button>
          )}
        </div>
      )}

      {error && <p className="max-w-24 text-center text-[10px] font-medium text-error-texto">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void procesar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
