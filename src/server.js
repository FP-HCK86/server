require('dotenv').config();
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { connectDB } = require('./config/mongodb');
const CronScheduler = require('./jobs/cron.scheduler');

const authRoutes = require('./routes/auth.routes')
const PORT = env.port;
const app = express();

// CORS configuration
// const corsOptions = {
//   origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   credentials: true
// };

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// USE ROUTES

app.use('/auth', authRoutes);
app.use('/', authRoutes)

// CHECK API CONNECT
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Test endpoint for debugging
app.get('/test', (req, res) => {
  console.log('[TEST] GET /test called');
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

app.post('/test', (req, res) => {
  console.log('[TEST] POST /test called with body:', req.body);
  res.json({ message: 'Test POST working', body: req.body, timestamp: new Date().toISOString() });
});

// Routes
const schedulesRoutes = require('./routes/schedules.routes');
app.use('/schedules', schedulesRoutes);

const aiRoutes = require('./routes/ai.routes');
app.use('/ai', aiRoutes);

const personaRoutes = require('./routes/persona.routes');
app.use('/personas', personaRoutes);

const chatSessionsRoutes = require('./routes/chatSessions.routes');
app.use('/chat-sessions', chatSessionsRoutes);

const videosRouter = require('./routes/videos.routes');
app.use('/videos', videosRouter);

const accountLateRoutes = require('./routes/accountLate.routes');
app.use('/accounts', accountLateRoutes);

const vendorRoutes = require('./routes/vendor.routes');
// Removed bare require of cron file (we will explicitly start it after DB connects)
app.use('/vendor', vendorRoutes);


const connectSocialLateRoutes = require('./routes/connectSocialLate.routes');
app.use('/connect', connectSocialLateRoutes);

const userRoutes = require('./routes/user.routes');
app.use('/user', userRoutes);
// Payment routes (Midtrans integration)
const paymentRoutes = require('./routes/payment.routes');
app.use('/payment', paymentRoutes);
const errorHandler = require('./middlewares/errorHandller');
app.use(errorHandler);

// Start cron after DB connect
// CronScheduler.start();

// CHECK CONNECTION DATABASE
connectDB().then(() => {
  CronScheduler.start();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});