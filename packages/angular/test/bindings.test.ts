import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import {
  attachSpanNoteRoot,
  injectAnchor,
  injectAnnotations,
  injectSpanNote,
  provideSpanNote,
} from '@spannote/angular';

let service: AnnotationService;
let main: HTMLElement;

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

function selectText(needle: string): Range {
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const at = text.data.indexOf(needle);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + needle.length);
      return range;
    }
  }
  throw new Error(`text not found: ${needle}`);
}

beforeEach(() => {
  service = new AnnotationService({
    store: new MemoryAnnotationStore(),
    newId: () => 'https://example.org/anno/1',
    now: () => new Date('2026-01-01T00:00:00Z'),
    source: () => 'https://example.org/page',
  });
  main = document.createElement('main');
  main.innerHTML = '<p>Across the base, 12% of users churn each quarter.</p>';
  document.body.appendChild(main);
  TestBed.configureTestingModule({ providers: [provideSpanNote(service)] });
});

afterEach(() => {
  TestBed.resetTestingModule();
  main.remove();
});

describe('provideSpanNote and injectSpanNote', () => {
  it('provides the same service that was passed in', () => {
    const same = TestBed.runInInjectionContext(() => injectSpanNote() === service);
    expect(same).toBe(true);
  });

  it('fails clearly when the provider is missing', () => {
    TestBed.resetTestingModule();
    expect(() => TestBed.runInInjectionContext(() => injectSpanNote())).toThrow(
      /needs provideSpanNote/,
    );
  });
});

describe('injectAnnotations', () => {
  it('updates when the service creates an annotation', async () => {
    service.attach(main);
    const annotations = TestBed.runInInjectionContext(() => injectAnnotations());
    expect(annotations()).toHaveLength(0);

    await service.createFromRange(selectText('12% of users'), { body: 'Which quarter?' });
    expect(annotations().map((a) => a.body[0]?.value)).toEqual(['Which quarter?']);
  });
});

describe('injectAnchor', () => {
  it('reports the attached state of an annotation', async () => {
    service.attach(main);
    const created = await service.createFromRange(selectText('12% of users'), { body: 'x' });
    const state = TestBed.runInInjectionContext(() => injectAnchor(() => created.id));
    expect(state()?.status).toBe('attached');
  });
});

describe('attachSpanNoteRoot', () => {
  it('attaches to the root when the effect runs and detaches when the injector is destroyed', () => {
    const attach = vi.spyOn(service, 'attach');
    const detach = vi.spyOn(service, 'detach');
    TestBed.runInInjectionContext(() => {
      attachSpanNoteRoot(() => main);
    });
    TestBed.tick();
    expect(attach).toHaveBeenCalledWith(main);

    TestBed.resetTestingModule();
    expect(detach).toHaveBeenCalled();
  });
});
