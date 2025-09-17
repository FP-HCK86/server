const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { connectDB } = require('./config/mongodb');

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// CHECK API CONNECT
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// CHECK CONNECTION DATABASE
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});