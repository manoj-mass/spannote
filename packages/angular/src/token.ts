import { InjectionToken } from '@angular/core';
import type { AnnotationService } from '@spannote/core';

/** The token under which `provideSpanNote` registers the annotation service. */
export const SPANNOTE_SERVICE = new InjectionToken<AnnotationService>('SPANNOTE_SERVICE');
