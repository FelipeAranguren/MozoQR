// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

import Header from './components/Header';
import Home from './pages/Home';
import Restaurants from './pages/Restaurants';
import RestaurantMenu from './pages/RestaurantMenu';
import Mostrador from './pages/Mostrador';
import CargarProductos from './pages/CargarProductos';
import { AuthProvider } from './context/AuthContext';
import GoogleRedirect from './pages/GoogleRedirect';
import PagoSuccess from './pages/PagoSuccess';
import PagoFailure from './pages/PagoFailure';
import PagoPending from './pages/PagoPending';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerRouteGuard from './guards/OwnerRouteGuard';
import NoAccess from './pages/NoAccess';     // 👈 faltaba este import


// Redirige rutas viejas /restaurantes/:slug -> /:slug/menu?t=1
function LegacyRestaurantesRoute() {
  const { slug } = useParams();
  return <Navigate to={`/${slug}/menu?t=1`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:slug/menu" element={<RestaurantMenu />} />
          <Route path="/restaurantes" element={<Restaurants />} />
          <Route path="/restaurantes/:slug" element={<LegacyRestaurantesRoute />} />
          <Route path="/mostrador/:slug" element={ <OwnerRouteGuard> <Mostrador /></OwnerRouteGuard>  }/>
          <Route path="/cargarproductos/:slug"element={<OwnerRouteGuard><CargarProductos /></OwnerRouteGuard>}/>
          <Route path="/connect/google/redirect" element={<GoogleRedirect />} />
          <Route path="/pago/success" element={<PagoSuccess />} />
          <Route path="/pago/failure" element={<PagoFailure />} />
          <Route path="/pago/pending" element={<PagoPending />} />
          <Route path="/owner/:slug/dashboard"element={<OwnerRouteGuard><OwnerDashboard /></OwnerRouteGuard>}/>
          <Route path="/no-access" element={<NoAccess />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
