import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * lesson 表增加 source 列（课时来源标记）。
 * ADMIN_BATCH=管理员批量排课 / ADMIN_MANUAL=管理员手动创建 / TEACHER_MANUAL=教师端手动创建。
 * 默认 ADMIN_MANUAL，兼容存量数据。
 */
export class AddLessonSourceColumn1786700000000 implements MigrationInterface {
  name = 'AddLessonSourceColumn1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lesson
        ADD COLUMN source ENUM('ADMIN_BATCH','ADMIN_MANUAL','TEACHER_MANUAL')
        NOT NULL DEFAULT 'ADMIN_MANUAL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE lesson DROP COLUMN source`);
  }
}
