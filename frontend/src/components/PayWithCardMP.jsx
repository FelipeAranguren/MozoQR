// src/components/PayWithCardMP.jsx
import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337/api";
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY; // APP_USR-... o TEST-...

// Carga dinámica del SDK de MP
function useMP(publicKey) {
  const [mp, setMp] = useState(null);

  useEffect(() => {
    if (!publicKey) return;

    const prev = document.getElementById("mp-sdk");
    if (prev) {
      // ya cargado
      // @ts-ignore
      setMp(new window.MercadoPago(publicKey, { locale: "es-AR" }));
      return;
    }

    const script = document.createElement("script");
    script.id = "mp-sdk";
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => {
      // @ts-ignore
      setMp(new window.MercadoPago(publicKey, { locale: "es-AR" }));
    };
    document.body.appendChild(script);
  }, [publicKey]);

  return mp;
}

/**
 * Props:
 * - amount: number (monto total)
 * - orderId?: string
 */
export default function PayWithCardMP({ amount, orderId }) {
  const containerRef = useRef(null);
  const mp = useMP(MP_PUBLIC_KEY);
  const { user } = useAuth(); // para traer email si estás logueado con Google

  useEffect(() => {
    if (!mp || !containerRef.current || !amount) return;

    const bricksBuilder = mp.bricks();

    let cardBrick = null;
    bricksBuilder
      .create("cardPayment", "cardPaymentBrick_container", {
        initialization: {
          amount: Number(amount), // monto a cobrar
        },
        customization: {
          visual: { style: { theme: "default" } },
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
          },
        },
        callbacks: {
          onReady: () => {},
          onError: (error) => {
            console.error("Brick error:", error);
            alert("No pudimos cargar el formulario de tarjeta.");
          },
          onSubmit: async (cardFormData) => {
            try {
              // cardFormData: { token, issuer_id, payment_method_id, payer{ email, identification }, installments }
              const res = await fetch(`${STRAPI_URL}/payments/card-pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  description: `Pedido ${orderId || ""}`,
                  transaction_amount: Number(amount),
                  token: cardFormData.token,
                  issuer_id: cardFormData.issuer_id,
                  payment_method_id: cardFormData.payment_method_id,
                  installments: Number(cardFormData.installments || 1),
                  payer: {
                    email: cardFormData.payer?.email || user?.email, // intenta usar email del contexto
                    identification: cardFormData.payer?.identification, // { type, number } si lo pide
                  },
                }),
              });

              const data = await res.json();

              if (!res.ok) {
                console.error("card-pay error:", data);
                alert(data?.error || "Error procesando el pago.");
                return;
              }

              if (data.status === "approved") {
                window.location.href = "/pago/success";
              } else if (data.status === "in_process") {
                window.location.href = "/pago/pending";
              } else {
                window.location.href = "/pago/failure";
              }
            } catch (e) {
              console.error(e);
              alert("Error inesperado al procesar el pago.");
            }
          },
        },
      })
      .then((brick) => {
        cardBrick = brick;
      });

    return () => {
      if (cardBrick) cardBrick.destroy();
    };
  }, [mp, amount, orderId, user?.email]);

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", mt: 2 }}>
      {!MP_PUBLIC_KEY && (
        <Typography color="error" sx={{ mb: 1 }}>
          Falta VITE_MP_PUBLIC_KEY en el frontend/.env
        </Typography>
      )}
      <div id="cardPaymentBrick_container" ref={containerRef} />
    </Box>
  );
}
