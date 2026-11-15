import { describe, expect, it, vi } from 'vitest';
import { ANNO_MEDIA_TYPE, type Annotation } from '@spannote/model';
import {
  AnnotationProtocolClient,
  ConflictError,
  NotFoundError,
  ProtocolAnnotationStore,
  ProtocolError,
  type FetchLike,
} from '@spannote/protocol';

const CONTAINER = 'https://example.org/annotations/';

const anno = (id: string): Annotation => ({
  id,
  type: 'Annotation',
  motivation: 'commenting',
  target: {
    type: 'SpecificResource',
    source: 'https://example.org/page',
    selector: [{ type: 'TextQuoteSelector', exact: 'hi' }],
  },
  body: [{ type: 'TextualBody', value: 'hi' }],
});

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': ANNO_MEDIA_TYPE },
    ...init,
  });
}

describe('AnnotationProtocolClient', () => {
  it('lists every page of the container, following next links', async () => {
    const fetch = vi.fn<FetchLike>((url) => {
      if (url === CONTAINER) {
        return Promise.resolve(
          json({
            type: 'AnnotationCollection',
            first: {
              type: 'AnnotationPage',
              items: [anno('a')],
              next: 'https://example.org/annotations/?page=2',
            },
          }),
        );
      }
      return Promise.resolve(json({ type: 'AnnotationPage', items: [anno('b')] }));
    });
    const client = new AnnotationProtocolClient({ containerUrl: CONTAINER, fetch });
    const items = await client.list();
    expect(items.map((i) => i.value.id)).toEqual(['a', 'b']);
    expect(fetch).toHaveBeenCalledTimes(2); // container, then the next page
  });

  it('creates with the protocol media type and returns the server copy', async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.resolve(
        json(anno('https://example.org/annotations/7'), {
          status: 201,
          headers: {
            'Content-Type': ANNO_MEDIA_TYPE,
            Location: 'https://example.org/annotations/7',
            ETag: '"v1"',
          },
        }),
      ),
    );
    const client = new AnnotationProtocolClient({ containerUrl: CONTAINER, fetch });
    const saved = await client.create(anno('draft'));
    expect(saved.value.id).toBe('https://example.org/annotations/7');
    expect(saved.version).toBe('"v1"');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(ANNO_MEDIA_TYPE);
  });

  it('sends If-Match on update and reports 412 as a ConflictError', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response('', { status: 412 })));
    const client = new AnnotationProtocolClient({ containerUrl: CONTAINER, fetch });
    await expect(client.update(anno('x'), '"v1"')).rejects.toBeInstanceOf(ConflictError);
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('"v1"');
  });

  it('maps 404 on delete to NotFoundError and 204 to success', async () => {
    const notFound = new AnnotationProtocolClient({
      containerUrl: CONTAINER,
      fetch: () => Promise.resolve(new Response('', { status: 404 })),
    });
    await expect(notFound.remove('x', undefined)).rejects.toBeInstanceOf(NotFoundError);

    const ok = new AnnotationProtocolClient({
      containerUrl: CONTAINER,
      fetch: () => Promise.resolve(new Response(null, { status: 204 })),
    });
    await expect(ok.remove('x', undefined)).resolves.toBeUndefined();
  });

  it('adds headers from the provider to every request', async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = new AnnotationProtocolClient({
      containerUrl: CONTAINER,
      fetch,
      headers: () => ({ Authorization: 'Bearer t' }),
    });
    await client.remove('x', undefined);
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer t');
  });

  it('throws ProtocolError with the status for unexpected responses', async () => {
    const client = new AnnotationProtocolClient({
      containerUrl: CONTAINER,
      fetch: () => Promise.resolve(new Response('boom', { status: 500 })),
    });
    await expect(client.get('x')).rejects.toBeInstanceOf(ProtocolError);
  });
});

describe('ProtocolAnnotationStore', () => {
  it('delegates to the client', async () => {
    const client = new AnnotationProtocolClient({
      containerUrl: CONTAINER,
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ type: 'AnnotationCollection', first: { items: [] } }), {
            status: 200,
          }),
        ),
    });
    const store = new ProtocolAnnotationStore(client);
    await expect(store.list()).resolves.toEqual([]);
  });
});
