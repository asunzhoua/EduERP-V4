import { Test, TestingModule } from '@nestjs/testing';
import { StudentController } from './student.controller';
import { StudentService } from './services/student.service';
import { ContractRepository } from '../teaching/contract/contract.repository';
import { LessonAttendanceRepository } from '../teaching/lesson-attendance/lesson-attendance.repository';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { ApiResponse } from '@common/dto/api-response';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('StudentController', () => {
  let controller: StudentController;
  let service: Record<string, jest.Mock>;

  const mockStudent = { id: 1, name: '张三', studentCode: 'STU20240001' };
  const mockReq = { user: { sub: 1 } };

  const mockContractRepository = {
    findByStudentCode: jest.fn().mockResolvedValue([]),
  };
  const mockAttendanceRepository = {
    findByStudentCode: jest.fn().mockResolvedValue([]),
  };
  const mockLessonRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockStudent),
      findAll: jest.fn().mockResolvedValue({ items: [mockStudent], total: 1 }),
      findById: jest.fn().mockResolvedValue(mockStudent),
      findByUserId: jest.fn().mockResolvedValue(mockStudent),
      update: jest.fn().mockResolvedValue(mockStudent),
      updateStatus: jest.fn().mockResolvedValue(mockStudent),
      softDelete: jest.fn().mockResolvedValue(undefined),
      linkParent: jest.fn().mockResolvedValue({ id: 1, studentId: 1, parentId: 2 }),
      unlinkParent: jest.fn().mockResolvedValue(undefined),
      getParents: jest.fn().mockResolvedValue([{ id: 2, name: '李四' }]),
      getStudentsByParent: jest.fn().mockResolvedValue([mockStudent]),
      importStudents: jest.fn().mockResolvedValue({ success: 1, failed: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentController],
      providers: [
        { provide: StudentService, useValue: service },
        { provide: ContractRepository, useValue: mockContractRepository },
        { provide: LessonAttendanceRepository, useValue: mockAttendanceRepository },
        { provide: getRepositoryToken(LessonEntity), useValue: mockLessonRepository },
      ],
    }).compile();

    controller = module.get(StudentController);
  });

  it('POST /students - create', async () => {
    const dto = { name: '张三', gender: 'M', birthDate: '2015-01-01' };
    const result = await controller.create(dto as any, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(mockStudent);
    expect(service.create).toHaveBeenCalledWith(dto, 1);
  });

  it('GET /students - findAll', async () => {
    const result = await controller.findAll({ page: 1 } as any);
    expect(result.code).toBe(0);
    expect(result.data.items).toHaveLength(1);
  });

  it('GET /students/:id - findOne', async () => {
    const result = await controller.findOne(1);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(mockStudent);
    expect(service.findById).toHaveBeenCalledWith(1);
  });

  it('PUT /students/:id - update', async () => {
    const dto = { name: '张三丰' };
    const result = await controller.update(1, dto as any, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(mockStudent);
    expect(service.update).toHaveBeenCalledWith(1, dto, 1);
  });

  it('PATCH /students/:id/status - updateStatus', async () => {
    const dto = { status: 'INACTIVE' };
    const result = await controller.updateStatus(1, dto as any, mockReq);
    expect(result.code).toBe(0);
    expect(service.updateStatus).toHaveBeenCalledWith(1, dto, 1);
  });

  it('DELETE /students/:id - remove', async () => {
    const result = await controller.remove(1, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
    expect(service.softDelete).toHaveBeenCalledWith(1, 1);
  });

  it('POST /students/:id/parents - linkParent', async () => {
    const result = await controller.linkParent(1, 2, '父亲', true);
    expect(result.code).toBe(0);
    expect(service.linkParent).toHaveBeenCalledWith(1, 2, '父亲', true);
  });

  it('DELETE /students/:id/parents/:parentId - unlinkParent', async () => {
    const result = await controller.unlinkParent(1, 2);
    expect(result.code).toBe(0);
    expect(result.data).toBeNull();
    expect(service.unlinkParent).toHaveBeenCalledWith(1, 2);
  });

  it('GET /students/:id/parents - getParents', async () => {
    const result = await controller.getParents(1);
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getParents).toHaveBeenCalledWith(1);
  });

  it('GET /students/parents/:parentId/students - getStudentsByParent', async () => {
    const result = await controller.getStudentsByParent(2);
    expect(result.code).toBe(0);
    expect(result.data).toHaveLength(1);
    expect(service.getStudentsByParent).toHaveBeenCalledWith(2);
  });

  it('POST /students/import - import', async () => {
    const file = { buffer: Buffer.from('data'), originalname: 'students.xlsx' };
    const result = await controller.import(file as any, mockReq);
    expect(result.code).toBe(0);
    expect(result.data).toEqual({ success: 1, failed: 0 });
    expect(service.importStudents).toHaveBeenCalledWith(file.buffer, file.originalname, 1);
  });
});
