module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        compass: {
          bg:       '#04070f',
          panel:    '#080e1c',
          border:   '#1a2a4a',
          cyan:     '#00d4ff',
          cyanDim:  '#0088aa',
          gold:     '#c8a84b',
          goldDim:  '#7a6020',
          blue:     '#1a6fe0',
          blueDim:  '#0d3a7a',
          red:      '#e02020',
          redDim:   '#7a0d0d',
          text:     '#c0d8f0',
          textDim:  '#4a6080',
        },
      },
      fontFamily: {
        hud: ['"Rajdhani"', '"M PLUS 1p"', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow':  '0 0 8px rgba(0,212,255,0.5), 0 0 20px rgba(0,212,255,0.2)',
        'gold-glow':  '0 0 8px rgba(200,168,75,0.5), 0 0 20px rgba(200,168,75,0.2)',
        'blue-glow':  '0 0 8px rgba(26,111,224,0.6)',
        'red-glow':   '0 0 8px rgba(224,32,32,0.6)',
      },
      keyframes: {
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        flicker: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.92' },
        },
        pulse_cyan: {
          '0%,100%': { boxShadow: '0 0 4px rgba(0,212,255,0.4)' },
          '50%':     { boxShadow: '0 0 12px rgba(0,212,255,0.9)' },
        },
      },
      animation: {
        scanline:    'scanline 8s linear infinite',
        flicker:     'flicker 4s ease-in-out infinite',
        pulse_cyan:  'pulse_cyan 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
