/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        latar: {
          aplikasi: '#F8FAFC',
          panel: '#FFFFFF',
          kanvas: '#F1F5F9',
          galat: '#FEF2F2',
        },
        garis: {
          panel: '#E2E8F0',
          aktif: '#0D9488',
        },
        teks: {
          utama: '#0F172A',
          sekunder: '#334155',
          redup: '#64748B',
        },
        primer: {
          DEFAULT: '#0D9488',
          sorot: '#0F766E',
          lembut: '#F0FDFA',
        },
        aksen: {
          DEFAULT: '#D97706',
        },
        status: {
          sukses: '#059669',
          peringatan: '#D97706',
          galat: '#DC2626',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        panel:
          '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
