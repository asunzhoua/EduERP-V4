import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

export interface ErrorResponse {
  code: number;
  message: string;
  /** Only exposed in non-production environments */
  error?: string;
  /** Only exposed in non-production environments */
  timestamp?: string;
  /** Only exposed in non-production environments */
  path?: string;
}

@Catch()
export class OptimizedExceptionFilter implements ExceptionFilter {
  constructor(@Inject(ConfigService) private configService?: ConfigService) {}

  private get isProduction(): boolean {
    const env =
      this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV;
    return env === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let isValidationArray = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as { message?: string | string[] };
        if (Array.isArray(resp.message)) {
          // ValidationPipe 的 400 是字段错误数组，统一用通用文案
          isValidationArray = true;
          message = resp.message.join('; ');
        } else {
          message = (resp.message as string | undefined) || exception.message;
        }
      }
    }

    // Optimize user-facing message
    const optimizedMessage = this.optimizeMessage(status, message, isValidationArray);

    const errorResponse: ErrorResponse = {
      code: status,
      message: optimizedMessage,
    };

    // Expose technical details only in non-production environments
    if (!this.isProduction) {
      let error: string | undefined;
      if (exception instanceof HttpException) {
        const exceptionResponse = exception.getResponse();
        if (typeof exceptionResponse === 'object') {
          const resp = exceptionResponse as { error?: string };
          error = resp.error || exception.constructor.name;
        } else {
          error = exception.constructor.name;
        }
      } else if (exception instanceof Error) {
        error = exception.name;
      }
      errorResponse.error = error;
      errorResponse.timestamp = new Date().toISOString();
      errorResponse.path = request.url;
    }

    response.status(status).json(errorResponse);
  }

  private optimizeMessage(
    status: HttpStatus,
    message: string,
    isValidationArray = false,
  ): string {
    // Preserve specific app-authored messages for auth failures (401/403),
    // resource conflicts (409), and business BadRequestException (400) so users
    // see the real reason (e.g. 密码错误 / 无待发放工资条) instead of a generic
    // placeholder. NestJS builds generic English defaults for no-arg exceptions.
    const isSpecific =
      status === HttpStatus.BAD_REQUEST ||
      status === HttpStatus.UNAUTHORIZED ||
      status === HttpStatus.FORBIDDEN ||
      status === HttpStatus.CONFLICT;
    const isGenericDefault =
      message === 'Bad Request' ||
      message === 'Unauthorized' ||
      message === 'Forbidden' ||
      message === 'Conflict';
    // 校验类 400（ValidationPipe 字段错误数组）不暴露英文明细，用通用文案
    if (status === HttpStatus.BAD_REQUEST && (isValidationArray || isGenericDefault)) {
      return '请求参数错误，请检查输入';
    }
    if (isSpecific && message && !isGenericDefault) {
      return message;
    }

    const messageMap: Record<number, string> = {
      400: '请求参数错误，请检查输入',
      401: '未授权，请先登录',
      403: '权限不足，无法访问该资源',
      404: '请求的资源不存在',
      409: '资源冲突，请检查数据',
      422: '请求数据格式不正确',
      429: '请求过于频繁，请稍后再试',
      500: '服务器内部错误，请稍后再试',
      502: '网关错误，请稍后再试',
      503: '服务暂时不可用，请稍后再试',
      504: '网关超时，请稍后再试',
    };

    return messageMap[status] || message || '未知错误';
  }
}
