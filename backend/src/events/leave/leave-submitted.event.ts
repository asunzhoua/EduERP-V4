export class LeaveSubmittedEvent {
  constructor(
    public readonly eventId: string,
    public readonly leaveId: number,
    public readonly studentId: number,
    public readonly lessonId: number,
    public readonly time: string,
  ) {}
}
