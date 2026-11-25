import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import errorMiddleware from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import diseaseRoutes from './routes/diseaseRoutes.js';
import userRoutes from './routes/userRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import medicationRoutes from './routes/medicationRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import communityHealthWorkerRoutes from './routes/communityHealthWorkerRoutes.js';

const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    data: null,
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'),
  credentials: true,
}));
app.use(helmet());
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isSafeInteger(trustProxyHops) && trustProxyHops >= 0 && trustProxyHops <= 10) {
  app.set('trust proxy', trustProxyHops);
}
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan(':method :status :response-time ms'));
}
app.use(limiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API running', data: null });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/health-records', healthRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/community-health-workers', communityHealthWorkerRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', data: null });
});

app.use(errorMiddleware);

export default app;
