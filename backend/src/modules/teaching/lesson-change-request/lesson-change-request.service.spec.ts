import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LessonChangeRequestService,
  VALID_REQUEST_TRANSITIONS,
  MAX_RESCHEDULE_PER_LESSON,
  MAX_RESCHEDULE_DAYS,
  CreateChangeRequestInput,
} from './lesson-change-request.service';
import { LessonChangeRequestRepository } from './lesson-change-request.repository';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';
import { LessonService } from '../lesson/lesson.service';

describe('LessonChangeRequestService', () => {
  let service: LessonChangeRequestService;

  beforeEach(async () => {
    const mockRepo = {
      save: jest.fn(),
      findOneById: jest.fn(),
      findByLessonId: jest.fn(),
      countPendingByLessonAndType: jest.fn(),
      countRescheduleByLessonId: jest.fn(),
    };

    const mockLessonService = {
      findOne: jest.fn(),
      updateStatus: jest.fn(),
      lessonRepo: {
        save: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonChangeRequestService,
        { provide: LessonChangeRequestRepository, useValue: mockRepo },
        { provide: LessonService, useValue: mockLessonService },
      ],
    }).compile();

    service = module.get<LessonChangeRequestService>(
      LessonChangeRequestService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // State Machine Tests
  // ═══════════════════════════════════════════════════════════════

  describe('Request Lifecycle State Machine', () => {
    describe('VALID_REQUEST_TRANSITIONS definition', () => {
      it('should define transitions for all 4 request statuses', () => {
        expect(Object.keys(VALID_REQUEST_TRANSITIONS)).toHaveLength(4);
        expect(VALID_REQUEST_TRANSITIONS).toHaveProperty(
          ChangeRequestStatus.PENDING,
        );
        expect(VALID_REQUEST_TRANSITIONS).toHaveProperty(
          ChangeRequestStatus.APPROVED,
        );
        expect(VALID_REQUEST_TRANSITIONS).toHaveProperty(
          ChangeRequestStatus.REJECTED,
        );
        expect(VALID_REQUEST_TRANSITIONS).toHaveProperty(
          ChangeRequestStatus.EXECUTED,
        );
      });

      it('PENDING should transition to APPROVED or REJECTED', () => {
        const transitions =
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.PENDING];
        expect(transitions).toContain(ChangeRequestStatus.APPROVED);
        expect(transitions).toContain(ChangeRequestStatus.REJECTED);
        expect(transitions).toHaveLength(2);
      });

      it('APPROVED should transition to EXECUTED or REJECTED', () => {
        const transitions =
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.APPROVED];
        expect(transitions).toContain(ChangeRequestStatus.EXECUTED);
        expect(transitions).toContain(ChangeRequestStatus.REJECTED);
        expect(transitions).toHaveLength(2);
      });

      it('REJECTED should be terminal (no transitions out)', () => {
        const transitions =
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.REJECTED];
        expect(transitions).toEqual([]);
      });

      it('EXECUTED should be terminal (no transitions out)', () => {
        const transitions =
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.EXECUTED];
        expect(transitions).toEqual([]);
      });
    });

    describe('Forward transitions', () => {
      it('should allow PENDING → APPROVED', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.PENDING],
        ).toContain(ChangeRequestStatus.APPROVED);
      });

      it('should allow PENDING → REJECTED', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.PENDING],
        ).toContain(ChangeRequestStatus.REJECTED);
      });

      it('should allow APPROVED → EXECUTED', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.APPROVED],
        ).toContain(ChangeRequestStatus.EXECUTED);
      });

      it('should allow APPROVED → REJECTED (admin reversal before execution)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.APPROVED],
        ).toContain(ChangeRequestStatus.REJECTED);
      });
    });

    describe('Forbidden transitions', () => {
      it('should NOT allow PENDING → EXECUTED (must go through APPROVED)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.PENDING],
        ).not.toContain(ChangeRequestStatus.EXECUTED);
      });

      it('should NOT allow REJECTED → anything (terminal)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.REJECTED],
        ).toHaveLength(0);
      });

      it('should NOT allow EXECUTED → anything (terminal)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.EXECUTED],
        ).toHaveLength(0);
      });

      it('should NOT allow REJECTED → PENDING (cannot retry)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.REJECTED],
        ).not.toContain(ChangeRequestStatus.PENDING);
      });

      it('should NOT allow EXECUTED → APPROVED (cannot undo)', () => {
        expect(
          VALID_REQUEST_TRANSITIONS[ChangeRequestStatus.EXECUTED],
        ).not.toContain(ChangeRequestStatus.APPROVED);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Domain Invariant Tests
  // ═══════════════════════════════════════════════════════════════

  describe('Domain Invariants', () => {
    describe('All 4 request types are defined', () => {
      it('should have exactly 4 request type values', () => {
        const values = Object.values(ChangeRequestType);
        expect(values).toHaveLength(4);
      });

      it('should include all required request types', () => {
        expect(Object.values(ChangeRequestType)).toEqual(
          expect.arrayContaining([
            'RESCHEDULE',
            'TEACHER_CHANGE',
            'CANCEL',
            'REOPEN',
          ]),
        );
      });
    });

    describe('All 4 request statuses are defined', () => {
      it('should have exactly 4 status values', () => {
        const values = Object.values(ChangeRequestStatus);
        expect(values).toHaveLength(4);
      });

      it('should include all required statuses', () => {
        expect(Object.values(ChangeRequestStatus)).toEqual(
          expect.arrayContaining([
            'PENDING',
            'APPROVED',
            'REJECTED',
            'EXECUTED',
          ]),
        );
      });
    });

    describe('Invariant-CR002: One active request per lesson per type', () => {
      it('MAX_RESCHEDULE_PER_LESSON should be 3', () => {
        expect(MAX_RESCHEDULE_PER_LESSON).toBe(3);
      });

      it('MAX_RESCHEDULE_DAYS should be 7', () => {
        expect(MAX_RESCHEDULE_DAYS).toBe(7);
      });
    });

    describe('Entity field structure', () => {
      it('entity should be instantiable', () => {
        const entity = new LessonChangeRequestEntity();
        expect(entity).toBeDefined();
      });

      it('should have all required enum values for request types', () => {
        // Verify enum completeness
        expect(ChangeRequestType.RESCHEDULE).toBe('RESCHEDULE');
        expect(ChangeRequestType.TEACHER_CHANGE).toBe('TEACHER_CHANGE');
        expect(ChangeRequestType.CANCEL).toBe('CANCEL');
        expect(ChangeRequestType.REOPEN).toBe('REOPEN');
      });

      it('should have all required enum values for statuses', () => {
        expect(ChangeRequestStatus.PENDING).toBe('PENDING');
        expect(ChangeRequestStatus.APPROVED).toBe('APPROVED');
        expect(ChangeRequestStatus.REJECTED).toBe('REJECTED');
        expect(ChangeRequestStatus.EXECUTED).toBe('EXECUTED');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Service Method Tests
  // ═══════════════════════════════════════════════════════════════

  describe('createRequest', () => {
    it('should create a RESCHEDULE request successfully', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.countRescheduleByLessonId.mockResolvedValue(0);
      mockRepo.save.mockImplementation(async (e) => e);

      const input: CreateChangeRequestInput = {
        lessonId: 1,
        requestType: ChangeRequestType.RESCHEDULE,
        requestedBy: 1,
        reason: '需要调课',
        previousDate: '2026-07-20',
        newDate: '2026-07-22',
      };

      const result = await service.createRequest(input);
      expect(result.lessonId).toBe(1);
      expect(result.requestType).toBe(ChangeRequestType.RESCHEDULE);
      expect(result.status).toBe(ChangeRequestStatus.PENDING);
      expect(result.reason).toBe('需要调课');
      expect(result.previousDate).toBe('2026-07-20');
      expect(result.newDate).toBe('2026-07-22');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should create a TEACHER_CHANGE request successfully', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.save.mockImplementation(async (e) => e);

      const input: CreateChangeRequestInput = {
        lessonId: 2,
        requestType: ChangeRequestType.TEACHER_CHANGE,
        requestedBy: 1,
        reason: '需要换老师',
        previousTeacherId: 10,
        newTeacherId: 20,
      };

      const result = await service.createRequest(input);
      expect(result.lessonId).toBe(2);
      expect(result.requestType).toBe(ChangeRequestType.TEACHER_CHANGE);
      expect(result.status).toBe(ChangeRequestStatus.PENDING);
      expect(result.previousTeacherId).toBe(10);
      expect(result.newTeacherId).toBe(20);
    });

    it('should throw BadRequestException when reason is empty', async () => {
      await expect(
        service.createRequest({
          lessonId: 1,
          requestType: ChangeRequestType.RESCHEDULE,
          requestedBy: 1,
          reason: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reschedule limit exceeded', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.countRescheduleByLessonId.mockResolvedValue(3);

      await expect(
        service.createRequest({
          lessonId: 1,
          requestType: ChangeRequestType.RESCHEDULE,
          requestedBy: 1,
          reason: '需要调课',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve a PENDING request', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.PENDING;
      mockRepo.findOneById.mockResolvedValue(entity);
      mockRepo.save.mockImplementation(async (e) => e);

      const result = await service.approve(1, 5);
      expect(result.status).toBe(ChangeRequestStatus.APPROVED);
      expect(result.approvedBy).toBe(5);
      expect(result.approvedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when request does not exist', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.findOneById.mockResolvedValue(null);

      await expect(service.approve(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already approved', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.APPROVED;
      mockRepo.findOneById.mockResolvedValue(entity);

      await expect(service.approve(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject a PENDING request', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.PENDING;
      mockRepo.findOneById.mockResolvedValue(entity);
      mockRepo.save.mockImplementation(async (e) => e);

      const result = await service.reject(1, 5, '理由不充分');
      expect(result.status).toBe(ChangeRequestStatus.REJECTED);
      expect(result.rejectionReason).toBe('理由不充分');
    });

    it('should throw BadRequestException when rejection reason is empty', async () => {
      await expect(service.reject(1, 1, '')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when already executed', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.EXECUTED;
      mockRepo.findOneById.mockResolvedValue(entity);

      await expect(service.reject(1, 1, '某理由')).rejects.toThrow(BadRequestException);
    });
  });

  describe('execute', () => {
    it('should execute an APPROVED RESCHEDULE request', async () => {
      const mockRepo = (service as any).requestRepo;
      const mockLessonService = (service as any).lessonService;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.APPROVED;
      entity.requestType = ChangeRequestType.RESCHEDULE;
      entity.lessonId = 10;
      entity.newDate = '2026-07-25';
      entity.newStartTime = '10:00';
      entity.newEndTime = '11:00';
      mockRepo.findOneById.mockResolvedValue(entity);
      mockRepo.save.mockImplementation(async (e) => e);

      const mockLesson = { id: 10, scheduledDate: '2026-07-20', startTime: '09:00', endTime: '10:00' };
      mockLessonService.findOne.mockResolvedValue(mockLesson);
      mockLessonService.lessonRepo.save.mockResolvedValue(mockLesson);

      const result = await service.execute(1, 5);
      expect(result.status).toBe(ChangeRequestStatus.EXECUTED);
      expect(result.executedBy).toBe(5);
      expect(result.executedAt).toBeInstanceOf(Date);
      expect(mockLesson.scheduledDate).toBe('2026-07-25');
      expect(mockLesson.startTime).toBe('10:00');
      expect(mockLesson.endTime).toBe('11:00');
    });

    it('should execute an APPROVED CANCEL request', async () => {
      const mockRepo = (service as any).requestRepo;
      const mockLessonService = (service as any).lessonService;
      const entity = new LessonChangeRequestEntity();
      entity.id = 2;
      entity.status = ChangeRequestStatus.APPROVED;
      entity.requestType = ChangeRequestType.CANCEL;
      entity.lessonId = 10;
      entity.reason = '测试取消';
      mockRepo.findOneById.mockResolvedValue(entity);
      mockRepo.save.mockImplementation(async (e) => e);
      mockLessonService.updateStatus.mockResolvedValue({ id: 10 });

      const result = await service.execute(2, 5);
      expect(result.status).toBe(ChangeRequestStatus.EXECUTED);
      expect(mockLessonService.updateStatus).toHaveBeenCalledWith(10, 'CANCELLED', 5, '测试取消');
    });

    it('should throw BadRequestException when not approved', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      entity.status = ChangeRequestStatus.PENDING;
      mockRepo.findOneById.mockResolvedValue(entity);

      await expect(service.execute(1, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return entity when found', async () => {
      const mockRepo = (service as any).requestRepo;
      const entity = new LessonChangeRequestEntity();
      entity.id = 1;
      mockRepo.findOneById.mockResolvedValue(entity);

      const result = await service.findOne(1);
      expect(result).toBe(entity);
    });

    it('should throw NotFoundException when not found', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.findOneById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByLessonId', () => {
    it('should return an array of requests', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.findByLessonId.mockResolvedValue([new LessonChangeRequestEntity()]);

      const result = await service.findByLessonId(1);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no requests exist', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.findByLessonId.mockResolvedValue([]);

      const result = await service.findByLessonId(999);
      expect(result).toEqual([]);
    });
  });

  describe('hasExceededRescheduleLimit', () => {
    it('should return true when count >= MAX', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.countRescheduleByLessonId.mockResolvedValue(3);

      const result = await service.hasExceededRescheduleLimit(1);
      expect(result).toBe(true);
    });

    it('should return false when count < MAX', async () => {
      const mockRepo = (service as any).requestRepo;
      mockRepo.countRescheduleByLessonId.mockResolvedValue(1);

      const result = await service.hasExceededRescheduleLimit(1);
      expect(result).toBe(false);
    });
  });
});
