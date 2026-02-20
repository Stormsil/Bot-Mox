import { randomUUID } from 'node:crypto';
import { net } from 'electron';
import type { Logger } from './logger';
import { apiEnvelopeSchema } from './schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// ApiClient — HTTP client for Bot-Mox cloud API
// ---------------------------------------------------------------------------

export class ApiClient {
  constructor(
    private serverUrl: string,
    private token: string,
    private logger: Logger,
  ) {}

  async get<T>(path: string, options?: { timeoutMs?: number }): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: { timeoutMs?: number }): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: { timeoutMs?: number }): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const url = `${this.serverUrl}${path}`;
    this.logger.info(`${method} ${path}`);

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        try {
          clearTimeout(timeout);
        } catch {
          // noop
        }
        fn();
      };

      const timeoutMs = Math.max(1_000, Math.trunc(Number(options?.timeoutMs) || 60_000));
      const request = net.request({
        method,
        url,
      });
      const requestId = randomUUID();

      if (this.token) {
        request.setHeader('Authorization', `Bearer ${this.token}`);
      }
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Accept', 'application/json');
      request.setHeader('x-request-id', requestId);
      request.setHeader('x-correlation-id', requestId);

      let responseData = '';
      let statusCode = 0;

      // Electron's net.request has no built-in timeout. If a reverse-proxy or TCP connection
      // stalls, the AgentLoop can hang forever waiting for 'end'. Abort defensively.
      const timeout = setTimeout(() => {
        const message = `Request timed out after ${Math.ceil(timeoutMs / 1000)}s`;
        this.logger.error(message);
        try {
          request.abort();
        } catch {
          // noop
        }
        settle(() => reject(new ApiError('TIMEOUT', message)));
      }, timeoutMs);

      request.on('response', (response) => {
        statusCode = response.statusCode;

        response.on('data', (chunk: Buffer) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          settle(() => {
            try {
              const rawEnvelope: unknown = JSON.parse(responseData);
              const parsedEnvelope = apiEnvelopeSchema.safeParse(rawEnvelope);
              if (!parsedEnvelope.success) {
                reject(
                  new ApiError(
                    'PARSE_ERROR',
                    `Failed to parse response envelope (HTTP ${statusCode})`,
                  ),
                );
                return;
              }

              const envelope = parsedEnvelope.data;

              if (envelope.success && envelope.data !== undefined) {
                resolve(envelope.data as T);
              } else if (envelope.error) {
                const err = new ApiError(envelope.error.code, envelope.error.message, statusCode);
                this.logger.error(`API error: ${err.code} — ${err.message}`);
                reject(err);
              } else if (envelope.success) {
                // Some endpoints return { success: true } without data
                resolve(undefined as T);
              } else {
                reject(
                  new ApiError('API_ERROR', `Request failed (HTTP ${statusCode})`, statusCode),
                );
              }
            } catch {
              reject(new ApiError('PARSE_ERROR', `Failed to parse response (HTTP ${statusCode})`));
            }
          });
        });
      });

      request.on('error', (error: Error) => {
        settle(() => {
          this.logger.error(`Network error: ${error.message}`);
          reject(new ApiError('NETWORK_ERROR', error.message));
        });
      });

      if (body !== undefined) {
        request.write(JSON.stringify(body));
      }

      request.end();
    });
  }

  updateCredentials(serverUrl: string, token: string): void {
    this.serverUrl = serverUrl;
    this.token = token;
  }
}
