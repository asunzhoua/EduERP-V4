import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as https from 'https';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../entities/user.entity';
import { LoginLog } from '../entities/login-log.entity';
import { UserRepository } from '../user.repository';
import { AppLogger } from '@utils/logger';
import { appConfig } from '@config/configuration';

@Injectable()
export class AuthService {
  private logger = new AppLogger();
  private readonly config = appConfig();

  constructor(
    private userRepository: UserRepository,
    @InjectRepository(LoginLog)
    private loginLogRepository: Repository<LoginLog>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findByUsernameWithPassword(username);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('用户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    return user;
  }

  async login(
    username: string,
    password: string,
    device?: string,
    ip?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: Partial<User> }> {
    const user = await this.validateUser(username, password);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '2h',
    });

    const refreshToken = uuidv4();
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7);

    await this.userRepository.update(user.id, {
      refreshToken,
      refreshTokenExpiresAt,
      lastLoginAt: new Date(),
    } as Partial<User>);

    await this.createLoginLog(user.id, user.username, user.role, 'LOGIN', true, ip, device);

    const { password: _, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safeUser } = user;
    return { accessToken, refreshToken, expiresIn: 7200, user: safeUser };
  }

  async refresh(
    refreshToken: string,
    ip?: string,
    device?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const user = await this.userRepository.findByRefreshToken(refreshToken);

    if (!user) {
      throw new UnauthorizedException('Refresh Token 无效');
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token 已过期，请重新登录');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: '2h',
    });

    const newRefreshToken = uuidv4();
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7);

    await this.userRepository.update(user.id, {
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt,
    } as Partial<User>);

    await this.createLoginLog(user.id, user.username, user.role, 'REFRESH', true, ip, device);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 7200 };
  }

  async logout(userId: number, ip?: string, device?: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (user) {
      await this.userRepository.update(userId, {
        refreshToken: null as any,
        refreshTokenExpiresAt: null as any,
      } as Partial<User>);
      await this.createLoginLog(user.id, user.username, user.role, 'LOGOUT', true, ip, device);
    }
  }

  async revokeUserSessions(
    operatorUserId: number,
    targetUserId: number,
  ): Promise<void> {
    if (operatorUserId === targetUserId) {
      throw new BadRequestException('不能撤销自己的会话');
    }

    const operator = await this.userRepository.findById(operatorUserId);
    if (!operator) {
      throw new UnauthorizedException('操作者不存在');
    }

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new NotFoundException('用户不存在');
    }

    // Role hierarchy: only SuperAdmin may revoke SuperAdmin or Admin.
    if (
      operator.role !== UserRole.SUPER_ADMIN &&
      (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.ADMIN)
    ) {
      throw new ForbiddenException('无权撤销该用户的会话');
    }

    await this.userRepository.update(targetUserId, {
      refreshToken: null as any,
      refreshTokenExpiresAt: null as any,
    } as Partial<User>);

    await this.createLoginLog(
      operator.id,
      operator.username,
      operator.role,
      'ADMIN_REVOKE',
      true,
    );
    this.logger.log(
      `Admin session revoke: operator=${operatorUserId}, target=${targetUserId}`,
    );
  }

  async getCurrentUser(userId: number): Promise<Partial<User>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const { password, refreshToken, refreshTokenExpiresAt, ...safeUser } = user;
    return safeUser;
  }

  async wechatLogin(
    code: string,
    ip?: string,
    device?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: Partial<User> }> {
    // 1. 调用微信 jscode2session 获取 openid
    const session = await this.getWxSession(code);
    const { openid } = session;

    if (!openid) {
      throw new InternalServerErrorException('微信登录失败：未获取到 openid');
    }

    // 2. 查找用户（通过 openid 关联）
    let user = await this.userRepository.findByOpenid(openid);

    if (!user) {
      throw new UnauthorizedException('微信用户未绑定系统账号，请联系管理员');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 3. 更新 unionid（如果返回了且用户没有）
    const unionid = (session as any).unionid;
    if (unionid && !user.unionid) {
      await this.userRepository.update(user.id, { unionid } as Partial<User>);
    }

    // 4. 生成 JWT
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '2h',
    });

    const refreshToken = uuidv4();
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7);

    await this.userRepository.update(user.id, {
      refreshToken,
      refreshTokenExpiresAt,
      lastLoginAt: new Date(),
    } as Partial<User>);

    await this.createLoginLog(user.id, user.username, user.role, 'WECHAT_LOGIN', true, ip, device);

    const { password: _, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safeUser } = user;
    return { accessToken, refreshToken, expiresIn: 7200, user: safeUser };
  }

  /**
   * 调用微信 jscode2session 接口换取 openid / session_key
   * POST https://api.weixin.qq.com/sns/jscode2session
   *    ?appid=APPID&secret=SECRET&js_code=CODE&grant_type=authorization_code
   */
  private getWxSession(code: string): Promise<{ openid: string; session_key: string; unionid?: string }> {
    const config = this.config.wechat;

    if (!config.appid || !config.secret) {
      throw new InternalServerErrorException('微信登录未配置：请设置 WECHAT_APPID 和 WECHAT_SECRET');
    }

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', config.appid);
    url.searchParams.set('secret', config.secret);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    return new Promise((resolve, reject) => {
      https.get(url.toString(), (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            // 微信返回错误
            if (result.errcode) {
              this.logger.error(`[WeChatLogin] jscode2session failed: ${result.errmsg} (code=${result.errcode})`);
              reject(new InternalServerErrorException('微信服务器验证失败'));
              return;
            }

            resolve({
              openid: result.openid,
              session_key: result.session_key,
              unionid: result.unionid,
            });
          } catch (e) {
            reject(new InternalServerErrorException('微信登录响应解析失败'));
          }
        });
      }).on('error', (err) => {
        this.logger.error(`[WeChatLogin] HTTP request failed: ${err.message}`);
        reject(new InternalServerErrorException('微信登录网络请求失败'));
      });
    });
  }

  private async createLoginLog(
    userId: number,
    username: string,
    role: string,
    action: string,
    success: boolean,
    ip?: string,
    device?: string,
  ): Promise<void> {
    try {
      const log = this.loginLogRepository.create({
        userId,
        username,
        role,
        action,
        success,
        ip: ip || '',
        device: device || '',
      });
      await this.loginLogRepository.save(log);
    } catch (error) {
      this.logger.error(`Failed to create login log: ${error.message}`);
    }
  }
}
