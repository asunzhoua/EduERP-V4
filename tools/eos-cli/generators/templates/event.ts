export class {{NAME}}Event {
  constructor(
    public readonly eventId: string,
    public readonly {{NAME_CAMEL}}Id: number,
    public readonly {{NAME_CAMEL}}Code: string,
    public readonly time: string,
  ) {}
}
