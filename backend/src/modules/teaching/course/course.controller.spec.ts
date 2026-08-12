import { Test, TestingModule } from '@nestjs/testing';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from './enums/course-type.enum';
import { CourseStatus } from './enums/course-status.enum';
import { CourseEntity } from './course.entity';
import { AuthedRequest } from '@common/types/authed-request';

describe('CourseController', () => {
  let controller: CourseController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findByCode: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    remove: jest.Mock;
  };

  const mockCourse = {
    id: 'course-1',
    code: 'ENG101',
    name: '少儿英语一级',
    subject: Subject.ENGLISH,
    type: CourseType.GROUP,
    status: CourseStatus.DRAFT,
    totalHours: 40,
    totalLessons: 40,
    defaultDuration: 60,
    createdBy: 1,
  };

  const mockCourseService = {
    create: jest.fn().mockResolvedValue(mockCourse),
    findAll: jest.fn().mockResolvedValue({ items: [mockCourse], total: 1 }),
    findByCode: jest.fn().mockResolvedValue(mockCourse),
    update: jest.fn().mockResolvedValue({ ...mockCourse, name: 'Updated' }),
    updateStatus: jest
      .fn()
      .mockResolvedValue({ ...mockCourse, status: CourseStatus.PUBLISHED }),
    remove: jest.fn().mockResolvedValue(undefined),
    enrichCourses: jest.fn().mockImplementation((items: CourseEntity[]) =>
      items.map((c: CourseEntity) => ({
        ...c,
        lessonCount: c.totalLessons,
        enrolledClasses: 0,
      })),
    ),
    enrichCourse: jest.fn().mockImplementation((c: CourseEntity) => ({
      ...c,
      lessonCount: c.totalLessons,
      enrolledClasses: 0,
    })),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [{ provide: CourseService, useValue: mockCourseService }],
    })
      // Skip all guards
      .overrideGuard(
        class {
          canActivate() {
            return true;
          }
        },
      )
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CourseController);
    service = module.get(CourseService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply resolved values after clearAllMocks
    mockCourseService.create.mockResolvedValue(mockCourse);
    mockCourseService.findAll.mockResolvedValue({
      items: [mockCourse],
      total: 1,
    });
    mockCourseService.findByCode.mockResolvedValue(mockCourse);
    mockCourseService.update.mockResolvedValue({
      ...mockCourse,
      name: 'Updated',
    });
    mockCourseService.updateStatus.mockResolvedValue({
      ...mockCourse,
      status: CourseStatus.PUBLISHED,
    });
    mockCourseService.remove.mockResolvedValue(undefined);
    mockCourseService.enrichCourses.mockImplementation(
      (items: CourseEntity[]) =>
        items.map((c: CourseEntity) => ({
          ...c,
          lessonCount: c.totalLessons,
          enrolledClasses: 0,
        })),
    );
    mockCourseService.enrichCourse.mockImplementation((c: CourseEntity) => ({
      ...c,
      lessonCount: c.totalLessons,
      enrolledClasses: 0,
    }));
  });

  const fakeReq = { user: { sub: 'admin-1' } };

  describe('POST /courses', () => {
    it('should create a course', async () => {
      const dto: CreateCourseDto = {
        name: '少儿英语一级',
        subject: Subject.ENGLISH,
        type: CourseType.GROUP,
        totalHours: 40,
        totalLessons: 40,
        defaultDuration: 60,
      };

      const result = await controller.create(
        dto,
        fakeReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(result.message).toBe('Course created');
      expect(result.data).toEqual(mockCourse);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  describe('GET /courses', () => {
    it('should return paginated courses', async () => {
      const query: QueryCourseDto = { page: 1, pageSize: 20 };
      const mockReq = { user: { sub: 42, role: 'Admin' } };

      const result = (await controller.findAll(query, mockReq)) as unknown as {
        code: number;
        data: {
          items: Array<{ lessonCount: number; enrolledClasses: number }>;
          total: number;
        };
      };

      expect(result.code).toBe(0);
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].lessonCount).toBe(mockCourse.totalLessons);
      expect(result.data.items[0].enrolledClasses).toBe(0);
      expect(result.data.total).toBe(1);
      expect(service.findAll).toHaveBeenCalledWith(query, undefined);
    });

    it('should filter courses by teacherId when user is Teacher', async () => {
      const query: QueryCourseDto = { page: 1, pageSize: 20 };
      const mockReq = { user: { sub: 100, role: 'Teacher' } };

      const result = await controller.findAll(query, mockReq);

      expect(result.code).toBe(0);
      expect(service.findAll).toHaveBeenCalledWith(query, 100);
    });
  });

  describe('GET /courses/:code', () => {
    it('should return a course by code', async () => {
      const result = (await controller.findOne('ENG101')) as unknown as {
        code: number;
        data: { lessonCount: number; enrolledClasses: number };
      };

      expect(result.code).toBe(0);
      expect(result.data.lessonCount).toBe(mockCourse.totalLessons);
      expect(result.data.enrolledClasses).toBe(0);
      expect(service.findByCode).toHaveBeenCalledWith('ENG101');
    });
  });

  describe('PUT /courses/:code', () => {
    it('should update a course', async () => {
      const dto: UpdateCourseDto = { name: 'Updated' };

      const result = await controller.update(
        'ENG101',
        dto,
        fakeReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(result.message).toBe('Course updated');
      expect(result.data).toEqual({ ...mockCourse, name: 'Updated' });
      expect(service.update).toHaveBeenCalledWith('ENG101', dto, 'admin-1');
    });

    it('should allow Teacher to update own DRAFT course', async () => {
      const dto: UpdateCourseDto = { name: 'Updated' };
      const teacherReq = { user: { sub: '1', role: 'Teacher' } };
      mockCourseService.findByCode.mockResolvedValue({
        ...mockCourse,
        createdBy: 1,
      });

      const result = await controller.update(
        'ENG101',
        dto,
        teacherReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(service.update).toHaveBeenCalledWith('ENG101', dto, '1');
    });

    it('should forbid Teacher updating a course they do not own', async () => {
      const dto: UpdateCourseDto = { name: 'Updated' };
      const teacherReq = { user: { sub: '1', role: 'Teacher' } };
      mockCourseService.findByCode.mockResolvedValue({
        ...mockCourse,
        createdBy: 99,
      });

      await expect(
        controller.update(
          'ENG101',
          dto,
          teacherReq as unknown as AuthedRequest,
        ),
      ).rejects.toThrow('You can only manage your own courses');
      expect(service.update).not.toHaveBeenCalled();
    });

    it('should forbid Teacher updating a non-DRAFT course', async () => {
      const dto: UpdateCourseDto = { name: 'Updated' };
      const teacherReq = { user: { sub: '1', role: 'Teacher' } };
      mockCourseService.findByCode.mockResolvedValue({
        ...mockCourse,
        createdBy: 1,
        status: CourseStatus.PUBLISHED,
      });

      await expect(
        controller.update(
          'ENG101',
          dto,
          teacherReq as unknown as AuthedRequest,
        ),
      ).rejects.toThrow('Only DRAFT courses can be edited');
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /courses/:code/status', () => {
    it('should update course status', async () => {
      const dto = { status: CourseStatus.PUBLISHED };

      const result = await controller.updateStatus(
        'ENG101',
        dto,
        fakeReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(result.message).toBe('Status updated');
      expect(result.data).toEqual({
        ...mockCourse,
        status: CourseStatus.PUBLISHED,
      });
      expect(service.updateStatus).toHaveBeenCalledWith(
        'ENG101',
        CourseStatus.PUBLISHED,
        'admin-1',
      );
    });
  });

  describe('DELETE /courses/:code', () => {
    it('should remove a course', async () => {
      const result = await controller.remove(
        'ENG101',
        fakeReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(result.message).toBe('Course deleted');
      expect(result.data).toBeNull();
      expect(service.remove).toHaveBeenCalledWith('ENG101', 'admin-1');
    });

    it('should allow Teacher to delete own DRAFT course', async () => {
      const teacherReq = { user: { sub: '1', role: 'Teacher' } };
      mockCourseService.findByCode.mockResolvedValue({
        ...mockCourse,
        createdBy: 1,
      });

      const result = await controller.remove(
        'ENG101',
        teacherReq as unknown as AuthedRequest,
      );

      expect(result.code).toBe(0);
      expect(service.remove).toHaveBeenCalledWith('ENG101', '1');
    });

    it('should forbid Teacher deleting a course they do not own', async () => {
      const teacherReq = { user: { sub: '1', role: 'Teacher' } };
      mockCourseService.findByCode.mockResolvedValue({
        ...mockCourse,
        createdBy: 99,
      });

      await expect(
        controller.remove('ENG101', teacherReq as unknown as AuthedRequest),
      ).rejects.toThrow('You can only manage your own courses');
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
