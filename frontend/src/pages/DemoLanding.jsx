import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Grid, Card, Button, useTheme, alpha } from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import KitchenIcon from '@mui/icons-material/Kitchen';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';

export default function DemoLanding() {
    const navigate = useNavigate();
    const theme = useTheme();

    const DEMO_SLUG = 'mcdonalds';

    const roles = [
        {
            id: 'diner',
            title: 'Comensal',
            description: 'Experimenta la carta digital, pedidos QR y pagos online como un cliente real.',
            icon: <RestaurantMenuIcon sx={{ fontSize: 40 }} />,
            color: '#FF9800', // Orange
            // Ir al menú SIN número de mesa para que aparezca el selector de mesas
            action: () => navigate(`/${DEMO_SLUG}/menu`),
            buttonText: 'Ver como Comensal',
            features: ['Menú Digital', 'Pedidos QR', 'Pagos Online']
        },
        {
            id: 'staff',
            title: 'Staff / Cocina',
            description: 'Gestión de pedidos en tiempo real y estado de mesas.',
            icon: <KitchenIcon sx={{ fontSize: 40 }} />,
            color: '#009688', // Teal
            action: () => navigate(`/staff/${DEMO_SLUG}/orders`),
            buttonText: 'Ver Cocina / Staff',
            features: ['Mostrador', 'Pedidos en Cocina', 'Estado de Mesas']
        },
        {
            id: 'owner',
            title: 'Dueño',
            description: 'Panel de control completo, métricas de ventas, gestión de menú y configuración.',
            icon: <StorefrontIcon sx={{ fontSize: 40 }} />,
            color: '#2196F3', // Blue
            action: () => navigate(`/owner/${DEMO_SLUG}/dashboard`),
            buttonText: 'Panel de Dueño',
            features: ['Facturación', 'Métricas', 'Configuración', 'Inteligencia Artificial para Optimizar tu Negocio']
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5
            }
        }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: 'transparent',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            pt: { xs: 4, md: 8 },
            pb: { xs: 4, md: 8 }
        }}>
            <Box sx={{
                width: '100%',
                maxWidth: { xs: '100%', md: '1200px' },
                px: { xs: 1, sm: 2, md: 0 }
            }}>
                <Container
                    maxWidth="lg"
                    sx={{
                        px: { xs: 1.5, sm: 2, md: 3 }
                    }}
                >
                {/* Header */}
                <Box className="premium-panel" sx={{ textAlign: 'center', mb: 5, p: { xs: 3, md: 5 } }}>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Box sx={{
                            display: 'inline-flex',
                            p: 2,
                            bgcolor: 'action.selected',
                            borderRadius: 5,
                            mb: 3,
                            color: 'primary.main'
                        }}>
                            <RestaurantMenuIcon sx={{ fontSize: 48 }} />
                        </Box>
                        <Typography className="premium-kicker" sx={{ mb: 1.25 }}>
                            Entorno de demostración
                        </Typography>
                        <Typography
                            variant="h2"
                            component="h1"
                            gutterBottom
                            sx={{ mb: 2 }}
                        >
                            MozoQR Demo
                        </Typography>
                        <Typography
                            variant="h5"
                            color="text.secondary"
                            sx={{ maxWidth: 800, mx: 'auto', lineHeight: 1.6 }}
                        >
                            Bienvenido al entorno de demostración. Selecciona un rol para explorar las diferentes facetas de la plataforma.
                        </Typography>
                    </motion.div>
                </Box>

                {/* Roles Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <Grid container spacing={{ xs: 2, md: 4 }}>
                        {roles.map((role) => (
                            <Grid item xs={12} md={6} key={role.id}>
                                <motion.div
                                    variants={itemVariants}
                                    whileHover={{ y: -8 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                >
                                    <Card
                                        elevation={0}
                                        sx={{
                                            p: { xs: 2.75, md: 4 },
                                            height: '100%',
                                            borderRadius: 6,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            background: 'linear-gradient(180deg, rgba(255,253,249,0.98), rgba(248,244,236,0.94))',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                boxShadow: '0 18px 34px rgba(46,34,18,0.1)',
                                                borderColor: alpha(role.color, 0.3),
                                                background: `linear-gradient(to bottom right, #fffdf9, ${alpha(role.color, 0.05)})`
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: { xs: 2, md: 3 } }}>
                                            <Box sx={{
                                                p: { xs: 1.5, md: 2 },
                                                borderRadius: 4,
                                                bgcolor: alpha(role.color, 0.1),
                                                color: role.color,
                                                mr: { xs: 2, md: 3 },
                                                flexShrink: 0
                                            }}>
                                                {role.icon}
                                            </Box>
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography variant="h5" fontWeight="bold" gutterBottom>
                                                    {role.title}
                                                </Typography>
                                                <Typography variant="body1" color="text.secondary">
                                                    {role.description}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: { xs: 3, md: 4 }, pl: { xs: 0, md: 2 } }}>
                                            {role.features.map((feature, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <CheckCircleIcon sx={{ fontSize: 18, color: role.color, mr: 1.5, opacity: 0.8 }} />
                                                    <Typography variant="body2" fontWeight="500" color="text.primary">
                                                        {feature}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>

                                        <Button
                                            variant="contained"
                                            fullWidth
                                            size="large"
                                            onClick={role.action}
                                            endIcon={<ArrowForwardIcon />}
                                            sx={{
                                                bgcolor: role.color,
                                                py: 1.45,
                                                fontSize: '1rem',
                                                fontWeight: 800,
                                                borderRadius: 3.5,
                                                textTransform: 'none',
                                                boxShadow: `0 14px 24px ${alpha(role.color, 0.24)}`,
                                                '&:hover': {
                                                    bgcolor: role.color,
                                                    filter: 'brightness(0.9)',
                                                    boxShadow: `0 18px 28px ${alpha(role.color, 0.3)}`,
                                                }
                                            }}
                                        >
                                            {role.buttonText}
                                        </Button>
                                    </Card>
                                </motion.div>
                            </Grid>
                        ))}
                    </Grid>
                </motion.div>

                {/* Footer Info */}
                <Box className="premium-panel-soft" sx={{ mt: 6, textAlign: 'center', p: 2.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        Para reiniciar la demo, puedes volver a esta página en cualquier momento.
                    </Typography>
                </Box>
                </Container>
            </Box>
        </Box>
    );
}
