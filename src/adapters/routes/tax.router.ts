import { Router } from 'express';
import { TaxController } from '../controllers/tax.controller';
import { TaxService } from '../../application/use-cases/tax.service';
import { validateRequestBody, validateRequestHeaders } from '../middlewares/validateParams.middleware';

const taxRouter = Router();

const taxController = new TaxController(
    new TaxService(),
);

taxRouter.use(
    [validateRequestHeaders, validateRequestBody],
    taxController.getRouter(),
)

export default taxRouter;
