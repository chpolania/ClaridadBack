"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulePendingTask = exports.listPendingTasks = exports.extractAndStoreTasks = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const mysql_pool_1 = require("../../infrastructure/database/mysql.pool");
const auth_service_1 = require("./auth.service");
const calendar_service_1 = require("./calendar.service");
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
function addLocalDays(date, days) {
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
}
function isValidDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
async function getTimezone(userId) {
    const [rows] = await mysql_pool_1.mysqlPool.execute('SELECT timezone FROM user_calendars WHERE user_id = ? LIMIT 1', [userId]);
    return rows.length ? rows[0].timezone : 'America/Bogota';
}
async function extractTasks(text, timezone) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.includes('REEMPLAZAR')) {
        throw new auth_service_1.AuthError(503, 'OPENAI_NOT_CONFIGURED', 'Configura una nueva OPENAI_API_KEY en el archivo .env.');
    }
    const prompt = process.env.OPENAI_TASK_EXTRACTION_PROMPT;
    if (!prompt)
        throw new auth_service_1.AuthError(503, 'OPENAI_NOT_CONFIGURED', 'Configura OPENAI_TASK_EXTRACTION_PROMPT en el archivo .env.');
    const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
    const now = new Date();
    let response;
    try {
        response = await axios_1.default.post('https://api.openai.com/v1/responses', {
            model,
            instructions: prompt,
            input: `Fecha y hora actual UTC: ${now.toISOString()}\nZona horaria local: ${timezone}\nFecha local actual: ${(0, calendar_service_1.localDateInTimezone)(now, timezone)}\n\nTexto del usuario:\n${text}`,
            reasoning: { effort: 'none' },
            text: { format: { type: 'json_schema', name: 'claridad_tasks', strict: true, schema: taskSchema } },
            max_output_tokens: 12000,
            store: false,
        }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
    }
    catch (error) {
        const apiError = error;
        if (apiError.response?.status === 401)
            throw new auth_service_1.AuthError(502, 'OPENAI_AUTH_FAILED', 'OpenAI rechazó la API key configurada.');
        throw new auth_service_1.AuthError(502, 'OPENAI_REQUEST_FAILED', 'No se pudo analizar el texto con OpenAI.');
    }
    const data = response.data;
    if (data.status === 'incomplete')
        throw new auth_service_1.AuthError(422, 'TASK_EXTRACTION_INCOMPLETE', 'El texto es demasiado largo o el análisis quedó incompleto.');
    const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
    if (typeof outputText !== 'string')
        throw new auth_service_1.AuthError(502, 'TASK_EXTRACTION_INVALID', 'OpenAI no devolvió una lista de tareas válida.');
    try {
        const parsed = JSON.parse(outputText);
        if (!Array.isArray(parsed.tasks))
            throw new Error('missing tasks');
        return parsed.tasks;
    }
    catch (_error) {
        throw new auth_service_1.AuthError(502, 'TASK_EXTRACTION_INVALID', 'OpenAI no devolvió una lista de tareas válida.');
    }
}
function taskSchedule(task, timezone) {
    if (!task.date || !task.startTime || !isValidDate(task.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.startTime))
        return null;
    const startsAt = (0, calendar_service_1.localDateTimeUtc)(task.date, task.startTime, timezone);
    let endDate = task.date;
    let endTime = task.endTime;
    if (!endTime) {
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        return { startsAt, endsAt };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime))
        return null;
    if (endTime < task.startTime)
        endDate = addLocalDays(task.date, 1);
    let endsAt = (0, calendar_service_1.localDateTimeUtc)(endDate, endTime, timezone);
    if (endsAt.getTime() <= startsAt.getTime())
        return null;
    return { startsAt, endsAt };
}
async function extractAndStoreTasks(userId, text, selectedDate) {
    if (typeof text !== 'string' || !text.trim())
        throw new auth_service_1.AuthError(400, 'INVALID_TEXT', 'Envía un texto con las tareas que deseas organizar.');
    if (Buffer.byteLength(text, 'utf8') > 100000)
        throw new auth_service_1.AuthError(413, 'TEXT_TOO_LONG', 'El texto supera el máximo de 100 KB.');
    // Validates the selected date before paying for the model request.
    await (0, calendar_service_1.getCalendarTasks)(userId, selectedDate);
    const timezone = await getTimezone(userId);
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    }
    catch (_error) {
        throw new auth_service_1.AuthError(500, 'INVALID_CALENDAR_TIMEZONE', 'La zona horaria del calendario no es válida.');
    }
    const extractedTasks = await extractTasks(text.trim(), timezone);
    const connection = await mysql_pool_1.mysqlPool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute('INSERT IGNORE INTO user_calendars (id, user_id, timezone) VALUES (?, ?, ?)', [crypto_1.default.randomUUID(), userId, timezone]);
        const [calendarRows] = await connection.execute('SELECT id, timezone FROM user_calendars WHERE user_id = ? FOR UPDATE', [userId]);
        if (!calendarRows.length)
            throw new auth_service_1.AuthError(500, 'CALENDAR_CREATE_FAILED', 'No se pudo preparar el calendario del usuario.');
        const calendarId = calendarRows[0].id;
        for (const extracted of extractedTasks) {
            const title = typeof extracted.title === 'string' ? extracted.title.trim().slice(0, 255) : '';
            if (!title)
                continue;
            const description = typeof extracted.description === 'string' && extracted.description.trim()
                ? extracted.description.trim() : title;
            const id = crypto_1.default.randomUUID();
            const schedule = taskSchedule(extracted, timezone);
            if (schedule) {
                await connection.execute('INSERT INTO calendar_tasks (id, user_id, calendar_id, title, description, starts_at_utc, ends_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, userId, calendarId, title, description, schedule.startsAt, schedule.endsAt]);
            }
            else {
                const suggestedDate = typeof extracted.date === 'string' && isValidDate(extracted.date) ? extracted.date : null;
                const suggestedStartTime = typeof extracted.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(extracted.startTime) ? extracted.startTime : null;
                await connection.execute('INSERT INTO pending_calendar_tasks (id, user_id, title, description, suggested_date, suggested_start_time, source_text) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, userId, title, description, suggestedDate, suggestedStartTime, text.trim()]);
            }
        }
        await connection.commit();
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
    // Read persisted state so this endpoint matches GET /calendar/tasks?date=...
    return (0, calendar_service_1.getCalendarTasks)(userId, selectedDate);
}
exports.extractAndStoreTasks = extractAndStoreTasks;
async function listPendingTasks(userId) {
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
exports.listPendingTasks = listPendingTasks;
async function schedulePendingTask(userId, taskId, startsAt, endsAt) {
    const connection = await mysql_pool_1.mysqlPool.getConnection();
    try {
        await connection.beginTransaction();
        const [tasks] = await connection.execute('SELECT id, title, description FROM pending_calendar_tasks WHERE id = ? AND user_id = ? FOR UPDATE', [taskId, userId]);
        if (!tasks.length)
            throw new auth_service_1.AuthError(404, 'PENDING_TASK_NOT_FOUND', 'No se encontró la tarea pendiente.');
        const [calendars] = await connection.execute('SELECT id, timezone FROM user_calendars WHERE user_id = ? FOR UPDATE', [userId]);
        if (!calendars.length)
            throw new auth_service_1.AuthError(500, 'CALENDAR_NOT_FOUND', 'No se encontró el calendario del usuario.');
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || !/(Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !/(Z|[+-]\d{2}:\d{2})$/.test(endsAt)) {
            throw new auth_service_1.AuthError(400, 'INVALID_TASK_TIME', 'startsAt y endsAt deben incluir fecha, hora y zona; endsAt debe ser posterior.');
        }
        const newId = crypto_1.default.randomUUID();
        await connection.execute('INSERT INTO calendar_tasks (id, user_id, calendar_id, title, description, starts_at_utc, ends_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId, userId, calendars[0].id, tasks[0].title, tasks[0].description, start, end]);
        await connection.execute('DELETE FROM pending_calendar_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        await connection.commit();
        return {
            id: newId,
            title: tasks[0].title,
            description: tasks[0].description,
            startsAt: (0, calendar_service_1.isoInTimezone)(start, calendars[0].timezone),
            endsAt: (0, calendar_service_1.isoInTimezone)(end, calendars[0].timezone),
            timezone: calendars[0].timezone,
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
exports.schedulePendingTask = schedulePendingTask;
//# sourceMappingURL=task-text.service.js.map