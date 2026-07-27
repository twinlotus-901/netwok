const { prisma } = require('../prisma/client');
const ping = require('ping');

/**
 * Monitor semua perangkat dengan ICMP ping setiap 5 detik.
 * Update status (online/offline) dan latency ke database.
 */
async function monitorDevices() {
  try {
    const devices = await prisma.device.findMany();

    if (devices.length === 0) {
      return;
    }

    await Promise.all(
      devices.map(async (device) => {
        try {
          const res = await ping.promise.probe(device.ip, { timeout: 2 });

          let latency = null;
          if (res.alive) {
            if (typeof res.time === 'number' && Number.isFinite(res.time)) {
              latency = Math.round(res.time);
            } else if (typeof res.time === 'string') {
              const n = Number(res.time);
              latency = Number.isFinite(n) ? Math.round(n) : null;
            }
          }

          await prisma.device.update({
            where: { id: device.id },
            data: {
              status: res.alive ? 'online' : 'offline',
              latency: res.alive ? latency : null,
            },
          });
        } catch (pingError) {
          // Jika ping gagal, set offline
          await prisma.device.update({
            where: { id: device.id },
            data: {
              status: 'offline',
              latency: null,
            },
          });
        }
      })
    );
  } catch (error) {
    console.error('monitorDevices error:', error.message);
  }
}

/**
 * Mulai monitoring interval.
 * @param {number} intervalMs - Interval dalam milidetik (default: 5000)
 */
function startMonitoring(intervalMs = 5000) {
  // Jalankan langsung sekali
  monitorDevices();

  // Lalu jalankan tiap interval
  setInterval(monitorDevices, intervalMs);

  console.log(`Monitoring dimulai: setiap ${intervalMs / 1000} detik.`);
}

module.exports = { monitorDevices, startMonitoring };

