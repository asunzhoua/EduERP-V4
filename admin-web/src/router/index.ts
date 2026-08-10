import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createPermissionGuard } from './permission'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页', icon: 'DashboardOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'students',
        name: 'Students',
        component: () => import('@/views/student/index.vue'),
        meta: { title: '学生管理', icon: 'TeamOutlined', roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'students/:id',
        name: 'StudentDetail',
        component: () => import('@/views/student/detail.vue'),
        meta: { title: '学生详情', icon: 'TeamOutlined', hidden: true, roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'teachers',
        name: 'Teachers',
        component: () => import('@/views/teacher/index.vue'),
        meta: { title: '教师管理', icon: 'UserOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'parents',
        name: 'Parents',
        component: () => import('@/views/parent/index.vue'),
        meta: { title: '家长管理', icon: 'ContactsOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'classes',
        name: 'Classes',
        component: () => import('@/views/class/index.vue'),
        meta: { title: '班级管理', icon: 'ReadOutlined', roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'courses',
        name: 'Courses',
        component: () => import('@/views/course/index.vue'),
        meta: { title: '课程管理', icon: 'BookOutlined', roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'enrollments',
        name: 'Enrollments',
        component: () => import('@/views/enrollment/index.vue'),
        meta: { title: '报名收费', icon: 'FileTextOutlined', roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'lessons',
        name: 'Lessons',
        component: () => import('@/views/lesson/index.vue'),
        meta: { title: '课时管理', icon: 'ClockCircleOutlined', roles: ['SuperAdmin', 'Admin', 'Teacher'] },
      },
      {
        path: 'leave-requests',
        name: 'LeaveRequests',
        component: () => import('@/views/leave/index.vue'),
        meta: { title: '请假审批', icon: 'CheckSquareOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/salary/index.vue'),
        meta: { title: '工资管理', icon: 'AccountBookOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'points-mall',
        name: 'PointsMall',
        component: () => import('@/views/points/index.vue'),
        meta: { title: '积分商城', icon: 'GiftOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('@/views/analytics/index.vue'),
        meta: { title: '数据中心', icon: 'BarChartOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings/index.vue'),
        meta: { title: '系统设置', icon: 'SettingOutlined', roles: ['SuperAdmin', 'Admin'] },
      },
    ],
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/Forbidden.vue'),
    meta: { title: '无权访问', public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '页面不存在', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(
  createPermissionGuard(() => {
    const auth = useAuthStore()
    return { token: auth.token, role: auth.user?.role }
  }),
)

export default router
