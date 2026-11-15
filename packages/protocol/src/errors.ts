/** An HTTP response the protocol does not accept. */
export class ProtocolError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/** The server rejected a write because the version (ETag) is stale. Re-read, merge, retry. */
export class ConflictError extends ProtocolError {
  constructor(message = 'The annotation changed on the server (412 Precondition Failed).') {
    super(412, message);
    this.name = 'ConflictError';
  }
}

/** The annotation does not exist on the server. */
export class NotFoundError extends ProtocolError {
  constructor(message = 'The annotation was not found (404).') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}
