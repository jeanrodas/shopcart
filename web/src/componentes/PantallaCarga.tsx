/** Pantalla de carga a pantalla completa (restauracion de sesion). */
export function PantallaCarga() {
  return (
    <div className="grid min-h-screen place-items-center bg-fondo" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-16 bg-degradado-marino shadow-marino">
          <svg className="h-6 w-6 animate-spin text-dorado" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-sm font-medium text-apagado">Cargando ShopCart…</p>
      </div>
    </div>
  );
}
