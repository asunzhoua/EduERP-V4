import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedRequest } from '../types/authed-request';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);
