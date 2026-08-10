import { BadRequestException } from '@nestjs/common';
import { SalaryRuleType } from '../enums/salary.enums';

type Tier = {
  min: number;
  max: number | null;
  pricePerLesson?: number;
  pricePerHead?: number;
};

function assertNumber(value: unknown, field: string): void {
  if (
    value === undefined ||
    value === null ||
    typeof value !== 'number' ||
    Number.isNaN(value)
  ) {
    throw new BadRequestException(`config.${field} 必填且必须为数字`);
  }
}

/** 校验阶梯数组：按 min 升序、首档 min=1、max 大于 min、非重叠 */
function assertTiers(
  tiers: Tier[],
  field: string,
  priceField: 'pricePerLesson' | 'pricePerHead',
): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new BadRequestException(`config.${field} 必须为非空数组`);
  }
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  if (sorted[0].min !== 1) {
    throw new BadRequestException(`config.${field} 首档 min 必须为 1`);
  }
  let prevMax: number | null = 0;
  for (const tier of sorted) {
    if (typeof tier.min !== 'number' || tier.min < 1) {
      throw new BadRequestException(`config.${field} 档位 min 必须 >= 1`);
    }
    if (prevMax !== Infinity && tier.min <= prevMax) {
      throw new BadRequestException(
        `config.${field} 档位区间不能重叠，且需按 min 升序`,
      );
    }
    if (tier.max !== null && tier.max !== undefined) {
      if (typeof tier.max !== 'number' || tier.max < tier.min) {
        throw new BadRequestException(`config.${field} 档位 max 必须 >= min`);
      }
      if (tier.max <= prevMax) {
        throw new BadRequestException(
          `config.${field} 档位区间不能重叠，且需按 min 升序`,
        );
      }
      prevMax = tier.max;
    } else {
      // max:null = 最后一档无上限
      prevMax = Infinity;
    }
    if (typeof tier[priceField] !== 'number' || tier[priceField] < 0) {
      throw new BadRequestException(`config.${field} 档位价格必须 >= 0`);
    }
  }
  if (prevMax === Infinity && sorted[sorted.length - 1].max !== null) {
    // 中间档不允许 max:null，只有最后一档可以
    throw new BadRequestException(`config.${field} 只有最后一档可设 max:null`);
  }
}

/**
 * 按规则 type 做 config 互斥与完整性校验（服务层调用）。
 * 返回标准化后的 config（金额统一两位小数）。
 */
export function validateRuleConfig(
  type: string,
  config: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (config === null || config === undefined) {
    // 历史 HOURLY 与纯 PER_LESSON 允许无 config（用 baseAmount*multiplier）
    if (type === SalaryRuleType.HOURLY || type === SalaryRuleType.PER_LESSON) {
      return null;
    }
    throw new BadRequestException(`规则类型 ${type} 必须提供 config 配置`);
  }

  if (
    config.effectiveFrom &&
    config.effectiveTo &&
    config.effectiveTo < config.effectiveFrom
  ) {
    throw new BadRequestException('config.effectiveTo 不能早于 effectiveFrom');
  }

  const result: Record<string, any> = { ...config };

  const round2 = (v: number): number => Math.round(v * 100) / 100;

  switch (type) {
    case SalaryRuleType.PER_LESSON:
    case SalaryRuleType.PART_TIME:
    case SalaryRuleType.OUTING:
    case SalaryRuleType.PER_DAY:
      assertNumber(config.lessonPrice, 'lessonPrice');
      result.lessonPrice = round2(config.lessonPrice);
      break;
    case SalaryRuleType.PER_HEAD:
      if (
        config.pricePerHead === undefined &&
        !Array.isArray(config.headcountTiers)
      ) {
        throw new BadRequestException(
          'PER_HEAD 必须提供 pricePerHead 或 headcountTiers',
        );
      }
      if (config.pricePerHead !== undefined) {
        assertNumber(config.pricePerHead, 'pricePerHead');
        result.pricePerHead = round2(config.pricePerHead);
      }
      if (Array.isArray(config.headcountTiers)) {
        assertTiers(config.headcountTiers, 'headcountTiers', 'pricePerHead');
        result.headcountTiers = [...config.headcountTiers]
          .sort((a, b) => a.min - b.min)
          .map((t) => ({ ...t, pricePerHead: round2(t.pricePerHead) }));
      }
      break;
    case SalaryRuleType.TIER:
      assertTiers(config.lessonTiers, 'lessonTiers', 'pricePerLesson');
      result.lessonTiers = [...config.lessonTiers]
        .sort((a, b) => a.min - b.min)
        .map((t) => ({ ...t, pricePerLesson: round2(t.pricePerLesson) }));
      break;
    case SalaryRuleType.MONTHLY:
      assertNumber(config.baseSalary, 'baseSalary');
      result.baseSalary = round2(config.baseSalary);
      break;
    case SalaryRuleType.HOURLY:
      // 历史类型，忽略 config
      return null;
    default:
      throw new BadRequestException(`不支持的规则类型 ${type}`);
  }

  if (config.baseSalary !== undefined) {
    assertNumber(config.baseSalary, 'baseSalary');
    result.baseSalary = round2(config.baseSalary);
  }
  if (config.minLessonForBase !== undefined) {
    assertNumber(config.minLessonForBase, 'minLessonForBase');
    result.minLessonForBase = config.minLessonForBase;
  }

  return result;
}
