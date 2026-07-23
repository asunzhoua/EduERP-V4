import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonChangeRequestService } from './lesson-change-request.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';

@ApiTags('LessonChangeRequest')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonChangeRequestController {
  constructor(private readonly service: LessonChangeRequestService) {}

  @Post('lessons/:id/change-requests')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Submit a lesson change request' })
  async createRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateChangeRequestDto,
    @Req() req: any,
  ) {
    const result = await this.service.createRequest({
      lessonId: id,
      requestType: body.requestType,
      requestedBy: req.user.sub,
      reason: body.reason,
      previousDate: body.previousDate,
      newDate: body.newDate,
      previousStartTime: body.previousStartTime,
      newStartTime: body.newStartTime,
      previousEndTime: body.previousEndTime,
      newEndTime: body.newEndTime,
      previousTeacherId: body.previousTeacherId,
      newTeacherId: body.newTeacherId,
    });
    return ApiResponse.success(result, 'Change request submitted');
  }

  @Get('lessons/:id/change-requests')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'List change requests for a lesson' })
  async findByLesson(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.findByLessonId(id);
    return ApiResponse.success(result);
  }

  @Patch('change-requests/:id/approve')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Approve a change request (admin)' })
  async approve(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.service.approve(id, req.user.sub);
    return ApiResponse.success(result, 'Change request approved');
  }

  @Patch('change-requests/:id/reject')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Reject a change request (admin)' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    const result = await this.service.reject(id, req.user.sub, body.reason);
    return ApiResponse.success(result, 'Change request rejected');
  }
}
