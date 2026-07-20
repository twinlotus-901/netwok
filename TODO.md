# Product Requirements Document (PRD)

## Project: Network Monitor Realtime (Node.js + Express + Prisma + MySQL)

**Versi:** 1.0
**Tanggal:** 20 Juli 2026
**Status:** Draft — siap dikembangkan

---

## 1. Tujuan Proyek

Membangun aplikasi web untuk monitoring perangkat jaringan secara **realtime**, dengan:

- **Backend:** Node.js + Express.js + Prisma ORM + MySQL
- **Frontend:** HTML/JavaScript (vanilla)
- **Fitur utama:** monitoring status & latency perangkat via ICMP ping, serta visualisasi topology jaringan interaktif yang dapat digambar dan disimpan secara manual.

Target pengguna: admin jaringan / NOC yang butuh memantau status online/offline dan latency perangkat secara realtime, sekaligus memvisualisasikan koneksi antar perangkat dalam bentuk topology.

---

## 2. Fitur Utama

### 2.1 Monitoring ICMP Realtime
- Backend melakukan ping ICMP ke seluruh perangkat setiap **5 detik**.
- Hasil ping (status online/offline + latency dalam ms) di-update ke database MySQL melalui Prisma.

### 2.2 `index.html`
- Polling endpoint `GET /devices` setiap 5 detik.
- Tabel perangkat dengan kolom: **ID, Nama, IP, Lokasi, Status, Latensi, Aksi**.
- Klik baris perangkat → menampilkan detail perangkat.
- Form tambah perangkat manual (Nama, IP, Lokasi).
- Form ubah IP perangkat berdasarkan ID.
- Tombol hapus perangkat per baris.
- Logo **LIVE** berwarna hijau dengan timer berjalan.

