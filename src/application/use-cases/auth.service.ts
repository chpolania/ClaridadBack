import axios from 'axios';
import crypto from 'crypto';
import debugLib from 'debug';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { mysqlPool as pool } from '../../infrastructure/database/mysql.pool';

const debug = debugLib('claridad:auth');
const ACCESS_TOKEN_TTL_SECONDS = 3600;

export interface AuthUser {
    id: string;
    email: string;
    emailVerified: boolean;
    displayName: string | null;
    avatarUrl: string | null;
}

export class AuthError extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
    }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const hash = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');
const hmac = (value: string): string => crypto.createHmac('sha256', process.env.OTP_HASH_SECRET || process.env.ACCESS_TOKEN_SIGNING_KEY || 'change-me').update(value).digest('hex');
const signingKey = (): string => {
    const key = process.env.ACCESS_TOKEN_SIGNING_KEY;
    if (!key || key.length < 32) throw new AuthError(500, 'SERVER_CONFIGURATION_ERROR', 'Falta configurar ACCESS_TOKEN_SIGNING_KEY (mínimo 32 caracteres).');
    return key;
};
const b64url = (input: string): string => Buffer.from(input).toString('base64url');

function createAccessToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + ACCESS_TOKEN_TTL_SECONDS }));
    const content = `${header}.${payload}`;
    return `${content}.${crypto.createHmac('sha256', signingKey()).update(content).digest('base64url')}`;
}

export function verifyAccessToken(token: string): string {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('bad token');
        const content = `${parts[0]}.${parts[1]}`;
        const expected = crypto.createHmac('sha256', signingKey()).update(content).digest();
        const actual = Buffer.from(parts[2], 'base64url');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('bad signature');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('expired');
        return payload.sub as string;
    } catch (_error) {
        throw new AuthError(401, 'SESSION_EXPIRED', 'La sesión no es válida o expiró.');
    }
}

async function userProfile(userId: string): Promise<AuthUser> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT id, email, email_verified_at, display_name, avatar_url, disabled_at FROM users WHERE id = ?', [userId],
    );
    if (!rows.length) throw new AuthError(401, 'SESSION_EXPIRED', 'La sesión no es válida o expiró.');
    const row = rows[0];
    if (row.disabled_at) throw new AuthError(403, 'ACCOUNT_DISABLED', 'La cuenta está deshabilitada.');
    return { id: row.id, email: row.email, emailVerified: Boolean(row.email_verified_at), displayName: row.display_name, avatarUrl: row.avatar_url };
}

async function issueSession(userId: string): Promise<{ accessToken: string; expiresIn: number; refreshToken: string; user: AuthUser }> {
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    await pool.execute(
        'INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))',
        [crypto.randomUUID(), userId, hash(refreshToken)],
    );
    return { accessToken: createAccessToken(userId), expiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshToken, user: await userProfile(userId) };
}

export async function requestEmailCode(emailInput: string, ip: string): Promise<{ message: string; challengeId: string; expiresIn: number; resendAfter: number }> {
    if (typeof emailInput !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) throw new AuthError(400, 'INVALID_EMAIL', 'El correo no es válido.');
    const email = normalizeEmail(emailInput);
    const [recent] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM email_login_challenges WHERE created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR) AND (email_normalized = ? OR request_ip = ?)', [email, ip],
    );
    if (Number(recent[0].total) >= 10) throw new AuthError(429, 'RATE_LIMITED', 'Espera antes de solicitar otro código.');
    const [last] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT created_at FROM email_login_challenges WHERE email_normalized = ? ORDER BY created_at DESC LIMIT 1', [email],
    );
    if (last.length && Date.now() - new Date(last[0].created_at).getTime() < 60000) throw new AuthError(429, 'RATE_LIMITED', 'Espera antes de solicitar otro código.');

    const challengeId = crypto.randomUUID();
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    await pool.execute(
        'INSERT INTO email_login_challenges (id, email_normalized, code_hash, expires_at, request_ip) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE), ?)',
        [challengeId, email, hmac(`${challengeId}:${email}:${code}`), ip],
    );
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    try {
        if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error('SMTP not configured');
        await transporter.sendMail({ from: process.env.SMTP_FROM, to: email, subject: 'Tu código de acceso a Claridad', text: `Tu código de acceso es ${code}. Vence en 10 minutos.` });
    } catch (error) {
        const smtpError = error as { code?: string; responseCode?: number; command?: string };
        // Log transport diagnostics only; do not log the address, code, credentials, or SMTP response.
        debug(`OTP email delivery failed (code=${smtpError.code || 'unknown'}, responseCode=${smtpError.responseCode || 'unknown'}, command=${smtpError.command || 'unknown'})`);
        await pool.execute('DELETE FROM email_login_challenges WHERE id = ?', [challengeId]);
        throw new AuthError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'No se pudo enviar el código. Intenta más tarde.');
    }
    return { message: 'Si el correo puede usarse, enviaremos un código.', challengeId, expiresIn: 600, resendAfter: 60 };
}

