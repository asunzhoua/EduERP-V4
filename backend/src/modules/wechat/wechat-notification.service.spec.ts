import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WechatNotificationService } from './wechat-notification.service';
import { WechatService } from './wechat.service';
import { WechatMessageLog } from './entities/wechat-message-log.entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { Student } from '../student/entities/student.entity';
import { StudentParent } from '../student/entities/student-parent.entity';
import { User } from '../identity/entities/user.entity';
import { CourseEntity } from '../teaching/course/course.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';

describe('WechatNotificationService', () => {
  let service: WechatNotificationService;
  let wechatService: jest.Mocked<Pick<WechatService, 'sendSubscribeMessage'>>;
  let messageLogRepo: { findOne: jest.Mock };
  let attendanceRepo: { find: jest.Mock };
  let studentRepo: { findOne: jest.Mock };
  let studentParentRepo: { find: jest.Mock };
  let courseRepo: { findOne: jest.Mock };
  let enrollmentRepo: { find: jest.Mock };

  beforeEach(async () => {
    wechatService = {
      sendSubscribeMessage: jest.fn().mockResolvedValue(undefined),
    };
    messageLogRepo = { findOne: jest.fn() };
    attendanceRepo = { find: jest.fn() };
    studentRepo = { findOne: jest.fn() };
    studentParentRepo = { find: jest.fn() };
    courseRepo = { findOne: jest.fn() };
    enrollmentRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WechatNotificationService,
        { provide: WechatService, useValue: wechatService },
        {
          provide: getRepositoryToken(WechatMessageLog),
          useValue: messageLogRepo,
        },
        {
          provide: getRepositoryToken(LessonAttendanceEntity),
          useValue: attendanceRepo,
        },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentParent),
          useValue: studentParentRepo,
        },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(CourseEntity), useValue: courseRepo },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: enrollmentRepo,
        },
      ],
    }).compile();

    service = module.get<WechatNotificationService>(WechatNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const completedPayload = {
    lessonId: 10,
    classCode: 'C001',
    courseCode: 'MATH01',
    teacherId: 5,
    scheduledDate: '2026-07-25',
    actualStartTime: '2026-07-25T14:00:00.000Z',
    actualEndTime: '2026-07-25T15:00:00.000Z',
    durationMinutes: 60,
  };

  describe('dispatchLessonCompleted', () => {
    it('should resolve attendance -> student -> parent and send ATTENDANCE_NOTICE', async () => {
      messageLogRepo.findOne.mockResolvedValue(null);
      courseRepo.findOne.mockResolvedValue({
        courseCode: 'MATH01',
        name: '高中数学',
      });
      attendanceRepo.find.mockResolvedValue([
        { lessonId: 10, studentCode: 'S001', status: 'PRESENT' },
        { lessonId: 10, studentCode: 'S002', status: 'LATE' },
      ] as LessonAttendanceEntity[]);
      studentRepo.findOne
        .mockResolvedValueOnce({
          id: 100,
          studentCode: 'S001',
          name: '张三',
        })
        .mockResolvedValueOnce({
          id: 101,
          studentCode: 'S002',
          name: '李四',
        });
      studentParentRepo.find
        .mockResolvedValueOnce([
          { studentId: 100, parentId: 900 },
        ] as StudentParent[])
        .mockResolvedValueOnce([
          { studentId: 101, parentId: 901 },
        ] as StudentParent[]);

      await service.dispatchLessonCompleted(completedPayload);

      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledTimes(2);
      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 900,
          templateType: 'ATTENDANCE_NOTICE',
          data: {
            thing1: { value: '张三' },
            thing2: { value: '高中数学' },
            phrase3: { value: '已到校' },
            time4: { value: '2026-07-25 14:00' },
          },
          relatedEntityId: 10,
          relatedEntityType: 'lesson',
        }),
      );
      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 901,
          templateType: 'ATTENDANCE_NOTICE',
          data: expect.objectContaining({
            phrase3: { value: '迟到' },
          }) as unknown,
        }),
      );
    });

    it('should skip when a sent log already exists for the lesson', async () => {
      messageLogRepo.findOne.mockResolvedValue({
        id: 1,
        status: 'sent',
      });

      await service.dispatchLessonCompleted(completedPayload);

      expect(attendanceRepo.find).not.toHaveBeenCalled();
      expect(wechatService.sendSubscribeMessage).not.toHaveBeenCalled();
    });

    it('should not send when no attendance rows exist', async () => {
      messageLogRepo.findOne.mockResolvedValue(null);
      courseRepo.findOne.mockResolvedValue({
        courseCode: 'MATH01',
        name: '高中数学',
      });
      attendanceRepo.find.mockResolvedValue([]);

      await service.dispatchLessonCompleted(completedPayload);

      expect(wechatService.sendSubscribeMessage).not.toHaveBeenCalled();
    });

    it('should skip student with no parent binding', async () => {
      messageLogRepo.findOne.mockResolvedValue(null);
      courseRepo.findOne.mockResolvedValue({
        courseCode: 'MATH01',
        name: '高中数学',
      });
      attendanceRepo.find.mockResolvedValue([
        { lessonId: 10, studentCode: 'S001', status: 'PRESENT' },
      ] as LessonAttendanceEntity[]);
      studentRepo.findOne.mockResolvedValue({
        id: 100,
        studentCode: 'S001',
        name: '张三',
      });
      studentParentRepo.find.mockResolvedValue([]);

      await service.dispatchLessonCompleted(completedPayload);

      expect(wechatService.sendSubscribeMessage).not.toHaveBeenCalled();
    });
  });

  describe('dispatchLessonFinished', () => {
    const finishedPayload = {
      lessonId: 11,
      classCode: 'C001',
      courseCode: 'MATH01',
      teacherId: 5,
      scheduledDate: '2026-07-25',
      actualStartTime: '2026-07-25T14:00:00.000Z',
      actualEndTime: '2026-07-25T15:00:00.000Z',
      durationMinutes: 60,
      confirmedBy: 5,
      confirmedAt: '2026-07-25T16:00:00.000Z',
    };

    it('should send COURSE_CHANGE to all enrolled parents', async () => {
      messageLogRepo.findOne.mockResolvedValue(null);
      courseRepo.findOne.mockResolvedValue({
        courseCode: 'MATH01',
        name: '高中数学',
      });
      enrollmentRepo.find.mockResolvedValue([
        { classCode: 'C001', studentCode: 'S001', status: 'ACTIVE' },
        { classCode: 'C001', studentCode: 'S002', status: 'ACTIVE' },
      ] as EnrollmentEntity[]);
      studentRepo.findOne
        .mockResolvedValueOnce({
          id: 100,
          studentCode: 'S001',
          name: '张三',
        })
        .mockResolvedValueOnce({
          id: 101,
          studentCode: 'S002',
          name: '李四',
        });
      studentParentRepo.find
        .mockResolvedValueOnce([
          { studentId: 100, parentId: 900 },
        ] as StudentParent[])
        .mockResolvedValueOnce([
          { studentId: 101, parentId: 901 },
        ] as StudentParent[]);

      await service.dispatchLessonFinished(finishedPayload);

      expect(enrollmentRepo.find).toHaveBeenCalledWith({
        where: { classCode: 'C001', status: 'ACTIVE' },
      });
      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledTimes(2);
      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 900,
          templateType: 'COURSE_CHANGE',
          data: {
            thing1: { value: '高中数学' },
            thing2: { value: '结课' },
            thing3: { value: '课程已结课完成' },
            time4: { value: '2026-07-25 16:00' },
          },
          relatedEntityId: 11,
          relatedEntityType: 'lesson',
        }),
      );
    });
  });

  describe('dispatchLessonCancelled', () => {
    const cancelledPayload = {
      lessonId: 12,
      classCode: 'C001',
      courseCode: 'MATH01',
      teacherId: 5,
      scheduledDate: '2026-07-25',
      cancelledReason: '教师临时请假',
      cancelledBy: 5,
      cancelledAt: '2026-07-25T16:00:00.000Z',
    };

    it('should send COURSE_CHANGE with cancel reason', async () => {
      messageLogRepo.findOne.mockResolvedValue(null);
      courseRepo.findOne.mockResolvedValue({
        courseCode: 'MATH01',
        name: '高中数学',
      });
      enrollmentRepo.find.mockResolvedValue([
        { classCode: 'C001', studentCode: 'S001', status: 'ACTIVE' },
      ] as EnrollmentEntity[]);
      studentRepo.findOne.mockResolvedValue({
        id: 100,
        studentCode: 'S001',
        name: '张三',
      });
      studentParentRepo.find.mockResolvedValue([
        { studentId: 100, parentId: 900 },
      ] as StudentParent[]);

      await service.dispatchLessonCancelled(cancelledPayload);

      expect(wechatService.sendSubscribeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 900,
          templateType: 'COURSE_CHANGE',
          data: expect.objectContaining({
            thing2: { value: '停课' },
            thing3: { value: '教师临时请假' },
          }) as unknown,
          relatedEntityId: 12,
          relatedEntityType: 'lesson',
        }),
      );
    });
  });
});
