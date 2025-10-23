// src/theme.js
import { createTheme, responsiveFontSizes } from '@mui/material/styles';

let theme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  palette: {
    background: { default: '#FFFFFF', paper: '#F5F5F5' },
    text: { primary: '#212121', secondary: '#757575' },
    primary: { main: '#00796B', contrastText: '#FFFFFF' },
    secondary: { main: '#D84315' },
    divider: '#E0E0E0',
  },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'sans-serif'].join(','),
    h1: { fontSize: 'clamp(22px, 3.2vw, 28px)', fontWeight: 700 },
    h2: { fontSize: 'clamp(18px, 2.6vw, 22px)', fontWeight: 600 },
    body1: { fontSize: 'clamp(15px, 2.2vw, 17px)', fontWeight: 400 },
    body2: { fontSize: 'clamp(13px, 2vw, 15px)', fontWeight: 300 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 8 },
  components: {
    // Reglas globales para evitar overflow y tener imágenes fluidas
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%' },
        body: { minHeight: '100%', overflowX: 'hidden' },
        img: { maxWidth: '100%', height: 'auto', display: 'block' },
        '*, *::before, *::after': { boxSizing: 'border-box' },
      },
    },

    // Container centrado y con padding responsive por defecto
    MuiContainer: {
      defaultProps: { maxWidth: 'sm' },
      styleOverrides: {
        root: {
          paddingLeft: 'clamp(12px, 3vw, 24px)',
          paddingRight: 'clamp(12px, 3vw, 24px)',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1.25, 2),           // xs
          [theme.breakpoints.up('sm')]: {
            padding: theme.spacing(1.5, 3),          // sm+
          },
          minWidth: 44,
          minHeight: 44,
          boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
        }),
      },
    },

    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1.25),              // xs
          [theme.breakpoints.up('sm')]: {
            padding: theme.spacing(2),               // sm+
          },
        }),
      },
    },
  },
});

theme = responsiveFontSizes(theme);
export default theme;
