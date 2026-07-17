import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../entities/user.entity';
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
  ): Promise<{ accessToken: string; refreshToken: string; user: Partial<User> }> {
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
    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(
    refreshToken: string,
    ip?: string,
    device?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
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

  async getCurrentUser(userId: number): Promise<Partial<User>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const { password, refreshToken, refreshTokenExpiresAt, ...safeUser } = user;
    return safeUser;
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
