export class LessonCompletedEvent {
  constructor(
    public readonly lessonId: number,
    public readonly teacherId: number,
    public readonly classId: number,
    public readonly completedAt: Date,
  ) {}
}
