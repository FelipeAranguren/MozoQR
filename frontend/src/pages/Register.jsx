import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  Divider,
  CircularProgress,
} from "@mui/material";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../context/AuthContext";
import { getSafeCallbackUrl, syncAuthReturnStorageFromLoginPage } from "../utils/authRedirect";
import AuthCardShell from "../components/ui/AuthCardShell";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, isAuthenticated } = useAuth();

  const afterAuthPath = useMemo(
    () => getSafeCallbackUrl(searchParams.get("callbackUrl"), "/"),
    [searchParams]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    syncAuthReturnStorageFromLoginPage({
      callbackUrl: searchParams.get("callbackUrl"),
      error: searchParams.get("error"),
    });
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(afterAuthPath, { replace: true });
    }
  }, [isAuthenticated, navigate, afterAuthPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (!email || !password || !confirmPassword) {
      setError("Por favor, completa todos los campos");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, ingresa un email válido");
      return;
    }

    setLoading(true);

    const result = await register(email, password);

    if (result.success) {
      navigate(afterAuthPath, { replace: true });
    } else {
      setError(result.error || "Error al registrarse. Por favor, intenta de nuevo.");
    }

    setLoading(false);
  };

  return (
    <AuthCardShell
      eyebrow="Alta de cuenta"
      title="Crea tu acceso"
      description="Activa tu cuenta para administrar tu operación, menú y experiencia de pago desde un único panel."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
          required
          autoComplete="email"
          disabled={loading}
        />

        <TextField
          fullWidth
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
          required
          autoComplete="new-password"
          disabled={loading}
          helperText="Mínimo 6 caracteres"
        />

        <TextField
          fullWidth
          label="Repetir contraseña"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          margin="normal"
          required
          autoComplete="new-password"
          disabled={loading}
          error={confirmPassword !== "" && password !== confirmPassword}
          helperText={
            confirmPassword !== "" && password !== confirmPassword
              ? "Las contraseñas no coinciden"
              : ""
          }
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{
            mt: 3,
            mb: 2,
            py: 1.65,
            fontSize: "1rem",
          }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : "Registrarse"}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }}>
        <Typography variant="body2" color="text.secondary">
          O continuá con
        </Typography>
      </Divider>

      <Box sx={{ mb: 3 }}>
        <GoogleButton mode="register" />
      </Box>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          ¿Ya tienes una cuenta?{" "}
          <Link
            component="button"
            variant="body2"
            onClick={() => {
              const cb = searchParams.get("callbackUrl");
              navigate(cb ? `/login?callbackUrl=${encodeURIComponent(cb)}` : "/login");
            }}
            sx={{ fontWeight: 700 }}
          >
            Inicia sesión aquí
          </Link>
        </Typography>
      </Box>
    </AuthCardShell>
  );
}

