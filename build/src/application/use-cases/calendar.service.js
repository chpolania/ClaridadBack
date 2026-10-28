"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCalendarTask = exports.createCalendarTask = exports.getCalendarTasks = exports.isoInTimezone = exports.localDateInTimezone = exports.localDateTimeUtc = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mysql_pool_1 = require("../../infrastructure/database/mysql.pool");
const auth_service_1 = require("./auth.service");
const DEFAULT_TIMEZONE = 'America/Bogota';
function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function dateParts(instant, timezone) {
    const values = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (type) => Number(values.find((value) => value.type === type)?.value);
    return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}
function localMidnightUtc(date, timezone) {
    const [year, month, day] = date.split('-').map(Number);
    const target = Date.UTC(year, month - 1, day);
    let guess = target;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const local = dateParts(new Date(guess), timezone);
        const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
        guess += target - representedAsUtc;
    }
    return new Date(guess);
}
function localDateTimeUtc(date, time, timezone) {
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_TIME', 'La fecha u hora extraída no es válida.');
    }
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let guess = target;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const local = dateParts(new Date(guess), timezone);
        const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
        guess += target - representedAsUtc;
    }
    return new Date(guess);
}
exports.localDateTimeUtc = localDateTimeUtc;
function localDateInTimezone(instant, timezone) {
    const parts = dateParts(instant, timezone);
    const pad = (value) => String(value).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}
exports.localDateInTimezone = localDateInTimezone;
function nextDate(date) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
}
function isoInTimezone(value, timezone) {
    const parts = dateParts(value, timezone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offsetMinutes = Math.round((localAsUtc - value.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offsetMinutes);
    const pad = (number) => String(number).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}
exports.isoInTimezone = isoInTimezone;
function parseInstant(value, field) {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_TIME', `${field} debe incluir zona horaria, por ejemplo -05:00 o Z.`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_TIME', `${field} no es una fecha válida.`);
    return parsed;
}
async function getCalendarTasks(userId, date) {
    if (!validDate(date))
        throw new auth_service_1.AuthError(400, 'INVALID_DATE', 'date debe tener formato YYYY-MM-DD y ser una fecha válida.');
    const [calendars] = await mysql_pool_1.mysqlPool.execute('SELECT id, timezone FROM user_calendars WHERE user_id = ? LIMIT 1', [userId]);
    const timezone = calendars.length ? calendars[0].timezone : DEFAULT_TIMEZONE;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    }
    catch (_error) {
        throw new auth_service_1.AuthError(500, 'INVALID_CALENDAR_TIMEZONE', 'La zona horaria del calendario no es válida.');
    }
    const pendingTasks = await getPendingTasksForCalendar(userId);
    if (!calendars.length)
        return { date, timezone, tasks: [], tasksWithoutSchedule: pendingTasks };
    const fromUtc = localMidnightUtc(date, timezone);
    const untilUtc = localMidnightUtc(nextDate(date), timezone);
    const [rows] = await mysql_pool_1.mysqlPool.execute(`SELECT id, title, description, starts_at_utc, ends_at_utc
         FROM calendar_tasks
         WHERE user_id = ? AND calendar_id = ? AND starts_at_utc >= ? AND starts_at_utc < ?
         ORDER BY starts_at_utc ASC`, [userId, calendars[0].id, fromUtc, untilUtc]);
    return {
        date,
        timezone,
        tasks: rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            startsAt: isoInTimezone(new Date(row.starts_at_utc), timezone),
            endsAt: isoInTimezone(new Date(row.ends_at_utc), timezone),
        })),
        tasksWithoutSchedule: pendingTasks,
    };
}
exports.getCalendarTasks = getCalendarTasks;
async function getPendingTasksForCalendar(userId) {
    const [rows] = await mysql_pool_1.mysqlPool.execute(`SELECT id, title, description, suggested_date, suggested_start_time, created_at
         FROM pending_calendar_tasks WHERE user_id = ? ORDER BY created_at ASC`, [userId]);
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        suggestedDate: row.suggested_date
            ? (row.suggested_date instanceof Date ? row.suggested_date.toISOString().slice(0, 10) : String(row.suggested_date).slice(0, 10))
            : null,
        suggestedStartTime: row.suggested_start_time
            ? (row.suggested_start_time instanceof Date ? row.suggested_start_time.toISOString().slice(11, 16) : String(row.suggested_start_time).slice(0, 5))
            : null,
    }));
}
async function createCalendarTask(userId, title, description, startsAt, endsAt) {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 255)
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_TITLE', 'title es obligatorio y debe tener hasta 255 caracteres.');
    const cleanDescription = description.trim();
    if (!cleanDescription || Buffer.byteLength(cleanDescription, 'utf8') > 65535) {
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_DESCRIPTION', 'description es obligatorio y no puede superar el tamaño permitido para TEXT.');
    }
    const starts = parseInstant(startsAt, 'startsAt');
    const ends = parseInstant(endsAt, 'endsAt');
    if (ends.getTime() <= starts.getTime())
        throw new auth_service_1.AuthError(400, 'INVALID_TASK_TIME', 'endsAt debe ser posterior a startsAt.');
    const connection = await mysql_pool_1.mysqlPool.getConnection();
    let calendarId;
    const taskId = crypto_1.default.randomUUID();
    try {
        await connection.beginTransaction();
        await connection.execute('INSERT IGNORE INTO user_calendars (id, user_id, timezone) VALUES (?, ?, ?)', [crypto_1.default.randomUUID(), userId, DEFAULT_TIMEZONE]);
        const [calendars] = await connection.execute('SELECT id, timezone FROM user_calendars WHERE user_id = ? FOR UPDATE', [userId]);
        if (!calendars.length)
            throw new auth_service_1.AuthError(500, 'CALENDAR_CREATE_FAILED', 'No se pudo preparar el calendario del usuario.');
        calendarId = calendars[0].id;
        const timezone = calendars[0].timezone;
        await connection.execute('INSERT INTO calendar_tasks (id, user_id, calendar_id, title, description, starts_at_utc, ends_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)', [taskId, userId, calendarId, cleanTitle, cleanDescription, starts, ends]);
        await connection.commit();
        return {
            id: taskId,
            title: cleanTitle,
            description: cleanDescription,
            startsAt: isoInTimezone(starts, timezone),
            endsAt: isoInTimezone(ends, timezone),
        };
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
exports.createCalendarTask = createCalendarTask;
async function deleteCalendarTask(userId, taskId) {
    const [result] = await mysql_pool_1.mysqlPool.execute('DELETE FROM calendar_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (result.affectedRows === 0) {
        throw new auth_service_1.AuthError(404, 'TASK_NOT_FOUND', 'No se encontró la tarea.');
    }
}
exports.deleteCalendarTask = deleteCalendarTask;
//# sourceMappingURL=calendar.service.js.map