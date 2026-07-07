export class LeaveApprovedEvent {
  constructor(
    public readonly eventId: string,
    public readonly leaveId: number,
    public readonly studentId: number,
    public readonly lessonId: number,
    public readonly approvedBy: number,
    public readonly time: string,
  ) {}
}
