// Ambient module declarations to keep TypeScript tooling happy in environments
// where node_modules typings are not available (e.g. editor-only linting).

declare module '@strapi/utils' {
  export const errors: any;
}

/** Permite leer claves arbitrarias de env (p. ej. trimEnv('MODO_CLIENT_ID')). */
declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

