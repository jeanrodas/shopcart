import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDestacados } from '../../lib/consultas';
import { EncabezadoSeccion } from '../../componentes/ui/EncabezadoSeccion';
import { EstadoVista, TarjetaEsqueleto } from '../../componentes/ui/EstadoVista';
import { TarjetaProducto } from '../../componentes/ui/TarjetaProducto';
import { IconoFlechaDerecha, IconoFlechaIzquierda } from '../../componentes/iconos';

function BotonCarrusel({
  direccion,
  onClick,
}: {
  direccion: 'anterior' | 'siguiente';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direccion === 'anterior' ? 'Anterior' : 'Siguiente'}
      className="grid h-10 w-10 place-items-center rounded-pill border border-borde bg-white text-marino-700 shadow-suave hover:bg-fondo-2"
    >
      {direccion === 'anterior' ? (
        <IconoFlechaIzquierda className="h-5 w-5" />
      ) : (
        <IconoFlechaDerecha className="h-5 w-5" />
      )}
    </button>
  );
}

export function MasVendidos() {
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useDestacados();
  const carrusel = useRef<HTMLDivElement>(null);
  const items = data?.masVendidos ?? [];

  const desplazar = (dir: 1 | -1) => {
    carrusel.current?.scrollBy({ left: dir * 296, behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <EncabezadoSeccion
        antetitulo="Más vendidos"
        titulo="Lo que más llevan nuestros clientes"
        derecha={
          <div className="flex gap-2">
            <BotonCarrusel direccion="anterior" onClick={() => desplazar(-1)} />
            <BotonCarrusel direccion="siguiente" onClick={() => desplazar(1)} />
          </div>
        }
      />
      <EstadoVista
        cargando={isPending}
        error={isError}
        vacio={items.length === 0}
        alReintentar={() => void refetch()}
        tituloVacio="Todavía no hay ventas que mostrar"
        textoVacio="En cuanto haya pedidos, aquí aparecerán los favoritos."
        esqueleto={
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <TarjetaEsqueleto key={i} className="w-[272px] shrink-0" />
            ))}
          </div>
        }
      >
        <div
          ref={carrusel}
          className="sin-barra flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {items.map((p) => (
            <TarjetaProducto
              key={p.IDProducto}
              producto={p}
              posicion={p.Posicion}
              ancho="272px"
              className="snap-start shrink-0"
              enlace={`/producto/${p.IDProducto}`}
              alAgregar={() => navigate(`/producto/${p.IDProducto}`)}
            />
          ))}
        </div>
      </EstadoVista>
    </section>
  );
}
