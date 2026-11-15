import type { App, InjectionKey, Plugin } from 'vue';
import type { AnnotationService } from '@spannote/core';

/** The key under which the plugin provides the annotation service. */
export const SPANNOTE_SERVICE_KEY: InjectionKey<AnnotationService> = Symbol('spannote-service');

export interface SpanNotePluginOptions {
  /** The service the whole application shares. Create it once, outside any component. */
  readonly service: AnnotationService;
}

/**
 * Makes an `AnnotationService` available to every component in the app:
 *
 * ```ts
 * app.use(SpanNotePlugin, { service });
 * ```
 */
export const SpanNotePlugin: Plugin<[SpanNotePluginOptions]> = {
  install(app: App, options: SpanNotePluginOptions): void {
    app.provide(SPANNOTE_SERVICE_KEY, options.service);
  },
};
