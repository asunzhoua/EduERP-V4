export class StudentDeactivatedEvent {
  constructor(
    public readonly eventId: string,
    public readonly studentId: number,
    public readonly studentCode: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly reason: string,
    public readonly operatedBy: number,
    public readonly time: string,
  ) {}
}
