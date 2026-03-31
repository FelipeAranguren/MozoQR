import { alpha, createTheme } from '@mui/material/styles'

/*
 * MozoQR Design System v2
 *
 * Palette: warm neutral base (stone scale) with a single confident accent.
 * Primary = near-black for premium weight.
 * Secondary = deep teal-green for operational/action contexts.
 * No random one-off colors in pages; everything flows from this file.
 *
 * Radius scale: 6 (controls) · 8 (inputs, chips) · 10 (cards) · 12 (panels) · 16 (hero/modal)
 * Spacing: MUI default 8px grid, tightened for mobile via px/py overrides.
 * Shadows: single-source warm-neutral tone rgba(12,10,9, …).
 */

const C = {
  // ── Brand
  primary:        '#18181b',
  primaryLight:   '#3f3f46',
  primaryDark:    '#09090b',

  secondary:      '#0d9488', // teal-600 — calming, trust, restaurant-appropriate
  secondaryLight: '#5eead4',
  secondaryDark:  '#115e59',

  accent:         '#ea580c', // orange-600 — used sparingly: badges, promotions

  // ── Semantic
  success:        '#16a34a',
  successBg:      '#f0fdf4',
  warning:        '#d97706',
  warningBg:      '#fffbeb',
  error:          '#dc2626',
  errorBg:        '#fef2f2',
  info:           '#0284c7',
  infoBg:         '#f0f9ff',

  // ── Neutral (zinc scale — cooler than stone, more professional)
  white:          '#ffffff',
  bg:             '#fafafa',
  bgAlt:          '#f4f4f5',
  surface:        '#ffffff',
  surfaceRaised:  '#fafafa',
  border:         '#e4e4e7',
  borderStrong:   '#d4d4d8',
  text:           '#09090b',
  textSecondary:  '#52525b',
  textMuted:      '#a1a1aa',
  textOnDark:     '#ffffff',

  // ── Shadows (single warm-neutral hue)
  shadow1: '0 1px 2px rgba(9,9,11,0.05)',
  shadow2: '0 1px 3px rgba(9,9,11,0.08), 0 1px 2px rgba(9,9,11,0.04)',
  shadow3: '0 4px 12px rgba(9,9,11,0.08)',
  shadow4: '0 8px 24px rgba(9,9,11,0.10)',
  shadow5: '0 20px 48px rgba(9,9,11,0.12)',
}

const RADIUS = { xs: 6, sm: 8, md: 10, lg: 12, xl: 16 }

