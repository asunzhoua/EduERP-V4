import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLessonExceptionTables1784976182868 implements MigrationInterface {
    name = 'AddLessonExceptionTables1784976182868'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`lesson_exceptions\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`lessonId\` bigint NOT NULL, \`exceptionType\` varchar(32) NOT NULL, \`reason\` varchar(500) NOT NULL, \`startTime\` datetime NOT NULL, \`endTime\` datetime NULL, \`status\` varchar(32) NOT NULL DEFAULT 'PENDING', \`attachments\` json NULL, \`createdBy\` bigint NOT NULL, \`approvedBy\` bigint NULL, \`approvedAt\` datetime NULL, \`rejectReason\` varchar(500) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_created_at\` (\`createdAt\`), INDEX \`idx_created_by\` (\`createdBy\`), INDEX \`idx_status\` (\`status\`), INDEX \`idx_exception_type\` (\`exceptionType\`), INDEX \`idx_lesson_id\` (\`lessonId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`lesson_exception_attachments\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`exceptionId\` bigint NOT NULL, \`fileType\` varchar(16) NOT NULL, \`fileUrl\` varchar(500) NOT NULL, \`originalName\` varchar(255) NOT NULL, \`uploadedAt\` datetime NOT NULL, \`uploadedBy\` bigint NOT NULL, INDEX \`idx_exception_id\` (\`exceptionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`lesson_exception_logs\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`exceptionId\` bigint NOT NULL, \`fromStatus\` varchar(32) NOT NULL, \`toStatus\` varchar(32) NOT NULL, \`operatorType\` varchar(16) NOT NULL DEFAULT 'USER', \`operatorId\` bigint NULL, \`operatedAt\` datetime NOT NULL, \`remark\` varchar(500) NULL, INDEX \`idx_operated_at\` (\`operatedAt\`), INDEX \`idx_exception_id\` (\`exceptionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`lesson_reschedules\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`exceptionId\` bigint NOT NULL, \`originalLessonId\` bigint NOT NULL, \`newLessonId\` bigint NULL, \`originalStart\` datetime NOT NULL, \`originalEnd\` datetime NOT NULL, \`rescheduledStart\` datetime NOT NULL, \`rescheduledEnd\` datetime NOT NULL, \`status\` varchar(32) NOT NULL DEFAULT 'PENDING', \`operatorId\` bigint NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_new_lesson\` (\`newLessonId\`), INDEX \`idx_original_lesson\` (\`originalLessonId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`lesson_exceptions\` ADD CONSTRAINT \`FK_23f4832b33cf945113acb4b5ba8\` FOREIGN KEY (\`lessonId\`) REFERENCES \`lesson\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_exception_attachments\` ADD CONSTRAINT \`FK_b50571f5681bfb5fae519830e13\` FOREIGN KEY (\`exceptionId\`) REFERENCES \`lesson_exceptions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_exception_logs\` ADD CONSTRAINT \`FK_8713f30483fb59627f21db84e58\` FOREIGN KEY (\`exceptionId\`) REFERENCES \`lesson_exceptions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` ADD CONSTRAINT \`FK_197c99f5d6d3879112d5434f8c9\` FOREIGN KEY (\`exceptionId\`) REFERENCES \`lesson_exceptions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` ADD CONSTRAINT \`FK_f1ceb1a39eed07c2d503f13e72d\` FOREIGN KEY (\`originalLessonId\`) REFERENCES \`lesson\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` ADD CONSTRAINT \`FK_2d17b84fe2660e6083c8999fb8c\` FOREIGN KEY (\`newLessonId\`) REFERENCES \`lesson\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` DROP FOREIGN KEY \`FK_2d17b84fe2660e6083c8999fb8c\``);
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` DROP FOREIGN KEY \`FK_f1ceb1a39eed07c2d503f13e72d\``);
        await queryRunner.query(`ALTER TABLE \`lesson_reschedules\` DROP FOREIGN KEY \`FK_197c99f5d6d3879112d5434f8c9\``);
        await queryRunner.query(`ALTER TABLE \`lesson_exception_logs\` DROP FOREIGN KEY \`FK_8713f30483fb59627f21db84e58\``);
        await queryRunner.query(`ALTER TABLE \`lesson_exception_attachments\` DROP FOREIGN KEY \`FK_b50571f5681bfb5fae519830e13\``);
        await queryRunner.query(`ALTER TABLE \`lesson_exceptions\` DROP FOREIGN KEY \`FK_23f4832b33cf945113acb4b5ba8\``);
        await queryRunner.query(`DROP INDEX \`idx_original_lesson\` ON \`lesson_reschedules\``);
        await queryRunner.query(`DROP INDEX \`idx_new_lesson\` ON \`lesson_reschedules\``);
        await queryRunner.query(`DROP TABLE \`lesson_reschedules\``);
        await queryRunner.query(`DROP INDEX \`idx_exception_id\` ON \`lesson_exception_logs\``);
        await queryRunner.query(`DROP INDEX \`idx_operated_at\` ON \`lesson_exception_logs\``);
        await queryRunner.query(`DROP TABLE \`lesson_exception_logs\``);
        await queryRunner.query(`DROP INDEX \`idx_exception_id\` ON \`lesson_exception_attachments\``);
        await queryRunner.query(`DROP TABLE \`lesson_exception_attachments\``);
        await queryRunner.query(`DROP INDEX \`idx_lesson_id\` ON \`lesson_exceptions\``);
        await queryRunner.query(`DROP INDEX \`idx_exception_type\` ON \`lesson_exceptions\``);
        await queryRunner.query(`DROP INDEX \`idx_status\` ON \`lesson_exceptions\``);
        await queryRunner.query(`DROP INDEX \`idx_created_by\` ON \`lesson_exceptions\``);
        await queryRunner.query(`DROP INDEX \`idx_created_at\` ON \`lesson_exceptions\``);
        await queryRunner.query(`DROP TABLE \`lesson_exceptions\``);
    }

}
