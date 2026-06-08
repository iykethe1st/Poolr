import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const status = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
          this.logger.log(`${method} ${url} ${status} ${ms}ms`);
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          this.logger.error(`${method} ${url} ERROR ${ms}ms — ${err.message}`);
        },
      }),
    );
  }
}
