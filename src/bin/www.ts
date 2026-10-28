import debugLib from 'debug';
import http from 'http';
import app from '../main';
import config from '../config/config';

const debug = debugLib(`${config.basicConfig.DEBUG}:server`);

const port: string | number | false = normalizePort(config.basicConfig.PORT);
app.set('port', port);
debug(`Port set to: ${config.basicConfig.PORT}`);

const server: http.Server | undefined = http.createServer(app);
debug(`Server initialized!`);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val: string) {
    const nPort = parseInt(val, 10);
    if (isNaN(nPort)) {
        return val;
    }
    if (nPort >= 0) {
        return nPort;
    }
    return false;
}

function onError(error: any) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string'
        ? `Pipe ${port}`
        : `Port ${port}`;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server 'listening' event.
 */

function onListening() {
    const addr = (server as http.Server).address();
    const bind = typeof addr === 'string'
        ? `pipe ${addr}`
        : `port ${(addr as any).port}`;
    debug('Listening on: %j', bind);
}

export default server;
