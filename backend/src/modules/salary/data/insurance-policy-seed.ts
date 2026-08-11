/**
 * 五险一金政策内置种子库（「一键导入新版本」的数据来源）
 *
 * 重要说明：
 * 1. 以下数值为常见城市**约数**（个人比例/基数上下限），仅作起步默认，**上线前请管理员按当地人社局/公积金中心最新标准核校**；
 * 2. 中国无官方统一社保 API，比例/基数每年（多为 7 月）调整，系统通过「版本化 + 生效区间」适应政策变化；
 * 3. 管理端可对导入后的版本再编辑，或直接新增/导入新版本，历史版本永不覆盖。
 */
export interface InsurancePolicySeed {
  city: string;
  name: string;
  effectiveFrom: string;
  socialBaseMin: number;
  socialBaseMax: number;
  /** 默认估算基数（教师档案可覆盖） */
  socialBase: number;
  /** 个人比例 */
  ratios: {
    pension: number;
    medical: number;
    unemployment: number;
    housingFund: number;
  };
  /** 单位比例（留档参考） */
  employerRatios: {
    pension: number;
    medical: number;
    unemployment: number;
    injury: number;
    maternity: number;
    housingFund: number;
  };
}

export const INSURANCE_POLICY_SEED: InsurancePolicySeed[] = [
  {
    city: '北京',
    name: '北京 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 6821,
    socialBaseMax: 35283,
    socialBase: 11000,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.12,
    },
    employerRatios: {
      pension: 0.16,
      medical: 0.09,
      unemployment: 0.005,
      injury: 0.004,
      maternity: 0.008,
      housingFund: 0.12,
    },
  },
  {
    city: '上海',
    name: '上海 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 7384,
    socialBaseMax: 36921,
    socialBase: 12000,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.07,
    },
    employerRatios: {
      pension: 0.16,
      medical: 0.095,
      unemployment: 0.005,
      injury: 0.0026,
      maternity: 0.01,
      housingFund: 0.07,
    },
  },
  {
    city: '广州',
    name: '广州 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 5284,
    socialBaseMax: 26421,
    socialBase: 9000,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.002,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.14,
      medical: 0.055,
      unemployment: 0.003,
      injury: 0.002,
      maternity: 0.003,
      housingFund: 0.05,
    },
  },
  {
    city: '深圳',
    name: '深圳 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 3523,
    socialBaseMax: 26421,
    socialBase: 9500,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.003,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.14,
      medical: 0.052,
      unemployment: 0.007,
      injury: 0.0014,
      maternity: 0.0045,
      housingFund: 0.05,
    },
  },
  {
    city: '成都',
    name: '成都 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 4511,
    socialBaseMax: 22555,
    socialBase: 7500,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.004,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.16,
      medical: 0.075,
      unemployment: 0.006,
      injury: 0.003,
      maternity: 0.008,
      housingFund: 0.05,
    },
  },
  {
    city: '杭州',
    name: '杭州 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 3957,
    socialBaseMax: 19783,
    socialBase: 8000,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.14,
      medical: 0.095,
      unemployment: 0.005,
      injury: 0.002,
      maternity: 0.009,
      housingFund: 0.05,
    },
  },
  {
    city: '宁波',
    name: '宁波 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 4500,
    socialBaseMax: 22500,
    socialBase: 8000,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.07,
    },
    employerRatios: {
      pension: 0.14,
      medical: 0.095,
      unemployment: 0.005,
      injury: 0.002,
      maternity: 0.007,
      housingFund: 0.07,
    },
  },
  {
    city: '武汉',
    name: '武汉 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 4224,
    socialBaseMax: 21120,
    socialBase: 7500,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.003,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.16,
      medical: 0.08,
      unemployment: 0.007,
      injury: 0.003,
      maternity: 0.007,
      housingFund: 0.05,
    },
  },
  {
    city: '郑州',
    name: '郑州 2026 年度社保公积金默认',
    effectiveFrom: '2026-01-01',
    socialBaseMin: 3200,
    socialBaseMax: 15960,
    socialBase: 6500,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.003,
      housingFund: 0.05,
    },
    employerRatios: {
      pension: 0.16,
      medical: 0.08,
      unemployment: 0.007,
      injury: 0.003,
      maternity: 0.008,
      housingFund: 0.05,
    },
  },
];
