import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { StudentController } from './student.controller';
import { StudentService } from './services/student.service';
import { StudentCodeGeneratorService } from './services/student-code-generator.service';
import { StudentRepository } from './student.repository';
import { Student } from './entities/student.entity';
import { StudentParent } from './entities/student-parent.entity';
import { StudentAuditLog } from './entities/student-audit-log.entity';
import { ImportHistory } from './entities/import-history.entity';
import { ImportService } from '@utils/services/import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, StudentParent, StudentAuditLog, ImportHistory]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [StudentController],
  providers: [
    StudentService,
    StudentCodeGeneratorService,
    StudentRepository,
    ImportService,
  ],
  exports: [StudentService, StudentRepository],
})
export class StudentModule {}
