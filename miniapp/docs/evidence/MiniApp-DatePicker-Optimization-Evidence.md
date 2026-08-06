# 日期选择器优化 Evidence

## Git Commit
- Hash: 30ce35a（HEAD on master）
- 注：git commit 超时未执行，修改文件已就绪可手动提交

## 修改时间
2026-07-26

## 修改文件
| # | 文件路径 | 修改类型 | 说明 |
|---|----------|----------|------|
| 1 | pages/student/leave-apply/leave-apply.wxml | 替换 | 将 `bindtap="onSelectDate"` 替换为 `<picker mode="date">` 原生组件 |
| 2 | pages/student/leave-apply/leave-apply.js | 替换 | 将 `onSelectDate()`（wx.showModal 模拟弹窗）替换为 `onDateChange(e)` |
| 3 | pages/teacher/leave-apply/leave-apply.wxml | 替换 | 同上，替换为 `<picker mode="date">` 原生组件 |
| 4 | pages/teacher/leave-apply/leave-apply.js | 替换 | 同上，替换为 `onDateChange(e)` |

## 验证结果

### 6.1 功能验证
| 验证项 | 结果 | 说明 |
|--------|------|------|
| 点击日期选择区域 | ✅ | 弹出系统原生日期选择器 |
| 选择日期后显示 | ✅ | 自动显示 YYYY-MM-DD 格式 |
| 提交表单日期格式 | ✅ | `e.detail.value` 返回 `YYYY-MM-DD` |

### 6.2 格式验证
| 验证项 | 结果 |
|--------|------|
| 日期格式 | ✅ YYYY-MM-DD |
| 后端 IsDateString() 兼容 | ✅ |
| 无需额外格式化 | ✅ |

### 6.3 已有的原生组件确认
| 页面 | 状态 |
|------|------|
| pages/teacher/lesson-record | ✅ 已使用 `<picker mode="date">`，无需修改 |

## 代码对比

### Before（模拟弹窗）
```javascript
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
},
```

### After（原生组件）
```javascript
onDateChange(e) {
  this.setData({ selectedDate: e.detail.value });
},
```

### WXML Before
```xml
<view class="picker-wrapper" bindtap="onSelectDate">
  <text class="picker-text">{{selectedDate || '请选择日期'}}</text>
  <text class="picker-arrow">></text>
</view>
```

### WXML After
```xml
<picker mode="date" value="{{selectedDate}}" bindchange="onDateChange" start="2020-01-01" end="2035-12-31">
  <view class="picker-wrapper">
    <text class="picker-text {{selectedDate ? '' : 'placeholder'}}">{{selectedDate || '请选择日期'}}</text>
    <text class="picker-arrow">></text>
  </view>
</picker>
```

## 结论
日期选择器优化完成。模拟弹窗（wx.showModal）已替换为微信原生 `<picker mode="date">` 组件，用户体验得到显著提升。

- 文件修改：4 个（2 个页面 × 2 文件/页）
- 代码行变更：~10 行
- 第三方依赖：无
- 后端影响：无
