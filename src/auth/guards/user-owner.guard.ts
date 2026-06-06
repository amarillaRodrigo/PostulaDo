import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class UserOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const routeUserId = request.params?.id as string | undefined;
    const authenticatedUser = request.user as
      | { id?: string; sub?: string; userId?: string }
      | undefined;

    const authenticatedUserId =
      authenticatedUser?.id ??
      authenticatedUser?.sub ??
      authenticatedUser?.userId;

    if (
      !routeUserId ||
      !authenticatedUserId ||
      routeUserId !== authenticatedUserId
    ) {
      throw new ForbiddenException('Solo puedes modificar tu propio usuario');
    }

    return true;
  }
}
