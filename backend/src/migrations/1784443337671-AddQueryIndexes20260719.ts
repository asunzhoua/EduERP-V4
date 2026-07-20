import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddQueryIndexes20260719 implements MigrationInterface {
  name = 'AddQueryIndexes20260719';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // student.status
    await queryRunner.createIndex(
      'student',
      new TableIndex({ name: 'idx_student_status', columnNames: ['status'] }),
    );

    // student.deleted
    await queryRunner.createIndex(
      'student',
      new TableIndex({ name: 'idx_student_deleted', columnNames: ['deleted'] }),
    );

    // class.deleted
    await queryRunner.createIndex(
      'class',
      new TableIndex({ name: 'idx_class_deleted', columnNames: ['deleted'] }),
    );

    // course.subject
    await queryRunner.createIndex(
      'course',
      new TableIndex({ name: 'idx_course_subject', columnNames: ['subject'] }),
    );

    // course.type
    await queryRunner.createIndex(
      'course',
      new TableIndex({ name: 'idx_course_type', columnNames: ['type'] }),
    );

    // course.deleted
    await queryRunner.createIndex(
      'course',
      new TableIndex({ name: 'idx_course_deleted', columnNames: ['deleted'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('student', 'idx_student_status');
    await queryRunner.dropIndex('student', 'idx_student_deleted');
    await queryRunner.dropIndex('class', 'idx_class_deleted');
    await queryRunner.dropIndex('course', 'idx_course_subject');
    await queryRunner.dropIndex('course', 'idx_course_type');
    await queryRunner.dropIndex('course', 'idx_course_deleted');
  }
}
