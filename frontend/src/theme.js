// src/theme.js
import { createTheme } from '@mui/material/styles'

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
      default: '#FFFFFF',
      paper: '#F5F5F5'
    },
    text: {
      primary: '#212121',
      secondary: '#757575'
    },
    primary: {
      main: '#00796B',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: '#D84315'
    },
    divider: '#E0E0E0'
  },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'sans-serif'].join(','),
    h1: { fontSize: '24px', fontWeight: 600 },
    h2: { fontSize: '20px', fontWeight: 600 },
    body1: { fontSize: '16px', fontWeight: 400 },
    body2: { fontSize: '14px', fontWeight: 300 },
    button: { textTransform: 'none', fontWeight: 500 }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '12px 24px',
          minWidth: 44,
          minHeight: 44,
          boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          padding: '16px'
        }
      }
    }
  }
})

export default theme
