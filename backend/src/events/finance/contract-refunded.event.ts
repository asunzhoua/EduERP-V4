export class ContractRefundedEvent {
  constructor(
    public readonly eventId: string,
    public readonly contractId: number,
    public readonly contractCode: string,
    public readonly studentCode: string,
    public readonly refundAmount: number,
    public readonly refundReason: string,
    public readonly processedBy: number,
    public readonly time: string,
  ) {}
}
