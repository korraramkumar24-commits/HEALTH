import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';
import seedDemoData from './utils/seed.js';
import { startReminderService } from './utils/reminderService.js';

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
    if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
      throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
    }
    if (process.env.NODE_ENV === 'production') {
      const clientUrl = new URL(process.env.CLIENT_URL || '');
      if (clientUrl.protocol !== 'https:') {
        throw new Error('CLIENT_URL must be an HTTPS origin in production.');
      }
    }

    await connectDB();
    await seedDemoData();
    startReminderService();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch {
    console.error('Server startup failed. The API was not started.');
    process.exit(1);
  }
};

startServer();
