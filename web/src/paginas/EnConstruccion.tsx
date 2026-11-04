import { Link } from 'react-router-dom';
import { clasesBoton } from '../componentes/ui/Boton';

export function EnConstruccion({ titulo = 'En construcción' }: { titulo?: string }) {
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
      <div>
        <span className="inline-flex rounded-pill bg-marino-600/10 px-3 py-1 text-xs font-extrabold uppercase tracking-ancho text-marino-700">
          Próximamente
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-apretado text-marino-900">{titulo}</h1>
        <p className="mt-2 text-apagado">
          Estamos construyendo esta sección. Vuelve pronto para verla en acción.
        </p>
        <Link to="/" className={`mt-6 ${clasesBoton('secundario', 'md')}`}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
