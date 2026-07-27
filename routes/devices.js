const express = require('express');
const router = express.Router();
const { prisma } = require('../prisma/client');

// GET /devices - Ambil semua perangkat
router.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error.message);
    res.status(500).json({ error: 'Gagal mengambil data perangkat.' });
  }
});

// POST /devices - Tambah perangkat baru
router.post('/', async (req, res) => {
  try {
    const { nama, ip, lokasi } = req.body || {};

    // Validasi nama wajib diisi
    if (!nama || typeof nama !== 'string' || !nama.trim()) {
      return res.status(400).json({ error: 'Nama perangkat wajib diisi.' });
    }

    // Validasi IP wajib diisi dan format IPv4
    if (!ip || typeof ip !== 'string' || !ip.trim()) {
      return res.status(400).json({ error: 'IP perangkat wajib diisi.' });
    }

    const ipParts = ip.trim().split('.');
    if (ipParts.length !== 4 || !ipParts.every(p => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
      return res.status(400).json({ error: 'Format IP tidak valid. Harus IPv4.' });
    }

    // Cek IP unik
    const existing = await prisma.device.findUnique({ where: { ip: ip.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'IP sudah terdaftar.' });
    }

    const device = await prisma.device.create({
      data: {
        nama: nama.trim(),
        ip: ip.trim(),
        lokasi: lokasi && typeof lokasi === 'string' ? lokasi.trim() : null,
      },
    });

    res.status(201).json(device);
  } catch (error) {
    console.error('Error creating device:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Gagal menambahkan perangkat.', detail: error.message });
  }
});

// PUT /devices/:id - Ubah IP perangkat
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID perangkat tidak valid.' });
    }

    const { ip } = req.body || {};

    // Validasi IP
    if (!ip || typeof ip !== 'string' || !ip.trim()) {
      return res.status(400).json({ error: 'IP baru wajib diisi.' });
    }

    const ipParts = ip.trim().split('.');
    if (ipParts.length !== 4 || !ipParts.every(p => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)) {
      return res.status(400).json({ error: 'Format IP tidak valid. Harus IPv4.' });
    }

    // Cek perangkat ada
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
    }

    // Cek IP unik (kecuali milik sendiri)
    const existing = await prisma.device.findUnique({ where: { ip: ip.trim() } });
    if (existing && existing.id !== id) {
      return res.status(409).json({ error: 'IP sudah digunakan perangkat lain.' });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ip: ip.trim(),
        status: 'offline',
        latency: null,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating device:', error.message);
    res.status(500).json({ error: 'Gagal mengubah IP perangkat.' });
  }
});

// DELETE /devices/:id - Hapus perangkat
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID perangkat tidak valid.' });
    }

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({ error: 'Perangkat tidak ditemukan.' });
    }

    await prisma.device.delete({ where: { id } });

    res.json({ message: 'Perangkat berhasil dihapus.', id });
  } catch (error) {
    console.error('Error deleting device:', error.message);
    res.status(500).json({ error: 'Gagal menghapus perangkat.' });
  }
});

module.exports = router;

