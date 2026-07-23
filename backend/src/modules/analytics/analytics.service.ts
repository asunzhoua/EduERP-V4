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

export interface TrendData {
  date: string; // YYYY-MM-DD
  value: number;
  label?: string;
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

  // ─── Trend Analysis ───

  /**
   * Helper: generate an array of YYYY-MM-DD strings for the past N days (including today).
   */
  private generateDateRange(days: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }

  /**
   * Helper: format a Date or date-string to YYYY-MM-DD.
   */
  private formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Student trend: learning trend (daily lesson count) + attendance trend (daily attendance rate)
   */
  async getStudentTrend(
    studentCode: string,
    days: number = 7,
  ): Promise<{ learningTrend: TrendData[]; attendanceTrend: TrendData[] }> {
    const dateRange = this.generateDateRange(days);
    const startDate = dateRange[0];
    const endDate = dateRange[dateRange.length - 1];

    // Step 1: Get lessons in date range
    const lessons = await this.lessonRepository
      .createQueryBuilder('lesson')
      .select('lesson.id', 'id')
      .addSelect('lesson.scheduledDate', 'date')
      .where('lesson.scheduledDate >= :startDate', { startDate })
      .andWhere('lesson.scheduledDate <= :endDate', { endDate })
      .getRawMany();

    if (lessons.length === 0) {
      return {
        learningTrend: dateRange.map(d => ({ date: d, value: 0 })),
        attendanceTrend: dateRange.map(d => ({ date: d, value: 0 })),
      };
    }

    const lessonIds = lessons.map(l => parseInt(l.id, 10));
    const lessonIdToDate = new Map<number, string>();
    for (const l of lessons) {
      const id = parseInt(l.id, 10);
      const date = typeof l.date === 'string' ? l.date : this.formatDate(l.date);
      lessonIdToDate.set(id, date);
    }

    // Step 2: Count attendance records per lesson for learning trend
    const learningRows = await this.lessonAttendanceRepository
      .createQueryBuilder('att')
      .select('att.lessonId', 'lessonId')
      .addSelect('COUNT(*)', 'count')
      .where('att.studentCode = :studentCode', { studentCode })
      .andWhere('att.lessonId IN (:...lessonIds)', { lessonIds })
      .groupBy('att.lessonId')
      .getRawMany();

    const lessonMap = new Map<string, number>();
    for (const row of learningRows) {
      const lid = parseInt(row.lessonId, 10);
      const date = lessonIdToDate.get(lid);
      if (date) {
        lessonMap.set(date, (lessonMap.get(date) || 0) + parseInt(row.count, 10));
      }
    }

    const learningTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: lessonMap.get(date) || 0,
    }));

    // Step 3: Get attendance status per lesson for attendance trend
    const attRows = await this.lessonAttendanceRepository
      .createQueryBuilder('att')
      .select('att.lessonId', 'lessonId')
      .addSelect('att.status', 'status')
      .where('att.studentCode = :studentCode', { studentCode })
      .andWhere('att.lessonId IN (:...lessonIds)', { lessonIds })
      .getRawMany();

    const dateStats = new Map<string, { total: number; present: number }>();
    for (const row of attRows) {
      const lid = parseInt(row.lessonId, 10);
      const date = lessonIdToDate.get(lid);
      if (!date) continue;
      if (!dateStats.has(date)) dateStats.set(date, { total: 0, present: 0 });
      const stats = dateStats.get(date)!;
      stats.total++;
      if (row.status === AttendanceStatus.PRESENT || row.status === AttendanceStatus.LATE) {
        stats.present++;
      }
    }

    const attMap = new Map<string, number>();
    for (const [date, stats] of dateStats) {
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0;
      attMap.set(date, rate);
    }

    const attendanceTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: attMap.get(date) || 0,
    }));

    return { learningTrend, attendanceTrend };
  }

  /**
   * Teacher trend: daily lesson count + daily student attendance rate
   */
  async getTeacherTrend(
    teacherId: number,
    days: number = 7,
  ): Promise<{ lessonTrend: TrendData[]; attendanceTrend: TrendData[] }> {
    const dateRange = this.generateDateRange(days);
    const startDate = dateRange[0];
    const endDate = dateRange[dateRange.length - 1];

    // Lesson trend: count of lessons per day for this teacher
    const lessonRows = await this.lessonRepository
      .createQueryBuilder('lesson')
      .select('lesson.scheduledDate', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('lesson.teacherId = :teacherId', { teacherId })
      .andWhere('lesson.scheduledDate >= :startDate', { startDate })
      .andWhere('lesson.scheduledDate <= :endDate', { endDate })
      .groupBy('lesson.scheduledDate')
      .getRawMany();

    const lessonMap = new Map<string, number>();
    for (const row of lessonRows) {
      lessonMap.set(row.date, parseInt(row.count, 10));
    }

    const lessonTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: lessonMap.get(date) || 0,
    }));

    // Attendance trend: student attendance rate under this teacher per day
    // Step 1: Get lessons for this teacher in date range
    const teacherLessons = await this.lessonRepository
      .createQueryBuilder('lesson')
      .select('lesson.id', 'id')
      .addSelect('lesson.scheduledDate', 'date')
      .where('lesson.teacherId = :teacherId', { teacherId })
      .andWhere('lesson.scheduledDate >= :startDate', { startDate })
      .andWhere('lesson.scheduledDate <= :endDate', { endDate })
      .getRawMany();

    if (teacherLessons.length === 0) {
      return {
        lessonTrend: dateRange.map(d => ({ date: d, value: 0 })),
        attendanceTrend: dateRange.map(d => ({ date: d, value: 0 })),
      };
    }

    const teacherLessonIds = teacherLessons.map(l => parseInt(l.id, 10));
    const teacherLessonIdToDate = new Map<number, string>();
    for (const l of teacherLessons) {
      const id = parseInt(l.id, 10);
      const date = typeof l.date === 'string' ? l.date : this.formatDate(l.date);
      teacherLessonIdToDate.set(id, date);
    }

    // Step 2: Get attendance records for these lessons
    const attRows = await this.lessonAttendanceRepository
      .createQueryBuilder('att')
      .select('att.lessonId', 'lessonId')
      .addSelect('att.status', 'status')
      .where('att.lessonId IN (:...teacherLessonIds)', { teacherLessonIds })
      .getRawMany();

    const dateStats = new Map<string, { total: number; present: number }>();
    for (const row of attRows) {
      const lid = parseInt(row.lessonId, 10);
      const date = teacherLessonIdToDate.get(lid);
      if (!date) continue;
      if (!dateStats.has(date)) dateStats.set(date, { total: 0, present: 0 });
      const stats = dateStats.get(date)!;
      stats.total++;
      if (row.status === AttendanceStatus.PRESENT || row.status === AttendanceStatus.LATE) {
        stats.present++;
      }
    }

    const attMap = new Map<string, number>();
    for (const [date, stats] of dateStats) {
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0;
      attMap.set(date, rate);
    }

    const attendanceTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: attMap.get(date) || 0,
    }));

    return { lessonTrend, attendanceTrend };
  }

  /**
   * Institution trend: daily lesson count + daily new student enrollment count
   */
  async getInstitutionTrend(
    days: number = 7,
  ): Promise<{ lessonTrend: TrendData[]; enrollmentTrend: TrendData[] }> {
    const dateRange = this.generateDateRange(days);
    const startDate = dateRange[0];
    const endDate = dateRange[dateRange.length - 1];

    // Lesson trend: total lessons per day across the institution
    const lessonRows = await this.lessonRepository
      .createQueryBuilder('lesson')
      .select('lesson.scheduledDate', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('lesson.scheduledDate >= :startDate', { startDate })
      .andWhere('lesson.scheduledDate <= :endDate', { endDate })
      .groupBy('lesson.scheduledDate')
      .getRawMany();

    const lessonMap = new Map<string, number>();
    for (const row of lessonRows) {
      lessonMap.set(row.date, parseInt(row.count, 10));
    }

    const lessonTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: lessonMap.get(date) || 0,
    }));

    // Enrollment trend: new students per day
    const enrollRows = await this.studentRepository
      .createQueryBuilder('student')
      .select('DATE(student.createTime)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('student.createTime >= :startDate', { startDate })
      .andWhere('student.createTime <= :endDate', { endDate })
      .andWhere('student.deleted = :deleted', { deleted: false })
      .groupBy('date')
      .getRawMany();

    const enrollMap = new Map<string, number>();
    for (const row of enrollRows) {
      const dateKey =
        typeof row.date === 'string'
          ? row.date.substring(0, 10)
          : this.formatDate(row.date);
      enrollMap.set(dateKey, parseInt(row.count, 10));
    }

    const enrollmentTrend: TrendData[] = dateRange.map((date) => ({
      date,
      value: enrollMap.get(date) || 0,
    }));

    return { lessonTrend, enrollmentTrend };
  }
}
