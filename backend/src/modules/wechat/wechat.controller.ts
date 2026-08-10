import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { RecordSubscriptionDto } from './dto/record-subscription.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { ApiResponse } from '@common/dto/api-response';
import { AuthedRequest } from '@common/types/authed-request';

@Controller('wechat/subscribe')
export class WechatController {
  constructor(private readonly subscribeService: WechatSubscribeService) {}

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  getTemplates() {
    return ApiResponse.success({
      templates: this.subscribeService.getTemplates(),
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async recordSubscription(
    @Body() dto: RecordSubscriptionDto,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.subscribeService.recordSubscription(
      req.user.sub,
      dto.subscriptions,
    );
    return ApiResponse.success(result, `已记录 ${result.recorded} 条订阅授权`);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMySubscriptions(@Req() req: AuthedRequest) {
    const subscriptions = await this.subscribeService.getMySubscriptions(
      req.user.sub,
    );
    return ApiResponse.success({ subscriptions });
  }
}
