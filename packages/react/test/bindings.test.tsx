import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import { SpanNoteProvider, useAnnotations, useAnnotationService } from '@spannote/react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let reactRoot: Root;

function List() {
  const annotations = useAnnotations();
  return (
    <ul data-testid="list">
      {annotations.map((a) => (
        <li key={a.id}>{a.body[0]?.value}</li>
      ))}
    </ul>
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  reactRoot = createRoot(container);
});

afterEach(() => {
  act(() => {
    reactRoot.unmount();
  });
  container.remove();
});

describe('@spannote/react', () => {
  it('renders the annotations and updates when the service changes', async () => {
    const service = new AnnotationService({
      store: new MemoryAnnotationStore(),
      newId: () => 'id-1',
      now: () => new Date(0),
    });
    const main = document.createElement('main');
    main.innerHTML = '<p>Select this sentence please.</p>';
    document.body.appendChild(main);

    act(() => {
      reactRoot.render(
        <SpanNoteProvider service={service} root={main}>
          <List />
        </SpanNoteProvider>,
      );
    });
    expect(container.querySelector('[data-testid="list"]')?.children).toHaveLength(0);

    const range = document.createRange();
    const text = (main.querySelector('p') as HTMLElement).firstChild as Text;
    range.setStart(text, 0);
    range.setEnd(text, 6);
    await act(async () => {
      await service.createFromRange(range, { body: 'shown after change' });
    });
    expect(container.textContent).toContain('shown after change');
    main.remove();
  });

  it('throws a helpful error when used outside the provider', () => {
    function Bare() {
      useAnnotationService();
      return null;
    }
    const originalError = console.error;
    console.error = () => undefined;
    try {
      expect(() => {
        act(() => {
          reactRoot.render(<Bare />);
        });
      }).toThrow(/inside <SpanNoteProvider>/);
    } finally {
      console.error = originalError;
    }
  });
});
