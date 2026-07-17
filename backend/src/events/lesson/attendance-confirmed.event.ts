export class AttendanceConfirmedEvent {
  constructor(
    public readonly eventId: string,
    public readonly lessonId: number,
    public readonly time: string,
  ) {}
}
