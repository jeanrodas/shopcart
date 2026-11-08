const formato = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un monto como "Q 1,234.50". Nunca calcula nada: solo presenta. */
export function formatearQuetzales(monto: number | null | undefined): string {
  const valor = typeof monto === 'number' && Number.isFinite(monto) ? monto : 0;
  // Intl con GTQ produce "Q1,234.50"; se normaliza a "Q 1,234.50".
  return formato.format(valor).replace(/^Q\s?/, 'Q ');
}

interface Props {
  monto: number | null | undefined;
  className?: string;
  tachado?: boolean;
}

export function Precio({ monto, className, tachado = false }: Props) {
  return (
    <span className={className} style={tachado ? { textDecoration: 'line-through' } : undefined}>
      {formatearQuetzales(monto)}
    </span>
  );
}
