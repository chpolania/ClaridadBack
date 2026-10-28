import axios from 'axios';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { mysqlPool as pool } from '../../infrastructure/database/mysql.pool';
import { AuthError } from './auth.service';
import { getCalendarTasks, isoInTimezone, localDateInTimezone, localDateTimeUtc } from './calendar.service';

interface ExtractedTask {
    title: string;
    description: string;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
}

const taskSchema = {
    type: 'object', additionalProperties: false,
    properties: {
        tasks: {
            type: 'array', items: {
                type: 'object', additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    date: { type: ['string', 'null'] },
                    startTime: { type: ['string', 'null'] },
                    endTime: { type: ['string', 'null'] },
                },
                required: ['title', 'description', 'date', 'startTime', 'endTime'],
            },
        },
    },
    required: ['tasks'],
};

function addLocalDays(date: string, days: number): string {
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
}

function isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

async function getTimezone(userId: string): Promise<string> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        'SELECT timezone FROM user_calendars WHERE user_id = ? LIMIT 1', [userId],
    );
    return rows.length ? rows[0].timezone as string : 'America/Bogota';
}

async function extractTasks(text: string, timezone: string): Promise<ExtractedTask[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.includes('REEMPLAZAR')) {
        throw new AuthError(503, 'OPENAI_NOT_CONFIGURED', 'Configura una nueva OPENAI_API_KEY en el archivo .env.');
    }
    const prompt = process.env.OPENAI_TASK_EXTRACTION_PROMPT;
    if (!prompt) throw new AuthError(503, 'OPENAI_NOT_CONFIGURED', 'Configura OPENAI_TASK_EXTRACTION_PROMPT en el archivo .env.');

    const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
    const now = new Date();
    let response;
    try {
        response = await axios.post('https://api.openai.com/v1/responses', {
            model,
            instructions: prompt,
            input: `Fecha y hora actual UTC: ${now.toISOString()}\nZona horaria local: ${timezone}\nFecha local actual: ${localDateInTimezone(now, timezone)}\n\nTexto del usuario:\n${text}`,
            reasoning: { effort: 'none' },
            text: { format: { type: 'json_schema', name: 'claridad_tasks', strict: true, schema: taskSchema } },
            max_output_tokens: 12000,
            store: false,
        }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
    } catch (error) {
        const apiError = error as { response?: { status?: number } };
        if (apiError.response?.status === 401) throw new AuthError(502, 'OPENAI_AUTH_FAILED', 'OpenAI rechazó la API key configurada.');
        throw new AuthError(502, 'OPENAI_REQUEST_FAILED', 'No se pudo analizar el texto con OpenAI.');
    }

    const data = response.data;
    if (data.status === 'incomplete') throw new AuthError(422, 'TASK_EXTRACTION_INCOMPLETE', 'El texto es demasiado largo o el análisis quedó incompleto.');
    const outputText = data.output_text || data.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text;
    if (typeof outputText !== 'string') throw new AuthError(502, 'TASK_EXTRACTION_INVALID', 'OpenAI no devolvió una lista de tareas válida.');
    try {
        const parsed = JSON.parse(outputText);
        if (!Array.isArray(parsed.tasks)) throw new Error('missing tasks');
        return parsed.tasks as ExtractedTask[];
    } catch (_error) {
        throw new AuthError(502, 'TASK_EXTRACTION_INVALID', 'OpenAI no devolvió una lista de tareas válida.');
    }
}

