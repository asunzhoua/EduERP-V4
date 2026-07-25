const request = require('./request');

// 申请请假
async function applyLeave(lessonId, data) {
  return request.post(`/lessons/${lessonId}/leave`, data);
}

// 申请停课
async function applySuspend(data) {
  return request.post('/lessons/suspend', data);
}

// 申请补课
async function applyMakeup(lessonId, data) {
  return request.post(`/lessons/${lessonId}/makeup`, data);
}

// 审批通过
async function approveException(exceptionId, data) {
  return request.put(`/lesson-exceptions/${exceptionId}/approve`, data);
}

// 审批拒绝
async function rejectException(exceptionId, data) {
  return request.put(`/lesson-exceptions/${exceptionId}/reject`, data);
}

// 查询异常列表
async function getExceptions(query) {
  return request.get('/lesson-exceptions', query);
}

// 查询异常详情
async function getExceptionDetail(exceptionId) {
  return request.get(`/lesson-exceptions/${exceptionId}`);
}

// 查询补课安排
async function getReschedule(exceptionId) {
  return request.get(`/lesson-exceptions/${exceptionId}/reschedule`);
}

module.exports = {
  applyLeave,
  applySuspend,
  applyMakeup,
  approveException,
  rejectException,
  getExceptions,
  getExceptionDetail,
  getReschedule
};
