import debugLib from 'debug';

import {
    IGetTaxRequest,
    IGetTaxResponse,
} from '../../domain/interfaces/index.interface';

import config from '../../config/config';

const debug = debugLib(`${config.basicConfig.DEBUG}:tax.service`);

export class TaxService {

    public calculateTax(
        UUID: string,
        data: IGetTaxRequest
    ): IGetTaxResponse {
        debug(`UUID: ${UUID}, data: ${JSON.stringify(data)} in APINodejs Service`);
        return { IVA: data.amount*0.19 };
    }
}
