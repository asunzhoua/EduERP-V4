import { BadRequestException } from '@nestjs/common';
import { validateRuleConfig } from './rule-config.util';

describe('validateRuleConfig 强校验', () => {
  it('PER_LESSON 无 config 允许（回退 baseAmount）', () => {
    expect(validateRuleConfig('PER_LESSON', null)).toBeNull();
  });

  it('PER_LESSON 有 config 时 lessonPrice 必填并四舍五入两位小数', () => {
    const res = validateRuleConfig('PER_LESSON', { lessonPrice: 33.333 });
    expect(res?.lessonPrice).toBe(33.33);
  });

  it('PER_LESSON 缺 lessonPrice 抛错', () => {
    expect(() => validateRuleConfig('PER_LESSON', {})).toThrow(BadRequestException);
  });

  it('PART_TIME / OUTING / PER_DAY 需 lessonPrice', () => {
    expect(() => validateRuleConfig('PART_TIME', {})).toThrow(BadRequestException);
    expect(() => validateRuleConfig('OUTING', {})).toThrow(BadRequestException);
    expect(() => validateRuleConfig('PER_DAY', {})).toThrow(BadRequestException);
    expect(validateRuleConfig('PER_DAY', { lessonPrice: 200 })?.lessonPrice).toBe(200);
  });

  it('PER_HEAD 至少提供 pricePerHead 或 headcountTiers', () => {
    expect(() => validateRuleConfig('PER_HEAD', {})).toThrow(BadRequestException);
    expect(validateRuleConfig('PER_HEAD', { pricePerHead: 25 })?.pricePerHead).toBe(25);
  });

  it('PER_HEAD headcountTiers 校验并排序', () => {
    const res = validateRuleConfig('PER_HEAD', {
      headcountTiers: [
        { min: 4, max: null, pricePerHead: 15 },
        { min: 1, max: 3, pricePerHead: 20 },
      ],
    });
    expect(res?.headcountTiers).toEqual([
      { min: 1, max: 3, pricePerHead: 20 },
      { min: 4, max: null, pricePerHead: 15 },
    ]);
  });

  it('PER_HEAD 首档 min 必须为 1', () => {
    expect(() =>
      validateRuleConfig('PER_HEAD', {
        headcountTiers: [{ min: 2, max: null, pricePerHead: 15 }],
      }),
    ).toThrow(/首档 min 必须为 1/);
  });

  it('TIER 需 lessonTiers，且档位区间不能重叠', () => {
    expect(() => validateRuleConfig('TIER', {})).toThrow(BadRequestException);
    expect(() =>
      validateRuleConfig('TIER', {
        lessonTiers: [
          { min: 1, max: 20, pricePerLesson: 30 },
          { min: 20, max: null, pricePerLesson: 35 }, // 与上一档重叠于 20
        ],
      }),
    ).toThrow(/不能重叠/);
  });

  it('MONTHLY 需 baseSalary', () => {
    expect(() => validateRuleConfig('MONTHLY', {})).toThrow(BadRequestException);
    expect(validateRuleConfig('MONTHLY', { baseSalary: 3000 })?.baseSalary).toBe(3000);
  });

  it('HOURLY 忽略 config 返回 null', () => {
    expect(validateRuleConfig('HOURLY', { lessonPrice: 100 })).toBeNull();
  });

  it('不支持的类型抛错', () => {
    expect(() => validateRuleConfig('UNKNOWN', {})).toThrow(BadRequestException);
  });

  it('effectiveTo 早于 effectiveFrom 抛错', () => {
    expect(() =>
      validateRuleConfig('PER_LESSON', {
        lessonPrice: 80,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-07-01',
      }),
    ).toThrow(/effectiveTo 不能早于/);
  });

  it('baseSalary 与 minLessonForBase 可附加在任意类型', () => {
    const res = validateRuleConfig('PER_LESSON', {
      lessonPrice: 80,
      baseSalary: 2000,
      minLessonForBase: 10,
    });
    expect(res?.baseSalary).toBe(2000);
    expect(res?.minLessonForBase).toBe(10);
  });
});
