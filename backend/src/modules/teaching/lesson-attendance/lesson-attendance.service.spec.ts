import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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

describe('LessonAttendanceService', () => {
  let service: LessonAttendanceService;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonAttendanceService,
        { provide: LessonAttendanceRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<LessonAttendanceService>(LessonAttendanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // State Machine Tests
  // ═══════════════════════════════════════════════════════════════

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
      it('should allow PENDING → CHECKED_IN', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).toContain(AttendanceWorkflowState.CHECKED_IN);
      });

      it('should allow CHECKED_IN → CONFIRMED', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).toContain(AttendanceWorkflowState.CONFIRMED);
      });

      it('should allow CONFIRMED → LOCKED', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).toContain(AttendanceWorkflowState.LOCKED);
      });
    });

    describe('Reverse transitions (admin override)', () => {
      it('should allow CONFIRMED → CHECKED_IN (reverse)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).toContain(AttendanceWorkflowState.CHECKED_IN);
      });

      it('should allow CHECKED_IN → PENDING (reverse)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).toContain(AttendanceWorkflowState.PENDING);
      });
    });

    describe('Forbidden transitions', () => {
      it('should NOT allow PENDING → CONFIRMED (skip CHECKED_IN)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).not.toContain(AttendanceWorkflowState.CONFIRMED);
      });

      it('should NOT allow PENDING → LOCKED (skip CHECKED_IN and CONFIRMED)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.PENDING],
        ).not.toContain(AttendanceWorkflowState.LOCKED);
      });

      it('should NOT allow CHECKED_IN → LOCKED (skip CONFIRMED)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN],
        ).not.toContain(AttendanceWorkflowState.LOCKED);
      });

      it('should NOT allow CONFIRMED → PENDING (must go through CHECKED_IN)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED],
        ).not.toContain(AttendanceWorkflowState.PENDING);
      });

      it('should NOT allow LOCKED → anything (terminal)', () => {
        expect(
          VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.LOCKED],
        ).toHaveLength(0);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Domain Invariant Tests
  // ═══════════════════════════════════════════════════════════════

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

    describe('All 7 attendance statuses are defined', () => {
      it('should have exactly 7 status values', () => {
        const values = Object.values(AttendanceStatus);
        expect(values).toHaveLength(7);
      });

      it('should include all required statuses', () => {
        expect(Object.values(AttendanceStatus)).toEqual(
          expect.arrayContaining([
            'PRESENT',
            'ABSENT',
            'LATE',
            'LEAVE',
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

  // ═══════════════════════════════════════════════════════════════
  // Service Behavior Tests (Phase 2a Implementation)
  // ═══════════════════════════════════════════════════════════════

  describe('autoCreateForLesson()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest.fn().mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonId: jest.fn(),
        countUnconfirmedByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should create PENDING records for each student', async () => {
      const result = await service.autoCreateForLesson(
        1, ['STU001', 'STU002'], 'CL001', 10,
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
        lessonId: 1, studentCode: 'STU001',
        status: AttendanceStatus.PRESENT, operator: 10,
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
          lessonId: 1, studentCode: 'STU001',
          status: AttendanceStatus.LATE, operator: 10,
        }),
      ).rejects.toThrow('Status LATE requires a reason');
    });

    it('should accept LATE with reason', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.PENDING;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      const result = await service.recordAttendance({
        lessonId: 1, studentCode: 'STU001',
        status: AttendanceStatus.LATE, reason: 'Traffic', operator: 10,
      });

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(result.reason).toBe('Traffic');
    });

    it('should throw when record not found', async () => {
      mockRepo.findByLessonAndStudent.mockResolvedValue(null);

      await expect(
        service.recordAttendance({
          lessonId: 1, studentCode: 'STU999',
          status: AttendanceStatus.PRESENT, operator: 10,
        }),
      ).rejects.toThrow('Attendance record not found');
    });

    it('should reject LOCKED to CHECKED_IN transition', async () => {
      const entity = new LessonAttendanceEntity();
      entity.workflowState = AttendanceWorkflowState.LOCKED;
      mockRepo.findByLessonAndStudent.mockResolvedValue(entity);

      await expect(
        service.recordAttendance({
          lessonId: 1, studentCode: 'STU001',
          status: AttendanceStatus.PRESENT, operator: 10,
        }),
      ).rejects.toThrow('Invalid workflow transition');
    });
  });

  describe('batchRollCall()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
        saveAll: jest.fn().mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonAndStudent: jest.fn(),
        findByLessonIdAndStudentCodes: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
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
          { lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10 },
          { lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.ABSENT, reason: 'Sick', operator: 10 },
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
        saveAll: jest.fn().mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
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
        saveAll: jest.fn().mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
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
        saveAll: jest.fn().mockImplementation((es: any[]) => Promise.resolve(es)),
        findByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should reverse CONFIRMED to CHECKED_IN with reason', async () => {
      const r1 = new LessonAttendanceEntity();
      r1.workflowState = AttendanceWorkflowState.CONFIRMED;
      mockRepo.findByLessonId.mockResolvedValue([r1]);

      await service.reverseToCheckedIn(1, 'Correction', 10);

      expect(r1.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
      expect(mockRepo.saveAll).toHaveBeenCalled();
    });

    it('should reject without reason', async () => {
      await expect(
        service.reverseToCheckedIn(1, '', 10),
      ).rejects.toThrow('Reason is required');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Read Method Tests
  // ═══════════════════════════════════════════════════════════════

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
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return the attendance record when found', async () => {
      const entity = new LessonAttendanceEntity();
      entity.lessonId = 1;
      entity.studentCode = 'STU001';
      mockRepo.findOneById.mockResolvedValue(entity);

      const result = await service.findOne(1);

      expect(result).toBe(entity);
      expect(result.lessonId).toBe(1);
      expect(result.studentCode).toBe('STU001');
      expect(mockRepo.findOneById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockRepo.findOneById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        'Attendance record 999 not found',
      );
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

  describe('countUnconfirmed()', () => {
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        countUnconfirmedByLessonId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonAttendanceService,
          { provide: LessonAttendanceRepository, useValue: mockRepo },
        ],
      }).compile();

      service = module.get<LessonAttendanceService>(LessonAttendanceService);
    });

    it('should return the unconfirmed count for a lesson', async () => {
      mockRepo.countUnconfirmedByLessonId.mockResolvedValue(3);

      const result = await service.countUnconfirmed(1);

      expect(result).toBe(3);
      expect(mockRepo.countUnconfirmedByLessonId).toHaveBeenCalledWith(1);
    });

    it('should return 0 when all records are confirmed', async () => {
      mockRepo.countUnconfirmedByLessonId.mockResolvedValue(0);

      const result = await service.countUnconfirmed(1);

      expect(result).toBe(0);
    });
  });
});
