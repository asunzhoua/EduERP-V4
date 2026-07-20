import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateTeacherAssignmentDto } from '../teacher-assignment/dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from '../teacher-assignment/dto/update-teacher-assignment.dto';
import { TeacherRole } from '@common/enums/teacher-role.enum';

import { CreateContractDto } from '../contract/dto/create-contract.dto';
import { UpdateContractDto } from '../contract/dto/update-contract.dto';
import { QueryContractDto } from '../contract/dto/query-contract.dto';

// ─── Teacher Assignment DTOs ─────────────────────────────────────

describe('CreateTeacherAssignmentDto', () => {
  const valid = {
    classCode: 'CL2026070001',
    teacherId: 5001,
    role: TeacherRole.PRIMARY,
  };

  it('should pass with valid data', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, valid);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with optional reason', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      reason: '主讲教师',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when classCode is empty', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      classCode: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when classCode is missing', async () => {
    const { classCode, ...rest } = valid;
    const dto = plainToInstance(CreateTeacherAssignmentDto, rest);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when teacherId is missing', async () => {
    const { teacherId, ...rest } = valid;
    const dto = plainToInstance(CreateTeacherAssignmentDto, rest);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when teacherId is not a number', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      teacherId: 'abc',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when role is missing', async () => {
    const { role, ...rest } = valid;
    const dto = plainToInstance(CreateTeacherAssignmentDto, rest);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when role is invalid', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      role: 'INVALID',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass with SUBSTITUTE role', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      role: TeacherRole.SUBSTITUTE,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass with ASSISTANT role', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      role: TeacherRole.ASSISTANT,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when reason exceeds 200 chars', async () => {
    const dto = plainToInstance(CreateTeacherAssignmentDto, {
      ...valid,
      reason: 'A'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateTeacherAssignmentDto', () => {
  it('should instantiate with empty object', () => {
    const dto = plainToInstance(UpdateTeacherAssignmentDto, {});
    expect(dto).toBeInstanceOf(UpdateTeacherAssignmentDto);
  });

  it('should instantiate with valid partial data', () => {
    const dto = plainToInstance(UpdateTeacherAssignmentDto, {
      role: TeacherRole.SUBSTITUTE,
      reason: '代课安排',
    });
    expect(dto).toBeInstanceOf(UpdateTeacherAssignmentDto);
  });
});

// ─── Contract DTOs ───────────────────────────────────────────────

describe('CreateContractDto', () => {
  it('should instantiate with empty object', () => {
    const dto = plainToInstance(CreateContractDto, {});
    expect(dto).toBeInstanceOf(CreateContractDto);
  });
});

describe('UpdateContractDto', () => {
  it('should instantiate with empty object', () => {
    const dto = plainToInstance(UpdateContractDto, {});
    expect(dto).toBeInstanceOf(UpdateContractDto);
  });
});

describe('QueryContractDto', () => {
  it('should instantiate with empty object', () => {
    const dto = plainToInstance(QueryContractDto, {});
    expect(dto).toBeInstanceOf(QueryContractDto);
  });
});
