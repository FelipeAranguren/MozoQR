import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { onboardingRestaurant } from "../api/tenantOnboarding";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OnboardingRestaurante() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");

  const [autoSlug, setAutoSlug] = useState("");
  const [useCustomSlug, setUseCustomSlug] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [invalidAccess, setInvalidAccess] = useState(false);

  const paymentStatus = searchParams.get("payment_status") || searchParams.get("status");
  const from = searchParams.get("from");
  const paymentReference = searchParams.get("preference_id") || searchParams.get("payment_id") || "";

  useEffect(() => {
    const ok =
      (paymentStatus && paymentStatus.toLowerCase() === "approved") ||
      (from && from === "pago-success");
    if (!ok) {
      setInvalidAccess(true);
      setError("Esta página solo está disponible después de un pago exitoso.");
      const timer = setTimeout(() => {
        navigate("/", { replace: true });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, from, navigate]);

  useEffect(() => {
    if (!useCustomSlug) {
      const generated = slugify(name);
      setAutoSlug(generated);
    }
  }, [name, useCustomSlug]);

  const effectiveSlug = useMemo(() => {
    const trimmedCustom = slugify(slug || "");
    return (useCustomSlug && trimmedCustom) || autoSlug || "";
  }, [slug, useCustomSlug, autoSlug]);

  const validate = () => {
    if (!name.trim()) return "El nombre del restaurante es obligatorio.";
    const email = ownerEmail.trim();
    if (!email) return "El email del dueño es obligatorio.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Ingresá un email válido.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        slug: effectiveSlug || undefined,
        mp_access_token: mpAccessToken.trim() || undefined,
        mp_public_key: mpPublicKey.trim() || undefined,
        owner_email: ownerEmail.trim().toLowerCase(),
        payment_reference: paymentReference || undefined,
        payment_status: paymentStatus || undefined,
      };

      const data = await onboardingRestaurant(payload);
      const finalSlug = data?.slug || effectiveSlug;
      setSuccessMessage("¡Restaurante creado! Redirigiendo…");

      setTimeout(() => {
        if (finalSlug) {
          navigate(`/${finalSlug}`, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }, 1200);
    } catch (err) {
      const msg = err?.message || "No se pudo crear el restaurante. Intentá de nuevo.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (invalidAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">
            Acceso no válido
          </h1>
          <p className="text-slate-600">
            Esta página solo está disponible después de un pago exitoso. Te redirigiremos al inicio en unos segundos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-lg w-full bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Configurar tu restaurante
        </h1>
        <p className="text-slate-600 mb-6">
          Último paso después de tu pago: completá estos datos para empezar a usar MozoQR.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre del Restaurante *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ej: Café de la Plaza"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Slug (opcional)
              </label>
              <span className="text-xs text-slate-500">
                URL: {effectiveSlug ? `https://tu-dominio.com/${effectiveSlug}` : "se generará automáticamente"}
              </span>
            </div>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setUseCustomSlug(true);
              }}
              onBlur={() => {
                if (!slug.trim()) setUseCustomSlug(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder={autoSlug || "mi-restaurante"}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-slate-500">
              Si lo dejás vacío, se generará a partir del nombre.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                MP Access Token (opcional)
              </label>
              <input
                type="password"
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="APP_USR-..."
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Public Key (opcional)
              </label>
              <input
                type="text"
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="APP_USR-..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email del Dueño *
            </label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="dueno@ejemplo.com"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`mt-2 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
              isSubmitting
                ? "bg-emerald-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <CircularProgress size={18} color="inherit" />
                Creando restaurante…
              </span>
            ) : (
              "Crear restaurante"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

