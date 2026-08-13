/**
 * 排班冲突工具：判断两个上课安排是否在「星期几交集」+「时段重叠」上冲突。
 * 时间基于 "HH:MM" 字符串字典序比较（与 class.service 原有算法一致）。
 */

export interface ScheduleWindow {
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
}

/** "HH:MM" 字符串时间区间是否重叠（字典序比较）。 */
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * 两个上课安排是否冲突：
 * 星期几有交集，且时段重叠（a.start < a.end && b.start < b.end）。
 */
export function hasScheduleConflict(
  a: ScheduleWindow,
  b: ScheduleWindow,
): boolean {
  if (!a.dayOfWeek.length || !b.dayOfWeek.length) return false;
  const sharedDays = a.dayOfWeek.filter((d) => b.dayOfWeek.includes(d));
  if (sharedDays.length === 0) return false;
  return overlaps(a.startTime, a.endTime, b.startTime, b.endTime);
}
