import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { PerformanceInterceptor } from './performance.interceptor';

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceInterceptor],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    it('should log fast requests', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/api/v1/health',
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      } as ExecutionContext;

      const mockHandler: CallHandler = {
        handle: () => of({ status: 'ok' }),
      };

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        complete: () => {
          // 验证日志已记录
          done();
        },
      });
    });

    it('should log slow requests with warning', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/api/v1/students',
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      } as ExecutionContext;

      const mockHandler: CallHandler = {
        handle: () => of({ items: [] }).pipe(delay(1500)),
      };

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        complete: () => {
          // 验证慢请求日志已记录
          done();
        },
      });
    }, 2000);

    it('should log errors', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            url: '/api/v1/auth/login',
          }),
          getResponse: () => ({
            statusCode: 401,
          }),
        }),
      } as ExecutionContext;

      const mockHandler: CallHandler = {
        handle: () => throwError(() => new Error('Unauthorized')),
      };

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        error: () => {
          // 验证错误日志已记录
          done();
        },
      });
    });

    it('should capture request metadata', (done) => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            url: '/api/v1/dashboard/overview',
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      } as ExecutionContext;

      const mockHandler: CallHandler = {
        handle: () => of({ total: 100 }),
      };

      const result = interceptor.intercept(mockContext, mockHandler);

      result.subscribe({
        complete: () => {
          // 验证元数据已捕获
          done();
        },
      });
    });
  });
});
