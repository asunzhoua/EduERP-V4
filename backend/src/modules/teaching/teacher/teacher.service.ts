import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CourseEntity } from '../course/course.entity';
import { ClassEntity } from '../class/class.entity';
import { Student } from '@modules/student/entities/student.entity';
import { TeacherAssignmentEntity } from '../teacher-assignment/teacher-assignment.entity';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(TeacherAssignmentEntity)
    private readonly assignmentRepo: Repository<TeacherAssignmentEntity>,
  ) {}

  /**
   * 根据课程 code 列表获取课程
   */
  async getCoursesByCodes(courseCodes: string[]): Promise<CourseEntity[]> {
    if (courseCodes.length === 0) return [];
    return this.courseRepo.find({
      where: { courseCode: In(courseCodes) },
    });
  }

  /**
   * 根据班级 code 列表获取班级
   */
  async getClassesByCodes(classCodes: string[]): Promise<ClassEntity[]> {
    if (classCodes.length === 0) return [];
    return this.classRepo.find({
      where: { classCode: In(classCodes) },
    });
  }

  /**
   * 根据学生学号列表获取学生
   */
  async getStudentsByCodes(studentCodes: string[]): Promise<Student[]> {
    if (studentCodes.length === 0) return [];
    return this.studentRepo.find({
      where: { studentCode: In(studentCodes) },
    });
  }

  /**
   * 根据教师 ID 获取课程（保留用于向后兼容）
   */
  async getCoursesByTeacherId(teacherId: number): Promise<CourseEntity[]> {
    // 通过 teacher_assignment 表查询教师关联的课程
    const assignments = await this.assignmentRepo.find({
      where: { teacherId },
    });

    // 通过 classCode 获取班级和课程信息
    const classCodes = [...new Set(assignments.map((a) => a.classCode))];
    if (classCodes.length === 0) return [];

    const classes = await this.classRepo
      .createQueryBuilder('class')
      .where('class.classCode IN (:...classCodes)', { classCodes })
      .getMany();

    const courseCodes = [...new Set(classes.map((c) => c.courseCode))];
    if (courseCodes.length === 0) return [];

    const courses = await this.courseRepo
      .createQueryBuilder('course')
      .where('course.courseCode IN (:...courseCodes)', { courseCodes })
      .getMany();

    return courses;
  }

  /**
   * 根据教师 ID 获取班级（保留用于向后兼容）
   */
  async getClassesByTeacherId(teacherId: number): Promise<ClassEntity[]> {
    // 通过 teacher_assignment 表查询教师关联的班级
    const assignments = await this.assignmentRepo.find({
      where: { teacherId },
    });

    const classCodes = [...new Set(assignments.map((a) => a.classCode))];
    if (classCodes.length === 0) return [];

    return this.classRepo
      .createQueryBuilder('class')
      .where('class.classCode IN (:...classCodes)', { classCodes })
      .getMany();
  }

  /**
   * 根据教师 ID 获取学生（保留用于向后兼容）
   */
  async getStudentsByTeacherId(teacherId: number): Promise<Student[]> {
    // 先获取教师关联的班级
    const classes = await this.getClassesByTeacherId(teacherId);
    const classIds = classes.map((c) => c.id);

    if (classIds.length === 0) {
      return [];
    }

    // 查询这些班级中的学生（通过 enrollment）
    const students = await this.studentRepo
      .createQueryBuilder('student')
      .innerJoin('student.enrollments', 'enrollment')
      .innerJoin('enrollment.class', 'class')
      .where('class.id IN (:...classIds)', { classIds })
      .getMany();

    return students;
  }
}
