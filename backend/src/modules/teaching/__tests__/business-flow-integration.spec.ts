/**
 * Phase 6 Batch 6.1 — 业务场景测试补强
 *
 * Business Flow Integration Tests
 * Validates the complete chain:
 * Student → Contract → Course → Class → Enrollment → Lesson → Attendance → Contract Deduction → Data Consistency
 *
 * Strategy:
 * - Real LessonAttendanceService (the core integration point)
 * - Mock repositories (no database required)
 * - Mock ContractRepository to verify deduction logic
 * - Tests focus on INTEGRATION between attendance recording and contract deduction
 *
 * Key business rules validated:
 * 1. Contract.totalLessons = remainingLessons on creation
 * 2. DEDUCTIBLE_STATUSES = PRESENT, LATE, ONLINE, OFFLINE
 * 3. Attendance PENDING → CHECKED_IN triggers deduction if status is deductible
 * 4. Deduction: contract.remainingLessons -= 1
 * 5. When remainingLessons = 0, contract status → EXHAUSTED
 * 6. LATE/LEAVE/ABSENT require reason
 * 7. Workflow: PENDING → CHECKED_IN → CONFIRMED → LOCKED
 * 8. ABSENT/LEAVE/MAKEUP do NOT deduct
 */

import { LessonAttendanceService } from '../lesson-attendance/lesson-attendance.service';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';
import { AttendanceStatus, DEDUCTIBLE_STATUSES } from '../lesson-attendance/enums/attendance-status.enum';
import { AttendanceWorkflowState } from '../lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '../lesson-attendance/enums/attendance-source.enum';
import { ContractEntity } from '../contract/contract.entity';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ═══════════════════════════════════════════════════════════════
// Test Helpers — Shared mock factories
// ═══════════════════════════════════════════════════════════════

