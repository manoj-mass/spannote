/**
 * Raised by a store when an update or delete uses a version that is no longer current.
 * Adapters may throw their own error class; it counts as a conflict if `isVersionConflict` is true.
 */
export class VersionConflictError extends Error {
  override readonly name = 'VersionConflictError';

  constructor(message = 'The annotation changed since it was read.') {
    super(message);
  }
}

/** True for `VersionConflictError` and for any error carrying HTTP status 412. */
export function isVersionConflict(error: unknown): boolean {
  if (error instanceof VersionConflictError) return true;
  return (
    typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 412
  );
}
