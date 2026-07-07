export class LessonFinishedEvent {
  constructor(
    public readonly eventId: string,
    public readonly lessonId: number,
    public readonly teacherId: number,
    public readonly campusId: number,
    public readonly time: string,
  ) {}
}
