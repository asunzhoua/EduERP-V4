import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({
    summary: '健康检查',
    description: '检查服务是否正常运行，无需认证',
  })
  @ApiResponse({
    status: 200,
    description: '服务健康',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-28T00:00:00.000Z',
        uptime: 3600,
        environment: 'production',
        version: '1.1.0',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.1.0',
    };
  }
}
