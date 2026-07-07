export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  GRADUATED = 'GRADUATED',
  INACTIVE = 'INACTIVE',
}

export const StudentStatusLabels: Record<StudentStatus, string> = {
  [StudentStatus.ACTIVE]: '在读',
  [StudentStatus.PAUSED]: '暂停',
  [StudentStatus.GRADUATED]: '毕业',
  [StudentStatus.INACTIVE]: '停用',
};
