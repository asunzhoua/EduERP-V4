import { ApiResponse } from './api-response';

describe('ApiResponse', () => {
  describe('success()', () => {
    it('should return success response with default message', () => {
      const result = ApiResponse.success({ id: 1 });

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toEqual({ id: 1 });
    });

    it('should return success response with custom message', () => {
      const result = ApiResponse.success('ok', '操作成功');

      expect(result.code).toBe(0);
      expect(result.message).toBe('操作成功');
      expect(result.data).toBe('ok');
    });

    it('should return success response with null data when no argument', () => {
      const result = ApiResponse.success();

      expect(result.code).toBe(0);
      expect(result.message).toBe('success');
      expect(result.data).toBeNull();
    });

    it('should return success response with array data', () => {
      const items = [1, 2, 3];
      const result = ApiResponse.success(items);

      expect(result.data).toEqual(items);
    });

    it('should return success response with explicit undefined data as null', () => {
      const result = ApiResponse.success(undefined);

      expect(result.data).toBeNull();
    });
  });

  describe('error()', () => {
    it('should return error response with given code and message', () => {
      const result = ApiResponse.error(400, '参数错误');

      expect(result.code).toBe(400);
      expect(result.message).toBe('参数错误');
      expect(result.data).toBeNull();
    });

    it('should return error response with server error code', () => {
      const result = ApiResponse.error(500, '服务器内部错误');

      expect(result.code).toBe(500);
      expect(result.message).toBe('服务器内部错误');
      expect(result.data).toBeNull();
    });
  });

  describe('unauthorized()', () => {
    it('should return 401 with default message', () => {
      const result = ApiResponse.unauthorized();

      expect(result.code).toBe(401);
      expect(result.message).toBe('未授权');
      expect(result.data).toBeNull();
    });

    it('should return 401 with custom message', () => {
      const result = ApiResponse.unauthorized('token已过期');

      expect(result.code).toBe(401);
      expect(result.message).toBe('token已过期');
    });
  });

  describe('forbidden()', () => {
    it('should return 403 with default message', () => {
      const result = ApiResponse.forbidden();

      expect(result.code).toBe(403);
      expect(result.message).toBe('无权限');
      expect(result.data).toBeNull();
    });
  });

  describe('notFound()', () => {
    it('should return 404 with default message', () => {
      const result = ApiResponse.notFound();

      expect(result.code).toBe(404);
      expect(result.message).toBe('未找到');
      expect(result.data).toBeNull();
    });
  });

  describe('serverError()', () => {
    it('should return 500 with default message', () => {
      const result = ApiResponse.serverError();

      expect(result.code).toBe(500);
      expect(result.message).toBe('服务器内部错误');
      expect(result.data).toBeNull();
    });
  });

  describe('constructor', () => {
    it('should create instance with all parameters', () => {
      const res = new ApiResponse(200, 'ok', 'payload');

      expect(res.code).toBe(200);
      expect(res.message).toBe('ok');
      expect(res.data).toBe('payload');
    });

    it('should default data to null', () => {
      const res = new ApiResponse(200, 'ok');

      expect(res.data).toBeNull();
    });
  });
});
