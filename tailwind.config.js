/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{html,js,ts}"
  ],
  theme: {
    extend: {
      fontSize: {
        '2xs': [
          '11px', {
            lineHeight: '14px',
            letterSpacing: '0.25px',
            fontWeight: '400',
          }
        ],
        '3xs': [
          '8px', {
            lineHeight: '10px',
            letterSpacing: '0.25px',
            fontWeight: '400',
          }
        ],
      },
      minWidth: {
        '2xs' : '225px',
        'screen': '100vw',
      },
      maxWidth: {
        'half': '50%',
        '33': '33%',
        '67': '67%',
        '2xs' : '225px',
        '3xs' : '120px',
      },
      minHeight: {
        '2xs' : '250px',
        'mobile': '100svh'
      },
      maxHeight: {
        'lgview': 'calc(100vh - 96px)',
        'mobile': '100svh'
      },
      height: {
        'mobile': '100svh'
      },
    },
  },
  plugins: [],
}

