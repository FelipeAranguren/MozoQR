// src/context/CartContext.jsx
import React, {
  createContext,
  useReducer,
  useContext,
  useMemo,
  useEffect,
  useState,
} from 'react';

const CartContext = createContext();

// -------------------- estado + reducer --------------------
const initialState = { items: [] }; // { id, nombre, precio, qty, notes }

function cartReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      return { items: Array.isArray(action.payload) ? action.payload : [] };
    }
    case 'ADD_ITEM': {
      const p = action.payload;
      const idx = state.items.findIndex(i => i.id === p.id);
      if (idx > -1) {
        const items = [...state.items];
        items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
        return { items };
      }
      return {
        items: [
          ...state.items,
          { id: p.id, nombre: p.nombre, precio: p.precio, qty: 1, notes: '' },
        ],
      };
    }
    case 'REMOVE_ITEM': {
      const id = action.payload.id;
      const idx = state.items.findIndex(i => i.id === id);
      if (idx === -1) return state;
      const items = [...state.items];
      if (items[idx].qty > 1) items[idx] = { ...items[idx], qty: items[idx].qty - 1 };
      else items.splice(idx, 1);
      return { items };
    }
    case 'UPDATE_NOTES': {
      const { id, notes } = action.payload;
      return { items: state.items.map(i => (i.id === id ? { ...i, notes } : i)) };
    }
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

// -------------------- helpers de persistencia --------------------
const TS_CURRENT_KEY = 'ts:current';
const cartKey = scope => (scope ? `cart:${scope}` : 'cart:default');

function readScopeSafe() {
  try {
    return localStorage.getItem(TS_CURRENT_KEY);
  } catch {
    return null;
  }
}

function loadItems(scope) {
  try {
    const raw = localStorage.getItem(cartKey(scope));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(items, scope) {
  try {
    localStorage.setItem(cartKey(scope), JSON.stringify(items || []));
  } catch {}
}

// -------------------- provider --------------------
export function CartProvider({ children }) {
  // scope = tableSessionId actual (lo publica useTableSession en ts:current)
  const [scope, setScope] = useState(readScopeSafe());
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // hidratar carrito cuando cambia el scope (p.ej. cambiás de mesa o de restaurante)
  useEffect(() => {
    const items = loadItems(scope);
    dispatch({ type: 'HYDRATE', payload: items });
  }, [scope]);

  // persistir cada cambio del carrito bajo la clave de la sesión actual
  useEffect(() => {
    saveItems(state.items, scope);
  }, [state.items, scope]);

  // escuchar cambios de sesión publicados por useTableSession
  useEffect(() => {
    const onTSChanged = () => setScope(readScopeSafe());
    window.addEventListener('ts-changed', onTSChanged);
    // también captura cambios entre pestañas
    const onStorage = e => {
      if (e.key === TS_CURRENT_KEY) onTSChanged();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('ts-changed', onTSChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // API del contexto (igual que antes)
  const addItem     = product        => dispatch({ type: 'ADD_ITEM', payload: product });
  const removeItem  = id             => dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  const updateNotes = (id, notes)    => dispatch({ type: 'UPDATE_NOTES', payload: { id, notes } });
  const clearCart   = ()             => dispatch({ type: 'CLEAR_CART' });

  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + i.qty * i.precio, 0),
    [state.items]
  );

  return (
    <CartContext.Provider
      value={{ items: state.items, subtotal, addItem, removeItem, updateNotes, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

// -------------------- hook --------------------
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}