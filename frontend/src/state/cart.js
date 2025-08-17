export const cartKey = (slug, tsid) => `cart:${slug}:${tsid}`;

export const loadCart = (slug, tsid) => {
  try { return JSON.parse(localStorage.getItem(cartKey(slug, tsid)) || '{"items":[]}'); }
  catch { return { items: [] }; }
};

export const saveCart = (slug, tsid, cart) => {
  localStorage.setItem(cartKey(slug, tsid), JSON.stringify(cart));
};

export const subtotal = (cart) =>
  cart.items.reduce((sum, it) => sum + it.price * it.qty, 0);