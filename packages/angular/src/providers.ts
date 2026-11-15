import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import type { AnnotationService } from '@spannote/core';
import { SPANNOTE_SERVICE } from './token';

/**
 * Registers the annotation service for the application. Call it in the application's providers:
 *
 * ```ts
 * bootstrapApplication(AppComponent, { providers: [provideSpanNote(service)] });
 * ```
 */
export function provideSpanNote(service: AnnotationService): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SPANNOTE_SERVICE, useValue: service }]);
}
