import { validate } from 'class-validator';
import { CreateSalaryRuleDto, UpdateSalaryRuleDto } from './salary.dto';

describe('SalaryRuleDto teacherLevel 枚举约束', () => {
  function validCreate(): CreateSalaryRuleDto {
    const dto = new CreateSalaryRuleDto();
    dto.name = '固定课时费';
    dto.type = 'PER_LESSON';
    dto.baseAmount = 100;
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

  it('create 省略等级（通用规则）通过', async () => {
    const errors = await validate(validCreate());
    expect(errors).toHaveLength(0);
  });

  it('update 非法等级拒绝', async () => {
    const dto = new UpdateSalaryRuleDto();
    dto.teacherLevel = '任意';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'teacherLevel')).toBe(true);
  });
});
