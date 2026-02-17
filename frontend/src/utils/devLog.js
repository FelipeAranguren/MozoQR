/**
 * Solo loguea en desarrollo. En producción no hace nada.
 * Uso: devLog('mensaje', data) o devLog.warn('advertencia')
 */
const isDev = import.meta.env?.DEV;

export const devLog = isDev
  ? (...args) => console.log(...args)
  : () => {};

devLog.warn = isDev ? (...args) => console.warn(...args) : () => {};
devLog.error = (...args) => console.error(...args); // Siempre loguear errores
