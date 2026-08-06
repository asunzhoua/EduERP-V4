# Export Teacher Name Reality Audit

## 审计时间
2026-07-26

## 审计目录
```
C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\backend\src\modules\export
```

---

## 1. ExportService 现状

### 1.1 现有导出方法

| 方法 | 数据来源 | 当前字段 | 是否包含 teacherName |
|------|----------|----------|---------------------|
| exportStudents() | Student, Enrollment, Contract | studentCode, studentName, gender, phone, school, grade, enrollmentDate, contractCode, totalLessons, remainingLessons, status | ❌ (不涉及教师) |
| exportLessons() | Lesson, Attendance | lessonId, classCode, courseCode, lessonNumber, scheduledDate, startTime, endTime, **teacherId**, status, isMakeup, presentCount, absentCount, totalAttendance, actualStartTime, actualEndTime, note | ❌ (含 teacherId，无 teacherName) |
| exportConsumption() | Contract | contractCode, studentCode, subject, totalLessons, remainingLessons, consumedLessons, unitPrice, consumedValue, status, validFrom, validTo | ❌ (不涉及教师) |
| exportSalary() | SalaryRecord | recordId, **teacherId**, lessonId, salaryRuleId, ruleVersion, amount, lessonDate, duration, status, notes, createdBy, createTime | ❌ |
| exportFinance() | Contract, SalaryRecord | type, referenceCode, studentCode, **teacherId**, subject, totalAmount, consumedValue, amount, lessonDate, status | ❌ (salary 行含 teacherId，无 teacherName) |

### 1.2 关键发现：exportSalary() 的 TeacherName 缺失

**当前代码（第 163-182 行）**：
```typescript
async exportSalary(filters: ExportFilterDto, format: 'csv' | 'excel'): Promise<Buffer> {
    const where: any = {};
    if (filters.startDate) where.lessonDate = Between(filters.startDate, filters.endDate ?? filters.startDate);
    if (filters.status) where.status = filters.status;

    const records = await this.salaryRepo.find({ where });

    // Enrich with teacher data (from user entity) — teacherId is the user ID
    // Since we can't join to a non-related entity, we'll export what we have
    const data = records.map((r) => ({
      recordId: r.id,
      teacherId: r.teacherId,
      // ❌ 无 teacherName
      // ... other fields
    }));
```

**关键证据**：代码中已存在注释承认该问题："Since we can't join to a non-related entity, we'll export what we have" — 说明开发者意识到了缺失 teacherName，但未实现。

---

## 2. DTO 现状

### 2.1 ExportFilterDto
```typescript
export class ExportFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['csv', 'excel'])
  format?: 'csv' | 'excel' = 'csv';
}
```
- ✅ 已支持日期范围、状态、格式筛选
- ❌ **无教师相关字段**（不涉及教师筛选条件，当前阶段不需要，但仍需记录）

---

## 3. Entity 关系

### 3.1 SalaryRecordEntity
```typescript
@Entity('salary_record')
export class SalaryRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;          // ← 仅有原始 ID 列

  @Column({ type: 'bigint' })
  @Index()
  lessonId: number;

  // ❌ 无 @ManyToOne(() => User) 关联
  // ❌ 无 teacher 或 user 关联属性
  // ... 其他字段（amount, lessonDate, duration, status, etc.）
}
```

**结论**：`SalaryRecordEntity` 仅有 `teacherId: number` 裸列，**没有 TypeORM 关系装饰器**，无法直接 `.teacher.name` 方式获取教师名。

### 3.2 LessonEntity
```typescript
@Entity('lesson')
export class LessonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  teacherId: number;          // ← 仅有原始 ID 列

  // ❌ 无 @ManyToOne(() => User) 关联
  // ... 其他字段
}
```

**结论**：`LessonEntity` 同样仅有 `teacherId`，无关联关系。

### 3.3 UserEntity
```typescript
@Entity('user')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;               // ✅ 教师名字段

  @Column({ type: 'varchar', length: 50 })
  @Index()
  role: string;               // ✅ 角色字段（含 'Teacher'）

  @Column({ type: 'tinyint', default: UserStatus.ACTIVE })
  @Index()
  status: UserStatus;         // ✅ 状态字段

  // ... 其他字段
}
```

**结论**：
- ✅ `User.id` 可作为 `teacherId` 的外键查询
- ✅ `User.name` 即为所需的 teacherName
- ✅ `User.role` 可过滤教师角色（role === 'Teacher'）
- ✅ `User.status` 可过滤活跃状态

