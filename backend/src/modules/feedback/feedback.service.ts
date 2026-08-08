import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LessonFeedback } from './lesson-feedback.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { User } from '@modules/identity/entities/user.entity';

export interface CreateFeedbackInput {
  lessonId: number;
  studentCode: string;
  teacherId: number;
  content?: string | null;
  performance?: string | null;
  homework?: string | null;
  suggestion?: string | null;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(LessonFeedback)
    private readonly feedbackRepo: Repository<LessonFeedback>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(input: CreateFeedbackInput): Promise<LessonFeedback> {
    // 同一学生同一节课只保留一条反馈：已存在则更新，否则新建
    const existing = await this.feedbackRepo.findOne({
      where: { lessonId: input.lessonId, studentCode: input.studentCode },
    });
    if (existing) {
      existing.content = input.content ?? existing.content;
      existing.performance = input.performance ?? existing.performance;
      existing.homework = input.homework ?? existing.homework;
      existing.suggestion = input.suggestion ?? existing.suggestion;
      return this.feedbackRepo.save(existing);
    }
    const feedback = this.feedbackRepo.create({
      lessonId: input.lessonId,
      studentCode: input.studentCode,
      teacherId: input.teacherId,
      content: input.content ?? null,
      performance: input.performance ?? null,
      homework: input.homework ?? null,
      suggestion: input.suggestion ?? null,
    });
    return this.feedbackRepo.save(feedback);
  }

  /** 家长/学生端：某个学生的课程反馈（按最近反馈在前） */
  async findByStudentCode(
    studentCode: string,
  ): Promise<
    Array<LessonFeedback & {
      lessonDate: string | null;
      startTime: string | null;
      endTime: string | null;
      courseName: string | null;
      className: string | null;
      teacherName: string | null;
    }>
  > {
    const rows = await this.feedbackRepo.find({
      where: { studentCode },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (rows.length === 0) return [];

    const lessonIds = [...new Set(rows.map((r) => r.lessonId))];
    const lessons = await this.lessonRepo.find({ where: { id: In(lessonIds) } });
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    const classCodes = [...new Set(lessons.map((l) => l.classCode))];
    const classes = classCodes.length
      ? await this.classRepo.find({ where: { classCode: In(classCodes) } })
      : [];
    const classMap = new Map(classes.map((c) => [c.classCode, c.name]));

    const courseCodes = [...new Set(lessons.map((l) => l.courseCode))];
    const courses = courseCodes.length
      ? await this.courseRepo.find({ where: { courseCode: In(courseCodes) } })
      : [];
    const courseMap = new Map(courses.map((c) => [c.courseCode, c.name]));

    const teacherIds = [...new Set(rows.map((r) => r.teacherId))];
    const teachers = teacherIds.length
      ? await this.userRepo.find({ where: { id: In(teacherIds) } })
      : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

    return rows.map((r) => {
      const lesson = lessonMap.get(r.lessonId);
      return {
        ...r,
        lessonDate: lesson?.scheduledDate ?? null,
        startTime: lesson?.startTime ?? null,
        endTime: lesson?.endTime ?? null,
        courseName: lesson ? courseMap.get(lesson.courseCode) ?? null : null,
        className: lesson ? classMap.get(lesson.classCode) ?? null : null,
        teacherName: teacherMap.get(r.teacherId) ?? null,
      };
    });
  }

  /** 某节课的反馈（教师端查看自己课堂反馈） */
  async findByLessonId(lessonId: number): Promise<LessonFeedback[]> {
    return this.feedbackRepo.find({
      where: { lessonId },
      order: { createdAt: 'ASC' },
    });
  }
}
