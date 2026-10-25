/** Queued from session-complete UI; consumed when Revision Hub tab gains focus. */
export type RevisionPendingAutoSessionKind = "difficultWords";

let pending: RevisionPendingAutoSessionKind | null = null;

export function queueRevisionAutoSession(
  kind: RevisionPendingAutoSessionKind,
): void {
  pending = kind;
}

export function consumePendingRevisionAutoSession(): RevisionPendingAutoSessionKind | null {
  const next = pending;
  pending = null;
  return next;
}
