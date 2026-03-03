/**
 * Script de verificación: comprueba si Railway (o el proceso Node) tiene MP_ACCESS_TOKEN.
 * Ejecutar con: npm run test:env
 * Se ejecuta al inicio con: npm start (antes de strapi start).
 * .env está en .gitignore; no lo subas a Git para no pisar variables de Railway.
 */
const token = process.env.MP_ACCESS_TOKEN;
const defined = token != null && String(token).trim().length > 0;
console.log('[test-env] MP_ACCESS_TOKEN definido:', defined);
console.log('[test-env] MP_ACCESS_TOKEN longitud:', defined ? String(token).length : 0);
console.log('[test-env] Primeros 4 caracteres:', defined ? String(token).trim().slice(0, 4) : 'N/A');
console.log('[test-env] NODE_ENV:', process.env.NODE_ENV || '(no definido)');
