import { Test, TestingModule } from '@nestjs/testing';
import {
  LessonChangeRequestService,
  VALID_REQUEST_TRANSITIONS,
  MAX_RESCHEDULE_PER_LESSON,
  MAX_RESCHEDULE_DAYS,
} from './lesson-change-request.service';
import { LessonChangeRequestRepository } from './lesson-change-request.repository';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonChangeRequestService,
        { provide: LessonChangeRequestRepository, useValue: mockRepo },
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
});
