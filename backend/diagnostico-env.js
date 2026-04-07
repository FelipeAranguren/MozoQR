// backend/diagnostico-env.js
console.log("======= DIAGNÓSTICO DE VARIABLES MOZOQR =======");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
console.log("MP_ACCESS_TOKEN:", process.env.MP_ACCESS_TOKEN ? "SÍ (len=" + process.env.MP_ACCESS_TOKEN.length + ")" : "NO");
console.log("MERCADOPAGO_ACCESS_TOKEN:", process.env.MERCADOPAGO_ACCESS_TOKEN ? "SÍ" : "NO");
console.log("MERCADO_PAGO_ACCESS_TOKEN:", process.env.MERCADO_PAGO_ACCESS_TOKEN ? "SÍ" : "NO");

function envSet(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}
console.log("MODO_BASE_URL / MODO_PCP_BASE_URL:", envSet("MODO_BASE_URL") || envSet("MODO_PCP_BASE_URL") ? "SÍ" : "NO");
console.log("MODO_CLIENT_ID:", envSet("MODO_CLIENT_ID") ? "SÍ" : "NO");
console.log("MODO_CLIENT_SECRET:", envSet("MODO_CLIENT_SECRET") ? "SÍ" : "NO");
console.log("MODO_BEARER_TOKEN (opcional si OAuth):", envSet("MODO_BEARER_TOKEN") || envSet("MODO_ACCESS_TOKEN") ? "SÍ" : "NO");

const fs = require('fs');
const path = require('path');

// Verificar si existe un .env físico que esté pisando a Railway
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log("⚠️ ALERTA: Existe un archivo .env físico en el servidor. Podría estar pisando las variables de Railway.");
} else {
  console.log("✅ No hay archivo .env físico estorbando.");
}
console.log("==============================================");