import { AnnotationProtocolClient, ProtocolAnnotationStore } from '@spannote/protocol';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import type { AnnotationStore } from '@spannote/model';

/** Settings read from the URL, so every combination can be opened and shared as a link. */
export interface DemoConfig {
  /** `memory` keeps annotations in the page; `w3c` talks to the local W3C server. */
  readonly store: 'memory' | 'w3c';
  /** The annotation container URL used when `store` is `w3c`. */
  readonly endpoint: string;
  /** `css` uses the CSS Custom Highlight API; `mark` forces the `<mark>` fallback. */
  readonly renderer: 'css' | 'mark';
}

export function readConfig(search: string): DemoConfig {
  const params = new URLSearchParams(search);
  return {
    store: params.get('store') === 'w3c' ? 'w3c' : 'memory',
    endpoint: params.get('endpoint') ?? 'http://localhost:4000/anno/',
    renderer: params.get('renderer') === 'mark' ? 'mark' : 'css',
  };
}

export function createStore(config: DemoConfig): AnnotationStore {
  if (config.store === 'w3c') {
    return new ProtocolAnnotationStore(
      new AnnotationProtocolClient({ containerUrl: config.endpoint }),
    );
  }
  return new MemoryAnnotationStore();
}

export function createDemoService(config: DemoConfig): AnnotationService {
  return new AnnotationService({
    store: createStore(config),
    creator: { type: 'Person', id: 'https://demo.spannote.dev/users/tester', name: 'Demo tester' },
    source: () => window.location.origin + window.location.pathname,
  });
}
