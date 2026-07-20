import { Test, TestingModule } from '@nestjs/testing';
import { LessonAttendanceController } from './lesson-attendance.controller';
import { LessonAttendanceService } from './lesson-attendance.service';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { BatchRollCallDto } from './dto/batch-roll-call.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';

describe('LessonAttendanceController', () => {
  let controller: LessonAttendanceController;
  let service: LessonAttendanceService;

  const mockAttendanceRecord = {
    id: 1,
    lessonId: 1,
    studentCode: 'STU001',
    classCode: 'CLS001',
    teacherId: 1,
    status: AttendanceStatus.PRESENT,
    workflowState: 'CHECKED_IN',
    checkInTime: new Date('2026-07-19T10:00:00Z'),
    operator: 0,
    source: 'MANUAL',
    reason: null,
    note: null,
    createdBy: 0,
    createdAt: new Date('2026-07-19T10:00:00Z'),
    updatedAt: new Date('2026-07-19T10:00:00Z'),
  };

  const mockAttendanceList = [
    { ...mockAttendanceRecord, studentCode: 'STU001' },
    { ...mockAttendanceRecord, id: 2, studentCode: 'STU002' },
  ];

  const mockService = {
    batchRollCall: jest.fn().mockResolvedValue(mockAttendanceList),
    recordAttendance: jest.fn().mockResolvedValue(mockAttendanceRecord),
    confirmAll: jest.fn().mockResolvedValue(mockAttendanceList),
    findByLessonId: jest.fn().mockResolvedValue(mockAttendanceList),
    findByStudentCode: jest.fn().mockResolvedValue(mockAttendanceList),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonAttendanceController],
      providers: [
        { provide: LessonAttendanceService, useValue: mockService },
      ],
    }).compile();

    controller = module.get(LessonAttendanceController);
    service = module.get(LessonAttendanceService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.batchRollCall.mockResolvedValue(mockAttendanceList);
    mockService.recordAttendance.mockResolvedValue(mockAttendanceRecord);
    mockService.confirmAll.mockResolvedValue(mockAttendanceList);
    mockService.findByLessonId.mockResolvedValue(mockAttendanceList);
    mockService.findByStudentCode.mockResolvedValue(mockAttendanceList);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('batchRollCall', () => {
    it('should call service.batchRollCall with mapped input', async () => {
      const dto: BatchRollCallDto = {
        records: [
          {
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            note: '正常到课',
          },
          {
            studentCode: 'STU002',
            status: AttendanceStatus.LATE,
            reason: '交通堵塞',
          },
        ],
      };

      const result = await controller.batchRollCall(1, dto);

      expect(result).toEqual(mockAttendanceList);
      expect(result).toHaveLength(2);
      expect(service.batchRollCall).toHaveBeenCalledWith({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 0,
            note: '正常到课',
            reason: undefined,
          },
          {
            lessonId: 1,
            studentCode: 'STU002',
            status: AttendanceStatus.LATE,
            operator: 0,
            reason: '交通堵塞',
            note: undefined,
          },
        ],
      });
    });
  });

  describe('updateAttendance', () => {
    it('should call service.recordAttendance with correct input', async () => {
      const body = {
        status: AttendanceStatus.PRESENT,
        note: '补签',
      };

      const result = await controller.updateAttendance(1, 'STU001', body);

      expect(result).toEqual(mockAttendanceRecord);
      expect(service.recordAttendance).toHaveBeenCalledWith({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 0,
        note: '补签',
        reason: undefined,
      });
    });

    it('should pass reason when provided', async () => {
      const body = {
        status: AttendanceStatus.LATE,
        reason: '起晚了',
      };

      await controller.updateAttendance(1, 'STU003', body);

      expect(service.recordAttendance).toHaveBeenCalledWith({
        lessonId: 1,
        studentCode: 'STU003',
        status: AttendanceStatus.LATE,
        operator: 0,
        reason: '起晚了',
        note: undefined,
      });
    });
  });

  describe('findByLesson', () => {
    it('should call service.findByLessonId with correct param', async () => {
      const result = await controller.findByLesson(1);

      expect(result).toEqual(mockAttendanceList);
      expect(service.findByLessonId).toHaveBeenCalledWith(1);
    });
  });

  describe('confirmAll', () => {
    it('should call service.confirmAll with lessonId and operator=0', async () => {
      const result = await controller.confirmAll(1);

      expect(result).toEqual(mockAttendanceList);
      expect(service.confirmAll).toHaveBeenCalledWith(1, 0);
    });
  });

  describe('findByStudent', () => {
    it('should call service.findByStudentCode with correct param', async () => {
      const result = await controller.findByStudent('STU001');

      expect(result).toEqual(mockAttendanceList);
      expect(service.findByStudentCode).toHaveBeenCalledWith('STU001');
    });
  });
});
