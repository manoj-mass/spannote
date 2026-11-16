import { isVersionConflict } from '@spannote/model';

function describeError(error: unknown): string {
  if (isVersionConflict(error))
    return 'Conflict: someone else changed this comment. Reload and try again.';
  return error instanceof Error ? error.message : String(error);
}

/** Runs one comment action and reports the outcome in the status line. */
export async function runAction(
  report: (message: string) => void,
  label: string,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    await action();
    report(`${label}: done.`);
  } catch (error) {
    report(`${label} failed. ${describeError(error)}`);
  }
}
