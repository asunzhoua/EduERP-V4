import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateCourseStatusDto } from './dto/update-course-status.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { CourseStatus } from './enums/course-status.enum';
import { ApiResponse } from '@common/dto/api-response';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { AuthedRequest } from '@common/types/authed-request';

@ApiTags('Course')
@ApiBearerAuth()
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Create a new course' })
  @SwaggerResponse({ status: 0, description: 'Course created successfully' })
  async create(
    @Body() dto: CreateCourseDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const course = await this.courseService.create(dto, operatorId);
    return ApiResponse.success(course, 'Course created');
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({
    summary: 'List all courses (paginated, filterable, enriched)',
  })
  async findAll(
    @Query() query: QueryCourseDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    // M-01 修复: Teacher 只能看到自己负责的课程
    const teacherId =
      req.user.role === 'Teacher' ? Number(req.user.sub) : undefined;
    const result = await this.courseService.findAll(query, teacherId);
    const enrichedItems = await this.courseService.enrichCourses(result.items);
    return ApiResponse.success({ items: enrichedItems, total: result.total });
  }

  @Get(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get course by courseCode (enriched)' })
  async findOne(@Param('code') code: string): Promise<ApiResponse> {
    const course = await this.courseService.findByCode(code);
    const enriched: unknown = await this.courseService.enrichCourse(course);
    return ApiResponse.success(enriched);
  }

  @Put(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Update course (field-level audit)' })
  async update(
    @Param('code') code: string,
    @Body() dto: UpdateCourseDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    await this.assertManagePermission(code, req);
    const operatorId = req.user.sub;
    const course = await this.courseService.update(code, dto, operatorId);
    return ApiResponse.success(course, 'Course updated');
  }

  @Patch(':code/status')
  @Roles('SuperAdmin', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change course status' })
  async updateStatus(
    @Param('code') code: string,
    @Body() dto: UpdateCourseStatusDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    const operatorId = req.user.sub;
    const course = await this.courseService.updateStatus(
      code,
      dto.status,
      operatorId,
    );
    return ApiResponse.success(course, 'Status updated');
  }

  @Delete(':code')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete course (DRAFT only)' })
  async remove(
    @Param('code') code: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse> {
    await this.assertManagePermission(code, req);
    const operatorId = req.user.sub;
    await this.courseService.remove(code, operatorId);
    return ApiResponse.success(null, 'Course deleted');
  }

  // ─── Ownership Guard (Teacher) ───

  /** Teacher 仅能管理自己创建的 DRAFT 课程；Admin/SuperAdmin 不受限。 */
  private async assertManagePermission(
    code: string,
    req: AuthedRequest,
  ): Promise<void> {
    if (req.user.role !== 'Teacher') return;
    const course = await this.courseService.findByCode(code);
    if (Number(course.createdBy) !== Number(req.user.sub)) {
      throw new ForbiddenException('You can only manage your own courses');
    }
    if (course.status !== CourseStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT courses can be edited');
    }
  }
}
