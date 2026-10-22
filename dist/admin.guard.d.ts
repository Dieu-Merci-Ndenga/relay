import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AdminGuard implements CanActivate {
    private readonly token;
    canActivate(context: ExecutionContext): boolean;
}