function taskSchedule(task: ExtractedTask, timezone: string): { startsAt: Date; endsAt: Date } | null {
    if (!task.date || !task.startTime || !isValidDate(task.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.startTime)) return null;
    const startsAt = localDateTimeUtc(task.date, task.startTime, timezone);
    let endDate = task.date;
    let endTime = task.endTime;
    if (!endTime) {
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        return { startsAt, endsAt };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return null;
    if (endTime < task.startTime) endDate = addLocalDays(task.date, 1);
    let endsAt = localDateTimeUtc(endDate, endTime, timezone);
    if (endsAt.getTime() <= startsAt.getTime()) return null;
    return { startsAt, endsAt };
}

export async function extractAndStoreTasks(userId: string, text: string, selectedDate: string) {
    if (typeof text !== 'string' || !text.trim()) throw new AuthError(400, 'INVALID_TEXT', 'Envía un texto con las tareas que deseas organizar.');
    if (Buffer.byteLength(text, 'utf8') > 100000) throw new AuthError(413, 'TEXT_TOO_LONG', 'El texto supera el máximo de 100 KB.');

    // Validates the selected date before paying for the model request.
    await getCalendarTasks(userId, selectedDate);
    const timezone = await getTimezone(userId);
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
    catch (_error) { throw new AuthError(500, 'INVALID_CALENDAR_TIMEZONE', 'La zona horaria del calendario no es válida.'); }
    const extractedTasks = await extractTasks(text.trim(), timezone);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            'INSERT IGNORE INTO user_calendars (id, user_id, timezone) VALUES (?, ?, ?)',
            [crypto.randomUUID(), userId, timezone],
        );
        const [calendarRows] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT id, timezone FROM user_calendars WHERE user_id = ? FOR UPDATE', [userId],
        );
        if (!calendarRows.length) throw new AuthError(500, 'CALENDAR_CREATE_FAILED', 'No se pudo preparar el calendario del usuario.');
        const calendarId = calendarRows[0].id as string;

        for (const extracted of extractedTasks) {
            const title = typeof extracted.title === 'string' ? extracted.title.trim().slice(0, 255) : '';
            if (!title) continue;
            const description = typeof extracted.description === 'string' && extracted.description.trim()
                ? extracted.description.trim() : title;
            const id = crypto.randomUUID();
            const schedule = taskSchedule(extracted, timezone);
            if (schedule) {
                await connection.execute(
                    'INSERT INTO calendar_tasks (id, user_id, calendar_id, title, description, starts_at_utc, ends_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, userId, calendarId, title, description, schedule.startsAt, schedule.endsAt],
                );
            } else {
                const suggestedDate = typeof extracted.date === 'string' && isValidDate(extracted.date) ? extracted.date : null;
                const suggestedStartTime = typeof extracted.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(extracted.startTime) ? extracted.startTime : null;
                await connection.execute(
                    'INSERT INTO pending_calendar_tasks (id, user_id, title, description, suggested_date, suggested_start_time, source_text) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, userId, title, description, suggestedDate, suggestedStartTime, text.trim()],
                );
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }

    // Read persisted state so this endpoint matches GET /calendar/tasks?date=...
    return getCalendarTasks(userId, selectedDate);
}

export async function listPendingTasks(userId: string) {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT id, title, description, suggested_date, suggested_start_time, created_at
         FROM pending_calendar_tasks WHERE user_id = ? ORDER BY created_at ASC`, [userId],
    );
    return rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: row.description as string,
        suggestedDate: row.suggested_date
            ? (row.suggested_date instanceof Date ? row.suggested_date.toISOString().slice(0, 10) : String(row.suggested_date).slice(0, 10))
            : null,
        suggestedStartTime: row.suggested_start_time
            ? (row.suggested_start_time instanceof Date ? row.suggested_start_time.toISOString().slice(11, 16) : String(row.suggested_start_time).slice(0, 5))
            : null,
    }));
}

export async function schedulePendingTask(userId: string, taskId: string, startsAt: string, endsAt: string) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [tasks] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT id, title, description FROM pending_calendar_tasks WHERE id = ? AND user_id = ? FOR UPDATE', [taskId, userId],
        );
        if (!tasks.length) throw new AuthError(404, 'PENDING_TASK_NOT_FOUND', 'No se encontró la tarea pendiente.');
        const [calendars] = await connection.execute<mysql.RowDataPacket[]>(
            'SELECT id, timezone FROM user_calendars WHERE user_id = ? FOR UPDATE', [userId],
        );
        if (!calendars.length) throw new AuthError(500, 'CALENDAR_NOT_FOUND', 'No se encontró el calendario del usuario.');
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !/(Z|[+-]\d{2}:\d{2})$/.test(endsAt)) {
            throw new AuthError(400, 'INVALID_TASK_TIME', 'startsAt y endsAt deben incluir fecha, hora y zona; endsAt debe ser posterior.');
        }
        const newId = crypto.randomUUID();
        await connection.execute(
            'INSERT INTO calendar_tasks (id, user_id, calendar_id, title, description, starts_at_utc, ends_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newId, userId, calendars[0].id, tasks[0].title, tasks[0].description, start, end],
        );
        await connection.execute('DELETE FROM pending_calendar_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        await connection.commit();
        return {
            id: newId,
            title: tasks[0].title as string,
            description: tasks[0].description as string,
            startsAt: isoInTimezone(start, calendars[0].timezone as string),
            endsAt: isoInTimezone(end, calendars[0].timezone as string),
            timezone: calendars[0].timezone as string,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}
