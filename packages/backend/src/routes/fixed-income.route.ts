import appendLinksController from '@controllers/investments/fixed-income/events/append-links.controller';
import createEventController from '@controllers/investments/fixed-income/events/create-event.controller';
import deleteEventController from '@controllers/investments/fixed-income/events/delete-event.controller';
import deleteLinkController from '@controllers/investments/fixed-income/events/delete-link.controller';
import getEventController from '@controllers/investments/fixed-income/events/get-event.controller';
import listEventsController from '@controllers/investments/fixed-income/events/list-events.controller';
import updateEventController from '@controllers/investments/fixed-income/events/update-event.controller';
import createPositionController from '@controllers/investments/fixed-income/positions/create-position.controller';
import deletePositionController from '@controllers/investments/fixed-income/positions/delete-position.controller';
import getPositionMetricsController from '@controllers/investments/fixed-income/positions/get-position-metrics.controller';
import getPositionController from '@controllers/investments/fixed-income/positions/get-position.controller';
import listPositionsController from '@controllers/investments/fixed-income/positions/list-positions.controller';
import updatePositionController from '@controllers/investments/fixed-income/positions/update-position.controller';
import { authenticateSession } from '@middlewares/better-auth';
import { checkBaseCurrencyLock } from '@middlewares/check-base-currency-lock';
import { validateEndpoint } from '@middlewares/validations';
import { Router } from 'express';

const router = Router({});

router.use(authenticateSession);

// Positions
router.get('/positions', validateEndpoint(listPositionsController.schema), listPositionsController.handler);
router.get('/positions/:id', validateEndpoint(getPositionController.schema), getPositionController.handler);
router.get(
  '/positions/:id/metrics',
  validateEndpoint(getPositionMetricsController.schema),
  getPositionMetricsController.handler,
);
router.post(
  '/positions',
  checkBaseCurrencyLock,
  validateEndpoint(createPositionController.schema),
  createPositionController.handler,
);
router.put(
  '/positions/:id',
  checkBaseCurrencyLock,
  validateEndpoint(updatePositionController.schema),
  updatePositionController.handler,
);
router.delete(
  '/positions/:id',
  checkBaseCurrencyLock,
  validateEndpoint(deletePositionController.schema),
  deletePositionController.handler,
);

// Events
router.get(
  '/positions/:positionId/events',
  validateEndpoint(listEventsController.schema),
  listEventsController.handler,
);
router.post(
  '/positions/:positionId/events',
  checkBaseCurrencyLock,
  validateEndpoint(createEventController.schema),
  createEventController.handler,
);
router.get('/events/:id', validateEndpoint(getEventController.schema), getEventController.handler);
router.put(
  '/events/:id',
  checkBaseCurrencyLock,
  validateEndpoint(updateEventController.schema),
  updateEventController.handler,
);
router.delete(
  '/events/:id',
  checkBaseCurrencyLock,
  validateEndpoint(deleteEventController.schema),
  deleteEventController.handler,
);

// Event links
router.post(
  '/events/:id/links',
  checkBaseCurrencyLock,
  validateEndpoint(appendLinksController.schema),
  appendLinksController.handler,
);
router.delete(
  '/events/:id/links/:linkId',
  checkBaseCurrencyLock,
  validateEndpoint(deleteLinkController.schema),
  deleteLinkController.handler,
);

export default router;
