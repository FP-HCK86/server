require('dotenv').config();
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { connectDB } = require('./config/mongodb');

const schedulesRoutes = require('./routes/schedules.routes');
const CronScheduler = require('./jobs/cron.scheduler')

const authRoutes = require('./routes/auth.routes')
const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))


// USE ROUTES
app.use('/', authRoutes);


// CHECK API CONNECT
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Routes
const schedulesRoutes = require('./routes/schedules.routes');
app.use('/schedules', schedulesRoutes);

// ERROR HANDLER
const errorHandler = require('./middlewares/errorHandller');
app.use(errorHandler);


// Start cron after DB connect
CronScheduler.start();

// CHECK CONNECTION DATABASE
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});