### 3.4 IdentityModule 导出
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, ...]),
  ],
  exports: [AuthService, JwtModule, PassportModule, UserRepository],
  // ❌ 未导出 TypeOrmModule，即未导出 User 实体
})
export class IdentityModule {}
```

**结论**：IdentityModule **未导出** `User` 实体的 `TypeOrmModule`。如果 ExportModule 需要直接注入 `Repository<User>`，需要：
- 方案 A：ExportModule 自身 import `TypeOrmModule.forFeature([User])`
- 方案 B：IdentityModule 导出 `TypeOrmModule.forFeature([User])` 然后 ExportModule 导入 IdentityModule

---

## 4. 测试覆盖

### 4.1 现有测试文件：`export.service.spec.ts`

**exportSalary 测试**（当前仅 1 个测试用例）：
```typescript
describe('exportSalary', () => {
  it('should return a Buffer for CSV format', async () => {
    mockFind.mockResolvedValue([]);
    mockCreateQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    const result = await service.exportSalary({}, 'csv');
    expect(result).toBeInstanceOf(Buffer);
  });
});
```

**现状总结**：
| 方法 | 测试用例数 | 覆盖字段验证 | 覆盖 teacherName |
|------|-----------|-------------|-----------------|
| exportStudents | 3 | ✅ 部分覆盖 | ❌ N/A |
| exportLessons | 1 | ❌ 仅 Buffer 类型 | ❌ N/A |
| exportConsumption | 2 | ✅ 含 consumedLessons 验证 | ❌ N/A |
| exportSalary | **1** | ❌ 仅 Buffer 类型 | ❌ |
| exportFinance | 2 | ✅ 含 revenue/salary 验证 | ❌ N/A |
| CsvWriter | 3 | ✅ BOM/转义/null | ❌ N/A |
| ExcelWriter | 2 | ✅ Buffer/空数据 | ❌ N/A |

**结论**：
- ✅ exportSalary 存在基础测试
- ❌ 未验证导出数据字段
- ❌ 无 teacherName 相关测试
- ❌ mock 中未包含 UserRepository

---

## 5. Controller 现状

### 5.1 现有端点

| 端点 | 方法 | 权限 | 格式参数 | 响应 |
|------|------|------|---------|------|
| POST /export/students | exportStudents | ADMIN | filters.format | 文件下载 |
| POST /export/lessons | exportLessons | ADMIN | filters.format | 文件下载 |
| POST /export/consumption | exportConsumption | ADMIN | filters.format | 文件下载 |
| POST /export/salary | exportSalary | ADMIN | filters.format | 文件下载 |
| POST /export/finance | exportFinance | ADMIN | filters.format | 文件下载 |

### 5.2 请求/响应格式
- 请求：`ExportFilterDto` + 路由
- 响应：文件流下载（`Content-Disposition: attachment`）
- ✅ 当前 API 接口无需修改，仅需改进 Service 层数据

---

## 6. 修改方案（基于实际代码的精确分析）

### 6.1 需要修改的文件

| 文件 | 修改内容 | 修改类型 |
|------|---------|---------|
| `src/modules/export/export.service.ts` | exportSalary() 方法 — 添加 UserRepository 注入 + 批量查询 teacherName | 修改 |
| `src/modules/export/export.module.ts` | 添加 `User` 到 TypeOrmModule.forFeature | 修改 |
| `src/modules/export/export.service.spec.ts` | 添加 UserRepository mock + teacherName 验证测试 | 修改 |

### 6.2 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `export.controller.ts` | 接口签名不变，只是返回数据增加字段 |
| `dto/export-filter.dto.ts` | 筛选条件不变 |
| `salary-record.entity.ts` | 无需添加关联关系，使用 Repository 查询即可 |
| `user.entity.ts` | 已有所需字段 |
| `identity.module.ts` | ExportModule 可直接 import TypeOrmModule.forFeature([User]) |

### 6.3 ExportService.exportSalary() 修改方案

基于当前实际代码结构（第 163-182 行），准确修改方案：

```typescript
// 新增依赖注入
constructor(
  // ... 现有依赖
  @InjectRepository(User)          // 新增
  private readonly userRepo: Repository<User>,  // 新增
) {}

// exportSalary 方法改造
async exportSalary(filters: ExportFilterDto, format: 'csv' | 'excel'): Promise<Buffer> {
    const where: any = {};
    if (filters.startDate) where.lessonDate = Between(filters.startDate, filters.endDate ?? filters.startDate);
    if (filters.status) where.status = filters.status;

    const records = await this.salaryRepo.find({ where });

    // 新增：批量查询教师信息
    const teacherIds = [...new Set(records.map(r => r.teacherId))];
    const teachers = teacherIds.length > 0
      ? await this.userRepo.findByIds(teacherIds)
      : [];
    const teacherMap = new Map(teachers.map(t => [t.id, t.name]));

    const data = records.map((r) => ({
      recordId: r.id,
      teacherId: r.teacherId,
      teacherName: teacherMap.get(r.teacherId) || '',  // 新增
      lessonId: r.lessonId,
      salaryRuleId: r.salaryRuleId,
      ruleVersion: r.ruleVersion,
      amount: Number(r.amount),
      lessonDate: r.lessonDate,
      duration: r.duration,
      status: r.status,
      notes: r.notes ?? '',
      createdBy: r.createdBy,
      createTime: r.createTime.toISOString(),
    }));

    const columns = [
      'recordId',
      'teacherId',
      'teacherName',     // 新增列
      'lessonId',
      'salaryRuleId',
      'ruleVersion',
      'amount',
      'lessonDate',
      'duration',
      'status',
      'notes',
      'createdBy',
      'createTime',
    ];

    return format === 'csv'
      ? this.csvWriter.generate(data, columns)
      : this.excelWriter.generate(data, '工资数据');
}
```

### 6.4 ExportModule 修改

```typescript
import { User } from '../../identity/entities/user.entity';   // 新增导入

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      LessonEntity,
      LessonAttendanceEntity,
      ContractEntity,
      SalaryRecordEntity,
      EnrollmentEntity,
      User,               // 新增
    ]),
  ],
})
export class ExportModule {}
```

### 6.5 测试修改

```typescript
// 新增 User entity mock
import { User } from '../../identity/entities/user.entity';