### 2.3 `topology.html`
- Node digambar berdasarkan data dari `GET /devices`.
- Label node minimal: **Nama + IP**.
- Klik node → menampilkan detail perangkat (Nama, IP, Lokasi, Status, Latensi).
- Kabel manual (tipe **normal**/**backup**) dapat ditambahkan antar node, tersimpan di `localStorage`.
- Node dapat di-drag bebas; posisi tersimpan di `localStorage`.
- Satu node router dapat terhubung ke banyak perangkat lain.
- Logo **LIVE** berwarna hijau dengan timer berjalan.
- Mendukung parameter URL `?focus=<id>` untuk menyorot node tertentu saat halaman dibuka.

---

## 3. Backend

### 3.1 Database — Prisma ORM + MySQL

Contoh `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Device {
  id        Int      @id @default(autoincrement())
  nama      String
  ip        String   @unique
  lokasi    String?
  status    String   @default("offline") // "online" | "offline"
  latency   Int?     // dalam milidetik, null jika offline
  updatedAt DateTime @updatedAt

  @@map("devices")
}
```

Contoh isi `.env`:
```
DATABASE_URL="mysql://user:password@localhost:3306/network_monitor"
```

Migrasi awal:
```bash
npx prisma migrate dev --name init
```

### 3.2 API Endpoints

| Method | Endpoint       | Deskripsi                              |
|--------|----------------|------------------------------------------|
| GET    | `/devices`     | Ambil semua perangkat (field lengkap)     |
| POST   | `/devices`     | Tambah perangkat baru secara manual       |
| PUT    | `/devices/:id` | Ubah IP perangkat berdasarkan ID          |
| DELETE | `/devices/:id` | Hapus perangkat berdasarkan ID            |

**`GET /devices`** — contoh response:
```json
[
  {
    "id": 1,
    "nama": "Router Utama",
    "ip": "192.168.1.1",
    "lokasi": "Server Room",
    "status": "online",
    "latency": 12
  }
]
```

**`POST /devices`** — contoh request body:
```json
{
  "nama": "Switch Lantai 2",
  "ip": "192.168.1.10",
  "lokasi": "Lantai 2"
}
```
Validasi: `nama` wajib diisi, `ip` wajib valid dan unik.

**`PUT /devices/:id`** — contoh request body:
```json
{ "ip": "192.168.1.11" }
```

**`DELETE /devices/:id`** — tidak perlu body, cukup ID pada URL.

### 3.3 Monitoring Service

Fungsi `monitorDevices()`:
- Dijalankan otomatis setiap 5 detik via `setInterval`.
- Mengambil seluruh data perangkat dari database melalui `prisma.device.findMany()`.
- Melakukan ping ICMP ke setiap IP secara paralel (`Promise.all`).
- Untuk tiap perangkat:
  - Ping berhasil → `status: "online"`, `latency: <hasil ping ms>`.
  - Ping gagal/timeout → `status: "offline"`, `latency: null`.
- Update hasil ke database via `prisma.device.update()`.

Contoh kerangka kode:
```js
const { PrismaClient } = require('@prisma/client');
const ping = require('ping');

const prisma = new PrismaClient();

async function monitorDevices() {
  const devices = await prisma.device.findMany();

  await Promise.all(
    devices.map(async (device) => {
      const res = await ping.promise.probe(device.ip, { timeout: 2 });

      await prisma.device.update({
        where: { id: device.id },
        data: {
          status: res.alive ? 'online' : 'offline',
          latency: res.alive ? Math.round(res.time) : null,
        },
      });
    })
  );
}

setInterval(monitorDevices, 5000);
```

Catatan teknis:
- Gunakan library ping yang tidak memerlukan privilese root berlebihan (mis. package `ping`).
- Beri timeout wajar (mis. 2 detik) per ping agar siklus 5 detik tidak molor saat banyak perangkat offline.

---

## 4. Frontend

### 4.1 `index.html`
- Polling `GET /devices` tiap 5 detik, render ulang tabel.
- Warna status: **hijau** (online), **merah** (offline).
- Form tambah perangkat → `POST /devices`.
- Form ubah IP → `PUT /devices/:id`.
- Tombol hapus → `DELETE /devices/:id`.
- Timer realtime (waktu sejak halaman dimuat atau waktu update terakhir) + indikator logo **LIVE** hijau.

### 4.2 `topology.html`
- Polling `GET /devices` tiap 5 detik, render ulang node.
- Warna node mengikuti status: hijau (online), merah (offline).
- Klik node → tampilkan detail perangkat (modal/panel).
- Drag node → posisi baru disimpan ke `localStorage` per ID node.
- Kabel manual (normal/backup) digambar user antar dua node, disimpan ke `localStorage`.
- Data tetap konsisten setelah reload browser.

Contoh struktur data `localStorage`:
```json
{
  "positions": {
    "1": { "x": 120, "y": 80 },
    "2": { "x": 340, "y": 200 }
  },
  "cables": [
    { "from": 1, "to": 2, "type": "normal" },
    { "from": 1, "to": 3, "type": "backup" }
  ]
}
```

---

## 5. Testing

1. Jalankan server:
   ```bash
   npm start
   ```
2. Buka `http://localhost:<port>/index.html`:
   - Pastikan tabel perangkat termuat dan status/latency ter-update tiap 5 detik.
   - Tambah perangkat baru via form, cek muncul di tabel.
   - Ubah IP perangkat via form, cek nilai berubah.
   - Hapus perangkat, cek hilang dari tabel.
3. Buka `http://localhost:<port>/topology.html?focus=<id>`:
   - Pastikan node termuat sesuai data perangkat, node dengan `id` yang dituju otomatis ter-fokus.
   - Klik node, pastikan detail perangkat tampil dengan benar.
   - Drag node ke posisi baru, reload halaman, pastikan posisi tetap tersimpan.
   - Tambahkan kabel manual (normal & backup), reload halaman, pastikan kabel tetap tersimpan.
   - Simulasikan perangkat offline (matikan device/blokir ping), pastikan warna status berubah dalam ≤5 detik.

---

## 6. Struktur Folder Project (Saran)

```
network-monitor/
├── prisma/
│   └── schema.prisma
├── server.js
├── package.json
├── .env
├── routes/
│   └── devices.js
├── services/
│   └── monitor.js
└── public/
    ├── index.html
    ├── topology.html
    ├── css/
    └── js/
        ├── index.js
        └── topology.js
```

---

## 7. Kriteria Selesai (Definition of Done)

- [ ] Prisma schema (`Device`) berhasil di-migrate ke database MySQL.
- [ ] Backend berjalan dengan `npm start` tanpa error.
- [ ] Endpoint `GET/POST/PUT/DELETE /devices` berfungsi sesuai spesifikasi menggunakan Prisma Client.
- [ ] `monitorDevices()` berjalan otomatis tiap 5 detik dan meng-update status/latency di database.
- [ ] `index.html` menampilkan tabel realtime lengkap dengan fitur tambah, ubah IP, hapus, dan detail perangkat.
- [ ] `topology.html` menampilkan node realtime lengkap dengan fitur drag, kabel manual, klik detail, dan `?focus=<id>`.
- [ ] Posisi node dan kabel manual tetap tersimpan setelah reload browser.
- [ ] Seluruh skenario pada Section 5 (Testing) berhasil dijalankan.
