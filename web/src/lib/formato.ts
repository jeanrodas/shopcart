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

const soloHora = new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit' });

/** "Hoy 10:42" / "Ayer 09:15" / "3 nov, 14:30" para el ultimo movimiento del kardex. */
export function formatearMomento(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(d, hoy)) return `Hoy ${soloHora.format(d)}`;
  if (mismoDia(d, ayer)) return `Ayer ${soloHora.format(d)}`;
  return formatearFechaHoraCorta(iso);
}

/** "hace 15 min" / "hace 2 h" / "hace 3 d" a partir de una cantidad de minutos. */
export function formatearHace(minutos: number | null | undefined): string {
  if (minutos == null || minutos < 0) return '—';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
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
