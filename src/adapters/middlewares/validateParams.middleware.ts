import { NextFunction, Response } from 'express';

import {
    CustomError,
    getRequestUUID,
} from '../../utils/index.utils';
import {
    ICustomRequest,
    IHeadersDTORequest,
    IParamType,
    IRequest,
} from '../../domain/interfaces/index.interface';

type ParamProvider = (req: ICustomRequest) => string[];

const validateParams =
    (paramProvider: ParamProvider, paramType: IParamType) =>
        async (req: IRequest, _res: Response, next: NextFunction) => {
            const UUID = getRequestUUID(req as ICustomRequest);
            const params = paramProvider(req as ICustomRequest);

            const isParamValid = (param: string): boolean => {
                if (param === null || param === undefined) {
                    return false;
                }
                return true;
            };

            if (params.some((param) => !isParamValid(param))) {
                return next(new CustomError(`UUID: ${UUID}, 400, ${paramType}: parameters is not valid)`));
            }

            next();
        };

export const validateRequestBody = validateParams((req) =>
    Object.values(req.body),
    'body'
);
export const validateRequestHeaders = validateParams((req) =>
    Object.values(req.headers as IHeadersDTORequest),
    'headers'
);
