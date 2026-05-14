import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    // Permite localhost em qualquer porta e requisições sem origin (ex: Postman)
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Muitas requisições, tente novamente em breve' },
}));

// Rate limiting mais estrito para auth
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'orus-backend' }));

app.use('/api', apiRouter);

app.use(errorHandler);

export default app;
