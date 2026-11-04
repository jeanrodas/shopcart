import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconoFlechaDerecha } from '../iconos';

interface Props {
  antetitulo: string;
  titulo: string;
  enlace?: { a: string; texto: string };
  derecha?: ReactNode;
}

export function EncabezadoSeccion({ antetitulo, titulo, enlace, derecha }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-ancho text-naranja-600">
          {antetitulo}
        </p>
        <h2 className="mt-1 text-[28px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[32px]">
          {titulo}
        </h2>
      </div>
      {enlace && (
        <Link
          to={enlace.a}
          className="inline-flex items-center gap-1 text-sm font-semibold text-marino-700 hover:text-marino-600"
        >
          {enlace.texto}
          <IconoFlechaDerecha className="h-4 w-4" />
        </Link>
      )}
      {derecha}
    </div>
  );
}
