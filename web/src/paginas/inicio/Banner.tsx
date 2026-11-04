import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useCategorias } from '../../lib/consultas';
import { clasesBoton } from '../../componentes/ui/Boton';

const DEGRADADO: CSSProperties = {
  background:
    'linear-gradient(270deg, rgba(7,20,40,.92) 0%, rgba(7,20,40,.72) 40%, rgba(7,20,40,.1) 78%, rgba(7,20,40,0) 100%)',
};

export function Banner() {
  const { data } = useCategorias();
  const lubricantes = data?.find((c) => c.Nombre === 'Lubricantes');
  const enlaceKit = lubricantes ? `/catalogo?idCategoria=${lubricantes.IDCategoria}` : '/catalogo';

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="relative overflow-hidden rounded-28 bg-marino-900 shadow-marino">
        <img
          src="/img/hero-2.jpeg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={DEGRADADO} />
        <div className="relative ml-auto max-w-lg p-8 text-right text-white sm:p-12">
          <p className="text-xs font-extrabold uppercase tracking-ancho text-dorado">
            Kit de cambio de aceite
          </p>
          <h3 className="mt-2 text-3xl font-extrabold tracking-apretado sm:text-[38px]">
            Aceite + filtro + aditivo, armado para tu motor
          </h3>
          <p className="mt-3 text-white/85">
            Arma el combo completo en minutos y recíbelo en casa. Todo compatible, sin
            sorpresas y con el IVA ya incluido.
          </p>
          <div className="mt-6 flex justify-end">
            <Link to={enlaceKit} className={clasesBoton('primario', 'lg')}>
              Armar mi kit
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
