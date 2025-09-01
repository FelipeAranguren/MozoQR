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
          {/* Home */}
          <Route path="/" element={<Home />} />

          {/* NUEVA ruta multi-tenant para menú por slug + ?t=<mesa> */}
          <Route path="/:slug/menu" element={<RestaurantMenu />} />

          {/* Listado de restaurantes (tu ruta existente) */}
          <Route path="/restaurantes" element={<Restaurants />} />

          {/* LEGACY: compatibilidad con /restaurantes/:slug */}
          <Route path="/restaurantes/:slug" element={<LegacyRestaurantesRoute />} />

          {/* Otras rutas existentes */}
          <Route path="/mostrador/:slug" element={<Mostrador />} />
          <Route path="/cargarproductos/:slug" element={<CargarProductos />} />
          <Route path="/connect/google/redirect" element={<GoogleRedirect />} />
          <Route path="/pago/success" element={<PagoSuccess />} />
          <Route path="/pago/failure" element={<PagoFailure />} />
          <Route path="/pago/pending" element={<PagoPending />} />
          <Route path="/owner/:slug/dashboard" element={<OwnerDashboard />} />

          {/* 404 simple: redirige al home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}