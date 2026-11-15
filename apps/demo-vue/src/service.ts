import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { AnnotationProtocolClient, ProtocolAnnotationStore } from '@spannote/protocol';
import type { AnnotationStore } from '@spannote/model';

/** Settings read from the URL, the same ones the React demo accepts. */
export interface DemoConfig {
  readonly store: 'memory' | 'w3c';
  readonly endpoint: string;
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

function createStore(config: DemoConfig): AnnotationStore {
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
