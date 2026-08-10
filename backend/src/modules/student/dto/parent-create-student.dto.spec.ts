import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ParentCreateStudentDto } from './parent-create-student.dto';

describe('ParentCreateStudentDto', () => {
  const valid = () => ({
    name: '小明',
    gender: 'MALE',
    birthDate: '2018-06-15',
    grade: '三年级',
  });

  it('合法对象通过校验', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, valid());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('缺 grade 校验失败', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      grade: undefined,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('grade');
  });

  it('非法 gender 校验失败', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      gender: 'OTHER',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('gender');
  });

  it('非法 birthDate 校验失败', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      birthDate: '2020-13-45',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('缺 name 校验失败', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      name: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('school 选填，缺省通过', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, valid());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('classCode 选填，缺省通过', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, valid());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('classCode 合法字符串通过', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      classCode: 'CL2026070001',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('classCode 超过 20 字符校验失败', async () => {
    const dto = plainToInstance(ParentCreateStudentDto, {
      ...valid(),
      classCode: 'X'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('classCode');
  });
});
