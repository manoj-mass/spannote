import {
  ANNO_MEDIA_TYPE,
  parseAnnotation,
  toJsonLd,
  type Annotation,
  type ParseIssue,
  type Versioned,
} from '@spannote/model';
import { ConflictError, NotFoundError, ProtocolError } from './errors.js';
import { defaultFetch, type FetchLike, type HeaderProvider } from './transport.js';

export interface ProtocolClientOptions {
  /** The annotation container URL (an LDP container). */
  readonly containerUrl: string;
  readonly fetch?: FetchLike;
  readonly headers?: HeaderProvider;
}

/** The W3C Annotation Protocol's HTTP interactions, expressed as typed methods. */
export class AnnotationProtocolClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: ProtocolClientOptions) {
    this.fetchImpl = options.fetch ?? defaultFetch();
  }

  /** Reads every page of the container. Follows `first` and `next` links. */
  async list(): Promise<readonly Versioned<Annotation>[]> {
    const items: Versioned<Annotation>[] = [];
    const container = await this.getJson(this.options.containerUrl, {
      Prefer:
        'return=representation; include="http://www.w3.org/ns/oa#PreferContainedDescriptions"',
    });
    let page: unknown = isRecord(container) ? container['first'] : undefined;
    const seen = new Set<string>();
    while (page !== undefined) {
      let pageBody: unknown = page;
      if (typeof page === 'string') {
        if (seen.has(page)) break;
        seen.add(page);
        pageBody = await this.getJson(page);
      }
      if (!isRecord(pageBody)) break;
      for (const raw of Array.isArray(pageBody['items']) ? pageBody['items'] : []) {
        const parsed = parseAnnotation(raw);
        if (parsed.ok) items.push({ value: parsed.value.annotation, version: undefined });
      }
      page = pageBody['next'];
    }
    return items;
  }

  /** Reads one annotation together with its ETag. */
  async get(id: string): Promise<Versioned<Annotation>> {
    const response = await this.request('GET', id, { Accept: ANNO_MEDIA_TYPE });
    return this.parseResponse(response, id);
  }

  /** Creates an annotation. The server assigns the id; the returned value carries it. */
  async create(annotation: Annotation): Promise<Versioned<Annotation>> {
    const response = await this.request(
      'POST',
      this.options.containerUrl,
      {
        'Content-Type': ANNO_MEDIA_TYPE,
        Accept: ANNO_MEDIA_TYPE,
      },
      JSON.stringify(toJsonLd(annotation)),
    );
    if (response.status !== 201) throw await protocolErrorFor(response, 'create');
    const location = response.headers.get('Location');
    const body = await response.text();
    if (body) {
      const parsed = parseAnnotation(safeJson(body));
      if (parsed.ok)
        return {
          value: parsed.value.annotation,
          version: response.headers.get('ETag') ?? undefined,
        };
    }
    if (location) return this.get(location);
    throw new ProtocolError(
      response.status,
      'Created, but the response had neither a body nor a Location.',
    );
  }

  /**
   * Replaces an annotation (PUT). Pass the version from the last read as `version`; the server
   * rejects the write with 412 when the stored version has changed since then.
   */
  async update(
    annotation: Annotation,
    version: string | undefined,
  ): Promise<Versioned<Annotation>> {
    const headers: Record<string, string> = {
      'Content-Type': ANNO_MEDIA_TYPE,
      Accept: ANNO_MEDIA_TYPE,
    };
    if (version !== undefined) headers['If-Match'] = version;
    const response = await this.request(
      'PUT',
      annotation.id,
      headers,
      JSON.stringify(toJsonLd(annotation)),
    );
    if (response.status === 412) throw new ConflictError();
    if (response.status !== 200) throw await protocolErrorFor(response, 'update');
    return this.parseResponse(response, annotation.id);
  }

  /** Deletes an annotation (DELETE). Accepts an optional version for optimistic concurrency. */
  async remove(id: string, version: string | undefined): Promise<void> {
    const headers: Record<string, string> = {};
    if (version !== undefined) headers['If-Match'] = version;
    const response = await this.request('DELETE', id, headers);
    if (response.status === 412) throw new ConflictError();
    if (response.status === 404) throw new NotFoundError();
    if (response.status !== 204 && response.status !== 200)
      throw await protocolErrorFor(response, 'delete');
  }

  private async getJson(url: string, extra: Record<string, string> = {}): Promise<unknown> {
    const response = await this.request('GET', url, { Accept: ANNO_MEDIA_TYPE, ...extra });
    if (!response.ok) throw await protocolErrorFor(response, 'read');
    return safeJson(await response.text());
  }

  private async parseResponse(response: Response, id: string): Promise<Versioned<Annotation>> {
    if (response.status === 404) throw new NotFoundError(`Annotation ${id} was not found (404).`);
    if (!response.ok) throw await protocolErrorFor(response, 'read');
    const parsed = parseAnnotation(safeJson(await response.text()));
    if (!parsed.ok) throw new ProtocolError(response.status, describeIssues(parsed.error));
    return { value: parsed.value.annotation, version: response.headers.get('ETag') ?? undefined };
  }

  private async request(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<Response> {
    const extra = (await this.options.headers?.()) ?? {};
    const init: RequestInit = { method, headers: { ...extra, ...headers } };
    if (body !== undefined) init.body = body;
    return this.fetchImpl(url, init);
  }
}

async function protocolErrorFor(response: Response, action: string): Promise<ProtocolError> {
  const body = await response.text().catch(() => '');
  return new ProtocolError(response.status, `Failed to ${action}: HTTP ${response.status}`, body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJson(text: string): unknown {
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function describeIssues(issues: readonly ParseIssue[]): string {
  return issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ');
}
