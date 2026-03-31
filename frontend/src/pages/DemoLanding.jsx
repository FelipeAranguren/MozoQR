import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Grid, Card, Button, alpha } from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import KitchenIcon from '@mui/icons-material/Kitchen';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';
import { COLORS } from '../theme';

export default function DemoLanding() {
    const navigate = useNavigate();

    const DEMO_SLUG = 'mcdonalds';

    const roles = [
        {
            id: 'diner',
            title: 'Comensal',
            description: 'Experimenta la carta digital, pedidos QR y pagos online como un cliente real.',
            icon: <RestaurantMenuIcon sx={{ fontSize: 40 }} />,
            color: COLORS.secondary,
            action: () => navigate(`/${DEMO_SLUG}/menu`),
            buttonText: 'Ver como Comensal',
            features: ['Menú Digital', 'Pedidos QR', 'Pagos Online']
        },
        {
            id: 'staff',
            title: 'Staff / Cocina',
            description: 'Gestión de pedidos en tiempo real y estado de mesas.',
            icon: <KitchenIcon sx={{ fontSize: 40 }} />,
            color: COLORS.primary,
            action: () => navigate(`/staff/${DEMO_SLUG}/orders`),
            buttonText: 'Ver Cocina / Staff',
            features: ['Mostrador', 'Pedidos en Cocina', 'Estado de Mesas']
        },
        {
            id: 'owner',
            title: 'Dueño',
            description: 'Panel de control completo, métricas de ventas, gestión de menú y configuración.',
            icon: <StorefrontIcon sx={{ fontSize: 40 }} />,
            color: COLORS.secondaryDark,
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
            bgcolor: COLORS.bg,
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
                <Box sx={{
                    textAlign: 'center',
                    mb: 5,
                    p: { xs: 3, md: 5 },
                    bgcolor: 'background.paper',
                    borderRadius: '12px',
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: COLORS.shadow1,
                }}>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Box sx={{
                            display: 'inline-flex',
                            p: 2,
                            bgcolor: alpha(COLORS.secondary, 0.08),
                            borderRadius: '12px',
                            mb: 3,
                            color: COLORS.secondary,
                        }}>
                            <RestaurantMenuIcon sx={{ fontSize: 48 }} />
                        </Box>
                        <Typography
                            variant="overline"
                            component="p"
                            sx={{ mb: 1.25, color: COLORS.textSecondary }}
                        >
                            Entorno de demostración
                        </Typography>
                        <Typography
                            variant="h2"
                            component="h1"
                            gutterBottom
                            sx={{ mb: 2, color: COLORS.text }}
                        >
                            MozoQR Demo
                        </Typography>
                        <Typography
                            variant="h5"
                            sx={{ maxWidth: 800, mx: 'auto', lineHeight: 1.6, color: COLORS.textSecondary }}
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
                    <Grid container spacing={{ xs: 2, md: 3 }}>
                        {roles.map((role) => (
                            <Grid item xs={12} md={4} key={role.id}>
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
                                            borderRadius: '12px',
                                            border: `1px solid ${COLORS.border}`,
                                            bgcolor: 'background.paper',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                boxShadow: COLORS.shadow4,
                                                borderColor: COLORS.borderStrong,
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: { xs: 2, md: 3 } }}>
                                            <Box sx={{
                                                p: { xs: 1.5, md: 2 },
                                                borderRadius: '10px',
                                                bgcolor: alpha(role.color, 0.08),
                                                color: role.color,
                                                mr: { xs: 2, md: 3 },
                                                flexShrink: 0
                                            }}>
                                                {role.icon}
                                            </Box>
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ color: COLORS.text }}>
                                                    {role.title}
                                                </Typography>
                                                <Typography variant="body1" sx={{ color: COLORS.textSecondary }}>
                                                    {role.description}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={{ mb: { xs: 3, md: 4 }, pl: { xs: 0, md: 2 } }}>
                                            {role.features.map((feature, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    <CheckCircleIcon sx={{ fontSize: 18, color: role.color, mr: 1.5, opacity: 0.8 }} />
                                                    <Typography variant="body2" fontWeight="500" sx={{ color: COLORS.text }}>
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
                                                color: COLORS.white,
                                                py: 1.45,
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                borderRadius: '8px',
                                                textTransform: 'none',
                                                boxShadow: `0 4px 14px ${alpha(role.color, 0.2)}`,
                                                '&:hover': {
                                                    bgcolor: role.color,
                                                    filter: 'brightness(0.9)',
                                                    boxShadow: `0 8px 20px ${alpha(role.color, 0.28)}`,
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
                <Box sx={{
                    mt: 6,
                    textAlign: 'center',
                    p: 2.5,
                    bgcolor: COLORS.bgAlt,
                    borderRadius: '8px',
                    border: `1px solid ${COLORS.border}`,
                }}>
                    <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                        Para reiniciar la demo, puedes volver a esta página en cualquier momento.
                    </Typography>
                </Box>
                </Container>
            </Box>
        </Box>
    );
}
