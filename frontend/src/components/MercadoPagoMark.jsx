import React from 'react';
import { Box } from '@mui/material';

export const MP_BRAND_BLUE = '#009EE3';

/**
 * Isotipo Mercado Pago (SVG inline).
 * @param {{ onBrand?: boolean, sx?: object }} props — onBrand: blanco sobre fondo #009EE3
 */
export default function MercadoPagoMark({ onBrand = false, sx = {} }) {
  const stroke = onBrand ? 'rgba(255,255,255,0.95)' : MP_BRAND_BLUE;
  const fillSoft = onBrand ? 'rgba(255,255,255,0.2)' : 'rgba(0, 158, 227, 0.15)';
  const fillBar = onBrand ? 'rgba(255,255,255,0.45)' : 'rgba(0, 158, 227, 0.4)';
  const fillDot = onBrand ? '#ffffff' : MP_BRAND_BLUE;
  const fillDot2 = onBrand ? 'rgba(255,255,255,0.85)' : `${MP_BRAND_BLUE}99`;

  return (
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 28"
      sx={{ height: 24, width: 36, flexShrink: 0, display: 'block', ...sx }}
      aria-hidden
    >
      <rect x="0" y="4" width="36" height="20" rx="3" ry="3" fill={fillSoft} stroke={stroke} strokeWidth="1.5" />
      <rect x="4" y="8" width="28" height="4" rx="1" fill={fillBar} />
      <circle cx="8" cy="18" r="2" fill={fillDot} />
      <circle cx="14" cy="18" r="2" fill={fillDot2} />
    </Box>
  );
}
