import express from 'express';
import { apiRouter } from './routes/api.js';
import { pingDatabase } from './db/pool.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import { requestContext } from './middleware/request.js';

export const app = express();

app.disable('x-powered-by');
app.set('query parser', 'simple');
app.use(requestContext);
app.use(express.json({ limit: '100kb', strict: true }));

app.get('/health', async (_req, res, next) => {
  try {
    await pingDatabase();
    res.status(200).json({ success: true, service: 'techgear-api', database: 'ok' });
  } catch (error) {
    error.statusCode = 503;
    error.code = 'DATABASE_UNAVAILABLE';
    next(error);
  }
});

app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
