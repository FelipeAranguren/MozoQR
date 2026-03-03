// src/theme.js
import { createTheme } from '@mui/material/styles'

// Colores MarañaQR según el prompt
const MARANA_COLORS = {
  primary: '#0E7C7B',      // Teal principal
  secondary: '#F4A259',   // Naranja/dorado
  accent: '#F25C54',       // Rojo/coral
  background: '#F8F9FA',  // Fondo claro
  white: '#FFFFFF',
  border: '#E7E7E7',      // Bordes suaves
  textPrimary: '#212121',
  textSecondary: '#6B7280',
}

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536
    }
  },
  palette: {
    background: {
      default: MARANA_COLORS.background,
      paper: MARANA_COLORS.white
    },
    text: {
      primary: MARANA_COLORS.textPrimary,
      secondary: MARANA_COLORS.textSecondary
    },
    primary: {
      main: MARANA_COLORS.primary,
      light: '#14A5A3',
      dark: '#0A5F5E',
      contrastText: MARANA_COLORS.white
    },
    secondary: {
      main: MARANA_COLORS.secondary,
      light: '#F6B87A',
      dark: '#D88A3D',
      contrastText: MARANA_COLORS.white
    },
    error: {
      main: MARANA_COLORS.accent,
      light: '#F77A73',
      dark: '#D43D36'
    },
    divider: MARANA_COLORS.border,
    // Colores personalizados para el dashboard
    marana: {
      primary: MARANA_COLORS.primary,
      secondary: MARANA_COLORS.secondary,
      accent: MARANA_COLORS.accent,
      background: MARANA_COLORS.background,
      border: MARANA_COLORS.border,
    }
  },
  typography: {
    fontFamily: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'].join(','),
    h1: { fontSize: '32px', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '24px', fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: '20px', fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: '18px', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: '16px', fontWeight: 600, lineHeight: 1.5 },
    h6: { fontSize: '14px', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '16px', fontWeight: 400, lineHeight: 1.6 },
    body2: { fontSize: '14px', fontWeight: 400, lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 500, fontSize: '14px' },
    caption: { fontSize: '12px', fontWeight: 400, lineHeight: 1.4 }
  },
  shape: {
    borderRadius: 12  // Bordes más suaves como Stripe/Notion
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '10px 20px',
          minWidth: 44,
          minHeight: 44,
          borderRadius: 8,
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 8px rgba(14, 124, 123, 0.15)'
          }
        },
        contained: {
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(14, 124, 123, 0.25)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${MARANA_COLORS.border}`,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
          padding: '20px',
          backgroundColor: MARANA_COLORS.white,
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)'
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${MARANA_COLORS.border}`
        }
      }
    }
  }
})

export default theme
export { MARANA_COLORS }