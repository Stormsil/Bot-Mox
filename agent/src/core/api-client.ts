import { net } from 'electron';
import { Logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

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

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.serverUrl}${path}`;
    this.logger.info(`${method} ${path}`);

    return new Promise<T>((resolve, reject) => {
      const request = net.request({
        method,
        url,
      });

      request.setHeader('Authorization', `Bearer ${this.token}`);
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Accept', 'application/json');

      let responseData = '';
      let statusCode = 0;

      request.on('response', (response) => {
        statusCode = response.statusCode;

        response.on('data', (chunk: Buffer) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          try {
            const envelope: ApiEnvelope<T> = JSON.parse(responseData);

            if (envelope.success && envelope.data !== undefined) {
              resolve(envelope.data);
            } else if (envelope.error) {
              const err = new ApiError(
                envelope.error.code,
                envelope.error.message,
                statusCode,
              );
              this.logger.error(`API error: ${err.code} — ${err.message}`);
              reject(err);
            } else {
              // Some endpoints return { success: true } without data
              resolve(undefined as T);
            }
          } catch {
            reject(new ApiError('PARSE_ERROR', `Failed to parse response (HTTP ${statusCode})`));
          }
        });
      });

      request.on('error', (error: Error) => {
        this.logger.error(`Network error: ${error.message}`);
        reject(new ApiError('NETWORK_ERROR', error.message));
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
