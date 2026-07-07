import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '@common/decorators/public.decorator';
import { ApiResponse } from '@common/dto/api-response';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ip = req.ip;
    const device = loginDto.device || req.headers['user-agent'];
    const result = await this.authService.login(
      loginDto.username,
      loginDto.password,
      device,
      ip,
    );
    return ApiResponse.success(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshDto: RefreshDto, @Req() req: any) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    const result = await this.authService.refresh(refreshDto.refreshToken, ip, device);
    return ApiResponse.success(result);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    await this.authService.logout(req.user.sub, ip, device);
    return ApiResponse.success(null, '退出成功');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    const user = await this.authService.getCurrentUser(req.user.sub);
    return ApiResponse.success(user);
  }
}
