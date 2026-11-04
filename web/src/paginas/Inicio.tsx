import { Hero } from './inicio/Hero';
import { Categorias } from './inicio/Categorias';
import { MasVendidos } from './inicio/MasVendidos';
import { Ofertas } from './inicio/Ofertas';
import { Banner } from './inicio/Banner';
import { Confianza } from './inicio/Confianza';

export default function Inicio() {
  return (
    <>
      <Hero />
      <Categorias />
      <MasVendidos />
      <Ofertas />
      <Banner />
      <Confianza />
    </>
  );
}
