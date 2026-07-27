const express = require('express');
const path = require('path');
const { prisma } = require('./prisma/client');
const devicesRouter = require('./routes/devices');
const { startMonitoring } = require('./services/monitor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/devices', devicesRouter);

// Health check / ping endpoint (untuk frontend polling)
const ping = require('ping');
app.post('/ping', async (req, res) => {
  const { ip } = req.body || {};
  if (!ip || typeof ip !== 'string' || !ip.trim()) {
    return res.status(400).json({ error: 'IP diperlukan.' });
  }
  try {
    const result = await ping.promise.probe(ip.trim(), { timeout: 2 });
    const alive = !!result.alive;
    let latency = null;
    if (alive && typeof result.time === 'number' && Number.isFinite(result.time)) {
      latency = Math.round(result.time);
    } else if (alive && typeof result.time === 'string') {
      const n = Number(result.time);
      latency = Number.isFinite(n) ? Math.round(n) : null;
    }
    res.json({ ip: ip.trim(), status: alive ? 'online' : 'offline', latency });
  } catch (e) {
    res.json({ ip: ip.trim(), status: 'offline', latency: null });
  }
});

// Redirect root ke /index.html
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Start server
async function start() {
  try {
    // Mulai monitoring ICMP
    startMonitoring(5000);

    app.listen(PORT, () => {
      console.log(`Network Monitor berjalan di http://localhost:${PORT}`);
      console.log(`  - Index   : http://localhost:${PORT}/index.html`);
      console.log(`  - Topology: http://localhost:${PORT}/topology.html`);
      console.log(`  - API     : http://localhost:${PORT}/devices`);
    });
  } catch (error) {
    console.error('Gagal memulai server:', error.message);
    process.exit(1);
  }
}

start();

