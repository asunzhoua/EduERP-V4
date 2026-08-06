import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLogger } from '@utils/logger';

export interface ResponseMetadata {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  timestamp: string;
  isSlow: boolean;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new AppLogger();
  private readonly slowRequestThreshold = 1000; // 1 second

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          const isSlow = duration > this.slowRequestThreshold;

          const metadata: ResponseMetadata = {
            method,
            url,
            statusCode,
            duration,
            timestamp: new Date().toISOString(),
            isSlow,
          };

          this.logPerformance(metadata);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          const metadata: ResponseMetadata = {
            method,
            url,
            statusCode,
            duration,
            timestamp: new Date().toISOString(),
            isSlow: duration > this.slowRequestThreshold,
          };

          this.logPerformance(metadata);
        },
      }),
    );
  }

  private logPerformance(metadata: ResponseMetadata): void {
    const logMessage = `${metadata.method} ${metadata.url} → ${metadata.statusCode} (${metadata.duration}ms)`;

    if (metadata.isSlow) {
      this.logger.warn(`[SLOW REQUEST] ${logMessage}`, 'Performance');
    } else {
      this.logger.log(logMessage, 'Performance');
    }

    // 记录到性能日志文件
    this.logToPerformanceFile(metadata);
  }

  private logToPerformanceFile(metadata: ResponseMetadata): void {
    // 这里可以写入专门的性能日志文件
    // 例如：logs/performance.log
    const logLine = JSON.stringify(metadata) + '\n';
    
    // 使用 AppLogger 的 logApi 方法
    this.logger.logApi(
      metadata.method,
      metadata.url,
      metadata.statusCode,
      metadata.duration,
    );
  }
}
