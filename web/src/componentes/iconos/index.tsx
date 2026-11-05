import { type ReactNode } from 'react';

interface PropsIcono {
  className?: string;
}

/** Envoltorio SVG de trazo (stroke = currentColor). Tamano con clases h-/w-. */
function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconoCarrito = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
    <path d="M2.5 3h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
  </Svg>
);

export const IconoBuscar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconoUsuario = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const IconoMas = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconoCheck = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const IconoAlerta = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M12 3.2 1.8 20.5h20.4L12 3.2Z" />
    <path d="M12 9.5v5M12 17.4h.01" />
  </Svg>
);

export const IconoInfo = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const IconoCerrar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M6 6 18 18M18 6 6 18" />
  </Svg>
);

export const IconoCamion = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M2.5 6.5h11v9h-11z" />
    <path d="M13.5 9.5H18l3 3v3h-7.5" />
    <circle cx="6" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </Svg>
);

export const IconoEscudo = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M12 2.8 4.5 6v6c0 4.6 3.1 7.7 7.5 9.2 4.4-1.5 7.5-4.6 7.5-9.2V6L12 2.8Z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.6" />
  </Svg>
);

export const IconoDevolucion = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M9 5 4.5 9.5 9 14" />
    <path d="M4.5 9.5H15a4.5 4.5 0 0 1 0 9H8" />
  </Svg>
);

export const IconoFlechaIzquierda = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M14 6 8 12l6 6" />
  </Svg>
);

export const IconoFlechaDerecha = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="m10 6 6 6-6 6" />
  </Svg>
);

export const IconoInicio = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9h12v-9" />
  </Svg>
);

export const IconoBolsa = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

export const IconoOjo = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconoOjoCerrado = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M3 4 21 20" />
    <path d="M9.5 6C10.3 5.7 11.1 5.5 12 5.5c6.5 0 10.2 6.5 10.2 6.5a17 17 0 0 1-3 3.7" />
    <path d="M6.5 7.8A17 17 0 0 0 1.8 12S5.5 18.5 12 18.5c1 0 1.9-.2 2.8-.5" />
  </Svg>
);

export const IconoMenos = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M5 12h14" />
  </Svg>
);

export const IconoFiltro = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
  </Svg>
);

export const IconoBasura = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IconoCopiar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
