import { of, throwError } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { ApiResponse } from '../dto/api-response';
import { ExecutionContext, CallHandler } from '@nestjs/common';

function mockContext() {
  return {} as ExecutionContext;
}

function mockHandler(data: unknown) {
  return { handle: () => of(data) } as CallHandler;
}

function mockHandlerThrow(error: unknown) {
  return { handle: () => throwError(() => error) } as CallHandler;
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  it('should wrap plain object into ApiResponse', (done) => {
    const data = { name: 'test' };
    interceptor.intercept(mockContext(), mockHandler(data)).subscribe((res) => {
      expect(res).toBeInstanceOf(ApiResponse);
      expect(res.code).toBe(0);
      expect(res.message).toBe('success');
      expect(res.data).toEqual(data);
      done();
    });
  });

  it('should wrap primitive value into ApiResponse', (done) => {
    interceptor.intercept(mockContext(), mockHandler(42)).subscribe((res) => {
      expect(res).toBeInstanceOf(ApiResponse);
      expect(res.code).toBe(0);
      expect(res.data).toBe(42);
      done();
    });
  });

  it('should wrap null into ApiResponse', (done) => {
    interceptor.intercept(mockContext(), mockHandler(null)).subscribe((res) => {
      expect(res).toBeInstanceOf(ApiResponse);
      expect(res.code).toBe(0);
      expect(res.data).toBeNull();
      done();
    });
  });

  it('should return ApiResponse as-is when already wrapped', (done) => {
    const already = ApiResponse.success({ id: 1 }, 'ok');
    interceptor.intercept(mockContext(), mockHandler(already)).subscribe((res) => {
      expect(res).toBe(already);
      done();
    });
  });

  it('should not catch errors thrown by the handler', (done) => {
    const error = new Error('boom');
    interceptor.intercept(mockContext(), mockHandlerThrow(error)).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        done();
      },
    });
  });
});
