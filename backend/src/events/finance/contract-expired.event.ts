export class ContractExpiredEvent {
  constructor(
    public readonly eventId: string,
    public readonly contractId: number,
    public readonly contractCode: string,
    public readonly studentCode: string,
    public readonly validTo: string,
    public readonly remainingLessons: number,
    public readonly time: string,
  ) {}
}
