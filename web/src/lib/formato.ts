/** Utilidades de formato de fecha/tiempo para la tienda. */

const fechaCorta = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long' });
const fechaConAnio = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaLargaHora = new Intl.DateTimeFormat('es-GT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const horaCorta = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "3 de noviembre"; incluye el ano ("3 de noviembre de 2027") si no es del ano en curso. */
export function formatearFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = d.getFullYear() === new Date().getFullYear() ? fechaCorta : fechaConAnio;
  return fmt.format(d);
}

/** "3 de noviembre de 2026, 14:30" (fecha larga con hora). */
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return fechaLargaHora.format(d);
}

/** "3 nov, 14:30" (compacta con hora, para los hitos del historial). */
export function formatearFechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return horaCorta.format(d);
}

export interface TiempoRestante {
  dias: number;
  horas: number;
  vencido: boolean;
}

/** Dias y horas desde ahora hasta la fecha ISO dada. */
export function tiempoRestante(iso: string): TiempoRestante {
  const fin = new Date(iso).getTime();
  const ms = fin - Date.now();
  if (Number.isNaN(fin) || ms <= 0) {
    return { dias: 0, horas: 0, vencido: true };
  }
  const horasTotales = Math.floor(ms / 3_600_000);
  return { dias: Math.floor(horasTotales / 24), horas: horasTotales % 24, vencido: false };
}
