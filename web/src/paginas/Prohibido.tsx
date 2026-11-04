import { Link } from 'react-router-dom';
import { clasesBoton } from '../componentes/ui/Boton';

export function Prohibido() {
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
      <div>
        <p className="text-6xl font-extrabold tracking-apretado text-naranja-600">403</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-apretado text-marino-900">
          No tienes acceso a esta página
        </h1>
        <p className="mt-2 text-apagado">
          Tu cuenta no tiene permiso para ver esta sección.
        </p>
        <Link to="/" className={`mt-6 ${clasesBoton('secundario', 'md')}`}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