/** Creates a mock ContractRepository with configurable behavior */
function createMockContractRepo(options?: {
  activeContract?: ContractEntity | null;
}) {
  const store: ContractEntity[] = [];

  return {
    _store: store,
    save: jest.fn().mockImplementation((entity: ContractEntity) => {
      const idx = store.findIndex(c => c.contractCode === entity.contractCode);
      if (idx >= 0) {
        store[idx] = { ...entity };
      } else {
        store.push({ ...entity });
      }
      return Promise.resolve({ ...entity });
    }),
    findOneById: jest.fn().mockImplementation((id: number) => {
      return Promise.resolve(store.find(c => c.id === id) || null);
    }),
    findOneByCode: jest.fn().mockImplementation((code: string) => {
      return Promise.resolve(store.find(c => c.contractCode === code) || null);
    }),
    findOneActiveByStudentCode: jest.fn().mockImplementation((studentCode: string) => {
      if (options?.activeContract !== undefined) {
        return Promise.resolve(options.activeContract);
      }
      const found = store.find(
        c => c.studentCode === studentCode && c.status === ContractStatus.ACTIVE,
      );
      return Promise.resolve(found ? { ...found } : null);
    }),
    findByStudentCode: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

/** Creates a mock LessonAttendanceRepository */
function createMockAttendanceRepo() {
  const records: LessonAttendanceEntity[] = [];

  return {
    _records: records,
    save: jest.fn().mockImplementation((entity: LessonAttendanceEntity) => {
      const idx = records.findIndex(
        r => r.lessonId === entity.lessonId && r.studentCode === entity.studentCode,
      );
      if (idx >= 0) {
        records[idx] = { ...entity };
      } else {
        records.push({ ...entity });
      }
      return Promise.resolve({ ...entity });
    }),
    saveAll: jest.fn().mockImplementation((entities: LessonAttendanceEntity[]) => {
      for (const entity of entities) {
        const idx = records.findIndex(
          r => r.lessonId === entity.lessonId && r.studentCode === entity.studentCode,
        );
        if (idx >= 0) {
          records[idx] = { ...entity };
        } else {
          records.push({ ...entity });
        }
      }
      return Promise.resolve(entities.map(e => ({ ...e })));
    }),
    findByLessonId: jest.fn().mockImplementation((lessonId: number) => {
      return Promise.resolve(
        records.filter(r => r.lessonId === lessonId).map(r => ({ ...r })),
      );
    }),
    findByLessonAndStudent: jest.fn().mockImplementation(
      (lessonId: number, studentCode: string) => {
        const found = records.find(
          r => r.lessonId === lessonId && r.studentCode === studentCode,
        );
        return Promise.resolve(found ? { ...found } : null);
      },
    ),
    findByLessonIdAndStudentCodes: jest.fn().mockImplementation(
      (lessonId: number, studentCodes: string[]) => {
        return Promise.resolve(
          records
            .filter(r => r.lessonId === lessonId && studentCodes.includes(r.studentCode))
            .map(r => ({ ...r })),
        );
      },
    ),
    countUnconfirmedByLessonId: jest.fn().mockImplementation((lessonId: number) => {
      const count = records.filter(
        r => r.lessonId === lessonId && r.workflowState !== AttendanceWorkflowState.LOCKED,
      ).length;
      return Promise.resolve(count);
    }),
    countPendingByLessonId: jest.fn().mockImplementation((lessonId: number) => {
      const count = records.filter(
        r => r.lessonId === lessonId && r.workflowState === AttendanceWorkflowState.PENDING,
      ).length;
      return Promise.resolve(count);
    }),
    findByStudentCode: jest.fn().mockResolvedValue([]),
  };
}

/** Creates a mock ReminderService */
function createMockReminderService() {
  return {
    createReminder: jest.fn().mockResolvedValue({ id: 1 }),
  };
}

/** Creates a fully wired LessonAttendanceService with mock dependencies */
function createAttendanceService(
  mockAttendanceRepo: ReturnType<typeof createMockAttendanceRepo>,
  mockContractRepo: ReturnType<typeof createMockContractRepo>,
  mockReminderService?: ReturnType<typeof createMockReminderService>,
) {
  return new LessonAttendanceService(
    mockAttendanceRepo as any,
    (mockReminderService || createMockReminderService()) as any,
    mockContractRepo as any,
  );
}

/** Helper: create a contract entity */
function createContractEntity(overrides: Partial<ContractEntity>): ContractEntity {
  const contract = new ContractEntity();
  contract.id = overrides.id ?? 1;
  contract.contractCode = overrides.contractCode ?? 'CT-20260101-001';
  contract.studentCode = overrides.studentCode ?? 'STU001';
  contract.subject = overrides.subject ?? Subject.MATH;
  contract.totalLessons = overrides.totalLessons ?? 10;
  contract.remainingLessons = overrides.remainingLessons ?? 10;
  contract.status = overrides.status ?? ContractStatus.ACTIVE;
  contract.validFrom = overrides.validFrom ?? '2026-01-01';
  contract.validTo = overrides.validTo ?? null;
  contract.unitPrice = overrides.unitPrice ?? null;
  contract.totalAmount = overrides.totalAmount ?? null;
  contract.note = overrides.note ?? null;
  contract.tags = overrides.tags ?? null;
  contract.createdBy = overrides.createdBy ?? 0;
  contract.createdAt = overrides.createdAt ?? new Date();
  return contract;
}

// ═══════════════════════════════════════════════════════════════
// Scenario 1: Happy Path — Full Business Flow
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 1 — Happy Path', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should complete full flow: auto-create → record PRESENT → deduct contract', async () => {
    // ── Step 1: Setup — Contract with 10 lessons ──
    const contract = createContractEntity({
      contractCode: 'CT-HAPPY-001',
      studentCode: 'STU001',
      totalLessons: 10,
      remainingLessons: 10,
      status: ContractStatus.ACTIVE,
    });
    // Pre-populate the contract repo store
    contractRepo._store.push({ ...contract });

    // ── Step 2: Auto-create attendance records for 3 enrolled students ──
    const enrolledStudents = ['STU001', 'STU002', 'STU003'];
    const createdRecords = await service.autoCreateForLesson(1, enrolledStudents, 'CL001', 10);

    expect(createdRecords).toHaveLength(3);
    expect(createdRecords.every(r => r.workflowState === AttendanceWorkflowState.PENDING)).toBe(true);
    expect(createdRecords.every(r => r.status === null)).toBe(true);
    expect(attendanceRepo.saveAll).toHaveBeenCalledTimes(1);

    // ── Step 3: Record attendance PRESENT for STU001 ──
    const recorded = await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    // Verify attendance record updated
    expect(recorded.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    expect(recorded.status).toBe(AttendanceStatus.PRESENT);
    expect(recorded.checkInTime).toBeDefined();
    expect(recorded.operator).toBe(10);

    // Verify contract deduction happened
    expect(contractRepo.findOneActiveByStudentCode).toHaveBeenCalledWith('STU001');
    expect(contractRepo.save).toHaveBeenCalled();

    // Verify the saved contract has remainingLessons decremented
    const savedContract = contractRepo._store.find(c => c.contractCode === 'CT-HAPPY-001');
    expect(savedContract).toBeDefined();
    expect(savedContract!.remainingLessons).toBe(9);
    expect(savedContract!.status).toBe(ContractStatus.ACTIVE); // still active, not exhausted
  });

  it('should maintain data consistency across the flow', async () => {
    // Setup contract
    const contract = createContractEntity({
      contractCode: 'CT-CONSIST-001',
      studentCode: 'STU001',
      totalLessons: 10,
      remainingLessons: 10,
    });
    contractRepo._store.push({ ...contract });

    // Auto-create for 3 students
    await service.autoCreateForLesson(1, ['STU001', 'STU002', 'STU003'], 'CL001', 10);

    // Record all 3 as PRESENT
    await service.recordAttendance({ lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10 });
    await service.recordAttendance({ lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.PRESENT, operator: 10 });
    await service.recordAttendance({ lessonId: 1, studentCode: 'STU003', status: AttendanceStatus.PRESENT, operator: 10 });

    // Verify: 3 deductions happened (one per student with their own contract)
    // Note: STU002 and STU003 don't have contracts in our mock, so deduction logs warning
    // Only STU001 has a contract
    const stu001Contract = contractRepo._store.find(c => c.studentCode === 'STU001');
    expect(stu001Contract!.remainingLessons).toBe(9); // 10 - 1 = 9

    // Verify attendance records: all CHECKED_IN
    const allRecords = attendanceRepo._records.filter(r => r.lessonId === 1);
    expect(allRecords).toHaveLength(3);
    expect(allRecords.every(r => r.workflowState === AttendanceWorkflowState.CHECKED_IN)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 2: Deduction Logic — Multiple Students, Mixed Statuses
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 2 — Deduction Logic', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should only deduct for PRESENT and LATE, not ABSENT', async () => {
    // Setup: STU001 has contract with 5 lessons
    const contract = createContractEntity({
      contractCode: 'CT-DEDUCT-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    // Auto-create attendance for 1 student
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // Record PRESENT
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    // Verify: 1 deduction
    const afterFirst = contractRepo._store.find(c => c.contractCode === 'CT-DEDUCT-001');
    expect(afterFirst!.remainingLessons).toBe(4);

    // Now simulate a second lesson: create new attendance record manually
    const record2 = new LessonAttendanceEntity();
    record2.lessonId = 2;
    record2.studentCode = 'STU001';
    record2.classCode = 'CL001';
    record2.teacherId = 10;
    record2.workflowState = AttendanceWorkflowState.PENDING;
    record2.status = null;
    record2.operator = 10;
    record2.source = AttendanceSource.API;
    record2.createdBy = 10;
    attendanceRepo._records.push(record2);

    // Record LATE (with reason) — should deduct
    await service.recordAttendance({
      lessonId: 2,
      studentCode: 'STU001',
      status: AttendanceStatus.LATE,
      reason: 'Traffic jam',
      operator: 10,
    });

    const afterSecond = contractRepo._store.find(c => c.contractCode === 'CT-DEDUCT-001');
    expect(afterSecond!.remainingLessons).toBe(3); // 4 - 1 = 3
  });

  it('should NOT deduct for ABSENT status', async () => {
    const contract = createContractEntity({
      contractCode: 'CT-ABSENT-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // Record ABSENT (with reason)
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.ABSENT,
      reason: 'Sick',
      operator: 10,
    });

    // Verify: NO deduction
    const afterAbsent = contractRepo._store.find(c => c.contractCode === 'CT-ABSENT-001');
    expect(afterAbsent!.remainingLessons).toBe(5); // unchanged
    expect(contractRepo.save).not.toHaveBeenCalled(); // contract was never saved/modified
  });

  it('should NOT deduct for LEAVE status', async () => {
    const contract = createContractEntity({
      contractCode: 'CT-LEAVE-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.LEAVE,
      reason: 'Family event',
      operator: 10,
    });

    const afterLeave = contractRepo._store.find(c => c.contractCode === 'CT-LEAVE-001');
    expect(afterLeave!.remainingLessons).toBe(5); // unchanged
  });

  it('should deduct for ONLINE and OFFLINE statuses', async () => {
    // Test ONLINE
    const contractOnline = createContractEntity({
      contractCode: 'CT-ONLINE-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contractOnline });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.ONLINE,
      operator: 10,
    });

    const afterOnline = contractRepo._store.find(c => c.contractCode === 'CT-ONLINE-001');
    expect(afterOnline!.remainingLessons).toBe(4);

    // Test OFFLINE (new lesson, same student, new contract)
    const contractOffline = createContractEntity({
      id: 2,
      contractCode: 'CT-OFFLINE-001',
      studentCode: 'STU002',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contractOffline });

    await service.autoCreateForLesson(2, ['STU002'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 2,
      studentCode: 'STU002',
      status: AttendanceStatus.OFFLINE,
      operator: 10,
    });

    const afterOffline = contractRepo._store.find(c => c.contractCode === 'CT-OFFLINE-001');
    expect(afterOffline!.remainingLessons).toBe(4);
  });

  it('should handle batch roll call with mixed statuses correctly', async () => {
    // Setup: 3 students with their own contracts
    const contract1 = createContractEntity({
      id: 1, contractCode: 'CT-BATCH-001', studentCode: 'STU001',
      totalLessons: 5, remainingLessons: 5,
    });
    const contract2 = createContractEntity({
      id: 2, contractCode: 'CT-BATCH-002', studentCode: 'STU002',
      totalLessons: 5, remainingLessons: 5,
    });
    const contract3 = createContractEntity({
      id: 3, contractCode: 'CT-BATCH-003', studentCode: 'STU003',
      totalLessons: 5, remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract1 }, { ...contract2 }, { ...contract3 });

    // Auto-create attendance
    await service.autoCreateForLesson(1, ['STU001', 'STU002', 'STU003'], 'CL001', 10);

    // Batch roll call: STU001=PRESENT, STU002=LATE, STU003=ABSENT
    await service.batchRollCall({
      lessonId: 1,
      records: [
        { lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10 },
        { lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.LATE, reason: 'Bus late', operator: 10 },
        { lessonId: 1, studentCode: 'STU003', status: AttendanceStatus.ABSENT, reason: 'Sick', operator: 10 },
      ],
    });

    // Verify deductions:
    // STU001: PRESENT → deducted (5→4)
    const c1 = contractRepo._store.find(c => c.contractCode === 'CT-BATCH-001');
    expect(c1!.remainingLessons).toBe(4);

    // STU002: LATE → deducted (5→4)
    const c2 = contractRepo._store.find(c => c.contractCode === 'CT-BATCH-002');
    expect(c2!.remainingLessons).toBe(4);

    // STU003: ABSENT → NOT deducted (5→5)
    const c3 = contractRepo._store.find(c => c.contractCode === 'CT-BATCH-003');
    expect(c3!.remainingLessons).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 3: Contract Exhaustion
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 3 — Contract Exhaustion', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should auto-transition contract to EXHAUSTED when remainingLessons reaches 0', async () => {
    // Setup: contract with exactly 1 lesson
    const contract = createContractEntity({
      contractCode: 'CT-EXHAUST-001',
      studentCode: 'STU001',
      totalLessons: 1,
      remainingLessons: 1,
      status: ContractStatus.ACTIVE,
    });
    contractRepo._store.push({ ...contract });

    // Auto-create attendance
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // Record PRESENT — should deduct and exhaust
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    // Verify: remainingLessons = 0, status = EXHAUSTED
    const exhausted = contractRepo._store.find(c => c.contractCode === 'CT-EXHAUST-001');
    expect(exhausted!.remainingLessons).toBe(0);
    expect(exhausted!.status).toBe(ContractStatus.EXHAUSTED);
  });

  it('should skip deduction when contract already has 0 remaining', async () => {
    // Setup: contract with 0 remaining (already exhausted)
    const contract = createContractEntity({
      contractCode: 'CT-ZERO-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 0,
      status: ContractStatus.EXHAUSTED,
    });
    contractRepo._store.push({ ...contract });

    // Mock: findOneActiveByStudentCode returns null (EXHAUSTED is not ACTIVE)
    contractRepo.findOneActiveByStudentCode.mockResolvedValue(null);

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // Record PRESENT — should try to deduct but find no active contract
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    // Verify: contract unchanged (no active contract found, deduction skipped)
    const unchanged = contractRepo._store.find(c => c.contractCode === 'CT-ZERO-001');
    expect(unchanged!.remainingLessons).toBe(0);
    expect(unchanged!.status).toBe(ContractStatus.EXHAUSTED);
  });

  it('should handle sequential deductions until exhaustion', async () => {
    // Setup: contract with 3 lessons
    const contract = createContractEntity({
      contractCode: 'CT-SEQ-001',
      studentCode: 'STU001',
      totalLessons: 3,
      remainingLessons: 3,
      status: ContractStatus.ACTIVE,
    });
    contractRepo._store.push({ ...contract });

    // Lesson 1: PRESENT → deduct (3→2)
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });
    let c = contractRepo._store.find(x => x.contractCode === 'CT-SEQ-001');
    expect(c!.remainingLessons).toBe(2);
    expect(c!.status).toBe(ContractStatus.ACTIVE);

    // Lesson 2: PRESENT → deduct (2→1)
    await service.autoCreateForLesson(2, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 2, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });
    c = contractRepo._store.find(x => x.contractCode === 'CT-SEQ-001');
    expect(c!.remainingLessons).toBe(1);
    expect(c!.status).toBe(ContractStatus.ACTIVE);

    // Lesson 3: PRESENT → deduct (1→0) → EXHAUSTED
    await service.autoCreateForLesson(3, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 3, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });
    c = contractRepo._store.find(x => x.contractCode === 'CT-SEQ-001');
    expect(c!.remainingLessons).toBe(0);
    expect(c!.status).toBe(ContractStatus.EXHAUSTED);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 4: ABSENT Does Not Deduct (explicit isolation)
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 4 — ABSENT Does Not Deduct', () => {
  it('should leave contract unchanged when all students are ABSENT', async () => {
    const attendanceRepo = createMockAttendanceRepo();
    const contractRepo = createMockContractRepo();
    const service = createAttendanceService(attendanceRepo, contractRepo);

    const contract = createContractEntity({
      contractCode: 'CT-NODEDUCT-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.ABSENT,
      reason: 'Personal reasons',
      operator: 10,
    });

    // Verify: contract completely untouched
    const c = contractRepo._store.find(x => x.contractCode === 'CT-NODEDUCT-001');
    expect(c!.remainingLessons).toBe(5);
    expect(c!.status).toBe(ContractStatus.ACTIVE);

    // Verify: contractRepo.save was never called for deduction
    expect(contractRepo.save).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 5: Duplicate Check-in Blocked (Workflow State Machine)
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 5 — Workflow State Machine', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should block second check-in (CHECKED_IN → CHECKED_IN is invalid)', async () => {
    const contract = createContractEntity({
      contractCode: 'CT-DUP-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // First check-in: PENDING → CHECKED_IN (success)
    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    // Verify first check-in succeeded
    const record = attendanceRepo._records.find(
      r => r.lessonId === 1 && r.studentCode === 'STU001',
    );
    expect(record!.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);

    // Second check-in: CHECKED_IN → CHECKED_IN (should fail)
    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      }),
    ).rejects.toThrow('Invalid workflow transition');
  });

  it('should enforce full workflow: PENDING → CHECKED_IN → CONFIRMED → LOCKED', async () => {
    const contract = createContractEntity({
      contractCode: 'CT-WF-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    // Step 1: Auto-create (PENDING)
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);
    let record = attendanceRepo._records.find(r => r.lessonId === 1 && r.studentCode === 'STU001');
    expect(record!.workflowState).toBe(AttendanceWorkflowState.PENDING);

    // Step 2: Record attendance (PENDING → CHECKED_IN)
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });
    record = attendanceRepo._records.find(r => r.lessonId === 1 && r.studentCode === 'STU001');
    expect(record!.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);

    // Step 3: Confirm (CHECKED_IN → CONFIRMED)
    attendanceRepo.findByLessonId.mockResolvedValue(
      attendanceRepo._records.filter(r => r.lessonId === 1).map(r => ({ ...r })),
    );
    await service.confirmAll(1, 10);
    record = attendanceRepo._records.find(r => r.lessonId === 1 && r.studentCode === 'STU001');
    expect(record!.workflowState).toBe(AttendanceWorkflowState.CONFIRMED);

    // Step 4: Lock (CONFIRMED → LOCKED)
    attendanceRepo.findByLessonId.mockResolvedValue(
      attendanceRepo._records.filter(r => r.lessonId === 1).map(r => ({ ...r })),
    );
    await service.lockByLessonId(1);
    record = attendanceRepo._records.find(r => r.lessonId === 1 && r.studentCode === 'STU001');
    expect(record!.workflowState).toBe(AttendanceWorkflowState.LOCKED);
  });

  it('should block LOCKED → anything (terminal state)', async () => {
    // Verify via the exported state machine
    const { VALID_WORKFLOW_TRANSITIONS } = require('../lesson-attendance/lesson-attendance.service');
    const allowedFromLocked = VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.LOCKED];
    expect(allowedFromLocked).toEqual([]);
  });

  it('should allow admin reverse: CONFIRMED → CHECKED_IN', async () => {
    const { VALID_WORKFLOW_TRANSITIONS } = require('../lesson-attendance/lesson-attendance.service');
    const allowedFromConfirmed = VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CONFIRMED];
    expect(allowedFromConfirmed).toContain(AttendanceWorkflowState.CHECKED_IN);
  });

  it('should allow admin reverse: CHECKED_IN → PENDING', async () => {
    const { VALID_WORKFLOW_TRANSITIONS } = require('../lesson-attendance/lesson-attendance.service');
    const allowedFromCheckedIn = VALID_WORKFLOW_TRANSITIONS[AttendanceWorkflowState.CHECKED_IN];
    expect(allowedFromCheckedIn).toContain(AttendanceWorkflowState.PENDING);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 6: Data Consistency — Three-End Verification
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 6 — Data Consistency', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should maintain three-end consistency: contract ↔ attendance ↔ lesson', async () => {
    // Setup: contract with 10 lessons for STU001
    const contract = createContractEntity({
      contractCode: 'CT-3WAY-001',
      studentCode: 'STU001',
      totalLessons: 10,
      remainingLessons: 10,
    });
    contractRepo._store.push({ ...contract });

    // Auto-create attendance for lesson 1 (3 students)
    await service.autoCreateForLesson(1, ['STU001', 'STU002', 'STU003'], 'CL001', 10);

    // Record attendance: STU001=PRESENT, STU002=LATE, STU003=ABSENT
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.LATE, reason: 'Traffic', operator: 10,
    });
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU003', status: AttendanceStatus.ABSENT, reason: 'Sick', operator: 10,
    });

    // ─── Three-End Verification ───

    // End 1: Contract side — STU001 deducted 1 lesson
    const stu001Contract = contractRepo._store.find(c => c.studentCode === 'STU001');
    expect(stu001Contract!.remainingLessons).toBe(9);
    const totalDeducted = stu001Contract!.totalLessons - stu001Contract!.remainingLessons;
    expect(totalDeducted).toBe(1); // Only STU001 has a contract in our test

    // End 2: Attendance side — all records have correct workflow state
    const allAttendance = attendanceRepo._records.filter(r => r.lessonId === 1);
    expect(allAttendance).toHaveLength(3);

    const stu001Attendance = allAttendance.find(r => r.studentCode === 'STU001');
    expect(stu001Attendance!.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    expect(stu001Attendance!.status).toBe(AttendanceStatus.PRESENT);

    const stu002Attendance = allAttendance.find(r => r.studentCode === 'STU002');
    expect(stu002Attendance!.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    expect(stu002Attendance!.status).toBe(AttendanceStatus.LATE);

    const stu003Attendance = allAttendance.find(r => r.studentCode === 'STU003');
    expect(stu003Attendance!.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    expect(stu003Attendance!.status).toBe(AttendanceStatus.ABSENT);

    // End 3: Lesson side — verify correct attendance count
    const presentCount = allAttendance.filter(
      r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;
    const absentCount = allAttendance.filter(r => r.status === AttendanceStatus.ABSENT).length;
    expect(presentCount).toBe(2); // PRESENT + LATE
    expect(absentCount).toBe(1); // ABSENT
  });

  it('should correctly track deductions across multiple lessons', async () => {
    // Setup: contract with 5 lessons
    const contract = createContractEntity({
      contractCode: 'CT-MULTI-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    // Lesson 1: PRESENT → deduct
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10,
    });

    // Lesson 2: ABSENT → no deduct
    await service.autoCreateForLesson(2, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 2, studentCode: 'STU001', status: AttendanceStatus.ABSENT, reason: 'Sick', operator: 10,
    });

    // Lesson 3: LATE → deduct
    await service.autoCreateForLesson(3, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 3, studentCode: 'STU001', status: AttendanceStatus.LATE, reason: 'Bus', operator: 10,
    });

    // Lesson 4: LEAVE → no deduct
    await service.autoCreateForLesson(4, ['STU001'], 'CL001', 10);
    await service.recordAttendance({
      lessonId: 4, studentCode: 'STU001', status: AttendanceStatus.LEAVE, reason: 'Family', operator: 10,
    });

    // Verify: 5 total - 2 deducted (Lesson 1 + Lesson 3) = 3 remaining
    const c = contractRepo._store.find(x => x.contractCode === 'CT-MULTI-001');
    expect(c!.remainingLessons).toBe(3);
    expect(c!.status).toBe(ContractStatus.ACTIVE);

    // Cross-check: attendance records
    const allRecords = attendanceRepo._records.filter(r => r.studentCode === 'STU001');
    expect(allRecords).toHaveLength(4);

    const deductibleCount = allRecords.filter(
      r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;
    expect(deductibleCount).toBe(2); // Lesson 1 (PRESENT) + Lesson 3 (LATE)

    // Verify: totalLessons - remainingLessons = deductibleCount
    expect(c!.totalLessons - c!.remainingLessons).toBe(deductibleCount);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 7: Edge Cases & Input Validation
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 7 — Edge Cases', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should throw when recording attendance for non-existent record', async () => {
    await expect(
      service.recordAttendance({
        lessonId: 999,
        studentCode: 'NONEXISTENT',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw when LATE status has no reason', async () => {
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.LATE,
        operator: 10,
        // no reason!
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.LATE,
        operator: 10,
      }),
    ).rejects.toThrow('requires a reason');
  });

  it('should throw when ABSENT status has no reason', async () => {
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.ABSENT,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw when LEAVE status has no reason', async () => {
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.LEAVE,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw for invalid attendance status', async () => {
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: 'INVALID_STATUS' as any,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw for empty studentCode', async () => {
    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: '  ',
        status: AttendanceStatus.PRESENT,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw for missing status', async () => {
    await expect(
      service.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: '' as any,
        operator: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should handle MAKEUP status without deduction', async () => {
    const contract = createContractEntity({
      contractCode: 'CT-MAKEUP-001',
      studentCode: 'STU001',
      totalLessons: 5,
      remainingLessons: 5,
    });
    contractRepo._store.push({ ...contract });

    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // MAKEUP is not in DEDUCTIBLE_STATUSES
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.MAKEUP)).toBe(false);

    await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.MAKEUP,
      operator: 10,
    });

    // Verify: no deduction
    const c = contractRepo._store.find(x => x.contractCode === 'CT-MAKEUP-001');
    expect(c!.remainingLessons).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 8: Deductible Status Set Verification
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 8 — Deductible Status Rules', () => {
  it('should correctly define DEDUCTIBLE_STATUSES', () => {
    // These should trigger deduction
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.PRESENT)).toBe(true);
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.LATE)).toBe(true);
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.ONLINE)).toBe(true);
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.OFFLINE)).toBe(true);

    // These should NOT trigger deduction
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.ABSENT)).toBe(false);
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.LEAVE)).toBe(false);
    expect(DEDUCTIBLE_STATUSES.has(AttendanceStatus.MAKEUP)).toBe(false);
  });

  it('should have exactly 4 deductible statuses', () => {
    expect(DEDUCTIBLE_STATUSES.size).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 9: Batch Roll Call Integration
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 9 — Batch Roll Call', () => {
  let attendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let contractRepo: ReturnType<typeof createMockContractRepo>;
  let service: LessonAttendanceService;

  beforeEach(() => {
    attendanceRepo = createMockAttendanceRepo();
    contractRepo = createMockContractRepo();
    service = createAttendanceService(attendanceRepo, contractRepo);
  });

  it('should handle batch roll call with all deductible statuses', async () => {
    // Setup 4 students with contracts
    for (let i = 1; i <= 4; i++) {
      const c = createContractEntity({
        id: i,
        contractCode: `CT-BATCHALL-${i.toString().padStart(3, '0')}`,
        studentCode: `STU${i.toString().padStart(3, '0')}`,
        totalLessons: 10,
        remainingLessons: 10,
      });
      contractRepo._store.push({ ...c });
    }

    await service.autoCreateForLesson(
      1,
      ['STU001', 'STU002', 'STU003', 'STU004'],
      'CL001',
      10,
    );

    // Batch roll call: PRESENT, LATE, ONLINE, OFFLINE (all deductible)
    await service.batchRollCall({
      lessonId: 1,
      records: [
        { lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10 },
        { lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.LATE, reason: 'Late', operator: 10 },
        { lessonId: 1, studentCode: 'STU003', status: AttendanceStatus.ONLINE, operator: 10 },
        { lessonId: 1, studentCode: 'STU004', status: AttendanceStatus.OFFLINE, operator: 10 },
      ],
    });

    // All 4 should be deducted
    for (let i = 1; i <= 4; i++) {
      const c = contractRepo._store.find(
        x => x.contractCode === `CT-BATCHALL-${i.toString().padStart(3, '0')}`,
      );
      expect(c!.remainingLessons).toBe(9);
    }
  });

  it('should throw in batch roll call if any record is not PENDING', async () => {
    await service.autoCreateForLesson(1, ['STU001', 'STU002'], 'CL001', 10);

    // Manually set STU001 to CHECKED_IN (simulating already recorded)
    const stu001Record = attendanceRepo._records.find(
      r => r.lessonId === 1 && r.studentCode === 'STU001',
    );
    stu001Record!.workflowState = AttendanceWorkflowState.CHECKED_IN;

    await expect(
      service.batchRollCall({
        lessonId: 1,
        records: [
          { lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.PRESENT, operator: 10 },
          { lessonId: 1, studentCode: 'STU002', status: AttendanceStatus.PRESENT, operator: 10 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw in batch roll call if reason missing for LATE', async () => {
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    await expect(
      service.batchRollCall({
        lessonId: 1,
        records: [
          { lessonId: 1, studentCode: 'STU001', status: AttendanceStatus.LATE, operator: 10 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 10: No Active Contract — Graceful Degradation
// ═══════════════════════════════════════════════════════════════

describe('Business Flow Integration: Scenario 10 — No Active Contract', () => {
  it('should record attendance even when no active contract exists', async () => {
    const attendanceRepo = createMockAttendanceRepo();
    const contractRepo = createMockContractRepo();
    const service = createAttendanceService(attendanceRepo, contractRepo);

    // No contract in store — findOneActiveByStudentCode returns null
    await service.autoCreateForLesson(1, ['STU001'], 'CL001', 10);

    // Should NOT throw — attendance recorded, deduction skipped gracefully
    const result = await service.recordAttendance({
      lessonId: 1,
      studentCode: 'STU001',
      status: AttendanceStatus.PRESENT,
      operator: 10,
    });

    expect(result.workflowState).toBe(AttendanceWorkflowState.CHECKED_IN);
    expect(result.status).toBe(AttendanceStatus.PRESENT);

    // Contract repo was queried but nothing saved
    expect(contractRepo.findOneActiveByStudentCode).toHaveBeenCalledWith('STU001');
    expect(contractRepo.save).not.toHaveBeenCalled();
  });
});