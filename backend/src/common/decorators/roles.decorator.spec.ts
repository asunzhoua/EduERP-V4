import { Roles, ROLES_KEY } from './roles.decorator';

describe('@Roles() decorator', () => {
  it('should set roles metadata on the target', () => {
    @Roles('admin', 'teacher')
    class TestController {}

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      TestController,
    ) as unknown as string[];
    expect(roles).toEqual(['admin', 'teacher']);
  });

  it('should set empty roles array when no arguments', () => {
    @Roles()
    class EmptyController {}

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      EmptyController,
    ) as unknown as string[];
    expect(roles).toEqual([]);
  });
});
