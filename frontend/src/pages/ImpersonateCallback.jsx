
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function ImpersonateCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // We might not need useAuth if we set localStorage directly, but let's see.
    // Ideally AuthContext should expose a login method that takes a token.
    // For now, we'll do a "hard" login by setting storage and reloading/redirecting.

    useEffect(() => {
        const token = searchParams.get('token');

        if (token) {
            // 1. Guardar token
            localStorage.setItem('strapi_jwt', token);
            localStorage.setItem('jwt', token); // Por si acaso se usan ambos keys

            // 2. Redirigir
            const slug = searchParams.get('slug');
            if (slug) {
                window.location.href = `/owner/${slug}/dashboard`;
            } else {
                window.location.href = '/owner';
            }
        } else {
            navigate('/');
        }
    }, [searchParams, navigate]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            bgcolor: '#f4f6f8'
        }}>
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" sx={{ mt: 3, color: '#555' }}>
                Accediendo como Propietario...
            </Typography>
        </Box>
    );
}
