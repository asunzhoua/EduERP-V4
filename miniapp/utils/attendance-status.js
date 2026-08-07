// utils/attendance-status.js

// 考勤状态中文文案，与后端 AttendanceStatus 枚举 8 值对齐
const STATUS_TEXT = {
  PRESENT: '到课',
  ABSENT: '缺勤',
  LATE: '迟到',
  LEAVE: '请假',
  SICK: '病假',
  MAKEUP: '补课',
  ONLINE: '线上',
  OFFLINE: '线下'
};

// 未知/待定状态的兜底文案
const UNKNOWN_TEXT = '待确认';

// 考勤状态中文文案（未知状态兜底为「待确认」）
function statusText(status) {
  return STATUS_TEXT[status] || UNKNOWN_TEXT;
}

// 考勤状态样式类（空值映射为 status-null，与 attendance.wxss 现有规则一致）
function statusClass(status) {
  return status ? 'status-' + status : 'status-null';
}

module.exports = {
  statusText: statusText,
  statusClass: statusClass
};
