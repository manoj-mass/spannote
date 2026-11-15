/** The part of `fetch` the client uses. Injected, so tests and servers can supply their own. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Headers added to every request, for example an Authorization header. */
export type HeaderProvider = () =>
  Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;

export function defaultFetch(): FetchLike {
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) throw new Error('No fetch implementation available; pass one to the protocol client.');
  return (input, init) => f(input, init);
}