const theme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },

  palette: {
    background: { default: C.bg, paper: C.surface },
    text:       { primary: C.text, secondary: C.textSecondary, disabled: C.textMuted },
    primary:    { main: C.primary, light: C.primaryLight, dark: C.primaryDark, contrastText: C.white },
    secondary:  { main: C.secondary, light: C.secondaryLight, dark: C.secondaryDark, contrastText: C.white },
    success:    { main: C.success, light: C.successBg, contrastText: C.white },
    warning:    { main: C.warning, light: C.warningBg, contrastText: '#422006' },
    error:      { main: C.error, light: C.errorBg, contrastText: C.white },
    info:       { main: C.info, light: C.infoBg, contrastText: C.white },
    divider:    C.border,
    action:     { selected: alpha(C.primary, 0.06), hover: alpha(C.primary, 0.04) },
  },

  typography: {
    fontFamily: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'].join(','),
    h1: { fontSize: 'clamp(2rem, 3.8vw, 3.25rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.025em' },
    h2: { fontSize: 'clamp(1.65rem, 2.8vw, 2.35rem)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em' },
    h3: { fontSize: 'clamp(1.35rem, 2vw, 1.75rem)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.018em' },
    h4: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.015em' },
    h5: { fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.01em' },
    h6: { fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.008em' },
    subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.008em' },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.65 },
    body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '-0.006em' },
    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.01em' },
    overline: { fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
  },

  shape: { borderRadius: RADIUS.md },
  spacing: 8,

  components: {
    /* ── Baseline ─────────────────────────────────────────────── */
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: C.bg, color: C.text },
        '::selection': { backgroundColor: alpha(C.secondary, 0.18) },
      },
    },

    /* ── AppBar ───────────────────────────────────────────────── */
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(C.surface, 0.92),
          color: C.text,
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${C.border}`,
          boxShadow: 'none',
        },
      },
    },

    /* ── Buttons ──────────────────────────────────────────────── */
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          padding: '10px 20px',
          minHeight: 44,
          borderRadius: RADIUS.sm,
          fontWeight: 600,
          textTransform: 'none',
          transition: 'background-color 150ms, border-color 150ms, color 150ms, box-shadow 150ms',
        },
        sizeSmall: { padding: '6px 14px', minHeight: 36, fontSize: '0.8125rem' },
        sizeLarge: { padding: '12px 24px', minHeight: 48, fontSize: '0.9375rem' },
        contained: {
          backgroundColor: C.primary,
          color: C.white,
          '&:hover': { backgroundColor: C.primaryLight },
        },
        containedSecondary: {
          backgroundColor: C.secondary,
          color: C.white,
          '&:hover': { backgroundColor: C.secondaryDark },
        },
        outlined: {
          borderColor: C.borderStrong,
          backgroundColor: C.surface,
          color: C.text,
          '&:hover': { borderColor: C.textMuted, backgroundColor: C.bgAlt },
        },
        text: {
          color: C.textSecondary,
          '&:hover': { backgroundColor: alpha(C.primary, 0.04) },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: RADIUS.sm },
      },
    },

    /* ── Cards & Paper ────────────────────────────────────────── */
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: RADIUS.lg,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadow1,
          backgroundColor: C.surface,
          transition: 'border-color 200ms, box-shadow 200ms',
          '&:hover': { borderColor: C.borderStrong },
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: RADIUS.lg,
          backgroundImage: 'none',
          backgroundColor: C.surface,
        },
      },
    },

    /* ── Chips ────────────────────────────────────────────────── */
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          fontWeight: 600,
          fontSize: '0.8125rem',
          height: 34,
        },
        colorPrimary: {
          backgroundColor: C.primary,
          color: C.white,
        },
        colorDefault: {
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          color: C.text,
        },
      },
    },

    /* ── Inputs ───────────────────────────────────────────────── */
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          backgroundColor: C.surface,
          '& fieldset':           { borderColor: C.border },
          '&:hover fieldset':     { borderColor: C.borderStrong },
          '&.Mui-focused fieldset': { borderWidth: 1.5, borderColor: C.primary, boxShadow: `0 0 0 3px ${alpha(C.primary, 0.08)}` },
          '&.Mui-disabled':       { backgroundColor: C.bgAlt },
        },
        input: { padding: '12px 14px' },
      },
    },

    /* ── Tabs ─────────────────────────────────────────────────── */
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 2.5, borderRadius: 2, backgroundColor: C.primary },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
        },
      },
    },

    /* ── Dialogs ──────────────────────────────────────────────── */
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: RADIUS.xl,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadow5,
        },
      },
    },

    /* ── Drawers ──────────────────────────────────────────────── */
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: C.surface,
          borderRight: `1px solid ${C.border}`,
        },
      },
    },

    /* ── Alerts ───────────────────────────────────────────────── */
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: RADIUS.sm },
        standardSuccess: { backgroundColor: C.successBg, color: '#14532d' },
        standardWarning: { backgroundColor: C.warningBg, color: '#78350f' },
        standardError:   { backgroundColor: C.errorBg, color: '#7f1d1d' },
        standardInfo:    { backgroundColor: C.infoBg, color: '#0c4a6e' },
      },
    },

    /* ── Lists ────────────────────────────────────────────────── */
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          marginInline: 4,
          '&.Mui-selected': {
            backgroundColor: alpha(C.primary, 0.06),
            color: C.primary,
            '&:hover': { backgroundColor: alpha(C.primary, 0.08) },
          },
        },
      },
    },

    /* ── Dividers ─────────────────────────────────────────────── */
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: C.border },
      },
    },

    /* ── FAB ──────────────────────────────────────────────────── */
    MuiFab: {
      styleOverrides: {
        root: { boxShadow: C.shadow3 },
      },
    },

    /* ── Tooltip ──────────────────────────────────────────────── */
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: RADIUS.xs,
          backgroundColor: alpha(C.primary, 0.92),
          fontWeight: 500,
          fontSize: '0.8125rem',
        },
      },
    },

    /* ── Toggle ──────────────────────────────────────────────── */
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.sm,
          backgroundColor: C.bgAlt,
          padding: 3,
          border: `1px solid ${C.border}`,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: RADIUS.xs,
          fontWeight: 600,
          color: C.textSecondary,
          '&.Mui-selected': {
            backgroundColor: C.surface,
            color: C.primary,
            boxShadow: C.shadow2,
          },
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: { root: { borderRadius: RADIUS.sm } },
    },
  },
})

export default theme

export const COLORS = C
export const RADIUS_SCALE = RADIUS

// Legacy alias so existing imports don't break
export const MARANA_COLORS = {
  primary:       C.primary,
  primarySoft:   C.bgAlt,
  primaryMuted:  C.textMuted,
  secondary:     C.secondary,
  accent:        C.accent,
  success:       C.success,
  warning:       C.warning,
  error:         C.error,
  info:          C.info,
  background:    C.bg,
  backgroundAlt: C.bgAlt,
  surface:       C.surface,
  surfaceStrong: C.surfaceRaised,
  white:         C.white,
  border:        C.border,
  borderStrong:  C.borderStrong,
  textPrimary:   C.text,
  textSecondary: C.textSecondary,
  textMuted:     C.textMuted,
  shadow:        'rgba(9,9,11,0.06)',
}
