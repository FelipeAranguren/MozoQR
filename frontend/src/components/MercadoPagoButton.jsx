// frontend/src/components/MercadoPagoButton.jsx
import React, { useEffect, useState } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { Box, CircularProgress, Typography } from "@mui/material";

/**
 * Clave pública de Mercado Pago (Vite: VITE_MP_PUBLIC_KEY, Next: NEXT_PUBLIC_MP_PUBLIC_KEY).
 */
function getMpPublicKey() {
  return (
    import.meta.env?.VITE_MP_PUBLIC_KEY ||
    import.meta.env?.NEXT_PUBLIC_MP_PUBLIC_KEY ||
    process.env?.NEXT_PUBLIC_MP_PUBLIC_KEY ||
    ""
  );
}

/**
 * MercadoPagoButton – Wallet Brick de Mercado Pago.
 *
 * Props:
 * - preferenceId: string | null – ID de la preferencia del backend. Mientras sea null/undefined se muestra estado de carga.
 * - onReady?: () => void
 * - onError?: (error) => void
 * - onSubmit?: (formData) => void
 * - customization?: objeto de personalización del Wallet
 * - loadingLabel?: string – Texto mientras no hay preferenceId
 */
export default function MercadoPagoButton({
  preferenceId,
  onReady,
  onError,
  onSubmit,
  customization,
  loadingLabel = "Cargando opciones de pago…",
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [initError, setInitError] = useState(null);

  const publicKey = getMpPublicKey();
  const hasPreference = Boolean(preferenceId && preferenceId.trim());
  const showWallet = sdkReady && hasPreference;
  const loading = !showWallet;

  useEffect(() => {
    if (!publicKey) {
      setInitError("Falta la clave pública de Mercado Pago (VITE_MP_PUBLIC_KEY o NEXT_PUBLIC_MP_PUBLIC_KEY).");
      return;
    }
    let cancelled = false;
    setInitError(null);
    initMercadoPago(publicKey)
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setInitError(err?.message || "Error al inicializar Mercado Pago.");
          setSdkReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (initError) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="error" variant="body2">
          {initError}
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          py: 3,
          px: 2,
        }}
      >
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          {!hasPreference ? loadingLabel : "Inicializando Mercado Pago…"}
        </Typography>
      </Box>
    );
  }

  return (
    <Wallet
      initialization={{ preferenceId: preferenceId.trim() }}
      customization={customization}
      onReady={onReady}
      onError={onError}
      onSubmit={onSubmit}
    />
  );
}
