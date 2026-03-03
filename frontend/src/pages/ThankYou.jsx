import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadLastReceiptFromStorage } from '../utils/receipt';
import ReceiptDialog from '../components/ReceiptDialog';

export default function ThankYou() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const type = searchParams.get('type'); // 'online' | 'presencial'
    const slug = searchParams.get('slug');
    const [receiptData, setReceiptData] = useState(null);
    const [receiptOpen, setReceiptOpen] = useState(false);

    const isOnline = type === 'online';

    useEffect(() => {
        const saved = loadLastReceiptFromStorage();
        if (saved && (saved?.items?.length > 0 || saved?.total != null || saved?.mesaNumber != null))
            setReceiptData(saved);
    }, []);

    const handleShowReceipt = () => {
        if (receiptData) setReceiptOpen(true);
    };

    return (
        <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <Paper
                elevation={3}
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                    {isOnline ? (
                        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main' }} />
                    ) : (
                        <RoomServiceIcon sx={{ fontSize: 80, color: 'warning.main' }} />
                    )}
                </Box>

                <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
                    {isOnline ? '¡Gracias por tu visita!' : '¡Mozo notificado!'}
                </Typography>

                <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.1rem', mb: 4 }}>
                    {isOnline
                        ? 'Tu pago se ha procesado correctamente. Esperamos verte pronto nuevamente.'
                        : 'Hemos avisado al mozo que querés pagar. En breve se acercará a tu mesa.'}
                </Typography>

                {receiptData && (
                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        startIcon={<ReceiptIcon />}
                        onClick={handleShowReceipt}
                        sx={{ mb: 2, borderRadius: 2, py: 1.5, bgcolor: 'success.main' }}
                    >
                        Ver / Imprimir recibo
                    </Button>
                )}
                <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} receiptData={receiptData} />

                {slug && (
                    <Button
                        variant="outlined"
                        size="large"
                        fullWidth
                        onClick={() => navigate(`/${slug}/menu`)}
                        sx={{ mb: 2, borderRadius: 2, py: 1.5 }}
                    >
                        Volver al menú
                    </Button>
                )}
                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => navigate('/')}
                    sx={{
                        borderRadius: 2,
                        py: 1.5,
                        bgcolor: isOnline ? 'success.main' : 'warning.main',
                        '&:hover': {
                            bgcolor: isOnline ? 'success.dark' : 'warning.dark',
                        }
                    }}
                >
                    Volver al inicio
                </Button>
            </Paper>
        </Container>
    );
}
