export class LessonCompletedEvent {
  constructor(
    public readonly eventId: string,
    public readonly lessonId: number,
    public readonly classCode: string,
    public readonly courseCode: string,
    public readonly teacherId: number,
    public readonly scheduledDate: string,
    public readonly actualStartTime: string | null,
    public readonly actualEndTime: string | null,
    public readonly durationMinutes: number,
    public readonly time: string,
  ) {}
}
