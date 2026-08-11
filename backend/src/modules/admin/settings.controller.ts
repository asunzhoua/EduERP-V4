import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';
import { SettingsService } from './settings.service';

class SaveSettingsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingEntryDto)
  entries!: SettingEntryDto[];
}

class SettingEntryDto {
  @IsOptional()
  key!: string;
  @IsOptional()
  value!: string;
  @IsOptional()
  category!: string;
  @IsOptional()
  description?: string | null;
}

@ApiTags('Admin-Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(RolesGuard)
@Roles('SuperAdmin', 'Admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: '获取全部系统设置（按分类分组）' })
  async findAll() {
    const grouped = await this.settingsService.findAllGrouped();
    return ApiResponse.success(grouped);
  }

  @Post('save')
  @ApiOperation({ summary: '批量保存系统设置' })
  async save(@Body() dto: SaveSettingsDto, @Req() req: AuthedRequest) {
    const operatorId = Number(req.user.sub);
    const grouped = await this.settingsService.bulkSave(
      dto.entries || [],
      operatorId,
    );
    return ApiResponse.success(grouped, '设置已保存');
  }
}
