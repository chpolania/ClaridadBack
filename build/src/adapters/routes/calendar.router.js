"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("../../application/use-cases/auth.service");
const calendar_service_1 = require("../../application/use-cases/calendar.service");
const task_text_service_1 = require("../../application/use-cases/task-text.service");
const bearer_auth_middleware_1 = require("../middlewares/bearer-auth.middleware");
const calendarRouter = (0, express_1.Router)();
const asyncRoute = (handler) => (req, res, next) => { handler(req, res).catch(next); };
const bodyString = (req, name) => {
    const value = req.body?.[name];
    if (typeof value !== 'string' || !value.trim())
        throw new auth_service_1.AuthError(400, 'INVALID_REQUEST', `El campo ${name} es obligatorio.`);
    return value.trim();
};
calendarRouter.get('/tasks', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    const date = req.query.date;
    if (typeof date !== 'string')
        throw new auth_service_1.AuthError(400, 'INVALID_DATE', 'Envía date como YYYY-MM-DD.');
    res.status(200).json(await (0, calendar_service_1.getCalendarTasks)(res.locals.authUserId, date));
}));
calendarRouter.post('/tasks', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    const task = await (0, calendar_service_1.createCalendarTask)(res.locals.authUserId, bodyString(req, 'title'), bodyString(req, 'description'), bodyString(req, 'startsAt'), bodyString(req, 'endsAt'));
    res.status(201).json({ task });
}));
calendarRouter.delete('/tasks/:id', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    await (0, calendar_service_1.deleteCalendarTask)(res.locals.authUserId, req.params.id);
    res.status(204).end();
}));
calendarRouter.patch('/tasks/:id', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    const userId = res.locals.authUserId;
    const movedTask = await (0, task_text_service_1.schedulePendingTask)(userId, req.params.id, bodyString(req, 'startsAt'), bodyString(req, 'endsAt'));
    const selectedDate = movedTask.startsAt.slice(0, 10);
    res.status(200).json(await (0, calendar_service_1.getCalendarTasks)(userId, selectedDate));
}));
calendarRouter.post('/tasks/parse-text', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    const result = await (0, task_text_service_1.extractAndStoreTasks)(res.locals.authUserId, bodyString(req, 'text'), bodyString(req, 'date'));
    res.status(201).json(result);
}));
calendarRouter.get('/pending-tasks', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (_req, res) => {
    res.status(200).json({ tasks: await (0, task_text_service_1.listPendingTasks)(res.locals.authUserId) });
}));
calendarRouter.post('/pending-tasks/:id/schedule', bearer_auth_middleware_1.requireBearerAuth, asyncRoute(async (req, res) => {
    const task = await (0, task_text_service_1.schedulePendingTask)(res.locals.authUserId, req.params.id, bodyString(req, 'startsAt'), bodyString(req, 'endsAt'));
    res.status(201).json({ task });
}));
calendarRouter.use((error, _req, res, _next) => {
    if (error instanceof auth_service_1.AuthError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
});
exports.default = calendarRouter;
//# sourceMappingURL=calendar.router.js.map