export async function verifyEmailCode(challengeId: string, emailInput: string, code: string) {
    const email = normalizeEmail(emailInput);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM email_login_challenges WHERE id = ? AND email_normalized = ? FOR UPDATE', [challengeId, email],
        );
        const challenge = rows[0];
        if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5) {
            throw new AuthError(400, 'INVALID_OR_EXPIRED_CODE', 'El código no es válido o expiró.');
        }
        const supplied = hmac(`${challengeId}:${email}:${code}`);
        const expected = Buffer.from(challenge.code_hash, 'hex');
        const actual = Buffer.from(supplied, 'hex');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
            await connection.execute('UPDATE email_login_challenges SET attempts = attempts + 1 WHERE id = ?', [challengeId]);
            await connection.commit();
            throw new AuthError(400, 'INVALID_OR_EXPIRED_CODE', 'El código no es válido o expiró.');
        }
        await connection.execute('UPDATE email_login_challenges SET consumed_at = UTC_TIMESTAMP() WHERE id = ?', [challengeId]);
        const [identityRows] = await connection.execute<mysql.RowDataPacket[]>(
            "SELECT u.id FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = 'email' AND i.provider_subject = ? FOR UPDATE", [email],
        );
        let userId: string;
        if (identityRows.length) {
            userId = identityRows[0].id;
            await connection.execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()), updated_at = UTC_TIMESTAMP() WHERE id = ?', [userId]);
        } else {
            userId = crypto.randomUUID();
            await connection.execute('INSERT INTO users (id, email, email_normalized, email_verified_at) VALUES (?, ?, ?, UTC_TIMESTAMP())', [userId, email, email]);
            await connection.execute("INSERT INTO auth_identities (id, user_id, provider, provider_subject, provider_email) VALUES (?, ?, 'email', ?, ?)", [crypto.randomUUID(), userId, email, email]);
        }
        await connection.commit();
        return await issueSession(userId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

async function validateProvider(provider: 'google' | 'facebook', token: string): Promise<{ subject: string; email: string | null; name: string | null; picture: string | null }> {
    try {
        if (provider === 'google') {
            const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: token }, timeout: 5000 });
            const claims = response.data;
            if (!process.env.GOOGLE_CLIENT_ID || claims.aud !== process.env.GOOGLE_CLIENT_ID || claims.iss !== 'https://accounts.google.com' || Number(claims.exp) <= Date.now() / 1000 || !claims.sub) throw new Error('invalid claims');
            return { subject: claims.sub, email: claims.email || null, name: claims.name || null, picture: claims.picture || null };
        }
        if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) throw new Error('provider not configured');
        const response = await axios.get('https://graph.facebook.com/debug_token', { params: { input_token: token, access_token: `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}` }, timeout: 5000 });
        const data = response.data.data;
        if (!data.is_valid || data.app_id !== process.env.FACEBOOK_APP_ID || Number(data.expires_at) <= Date.now() / 1000 || !data.user_id) throw new Error('invalid token');
        const profile = await axios.get('https://graph.facebook.com/me', { params: { fields: 'id,name,email,picture', access_token: token }, timeout: 5000 });
        if (profile.data.id !== data.user_id) throw new Error('subject mismatch');
        return { subject: data.user_id, email: profile.data.email || null, name: profile.data.name || null, picture: profile.data.picture?.data?.url || null };
    } catch (_error) { throw new AuthError(401, 'INVALID_IDENTITY_TOKEN', 'La credencial de identidad no es válida.'); }
}

export async function oauthLogin(provider: 'google' | 'facebook', token: string) {
    if (typeof token !== 'string' || !token) throw new AuthError(400, 'INVALID_IDENTITY_TOKEN', 'La credencial de identidad no es válida.');
    const identity = await validateProvider(provider, token);
    const connection = await pool.getConnection();
    let userId: string;
    try {
        await connection.beginTransaction();
        const [found] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT user_id FROM auth_identities WHERE provider = ? AND provider_subject = ? FOR UPDATE', [provider, identity.subject],
        );
        if (found.length) {
            userId = found[0].user_id;
            await connection.execute('UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url), updated_at = UTC_TIMESTAMP() WHERE id = ?', [identity.name, identity.picture, userId]);
        } else {
            userId = crypto.randomUUID();
            const email = identity.email ? normalizeEmail(identity.email) : `${provider}-${hash(identity.subject).slice(0, 32)}@identity.claridad.invalid`;
            const verifiedAt = identity.email ? new Date() : null;
            await connection.execute('INSERT INTO users (id, email, email_normalized, email_verified_at, display_name, avatar_url) VALUES (?, ?, ?, ?, ?, ?)', [userId, identity.email || email, email, verifiedAt, identity.name, identity.picture]);
            await connection.execute('INSERT INTO auth_identities (id, user_id, provider, provider_subject, provider_email) VALUES (?, ?, ?, ?, ?)', [crypto.randomUUID(), userId, provider, identity.subject, identity.email]);
        }
        await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return issueSession(userId);
}

export async function getCurrentUser(userId: string) { return { user: await userProfile(userId) }; }

export async function refreshSession(token: string) {
    const oldHash = hash(token);
    const connection = await pool.getConnection();
    let userId: string;
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT * FROM auth_sessions WHERE refresh_token_hash = ? FOR UPDATE', [oldHash],
        );
        const session = rows[0];
        if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
            if (session?.revoked_at) await connection.execute('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()) WHERE user_id = ?', [session.user_id]);
            await connection.commit();
            throw new AuthError(401, 'SESSION_EXPIRED', 'La sesión no es válida o expiró.');
        }
        userId = session.user_id;
        const newToken = crypto.randomBytes(48).toString('base64url');
        const newId = crypto.randomUUID();
        await connection.execute('INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))', [newId, userId, hash(newToken)]);
        await connection.execute('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(), replaced_by = ? WHERE id = ?', [newId, session.id]);
        await connection.commit();
        return { accessToken: createAccessToken(userId), expiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshToken: newToken, user: await userProfile(userId) };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}

export async function logoutSession(token: string): Promise<void> {
    await pool.execute('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()) WHERE refresh_token_hash = ?', [hash(token)]);
}
