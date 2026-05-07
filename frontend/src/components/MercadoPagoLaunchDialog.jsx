import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import {
  tryOpenMercadoPagoNativeApp,
  openMercadoPagoInWebBrowser,
} from '../utils/openMercadoPagoCheckout';

/**
 * En móvil, abrir la app MP requiere un gesto explícito; tras crear la preferencia mostramos este diálogo.
 */
export default function MercadoPagoLaunchDialog({ open, onClose, initPoint, preferenceId }) {
  const web = initPoint || '';

  const handleApp = (e) => {
    e.preventDefault();
    tryOpenMercadoPagoNativeApp({ initPoint: web, preferenceId });
  };

  const handleWeb = (e) => {
    e.preventDefault();
    openMercadoPagoInWebBrowser(web);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>Mercado Pago</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Tocá &quot;Abrir app&quot; para intentar pagar con la aplicación de Mercado Pago. Si no se abre o
          preferís pagar en el navegador, usá el otro botón.
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{ flexDirection: 'column', alignItems: 'stretch', px: 3, pb: 2, gap: 1 }}
      >
        <Button variant="contained" onClick={handleApp} fullWidth sx={{ textTransform: 'none' }}>
          Abrir app de Mercado Pago
        </Button>
        <Button variant="outlined" onClick={handleWeb} fullWidth sx={{ textTransform: 'none' }}>
          Continuar en el navegador
        </Button>
        <Button onClick={onClose} color="inherit" size="small" sx={{ textTransform: 'none' }}>
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
