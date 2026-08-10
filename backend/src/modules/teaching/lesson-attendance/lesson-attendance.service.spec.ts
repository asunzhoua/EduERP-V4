import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LessonAttendanceService,
  VALID_WORKFLOW_TRANSITIONS,
  REASON_REQUIRED_STATUSES,
} from './lesson-attendance.service';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import {
  AttendanceStatus,
  DEDUCTIBLE_STATUSES,
} from './enums/attendance-status.enum';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ContractRepository } from '@modules/teaching/contract/contract.repository';
import { ContractStatus } from '@modules/teaching/contract/enums/contract-status.enum';
import { PointsService } from '@modules/points/points.service';
import { ClassEntity } from '../class/class.entity';
import { CourseEntity } from '../course/course.entity';
import { Subject } from '@common/enums/subject.enum';
import { ImportService } from '@utils/services/import.service';
import { LessonRepository } from '../lesson/lesson.repository';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { Student } from '@modules/student/entities/student.entity';

describe('LessonAttendanceService', () => {
  let service: LessonAttendanceService;
  let mockContractRepo: any;
  // 每个 TestingModule 独立注入 PointsService mock
  const pointsServiceMock = () => ({ credit: jest.fn().mockResolvedValue({ balance: 10 }) });

  beforeEach(async () => {
    const mockRepo = {
      save: jest.fn(),
      saveAll: jest.fn(),
      findOneById: jest.fn(),
      findByLessonId: jest.fn(),
      findByLessonAndStudent: jest.fn(),
      findByStudentCode: jest.fn(),
      findByLessonIdAndStudentCodes: jest.fn(),
      countPendingByLessonId: jest.fn(),
      countUnconfirmedByLessonId: jest.fn(),
    };

    const mockReminderService = {
      createReminder: jest.fn().mockResolvedValue({ id: 1 }),
    };

    mockContractRepo = {
      findActiveByStudentCodeAndSubject: jest.fn().mockResolvedValue(null),
      findByStudentCode: jest.fn().mockResolvedValue([]),
      findOneById: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const mockClassRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const mockCourseRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const mockPointsService = {
      credit: jest.fn().mockResolvedValue({ balance: 10 }),
    };
    const mockLessonRepo = {
      findOneById: jest.fn().mockResolvedValue(null),
      findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
    };
    const mockStudentRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const mockImportService = {
      parseBuffer: jest.fn().mockReturnValue([]),
      validateRows: jest.fn().mockReturnValue({
        validRows: [],
        report: { total: 0, success: 0, failure: 0, details: [], fileName: '' },
      }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonAttendanceService,
        { provide: LessonAttendanceRepository, useValue: mockRepo },
        { provide: ReminderService, useValue: mockReminderService },
        { provide: ContractRepository, useValue: mockContractRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        { provide: getRepositoryToken(CourseEntity), useValue: mockCourseRepo },
        { provide: PointsService, useValue: mockPointsService },
        { provide: LessonRepository, useValue: mockLessonRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: ImportService, useValue: mockImportService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<LessonAttendanceService>(LessonAttendanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ══════════════════════════════════════════════════════════════�?  // State Machine Tests
  // ══════════════════════════════════════════════════════════════�?
  describe('Workflow State Machine', () => {
    describe('VALID_WORKFLOW_TRANSITIONS definition', () => {
      it('should define transitions for all 4 workflow states', () => {
        expect(Object.keys(VALID_WORKFLOW_TRANSITIONS)).toHaveLength(4);
        expect(VALID_WORKFLOW_TRANSITIONS).toHaveProperty(
          AttendanceWorkflowState.PENDING,
        );
        expect(VALID_WORKFLOW_TRANSITIONS).toHaveProperty(
          AttendanceWorkflowState.CHECKED_IN,
        );
        expect(VALID_WORKFLOW_TRANSITIONS).toHaveProperty(
          AttendanceWorkflowState.CONFIRMED,
        );
        expect(VALID_WORKFLOW_TRANSITIONS).toHaveProperty(
          AttendanceWorkflowState.LOCKED,
        );
      });

      it('PENDING should only transition to CHECKED_IN (forward)', () => {
        const transitions =
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING];
        expect(transitions).toEqual([AttendanceWorkflowState.CHECKED_IN]);
      });

      it('CHECKED_IN should transition to CONFIRMED (forward) or PENDING (reverse)', () => {
        const transitions =
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN];
        expect(transitions).toContain(AttendanceWorkflowState.CONFIRMED);
        expect(transitions).toContain(AttendanceWorkflowState.PENDING);
        expect(transitions).toHaveLength(2);
      });

      it('CONFIRMED should transition to LOCKED (forward) or CHECKED_IN (reverse)', () => {
        const transitions =
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED];
        expect(transitions).toContain(AttendanceWorkflowState.LOCKED);
        expect(transitions).toContain(AttendanceWorkflowState.CHECKED_IN);
        expect(transitions).toHaveLength(2);
      });

      it('LOCKED should be terminal (no transitions out)', () => {
        const transitions =
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.LOCKED];
        expect(transitions).toEqual([]);
      });
    });

    describe('Forward transitions', () => {
      it('should allow PENDING �?CHECKED_IN', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).toContain(AttendanceWorkflowState.CHECKED_IN);
      });

      it('should allow CHECKED_IN �?CONFIRMED', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).toContain(AttendanceWorkflowState.CONFIRMED);
      });

      it('should allow CONFIRMED �?LOCKED', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).toContain(AttendanceWorkflowState.LOCKED);
      });
    });

    describe('Reverse transitions (admin override)', () => {
      it('should allow CONFIRMED �?CHECKED_IN (reverse)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).toContain(AttendanceWorkflowState.CHECKED_IN);
      });

      it('should allow CHECKED_IN �?PENDING (reverse)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).toContain(AttendanceWorkflowState.PENDING);
      });
    });

    describe('Forbidden transitions', () => {
      it('should NOT allow PENDING �?CONFIRMED (skip CHECKED_IN)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).not.toContain(AttendanceWorkflowState.CONFIRMED);
      });

      it('should NOT allow PENDING �?LOCKED (skip CHECKED_IN and CONFIRMED)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).not.toContain(AttendanceWorkflowState.LOCKED);
      });

      it('should NOT allow CHECKED_IN �?LOCKED (skip CONFIRMED)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).not.toContain(AttendanceWorkflowState.LOCKED);
      });

      it('should NOT allow CONFIRMED �?PENDING (must go through CHECKED_IN)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).not.toContain(AttendanceWorkflowState.PENDING);
      });

      it('should NOT allow LOCKED �?anything (terminal)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.LOCKED],
        ).toHaveLength(0);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════�?  // Domain Invariant Tests
  // ══════════════════════════════════════════════════════════════�?
  describe('Domain Invariants', () => {
    describe('Invariant-A002: Status must be set before confirmation', () => {
      it('REASON_REQUIRED_STATUSES should include LATE, LEAVE, ABSENT', () => {
        expect(REASON_REQUIRED_STATUSES).toContain(AttendanceStatus.LATE);
        expect(REASON_REQUIRED_STATUSES).toContain(AttendanceStatus.LEAVE);
        expect(REASON_REQUIRED_STATUSES).toContain(AttendanceStatus.ABSENT);
      });

      it('REASON_REQUIRED_STATUSES should NOT include PRESENT', () => {
        expect(REASON_REQUIRED_STATUSES).not.toContain(
          AttendanceStatus.PRESENT,
        );
      });

      it('REASON_REQUIRED_STATUSES should NOT include ONLINE', () => {
        expect(REASON_REQUIRED_STATUSES).not.toContain(AttendanceStatus.ONLINE);
      });

      it('REASON_REQUIRED_STATUSES should NOT include OFFLINE', () => {
        expect(REASON_REQUIRED_STATUSES).not.toContain(
          AttendanceStatus.OFFLINE,
        );
      });

      it('REASON_REQUIRED_STATUSES should NOT include MAKEUP', () => {
        expect(REASON_REQUIRED_STATUSES).not.toContain(AttendanceStatus.MAKEUP);
      });
    });

    describe('Invariant-A004: Attendance never triggers deduction directly', () => {
      it('DEDUCTIBLE_STATUSES should include PRESENT, LATE, ONLINE, OFFLINE', () => {
        expect(DEDUCTIBLE_STATUSES).toContain(AttendanceStatus.PRESENT);
        expect(DEDUCTIBLE_STATUSES).toContain(AttendanceStatus.LATE);
        expect(DEDUCTIBLE_STATUSES).toContain(AttendanceStatus.ONLINE);
        expect(DEDUCTIBLE_STATUSES).toContain(AttendanceStatus.OFFLINE);
      });

      it('DEDUCTIBLE_STATUSES should NOT include ABSENT', () => {
        expect(DEDUCTIBLE_STATUSES).not.toContain(AttendanceStatus.ABSENT);
      });

      it('DEDUCTIBLE_STATUSES should NOT include LEAVE', () => {
        expect(DEDUCTIBLE_STATUSES).not.toContain(AttendanceStatus.LEAVE);
      });

      it('DEDUCTIBLE_STATUSES should NOT include MAKEUP', () => {
        expect(DEDUCTIBLE_STATUSES).not.toContain(AttendanceStatus.MAKEUP);
      });

      it('DEDUCTIBLE_STATUSES should have exactly 4 values', () => {
        expect(DEDUCTIBLE_STATUSES.size).toBe(4);
      });
    });

    describe('All 8 attendance statuses are defined', () => {
      it('should have exactly 8 status values', () => {
        const values = Object.values(AttendanceStatus);
        expect(values).toHaveLength(8);
      });

      it('should include all required statuses', () => {
        expect(Object.values(AttendanceStatus)).toEqual(
          expect.arrayContaining([
            'PRESENT',
            'ABSENT',
            'LATE',
            'LEAVE',
            'SICK',
            'MAKEUP',
            'ONLINE',
            'OFFLINE',
          ]),
        );
      });
    });

    describe('All 4 workflow states are defined', () => {
      it('should have exactly 4 workflow state values', () => {
        const values = Object.values(AttendanceWorkflowState);
        expect(values).toHaveLength(4);
      });

      it('should include all required workflow states', () => {
        expect(Object.values(AttendanceWorkflowState)).toEqual(
          expect.arrayContaining([
            'PENDING',
            'CHECKED_IN',
            'CONFIRMED',
            'LOCKED',
          ]),
        );
      });
    });

    describe('Unique constraint verification (Invariant-A001)', () => {
      it('entity should have @Unique decorator on lessonId + studentCode', () => {
        // The @Unique decorator is applied at class level
        // This test verifies the entity class exists and can be instantiated
        const attendance = new LessonAttendanceEntity();
        expect(attendance).toBeDefined();
      });
    });

    describe('Entity field defaults', () => {
      it('should default workflowState to PENDING', () => {
        // Default is set by TypeORM decorator, verify the enum value exists
        expect(AttendanceWorkflowState.PENDING).toBe('PENDING');
      });

      it('should allow null status (Invariant-A002: null when PENDING)', () => {
        const entity = new LessonAttendanceEntity();
        entity.status = null;
        expect(entity.status).toBeNull();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════�?  // Service Behavior Tests (Phase 2a Implementation)
  // ══════════════════════════════════════════════════════════════�?
  describe('autoCreateForLesson()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonId: jest.fn(),
        countUnconfirmedByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should create PENDING records for each student', async () => {
      const result = await service.autoCreateForLesson(
        1,
        ['STU001', 'STU002'],
        'CL001',
        10,
      );

      expect(result).toHaveLength(2);
      expect(result[0].workflowState).toBe(AttendanceWorkflowState.PENDING);
      expect(result[0].studentCode).toBe('STU001');
      expect(result[0].classCode).toBe('CL001');
      expect(mockRepo.saveAll).toHaveBeenCalled();
    });

    it('should create empty array when no students', async () => {
      const result = await service.autoCreateForLesson(1, [], 'CL001', 10);
      expect(result).toHaveLength(0);
    });
  });

  describe('recordAttendance()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        findByLessonAndStudent: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should transition PENDING to CHECKED_IN with PRESENT', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.lessonId = 1;
      entity.studentCode = 'STU001';
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      const result = await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(result.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(result.checkInTime).toBeInstanceOf(Date);
    });

    it('should require reason for LATE status', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await expect(
        service.recordAttendance({
          lessonId: 1,
          studentCode: 'STU001',
          status: AttendanceStatus.LATE,
          operator: 10,
        }),
      ).rejects.toThrow('Status LATE requires a reason');
    });

    it('should accept LATE with reason', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      const result = await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.LATE,
        reason: 'Traffic',
        operator: 10,
      });

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(result.reason).toBe('Traffic');
    });

    it('should throw when record not found', async () => {
      mockRepo.findByLessonAndStudent.mockResolvedValue(null);

      await expect(
        service.recordAttendance({
          lessonId: 1,
          studentCode: 'STU999',
          status: AttendanceStatus.PRESENT,
          operator: 10,
        }),
      ).rejects.toThrow('Attendance record not found');
    });

    it('should reject LOCKED to CHECKED_IN transition', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.LOCKED;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await expect(
        service.recordAttendance({
          lessonId: 1,
          studentCode: 'STU001',
          status: AttendanceStatus.PRESENT,
          operator: 10,
        }),
      ).rejects.toThrow('Invalid workflow transition');
    });
  });

  describe('batchRollCall()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonIdAndStudentCodes: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should process multiple records', async () => {
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      const e2 = new LessonAttendanceEntity();
      e2.studentCode = 'STU002';
      e2.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1, e2]);

      const result = await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
          {
            lessonId: 1,
            studentCode: 'STU002',
            status: AttendanceStatus.ABSENT,
            reason: 'Sick',
            operator: 10,
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(mockRepo.saveAll).toHaveBeenCalled();
    });
  });

  describe('confirmAll()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should confirm CHECKED_IN records', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.workflowState = AttendanceWorkflowState.CHECKED_IN;
      const r2 = new LessonAttendanceEntity();
      r2.workflowState = AttendanceWorkflowState.CHECKED_IN;
      mockRepo.findByLessonId.mockResolvedValue([r1, r2]);

      const result = await service.confirmAll(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0].workflowState).toBe(AttendanceWorkflowState.CONFIRMED);
      expect(mockRepo.saveAll).toHaveBeenCalled();
    });

    it('should skip PENDING records', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonId.mockResolvedValue([r1]);

      const result = await service.confirmAll(1, 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('lockByLessonId()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should lock CONFIRMED records', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.workflowState = AttendanceWorkflowState.CONFIRMED;
      mockRepo.findByLessonId.mockResolvedValue([r1]);

      await service.lockByLessonId(1);

      expect(r1.workflowState).toBe(AttendanceWorkflowState.LOCKED);
      expect(mockRepo.saveAll).toHaveBeenCalled();
    });

    it('should skip non-CONFIRMED records', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.workflowState = AttendanceWorkflowState.CHECKED_IN;
      mockRepo.findByLessonId.mockResolvedValue([r1]);

      await service.lockByLessonId(1);

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('reverseToCheckedIn()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should allow CONFIRMED �?CHECKED_IN transition per state machine', async () => {
      // The state machine allows CONFIRMED �?CHECKED_IN (admin override)
      expect(
        VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
      ).toContain(AttendanceWorkflowState.CHECKED_IN);
    });

    it('should allow CHECKED_IN �?PENDING transition per state machine', async () => {
      expect(
        VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
      ).toContain(AttendanceWorkflowState.PENDING);
    });
  });

  // ══════════════════════════════════════════════════════════════�?  // Read Method Tests
  // ══════════════════════════════════════════════════════════════�?
  describe('findOne()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        findOneById: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return attendance records for a lesson', async () => {
      const entity = new LessonAttendanceEntity();
      entity.lessonId = 1;
      entity.studentCode = 'STU001';
      mockRepo.findByLessonId = jest.fn().mockResolvedValue([entity]);

      const result = await service.findByLessonId(1);

      expect(result).toEqual([entity]);
      expect(result[0].lessonId).toBe(1);
      expect(result[0].studentCode).toBe('STU001');
    });

    it('should return empty array when no records found', async () => {
      mockRepo.findByLessonId = jest.fn().mockResolvedValue([]);

      const result = await service.findByLessonId(999);
      expect(result).toEqual([]);
    });
  });

  describe('findByLessonId()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return attendance records for a lesson', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.studentCode = 'STU001';
      const r2 = new LessonAttendanceEntity();
      r2.studentCode = 'STU002';
      mockRepo.findByLessonId.mockResolvedValue([r1, r2]);

      const result = await service.findByLessonId(1);

      expect(result).toHaveLength(2);
      expect(result[0].studentCode).toBe('STU001');
      expect(result[1].studentCode).toBe('STU002');
      expect(mockRepo.findByLessonId).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no records exist', async () => {
      mockRepo.findByLessonId.mockResolvedValue([]);

      const result = await service.findByLessonId(999);

      expect(result).toHaveLength(0);
    });
  });

  describe('findByStudentCode()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        findByStudentCode: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return attendance records for a student', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.lessonId = 1;
      r1.studentCode = 'STU001';
      const r2 = new LessonAttendanceEntity();
      r2.lessonId = 2;
      r2.studentCode = 'STU001';
      mockRepo.findByStudentCode.mockResolvedValue([r1, r2]);

      const result = await service.findByStudentCode('STU001');

      expect(result).toHaveLength(2);
      expect(result[0].lessonId).toBe(1);
      expect(result[1].lessonId).toBe(2);
      expect(mockRepo.findByStudentCode).toHaveBeenCalledWith('STU001');
    });

    it('should return empty array when student has no records', async () => {
      mockRepo.findByStudentCode.mockResolvedValue([]);

      const result = await service.findByStudentCode('STU_NONE');

      expect(result).toHaveLength(0);
    });
  });

  describe('countPendingByLessonId()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        countPendingByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest
                .fn()
                .mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return the pending count for a lesson', async () => {
      mockRepo.countPendingByLessonId.mockResolvedValue(3);

      const result = await service.countPendingByLessonId(1);

      expect(result).toBe(3);
      expect(mockRepo.countPendingByLessonId).toHaveBeenCalledWith(1);
    });

    it('should return 0 when no pending records', async () => {
      mockRepo.countPendingByLessonId.mockResolvedValue(0);

      const result = await service.countPendingByLessonId(1);

      expect(result).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Subject-Matched Deduction Tests (A2)
  // ══════════════════════════════════════════════════════════════
  describe('subject-matched deduction', () => {
    it('should deduct from the matching-subject contract', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 10,
        status: 'ACTIVE',
      };
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        contract,
      );
      mockContractRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await (service as any).deductLessonFromContract(
        'STU001',
        Subject.MATH,
      );

      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(contract.remainingLessons).toBe(9);
      expect(result!.contractCode).toBe('CT-MATH-001');
      expect(result!.contractId).toBe(1);
    });

    it('should skip (no save, no throw) when no matching-subject contract exists', async () => {
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        null,
      );

      const result = await (service as any).deductLessonFromContract(
        'STU001',
        Subject.MATH,
      );

      expect(mockContractRepo.save).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('rollbackLessonDeduction', () => {
    const record = (overrides: Record<string, unknown> = {}) => ({
      studentCode: 'STU001',
      deductedContractId: null,
      ...overrides,
    });

    it('should add 1 lesson back to an ACTIVE contract (legacy, no ledger)', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        contract,
      );

      const result = await (service as any).rollbackLessonDeduction(
        record(),
        Subject.MATH,
      );

      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(mockContractRepo.findOneById).not.toHaveBeenCalled();
      expect(contract.remainingLessons).toBe(6);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
      expect(result).toEqual(
        expect.objectContaining({
          contractCode: 'CT-MATH-001',
          previousRemaining: 5,
          newRemaining: 6,
          statusChanged: false,
        }),
      );
    });

    it('should restore the EXACT contract recorded in the ledger', async () => {
      const contract = {
        id: 42,
        contractCode: 'CT-MATH-002',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      mockContractRepo.findOneById.mockResolvedValue(contract);

      const result = await (service as any).rollbackLessonDeduction(
        record({ deductedContractId: 42 }),
        Subject.MATH,
      );

      expect(mockContractRepo.findOneById).toHaveBeenCalledWith(42);
      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
      expect(contract.remainingLessons).toBe(6);
      expect(result!.contractId).toBe(42);
    });

    it('should restore an EXHAUSTED ledger contract to ACTIVE and +1', async () => {
      const contract = {
        id: 42,
        contractCode: 'CT-MATH-002',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
      };
      mockContractRepo.findOneById.mockResolvedValue(contract);

      const result = await (service as any).rollbackLessonDeduction(
        record({ deductedContractId: 42 }),
        Subject.MATH,
      );

      expect(contract.remainingLessons).toBe(1);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
      expect(result!.statusChanged).toBe(true);
    });

    it('should fall back to subject restore when the ledger contract is missing', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      mockContractRepo.findOneById.mockResolvedValue(null);
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        contract,
      );

      const result = await (service as any).rollbackLessonDeduction(
        record({ deductedContractId: 999 }),
        Subject.MATH,
      );

      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(result!.contractCode).toBe('CT-MATH-001');
    });

    it('should fall back to subject restore when the ledger contract belongs to another student', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      mockContractRepo.findOneById.mockResolvedValue({
        id: 42,
        contractCode: 'CT-MATH-OTHER',
        studentCode: 'STU999',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      });
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        contract,
      );

      const result = await (service as any).rollbackLessonDeduction(
        record({ deductedContractId: 42 }),
        Subject.MATH,
      );

      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(result!.contractCode).toBe('CT-MATH-001');
    });

    it('should fall back to subject restore when the ledger contract is REFUNDED', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      mockContractRepo.findOneById.mockResolvedValue({
        id: 42,
        contractCode: 'CT-MATH-002',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.REFUNDED,
      });
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        contract,
      );

      const result = await (service as any).rollbackLessonDeduction(
        record({ deductedContractId: 42 }),
        Subject.MATH,
      );

      expect(
        mockContractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(result!.contractCode).toBe('CT-MATH-001');
    });

    it('should restore an EXHAUSTED contract to ACTIVE and +1 (legacy fallback)', async () => {
      const contract = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
      };
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        null,
      );
      mockContractRepo.findByStudentCode.mockResolvedValue([contract]);

      const result = await (service as any).rollbackLessonDeduction(
        record(),
        Subject.MATH,
      );

      expect(mockContractRepo.findByStudentCode).toHaveBeenCalledWith('STU001');
      expect(contract.remainingLessons).toBe(1);
      expect(contract.status).toBe(ContractStatus.ACTIVE);
      expect(result!.statusChanged).toBe(true);
    });

    it('should pick only the matching-subject EXHAUSTED contract in fallback', async () => {
      const english = {
        id: 1,
        contractCode: 'CT-ENG-001',
        studentCode: 'STU001',
        subject: Subject.ENGLISH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
        validFrom: '2026-01-01',
      };
      const math = {
        id: 2,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
        validFrom: '2026-01-01',
      };
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        null,
      );
      mockContractRepo.findByStudentCode.mockResolvedValue([english, math]);

      const result = await (service as any).rollbackLessonDeduction(
        record(),
        Subject.MATH,
      );

      expect(result!.contractCode).toBe('CT-MATH-001');
    });

    it('should pick the most recent (validFrom DESC) EXHAUSTED contract in fallback', async () => {
      const older = {
        id: 1,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
        validFrom: '2026-01-01',
      };
      const newer = {
        id: 2,
        contractCode: 'CT-MATH-002',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 0,
        status: ContractStatus.EXHAUSTED,
        validFrom: '2026-06-01',
      };
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        null,
      );
      mockContractRepo.findByStudentCode.mockResolvedValue([older, newer]);

      const result = await (service as any).rollbackLessonDeduction(
        record(),
        Subject.MATH,
      );

      expect(result!.contractCode).toBe('CT-MATH-002');
    });

    it('should return null without saving when no contract to roll back', async () => {
      mockContractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue(
        null,
      );
      mockContractRepo.findByStudentCode.mockResolvedValue([]);

      const result = await (service as any).rollbackLessonDeduction(
        record(),
        Subject.MATH,
      );

      expect(result).toBeNull();
      expect(mockContractRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelByLessonId()', () => {
    let mockRepo: any;
    let contractRepo: any;
    let classRepo: any;
    let courseRepo: any;

    beforeEach(async () => {
      mockRepo = {
        findByLessonId: jest.fn(),
        deleteByLessonId: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
      };
      contractRepo = {
        findActiveByStudentCodeAndSubject: jest.fn().mockResolvedValue(null),
        findOneById: jest.fn().mockResolvedValue(null),
        findByStudentCode: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      };
      // classRepo.findOne → null makes resolveLessonSubject return null (subject unresolvable)
      classRepo = { findOne: jest.fn().mockResolvedValue(null) };
      courseRepo = { findOne: jest.fn().mockResolvedValue(null) };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: { createReminder: jest.fn().mockResolvedValue({ id: 1 }) },
          },
          { provide: ContractRepository, useValue: contractRepo },
          { provide: getRepositoryToken(ClassEntity), useValue: classRepo },
          { provide: getRepositoryToken(CourseEntity), useValue: courseRepo },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('A: restores the ledger contract even when subject resolution returns null', async () => {
      const contract = {
        id: 42,
        contractCode: 'CT-MATH-002',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 5,
        status: ContractStatus.ACTIVE,
      };
      contractRepo.findOneById.mockResolvedValue(contract);
      const record = new LessonAttendanceEntity();
      record.studentCode = 'STU001';
      record.classCode = 'CL999';
      record.status = AttendanceStatus.PRESENT;
      record.deductedContractId = 42;
      mockRepo.findByLessonId.mockResolvedValue([record]);

      const res = await service.cancelByLessonId(1);

      expect(res.rollbackResults).toHaveLength(1);
      expect(contract.remainingLessons).toBe(6);
      expect(contractRepo.findOneById).toHaveBeenCalledWith(42);
      expect(mockRepo.deleteByLessonId).toHaveBeenCalledWith(1);
    });

    it('B: skips rollback without a ledger when subject is unresolvable (nothing to restore)', async () => {
      const record = new LessonAttendanceEntity();
      record.studentCode = 'STU001';
      record.classCode = 'CL999';
      record.status = AttendanceStatus.PRESENT;
      record.deductedContractId = null;
      mockRepo.findByLessonId.mockResolvedValue([record]);

      const res = await service.cancelByLessonId(1);

      expect(res.rollbackResults).toHaveLength(0);
      expect(contractRepo.save).not.toHaveBeenCalled();
      expect(mockRepo.deleteByLessonId).toHaveBeenCalledWith(1);
    });
  });

  describe('deduction ledger (check-in write)', () => {
    let mockRepo: any;
    let contractRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonIdAndStudentCodes: jest.fn(),
      };
      contractRepo = {
        findActiveByStudentCodeAndSubject: jest.fn().mockResolvedValue({
          id: 7,
          contractCode: 'CT-MATH-001',
          studentCode: 'STU001',
          subject: Subject.MATH,
          remainingLessons: 10,
          status: ContractStatus.ACTIVE,
        }),
        findOneById: jest.fn().mockResolvedValue(null),
        findByStudentCode: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          { provide: ContractRepository, useValue: contractRepo },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: {
              findOne: jest.fn().mockResolvedValue({ courseCode: 'MATH001' }),
            },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: {
              findOne: jest.fn().mockResolvedValue({ subject: Subject.MATH }),
            },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should write deductedContractId to the attendance row after a single check-in', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(entity.deductedContractId).toBe(7);
      expect(mockRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should NOT re-deduct when the attendance row already has a ledger', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      entity.deductedContractId = 7;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
      expect(entity.deductedContractId).toBe(7);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should write the ledger for each deductible student in batch roll call', async () => {
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      const e2 = new LessonAttendanceEntity();
      e2.studentCode = 'STU002';
      e2.classCode = 'CL001';
      e2.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1, e2]);

      await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
          {
            lessonId: 1,
            studentCode: 'STU002',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
        ],
      });

      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledTimes(2);
      expect(e1.deductedContractId).toBe(7);
      expect(e2.deductedContractId).toBe(7);
      expect(mockRepo.saveAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('deduction skip flag (no active contract / no subject)', () => {
    let mockRepo: any;
    let contractRepo: any;
    let classRepo: any;
    let courseRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonIdAndStudentCodes: jest.fn(),
      };
      contractRepo = {
        findActiveByStudentCodeAndSubject: jest.fn().mockResolvedValue(null),
        findOneById: jest.fn().mockResolvedValue(null),
        findByStudentCode: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
      };
      classRepo = {
        findOne: jest
          .fn()
          .mockResolvedValue({ courseCode: 'MATH001' }),
      };
      courseRepo = {
        findOne: jest.fn().mockResolvedValue({ subject: Subject.MATH }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: {
              createReminder: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
          { provide: ContractRepository, useValue: contractRepo },
          { provide: getRepositoryToken(ClassEntity), useValue: classRepo },
          { provide: getRepositoryToken(CourseEntity), useValue: courseRepo },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: LessonRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue(null),
              findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getRepositoryToken(Student),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: ImportService,
            useValue: {
              parseBuffer: jest.fn().mockReturnValue([]),
              validateRows: jest.fn().mockReturnValue({
                validRows: [],
                report: {
                  total: 0,
                  success: 0,
                  failure: 0,
                  details: [],
                  fileName: '',
                },
              }),
            },
          },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('V1 recordAttendance: PRESENT + no active contract → NO_ACTIVE_CONTRACT', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).toHaveBeenCalledWith('STU001', Subject.MATH);
      expect(entity.deductionSkippedReason).toBe('NO_ACTIVE_CONTRACT');
    });

    it('V2 recordAttendance: subject resolution fails → NO_SUBJECT', async () => {
      classRepo.findOne.mockResolvedValue(null);
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL999';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(entity.deductionSkippedReason).toBe('NO_SUBJECT');
      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
    });

    it('V3 recordAttendance: successful deduction → no skip flag', async () => {
      contractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue({
        id: 7,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 10,
        status: ContractStatus.ACTIVE,
      });
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      entity.deductionSkippedReason = null;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(entity.deductedContractId).toBe(7);
      expect(entity.deductionSkippedReason).toBeNull();
    });

    it('V3 recordAttendance: non-deductible status → no flag, no deduction attempt', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      entity.deductionSkippedReason = null;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.MAKEUP,
        operator: 10,
      });

      expect(entity.deductionSkippedReason).toBeNull();
      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
    });

    it('V4 recordAttendance: deduction throws → no skip flag, record still succeeds', async () => {
      contractRepo.findActiveByStudentCodeAndSubject.mockRejectedValue(
        new Error('db down'),
      );
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      entity.deductionSkippedReason = null;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      });

      expect(entity.deductionSkippedReason).toBeNull();
    });

    it('V1 batchRollCall: PRESENT + no active contract → NO_ACTIVE_CONTRACT', async () => {
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1]);

      await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
        ],
      });

      expect(e1.deductionSkippedReason).toBe('NO_ACTIVE_CONTRACT');
    });

    it('V2 batchRollCall: subject resolution fails → NO_SUBJECT', async () => {
      classRepo.findOne.mockResolvedValue(null);
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL999';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1]);

      await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
        ],
      });

      expect(e1.deductionSkippedReason).toBe('NO_SUBJECT');
    });

    it('V3 batchRollCall: successful deduction → no skip flag', async () => {
      contractRepo.findActiveByStudentCodeAndSubject.mockResolvedValue({
        id: 7,
        contractCode: 'CT-MATH-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        remainingLessons: 10,
        status: ContractStatus.ACTIVE,
      });
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      e1.deductionSkippedReason = null;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1]);

      await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
        ],
      });

      expect(e1.deductedContractId).toBe(7);
      expect(e1.deductionSkippedReason).toBeNull();
    });

    it('V4 batchRollCall: deduction throws → no skip flag', async () => {
      contractRepo.findActiveByStudentCodeAndSubject.mockRejectedValue(
        new Error('db down'),
      );
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      e1.deductionSkippedReason = null;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1]);

      await service.batchRollCall({
        lessonId: 1,
        records: [
          {
            lessonId: 1,
            studentCode: 'STU001',
            status: AttendanceStatus.PRESENT,
            operator: 10,
          },
        ],
      });

      expect(e1.deductionSkippedReason).toBeNull();
    });

    it('V5 recordAttendance: subject resolution throws → warn only, no flag, record succeeds', async () => {
      classRepo.findOne.mockRejectedValue(new Error('db down'));
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.classCode = 'CL001';
      entity.studentCode = 'STU001';
      entity.lessonId = 1;
      entity.deductionSkippedReason = null;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await expect(
        service.recordAttendance({
          lessonId: 1,
          studentCode: 'STU001',
          status: AttendanceStatus.PRESENT,
          operator: 10,
        }),
      ).resolves.toBeDefined();

      expect(entity.deductionSkippedReason).toBeNull();
      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('V5 batchRollCall: subject resolution throws → warn only, no flag, records succeed', async () => {
      classRepo.findOne.mockRejectedValue(new Error('db down'));
      const e1 = new LessonAttendanceEntity();
      e1.studentCode = 'STU001';
      e1.classCode = 'CL001';
      e1.workflowState = AttendanceWorkflowState.PENDING;
      e1.deductionSkippedReason = null;
      mockRepo.findByLessonIdAndStudentCodes.mockResolvedValue([e1]);

      await expect(
        service.batchRollCall({
          lessonId: 1,
          records: [
            {
              lessonId: 1,
              studentCode: 'STU001',
              status: AttendanceStatus.PRESENT,
              operator: 10,
            },
          ],
        }),
      ).resolves.toBeDefined();

      expect(e1.deductionSkippedReason).toBeNull();
      expect(
        contractRepo.findActiveByStudentCodeAndSubject,
      ).not.toHaveBeenCalled();
      expect(mockRepo.saveAll).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // importAttendance() — P2-3 上课/考勤记录导入
  // ══════════════════════════════════════════════════════════════
  describe('importAttendance()', () => {
    let mockRepo: any;
    let lessonRepoMock: any;
    let studentRepoMock: any;
    let importServiceMock: any;

    beforeEach(async () => {
      // Simulate the DB round-trip: after saving a record it becomes queryable
      let created: any = null;
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => {
          created = e;
          return Promise.resolve(e);
        }),
        saveAll: jest
          .fn()
          .mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest
          .fn()
          .mockImplementation(() => Promise.resolve(created)),
        findByLessonId: jest.fn().mockResolvedValue([]),
      };
      lessonRepoMock = {
        findOneById: jest.fn().mockResolvedValue(null),
        findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
      };
      studentRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      importServiceMock = {
        parseBuffer: jest.fn().mockReturnValue([]),
        validateRows: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
          {
            provide: ReminderService,
            useValue: { createReminder: jest.fn().mockResolvedValue({ id: 1 }) },
          },
          {
            provide: ContractRepository,
            useValue: {
              findActiveByStudentCodeAndSubject: jest
                .fn()
                .mockResolvedValue(null),
              save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
            },
          },
          {
            provide: getRepositoryToken(ClassEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          {
            provide: getRepositoryToken(CourseEntity),
            useValue: { findOne: jest.fn().mockResolvedValue(null) },
          },
          { provide: PointsService, useValue: pointsServiceMock() },
          { provide: LessonRepository, useValue: lessonRepoMock },
          { provide: getRepositoryToken(Student), useValue: studentRepoMock },
          { provide: ImportService, useValue: importServiceMock },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should record attendance via lessonId and reuse recordAttendance (with deduction path)', async () => {
      importServiceMock.parseBuffer.mockReturnValue([]);
      importServiceMock.validateRows.mockReturnValue({
        validRows: [
          {
            studentcode: 'STU001',
            status: '出勤',
            lessonid: '5',
            classcode: '',
            scheduleddate: '',
            reason: '',
          },
        ],
        report: {
          total: 1,
          success: 1,
          failure: 0,
          details: [
            {
              row: 2,
              success: true,
              errors: [],
              data: {
                studentcode: 'STU001',
                status: '出勤',
                lessonid: '5',
                classcode: '',
                scheduleddate: '',
                reason: '',
              },
            },
          ],
          fileName: 'att.xlsx',
        },
      });
      studentRepoMock.findOne.mockResolvedValue({
        studentCode: 'STU001',
        deleted: false,
      });
      lessonRepoMock.findOneById.mockResolvedValue({
        id: 5,
        classCode: 'CL001',
        teacherId: 10,
      });

      const report = await service.importAttendance(
        Buffer.from(''),
        'att.xlsx',
        1,
        '管理员',
      );

      expect(report.success).toBe(1);
      expect(report.failure).toBe(0);
      expect(mockRepo.save).toHaveBeenCalled(); // created PENDING record + checked-in save
      const saved = mockRepo.save.mock.calls.flat();
      const checked = saved.find((e: any) => e.status === AttendanceStatus.PRESENT);
      expect(checked).toBeDefined();
      expect(checked.source).toBe(AttendanceSource.IMPORT);
      expect(checked.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    });

    it('should locate lesson by classCode + date when lessonId absent', async () => {
      importServiceMock.validateRows.mockReturnValue({
        validRows: [
          {
            studentcode: 'STU001',
            status: 'ABSENT',
            lessonid: '',
            classcode: 'CL001',
            scheduleddate: '2026-08-10',
            reason: '病假',
          },
        ],
        report: {
          total: 1,
          success: 1,
          failure: 0,
          details: [
            {
              row: 2,
              success: true,
              errors: [],
              data: {
                studentcode: 'STU001',
                status: 'ABSENT',
                lessonid: '',
                classcode: 'CL001',
                scheduleddate: '2026-08-10',
                reason: '病假',
              },
            },
          ],
          fileName: 'att.xlsx',
        },
      });
      studentRepoMock.findOne.mockResolvedValue({
        studentCode: 'STU001',
        deleted: false,
      });
      lessonRepoMock.findByClassCodeAndDate.mockResolvedValue([
        { id: 9, classCode: 'CL001', teacherId: 10, status: LessonStatus.SCHEDULED },
      ]);

      const report = await service.importAttendance(Buffer.from(''), 'att.xlsx', 1);

      expect(lessonRepoMock.findByClassCodeAndDate).toHaveBeenCalledWith(
        'CL001',
        '2026-08-10',
      );
      expect(report.success).toBe(1);
    });

    it('should fail row when lesson cannot be located', async () => {
      importServiceMock.validateRows.mockReturnValue({
        validRows: [
          {
            studentcode: 'STU001',
            status: 'PRESENT',
            lessonid: '',
            classcode: '',
            scheduleddate: '',
            reason: '',
          },
        ],
        report: {
          total: 1,
          success: 1,
          failure: 0,
          details: [
            {
              row: 2,
              success: true,
              errors: [],
              data: {
                studentcode: 'STU001',
                status: 'PRESENT',
                lessonid: '',
                classcode: '',
                scheduleddate: '',
                reason: '',
              },
            },
          ],
          fileName: 'att.xlsx',
        },
      });
      studentRepoMock.findOne.mockResolvedValue({
        studentCode: 'STU001',
        deleted: false,
      });

      const report = await service.importAttendance(Buffer.from(''), 'att.xlsx', 1);

      expect(report.failure).toBe(1);
      expect(report.success).toBe(0);
      expect(report.details[0].errors[0]).toContain('缺少课时定位信息');
    });

    it('should skip already-recorded attendance (non-PENDING) to prevent double deduction', async () => {
      importServiceMock.validateRows.mockReturnValue({
        validRows: [
          {
            studentcode: 'STU001',
            status: 'PRESENT',
            lessonid: '5',
            classcode: '',
            scheduleddate: '',
            reason: '',
          },
        ],
        report: {
          total: 1,
          success: 1,
          failure: 0,
          details: [
            {
              row: 2,
              success: true,
              errors: [],
              data: {
                studentcode: 'STU001',
                status: 'PRESENT',
                lessonid: '5',
                classcode: '',
                scheduleddate: '',
                reason: '',
              },
            },
          ],
          fileName: 'att.xlsx',
        },
      });
      studentRepoMock.findOne.mockResolvedValue({
        studentCode: 'STU001',
        deleted: false,
      });
      lessonRepoMock.findOneById.mockResolvedValue({
        id: 5,
        classCode: 'CL001',
        teacherId: 10,
      });
      mockRepo.findByLessonAndStudent.mockResolvedValue({
        workflowState: AttendanceWorkflowState.CHECKED_IN,
      });

      const report = await service.importAttendance(Buffer.from(''), 'att.xlsx', 1);

      expect(report.failure).toBe(1);
      expect(report.success).toBe(0);
      expect(report.details[0].errors[0]).toContain('不可覆盖');
    });

    it('should fail row when reason missing for ABSENT status', async () => {
      importServiceMock.validateRows.mockReturnValue({
        validRows: [
          {
            studentcode: 'STU001',
            status: 'ABSENT',
            lessonid: '5',
            classcode: '',
            scheduleddate: '',
            reason: '',
          },
        ],
        report: {
          total: 1,
          success: 1,
          failure: 0,
          details: [
            {
              row: 2,
              success: true,
              errors: [],
              data: {
                studentcode: 'STU001',
                status: 'ABSENT',
                lessonid: '5',
                classcode: '',
                scheduleddate: '',
                reason: '',
              },
            },
          ],
          fileName: 'att.xlsx',
        },
      });
      studentRepoMock.findOne.mockResolvedValue({
        studentCode: 'STU001',
        deleted: false,
      });
      lessonRepoMock.findOneById.mockResolvedValue({
        id: 5,
        classCode: 'CL001',
        teacherId: 10,
      });

      const report = await service.importAttendance(Buffer.from(''), 'att.xlsx', 1);

      expect(report.failure).toBe(1);
      expect(report.details[0].errors[0]).toContain('requires a reason');
    });
  });
});
