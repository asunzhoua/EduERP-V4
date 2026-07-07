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
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './services/student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  async create(@Body() dto: CreateStudentDto, @Req() req: any) {
    const operatorId = req.user.sub;
    const student = await this.studentService.create(dto, operatorId);
    return ApiResponse.success(student);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async findAll(@Query() query: QueryStudentDto) {
    const result = await this.studentService.findAll(query);
    return ApiResponse.success(result);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const student = await this.studentService.findById(id);
    return ApiResponse.success(student);
  }

  @Put(':id')
  @Roles('SuperAdmin', 'Admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const student = await this.studentService.update(id, dto, operatorId);
    return ApiResponse.success(student);
  }

  @Patch(':id/status')
  @Roles('SuperAdmin', 'Admin')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentStatusDto,
    @Req() req: any,
  ) {
    const operatorId = req.user.sub;
    const student = await this.studentService.updateStatus(id, dto, operatorId);
    return ApiResponse.success(student);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const operatorId = req.user.sub;
    await this.studentService.softDelete(id, operatorId);
    return ApiResponse.success(null, '学生已删除');
  }

  // --- Parent-Student relations ---

  @Post(':id/parents')
  @Roles('SuperAdmin', 'Admin')
  async linkParent(
    @Param('id', ParseIntPipe) studentId: number,
    @Body('parentId', ParseIntPipe) parentId: number,
    @Body('relation') relation?: string,
    @Body('isPrimary') isPrimary?: boolean,
  ) {
    const link = await this.studentService.linkParent(studentId, parentId, relation, isPrimary);
    return ApiResponse.success(link);
  }

  @Delete(':id/parents/:parentId')
  @Roles('SuperAdmin', 'Admin')
  async unlinkParent(
    @Param('id', ParseIntPipe) studentId: number,
    @Param('parentId', ParseIntPipe) parentId: number,
  ) {
    await this.studentService.unlinkParent(studentId, parentId);
    return ApiResponse.success(null, '家长关联已解除');
  }

  @Get(':id/parents')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getParents(@Param('id', ParseIntPipe) studentId: number) {
    const parents = await this.studentService.getParents(studentId);
    return ApiResponse.success(parents);
  }

  @Get('parents/:parentId/students')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async getStudentsByParent(@Param('parentId', ParseIntPipe) parentId: number) {
    const students = await this.studentService.getStudentsByParent(parentId);
    return ApiResponse.success(students);
  }

  // --- Import ---

  @Post('import')
  @Roles('SuperAdmin', 'Admin')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async import(
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      return ApiResponse.error(400, '请上传文件');
    }

    const operatorId = req.user.sub;
    const report = await this.studentService.importStudents(
      file.buffer,
      file.originalname,
      operatorId,
    );
    return ApiResponse.success(report);
  }
}
