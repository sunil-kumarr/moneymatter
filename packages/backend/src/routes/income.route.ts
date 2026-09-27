import createCreditController from '@controllers/income/credits/create-credit.controller';
import createLinkController from '@controllers/income/credits/create-link.controller';
import deleteCreditController from '@controllers/income/credits/delete-credit.controller';
import deleteLinkController from '@controllers/income/credits/delete-link.controller';
import listCreditsController from '@controllers/income/credits/list-credits.controller';
import updateCreditController from '@controllers/income/credits/update-credit.controller';
import createSourceController from '@controllers/income/sources/create-source.controller';
import deleteSourceController from '@controllers/income/sources/delete-source.controller';
import getSourceSummaryController from '@controllers/income/sources/get-source-summary.controller';
import getSourceTimeseriesController from '@controllers/income/sources/get-source-timeseries.controller';
import getSourceController from '@controllers/income/sources/get-source.controller';
import listSourcesController from '@controllers/income/sources/list-sources.controller';
import updateSourceController from '@controllers/income/sources/update-source.controller';
import { authenticateSession } from '@middlewares/better-auth';
import { checkBaseCurrencyLock } from '@middlewares/check-base-currency-lock';
import { validateEndpoint } from '@middlewares/validations';
import { Router } from 'express';

const router = Router({});

router.use(authenticateSession);

// Sources — static routes MUST come before '/sources/:id' so 'summary'/'timeseries' don't match as an id.
router.get('/sources', validateEndpoint(listSourcesController.schema), listSourcesController.handler);
router.post(
  '/sources',
  checkBaseCurrencyLock,
  validateEndpoint(createSourceController.schema),
  createSourceController.handler,
);
router.get('/sources/summary', validateEndpoint(getSourceSummaryController.schema), getSourceSummaryController.handler);
router.get(
  '/sources/timeseries',
  validateEndpoint(getSourceTimeseriesController.schema),
  getSourceTimeseriesController.handler,
);
router.get('/sources/:id', validateEndpoint(getSourceController.schema), getSourceController.handler);
router.put(
  '/sources/:id',
  checkBaseCurrencyLock,
  validateEndpoint(updateSourceController.schema),
  updateSourceController.handler,
);
router.delete(
  '/sources/:id',
  checkBaseCurrencyLock,
  validateEndpoint(deleteSourceController.schema),
  deleteSourceController.handler,
);
router.get(
  '/sources/:id/summary',
  validateEndpoint(getSourceSummaryController.schema),
  getSourceSummaryController.handler,
);
router.get(
  '/sources/:id/timeseries',
  validateEndpoint(getSourceTimeseriesController.schema),
  getSourceTimeseriesController.handler,
);

// Credits
router.get('/sources/:sourceId/credits', validateEndpoint(listCreditsController.schema), listCreditsController.handler);
router.post(
  '/sources/:sourceId/credits',
  checkBaseCurrencyLock,
  validateEndpoint(createCreditController.schema),
  createCreditController.handler,
);
router.put(
  '/credits/:id',
  checkBaseCurrencyLock,
  validateEndpoint(updateCreditController.schema),
  updateCreditController.handler,
);
router.delete(
  '/credits/:id',
  checkBaseCurrencyLock,
  validateEndpoint(deleteCreditController.schema),
  deleteCreditController.handler,
);

// Credit links
router.post(
  '/credits/:id/links',
  checkBaseCurrencyLock,
  validateEndpoint(createLinkController.schema),
  createLinkController.handler,
);
router.delete(
  '/credits/:id/links/:transactionId',
  checkBaseCurrencyLock,
  validateEndpoint(deleteLinkController.schema),
  deleteLinkController.handler,
);

export default router;
