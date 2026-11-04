/** Tokens de diseno de ShopCart (propuesta aprobada). Nombres en espanol. */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marino: {
          900: '#0B1F3A',
          800: '#0A1830',
          700: '#13305E',
          600: '#1E3A8A',
        },
        ambar: '#F6A21E',
        naranja: {
          DEFAULT: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        dorado: '#FFD166',
        fondo: {
          DEFAULT: '#F6F7FA',
          2: '#EEF1F6',
        },
        superficie: '#FFFFFF',
        texto: '#0F172A',
        apagado: '#64748B',
        borde: 'rgba(15,23,42,.06)',
        exito: {
          DEFAULT: '#22C55E',
          texto: '#15803D',
        },
        advertencia: {
          DEFAULT: '#F59E0B',
          texto: '#B45309',
        },
        error: {
          DEFAULT: '#DC2626',
          texto: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        apretado: '-0.03em',
        ancho: '0.12em',
      },
      borderRadius: {
        12: '12px',
        16: '16px',
        20: '20px',
        28: '28px',
        pill: '9999px',
      },
      boxShadow: {
        suave: '0 10px 30px -22px rgba(11,31,58,.4)',
        elevada: '0 24px 40px -20px rgba(11,31,58,.35)',
        marino: '0 20px 40px -24px rgba(11,31,58,.7)',
        acento: '0 8px 20px -8px rgba(249,115,22,.7)',
      },
      backgroundImage: {
        'degradado-acento': 'linear-gradient(135deg,#F6A21E 0%,#F97316 100%)',
        'degradado-marino': 'linear-gradient(135deg,#0B1F3A,#1E3A8A)',
        'texto-degradado': 'linear-gradient(90deg,#FFD166,#F97316)',
      },
    },
  },
  plugins: [],
};
