// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Header from './components/Header';
import Home from './pages/Home';
import Restaurants from './pages/Restaurants';
import RestaurantMenu from './pages/RestaurantMenu';
import Mostrador from './pages/Mostrador';
import CargarProductos from './pages/CargarProductos';
import { AuthProvider } from './context/AuthContext';
import GoogleRedirect from './pages/GoogleRedirect';
import Login from './pages/Login';
import Register from './pages/Register';
import PagoSuccess from './pages/PagoSuccess';
import PagoFailure from './pages/PagoFailure';
import PagoPending from './pages/PagoPending';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerDashboardList from './pages/OwnerDashboardList';
import OwnerRouteGuard from './guards/OwnerRouteGuard';
import AuthGuard from './guards/AuthGuard';
import NoAccess from './pages/NoAccess';
import OwnerLayout from './layouts/OwnerLayout';
import MenuManagement from './pages/owner/menu/MenuManagement';
import TablesList from './pages/owner/tables/TablesList';
import RestaurantSettings from './pages/owner/settings/RestaurantSettings';
import PlanManagement from './pages/owner/plan/PlanManagement';
import AdvancedPanel from './pages/owner/advanced/AdvancedPanel';
import AdminDashboard from './pages/AdminDashboard';

// Redirige rutas viejas /restaurantes/:slug -> /:slug/menu?t=1
function LegacyRestaurantesRoute() {
  const { slug } = useParams();
  return <Navigate to={`/${slug}/menu?t=1`} replace />;
}

// Componente que muestra el Header solo en rutas públicas
function ConditionalHeader() {
  const location = useLocation();
  const isOwnerRoute = location.pathname.startsWith('/owner/') && location.pathname !== '/owner';
  const isAdminRoute = location.pathname.startsWith('/admin/');
  return !isOwnerRoute && !isAdminRoute ? <Header /> : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CssBaseline />
        <ConditionalHeader />
        <Routes>
          {/* Cliente público - rutas simplificadas */}
          <Route path="/" element={<Home />} />
          <Route path="/:slug" element={<RestaurantMenu />} />
          <Route path="/:slug/menu" element={<RestaurantMenu />} />
          
          {/* Staff autenticado */}
          <Route path="/staff/:slug/orders" element={<OwnerRouteGuard><Mostrador /></OwnerRouteGuard>} />
          <Route path="/staff/:slug/products" element={<OwnerRouteGuard><CargarProductos /></OwnerRouteGuard>} />
          
          {/* Owner autenticado */}
          <Route path="/owner" element={<AuthGuard><OwnerDashboardList /></AuthGuard>} />
          
          {/* Admin Dashboard - Dashboard de administración */}
          <Route path="/admin/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
          
          {/* Rutas del owner con layout */}
          <Route path="/owner/:slug" element={<OwnerRouteGuard><OwnerLayout /></OwnerRouteGuard>}>
            <Route path="dashboard" element={<OwnerDashboard />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="tables" element={<TablesList />} />
            <Route path="settings" element={<RestaurantSettings />} />
            <Route path="plan" element={<PlanManagement />} />
            <Route path="advanced" element={<AdvancedPanel />} />
          </Route>
          
          {/* Rutas legacy para compatibilidad */}
          <Route path="/restaurantes" element={<Restaurants />} />
          <Route path="/restaurantes/:slug" element={<LegacyRestaurantesRoute />} />
          <Route path="/mostrador/:slug" element={<OwnerRouteGuard><Mostrador /></OwnerRouteGuard>} />
          <Route path="/cargarproductos/:slug" element={<OwnerRouteGuard><CargarProductos /></OwnerRouteGuard>} />
          
          {/* Autenticación */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Páginas de pago */}
          <Route path="/connect/google/redirect" element={<GoogleRedirect />} />
          <Route path="/pago/success" element={<PagoSuccess />} />
          <Route path="/pago/failure" element={<PagoFailure />} />
          <Route path="/pago/pending" element={<PagoPending />} />
          <Route path="/no-access" element={<NoAccess />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}