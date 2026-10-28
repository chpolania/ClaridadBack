import { ServerConfiguration } from "./infrastructure/server/server.configuration";
import { sendErrorResponse } from "./adapters/filters/error.handler";
import taxRouter from './adapters/routes/tax.router';
import authRouter from './adapters/routes/auth.router';
import calendarRouter from './adapters/routes/calendar.router';

const server = new ServerConfiguration();
const app = server.app;
const fullApiPath = server.fullApiPath;

app.use(fullApiPath, taxRouter);
app.use(`${fullApiPath}/auth`, authRouter);
app.use(`${fullApiPath}/calendar`, calendarRouter);
app.use(sendErrorResponse);

export default app;
