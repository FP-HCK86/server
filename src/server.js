require('dotenv').config();
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { connectDB } = require('./config/mongodb');
// const CronScheduler = require('./jobs/cron.scheduler')

const authRoutes = require('./routes/auth.routes')
const PORT = env.port;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))


// USE ROUTES
app.use('/', authRoutes);


// CHECK API CONNECT
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Routes
app.use('/', authRoutes);

const schedulesRoutes = require('./routes/schedules.routes');
app.use('/schedules', schedulesRoutes);

const aiRoutes = require('./routes/ai.routes');
app.use('/ai', aiRoutes);

const personaRoutes = require('./routes/persona.routes');
app.use('/personas', personaRoutes);

const videosRouter = require('./routes/videos.routes');
app.use('/videos', videosRouter);

const accountLateRoutes = require('./routes/accountLate.routes');
app.use('/accounts', accountLateRoutes);

const vendorRoutes = require('./routes/vendor.routes');
require('./jobs/cron.scheduler');
app.use('/vendor', vendorRoutes);


// ERROR HANDLER
const errorHandler = require('./middlewares/errorHandller');
app.use(errorHandler);


// Start cron after DB connect
// CronScheduler.start();

// CHECK CONNECTION DATABASE
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});