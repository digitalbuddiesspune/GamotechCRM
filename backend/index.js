import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { connectRedis } from './config/redis.js';
import { mountSwaggerDocs } from './config/swagger.js';
import { bindSocketServer } from './services/realtimeNotification.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5011;
const companies = ['gamotechSolution'];

// Connect Database
await connectDB();
await connectRedis();

// Background job: auto check-out previous day's open sessions
const runAttendanceSweeper = async () => {
  for (const company of companies) {
    try {
      const attendanceUtil = await import(`./utils/${company}/${company}_attendanceAutoCheckout.js`);
      const { updated } = await attendanceUtil.autoCheckoutPreviousDays();
      if (updated) console.log(`[${company}] Auto checked-out ${updated} attendance record(s)`);
    } catch (e) {
      console.error(`[${company}] Attendance auto-checkout job failed:`, e?.message || e);
    }
  }
};
runAttendanceSweeper();

// Daily 11:59 PM auto checkout for users who forgot to check out
const scheduleDailyAttendanceAutoCheckout = () => {
  const now = new Date();
  const runAt = new Date(now);
  runAt.setHours(23, 59, 0, 0);
  if (runAt <= now) runAt.setDate(runAt.getDate() + 1);

  const delay = runAt.getTime() - now.getTime();
  setTimeout(async () => {
    for (const company of companies) {
      try {
        const attendanceUtil = await import(`./utils/${company}/${company}_attendanceAutoCheckout.js`);
        const { updated } = await attendanceUtil.autoCheckoutForDay(new Date());
        if (updated) console.log(`[${company}] 11:59 PM auto checked-out ${updated} attendance record(s)`);
      } catch (e) {
        console.error(`[${company}] 11:59 PM attendance auto-checkout failed:`, e?.message || e);
      }
    }
    scheduleDailyAttendanceAutoCheckout();
  }, delay);
};
scheduleDailyAttendanceAutoCheckout();

// Auto task scheduler: generate recurring tasks from templates
const runRecurringTaskScheduler = async () => {
  for (const company of companies) {
    try {
      const recurringUtil = await import(`./utils/${company}/${company}_recurringTaskScheduler.js`);
      const { processedTemplates, generatedCount } = await recurringUtil.processRecurringTasks();
      if (processedTemplates > 0 || generatedCount > 0) {
        console.log(`[${company}] Recurring tasks processed: ${processedTemplates}, generated: ${generatedCount}`);
      }
    } catch (e) {
      console.error(`[${company}] Recurring task scheduler failed:`, e?.message || e);
    }
  }
};

runRecurringTaskScheduler();
setInterval(runRecurringTaskScheduler, 10 * 60 * 1000);

const DEFAULT_CORS_ORIGINS = [
  'https://crm-mauve-mu.vercel.app',
  'https://www.dmcrms.in',
  'https://dmcrms.in',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
];

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: corsOrigins.length ? corsOrigins : DEFAULT_CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

mountSwaggerDocs(app);

app.get('/', (req, res) => {
  res.send('Welcome to the CRM API');
});

const routeFiles = [
  'designationRoute',
  'employeeRoute',
  'clientRoute',
  'projectRoute',
  'salaryRoute',
  'attendanceRoute',
  'leadRoute',
  'socialMediaCalendarRoute',
  'authRoute',
  'taskRoute',
  'collaboratorRoute',
  'leaveRoute',
  'billingRoute',
  'quotationRoute',
  'documentRoute',
  'companyRoute',
  'expenseRoute',
  'clientProfileRoute',
  'locationRoute',
  'chatRoute',
  'assetRoute',
  'notificationRoute',
  'announcementRoute',
];

for (const company of companies) {
  for (const routeFile of routeFiles) {
    const routeModule = await import(`./routes/${company}/${company}_${routeFile}.js`);
    app.use(`/api/v1/${company}`, routeModule.default);
  }
}

{
  const sheetLeadRoute = await import('./routes/gamotechSolution/gamotechSolution_sheetLeadRoute.js');
  app.use('/api/v1/gamotechSolution', sheetLeadRoute.default);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = Array.isArray(corsOptions.origin)
        ? corsOptions.origin
        : DEFAULT_CORS_ORIGINS;
      if (allowed.includes(origin) || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});
bindSocketServer(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO ready at /socket.io`);
});
