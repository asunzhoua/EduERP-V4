import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LoginLog } from '@modules/identity/entities/login-log.entity';
import { Student } from '@modules/student/entities/student.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from '@modules/teaching/teacher-assignment/teacher-assignment.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { AttendanceStatus } from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

interface MetricItem {
  name: string;
  value: number;
  unit: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(LoginLog)
    private loginLogRepository: Repository<LoginLog>,
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(EnrollmentEntity)
    private enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(LessonEntity)
    private lessonRepository: Repository<LessonEntity>,
    @InjectRepository(LessonAttendanceEntity)
    private lessonAttendanceRepository: Repository<LessonAttendanceEntity>,
    @InjectRepository(TeacherAssignmentEntity)
    private teacherAssignmentRepository: Repository<TeacherAssignmentEntity>,
    @InjectRepository(CourseEntity)
    private courseRepository: Repository<CourseEntity>,
    @InjectRepository(ClassEntity)
    private classRepository: Repository<ClassEntity>,
  ) {}

  /**
   * Student metrics: DAU/WAU/MAU (global) + per-student attendance & progress
   */
  async getStudentMetrics(studentCode: string): Promise<{ metrics: MetricItem[] }> {
    const metrics: MetricItem[] = [];

    // --- DAU / WAU / MAU (global active student counts) ---
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // DAU: distinct userIds that logged in today
    const dauResult = await this.loginLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userId)', 'count')
      .where('log.action = :action', { action: 'LOGIN' })
      .andWhere('log.success = :success', { success: true })
      .andWhere('log.createTime >= :since', { since: todayStart })
      .getRawOne();
    const dau = parseInt(dauResult?.count || '0', 10);

    // WAU: distinct userIds that logged in last 7 days
    const wauResult = await this.loginLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userId)', 'count')
      .where('log.action = :action', { action: 'LOGIN' })
      .andWhere('log.success = :success', { success: true })
      .andWhere('log.createTime >= :since', { since: weekAgoStart })
      .getRawOne();
    const wau = parseInt(wauResult?.count || '0', 10);

    // MAU: distinct userIds that logged in last 30 days
    const mauResult = await this.loginLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.userId)', 'count')
      .where('log.action = :action', { action: 'LOGIN' })
      .andWhere('log.success = :success', { success: true })
      .andWhere('log.createTime >= :since', { since: monthAgoStart })
      .getRawOne();
    const mau = parseInt(mauResult?.count || '0', 10);

    metrics.push(
      { name: 'dau', value: dau, unit: '人' },
      { name: 'wau', value: wau, unit: '人' },
      { name: 'mau', value: mau, unit: '人' },
    );

    // --- Per-student attendance metrics ---
    const attendances = await this.lessonAttendanceRepository.find({
      where: { studentCode },
    });

    const totalRecords = attendances.length;
    const presentStatuses = new Set([
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.ONLINE,
      AttendanceStatus.OFFLINE,
    ]);

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    for (const att of attendances) {
      if (att.status === AttendanceStatus.LATE) {
        lateCount++;
        presentCount++; // LATE counts as present for attendance rate
      } else if (att.status && presentStatuses.has(att.status)) {
        presentCount++;
      } else if (att.status === AttendanceStatus.ABSENT) {
        absentCount++;
      }
    }

    const totalAttendance = presentCount;
    const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 10000) / 100 : 0;
    const absenceRate = totalRecords > 0 ? Math.round((absentCount / totalRecords) * 10000) / 100 : 0;
    const lateRate = totalRecords > 0 ? Math.round((lateCount / totalRecords) * 10000) / 100 : 0;

    metrics.push(
      { name: 'totalAttendance', value: totalAttendance, unit: '次' },
      { name: 'attendanceRate', value: attendanceRate, unit: '%' },
      { name: 'absenceRate', value: absenceRate, unit: '%' },
      { name: 'lateRate', value: lateRate, unit: '%' },
    );

    // --- Course progress ---
    const activeEnrollments = await this.enrollmentRepository.find({
      where: { studentCode, status: EnrollmentStatus.ACTIVE },
    });

    let courseProgress = 0;
    if (activeEnrollments.length > 0) {
      const classCodes = activeEnrollments.map(e => e.classCode);

      // Count completed lessons for these classes
      const completedLessons = await this.lessonRepository.count({
        where: { classCode: In(classCodes) },
      });

      // Sum totalLessons from classes
      const classes = await this.classRepository.find({
        where: { classCode: In(classCodes) },
      });
      const totalLessonsSum = classes.reduce((sum, c) => sum + c.totalLessons, 0);

      courseProgress = totalLessonsSum > 0
        ? Math.round((completedLessons / totalLessonsSum) * 10000) / 100
        : 0;
    }

    metrics.push({ name: 'courseProgress', value: courseProgress, unit: '%' });

    return { metrics };
  }

  /**
   * Teacher metrics: teaching count, class count, student count
   */
  async getTeacherMetrics(teacherId: number): Promise<{ metrics: MetricItem[] }> {
    const metrics: MetricItem[] = [];

    // Teaching count: total lessons taught by this teacher
    const teachingCount = await this.lessonRepository.count({
      where: { teacherId },
    });
    metrics.push({ name: 'teachingCount', value: teachingCount, unit: '次' });

    // Class count: distinct classes assigned to this teacher
    const assignments = await this.teacherAssignmentRepository.find({
      where: { teacherId },
    });
    const classCodes = [...new Set(assignments.map(a => a.classCode))];
    const classCount = classCodes.length;
    metrics.push({ name: 'classCount', value: classCount, unit: '个' });

    // Student count: distinct students in teacher's classes (active enrollments only)
    let studentCount = 0;
    if (classCodes.length > 0) {
      const result = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .select('COUNT(DISTINCT enrollment.studentCode)', 'count')
        .where('enrollment.classCode IN (:...classCodes)', { classCodes })
        .andWhere('enrollment.status = :status', { status: EnrollmentStatus.ACTIVE })
        .getRawOne();
      studentCount = parseInt(result?.count || '0', 10);
    }
    metrics.push({ name: 'studentCount', value: studentCount, unit: '人' });

    return { metrics };
  }

  /**
   * Institution metrics: total students, active students, total courses, total classes
   */
  async getInstitutionMetrics(): Promise<{ metrics: MetricItem[] }> {
    const metrics: MetricItem[] = [];

    // Total students (not deleted)
    const totalStudents = await this.studentRepository.count({
      where: { deleted: false },
    });
    metrics.push({ name: 'totalStudents', value: totalStudents, unit: '人' });

    // Active students (distinct studentCode with ACTIVE enrollment)
    const activeResult = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .select('COUNT(DISTINCT enrollment.studentCode)', 'count')
      .where('enrollment.status = :status', { status: EnrollmentStatus.ACTIVE })
      .getRawOne();
    const activeStudents = parseInt(activeResult?.count || '0', 10);
    metrics.push({ name: 'activeStudents', value: activeStudents, unit: '人' });

    // Total courses (not deleted)
    const totalCourses = await this.courseRepository.count({
      where: { deleted: false },
    });
    metrics.push({ name: 'totalCourses', value: totalCourses, unit: '个' });

    // Total classes (not deleted)
    const totalClasses = await this.classRepository.count({
      where: { deleted: false },
    });
    metrics.push({ name: 'totalClasses', value: totalClasses, unit: '个' });

    return { metrics };
  }
}
