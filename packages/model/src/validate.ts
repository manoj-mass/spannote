import { fail, ok, type Result } from './result.js';
import {
  MOTIVATIONS,
  type Agent,
  type Annotation,
  type AnnotationStatus,
  type Motivation,
  type ParseIssue,
  type Selector,
  type SpecificResource,
  type TextQuoteSelector,
  type TextPositionSelector,
  type TextualBody,
} from './types.js';

/** A successfully parsed annotation, plus non-fatal issues (for example, dropped unknown selectors). */
export interface ParsedAnnotation {
  readonly annotation: Annotation;
  readonly warnings: readonly ParseIssue[];
}

type Record_ = Readonly<Record<string, unknown>>;

interface Collector {
  readonly errors: ParseIssue[];
  readonly warnings: ParseIssue[];
}

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(c: Collector, path: string, message: string): void {
  c.errors.push({ path, message });
}

function warn(c: Collector, path: string, message: string): void {
  c.warnings.push({ path, message });
}

function readString(
  c: Collector,
  obj: Record_,
  key: string,
  path: string,
  required: boolean,
): string | undefined {
  const value = obj[key];
  if (value === undefined) {
    if (required) error(c, path, `${key} is required`);
    return undefined;
  }
  if (typeof value !== 'string') {
    error(c, path, `${key} must be a string`);
    return undefined;
  }
  return value;
}

function parseMotivation(c: Collector, value: unknown, path: string): Motivation | undefined {
  // The spec allows a single motivation or an array. We keep the first recognised one.
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && (MOTIVATIONS as readonly string[]).includes(candidate)) {
      return candidate as Motivation;
    }
  }
  error(c, path, 'motivation must be one of the standard motivations');
  return undefined;
}

/**
 * A malformed selector is dropped with a warning, like an unknown one. One bad selector must not
 * make the whole target unusable when another selector is fine.
 */
function parseSelector(c: Collector, value: unknown, path: string): Selector | undefined {
  const local: Collector = { errors: [], warnings: [] };
  const selector = parseSelectorStrict(local, value, path);
  for (const issue of [...local.errors, ...local.warnings]) {
    c.warnings.push(issue);
  }
  return selector;
}

