import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { AnnotationService, MemoryAnnotationStore } from '@spannote/core';
import {
  SpanNotePlugin,
  useAnchor,
  useAnnotations,
  useAnnotationService,
  useSpanNoteRoot,
} from '@spannote/vue';

let service: AnnotationService;
let main: HTMLElement;

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
});

afterEach(() => {
  main.remove();
});

describe('SpanNotePlugin', () => {
  it('provides the service to components', () => {
    const Probe = defineComponent({
      setup() {
        return () => h('span', useAnnotationService() === service ? 'same' : 'other');
      },
    });
    const wrapper = mount(Probe, { global: { plugins: [[SpanNotePlugin, { service }]] } });
    expect(wrapper.text()).toBe('same');
  });

  it('fails clearly when the plugin is not installed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Orphan = defineComponent({
      setup() {
        useAnnotationService();
        return () => h('span');
      },
    });
    expect(() => mount(Orphan)).toThrow(/needs app.use\(SpanNotePlugin/);
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('useAnnotations', () => {
  it('updates when the service creates an annotation', async () => {
    service.attach(main);
    const List = defineComponent({
      setup() {
        const annotations = useAnnotations();
        return () =>
          h(
            'ul',
            annotations.value.map((a) => h('li', a.body[0]?.value)),
          );
      },
    });
    const wrapper = mount(List, { global: { plugins: [[SpanNotePlugin, { service }]] } });
    expect(wrapper.findAll('li')).toHaveLength(0);

    await service.createFromRange(selectText('12% of users'), { body: 'Which quarter?' });
    await nextTick();
    expect(wrapper.text()).toContain('Which quarter?');
  });
});

describe('useAnchor', () => {
  it('reports the attached state of an annotation', async () => {
    service.attach(main);
    const created = await service.createFromRange(selectText('12% of users'), { body: 'x' });

    const Probe = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props) {
        const state = useAnchor(() => props.id);
        return () => h('span', state.value?.status ?? 'unknown');
      },
    });
    const wrapper = mount(Probe, {
      props: { id: created.id },
      global: { plugins: [[SpanNotePlugin, { service }]] },
    });
    expect(wrapper.text()).toBe('attached');
  });
});

describe('useSpanNoteRoot', () => {
  it('attaches on mount and detaches on unmount', () => {
    const attach = vi.spyOn(service, 'attach');
    const detach = vi.spyOn(service, 'detach');
    const Host = defineComponent({
      setup() {
        useSpanNoteRoot(() => main);
        return () => h('div');
      },
    });
    const wrapper = mount(Host, { global: { plugins: [[SpanNotePlugin, { service }]] } });
    expect(attach).toHaveBeenCalledWith(main);
    wrapper.unmount();
    expect(detach).toHaveBeenCalled();
  });
});
