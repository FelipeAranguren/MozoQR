// frontend/src/hooks/useOrderFlow.js
import { useState, useCallback, useMemo } from 'react';
import { createOrder } from '../api/tenant';

export const useOrderFlow = (slug, table) => {
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const subtotal = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.qty * item.precio), 0), 
    [cart]
  );

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.qty > 1) {
        return prev.map(item => 
          item.id === productId 
            ? { ...item, qty: item.qty - 1 }
            : item
        );
      }
      return prev.filter(item => item.id !== productId);
    });
  }, []);

  const updateItemNotes = useCallback((productId, notes) => {
    setCart(prev => prev.map(item => 
      item.id === productId 
        ? { ...item, notes }
        : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const submitOrder = useCallback(async (notes = '') => {
    if (cart.length === 0) {
      setError('El carrito está vacío');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const order = await createOrder(slug, {
        table,
        items: cart.map(item => ({
          productId: item.id,
          qty: item.qty,
          price: item.precio,
          notes: item.notes || ''
        })),
        notes,
      });

      setOrders(prev => [order, ...prev]);
      setCart([]);
      return order;
    } catch (err) {
      setError(err.message || 'Error al enviar el pedido');
      return null;
    } finally {
      setLoading(false);
    }
  }, [slug, table, cart]);

  return {
    cart,
    orders,
    loading,
    error,
    subtotal,
    addToCart,
    removeFromCart,
    updateItemNotes,
    clearCart,
    submitOrder,
  };
};