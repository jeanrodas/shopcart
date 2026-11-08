import { Link } from 'react-router-dom';
import { clasesBoton } from '../componentes/ui/Boton';

export function NoEncontrado() {
  return (
    <section className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-16 text-center">
      <div>
        <p className="text-6xl font-extrabold tracking-apretado text-marino-600">404</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-apretado text-marino-900">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-apagado">
          Puede que el enlace esté roto o que la página se haya movido.
        </p>
        <Link to="/" className={`mt-6 ${clasesBoton('primario', 'md')}`}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
