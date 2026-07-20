import { Public } from './public.decorator';

describe('@Public() decorator', () => {
  it('should set isPublic metadata to true', () => {
    @Public()
    class TestController {}

    const isPublic = Reflect.getMetadata('isPublic', TestController);
    expect(isPublic).toBe(true);
  });

  it('should not set isPublic on untagged class', () => {
    class UnmarkedController {}

    const isPublic = Reflect.getMetadata('isPublic', UnmarkedController);
    expect(isPublic).toBeUndefined();
  });
});
