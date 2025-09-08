export function sessionKey(slug, table) {
  return `TABLE_SESS_${slug}_${table}`;
}

export function getTableSessionId(slug, table) {
  const k = sessionKey(slug, table);
  let v = localStorage.getItem(k);
  if (!v) {
    v = `sess_${slug}_${table}_${Date.now()}`;
    localStorage.setItem(k, v);
  }
  return v;
}

export function clearTableSession(slug, table) {
  localStorage.removeItem(sessionKey(slug, table));
}
