import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

// Mock AppLogger
jest.mock('@utils/logger', () => ({
  AppLogger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
  })),
}));

function createMockHost(method = 'GET', url = '/test') {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const req = { method, url };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    } as unknown as ArgumentsHost,
    res,
    req,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('should catch HttpException and return correct status + message (string body)', () => {
    const { host, res } = createMockHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: 404,
      message: 'Not Found',
      data: null,
    });
  });

  it('should catch HttpException with object body and extract message', () => {
    const { host, res } = createMockHost();
    const exception = new HttpException(
      { message: 'Validation failed', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: 400,
      message: 'Validation failed',
      data: null,
    });
  });

  it('should join array messages from HttpException', () => {
    const { host, res } = createMockHost();
    const exception = new HttpException(
      { message: ['name is required', 'email is required'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(res.json).toHaveBeenCalledWith({
      code: 400,
      message: 'name is required; email is required',
      data: null,
    });
  });

  it('should catch plain Error and return 500', () => {
    const { host, res } = createMockHost();
    const exception = new Error('something broke');

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      message: '服务器内部错误',
      data: null,
    });
  });

  it('should catch non-Error unknown value and return 500', () => {
    const { host, res } = createMockHost('POST', '/submit');

    filter.catch('string error', host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 500,
      message: '服务器内部错误',
      data: null,
    });
  });

  it('should return response structure with code, message, data', () => {
    const { host, res } = createMockHost('DELETE', '/items/42');
    const exception = new HttpException('Gone', HttpStatus.GONE);

    filter.catch(exception, host);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody).toHaveProperty('code');
    expect(responseBody).toHaveProperty('message');
    expect(responseBody).toHaveProperty('data');
    expect(responseBody.data).toBeNull();
  });
});
