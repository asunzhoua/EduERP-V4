export class LessonFeedbackCreatedEvent {
  constructor(
    public readonly eventId: string,
    public readonly lessonId: number,
    public readonly studentId: number,
    public readonly teacherId: number,
    public readonly time: string,
  ) {}
}
