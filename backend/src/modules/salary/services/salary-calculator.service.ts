import { Injectable } from '@nestjs/common';
import { SalaryRuleConfigDto } from '../dto/salary-rule-config.dto';
import { SalaryRuleEntity } from '../entities/salary-rule.entity';
import { SalaryRuleType } from '../enums/salary.enums';

export interface FeeResult {
  amount: number;
  tierLevel?: number;
  calcFormula: string;
}

type Tier = {
  min: number;
  max: number | null;
  pricePerLesson?: number;
  pricePerHead?: number;
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * 按累计课时数定位课时阶梯档位（TIER）。
 * 超出所有 max → 取最后一档价格。
 */
export function findLessonTier(
  tiers: Tier[],
  cumulativeCount: number,
): { tier: Tier; level: number } | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (
      cumulativeCount >= t.min &&
      (t.max === null || t.max === undefined || cumulativeCount <= t.max)
    ) {
      return { tier: t, level: i + 1 };
    }
  }
  // 超出所有档位上限 → 最后一档
  const last = sorted[sorted.length - 1];
  return { tier: last, level: sorted.length };
}

/**
 * 按出勤人数定位人数阶梯档位（PER_HEAD）。
 * 超出所有 max → 取最后一档价格。
 */
export function findHeadcountTier(
  tiers: Tier[],
  headcount: number,
): { tier: Tier; level: number } | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (
      headcount >= t.min &&
      (t.max === null || t.max === undefined || headcount <= t.max)
    ) {
      return { tier: t, level: i + 1 };
    }
  }
  const last = sorted[sorted.length - 1];
  return { tier: last, level: sorted.length };
}

/** 纯函数课时费计算（无副作用，便于单测）。 */
export function computeLessonFee(
  type: SalaryRuleType,
  config: SalaryRuleConfigDto | null,
  rule: Pick<SalaryRuleEntity, 'baseAmount' | 'multiplier'>,
  headcount: number,
  monthlyLessonCount: number,
): FeeResult {
  switch (type) {
    case SalaryRuleType.PER_LESSON:
    case SalaryRuleType.PART_TIME:
    case SalaryRuleType.OUTING: {
      const price = config?.lessonPrice ?? Number(rule.baseAmount);
      return {
        amount: round2(price * Number(rule.multiplier)),
        calcFormula: `lessonPrice(${price})`,
      };
    }
    case SalaryRuleType.HOURLY: {
      // 历史遗留：按 baseAmount * multiplier
      return {
        amount: round2(Number(rule.baseAmount) * Number(rule.multiplier)),
        calcFormula: `baseAmount(${rule.baseAmount})*multiplier(${rule.multiplier})`,
      };
    }
    case SalaryRuleType.PER_HEAD: {
      const tiers: Tier[] | undefined = config?.headcountTiers;
      if (tiers && tiers.length > 0) {
        const hit = findHeadcountTier(tiers, headcount);
        const pricePerHead =
          hit?.tier.pricePerHead ?? config?.pricePerHead ?? 0;
        return {
          amount: round2(pricePerHead * headcount),
          tierLevel: hit?.level,
          calcFormula: `pricePerHead(${pricePerHead})*headcount(${headcount})`,
        };
      }
      const pricePerHead = config?.pricePerHead ?? 0;
      return {
        amount: round2(pricePerHead * headcount),
        calcFormula: `pricePerHead(${pricePerHead})*headcount(${headcount})`,
      };
    }
    case SalaryRuleType.TIER: {
      const tiers: Tier[] | undefined = config?.lessonTiers;
      if (!tiers || tiers.length === 0) {
        return { amount: 0, calcFormula: 'no-lessonTiers' };
      }
      const hit = findLessonTier(tiers, monthlyLessonCount);
      return {
        amount: round2((hit?.tier.pricePerLesson ?? 0) * 1),
        tierLevel: hit?.level,
        calcFormula: `tier(${hit?.level}) pricePerLesson(${hit?.tier.pricePerLesson}) count(${monthlyLessonCount})`,
      };
    }
    default:
      return { amount: 0, calcFormula: 'unsupported-type' };
  }
}

/**
 * 规则匹配评分（越大越精确）：
 *   courseType + teacherLevel 都匹配 = 4
 *   仅 courseType = 3
 *   仅 teacherLevel = 2
 *   通用规则（两者都未限定）= 1
 * 教师等级未知时，限定 teacherLevel 的规则该维度不匹配。
 * 任一显式限定维度不匹配 → 该规则整体不命中（0）。
 */
export function scoreRule(
  rule: Pick<SalaryRuleEntity, 'courseType' | 'teacherLevel'>,
  courseType: string | null,
  teacherLevel: string | null,
): number {
  const ctMatch = !rule.courseType || rule.courseType === courseType;
  const tlMatch =
    !rule.teacherLevel ||
    (teacherLevel !== null && rule.teacherLevel === teacherLevel);
  if (!ctMatch || !tlMatch) return 0;
  if (rule.courseType && rule.teacherLevel) return 4;
  if (rule.courseType) return 3;
  if (rule.teacherLevel) return 2;
  return 1;
}

@Injectable()
export class SalaryCalculator {
  static computeLessonFee = computeLessonFee;
  static findLessonTier = findLessonTier;
  static findHeadcountTier = findHeadcountTier;
  static scoreRule = scoreRule;
}
