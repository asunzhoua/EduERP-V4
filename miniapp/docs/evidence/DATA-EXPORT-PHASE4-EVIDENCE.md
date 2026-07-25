# Phase 4 Evidence

## 实现内容
- 导出工具函数 (`utils/export.js`)
- Dashboard 页面添加导出按钮（权限控制：仅管理员可见）
- 5 个导出功能
- 后端 API 调用支持（`utils/request.js` 增加 `responseType` 支持）

## 文件列表
- utils/export.js (**新建**)
- utils/request.js (修改 — 增加 `responseType` 和 extraOptions 支持)
- pages/operation/dashboard/dashboard.wxml (修改 — 添加导出区域)
- pages/operation/dashboard/dashboard.js (修改 — 添加导出逻辑与权限控制)
- pages/operation/dashboard/dashboard.wxss (修改 — 添加导出按钮样式)

## 导出功能
- 导出学生数据 → `POST /export/students`
- 导出课程记录 → `POST /export/lessons`
- 导出课时消耗 → `POST /export/consumption`
- 导出工资记录 → `POST /export/salary`
- 导出财务记录 → `POST /export/finance`

## 权限控制
- `onLoad` 中读取 `userInfo.role`，仅 `ADMIN` 角色展示导出区域
- 非管理员用户完全看不到导出按钮

## Git Commit
- Hash: $(git rev-parse HEAD)

## 结论
Phase 4 前端导出功能完成。
