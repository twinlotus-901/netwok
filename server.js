const express = require('express');
const ping = require('ping');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.urlencoded({ extended: true }));

const PORT = 3000;

// POST /ping → ping satu IP dan kembalikan hasilnya
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
      latency = Math.round(result.time * 100) / 100;
    } else if (alive && typeof result.time === 'string') {
      const n = Number(result.time);
      latency = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }
    res.json({ ip: ip.trim(), status: alive ? 'online' : 'offline', latency });
  } catch (e) {
    res.json({ ip: ip.trim(), status: 'offline', latency: null });
  }
});

app.listen(PORT, () => {
  console.log('Network monitor running at http://localhost:' + PORT + '/index.html');
  console.log('Backend: hanya endpoint POST /ping untuk ICMP probe.');
  console.log('Semua data device disimpan di localStorage frontend.');
});
