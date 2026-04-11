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

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithEmail, isAuthenticated } = useAuth();

  const afterAuthPath = useMemo(
    () => getSafeCallbackUrl(searchParams.get("callbackUrl"), "/"),
    [searchParams]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    syncAuthReturnStorageFromLoginPage({
      callbackUrl: searchParams.get("callbackUrl"),
      error: searchParams.get("error"),
    });
  }, [searchParams]);

  useEffect(() => {
    // Si ya está autenticado, volver a la página de origen (o home)
    if (isAuthenticated) {
      navigate(afterAuthPath, { replace: true });
      return;
    }

    // Verificar si hay error en la URL (por ejemplo, de Google redirect)
    const urlError = searchParams.get("error");
    if (urlError === "social") {
      setError("Error al iniciar sesión con Google. Por favor, intenta de nuevo.");
    } else if (urlError === "missing_token") {
      setError("Error en el proceso de autenticación. Por favor, intenta de nuevo.");
    }
  }, [isAuthenticated, navigate, searchParams, afterAuthPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, completa todos los campos");
      setLoading(false);
      return;
    }

    const result = await loginWithEmail(email, password);

    if (result.success) {
      navigate(afterAuthPath, { replace: true });
    } else {
      setError(result.error || "Credenciales inválidas");
      // NO borramos los valores de email y contraseña
    }

    setLoading(false);
  };

  return (
    <AuthCardShell
      eyebrow="Acceso seguro"
      title="Entrá a tu restaurante"
      description="Gestioná operaciones, pedidos y métricas con una interfaz más clara y profesional."
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
          autoComplete="current-password"
          disabled={loading}
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
          {loading ? <CircularProgress size={20} color="inherit" /> : "Iniciar sesión"}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }}>
        <Typography variant="body2" color="text.secondary">
          O continuá con
        </Typography>
      </Divider>

      <Box sx={{ mb: 3 }}>
        <GoogleButton mode="login" />
      </Box>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          ¿No tienes una cuenta?{" "}
          <Link
            component="button"
            variant="body2"
            onClick={() => {
              const cb = searchParams.get("callbackUrl");
              navigate(cb ? `/register?callbackUrl=${encodeURIComponent(cb)}` : "/register");
            }}
            sx={{ fontWeight: 700 }}
          >
            Regístrate aquí
          </Link>
        </Typography>
      </Box>
    </AuthCardShell>
  );
}

