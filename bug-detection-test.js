/**
 * Bug Detection Test Script
 * 测试三类角色完整流程
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api/v1';

const results = [];

function log(test, status, detail) {
  results.push({ test, status, detail, time: new Date().toISOString() });
  console.log(`[${status}] ${test}: ${detail}`);
}

async function request(method, path, token = null, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== Bug Detection Test ===\n');

  // 1. Student Flow
  console.log('1. Student Flow Test');
  const studentLogin = await request('POST', '/auth/login', null, {
    username: 'student1',
    password: 'Student@Dev2026'
  });
  
  if (studentLogin.status === 200 && studentLogin.data.code === 0) {
    log('Student Login', 'PASS', `Status ${studentLogin.status}`);
    const studentToken = studentLogin.data.data.accessToken;

    const studentSelf = await request('GET', '/students/self', studentToken);
    log('Student Self', studentSelf.status === 200 ? 'PASS' : 'FAIL', `Status ${studentSelf.status}`);

    const studentContracts = await request('GET', '/students/self/contracts', studentToken);
    log('Student Contracts', studentContracts.status === 200 ? 'PASS' : 'FAIL', `Status ${studentContracts.status}`);

    const studentLessons = await request('GET', '/students/self/lessons', studentToken);
    log('Student Lessons', studentLessons.status === 200 ? 'PASS' : 'FAIL', `Status ${studentLessons.status}`);

    const studentAttendance = await request('GET', '/students/self/attendance', studentToken);
    log('Student Attendance', studentAttendance.status === 200 ? 'PASS' : 'FAIL', `Status ${studentAttendance.status}`);
  } else {
    log('Student Login', 'FAIL', `Status ${studentLogin.status}`);
  }

  console.log();

  // 2. Teacher Flow
  console.log('2. Teacher Flow Test');
  const teacherLogin = await request('POST', '/auth/login', null, {
    username: 'teacher1',
    password: 'Teacher@Dev2026'
  });

  if (teacherLogin.status === 200 && teacherLogin.data.code === 0) {
    log('Teacher Login', 'PASS', `Status ${teacherLogin.status}`);
    const teacherToken = teacherLogin.data.data.accessToken;

    const teacherDashboard = await request('GET', '/teacher/dashboard', teacherToken);
    log('Teacher Dashboard', teacherDashboard.status === 200 ? 'PASS' : 'FAIL', `Status ${teacherDashboard.status}`);

    const teacherCourses = await request('GET', '/courses', teacherToken);
    log('Teacher Courses', teacherCourses.status === 200 ? 'PASS' : 'FAIL', `Status ${teacherCourses.status}, Count: ${teacherCourses.data.data?.items?.length || 0}`);

    const teacherAssignments = await request('GET', '/teacher-assignments', teacherToken);
    log('Teacher Assignments', teacherAssignments.status === 200 ? 'PASS' : 'FAIL', `Status ${teacherAssignments.status}, Count: ${teacherAssignments.data.data?.length || 0}`);
  } else {
    log('Teacher Login', 'FAIL', `Status ${teacherLogin.status}`);
  }

  console.log();

  // 3. Parent Flow
  console.log('3. Parent Flow Test');
  const parentLogin = await request('POST', '/auth/login', null, {
    username: 'parent1',
    password: 'Parent@Dev2026'
  });

  if (parentLogin.status === 200 && parentLogin.data.code === 0) {
    log('Parent Login', 'PASS', `Status ${parentLogin.status}`);
    const parentToken = parentLogin.data.data.accessToken;

    const myChildren = await request('GET', '/students/my-children', parentToken);
    log('Parent My Children', myChildren.status === 200 ? 'PASS' : 'FAIL', `Status ${myChildren.status}, Count: ${myChildren.data.data?.length || 0}`);

    if (myChildren.data.data && myChildren.data.data.length > 0) {
      const childId = myChildren.data.data[0].id;
      
      const childContracts = await request('GET', `/students/${childId}/contracts`, parentToken);
      log('Parent Child Contracts', childContracts.status === 200 ? 'PASS' : 'FAIL', `Status ${childContracts.status}`);

      const childAttendance = await request('GET', `/students/${childId}/attendance`, parentToken);
      log('Parent Child Attendance', childAttendance.status === 200 ? 'PASS' : 'FAIL', `Status ${childAttendance.status}`);
    }
  } else {
    log('Parent Login', 'FAIL', `Status ${parentLogin.status}`);
  }

  console.log();

  // 4. Permission Tests
  console.log('4. Permission Test');
  
  // Student 尝试访问 Teacher 接口
  const studentToken = (await request('POST', '/auth/login', null, {
    username: 'student1',
    password: 'Student@Dev2026'
  })).data.data.accessToken;

  const studentAccessTeacher = await request('GET', '/teacher/dashboard', studentToken);
  log('Student Access Teacher Dashboard', studentAccessTeacher.status === 403 ? 'PASS' : 'FAIL', `Status ${studentAccessTeacher.status} (expected 403)`);

  // Parent 尝试访问 Admin 接口
  const parentToken = (await request('POST', '/auth/login', null, {
    username: 'parent1',
    password: 'Parent@Dev2026'
  })).data.data.accessToken;

  const parentAccessAdmin = await request('GET', '/dashboard/overview', parentToken);
  log('Parent Access Admin Dashboard', parentAccessAdmin.status === 403 ? 'PASS' : 'FAIL', `Status ${parentAccessAdmin.status} (expected 403)`);

  console.log();

  // Summary
  console.log('=== Test Summary ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  // Save results
  const fs = require('fs');
  fs.writeFileSync('bug-detection-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to bug-detection-results.json');
}

runTests().catch(console.error);
