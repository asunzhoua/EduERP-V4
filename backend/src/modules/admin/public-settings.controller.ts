import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { SettingsService } from './settings.service';

@ApiTags('Public-Settings')
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('contact')
  @ApiOperation({ summary: '获取机构联系信息（公开）' })
  async getContact() {
    const [name, address, phone] = await Promise.all([
      this.settingsService.getValue('school.name'),
      this.settingsService.getValue('school.address'),
      this.settingsService.getValue('school.phone'),
    ]);
    return ApiResponse.success({
      name: name || '未设置',
      address: address || '',
      phone: phone || '',
    });
  }
}
