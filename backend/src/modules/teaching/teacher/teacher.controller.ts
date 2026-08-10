import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TeacherService } from './teacher.service';
import { DataScopeService } from '@common/services/data-scope.service';

@ApiTags('Teacher')
@ApiBearerAuth()
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Teacher')
export class TeacherController {
  constructor(
    private readonly teacherService: TeacherService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get('me/courses')
  @ApiOperation({
    summary: '获取我的课程列表',
    description: '获取当前教师负责的所有课程，仅 Teacher 角色可访问',
  })
  @ApiResponse({
    status: 200,
    description: '成功返回课程列表',
    schema: {
      example: {
        items: [
          {
            id: 1,
            courseCode: 'CS2026070001',
            courseName: '数学基础',
            subject: '数学',
            grade: '三年级',
          },
        ],
        total: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足，仅 Teacher 角色可访问' })
  async getMyCourses(@CurrentUser() user: any) {
    const courseCodes = await this.dataScopeService.getTeacherCourseCodes(
      user.sub,
    );
    return this.teacherService.getCoursesByCodes(courseCodes);
  }

  @Get('me/classes')
  @ApiOperation({
    summary: '获取我的班级列表',
    description: '获取当前教师负责的所有班级，仅 Teacher 角色可访问',
  })
  @ApiResponse({
    status: 200,
    description: '成功返回班级列表',
    schema: {
      example: {
        items: [
          {
            id: 1,
            classCode: 'CL2026070001',
            className: '三年级1班',
            courseId: 1,
          },
        ],
        total: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足，仅 Teacher 角色可访问' })
  async getMyClasses(@CurrentUser() user: any) {
    const classCodes = await this.dataScopeService.getTeacherClassCodes(
      user.sub,
    );
    return this.teacherService.getClassesByCodes(classCodes);
  }

  @Get('me/students')
  @ApiOperation({
    summary: '获取我的学生列表',
    description: '获取当前教师负责的所有班级中的学生，仅 Teacher 角色可访问',
  })
  @ApiResponse({
    status: 200,
    description: '成功返回学生列表',
    schema: {
      example: {
        items: [
          {
            id: 1,
            studentCode: 'STU001',
            name: '李小华',
            gender: 'MALE',
          },
        ],
        total: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '权限不足，仅 Teacher 角色可访问' })
  async getMyStudents(@CurrentUser() user: any) {
    const studentCodes = await this.dataScopeService.getTeacherStudentCodes(
      user.sub,
    );
    return this.teacherService.getStudentsByCodes(studentCodes);
  }
}
