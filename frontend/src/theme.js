// src/theme.js — sistema visual neutro / editorial (restaurante + operaciones)
import { alpha, createTheme } from '@mui/material/styles'

/** Tokens exportados para componentes que aún no usan solo `theme` */
const MARANA_COLORS = {
  primary: '#18181b',
  primarySoft: '#f4f4f5',
  primaryMuted: '#71717a',
  secondary: '#ea580c',
  accent: '#dc2626',
  success: '#15803d',
  warning: '#ca8a04',
  error: '#dc2626',
  info: '#0369a1',
  background: '#f5f5f4',
  backgroundAlt: '#fafaf9',
  surface: '#ffffff',
  surfaceStrong: '#f5f5f4',
  white: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  textPrimary: '#0c0a09',
  textSecondary: '#57534e',
  textMuted: '#78716c',
  shadow: 'rgba(15, 23, 42, 0.06)',
}

const theme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  palette: {
    background: {
      default: MARANA_COLORS.background,
      paper: MARANA_COLORS.surface,
    },
    text: {
      primary: MARANA_COLORS.textPrimary,
      secondary: MARANA_COLORS.textSecondary,
    },
    primary: {
      main: MARANA_COLORS.primary,
      light: '#3f3f46',
      dark: '#09090b',
      contrastText: MARANA_COLORS.white,
    },
    secondary: {
      main: MARANA_COLORS.secondary,
      light: '#fb923c',
      dark: '#c2410c',
      contrastText: MARANA_COLORS.white,
    },
    success: {
      main: MARANA_COLORS.success,
      light: '#dcfce7',
      dark: '#14532d',
      contrastText: MARANA_COLORS.white,
    },
    warning: {
      main: MARANA_COLORS.warning,
      light: '#fef9c3',
      dark: '#854d0e',
      contrastText: '#0c0a09',
    },
    error: {
      main: MARANA_COLORS.error,
      light: '#fee2e2',
      dark: '#991b1b',
      contrastText: MARANA_COLORS.white,
    },
    info: {
      main: MARANA_COLORS.info,
      light: '#e0f2fe',
      dark: '#075985',
      contrastText: MARANA_COLORS.white,
    },
    divider: MARANA_COLORS.border,
    marana: {
      primary: MARANA_COLORS.primary,
      secondary: MARANA_COLORS.secondary,
      accent: MARANA_COLORS.accent,
      background: MARANA_COLORS.background,
      border: MARANA_COLORS.border,
      borderStrong: MARANA_COLORS.borderStrong,
      surface: MARANA_COLORS.surface,
      surfaceStrong: MARANA_COLORS.surfaceStrong,
      textMuted: MARANA_COLORS.textMuted,
      success: MARANA_COLORS.success,
      warning: MARANA_COLORS.warning,
      error: MARANA_COLORS.error,
      info: MARANA_COLORS.info,
    },
  },
  typography: {
    fontFamily: ['"Plus Jakarta Sans"', 'Manrope', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'].join(','),
    h1: { fontSize: 'clamp(2rem, 3.8vw, 3.25rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em' },
    h2: { fontSize: 'clamp(1.65rem, 2.8vw, 2.35rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.028em' },
    h3: { fontSize: 'clamp(1.35rem, 2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
    h4: { fontSize: '1.25rem', fontWeight: 650, lineHeight: 1.25, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.05rem', fontWeight: 650, lineHeight: 1.35, letterSpacing: '-0.015em' },
    h6: { fontSize: '0.9375rem', fontWeight: 650, lineHeight: 1.4, letterSpacing: '-0.01em' },
    subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.01em' },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: '0.9375rem', fontWeight: 450, lineHeight: 1.65, letterSpacing: '-0.008em' },
    body2: { fontSize: '0.875rem', fontWeight: 450, lineHeight: 1.6, letterSpacing: '-0.008em' },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em' },
    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.45, letterSpacing: '0.02em' },
    overline: { fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.12em' },
  },
  shape: {
    borderRadius: 10,
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: MARANA_COLORS.background,
          color: MARANA_COLORS.textPrimary,
        },
        '::selection': {
          backgroundColor: alpha(MARANA_COLORS.secondary, 0.2),
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(MARANA_COLORS.surface, 0.88),
          color: MARANA_COLORS.textPrimary,
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${MARANA_COLORS.border}`,
          boxShadow: `0 1px 0 ${alpha(MARANA_COLORS.textPrimary, 0.06)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '10px 18px',
          minWidth: 44,
          minHeight: 44,
          borderRadius: 8,
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
          '&:hover': {
            boxShadow: 'none',
            transform: 'none',
          },
        },
        outlined: {
          borderWidth: 1,
          borderColor: MARANA_COLORS.borderStrong,
          backgroundColor: MARANA_COLORS.surface,
          '&:hover': {
            borderWidth: 1,
            borderColor: MARANA_COLORS.textMuted,
            backgroundColor: MARANA_COLORS.backgroundAlt,
          },
        },
        contained: {
          backgroundImage: 'none',
          backgroundColor: MARANA_COLORS.primary,
          '&:hover': {
            backgroundColor: '#27272a',
            boxShadow: 'none',
          },
        },
        containedSecondary: {
          backgroundColor: MARANA_COLORS.secondary,
          '&:hover': {
            backgroundColor: '#c2410c',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${MARANA_COLORS.border}`,
          boxShadow: 'none',
          backgroundColor: MARANA_COLORS.surface,
          '&:hover': {
            borderColor: MARANA_COLORS.borderStrong,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${MARANA_COLORS.border}`,
          backgroundImage: 'none',
          backgroundColor: MARANA_COLORS.surface,
          boxShadow: `0 1px 2px ${MARANA_COLORS.shadow}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          border: `1px solid ${MARANA_COLORS.border}`,
          backgroundColor: MARANA_COLORS.backgroundAlt,
          '&.MuiChip-colorPrimary': {
            backgroundColor: MARANA_COLORS.primary,
            color: MARANA_COLORS.white,
            borderColor: MARANA_COLORS.primary,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: MARANA_COLORS.surface,
          '& fieldset': {
            borderColor: MARANA_COLORS.borderStrong,
          },
          '&:hover fieldset': {
            borderColor: MARANA_COLORS.textMuted,
          },
          '&.Mui-focused fieldset': {
            borderWidth: 1,
            borderColor: MARANA_COLORS.primary,
            boxShadow: `0 0 0 3px ${alpha(MARANA_COLORS.primary, 0.12)}`,
          },
          '&.Mui-disabled': {
            backgroundColor: MARANA_COLORS.backgroundAlt,
          },
        },
        input: {
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: {
          height: 2,
          borderRadius: 0,
          backgroundColor: MARANA_COLORS.primary,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 600,
          paddingLeft: 16,
          paddingRight: 16,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          backgroundColor: MARANA_COLORS.surface,
          border: `1px solid ${MARANA_COLORS.border}`,
          boxShadow: `0 25px 50px -12px ${alpha('#0c0a09', 0.2)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: MARANA_COLORS.surface,
          borderRight: `1px solid ${MARANA_COLORS.border}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
        standardSuccess: { backgroundColor: alpha(MARANA_COLORS.success, 0.1) },
        standardWarning: { backgroundColor: alpha(MARANA_COLORS.warning, 0.12) },
        standardError: { backgroundColor: alpha(MARANA_COLORS.error, 0.1) },
        standardInfo: { backgroundColor: alpha(MARANA_COLORS.info, 0.1) },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginInline: 6,
          '&.Mui-selected': {
            backgroundColor: alpha(MARANA_COLORS.primary, 0.08),
            color: MARANA_COLORS.primary,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: MARANA_COLORS.border },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: `0 4px 14px ${alpha(MARANA_COLORS.textPrimary, 0.12)}`,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          backgroundColor: alpha('#18181b', 0.92),
          fontWeight: 500,
          fontSize: '0.8125rem',
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: MARANA_COLORS.backgroundAlt,
          padding: 4,
          border: `1px solid ${MARANA_COLORS.border}`,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: 6,
          fontWeight: 600,
          color: MARANA_COLORS.textSecondary,
          '&.Mui-selected': {
            backgroundColor: MARANA_COLORS.surface,
            color: MARANA_COLORS.primary,
            boxShadow: `0 1px 2px ${MARANA_COLORS.shadow}`,
          },
        },
      },
    },
  },
})

export default theme
export { MARANA_COLORS }
