export class PointsGrantedEvent {
  constructor(
    public readonly eventId: string,
    public readonly studentId: number,
    public readonly lessonId: number,
    public readonly points: number,
    public readonly time: string,
  ) {}
}
