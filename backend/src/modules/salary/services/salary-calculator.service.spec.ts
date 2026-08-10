import {
  computeLessonFee,
  findLessonTier,
  findHeadcountTier,
  scoreRule,
} from './salary-calculator.service';
import { SalaryRuleType } from '../enums/salary.enums';

describe('SalaryCalculator 纯函数', () => {
  const baseRule = { baseAmount: 100, multiplier: 1 } as any;

  describe('computeLessonFee', () => {
    it('PER_LESSON 用 config.lessonPrice', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_LESSON,
        { lessonPrice: 80 },
        baseRule,
        0,
        0,
      );
      expect(res.amount).toBe(80);
      expect(res.calcFormula).toContain('80');
    });

    it('PER_LESSON 无 config 时回退 baseAmount', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_LESSON,
        null,
        baseRule,
        0,
        0,
      );
      expect(res.amount).toBe(100);
    });

    it('multiplier 参与计算', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_LESSON,
        { lessonPrice: 80 },
        { baseAmount: 0, multiplier: 1.5 },
        0,
        0,
      );
      expect(res.amount).toBe(120);
    });

    it('PART_TIME / OUTING 同固定课时费', () => {
      expect(
        computeLessonFee(
          SalaryRuleType.PART_TIME,
          { lessonPrice: 60 },
          baseRule,
          0,
          0,
        ).amount,
      ).toBe(60);
      expect(
        computeLessonFee(
          SalaryRuleType.OUTING,
          { lessonPrice: 150 },
          baseRule,
          0,
          0,
        ).amount,
      ).toBe(150);
    });

    it('PER_HEAD 按 headcountTiers 阶梯', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_HEAD,
        {
          headcountTiers: [
            { min: 1, max: 3, pricePerHead: 20 },
            { min: 4, max: null, pricePerHead: 15 },
          ],
        },
        baseRule,
        5,
        0,
      );
      expect(res.amount).toBe(75); // 15 * 5
      expect(res.tierLevel).toBe(2);
    });

    it('PER_HEAD 超出所有档位取最后一档', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_HEAD,
        { headcountTiers: [{ min: 1, max: 3, pricePerHead: 20 }] },
        baseRule,
        10,
        0,
      );
      expect(res.amount).toBe(200); // 20 * 10
    });

    it('PER_HEAD 无 tier 用 pricePerHead', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_HEAD,
        { pricePerHead: 25 },
        baseRule,
        4,
        0,
      );
      expect(res.amount).toBe(100);
    });

    it('TIER 按累计课时档位计费', () => {
      const res = computeLessonFee(
        SalaryRuleType.TIER,
        {
          lessonTiers: [
            { min: 1, max: 20, pricePerLesson: 30 },
            { min: 21, max: null, pricePerLesson: 35 },
          ],
        },
        baseRule,
        0,
        21, // 第 21 节课
      );
      expect(res.amount).toBe(35);
      expect(res.tierLevel).toBe(2);
    });

    it('TIER 无 lessonTiers 返回 0', () => {
      const res = computeLessonFee(SalaryRuleType.TIER, null, baseRule, 0, 5);
      expect(res.amount).toBe(0);
      expect(res.calcFormula).toContain('no-lessonTiers');
    });

    it('HOURLY 历史遗留按 baseAmount * multiplier', () => {
      const res = computeLessonFee(
        SalaryRuleType.HOURLY,
        null,
        { baseAmount: 50, multiplier: 2 },
        0,
        0,
      );
      expect(res.amount).toBe(100);
    });

    it('金额保留两位小数', () => {
      const res = computeLessonFee(
        SalaryRuleType.PER_LESSON,
        { lessonPrice: 33.333 },
        baseRule,
        0,
        0,
      );
      expect(res.amount).toBe(33.33);
    });
  });

  describe('findLessonTier', () => {
    const tiers = [
      { min: 1, max: 20, pricePerLesson: 30 },
      { min: 21, max: null, pricePerLesson: 35 },
    ];

    it('命中第一档', () => {
      const hit = findLessonTier(tiers, 5);
      expect(hit?.level).toBe(1);
      expect(hit?.tier.pricePerLesson).toBe(30);
    });

    it('命中第二档', () => {
      const hit = findLessonTier(tiers, 25);
      expect(hit?.level).toBe(2);
    });

    it('空 tiers 返回 null', () => {
      expect(findLessonTier([], 10)).toBeNull();
    });
  });

  describe('findHeadcountTier', () => {
    it('命中人数档位', () => {
      const hit = findHeadcountTier(
        [
          { min: 1, max: 3, pricePerHead: 20 },
          { min: 4, max: null, pricePerHead: 15 },
        ],
        3,
      );
      expect(hit?.level).toBe(1);
    });
  });

  describe('scoreRule 四级匹配', () => {
    const courseOnly = { courseType: '1v1', teacherLevel: null } as any;
    const levelOnly = { courseType: null, teacherLevel: 'S' } as any;
    const both = { courseType: '1v1', teacherLevel: 'S' } as any;
    const general = { courseType: null, teacherLevel: null } as any;

    it('courseType+teacherLevel 都匹配 = 4', () => {
      expect(scoreRule(both, '1v1', 'S')).toBe(4);
    });

    it('仅 courseType = 3', () => {
      expect(scoreRule(courseOnly, '1v1', null)).toBe(3);
    });

    it('仅 teacherLevel = 2', () => {
      expect(scoreRule(levelOnly, null, 'S')).toBe(2);
    });

    it('通用规则 = 1', () => {
      expect(scoreRule(general, '1v1', 'S')).toBe(1);
    });

    it('不匹配 = 0', () => {
      expect(scoreRule(courseOnly, 'GROUP', null)).toBe(0);
    });

    it('teacherLevel 未知时限定等级的规则不匹配', () => {
      expect(scoreRule(levelOnly, null, null)).toBe(0);
    });
  });
});
