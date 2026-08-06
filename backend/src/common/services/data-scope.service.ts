import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TeacherAssignmentEntity } from '@modules/teaching/teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { StudentParent } from '@modules/student/entities/student-parent.entity';

@Injectable()
export class DataScopeService {
  constructor(
    @InjectRepository(TeacherAssignmentEntity)
    private readonly assignmentRepo: Repository<TeacherAssignmentEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
  ) {}

  /**
   * 获取教师负责的班级 code 列表
   */
  async getTeacherClassCodes(teacherId: number): Promise<string[]> {
    const assignments = await this.assignmentRepo.find({
      where: { teacherId },
      select: { classCode: true },
    });
    return assignments.map(a => a.classCode);
  }

  /**
   * 获取教师负责的课程 code 列表
   */
  async getTeacherCourseCodes(teacherId: number): Promise<string[]> {
    const classCodes = await this.getTeacherClassCodes(teacherId);
    if (classCodes.length === 0) return [];

    const classes = await this.classRepo
      .createQueryBuilder('class')
      .where('class.classCode IN (:...classCodes)', { classCodes })
      .select(['class.classCode', 'class.courseCode'])
      .getMany();

    const courseCodes = classes
      .map(c => c.courseCode)
      .filter(code => code != null);

    return [...new Set(courseCodes)];
  }

  /**
   * 获取教师负责的学生学号列表
   */
  async getTeacherStudentCodes(teacherId: number): Promise<string[]> {
    const classCodes = await this.getTeacherClassCodes(teacherId);
    if (classCodes.length === 0) return [];

    const enrollments = await this.enrollmentRepo
      .createQueryBuilder('enrollment')
      .where('enrollment.classCode IN (:...classCodes)', { classCodes })
      .select(['enrollment.studentCode'])
      .getMany();

    const studentCodes = enrollments.map(e => e.studentCode);
    return [...new Set(studentCodes)];
  }

  /**
   * 验证教师是否有权访问指定班级
   */
  async canTeacherAccessClass(teacherId: number, classCode: string): Promise<boolean> {
    const classCodes = await this.getTeacherClassCodes(teacherId);
    return classCodes.includes(classCode);
  }

  /**
   * 验证教师是否有权访问指定课程
   */
  async canTeacherAccessCourse(teacherId: number, courseCode: string): Promise<boolean> {
    const courseCodes = await this.getTeacherCourseCodes(teacherId);
    return courseCodes.includes(courseCode);
  }

  /**
   * 验证教师是否有权访问指定学生
   */
  async canTeacherAccessStudent(teacherId: number, studentCode: string): Promise<boolean> {
    const studentCodes = await this.getTeacherStudentCodes(teacherId);
    return studentCodes.includes(studentCode);
  }

  /**
   * 验证当前用户是否有权访问指定学生的数据
   * - SuperAdmin/Admin: 允许访问所有学生
   * - Student: 仅允许访问自己的数据
   * - Parent: 仅允许访问子女的数据
   * - Teacher: 仅允许访问其负责班级中的学生数据
   *
   * @throws ForbiddenException 无权访问时
   */
  async verifyStudentAccess(
    user: { sub: number; role: string },
    studentCode: string,
  ): Promise<void> {
    const { sub: userId, role } = user;

    // Admin/SuperAdmin: full access
    if (role === 'SuperAdmin' || role === 'Admin') {
      return;
    }

    // Student: only own data
    if (role === 'Student') {
      const student = await this.studentRepo.findOne({
        where: { userId, deleted: false },
      });
      if (!student || student.studentCode !== studentCode) {
        throw new ForbiddenException('无权访问该学生的记录');
      }
      return;
    }

    // Parent: only children's data
    if (role === 'Parent') {
      const parentRelations = await this.studentParentRepo.find({
        where: { parentId: userId },
      });
      if (parentRelations.length === 0) {
        throw new ForbiddenException('无权访问该学生的记录');
      }
      // Get the student IDs linked to this parent
      const studentIds = parentRelations.map(sp => sp.studentId);
      const student = await this.studentRepo.findOne({
        where: { id: In(studentIds), deleted: false },
      });
      if (!student || student.studentCode !== studentCode) {
        throw new ForbiddenException('无权访问该学生的记录');
      }
      return;
    }

    // Teacher: only students in their assigned classes
    if (role === 'Teacher') {
      const hasAccess = await this.canTeacherAccessStudent(userId, studentCode);
      if (!hasAccess) {
        throw new ForbiddenException('无权访问该学生的记录');
      }
      return;
    }

    // Unknown role: deny
    throw new ForbiddenException('无权访问该学生的记录');
  }
}
