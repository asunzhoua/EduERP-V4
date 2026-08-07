import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { OptimizedExceptionFilter } from './optimized-exception.filter';
import { ConfigService } from '@nestjs/config';

describe('OptimizedExceptionFilter', () => {
  let filter: OptimizedExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  const createTestModule = async (nodeEnv?: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizedExceptionFilter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return nodeEnv || 'test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    return module.get<OptimizedExceptionFilter>(OptimizedExceptionFilter);
  };

  beforeEach(async () => {
    filter = await createTestModule('development');

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: '/api/v1/test',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('HttpException', () => {
    it('should handle 400 Bad Request', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: '请求参数错误，请检查输入',
          path: '/api/v1/test',
        })
      );
    });

    it('should handle 401 Unauthorized', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 401,
          message: '未授权，请先登录',
        })
      );
    });

    it('should preserve a specific 401 message (e.g. 密码错误)', () => {
      const exception = new HttpException('密码错误', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 401,
          message: '密码错误',
        })
      );
    });

    it('should map an empty 401 message to the generic text', () => {
      const exception = new HttpException('', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 401,
          message: '未授权，请先登录',
        })
      );
    });

    it('should preserve a specific 403 message (e.g. 无权访问该学生的记录)', () => {
      const exception = new HttpException('无权访问该学生的记录', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: '无权访问该学生的记录',
        })
      );
    });

    it('should handle 403 Forbidden', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: '权限不足，无法访问该资源',
        })
      );
    });

    it('should handle 404 Not Found', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          message: '请求的资源不存在',
        })
      );
    });

    it('should handle 500 Internal Server Error', () => {
      const exception = new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: '服务器内部错误，请稍后再试',
        })
      );
    });
  });

  describe('Unknown Exception', () => {
    it('should handle unknown exception', () => {
      const exception = new Error('Unknown error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: '服务器内部错误，请稍后再试',
        })
      );
    });

    it('should handle non-Error exception', () => {
      const exception = 'String error';

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: '服务器内部错误，请稍后再试',
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should include timestamp, path, and error in non-production', () => {
      const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          path: '/api/v1/test',
          error: expect.any(String),
        })
      );
    });
  });

  describe('Production mode', () => {
    it('should hide error details when NODE_ENV=production', async () => {
      filter = await createTestModule('production');
      const exception = new HttpException('Test Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      const calledWith = mockResponse.json.mock.calls[0][0];
      expect(calledWith.code).toBe(500);
      expect(calledWith.message).toBe('服务器内部错误，请稍后再试');
      expect(calledWith.error).toBeUndefined();
      expect(calledWith.timestamp).toBeUndefined();
      expect(calledWith.path).toBeUndefined();
    });

    it('should hide error for unknown exception in production', async () => {
      filter = await createTestModule('production');
      const exception = new Error('Sensitive database error');

      filter.catch(exception, mockHost);

      const calledWith = mockResponse.json.mock.calls[0][0];
      expect(calledWith.code).toBe(500);
      expect(calledWith.message).toBe('服务器内部错误，请稍后再试');
      expect(calledWith.error).toBeUndefined();
    });
  });
});
