import { NextFunction, Request, Response } from 'express';
import { AuthError, getCurrentUser, verifyAccessToken } from '../../application/use-cases/auth.service';

/** Valida el JWT de acceso enviado por la app en Authorization: Bearer <token>. */
export function requireBearerAuth(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.header('Authorization') || '';
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
        next(new AuthError(401, 'SESSION_EXPIRED', 'Se requiere un access token Bearer válido.'));
        return;
    }
    try {
        const userId = verifyAccessToken(match[1]);
        getCurrentUser(userId)
            .then(() => {
                res.locals.authUserId = userId;
                next();
            })
            .catch(next);
    } catch (error) {
        next(error);
    }
}
