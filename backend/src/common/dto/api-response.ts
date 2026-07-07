export class ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;

  constructor(code: number, message: string, data: T | null = null) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  static success<T>(data?: T, message: string = 'success'): ApiResponse<T> {
    return new ApiResponse<T>(0, message, data ?? null);
  }

  static error(code: number, message: string): ApiResponse<null> {
    return new ApiResponse<null>(code, message, null);
  }

  static unauthorized(message: string = '未授权'): ApiResponse<null> {
    return new ApiResponse<null>(401, message, null);
  }

  static forbidden(message: string = '无权限'): ApiResponse<null> {
    return new ApiResponse<null>(403, message, null);
  }

  static notFound(message: string = '未找到'): ApiResponse<null> {
    return new ApiResponse<null>(404, message, null);
  }

  static serverError(message: string = '服务器内部错误'): ApiResponse<null> {
    return new ApiResponse<null>(500, message, null);
  }
}
