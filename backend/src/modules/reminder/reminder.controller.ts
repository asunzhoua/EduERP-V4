import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { QueryReminderDto } from './dto/query-reminder.dto';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';

@Controller('reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async create(@Body() dto: CreateReminderDto) {
    const reminder = await this.reminderService.createReminder(dto);
    return ApiResponse.success(reminder);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  async findMyReminders(@Req() req: any, @Query() query: QueryReminderDto) {
    const userId = req.user.sub;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const result = await this.reminderService.findByUserId(
      userId,
      query.status,
      page,
      pageSize,
    );
    return ApiResponse.success(result);
  }

  @Patch(':id/read')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.sub;
    const reminder = await this.reminderService.markAsRead(id, userId);
    return ApiResponse.success(reminder);
  }

  @Patch('read-all')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.sub;
    const result = await this.reminderService.markAllAsRead(userId);
    return ApiResponse.success(result);
  }

  @Get('unread-count')
  @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.sub;
    const count = await this.reminderService.getUnreadCount(userId);
    return ApiResponse.success({ count });
  }
}