// 在 providers 中新增
{ provide: getRepositoryToken(User), useValue: { ...mockRepo } },

// 新增测试用例
describe('exportSalary', () => {
  // ... 现有测试

  it('should include teacherName in salary export', async () => {
    const mockRecords = [
      { id: 1, teacherId: 101, lessonId: 201, salaryRuleId: 1, ruleVersion: 'v1', amount: 500, lessonDate: '2026-07-01', duration: 2, status: 'PAID', notes: null, createdBy: 1, createTime: new Date('2026-07-01') },
      { id: 2, teacherId: 102, lessonId: 202, salaryRuleId: 1, ruleVersion: 'v1', amount: 600, lessonDate: '2026-07-02', duration: 2, status: 'PAID', notes: null, createdBy: 1, createTime: new Date('2026-07-02') },
    ];
    const mockTeachers = [
      { id: 101, name: '张老师' },
      { id: 102, name: '李老师' },
    ];

    // First find() call returns records, second returns teachers
    mockFind
      .mockResolvedValueOnce(mockRecords)    // salaryRepo.find
      .mockResolvedValueOnce(mockTeachers);   // userRepo.find (findByIds uses find)

    const result = await service.exportSalary({}, 'csv');
    const content = result.toString('utf-8');

    expect(content).toContain('teacherName');
    expect(content).toContain('张老师');
    expect(content).toContain('李老师');
  });
});
```

---

## 7. 风险评估

### 7.1 影响范围
| 风险项 | 级别 | 说明 |
|--------|------|------|
| 仅修改 exportSalary() | 🟢 低 | 其他导出方法不受影响 |
| 保持现有接口兼容 | 🟢 低 | API 签名、请求格式、响应格式均不变 |
| 新增 teacherName 字段到导出行 | 🟢 低 | 向前兼容，不影响现有数据消费方（新增列）|
| ExportModule 新增依赖 | 🟢 低 | 仅添加一个 TypeORM entity 注册 |

### 7.2 性能影响
| 方面 | 说明 |
|------|------|
| 新增查询 | 一次 `userRepo.findByIds()` 批量查询（IN 查询）|
| 时间复杂度 | O(n + m) — n=salary记录数, m=教师数(m≤n) |
| 内存开销 | 一个 Map<number, string> 保存 teacherId→name 映射 |
| **影响** | ✅ 可控，无显著性能风险 |

### 7.3 兼容性
| 方面 | 说明 |
|------|------|
| API 签名 | ✅ 不变 |
| 请求格式 | ✅ 不变 |
| 响应格式 | ✅ 文件流下载，列新增不影响解析 |
| 现有 CSV 消费端 | ⚠️ 新增列可能导致宽度变化，但数据完整 |
| 现有 Excel 消费端 | ⚠️ 新增列，公式引用需检查 |

---

## 8. 结论

### 当前状态
| 检查项 | 状态 | 证据 |
|--------|------|------|
| exportSalary() 包含 teacherName | ❌ 缺失 | export.service.ts 第 163-182 行，代码注释已承认缺失 |
| SalaryRecordEntity 有 User 关联 | ❌ 无 | salary-record.entity.ts 仅有裸 teacherId 列 |
| 可通过 teacherId 查询 User.name | ✅ 可行 | user.entity.ts 包含 id, name, role 字段 |
| 可通过角色过滤教师 | ✅ 可行 | user.role 字段包含 'Teacher' 枚举值 |
| ExportModule 注册了 User 实体 | ❌ 未注册 | export.module.ts 的 TypeOrmModule.forFeature 中无 User |
| 测试覆盖 teacherName | ❌ 无 | export.service.spec.ts 仅验证 Buffer 类型 |
| 接口需修改 | ❌ 不需要 | Controller 不变，仅 Service 层增强 |

### 修改方案确认
| 文件 | 操作 | 复杂度 |
|------|------|--------|
| export.service.ts | 添加 userRepo 注入 + 批量查询 + 合并 teacherName | ★☆☆ |
| export.module.ts | TypeOrmModule.forFeature 添加 User | ★☆☆ |
| export.service.spec.ts | 添加 mock + teacherName 验证测试 | ★☆☆ |

### 预计工作量
- **代码修改**：约 15-20 行（含注入、查询、合并逻辑）
- **模块修改**：约 1 行（import + entity 注册）
- **测试新增**：约 25-30 行（mock + 验证）
- **总工作量**：低，约 30 分钟
