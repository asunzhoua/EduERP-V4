import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLessonTopicColumn1786060800000 implements MigrationInterface {
    name = 'AddLessonTopicColumn1786060800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lesson\` ADD COLUMN \`topic\` varchar(200) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lesson\` DROP COLUMN \`topic\``);
    }
}
