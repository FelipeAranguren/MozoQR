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

    // Demo slug
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
            description: 'Gestión de comandas en tiempo real, KDS de cocina y estados de mesa.',
            icon: <KitchenIcon sx={{ fontSize: 40 }} />,
            color: '#009688', // Teal
            action: () => navigate(`/staff/${DEMO_SLUG}/orders`),
            buttonText: 'Ver Cocina / Staff',
            features: ['Comandas', 'KDS', 'Mesas']
        },
        {
            id: 'owner',
            title: 'Dueño',
            description: 'Panel de control completo, métricas de ventas, gestión de menú y configuración.',
            icon: <StorefrontIcon sx={{ fontSize: 40 }} />,
            color: '#2196F3', // Blue
            action: () => navigate(`/owner/${DEMO_SLUG}/dashboard`),
            buttonText: 'Panel de Dueño',
            features: ['Dashboard', 'Métricas', 'Configuración']
        },
        {
            id: 'admin',
            title: 'Admin General',
            description: 'Vista de super-administrador para gestionar múltiples restaurantes y suscripciones.',
            icon: <AdminPanelSettingsIcon sx={{ fontSize: 40 }} />,
            color: '#673AB7', // Deep Purple
            action: () => navigate('/admin/dashboard'),
            buttonText: 'Admin Plataforma',
            features: ['SaaS', 'Usuarios', 'Global']
        }
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
            bgcolor: '#f5f7fa',
            py: { xs: 4, md: 8 }
        }}>
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Box sx={{
                            display: 'inline-flex',
                            p: 2,
                            bgcolor: 'primary.main',
                            borderRadius: 3,
                            mb: 3,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }}>
                            <RestaurantMenuIcon sx={{ fontSize: 48, color: 'white' }} />
                        </Box>
                        <Typography
                            variant="h2"
                            component="h1"
                            fontWeight="800"
                            gutterBottom
                            sx={{
                                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                backgroundClip: 'text',
                                textFillColor: 'transparent',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                mb: 2
                            }}
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
                    <Grid container spacing={4}>
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
                                            p: 4,
                                            height: '100%',
                                            borderRadius: 4,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                                                borderColor: alpha(role.color, 0.3),
                                                background: `linear-gradient(to bottom right, #ffffff, ${alpha(role.color, 0.05)})`
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                                            <Box sx={{
                                                p: 2,
                                                borderRadius: 3,
                                                bgcolor: alpha(role.color, 0.1),
                                                color: role.color,
                                                mr: 3
                                            }}>
                                                {role.icon}
                                            </Box>
                                            <Box>
                                                <Typography variant="h5" fontWeight="bold" gutterBottom>
                                                    {role.title}
                                                </Typography>
                                                <Typography variant="body1" color="text.secondary">
                                                    {role.description}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: 4, pl: 2 }}>
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
                                                py: 1.5,
                                                fontSize: '1rem',
                                                fontWeight: 'bold',
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                boxShadow: `0 4px 12px ${alpha(role.color, 0.3)}`,
                                                '&:hover': {
                                                    bgcolor: role.color,
                                                    filter: 'brightness(0.9)',
                                                    boxShadow: `0 6px 16px ${alpha(role.color, 0.4)}`,
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
                <Box sx={{ mt: 8, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Para reiniciar la demo, puedes volver a esta página en cualquier momento.
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}
