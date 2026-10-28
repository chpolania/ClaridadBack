import { NextFunction, Request, Response } from "express";
import crypto from 'crypto';
import debugLib from 'debug';

import { IAPIErrorHandler } from "../../domain/interfaces/error.interface";
import config from "../../config/config";

const debug = debugLib(`${config.basicConfig.DEBUG}:error-handler`);

export function sendErrorResponse(
    error: Error & { status?: number; errors?: unknown[], UUID: string },
    _request: Request,
    response: Response,
    _next: NextFunction,
): void {
    const status: number = error.status ?? 500;
    const currentDate: string = new Date().toISOString();
    const description: string = error.message;
    const _uuid: string = error.UUID ?? crypto.randomUUID();
    debug(`UUID: ${_uuid} - Response getting API nodejs arqsw Challenge 2: complete exception - status code: ${status} - Message: ${error.message}`);
    const responseBody: IAPIErrorHandler = {
        uuid: _uuid,
        StatusCode: status,
        Description: description,
        TimeStamp: currentDate,
    }

    debug(`UUID: ${_uuid} - Response getting API nodejs arqsw Challenge 2: ${JSON.stringify(responseBody)}`);
    response.status(status).json(responseBody);
}
