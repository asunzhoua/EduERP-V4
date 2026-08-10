import { Request } from 'express';

/** JwtAuthGuard 注入的认证请求对象（各控制器统一使用，替代 req: any）。 */
export interface AuthedRequest extends Request {
  user: { sub: number; role: string; name?: string };
}
