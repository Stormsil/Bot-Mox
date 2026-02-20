import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

function toCodeFromLabel(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function defaultCodeFromStatus(statusCode: number): string {
  return `HTTP_${statusCode}`;
}

function defaultMessageFromStatus(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return 'Bad request';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.NOT_FOUND:
      return 'Not found';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    default:
      return 'Request failed';
  }
}

function normalizeHttpErrorPayload(
  statusCode: number,
  raw: unknown,
): { code: string; message: string; details?: unknown } {
  if (typeof raw === 'string') {
    return {
      code: defaultCodeFromStatus(statusCode),
      message: raw || defaultMessageFromStatus(statusCode),
    };
  }

  const payload = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const codeFromPayload = typeof payload.code === 'string' ? payload.code.trim() : '';
  const messageRaw = payload.message;
  const message =
    typeof messageRaw === 'string'
      ? messageRaw
      : Array.isArray(messageRaw)
        ? messageRaw.map((item) => String(item)).join('; ')
        : defaultMessageFromStatus(statusCode);

  const errorLabel = typeof payload.error === 'string' ? payload.error.trim() : '';
  const code =
    codeFromPayload ||
    (errorLabel ? toCodeFromLabel(errorLabel) : '') ||
    defaultCodeFromStatus(statusCode);

  const details =
    payload.details !== undefined
      ? payload.details
      : Array.isArray(messageRaw)
        ? { validation: messageRaw }
        : undefined;

  return details !== undefined ? { code, message, details } : { code, message };
}

@Catch()
export class HttpErrorEnvelopeFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorEnvelopeFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = normalizeHttpErrorPayload(statusCode, exception.getResponse());
      response.status(statusCode).json({
        success: false,
        error: payload,
      });
      return;
    }

    this.logger.error(
      `Unhandled error at ${request?.method || 'UNKNOWN'} ${request?.url || 'unknown'}: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
}
