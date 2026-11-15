import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isVersionConflict } from '@spannote/model';
import { AnnotationService, EmptySelectionError, MemoryAnnotationStore } from '@spannote/core';

const TEXT = 'Across the base, 12% of users churn each quarter after the first renewal.';
let root: HTMLElement;
let counter = 0;

function makeService(store = new MemoryAnnotationStore()): AnnotationService {
  return new AnnotationService({
    store,
    source: () => 'https://example.org/pricing',
    now: () => new Date('2026-11-15T10:00:00Z'),
    newId: () => `https://example.org/anno/${++counter}`,
  });
}

function selectText(needle: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const at = (n as Text).data.indexOf(needle);
    if (at !== -1) {
      const r = document.createRange();
      r.setStart(n, at);
      r.setEnd(n, at + needle.length);
      return r;
    }
  }
  throw new Error('text not found');
}

beforeEach(() => {
  counter = 0;
  root = document.createElement('main');
  root.innerHTML = `<p>${TEXT}</p>`;
  document.body.replaceChildren(root);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('AnnotationService', () => {
  it('refuses to create annotations before a root is attached', async () => {
    const service = makeService();
    await expect(service.createFromRange(selectText('12%'), { body: 'x' })).rejects.toThrow(
      /attach/,
    );
  });

  it('creates an annotation from a selection and reports it attached', async () => {
    const service = makeService();
    service.attach(root);
    const created = await service.createFromRange(selectText('12% of users'), {
      body: 'Which quarter?',
    });

    expect(created.target.source).toBe('https://example.org/pricing');
    expect(service.annotations.map((a) => a.id)).toEqual([created.id]);
    expect(service.anchors.get(created.id)?.status).toBe('attached');
  });

  it('emits change and anchors events', async () => {
    const service = makeService();
    service.attach(root);
    const changes: number[] = [];
    const states: string[] = [];
    service.on('change', (list) => changes.push(list.length));
    service.on('anchors', (map) => states.push(String(map.size)));
    await service.createFromRange(selectText('12% of users'), { body: 'x' });
    expect(changes).toEqual([1]);
    expect(states.length).toBeGreaterThan(0);
  });

  it('rejects an empty selection', async () => {
    const service = makeService();
    service.attach(root);
    const collapsed = document.createRange();
    collapsed.setStart(root.querySelector('p')?.firstChild as Text, 0);
    collapsed.collapse(true);
    await expect(service.createFromRange(collapsed, { body: 'x' })).rejects.toBeInstanceOf(
      EmptySelectionError,
    );
  });

  it('marks an annotation orphan when its text disappears', async () => {
    const service = makeService();
    service.attach(root);
    const created = await service.createFromRange(selectText('12% of users'), { body: 'x' });
    const paragraph = root.querySelector('p');
    if (paragraph) paragraph.textContent = 'Something else entirely.';
    service.refreshAnchors();
    expect(service.anchors.get(created.id)?.status).toBe('orphan');
  });

  it('replies point back at the parent and share its target', async () => {
    const service = makeService();
    service.attach(root);
    const parent = await service.createFromRange(selectText('12% of users'), { body: 'Q?' });
    const reply = await service.reply(parent, { body: 'Q3.' });
    expect(reply.motivation).toBe('replying');
    expect(reply.inReplyTo).toBe(parent.id);
    expect(reply.target.selector).toEqual(parent.target.selector);
  });

  it('updates and removes annotations through the store', async () => {
    const service = makeService();
    service.attach(root);
    const created = await service.createFromRange(selectText('12% of users'), { body: 'old' });
    const updated = await service.update(created.id, { body: 'new', status: 'resolved' });
    expect(updated.body[0]?.value).toBe('new');
    expect(updated.status).toBe('resolved');

    await service.remove(created.id);
    expect(service.annotations).toHaveLength(0);
  });

  it('detects a stale write from a second client as a version conflict', async () => {
    const store = new MemoryAnnotationStore();
    const first = makeService(store);
    first.attach(root);
    const created = await first.createFromRange(selectText('12% of users'), { body: 'v1' });

    const second = makeService(store);
    await second.load();
    await second.update(created.id, { body: 'v2' });

    const stale = first.update(created.id, { body: 'v3' });
    await expect(stale).rejects.toSatisfy((error: unknown) => isVersionConflict(error));
  });

  it('loads annotations from the store and anchors them', async () => {
    const store = new MemoryAnnotationStore();
    const writer = makeService(store);
    writer.attach(root);
    const created = await writer.createFromRange(selectText('12% of users'), { body: 'stored' });

    const reader = makeService(store);
    reader.attach(root);
    await reader.load();
    expect(reader.annotations.map((a) => a.id)).toEqual([created.id]);
    expect(reader.anchors.get(created.id)?.status).toBe('attached');
  });
});
