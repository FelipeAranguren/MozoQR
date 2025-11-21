// frontend/src/pages/DemoDashboard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function DemoDashboard() {
  const navigate = useNavigate();

  const handleClienteClick = () => {
    window.location.href = 'http://127.0.0.1:5173/mcdonalds/menu?t=1';
  };

  const handleCocinaClick = () => {
    // Placeholder - misma URL por ahora
    window.location.href = 'http://127.0.0.1:5173/mostrador/mcdonalds';
  };

  const handleOwnerClick = () => {
    window.location.href = 'http://127.0.0.1:5173/owner/mcdonalds/dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-teal-500 rounded-lg flex items-center justify-center hover:scale-110 hover:rotate-3 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl">
              <span className="text-white text-3xl font-bold">M</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-black">Mozo</span>
            <span className="text-teal-500">QR</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Plataforma integral de gestión gastronómica. Selecciona un rol para experimentar el demo interactivo.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Cliente */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <h2 className="text-2xl font-bold text-black mb-3">Cliente</h2>
            <p className="text-gray-600 mb-6">
              Experimenta la carta digital, pedidos QR y pagos online.
            </p>
            <button
              onClick={handleClienteClick}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg active:scale-95"
            >
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Ver como Cliente
            </button>
          </div>

          {/* Card 2: Staff & Operaciones */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <h2 className="text-2xl font-bold text-black mb-3">Staff & Operaciones</h2>
            <p className="text-gray-600 mb-6">
              Gestión de comandas, KDS de cocina y estados de mesa.
            </p>
            <button
              onClick={handleCocinaClick}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg active:scale-95"
            >
              <svg className="w-5 h-5 transition-transform duration-300 hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Cocina
            </button>
          </div>

          {/* Card 3: Dueño / Administrador */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <h2 className="text-2xl font-bold text-black mb-3">Dueño / Administrador</h2>
            <p className="text-gray-600 mb-6">
              Panel de control, analíticas avanzadas, gestión de stock y menús.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleOwnerClick}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
              >
                Suscripción BASIC
              </button>
              <button
                onClick={handleOwnerClick}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
              >
                Suscripción PRO
              </button>
              <button
                onClick={handleOwnerClick}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
              >
                Suscripción ULTRA
              </button>
            </div>
          </div>

          {/* Card 4: Administración de Plataforma */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <h2 className="text-2xl font-bold text-black mb-3">Administración de Plataforma</h2>
            <p className="text-gray-600 mb-6">
              Vista para gestión de SaaS: suscriptores, facturación global y auditoría.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg active:scale-95"
              >
                <svg className="w-5 h-5 transition-transform duration-300 hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Admin Plataforma
              </button>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg active:scale-95"
              >
                <svg className="w-5 h-5 transition-transform duration-300 hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Super Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

