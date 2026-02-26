// frontend/src/components/ConfirmModal.jsx
import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import { MARANA_COLORS } from '../theme';

/**
 * Modal de confirmación reutilizable.
 * Bloquea el scroll del fondo (disableScrollLock=false por defecto) y es accesible vía MUI Dialog.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message = '¿Estás seguro?',
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  confirmColor = MARANA_COLORS.primary,
  loading = false
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          minWidth: 320,
          maxWidth: 420
        }
      }}
      disableScrollLock={false}
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <DialogTitle
        id="confirm-modal-title"
        sx={{
          fontWeight: 700,
          fontSize: '1.125rem',
          color: MARANA_COLORS.textPrimary,
          pt: 2.5,
          px: 3
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
        <Typography
          id="confirm-modal-description"
          variant="body1"
          color="text.secondary"
          sx={{ lineHeight: 1.5 }}
        >
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{
            borderColor: MARANA_COLORS.border,
            color: MARANA_COLORS.textPrimary,
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              borderColor: MARANA_COLORS.textSecondary,
              bgcolor: 'rgba(0,0,0,0.04)'
            }
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={loading}
          sx={{
            bgcolor: confirmColor,
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { bgcolor: confirmColor, filter: 'brightness(0.95)' }
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
