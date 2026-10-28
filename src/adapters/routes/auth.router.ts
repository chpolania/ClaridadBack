import { NextFunction, Request, Response, Router } from 'express';
import debugLib from 'debug';
import {
    AuthError, getCurrentUser, logoutSession, oauthLogin, refreshSession,
    requestEmailCode, verifyEmailCode,
} from '../../application/use-cases/auth.service';
import { requireBearerAuth } from '../middlewares/bearer-auth.middleware';

const authRouter = Router();
const debug = debugLib('claridad:auth');
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
const bodyString = (req: Request, name: string): string => {
    const value = req.body?.[name];
    if (typeof value !== 'string' || !value.trim()) throw new AuthError(400, 'INVALID_REQUEST', `El campo ${name} es obligatorio.`);
    return value.trim();
};

authRouter.post('/email/request-code', asyncRoute(async (req, res) => {
    const requestIp = req.ip || req.socket.remoteAddress || 'unknown';
    res.status(202).json(await requestEmailCode(bodyString(req, 'email'), requestIp));
}));

authRouter.post('/email/verify', asyncRoute(async (req, res) => {
    const challengeId = bodyString(req, 'challengeId');
    const email = bodyString(req, 'email');
    const code = bodyString(req, 'code');
    if (!/^\d{6}$/.test(code)) throw new AuthError(400, 'INVALID_OR_EXPIRED_CODE', 'El código no es válido o expiró.');
    res.status(200).json(await verifyEmailCode(challengeId, email, code));
}));

authRouter.post('/oauth/:provider', asyncRoute(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'facebook') throw new AuthError(404, 'NOT_FOUND', 'Ruta no encontrada.');
    res.status(200).json(await oauthLogin(provider, bodyString(req, 'identityToken')));
}));

authRouter.get('/me', requireBearerAuth, asyncRoute(async (_req, res) => {
    res.status(200).json(await getCurrentUser(res.locals.authUserId as string));
}));

authRouter.post('/refresh', asyncRoute(async (req, res) => {
    res.status(200).json(await refreshSession(bodyString(req, 'refreshToken')));
}));

authRouter.post('/logout', asyncRoute(async (req, res) => {
    await logoutSession(bodyString(req, 'refreshToken'));
    res.status(204).end();
}));

authRouter.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AuthError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }

    const databaseCode = (error as Error & { code?: string }).code;
    // Log only server-side diagnostics; never log request bodies, OTPs, or tokens.
    debug(`Authentication request failed (${databaseCode || error.name}): ${error.message}`);
    if (databaseCode === 'ER_NO_SUCH_TABLE') {
        res.status(503).json({ error: { code: 'DATABASE_SCHEMA_NOT_READY', message: 'Faltan tablas de autenticación. Ejecuta docs/claridad-auth-mysql.sql.' } });
        return;
    }
    if (databaseCode === 'ECONNREFUSED' || databaseCode === 'ETIMEDOUT' || databaseCode === 'ER_ACCESS_DENIED_ERROR' || databaseCode === 'ER_BAD_DB_ERROR') {
        res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'No se pudo conectar con la base de datos. Revisa MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE.' } });
        return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
});

export default authRouter;
