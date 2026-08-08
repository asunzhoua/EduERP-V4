import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { PointsTransactionType } from './points-transaction.entity';

class RewardPointsDto {
  @IsString()
  @IsNotEmpty({ message: '学生学号不能为空' })
  studentCode!: string;

  @IsNumber()
  @Min(1, { message: '积分必须为正数' })
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('admin/points-rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class AdminPointsRewardController {
  constructor(private readonly pointsService: PointsService) {}

  @Post()
  async reward(@Body() dto: RewardPointsDto) {
    const account = await this.pointsService.credit(
      dto.studentCode,
      dto.amount,
      dto.description || '管理员奖励',
      { type: PointsTransactionType.ADJUST, id: 'ADMIN_REWARD' },
    );
    return ApiResponse.success(
      { balance: account.balance, totalEarned: account.totalEarned },
      '奖励成功',
    );
  }
}
