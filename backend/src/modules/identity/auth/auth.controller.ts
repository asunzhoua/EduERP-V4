import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, WechatLoginDto, BindWechatDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { RegisterDto } from '../dto/register.dto';
import {
  CreateParentDto,
  QueryParentsDto,
  UpdateParentStatusDto,
} from '../dto/create-parent.dto';
import {
  ChangePasswordDto,
  ResetPasswordDto,
} from '../dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '@common/decorators/public.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: AuthedRequest) {
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
  @Post('wechat-login')
  @HttpCode(HttpStatus.OK)
  async wechatLogin(@Body() wechatLoginDto: WechatLoginDto, @Req() req: AuthedRequest) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    const result = await this.authService.wechatLogin(
      wechatLoginDto.code,
      ip,
      device,
    );
    return ApiResponse.success(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshDto: RefreshDto, @Req() req: AuthedRequest) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    const result = await this.authService.refresh(
      refreshDto.refreshToken,
      ip,
      device,
    );
    return ApiResponse.success(result);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return ApiResponse.success(result, '注册成功');
  }

  @Post('admin/parents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  async adminCreateParent(
    @Body() createParentDto: CreateParentDto,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.authService.adminCreateParent(
      createParentDto,
      req.user.sub,
    );
    return ApiResponse.success(result, '家长开户成功');
  }

  @Get('admin/parents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  async listParents(@Query() query: QueryParentsDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const result = await this.authService.listParents(
      page,
      pageSize,
      query.keyword,
      query.status !== undefined ? Number(query.status) : undefined,
    );
    return ApiResponse.success(result);
  }

  @Patch('admin/parents/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  async updateParentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParentStatusDto,
  ) {
    const user = await this.authService.updateParentStatus(
      id,
      Number(dto.status),
    );
    return ApiResponse.success(user, '状态已更新');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthedRequest) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    await this.authService.logout(req.user.sub, ip, device);
    return ApiResponse.success(null, '退出成功');
  }

  @Post('admin/users/:id/revoke-session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    await this.authService.revokeUserSessions(req.user.sub, id);
    return ApiResponse.success(null, '已撤销该用户的会话');
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: AuthedRequest,
  ) {
    const ip = req.ip;
    const device = req.headers['user-agent'];
    await this.authService.changePassword(
      req.user.sub,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
      ip,
      device,
    );
    return ApiResponse.success(null, '密码修改成功，请重新登录');
  }

  @Post('wechat/bind')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bindWechat(@Body() bindWechatDto: BindWechatDto, @Req() req: AuthedRequest) {
    const result = await this.authService.bindWechat(
      req.user.sub,
      bindWechatDto.code,
    );
    return ApiResponse.success(result, '微信绑定成功');
  }

  @Post('admin/users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: AuthedRequest,
  ) {
    await this.authService.adminResetPassword(
      req.user.sub,
      resetPasswordDto.operatorPassword,
      id,
      resetPasswordDto.newPassword,
      { operatorIp: req.ip, reason: resetPasswordDto.reason },
    );
    return ApiResponse.success(null, '密码重置成功');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: AuthedRequest) {
    const user = await this.authService.getCurrentUser(req.user.sub);
    return ApiResponse.success(user);
  }
}
