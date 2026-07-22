import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { ClassEntity } from '../class/class.entity';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from '../teacher-assignment/teacher-assignment.entity';

@ApiTags('Teacher Dashboard')
@ApiBearerAuth()
@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherDashboardController {
  constructor(
    @InjectRepository(TeacherAssignmentEntity)
    private teacherAssignmentRepository: Repository<TeacherAssignmentEntity>,
    @InjectRepository(ClassEntity)
    private classRepository: Repository<ClassEntity>,
    @InjectRepository(LessonEntity)
    private lessonRepository: Repository<LessonEntity>,
    @InjectRepository(LessonAttendanceEntity)
    private lessonAttendanceRepository: Repository<LessonAttendanceEntity>,
  ) {}

  @Get('dashboard')
  @Roles('SuperAdmin', 'Admin', 'Teacher')
  @ApiOperation({ summary: 'Get dashboard stats for teacher' })
  async getDashboard(@Req() req: any) {
    const userId = req.user.sub;
    
    // Get teacher's assigned class codes
    const assignments = await this.teacherAssignmentRepository.find({
      where: { teacherId: userId, status: 'ACTIVE' } as any,
    });
    const classCodes = assignments.map(a => a.classCode);

    let todayLessons = 0;
    let pendingAttendance = 0;
    let totalStudents = 0;

    if (classCodes.length > 0) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Count today's lessons
      todayLessons = await this.lessonRepository.count({
        where: { classCode: In(classCodes), scheduledDate: today } as any,
      });

      // Count today's lessons without attendance
      const todayLessonsData = await this.lessonRepository.find({
        where: { classCode: In(classCodes), scheduledDate: today } as any,
      });
      const todayLessonIds = todayLessonsData.map(l => l.id);
      
      if (todayLessonIds.length > 0) {
        // Count lessons that have at least one attendance record
        const lessonsWithAttendance = await this.lessonAttendanceRepository
          .createQueryBuilder('la')
          .select('la.lessonId')
          .where('la.lessonId IN (:...ids)', { ids: todayLessonIds })
          .distinct(true)
          .getRawMany();
        
        pendingAttendance = todayLessons - lessonsWithAttendance.length;
      }

      // Sum currentStudents from active classes
      const activeClasses = await this.classRepository.find({
        where: { classCode: In(classCodes), status: 'ACTIVE' } as any,
      });
      totalStudents = activeClasses.reduce((sum, cls) => sum + ((cls as any).currentStudents || 0), 0);
    }

    return ApiResponse.success({
      todayLessons,
      pendingAttendance,
      totalStudents,
    });
  }
}
