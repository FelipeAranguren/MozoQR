// frontend/src/components/ui/ConfirmActionModal.jsx
import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { MARANA_COLORS } from '../../theme';

/**
 * Modal de confirmación estándar para el OwnerDashboard.
 * - Fondo con desenfoque sutil (backdrop-blur).
 * - Tarjeta blanca con bordes redondeados.
 * - Botón Confirmar con verde corporativo; Cancelar minimalista.
 * - Cierre con clic fuera o tecla Esc.
 */
export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar',
  message = '¿Estás seguro?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  showWarningIcon = true
}) {
  const handleConfirm = () => {
    onConfirm?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !loading) onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, loading, onClose]);

  return (
    <Dialog
      open={!!isOpen}
      onClose={loading ? undefined : onClose}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          minWidth: 320,
          maxWidth: 420,
          overflow: 'hidden',
          border: `1px solid ${MARANA_COLORS.border}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
        }
      }}
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }
      }}
      aria-labelledby="confirm-action-modal-title"
      aria-describedby="confirm-action-modal-description"
    >
      <DialogTitle
        id="confirm-action-modal-title"
        sx={{
          fontWeight: 700,
          fontSize: '1.125rem',
          color: MARANA_COLORS.textPrimary,
          pt: 2.5,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        {showWarningIcon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: `${MARANA_COLORS.accent}18`,
              color: MARANA_COLORS.accent
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
        )}
        {title}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
        <Typography
          id="confirm-action-modal-description"
          variant="body1"
          sx={{
            color: MARANA_COLORS.textSecondary,
            lineHeight: 1.6,
            fontFamily: 'inherit'
          }}
        >
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.5 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            color: MARANA_COLORS.textSecondary,
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: MARANA_COLORS.background,
            '&:hover': {
              bgcolor: MARANA_COLORS.border
            }
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          sx={{
            bgcolor: MARANA_COLORS.primary,
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': {
              bgcolor: MARANA_COLORS.primary,
              filter: 'brightness(0.95)'
            }
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
