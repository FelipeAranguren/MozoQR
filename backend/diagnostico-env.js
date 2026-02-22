// backend/diagnostico-env.js
console.log("======= DIAGNÓSTICO DE VARIABLES MOZOQR =======");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
console.log("MP_ACCESS_TOKEN detectado:", process.env.MP_ACCESS_TOKEN ? "SÍ (Longitud: " + process.env.MP_ACCESS_TOKEN.length + ")" : "NO");

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