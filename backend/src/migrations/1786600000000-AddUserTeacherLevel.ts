import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTeacherLevel1786600000000 implements MigrationInterface {
  name = 'AddUserTeacherLevel1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user：教师等级（用于 salary_rule.teacherLevel 精确匹配）──
    await queryRunner.query(
      `ALTER TABLE user ADD COLUMN teacherLevel varchar(50) NULL AFTER name;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE user DROP COLUMN teacherLevel;`);
  }
}
