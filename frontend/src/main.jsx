// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// MUI Theme
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';


// Cart Context
import { CartProvider } from './context/CartContext';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CartProvider>
          <App />
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
