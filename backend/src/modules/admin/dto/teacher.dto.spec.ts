import { validate } from 'class-validator';
import { CreateTeacherDto, UpdateTeacherDto } from './teacher.dto';

describe('TeacherDto teacherLevel 枚举约束', () => {
  function validCreate(): CreateTeacherDto {
    const dto = new CreateTeacherDto();
    dto.username = 'teacher1';
    dto.name = '张老师';
    dto.mobile = '13800000001';
    dto.password = 'abc123';
    return dto;
  }

  it('create 合法等级通过', async () => {
    const dto = validCreate();
    dto.teacherLevel = '中级';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('create 非法等级拒绝', async () => {
    const dto = validCreate();
    dto.teacherLevel = '大师';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'teacherLevel')).toBe(true);
  });

  it('create 空串（未设置）通过', async () => {
    const dto = validCreate();
    dto.teacherLevel = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('update 合法等级通过', async () => {
    const dto = new UpdateTeacherDto();
    dto.teacherLevel = '高级';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('update 非法等级拒绝', async () => {
    const dto = new UpdateTeacherDto();
    dto.teacherLevel = '特级教师';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'teacherLevel')).toBe(true);
  });
});
