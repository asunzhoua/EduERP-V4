import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LessonChangeRequestService } from './lesson-change-request.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';

@ApiTags('LessonChangeRequest')
@ApiBearerAuth()
@Controller()
export class LessonChangeRequestController {
  constructor(private readonly service: LessonChangeRequestService) {}

  @Post('lessons/:id/change-requests')
  @ApiOperation({ summary: 'Submit a lesson change request' })
  createRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateChangeRequestDto,
    @Req() req: any,
  ) {
    return this.service.createRequest({
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
  }

  @Get('lessons/:id/change-requests')
  @ApiOperation({ summary: 'List change requests for a lesson' })
  findByLesson(@Param('id', ParseIntPipe) id: number) {
    return this.service.findByLessonId(id);
  }

  @Patch('change-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a change request (admin)' })
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.approve(id, req.user.sub);
  }

  @Patch('change-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a change request (admin)' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.service.reject(id, req.user.sub, body.reason);
  }
}
