import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let errors: string[] | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(body.message)) {
        [message, ...errors] = body.message as string[];
        if (!errors.length) errors = undefined;
      } else {
        message = (body.message as string) ?? exception.message;
      }
    } else {
      message = exception.message;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: (HttpStatus as unknown as Record<number, string>)[status] ?? 'UNKNOWN',
      message,
      ...(errors?.length ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
