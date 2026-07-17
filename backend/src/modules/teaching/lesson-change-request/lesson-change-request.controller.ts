import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotImplementedException } from '@nestjs/common';

@ApiTags('LessonChangeRequest')
@ApiBearerAuth()
@Controller()
export class LessonChangeRequestController {
  @Post('lessons/:id/change-requests')
  @ApiOperation({ summary: 'Submit a lesson change request' })
  createRequest(@Param('id') _id: string, @Body() _body: any) {
    throw new NotImplementedException();
  }

  @Get('lessons/:id/change-requests')
  @ApiOperation({ summary: 'List change requests for a lesson' })
  findByLesson(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Patch('change-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a change request (admin)' })
  approve(@Param('id') _id: string) {
    throw new NotImplementedException();
  }

  @Patch('change-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a change request (admin)' })
  reject(@Param('id') _id: string, @Body() _body: any) {
    throw new NotImplementedException();
  }
}
