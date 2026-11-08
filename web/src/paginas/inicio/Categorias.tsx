import { Link } from 'react-router-dom';
import { useCategorias } from '../../lib/consultas';
import { EncabezadoSeccion } from '../../componentes/ui/EncabezadoSeccion';
import { EstadoVista, TarjetaEsqueleto } from '../../componentes/ui/EstadoVista';
import type { Categoria } from '../../api/tipos';

/** Imagen fija por nombre de categoria (las demas usan un fondo degradado marino). */
const IMAGENES: Record<string, string> = {
  Lubricantes: '/img/productos/cat-lubricantes.jpeg',
  'Aditivos y Fluidos': '/img/productos/cat-aditivos.jpeg',
  Accesorios: '/img/productos/cat-accesorios.jpeg',
  Conveniencia: '/img/productos/cat-conveniencia.jpeg',
};

function TarjetaCategoria({ categoria }: { categoria: Categoria }) {
  const imagen = IMAGENES[categoria.Nombre];
  return (
    <Link
      to={`/catalogo?idCategoria=${categoria.IDCategoria}`}
      className="group relative block aspect-square overflow-hidden rounded-20 bg-marino-800 shadow-suave transition-transform hover:-translate-y-1"
    >
      {imagen ? (
        <img
          src={imagen}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
      ) : (
        <div className="absolute inset-0 bg-degradado-marino" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-marino-900/85 via-marino-900/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <h3 className="text-xl font-extrabold tracking-apretado">{categoria.Nombre}</h3>
        {categoria.Descripcion && (
          <p className="mt-0.5 line-clamp-2 text-[13px] text-white/80">{categoria.Descripcion}</p>
        )}
      </div>
    </Link>
  );
}

export function Categorias() {
  const { data, isPending, isError, refetch } = useCategorias();
  // Solo categorias con productos visibles, maximo 8, en el orden que entrega la API.
  const categorias = (data ?? []).filter((c) => c.ProductosVisibles > 0).slice(0, 8);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <EncabezadoSeccion
        antetitulo="Categorías"
        titulo="Todo lo que tu vehículo necesita"
        enlace={{ a: '/catalogo', texto: 'Ver catálogo completo' }}
      />
      <EstadoVista
        cargando={isPending}
        error={isError}
        vacio={categorias.length === 0}
        alReintentar={() => void refetch()}
        tituloVacio="Aún no hay categorías"
        textoVacio="Vuelve pronto: estamos preparando el catálogo."
        esqueleto={
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <TarjetaEsqueleto key={i} />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categorias.map((c) => (
            <TarjetaCategoria key={c.IDCategoria} categoria={c} />
          ))}
        </div>
      </EstadoVista>
    </section>
  );
}
