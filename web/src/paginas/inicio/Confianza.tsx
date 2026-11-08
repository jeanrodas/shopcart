import { type ReactNode } from 'react';
import { IconoCamion, IconoDevolucion, IconoEscudo } from '../../componentes/iconos';

interface Tarjeta {
  Icono: (p: { className?: string }) => ReactNode;
  titulo: string;
  texto: string;
}

const TARJETAS: Tarjeta[] = [
  {
    Icono: IconoCamion,
    titulo: 'Entrega en 24 h',
    texto: 'Pedidos a domicilio en toda la ciudad, con seguimiento desde tu cuenta.',
  },
  {
    Icono: IconoEscudo,
    titulo: 'Pago seguro',
    texto: 'Tu pago se procesa una sola vez aunque la conexión falle. Sin cobros duplicados.',
  },
  {
    Icono: IconoDevolucion,
    titulo: 'Devoluciones sin complicaciones',
    texto: 'Si algo no era lo que esperabas, gestiona la devolución en pocos pasos.',
  },
];

export function Confianza() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="grid gap-4 sm:grid-cols-3">
        {TARJETAS.map(({ Icono, titulo, texto }) => (
          <div key={titulo} className="rounded-20 border border-borde bg-white p-6 shadow-suave">
            <span className="grid h-12 w-12 place-items-center rounded-16 bg-degradado-marino text-ambar shadow-marino">
              <Icono className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold tracking-apretado text-marino-900">{titulo}</h3>
            <p className="mt-1.5 text-sm text-apagado">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
