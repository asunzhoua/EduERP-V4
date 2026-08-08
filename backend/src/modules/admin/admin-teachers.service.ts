import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '@modules/identity/entities/user.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

/** 教师列表项：用户信息 + 授课数 + 本月工资 */
export interface TeacherListItem extends Partial<User> {
  teachingCount: number;
  monthSalary: number;
}

@Injectable()
export class AdminTeachersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRepo: Repository<SalaryRecordEntity>,
  ) {}

  async findAll(query: { keyword?: string; status?: string; page?: number; pageSize?: number }): Promise<{
    items: TeacherListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { role: UserRole.TEACHER, deleted: false };
    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }
    if (query.keyword) {
      where.username = Like(`%${query.keyword}%`);
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take: pageSize,
      order: { createTime: 'DESC' },
    });

    // 批量统计：授课数（已完成课时）+ 本月工资
    const teacherIds = users.map((u) => Number(u.id));
    const stats = await this.computeStats(teacherIds);

    const items: TeacherListItem[] = users.map((u) => {
      const s = stats.get(Number(u.id)) || { teachingCount: 0, monthSalary: 0 };
      return { ...u, teachingCount: s.teachingCount, monthSalary: s.monthSalary };
    });

    return { items, total, page, pageSize };
  }

  async create(dto: CreateTeacherDto, operatorId: number): Promise<User> {
    const username = dto.username.trim();
    if (!username) {
      throw new BadRequestException('用户名不能为空');
    }
    const existingUsername = await this.userRepo.findOne({ where: { username } });
    if (existingUsername) {
      throw new ConflictException('用户名已存在');
    }

    const mobile = (dto.mobile || '').trim();
    if (!mobile) {
      throw new BadRequestException('手机号不能为空');
    }
    const existingMobile = await this.userRepo.findOne({ where: { mobile } });
    if (existingMobile) {
      throw new ConflictException('手机号已存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      username,
      password: hashedPassword,
      mobile,
      name: dto.name,
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
      campusId: 0,
    });
    const saved = await this.userRepo.save(user);
    const { password: _p, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safe } = saved;
    return safe as User;
  }

  async findById(id: number): Promise<TeacherListItem> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.TEACHER, deleted: false } });
    if (!user) {
      throw new NotFoundException('教师不存在');
    }
    const stats = await this.computeStats([Number(user.id)]);
    const s = stats.get(Number(user.id)) || { teachingCount: 0, monthSalary: 0 };
    const { password: _p, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safe } = user;
    return { ...(safe as User), teachingCount: s.teachingCount, monthSalary: s.monthSalary };
  }

  async update(id: number, dto: UpdateTeacherDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.TEACHER, deleted: false } });
    if (!user) {
      throw new NotFoundException('教师不存在');
    }

    if (dto.mobile !== undefined && dto.mobile !== user.mobile) {
      const existing = await this.userRepo.findOne({ where: { mobile: dto.mobile } });
      if (existing) {
        throw new ConflictException('手机号已存在');
      }
      user.mobile = dto.mobile;
    }
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    const saved = await this.userRepo.save(user);
    const { password: _p, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safe } = saved;
    return safe as User;
  }

  async updateStatus(id: number, status: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, role: UserRole.TEACHER, deleted: false } });
    if (!user) {
      throw new NotFoundException('教师不存在');
    }
    user.status = status === 1 ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    const saved = await this.userRepo.save(user);
    const { password: _p, refreshToken: _rt, refreshTokenExpiresAt: _rtea, ...safe } = saved;
    return safe as User;
  }

  /** 批量统计 teachers 的授课数（已完成课时）与本月工资 */
  private async computeStats(
    teacherIds: number[],
  ): Promise<Map<number, { teachingCount: number; monthSalary: number }>> {
    const map = new Map<number, { teachingCount: number; monthSalary: number }>();
    if (teacherIds.length === 0) return map;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [lessons, salaries] = await Promise.all([
      this.lessonRepo
        .createQueryBuilder('lesson')
        .select('lesson.teacherId', 'teacherId')
        .addSelect('COUNT(*)', 'cnt')
        .where('lesson.teacherId IN (:...ids)', { ids: teacherIds })
        .andWhere('lesson.status = :status', { status: LessonStatus.FINISHED })
        .groupBy('lesson.teacherId')
        .getRawMany<{ teacherId: string; cnt: string }>(),
      this.salaryRepo
        .createQueryBuilder('salary')
        .select('salary.teacherId', 'teacherId')
        .addSelect('COALESCE(SUM(salary.amount), 0)', 'sum')
        .where('salary.teacherId IN (:...ids)', { ids: teacherIds })
        .andWhere('salary.createTime >= :from AND salary.createTime < :to', {
          from: monthStart,
          to: nextMonth,
        })
        .groupBy('salary.teacherId')
        .getRawMany<{ teacherId: string; sum: string }>(),
    ]);

    for (const l of lessons) {
      const id = Number(l.teacherId);
      map.set(id, { teachingCount: Number(l.cnt), monthSalary: 0 });
    }
    for (const s of salaries) {
      const id = Number(s.teacherId);
      const existing = map.get(id) || { teachingCount: 0, monthSalary: 0 };
      existing.monthSalary = Number(s.sum);
      map.set(id, existing);
    }
    return map;
  }
}
