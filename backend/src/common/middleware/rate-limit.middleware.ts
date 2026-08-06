import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter: 5 requests per minute per IP
 */
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 5, // 5 次
  message: {
    statusCode: 429,
    message: 'Too many login attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * NestJS middleware wrapper for login rate limiting
 */
@Injectable()
export class LoginRateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    return loginRateLimit(req, res, next);
  }
}