function parseSelectorStrict(c: Collector, value: unknown, path: string): Selector | undefined {
  if (!isRecord(value)) {
    error(c, path, 'selector must be an object');
    return undefined;
  }
  switch (value['type']) {
    case 'TextQuoteSelector': {
      const exact = readString(c, value, 'exact', path, true);
      if (exact === undefined) return undefined;
      const selector: { -readonly [K in keyof TextQuoteSelector]: TextQuoteSelector[K] } = {
        type: 'TextQuoteSelector',
        exact,
      };
      const prefix = readString(c, value, 'prefix', path, false);
      const suffix = readString(c, value, 'suffix', path, false);
      if (prefix !== undefined) selector.prefix = prefix;
      if (suffix !== undefined) selector.suffix = suffix;
      return selector;
    }
    case 'TextPositionSelector': {
      const { start, end } = value;
      if (!isNonNegativeInteger(start) || !isNonNegativeInteger(end) || start > end) {
        error(c, path, 'TextPositionSelector needs integer start and end with 0 <= start <= end');
        return undefined;
      }
      const selector: TextPositionSelector = { type: 'TextPositionSelector', start, end };
      return selector;
    }
    default:
      // Unknown selectors are valid in the spec; this version simply does not use them.
      warn(c, path, `unsupported selector type ${String(value['type'])}; ignored`);
      return undefined;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseTarget(c: Collector, value: unknown): SpecificResource | undefined {
  if (!isRecord(value)) {
    error(c, 'target', 'target must be an object with a source and selectors');
    return undefined;
  }
  const source = readString(c, value, 'source', 'target', true);
  const rawSelectors = Array.isArray(value['selector'])
    ? value['selector']
    : value['selector'] === undefined
      ? []
      : [value['selector']];
  const selectors: Selector[] = [];
  rawSelectors.forEach((raw, i) => {
    const selector = parseSelector(c, raw, `target.selector[${i}]`);
    if (selector) selectors.push(selector);
  });
  if (source === undefined) return undefined;
  if (selectors.length === 0) {
    error(c, 'target.selector', 'at least one supported selector is required');
    return undefined;
  }
  return { type: 'SpecificResource', source, selector: selectors };
}

function parseBodies(c: Collector, value: unknown): readonly TextualBody[] {
  if (value === undefined) return [];
  const list = Array.isArray(value) ? value : [value];
  const bodies: TextualBody[] = [];
  list.forEach((raw, i) => {
    const path = `body[${i}]`;
    if (!isRecord(raw) || raw['type'] !== 'TextualBody') {
      warn(c, path, 'only TextualBody bodies are supported; ignored');
      return;
    }
    const value_ = readString(c, raw, 'value', path, true);
    if (value_ === undefined) return;
    const format = raw['format'];
    const language = raw['language'];
    const body: { -readonly [K in keyof TextualBody]: TextualBody[K] } = {
      type: 'TextualBody',
      value: value_,
    };
    if (format === 'text/plain' || format === 'text/markdown' || format === 'text/html') {
      body.format = format;
    }
    if (typeof language === 'string') body.language = language;
    bodies.push(body);
  });
  return bodies;
}

function parseAgent(c: Collector, value: unknown, path: string): Agent | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return { id: value };
  if (!isRecord(value)) {
    error(c, path, 'agent must be a string or an object');
    return undefined;
  }
  const agent: { -readonly [K in keyof Agent]: Agent[K] } = {};
  const id = readString(c, value, 'id', path, false);
  const name = readString(c, value, 'name', path, false);
  if (id !== undefined) agent.id = id;
  if (name !== undefined) agent.name = name;
  const type = value['type'];
  if (type === 'Person' || type === 'Organization' || type === 'Software') agent.type = type;
  return agent;
}

function parseStatus(c: Collector, value: unknown): AnnotationStatus | undefined {
  if (value === undefined) return undefined;
  if (value === 'open' || value === 'resolved' || value === 'proposed') return value;
  error(c, 'sn:status', 'status must be open, resolved or proposed');
  return undefined;
}

/**
 * Parses untrusted JSON (already decoded) into an `Annotation`.
 *
 * Never throws. Returns `ok` with warnings for recoverable issues, or `fail` with the errors
 * that make the annotation unusable.
 */
export function parseAnnotation(input: unknown): Result<ParsedAnnotation, readonly ParseIssue[]> {
  const c: Collector = { errors: [], warnings: [] };
  if (!isRecord(input)) {
    return fail([{ path: '', message: 'annotation must be an object' }]);
  }
  if (input['type'] !== 'Annotation') error(c, 'type', 'type must be "Annotation"');
  const id = readString(c, input, 'id', 'id', true);
  const motivation = parseMotivation(c, input['motivation'], 'motivation');
  const target = parseTarget(c, input['target']);
  const body = parseBodies(c, input['body']);
  const creator = parseAgent(c, input['creator'], 'creator');
  const generator = parseAgent(c, input['generator'], 'generator');
  const created = readString(c, input, 'created', 'created', false);
  const modified = readString(c, input, 'modified', 'modified', false);
  const status = parseStatus(c, input['sn:status']);
  const inReplyTo = readString(c, input, 'sn:inReplyTo', 'sn:inReplyTo', false);

  if (c.errors.length > 0 || id === undefined || motivation === undefined || target === undefined) {
    return fail(c.errors);
  }

  const annotation: {
    -readonly [K in keyof Annotation]: Annotation[K];
  } = { id, type: 'Annotation', motivation, target, body };
  if (creator !== undefined) annotation.creator = creator;
  if (generator !== undefined) annotation.generator = generator;
  if (created !== undefined) annotation.created = created;
  if (modified !== undefined) annotation.modified = modified;
  if (status !== undefined) annotation.status = status;
  if (inReplyTo !== undefined) annotation.inReplyTo = inReplyTo;
  return ok({ annotation, warnings: c.warnings });
}
