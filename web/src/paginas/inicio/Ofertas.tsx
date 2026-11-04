import { useNavigate } from 'react-router-dom';
import { useCuponesVigentes, useDestacados } from '../../lib/consultas';
import { tiempoRestante } from '../../lib/formato';
import { useToast } from '../../componentes/ui/Toast';
import { EncabezadoSeccion } from '../../componentes/ui/EncabezadoSeccion';
import { EstadoVista, TarjetaEsqueleto } from '../../componentes/ui/EstadoVista';
import { TarjetaProducto } from '../../componentes/ui/TarjetaProducto';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import { IconoCopiar } from '../../componentes/iconos';
import type { CuponVigente } from '../../api/tipos';

/** Pill solo si el cupon de categoria vigente mas proximo termina en 30 dias o menos. */
function PillCuentaRegresiva() {
  const { data } = useCuponesVigentes();
  const deCategoria = (data?.cupones ?? []).filter((c) => c.IDCategoria !== null);
  if (deCategoria.length === 0) return null;
  const proxima = deCategoria.reduce((min, c) => (c.FechaFin < min ? c.FechaFin : min), deCategoria[0]!.FechaFin);
  const { dias, horas, vencido } = tiempoRestante(proxima);
  if (vencido) return null;
  const dentroDe30 = dias < 30 || (dias === 30 && horas === 0);
  if (!dentroDe30) return null;
  const texto = dias < 1 ? 'Termina hoy' : `Termina en ${dias} d ${horas} h`;
  return (
    <span className="rounded-pill bg-white px-4 py-2 text-sm font-bold text-marino-700 shadow-suave">
      {texto}
    </span>
  );
}

/** Tarjeta de un cupon de categoria MONTO (aplica una vez por carrito, no por unidad). */
function TarjetaCuponMonto({ cupon }: { cupon: CuponVigente }) {
  const { mostrar } = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cupon.Codigo);
      mostrar('Cupón copiado', 'exito');
    } catch {
      mostrar('No se pudo copiar el cupón', 'error');
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-16 bg-degradado-marino p-4 text-white shadow-marino">
      <span className="font-mono text-lg font-bold tracking-ancho text-dorado">{cupon.Codigo}</span>
      <p className="text-sm font-semibold">
        {formatearQuetzales(cupon.Valor)} de descuento en {cupon.Categoria}
      </p>
      {cupon.MontoMinimo > 0 && (
        <p className="text-[12px] text-white/70">en compras desde {formatearQuetzales(cupon.MontoMinimo)}</p>
      )}
      <button
        type="button"
        onClick={() => void copiar()}
        className="mt-1 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-pill bg-white px-4 text-sm font-bold text-marino-900 hover:bg-white/90"
      >
        <IconoCopiar className="h-4 w-4" />
        Copiar
      </button>
    </div>
  );
}

export function Ofertas() {
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useDestacados();
  const { data: cuponesData } = useCuponesVigentes();
  const ofertas = data?.ofertas ?? [];
  const cuponesMonto = (cuponesData?.cupones ?? []).filter(
    (c) => c.IDCategoria !== null && c.TipoDescuento === 'MONTO',
  );

  // Sin ofertas, sin cupones de monto y ya cargado (sin error): la seccion entera se oculta.
  if (!isPending && !isError && ofertas.length === 0 && cuponesMonto.length === 0) {
    return null;
  }

  const mostrarCuadricula = isPending || isError || ofertas.length > 0;

  return (
    <section id="ofertas" className="scroll-mt-24 bg-gradient-to-b from-fondo to-fondo-2">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <EncabezadoSeccion
          antetitulo="Ofertas de la semana"
          titulo="Precios que no se quedan quietos"
          derecha={<PillCuentaRegresiva />}
        />
        {mostrarCuadricula && (
          <EstadoVista
            cargando={isPending}
            error={isError}
            vacio={false}
            alReintentar={() => void refetch()}
            esqueleto={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <TarjetaEsqueleto key={i} />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ofertas.map((o) => (
                <TarjetaProducto
                  key={o.IDProducto}
                  producto={o}
                  oferta={{
                    precioConCupon: o.PrecioConCupon,
                    cupon: o.CuponCodigo,
                    tipoDescuento: o.TipoDescuento,
                    valor: o.Valor,
                    montoMinimo: o.MontoMinimo,
                  }}
                  enlace={`/producto/${o.IDProducto}?cupon=${encodeURIComponent(o.CuponCodigo)}`}
                  alAgregar={() =>
                    navigate(`/producto/${o.IDProducto}?cupon=${encodeURIComponent(o.CuponCodigo)}`)
                  }
                />
              ))}
            </div>
          </EstadoVista>
        )}

        {cuponesMonto.length > 0 && (
          <div className={mostrarCuadricula ? 'mt-6' : ''}>
            <p className="mb-3 text-sm font-semibold text-apagado">
              Cupones de monto fijo (se aplican una vez por carrito):
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {cuponesMonto.map((c) => (
                <TarjetaCuponMonto key={c.IDCupon} cupon={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
