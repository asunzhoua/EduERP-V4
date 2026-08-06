# 日期选择器 Reality Check

## 检查时间
2026-07-26

## 1. 使用日期选择的页面

### 1.1 页面列表
| 页面 | 文件路径 | 当前实现 | 说明 |
|------|----------|----------|------|
| 学生端请假申请 | pages/student/leave-apply | ❌ 模拟弹窗（wx.showModal） | 选择请假日期 |
| 教师端停课申请 | pages/teacher/leave-apply | ❌ 模拟弹窗（wx.showModal） | 选择停课日期 |
| 教师端课时记录 | pages/teacher/lesson-record | ✅ 原生 `<picker mode="date">` | 已使用真实组件 |

### 1.2 当前模拟弹窗实现
```javascript
// 模拟弹窗实现（student/leave-apply & teacher/leave-apply）
onSelectDate() {
  wx.showModal({
    title: '提示',
    content: '请选择请假日期（示例功能：实际接入日期选择器）',
    success: (res) => {
      if (res.confirm) {
        const now = new Date();
        const dateStr = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0');
        this.setData({ selectedDate: dateStr });
      }
    }
  });
}
```

**问题**：
- ❌ 用户体验差 — 弹窗输入不支持日期选择交互
- ❌ 无日期校验 — 只能获取当前日期，用户不可选其他日期
- ❌ 格式不统一 — 手动拼接日期字符串

### 1.3 不存在的页面（任务模板提及但项目实际不存在）
| 模板路径 | 实际情况 |
|----------|----------|
| pages/parent/leave-apply | ❌ 不存在 |-> 学生端家长角色共用 student/leave-apply |
| pages/teacher/makeup | ❌ 不存在 |-> makeup 数据仅在 my-exceptions 列表显示 |
| pages/teacher/course-create | ❌ 不存在 |-> courses.js 中 createCourse() 仅显示"功能开发中" |

## 2. 后端接口要求

### 2.1 后端 DTO 日期字段
| DTO | 接口 | 字段 | 校验注解 | 说明 |
|-----|------|------|----------|------|
| ApplyLeaveDto | POST /lessons/:id/leave | startTime, endTime | @IsDateString() | ISO 8601 日期字符串 |
| ApplySuspendDto | POST /lessons/suspend | startTime, endTime | @IsDateString() | ISO 8601 日期字符串 |
| ApplyMakeupDto | POST /lessons/:id/makeup | rescheduledStart, rescheduledEnd | @IsDateString() | ISO 8601 日期字符串 |

### 2.2 前端实际发送格式
- 学生请假：`applyLeave(lessonId, { type: leaveType, date: selectedDate, reason, attachments })` → 字段 `date: "YYYY-MM-DD"`
- 教师停课：`applySuspend({ classId, type, date, reason })` → 字段 `date: "YYYY-MM-DD"`

**格式要求**：`YYYY-MM-DD`（前端发送的 `date` 字段与后端 `startTime`/`endTime` 之间可能存在适配层转换）

## 3. 可用组件

### 3.1 微信小程序原生组件
```xml
<picker mode="date" value="{{date}}" bindchange="onDateChange">
  <view class="picker">{{date || '选择日期'}}</view>
</picker>
```

**优点**：
- ✅ 原生支持，基础库 1.0.0+ 即兼容
- ✅ 用户体验好 — 系统级日期滚轮
- ✅ 自动日期校验
- ✅ 格式统一 — 返回 YYYY-MM-DD

**缺点**：
- ⚠️ 样式定制有限

### 3.2 可选的第三方组件
- Vant Weapp DatetimePicker
- TDesign DatePicker

**结论**：原生 `<picker mode="date">` 已满足需求，无需引入第三方组件

## 4. 修改计划

### 4.1 需要修改的文件
| # | 文件 | 修改内容 |
|---|------|----------|
| 1 | pages/student/leave-apply/leave-apply.wxml | 替换日期选择 UI |
| 2 | pages/student/leave-apply/leave-apply.js | 替换 onSelectDate → onDateChange |
| 3 | pages/teacher/leave-apply/leave-apply.wxml | 替换日期选择 UI |
| 4 | pages/teacher/leave-apply/leave-apply.js | 替换 onSelectDate → onDateChange |
| 5 | pages/teacher/lesson-record/* | ✅ 已使用原生组件，无需修改 |

### 4.2 实现方案

**WXML 改动**：
```xml
<!-- Before: -->
<view class="picker-wrapper" bindtap="onSelectDate">
  <text class="picker-text">{{selectedDate || '请选择日期'}}</text>
  <text class="picker-arrow">></text>
</view>

<!-- After: -->
<picker mode="date" value="{{selectedDate}}" bindchange="onDateChange">
  <view class="picker-wrapper">
    <text class="picker-text {{selectedDate ? '' : 'placeholder'}}">{{selectedDate || '请选择日期'}}</text>
    <text class="picker-arrow">></text>
  </view>
</picker>
```

**JS 改动**：
```javascript
// Before:
onSelectDate() {
  wx.showModal({
    title: '提示',
    content: '请选择请假日期（示例功能：实际接入日期选择器）',
    success: (res) => {
      if (res.confirm) {
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + ...;
        this.setData({ selectedDate: dateStr });
      }
    }
  });
},

// After:
onDateChange(e) {
  this.setData({ selectedDate: e.detail.value });
},
```

### 4.3 日期格式
- 原生 `<picker mode="date">` 默认返回 `YYYY-MM-DD` 格式
- 与后端期望格式一致
- 无需额外格式化处理

## 5. 风险评估

### 5.1 影响范围
- ✅ 仅修改前端 UI 层
- ✅ 不涉及后端业务逻辑
- ✅ 不影响其他页面功能

### 5.2 兼容性
- ✅ `<picker mode="date">` 微信基础库 1.0.0+ 支持
- ✅ 向下兼容所有微信版本

### 5.3 回滚方案
- 仅修改 4 个文件，回滚只需恢复原文件即可
- 无数据库变更

## 6. 结论

**当前状态**：
- 2 个页面使用 `wx.showModal` 模拟日期选择
- 1 个页面（lesson-record）已使用原生 `<picker mode="date">`

**修改方案**：
- 替换 2 个页面的模拟弹窗为原生 `<picker mode="date">`
- 修改 4 个文件
- 日期格式保持 `YYYY-MM-DD`

**预计工作量**：
- 修改 4 个文件
- 新增/修改 ~10 行代码
- 无需第三方库
