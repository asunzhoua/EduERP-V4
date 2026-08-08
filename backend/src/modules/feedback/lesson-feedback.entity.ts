import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * 课程反馈（教师课后填写，家长只读）。
 * 对应设计文档「课程反馈」：课程名称/老师/课堂内容/课堂表现/家庭作业/老师建议。
 * 课程名称与老师通过 lesson → class/course/teacher 联表推导，此处仅存业务字段。
 */
@Entity('lesson_feedback')
@Unique(['lessonId', 'studentCode'])
export class LessonFeedback {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'lessonId' })
  @Index()
  lessonId: number;

  @Column({ type: 'varchar', length: 20, name: 'studentCode' })
  @Index()
  studentCode: string;

  @Column({ type: 'bigint', name: 'teacherId' })
  @Index()
  teacherId: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  performance: string | null;

  @Column({ type: 'text', nullable: true })
  homework: string | null;

  @Column({ type: 'text', nullable: true })
  suggestion: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
