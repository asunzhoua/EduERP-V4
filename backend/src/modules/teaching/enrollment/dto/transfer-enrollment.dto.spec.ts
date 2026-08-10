import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TransferEnrollmentDto } from './transfer-enrollment.dto';

describe('TransferEnrollmentDto', () => {
  it('空对象校验失败（targetClassCode 必填）', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'targetClassCode')).toBe(true);
  });

  it('targetClassCode 为空串校验失败', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {
      targetClassCode: '',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'targetClassCode')).toBe(true);
  });

  it('targetClassCode 超过 20 字符校验失败', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {
      targetClassCode: 'a'.repeat(21),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'targetClassCode')).toBe(true);
  });

  it('合法 targetClassCode 通过', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {
      targetClassCode: 'CL2026070002',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('带 reason 通过', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {
      targetClassCode: 'CL2026070002',
      reason: '换班',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('reason 超过 500 字符校验失败', async () => {
    const dto = plainToInstance(TransferEnrollmentDto, {
      targetClassCode: 'CL2026070002',
      reason: 'x'.repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
