import { IsEnum, IsNotEmpty } from 'class-validator';
import { StudentStatus } from '../enums/student-status.enum';

export class UpdateStudentStatusDto {
  @IsEnum(StudentStatus)
  @IsNotEmpty()
  status: StudentStatus;
}
