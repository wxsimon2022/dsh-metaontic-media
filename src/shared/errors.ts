export type ErrorCode = 'CONFIG_INVALID' | 'AUTH_FAILED' | 'UNSUPPORTED_CAPABILITY' | 'RATE_LIMITED' | 'SUBMISSION_UNKNOWN' | 'REMOTE_FAILED' | 'DOWNLOAD_FAILED' | 'STORAGE_FAILED' | 'CONTENT_REJECTED';
export class MediaError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly retryAfterMs?: number) {
    super(message); this.name = 'MediaError';
  }
}
