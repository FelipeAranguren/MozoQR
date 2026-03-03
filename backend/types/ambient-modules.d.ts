// Ambient module declarations to keep TypeScript tooling happy in environments
// where node_modules typings are not available (e.g. editor-only linting).

declare module '@strapi/utils' {
  export const errors: any;
}


