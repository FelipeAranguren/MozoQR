import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    CircularProgress,
    Snackbar,
    Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { api } from '../../api'; // Assuming api is exported from ../../api

export default function GlobalAdmin() {
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resetDialog, setResetDialog] = useState({ open: false, slug: null, name: null });
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });

    const fetchRestaurants = async () => {
        setLoading(true);
        try {
            // Fetch all restaurants. Assuming we have an endpoint or using the default find.
            // We might need to adjust this if we don't have a global list endpoint.
            // Using default strapi endpoint if accessible or a custom one.
            // Let's assume we can list them. If not, we might need a backend change to list all for admin.
            // For now, let's try GET /restaurantes
            const { data } = await api.get('/restaurantes?populate=*');
            setRestaurants(data.data || []);
        } catch (err) {
            console.error('Error fetching restaurants:', err);
            setSnack({ open: true, message: 'Error loading restaurants', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestaurants();
    }, []);

    const handleResetDemo = async () => {
        if (!resetDialog.slug) return;
        try {
            await api.post(`/restaurants/${resetDialog.slug}/demo/reset`);
            setSnack({ open: true, message: 'Demo reset successfully', severity: 'success' });
            fetchRestaurants(); // Refresh to see any changes if needed
        } catch (err) {
            console.error('Error resetting demo:', err);
            setSnack({ open: true, message: 'Failed to reset demo', severity: 'error' });
        } finally {
            setResetDialog({ open: false, slug: null, name: null });
        }
    };

    const handleLoginAsOwner = (slug) => {
        // Logic to simulate login or redirect
        window.open(`/restaurant/${slug}/admin`, '_blank');
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Global Admin
                </Typography>
                <Button startIcon={<RefreshIcon />} onClick={fetchRestaurants} variant="outlined">
                    Refresh
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={2}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Slug</TableCell>
                            <TableCell>Plan</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : restaurants.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    No restaurants found
                                </TableCell>
                            </TableRow>
                        ) : (
                            restaurants.map((r) => {
                                const attr = r.attributes || r;
                                return (
                                    <TableRow key={r.id}>
                                        <TableCell sx={{ fontWeight: 500 }}>{attr.name}</TableCell>
                                        <TableCell>{attr.slug}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={attr.Suscripcion || 'Basic'}
                                                color={attr.Suscripcion === 'ultra' ? 'secondary' : attr.Suscripcion === 'pro' ? 'primary' : 'default'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {attr.is_demo ? (
                                                <Chip label="DEMO" color="warning" size="small" />
                                            ) : (
                                                <Chip label="Live" color="success" size="small" variant="outlined" />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                {attr.is_demo && (
                                                    <Button
                                                        size="small"
                                                        color="warning"
                                                        startIcon={<RestartAltIcon />}
                                                        onClick={() => setResetDialog({ open: true, slug: attr.slug, name: attr.name })}
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                                <Button
                                                    size="small"
                                                    startIcon={<LoginIcon />}
                                                    onClick={() => handleLoginAsOwner(attr.slug)}
                                                >
                                                    Login
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Reset Confirmation Dialog */}
            <Dialog
                open={resetDialog.open}
                onClose={() => setResetDialog({ ...resetDialog, open: false })}
            >
                <DialogTitle>Reset Demo Data?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to reset all data for <strong>{resetDialog.name}</strong>?
                        This will delete all orders and sessions. This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetDialog({ ...resetDialog, open: false })}>Cancel</Button>
                    <Button onClick={handleResetDemo} color="error" variant="contained" autoFocus>
                        Reset Data
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={6000}
                onClose={() => setSnack({ ...snack, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%' }}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}
