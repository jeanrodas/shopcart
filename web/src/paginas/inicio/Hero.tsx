import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { clasesBoton } from '../../componentes/ui/Boton';
import { useToast } from '../../componentes/ui/Toast';
import { useCuponesVigentes } from '../../lib/consultas';
import { formatearFechaCorta, tiempoRestante } from '../../lib/formato';
import { IconoCopiar } from '../../componentes/iconos';

const DEGRADADO: CSSProperties = {
  background:
    'linear-gradient(90deg, rgba(7,20,40,.92) 0%, rgba(7,20,40,.72) 38%, rgba(7,20,40,.15) 70%, rgba(7,20,40,0) 100%)',
};

function retraso(indice: number): CSSProperties {
  return { animationDelay: `${indice * 0.08}s` };
}

export function Hero() {
  const { mostrar } = useToast();
  const { data } = useCuponesVigentes();
  const general = data?.cupones.find((c) => c.IDCategoria === null);

  // Etiqueta: "vence el ..." solo si el cupon general termina en 30 dias o menos.
  const venceProximo = (() => {
    if (!general) return false;
    const { dias, horas, vencido } = tiempoRestante(general.FechaFin);
    return !vencido && (dias < 30 || (dias === 30 && horas === 0));
  })();

  const copiar = async () => {
    if (!general) return;
    try {
      await navigator.clipboard.writeText(general.Codigo);
      mostrar('Cupón copiado', 'exito');
    } catch {
      mostrar('No se pudo copiar el cupón', 'error');
    }
  };

  return (
    <section className="relative overflow-hidden bg-marino-900">
      <img
        src="/img/hero-1.jpeg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0" style={DEGRADADO} />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-28">
        <div className="max-w-xl text-white">
          <span
            className="anim-fade inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            style={retraso(0)}
          >
            <span className="anim-blink h-2 w-2 rounded-pill bg-ambar" />
            {general
              ? venceProximo
                ? `Promoción de la semana · vence el ${formatearFechaCorta(general.FechaFin)}`
                : `Cupón ${general.Codigo} · ${general.Valor} % en toda la tienda`
              : 'Lo mejor para tu motor'}
          </span>

          <h1
            className="anim-fade mt-5 text-4xl font-extrabold leading-[1.05] tracking-apretado sm:text-5xl lg:text-[64px]"
            style={retraso(1)}
          >
            Cambio de aceite completo,{' '}
            <span className="texto-degradado">sin salir de casa</span>
          </h1>

          <p className="anim-fade mt-5 max-w-lg text-base text-white/85 sm:text-lg" style={retraso(2)}>
            Aceite sintético, filtro y aditivo en un solo pedido. Entrega a domicilio en 24 h y el
            precio que ves es el que pagas, con IVA incluido.
          </p>

          <div className="anim-fade mt-7 flex flex-wrap gap-3" style={retraso(3)}>
            <a href="#ofertas" className={clasesBoton('primario', 'lg')}>
              Ver ofertas
            </a>
            <Link
              to="/catalogo"
              className="inline-flex min-h-[52px] items-center justify-center rounded-pill border-[1.5px] border-white/40 px-7 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Explorar catálogo
            </Link>
          </div>

          {general && (
            <div
              className="anim-fade mt-8 inline-flex items-center gap-4 rounded-16 border border-dashed border-white/40 bg-white/5 px-4 py-3 backdrop-blur"
              style={retraso(4)}
            >
              <div className="leading-tight">
                <span className="block text-[11px] font-semibold uppercase tracking-ancho text-white/70">
                  Cupón
                </span>
                <span className="block font-mono text-lg font-bold tracking-ancho text-dorado">
                  {general.Codigo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void copiar()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-white px-4 text-sm font-bold text-marino-900 hover:bg-white/90"
              >
                <IconoCopiar className="h-4 w-4" />
                Copiar
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
