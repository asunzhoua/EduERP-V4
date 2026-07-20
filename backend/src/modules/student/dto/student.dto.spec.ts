import { CreateStudentDto } from './create-student.dto';
import { LinkParentDto } from './link-parent.dto';
import { QueryStudentDto } from './query-student.dto';
import { UpdateStudentStatusDto } from './update-student-status.dto';
import { UpdateStudentDto } from './update-student.dto';
import { Gender } from '../enums/gender.enum';
import { StudentStatus } from '../enums/student-status.enum';

describe('Student DTOs', () => {
  // ── CreateStudentDto ────────────────────────────────────────────────────
  describe('CreateStudentDto', () => {
    it('should instantiate with required fields only', () => {
      const dto = new CreateStudentDto();
      dto.name = '张三';
      dto.gender = Gender.MALE;
      dto.birthDate = '2015-06-15';

      expect(dto.name).toBe('张三');
      expect(dto.gender).toBe(Gender.MALE);
      expect(dto.birthDate).toBe('2015-06-15');
    });

    it('should allow setting all optional fields', () => {
      const dto = new CreateStudentDto();
      dto.name = '李四';
      dto.gender = Gender.FEMALE;
      dto.birthDate = '2016-03-20';
      dto.phone = '13800138000';
      dto.email = 'parent@example.com';
      dto.school = '实验小学';
      dto.grade = '三年级';
      dto.tags = ['特长生', '三好学生'];
      dto.note = '备注信息';
      dto.parentIds = [1, 2];

      expect(dto.phone).toBe('13800138000');
      expect(dto.email).toBe('parent@example.com');
      expect(dto.school).toBe('实验小学');
      expect(dto.grade).toBe('三年级');
      expect(dto.tags).toEqual(['特长生', '三好学生']);
      expect(dto.note).toBe('备注信息');
      expect(dto.parentIds).toEqual([1, 2]);
    });

    it('should allow optional fields to remain undefined', () => {
      const dto = new CreateStudentDto();
      dto.name = '王五';
      dto.gender = Gender.MALE;
      dto.birthDate = '2017-01-01';

      expect(dto.phone).toBeUndefined();
      expect(dto.email).toBeUndefined();
      expect(dto.school).toBeUndefined();
      expect(dto.grade).toBeUndefined();
      expect(dto.tags).toBeUndefined();
      expect(dto.note).toBeUndefined();
      expect(dto.parentIds).toBeUndefined();
    });
  });

  // ── LinkParentDto ───────────────────────────────────────────────────────
  describe('LinkParentDto', () => {
    it('should instantiate with optional fields', () => {
      const dto = new LinkParentDto();
      dto.relation = '母亲';
      dto.isPrimary = true;

      expect(dto.relation).toBe('母亲');
      expect(dto.isPrimary).toBe(true);
    });

    it('should allow all fields to be undefined', () => {
      const dto = new LinkParentDto();

      expect(dto.relation).toBeUndefined();
      expect(dto.isPrimary).toBeUndefined();
    });
  });

  // ── QueryStudentDto ─────────────────────────────────────────────────────
  describe('QueryStudentDto', () => {
    it('should instantiate empty', () => {
      const dto = new QueryStudentDto();

      expect(dto.name).toBeUndefined();
      expect(dto.page).toBeUndefined();
      expect(dto.pageSize).toBeUndefined();
    });

    it('should allow setting query filters and pagination', () => {
      const dto = new QueryStudentDto();
      dto.name = '赵六';
      dto.studentCode = 'STU001';
      dto.gender = Gender.MALE;
      dto.status = StudentStatus.ACTIVE;
      dto.phone = '13900139000';
      dto.school = '育才小学';
      dto.grade = '五年级';
      dto.keyword = '搜索关键词';
      dto.page = 1;
      dto.pageSize = 20;

      expect(dto.name).toBe('赵六');
      expect(dto.studentCode).toBe('STU001');
      expect(dto.gender).toBe(Gender.MALE);
      expect(dto.status).toBe(StudentStatus.ACTIVE);
      expect(dto.phone).toBe('13900139000');
      expect(dto.school).toBe('育才小学');
      expect(dto.grade).toBe('五年级');
      expect(dto.keyword).toBe('搜索关键词');
      expect(dto.page).toBe(1);
      expect(dto.pageSize).toBe(20);
    });
  });

  // ── UpdateStudentStatusDto ──────────────────────────────────────────────
  describe('UpdateStudentStatusDto', () => {
    it('should instantiate with status', () => {
      const dto = new UpdateStudentStatusDto();
      dto.status = StudentStatus.ACTIVE;

      expect(dto.status).toBe(StudentStatus.ACTIVE);
    });

    it('should accept all status enum values', () => {
      const statuses = [
        StudentStatus.ACTIVE,
        StudentStatus.PAUSED,
        StudentStatus.GRADUATED,
        StudentStatus.INACTIVE,
      ];

      for (const status of statuses) {
        const dto = new UpdateStudentStatusDto();
        dto.status = status;
        expect(dto.status).toBe(status);
      }
    });
  });

  // ── UpdateStudentDto ────────────────────────────────────────────────────
  describe('UpdateStudentDto', () => {
    it('should instantiate empty (all fields optional)', () => {
      const dto = new UpdateStudentDto();

      expect(dto.name).toBeUndefined();
      expect(dto.gender).toBeUndefined();
      expect(dto.tags).toBeUndefined();
    });

    it('should allow partial updates', () => {
      const dto = new UpdateStudentDto();
      dto.name = '新名字';
      dto.grade = '六年级';
      dto.tags = ['更新标签'];

      expect(dto.name).toBe('新名字');
      expect(dto.grade).toBe('六年级');
      expect(dto.tags).toEqual(['更新标签']);
      expect(dto.gender).toBeUndefined();
      expect(dto.birthDate).toBeUndefined();
    });

    it('should allow setting all fields', () => {
      const dto = new UpdateStudentDto();
      dto.name = '全字段';
      dto.gender = Gender.FEMALE;
      dto.birthDate = '2014-12-25';
      dto.phone = '15000150000';
      dto.email = 'new@example.com';
      dto.school = '新学校';
      dto.grade = '新年级';
      dto.tags = ['a', 'b'];
      dto.note = '新备注';

      expect(dto.name).toBe('全字段');
      expect(dto.gender).toBe(Gender.FEMALE);
      expect(dto.birthDate).toBe('2014-12-25');
      expect(dto.phone).toBe('15000150000');
      expect(dto.email).toBe('new@example.com');
      expect(dto.school).toBe('新学校');
      expect(dto.grade).toBe('新年级');
      expect(dto.tags).toEqual(['a', 'b']);
      expect(dto.note).toBe('新备注');
    });
  });
});
