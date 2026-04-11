import React from 'react';
import { Alert, Snackbar } from '@mui/material';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Aviso persistente mientras no hay conexión (Wi‑Fi / datos inestables).
 */
export default function OfflineBanner() {
  const online = useNetworkStatus();

  return (
    <Snackbar
      open={!online}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      autoHideDuration={null}
      sx={{
        top: { xs: 8, sm: 16 },
        zIndex: (theme) => theme.zIndex.modal + 2,
      }}
    >
      <Alert severity="warning" variant="filled" sx={{ width: '100%', maxWidth: 560, alignItems: 'center' }}>
        Sin conexión. No podrás enviar pedidos hasta recuperar el acceso.
      </Alert>
    </Snackbar>
  );
}
