import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WechatService } from './wechat.service';
import { WechatMessageLog } from './entities/wechat-message-log.entity';
import { RELATED_ENTITY } from './constants/related-entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { Student } from '../student/entities/student.entity';
import { StudentParent } from '../student/entities/student-parent.entity';
import { CourseEntity } from '../teaching/course/course.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { AppLogger } from '@utils/logger';

/** 出勤状态 → 模板展示文案。 */
const ATTENDANCE_STATUS_TEXT: Record<string, string> = {
  PRESENT: '已到校',
  ABSENT: '缺勤',
  LATE: '迟到',
  LEAVE: '请假',
  SICK: '病假',
  MAKEUP: '补课',
  ONLINE: '线上课',
  OFFLINE: '线下课',
};

export interface LessonLifecyclePayload {
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: string;
}

/**
 * 微信订阅消息投递服务：收口事件 → 数据解析（考勤/学生/家长/课程）→ 组装模板数据 → 调 WechatService 发送。
 * 订阅器保持薄：只做事件校验 + 调本服务，详见 WECHAT-PRODUCTION-PLAN §2。
 */
@Injectable()
export class WechatNotificationService {
  private logger = new AppLogger();

  constructor(
    @InjectRepository(WechatMessageLog)
    private messageLogRepo: Repository<WechatMessageLog>,
    @InjectRepository(LessonAttendanceEntity)
    private attendanceRepo: Repository<LessonAttendanceEntity>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private studentParentRepo: Repository<StudentParent>,
    @InjectRepository(CourseEntity)
    private courseRepo: Repository<CourseEntity>,
    @InjectRepository(EnrollmentEntity)
    private enrollmentRepo: Repository<EnrollmentEntity>,
    private wechatService: WechatService,
  ) {}

  /** lesson.completed → 考勤通知（按考勤记录逐学生发给家长）。 */
  async dispatchLessonCompleted(
    payload: LessonLifecyclePayload & {
      actualStartTime: string | null;
    },
  ): Promise<void> {
    if (await this.isAlreadySent(payload.lessonId, 'ATTENDANCE_NOTICE')) {
      return;
    }
    const courseName = await this.resolveCourseName(payload.courseCode);
    const attendances = await this.attendanceRepo.find({
      where: { lessonId: payload.lessonId },
    });

    for (const att of attendances) {
      const student = await this.studentRepo.findOne({
        where: { studentCode: att.studentCode },
      });
      if (!student) {
        continue;
      }
      const parents = await this.studentParentRepo.find({
        where: { studentId: student.id },
      });
      for (const parent of parents) {
        await this.wechatService.sendSubscribeMessage({
          userId: parent.parentId,
          templateType: 'ATTENDANCE_NOTICE',
          data: {
            thing1: { value: student.name },
            thing2: { value: courseName },
            phrase3: {
              value: ATTENDANCE_STATUS_TEXT[att.status ?? ''] || '未确认',
            },
            time4: {
              value: this.formatTime(
                payload.actualStartTime || payload.scheduledDate,
              ),
            },
          },
          relatedEntityId: payload.lessonId,
          relatedEntityType: RELATED_ENTITY.LESSON,
        });
      }
    }
  }

  /** lesson.finished → 课时变动（结课）。 */
  async dispatchLessonFinished(
    payload: LessonLifecyclePayload & {
      confirmedAt: string;
    },
  ): Promise<void> {
    if (await this.isAlreadySent(payload.lessonId, 'COURSE_CHANGE')) {
      return;
    }
    const courseName = await this.resolveCourseName(payload.courseCode);
    const parentIds = await this.getEnrolledParentIds(payload.classCode);

    for (const userId of parentIds) {
      await this.wechatService.sendSubscribeMessage({
        userId,
        templateType: 'COURSE_CHANGE',
        data: {
          thing1: { value: courseName },
          thing2: { value: '结课' },
          thing3: { value: '课程已结课完成' },
          time4: { value: this.formatTime(payload.confirmedAt) },
        },
        relatedEntityId: payload.lessonId,
        relatedEntityType: RELATED_ENTITY.LESSON,
      });
    }
  }

  /** lesson.cancelled → 课时变动（停课）。 */
  async dispatchLessonCancelled(
    payload: LessonLifecyclePayload & {
      cancelledReason: string | null;
      cancelledAt: string;
    },
  ): Promise<void> {
    if (await this.isAlreadySent(payload.lessonId, 'COURSE_CHANGE')) {
      return;
    }
    const courseName = await this.resolveCourseName(payload.courseCode);
    const parentIds = await this.getEnrolledParentIds(payload.classCode);

    for (const userId of parentIds) {
      await this.wechatService.sendSubscribeMessage({
        userId,
        templateType: 'COURSE_CHANGE',
        data: {
          thing1: { value: courseName },
          thing2: { value: '停课' },
          thing3: { value: payload.cancelledReason || '课程取消' },
          time4: { value: this.formatTime(payload.cancelledAt) },
        },
        relatedEntityId: payload.lessonId,
        relatedEntityType: RELATED_ENTITY.LESSON,
      });
    }
  }

  /** 幂等：同实体同模板已有 sent 记录则跳过；failed 允许重试。 */
  private async isAlreadySent(
    lessonId: number,
    templateType: string,
  ): Promise<boolean> {
    const existing = await this.messageLogRepo.findOne({
      where: {
        relatedEntityId: lessonId,
        relatedEntityType: RELATED_ENTITY.LESSON,
        templateType,
        status: 'sent',
      },
    });
    return !!existing;
  }

  private async resolveCourseName(courseCode: string): Promise<string> {
    try {
      const course = await this.courseRepo.findOne({ where: { courseCode } });
      return course?.name || courseCode;
    } catch (error) {
      this.logger.error(
        `[WeChatNotify] resolve course name failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return courseCode;
    }
  }

  /** 班级下所有在册学生去重后的家长 userId 集合。 */
  private async getEnrolledParentIds(classCode: string): Promise<number[]> {
    const enrollments = await this.enrollmentRepo.find({
      where: { classCode, status: EnrollmentStatus.ACTIVE },
    });
    const parentIds = new Set<number>();
    for (const enrollment of enrollments) {
      const student = await this.studentRepo.findOne({
        where: { studentCode: enrollment.studentCode },
      });
      if (!student) {
        continue;
      }
      const parents = await this.studentParentRepo.find({
        where: { studentId: student.id },
      });
      for (const parent of parents) {
        parentIds.add(parent.parentId);
      }
    }
    return [...parentIds];
  }

  /** 统一时间展示：日期仅 'YYYY-MM-DD'，ISO 取 'YYYY-MM-DD HH:mm'（不随时区偏移）。 */
  private formatTime(input: string | null | undefined): string {
    if (!input) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(input);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return input;
  }
}
