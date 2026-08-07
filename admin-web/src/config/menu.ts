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

/** 全部 12 个菜单（与 WebDashboardDesign.md 一致）；MainLayout 仅渲染已有路由的项 */
export const menuItems: MenuItem[] = [
  { path: '/dashboard', title: '首页', icon: DashboardOutlined },
  { path: '/students', title: '学生管理', icon: TeamOutlined },
  { path: '/teachers', title: '教师管理', icon: UserOutlined },
  { path: '/classes', title: '班级管理', icon: ReadOutlined },
  { path: '/courses', title: '课程管理', icon: BookOutlined },
  { path: '/enrollments', title: '报名收费', icon: FileTextOutlined },
  { path: '/lessons', title: '课时管理', icon: ClockCircleOutlined },
  { path: '/leave-requests', title: '请假审批', icon: CheckSquareOutlined },
  { path: '/salary', title: '工资管理', icon: AccountBookOutlined },
  { path: '/points-mall', title: '积分商城', icon: GiftOutlined },
  { path: '/analytics', title: '数据中心', icon: BarChartOutlined },
  { path: '/settings', title: '系统设置', icon: SettingOutlined },
]
