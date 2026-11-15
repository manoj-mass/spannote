// Lets the TypeScript program used by ESLint type-check `.vue` imports. vue-tsc still checks the
// single-file components themselves; this declaration only supplies their default export type.
declare module '*.vue' {
  import type { Component } from 'vue';
  const component: Component;
  export default component;
}
