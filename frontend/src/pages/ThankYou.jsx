import React, { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadLastReceiptFromStorage } from '../utils/receipt';
import ReceiptDialog from '../components/ReceiptDialog';
import StatusPage from '../components/ui/StatusPage';

export default function ThankYou() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const type = searchParams.get('type');
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
        <StatusPage
            variant={isOnline ? 'success' : 'warning'}
            kicker={isOnline ? 'Pago finalizado' : 'Atención al cliente'}
            icon={isOnline ? (
                <CheckCircleIcon sx={{ fontSize: 56, color: '#16a34a' }} />
            ) : (
                <RoomServiceIcon sx={{ fontSize: 56, color: '#d97706' }} />
            )}
            title={isOnline ? 'Gracias por tu visita' : 'Mozo notificado'}
            description={isOnline
                ? 'Tu pago se procesó correctamente. Esperamos verte pronto nuevamente.'
                : 'Avisamos al mozo que querés pagar. En breve se acercará a tu mesa.'}
            primaryAction={slug ? { label: 'Volver al menú', onClick: () => navigate(`/${slug}/menu`), variant: 'outlined' } : null}
            secondaryAction={{ label: 'Volver al inicio', onClick: () => navigate('/'), variant: isOnline ? 'contained' : 'outlined' }}
        >
            {receiptData ? (
                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<ReceiptIcon />}
                    onClick={handleShowReceipt}
                    sx={{
                        mb: 1,
                        maxWidth: 380,
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 1.25,
                        bgcolor: '#16a34a',
                        '&:hover': { bgcolor: '#16a34a', filter: 'brightness(0.9)' },
                    }}
                >
                    Ver / Imprimir recibo
                </Button>
            ) : null}
            <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} receiptData={receiptData} />
        </StatusPage>
    );
}
