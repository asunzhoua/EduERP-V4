import {
  AccountBookOutlined,
  BarChartOutlined,
  BookOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FileTextOutlined,
  GiftOutlined,
  ReadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { Component } from 'vue'

export interface MenuItem {
  path: string
  title: string
  icon?: Component
  roles?: string[]
}

/**
 * 全部 12 个菜单（与 WebDashboardDesign.md 一致）；MainLayout 仅渲染已有路由且角色可见的项。
 * roles 与后端各 controller @Roles 保持一致（详见 src/router/index.ts 同名字段）。
 */
export const menuItems: MenuItem[] = [
  { path: '/dashboard', title: '首页', icon: DashboardOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/students', title: '学生管理', icon: TeamOutlined, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
  { path: '/teachers', title: '教师管理', icon: UserOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/classes', title: '班级管理', icon: ReadOutlined, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
  { path: '/courses', title: '课程管理', icon: BookOutlined, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
  { path: '/enrollments', title: '报名收费', icon: FileTextOutlined, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
  { path: '/lessons', title: '课时管理', icon: ClockCircleOutlined, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
  { path: '/leave-requests', title: '请假审批', icon: CheckSquareOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/salary', title: '工资管理', icon: AccountBookOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/points-mall', title: '积分商城', icon: GiftOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/analytics', title: '数据中心', icon: BarChartOutlined, roles: ['SuperAdmin', 'Admin'] },
  { path: '/settings', title: '系统设置', icon: SettingOutlined, roles: ['SuperAdmin', 'Admin'] },
]
