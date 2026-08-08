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
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentService } from './services/student.service';
import { ContractRepository } from '../teaching/contract/contract.repository';
import { LessonAttendanceRepository } from '../teaching/lesson-attendance/lesson-attendance.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { TeacherAssignmentEntity } from '../teaching/teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '../teaching/class/class.entity';
import { CourseEntity } from '../teaching/course/course.entity';
import { User } from '../identity/entities/user.entity';
import { TeacherRole } from '@common/enums/teacher-role.enum';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { CreateParentLeaveRequestDto } from './dto/create-parent-leave-request.dto';
import { PointsService } from '../points/points.service';
import { FeedbackService } from '../feedback/feedback.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private studentService: StudentService,
    private contractRepository: ContractRepository,
    private lessonAttendanceRepository: LessonAttendanceRepository,
    @InjectRepository(LessonEntity)
    private lessonRepository: Repository<LessonEntity>,
    @InjectRepository(EnrollmentEntity)
    private enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(TeacherAssignmentEntity)
    private teacherAssignmentRepository: Repository<TeacherAssignmentEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ClassEntity)
    private classRepository: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private courseRepository: Repository<CourseEntity>,
    private pointsService: PointsService,
    private feedbackService: FeedbackService,
  ) {}

  @Post()
  @Roles('SuperAdmin', 'Admin')
  async create(@Body() dto: CreateStudentDto, @Req() req: any) {
    const operatorId = req.user.sub;
    const student = await this.studentService.create(dto, operatorId);
    return ApiResponse.success(student);
  }

  // --- Self-service endpoints (student/parent facing) ---

  @Get('self')
  @Roles('Student', 'Parent')
  async getSelf(@Req() req: any) {
    const userId = req.user.sub;
    const student = await this.studentService.findByUserId(userId);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }
    return ApiResponse.success({
      studentCode: student.studentCode,
      name: student.name,
      gender: student.gender,
      phone: student.phone,
    });
  }

  @Get('self/contracts')
  @Roles('Student', 'Parent')
  async getSelfContracts(@Req() req: any) {
    const userId = req.user.sub;
    const student = await this.studentService.findByUserId(userId);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }
    const contracts = await this.contractRepository.findByStudentCode(student.studentCode);

    if (contracts.length === 0) {
      return ApiResponse.success([]);
    }

    // ── Step 1: Get classCode via enrollment (contractCode → enrollment → classCode) ──
    const contractCodes = contracts.map((c) => c.contractCode);
    const enrollments = await this.enrollmentRepository.find({
      where: { contractCode: In(contractCodes) },
    });
    const enrollmentMap = new Map(enrollments.map((e) => [e.contractCode, e]));

    // ── Step 2: Get teacher assignments for all classes ──
    const classCodes = [...new Set(enrollments.map((e) => e.classCode))];
    let teacherAssignmentMap = new Map<string, TeacherAssignmentEntity>();
    let teacherMap = new Map<number, string>();

    if (classCodes.length > 0) {
      const teacherAssignments = await this.teacherAssignmentRepository.find({
        where: { classCode: In(classCodes), effectiveTo: IsNull() },
      });

      // Prefer PRIMARY teacher, fallback to any active assignment
      for (const ta of teacherAssignments) {
        const existing = teacherAssignmentMap.get(ta.classCode);
        if (!existing) {
          teacherAssignmentMap.set(ta.classCode, ta);
        } else if (ta.role === TeacherRole.PRIMARY && existing.role !== TeacherRole.PRIMARY) {
          teacherAssignmentMap.set(ta.classCode, ta);
        }
      }

      // ── Step 3: Get teacher names from User table ──
      const teacherIds = [...new Set(teacherAssignments.map((ta) => ta.teacherId))];
      if (teacherIds.length > 0) {
        const teachers = await this.userRepository.find({
          where: { id: In(teacherIds) },
        });
        teacherMap = new Map(teachers.map((t) => [t.id, t.name]));
      }
    }

    // ── Step 4: Assemble response ──
    return ApiResponse.success(
      contracts.map((c) => {
        const enrollment = enrollmentMap.get(c.contractCode);
        const classCode = enrollment?.classCode || null;
        const ta = classCode ? teacherAssignmentMap.get(classCode) : undefined;
        const teacherName = ta ? teacherMap.get(ta.teacherId) || null : null;

        return {
          contractCode: c.contractCode,
          classCode,
          teacherName,
          subject: c.subject,
          totalLessons: c.totalLessons,
          remainingLessons: c.remainingLessons,
          status: c.status,
          validFrom: c.validFrom,
          validTo: c.validTo,
        };
      }),
    );
  }

  @Get('self/lessons')
  @Roles('Student', 'Parent')
  async getSelfLessons(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = req.user.sub;
    const student = await this.studentService.findByUserId(userId);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }

    const attendanceRecords =
      await this.lessonAttendanceRepository.findByStudentCode(student.studentCode);

    // Fetch lesson details
    const lessonIds = [...new Set(attendanceRecords.map((r) => r.lessonId))];
    const lessons =
      lessonIds.length > 0
        ? await this.lessonRepository.find({ where: { id: In(lessonIds) } })
        : [];
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    // Get class names
    const classCodes = [...new Set(lessons.map((l) => l.classCode))];
    const classes =
      classCodes.length > 0
        ? await this.classRepository.find({ where: { classCode: In(classCodes) } })
        : [];
    const classMap = new Map(classes.map((c) => [c.classCode, c.name]));

    // Get course names
    const courseCodes = [...new Set(lessons.map((l) => l.courseCode))];
    const courses =
      courseCodes.length > 0
        ? await this.courseRepository.find({ where: { courseCode: In(courseCodes) } })
        : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c.name]));

    // 历史课时日期查询：lesson.scheduledDate 为 'YYYY-MM-DD' 字符串，
    // 直接按字典序比较即可。from/to 可选，缺省返回全部。
    // 去掉原 20 条上限，保证按日期区间能查到完整历史。
    const result = attendanceRecords
      .map((a) => {
        const lesson = lessonMap.get(a.lessonId);
        return {
          lessonId: a.lessonId,
          lessonDate: lesson?.scheduledDate || null,
          startTime: lesson?.startTime || null,
          endTime: lesson?.endTime || null,
          status: a.status,
          lessonStatus: lesson?.status || null,
          className: lesson ? classMap.get(lesson.classCode) || null : null,
          courseName: lesson ? courseMap.get(lesson.courseCode) || null : null,
        };
      })
      .filter((r) => {
        if (!r.lessonDate) return true; // 无日期记录保留，避免数据丢失
        if (from && r.lessonDate < from) return false;
        if (to && r.lessonDate > to) return false;
        return true;
      });

    // 按日期倒序（历史课时：最近在前），同日期按开始时间倒序
    result.sort((a, b) => {
      const ad = a.lessonDate || '';
      const bd = b.lessonDate || '';
      if (ad !== bd) return bd.localeCompare(ad);
      const as = a.startTime || '';
      const bs = b.startTime || '';
      return bs.localeCompare(as);
    });

    return ApiResponse.success(result);
  }

  @Get('self/attendance')
  @Roles('Student', 'Parent')
  async getSelfAttendance(@Req() req: any) {
    const userId = req.user.sub;
    const student = await this.studentService.findByUserId(userId);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }

    // 1. Get all attendance records for this student
    const attendances = await this.lessonAttendanceRepository.findByStudentCode(student.studentCode);
    if (attendances.length === 0) {
      return ApiResponse.success([]);
    }

    // 2. Get all related lessons
    const lessonIds = attendances.map(a => a.lessonId);
    const lessons = await this.lessonRepository.find({
      where: { id: In(lessonIds) },
    });
    const lessonMap = new Map(lessons.map(l => [l.id, l]));

    // 3. Get class names
    const classCodes = [...new Set(lessons.map(l => l.classCode))];
    const classes = await this.classRepository.find({
      where: { classCode: In(classCodes) },
    });
    const classMap = new Map(classes.map(c => [c.classCode, c.name]));

    // 4. Get course names
    const courseCodes = [...new Set(lessons.map(l => l.courseCode))];
    const courses = await this.courseRepository.find({
      where: { courseCode: In(courseCodes) },
    });
    const courseMap = new Map(courses.map(c => [c.courseCode, c.name]));

    // 5. Assemble response
    const result = attendances.map(a => {
      const lesson = lessonMap.get(a.lessonId);
      return {
        id: a.id,
        lessonDate: lesson?.scheduledDate || null,
        startTime: lesson?.startTime || null,
        endTime: lesson?.endTime || null,
        courseName: lesson ? (courseMap.get(lesson.courseCode) || null) : null,
        className: lesson ? (classMap.get(lesson.classCode) || null) : null,
        status: a.status || 'PENDING',
        deductionSkippedReason: a.deductionSkippedReason || null,
      };
    });

    // Sort by date descending
    result.sort((a, b) => {
      if (!a.lessonDate) return 1;
      if (!b.lessonDate) return -1;
      return b.lessonDate.localeCompare(a.lessonDate);
    });

    return ApiResponse.success(result);
  }

  // --- Parent/Student Points & Feedback (积分/课程反馈) ---

  @Get('self/points')
  @Roles('Student', 'Parent')
  async getSelfPoints(@Req() req: any) {
    const student = await this.studentService.findByUserId(req.user.sub);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }
    const data = await this.pointsService.getSummary(student.studentCode);
    return ApiResponse.success(data);
  }

  @Get('self/points-mall/products')
  @Roles('Student', 'Parent')
  async getSelfPointsMallProducts() {
    const products = await this.pointsService.listOnSaleProducts();
    return ApiResponse.success(products);
  }

  @Post('self/points-mall/exchange')
  @Roles('Student', 'Parent')
  async exchangePoints(@Req() req: any, @Body() body: { productId?: number; quantity?: number }) {
    const student = await this.studentService.findByUserId(req.user.sub);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }
    if (!body || !body.productId) {
      return ApiResponse.error(400, '请选择要兑换的商品');
    }
    const record = await this.pointsService.exchange(
      student.studentCode,
      student.name,
      Number(body.productId),
      Number(body.quantity) || 1,
      Number(req.user.sub),
    );
    return ApiResponse.success(record, '兑换成功');
  }

  @Get('self/feedback')
  @Roles('Student', 'Parent')
  async getSelfFeedback(@Req() req: any) {
    const student = await this.studentService.findByUserId(req.user.sub);
    if (!student) {
      return ApiResponse.error(404, '未找到关联的学生信息');
    }
    const list = await this.feedbackService.findByStudentCode(student.studentCode);
    return ApiResponse.success(list);
  }

  // --- Parent Child-Scoped API (GAP-001) ---

  @Get(':childId/courses')
  @Roles('Parent')
  async getChildCourses(
    @Param('childId', ParseIntPipe) childId: number,
    @CurrentUser() parent: any,
  ) {
    const result = await this.studentService.getChildCourses(parent.sub, childId);
    return ApiResponse.success(result);
  }

  @Get(':childId/attendance')
  @Roles('Parent')
  async getChildAttendance(
    @Param('childId', ParseIntPipe) childId: number,
    @CurrentUser() parent: any,
  ) {
    const result = await this.studentService.getChildAttendance(parent.sub, childId);
    return ApiResponse.success(result);
  }

  @Get(':childId/contracts')
  @Roles('Parent')
  async getChildContracts(
    @Param('childId', ParseIntPipe) childId: number,
    @CurrentUser() parent: any,
  ) {
    const result = await this.studentService.getChildContracts(parent.sub, childId);
    return ApiResponse.success(result);
  }

  // --- Parent Leave Request (GAP-002) ---

  @Post('leave-requests')
  @Roles('Parent')
  async createLeaveRequest(
    @CurrentUser() parent: any,
    @Body() dto: CreateParentLeaveRequestDto,
  ) {
    const result = await this.studentService.createLeaveRequest(parent.sub, dto);
    return ApiResponse.success(result, 'Leave request submitted');
  }

  @Get('my-children')
  @Roles('Parent')
  async getMyChildren(@Req() req: any) {
    const userId = req.user.sub;
    const students = await this.studentService.getChildrenByUserId(userId);
    return ApiResponse.success(students);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  async findAll(@Query() query: QueryStudentDto, @Req() req: any) {
    // Teacher 只能看到自己负责的班级里的学生
    const teacherId = req.user.role === 'Teacher' ? Number(req.user.sub) : undefined;
    const result = await this.studentService.findAll(query, teacherId);
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
