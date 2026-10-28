import debugLib from 'debug';
import { NextFunction, Response, Router } from 'express';

import {
    ICustomRequest,
    IGetTaxRequest,
    IGetTaxResponse,
    IRequest,
} from '../../domain/interfaces/index.interface';

import { TaxService } from '../../application/use-cases/tax.service';
import { CustomError, getRequestUUID } from '../../utils/index.utils';
import config from '../../config/config';

const debug = debugLib(`${config.basicConfig.DEBUG}: tax.controller`)

export class TaxController {
    private readonly router = Router();

    constructor(
        private readonly taxCalculator: TaxService,
    ) {
        this.router.post(
            `/tax`,
            (req: IRequest, res: Response, next: NextFunction) => {
                this.getTax(req, res, next);
            },
        );
    }

    getTax(
        req: IRequest,
        res: Response,
        next: NextFunction
    ) {
        const UUID: string = getRequestUUID(req as ICustomRequest);
        try {
            const data = req.body as ICustomRequest<IGetTaxRequest>['body'];
            const response: IGetTaxResponse = this.taxCalculator.calculateTax(UUID, data);

            res.status(200).json(
                response
            )
            debug(`UUID: ${UUID} - Response with content ${JSON.stringify(response)}`);
        } catch (error: any) {
            const err = new CustomError(UUID, error.StatusCOode, error.message);
            next(err);
        }
    }

    public getRouter() {
        return this.router;
    }

}
