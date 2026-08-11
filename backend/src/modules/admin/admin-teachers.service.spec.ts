import { AdminTeachersService } from './admin-teachers.service';
import { User, UserRole } from '@modules/identity/entities/user.entity';
import { Repository } from 'typeorm';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { SalaryRecordEntity } from '../salary/entities/salary-record.entity';

describe('AdminTeachersService.teacherLevel', () => {
  function buildService(opts: { existingUser?: Partial<User> } = {}) {
    const userRepo = {
      create: jest.fn((obj: Partial<User>) => ({ ...obj })),
      save: jest.fn((u: User) => ({ id: 1, ...u })),
      findOne: jest.fn(
        ({
          where,
        }: {
          where: Record<string, unknown>;
        }): Partial<User> | null => {
          if (where.username) return null;
          if (where.mobile) return null;
          if (where.id) return opts.existingUser ?? null;
          return null;
        },
      ),
    };
    const lessonRepo = {
      createQueryBuilder: jest.fn(),
    };
    const salaryRepo = {
      createQueryBuilder: jest.fn(),
    };
    const service = new AdminTeachersService(
      userRepo as unknown as Repository<User>,
      lessonRepo as unknown as Repository<LessonEntity>,
      salaryRepo as unknown as Repository<SalaryRecordEntity>,
    );
    return { service, userRepo };
  }

  it('create 保存 teacherLevel', async () => {
    const { service, userRepo } = buildService();
    await service.create(
      {
        username: 'teacher1',
        name: '张老师',
        mobile: '13800000001',
        password: 'abc123',
        teacherLevel: '中级',
      },
      0,
    );
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ teacherLevel: '中级', role: UserRole.TEACHER }),
    );
    const saved = userRepo.create.mock.calls[0][0];
    expect(saved.teacherLevel).toBe('中级');
  });

  it('create 未传 teacherLevel → null', async () => {
    const { service, userRepo } = buildService();
    await service.create(
      {
        username: 'teacher2',
        name: '李老师',
        mobile: '13800000002',
        password: 'abc123',
      },
      0,
    );
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ teacherLevel: null }),
    );
  });

  it('update 修改 teacherLevel', async () => {
    const existing = {
      id: 1,
      username: 'teacher1',
      name: '张老师',
      mobile: '13800000001',
      role: UserRole.TEACHER,
      teacherLevel: '初级',
    };
    const { service, userRepo } = buildService({ existingUser: existing });
    await service.update(1, { teacherLevel: '高级' });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ teacherLevel: '高级' }),
    );
  });

  it('update 未传 teacherLevel → 保持不变', async () => {
    const existing = {
      id: 1,
      username: 'teacher1',
      name: '张老师',
      mobile: '13800000001',
      role: UserRole.TEACHER,
      teacherLevel: '初级',
    };
    const { service, userRepo } = buildService({ existingUser: existing });
    await service.update(1, { name: '张老师改' });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ teacherLevel: '初级', name: '张老师改' }),
    );
  });

  it('update 传空字符串 → 清除为 null', async () => {
    const existing = {
      id: 1,
      username: 'teacher1',
      name: '张老师',
      mobile: '13800000001',
      role: UserRole.TEACHER,
      teacherLevel: '初级',
    };
    const { service, userRepo } = buildService({ existingUser: existing });
    await service.update(1, { teacherLevel: '' });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ teacherLevel: null }),
    );
  });
});
