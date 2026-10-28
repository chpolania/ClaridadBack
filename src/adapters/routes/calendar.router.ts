import { NextFunction, Request, Response, Router } from 'express';
import { AuthError } from '../../application/use-cases/auth.service';
import { createCalendarTask, deleteCalendarTask, getCalendarTasks } from '../../application/use-cases/calendar.service';
import { extractAndStoreTasks, listPendingTasks, schedulePendingTask } from '../../application/use-cases/task-text.service';
import { requireBearerAuth } from '../middlewares/bearer-auth.middleware';

const calendarRouter = Router();
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
const bodyString = (req: Request, name: string): string => {
    const value = req.body?.[name];
    if (typeof value !== 'string' || !value.trim()) throw new AuthError(400, 'INVALID_REQUEST', `El campo ${name} es obligatorio.`);
    return value.trim();
};

calendarRouter.get('/tasks', requireBearerAuth, asyncRoute(async (req, res) => {
    const date = req.query.date;
    if (typeof date !== 'string') throw new AuthError(400, 'INVALID_DATE', 'Envía date como YYYY-MM-DD.');
    res.status(200).json(await getCalendarTasks(res.locals.authUserId as string, date));
}));

calendarRouter.post('/tasks', requireBearerAuth, asyncRoute(async (req, res) => {
    const task = await createCalendarTask(
        res.locals.authUserId as string,
        bodyString(req, 'title'),
        bodyString(req, 'description'),
        bodyString(req, 'startsAt'),
        bodyString(req, 'endsAt'),
    );
    res.status(201).json({ task });
}));

calendarRouter.delete('/tasks/:id', requireBearerAuth, asyncRoute(async (req, res) => {
    await deleteCalendarTask(res.locals.authUserId as string, req.params.id);
    res.status(204).end();
}));

calendarRouter.patch('/tasks/:id', requireBearerAuth, asyncRoute(async (req, res) => {
    const userId = res.locals.authUserId as string;
    const movedTask = await schedulePendingTask(
        userId,
        req.params.id,
        bodyString(req, 'startsAt'),
        bodyString(req, 'endsAt'),
    );
    const selectedDate = movedTask.startsAt.slice(0, 10);
    res.status(200).json(await getCalendarTasks(userId, selectedDate));
}));

calendarRouter.post('/tasks/parse-text', requireBearerAuth, asyncRoute(async (req, res) => {
    const result = await extractAndStoreTasks(
        res.locals.authUserId as string,
        bodyString(req, 'text'),
        bodyString(req, 'date'),
    );
    res.status(201).json(result);
}));

calendarRouter.get('/pending-tasks', requireBearerAuth, asyncRoute(async (_req, res) => {
    res.status(200).json({ tasks: await listPendingTasks(res.locals.authUserId as string) });
}));

calendarRouter.post('/pending-tasks/:id/schedule', requireBearerAuth, asyncRoute(async (req, res) => {
    const task = await schedulePendingTask(
        res.locals.authUserId as string,
        req.params.id,
        bodyString(req, 'startsAt'),
        bodyString(req, 'endsAt'),
    );
    res.status(201).json({ task });
}));

calendarRouter.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AuthError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
});

export default calendarRouter;
