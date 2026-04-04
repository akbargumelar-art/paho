# Paho Deep Audit — Live Read/Write vs Mirroring

Tanggal: 2026-04-05
Scope audit: `/root/paho`
Tujuan: menilai apakah Paho bisa diubah menjadi UI utama yang melakukan live reading/writing terhadap Hermes & OpenClaw, atau lebih aman memakai model mirroring/sinkronisasi

## Executive summary

Jawaban singkat:
- Ya, Paho bisa diubah menjadi UI utama Hermes/OpenClaw
- Tapi dalam bentuk sekarang, Paho masih sangat database-centric
- Paho belum cocok dijadikan live read/write penuh tanpa refactor yang cukup serius
- Untuk produksi, saya lebih menyarankan model hybrid:
  - live read untuk file/file blueprint dan runtime state yang aman dibaca langsung
  - controlled write via adapter/service layer
  - mirroring terbatas untuk data yang memang lebih cocok disimpan terstruktur di DB

Penilaian arsitektur:
- Live read: sangat layak
- Live write langsung ke semua sumber: berisiko dan tidak konsisten
- Hybrid live-read + controlled-write + selective mirroring: paling layak

## Temuan utama

## 1) Paho saat ini berbasis database lokal, bukan file-first

Bukti:
- `src/db/index.ts` memakai `drizzle-orm/libsql`
- database default: `file:./data/aspri.db`
- `src/db/schema.ts` mendefinisikan banyak tabel aplikasi:
  - tasks
  - reminders
  - projects
  - handoff_jobs
  - execution_logs
  - approval_guardrails
  - pilot_evaluation_items
  - model_policies
- `src/db/seed.ts` mengisi DB dari mock data

Implikasi:
- banyak page dan API Paho menganggap DB adalah source of truth utama
- ini berbeda dengan blueprint aktif kita yang file-first di `/root/assistant`, plus runtime tertentu di Hermes/OpenClaw

## 2) Sebagian route API Paho sudah mendekati live file integration

Bukti:
- `src/app/api/openclaw/route.ts`
  - membaca langsung `/root/.openclaw/exec-approvals.json`
  - POST menulis kembali langsung ke file tersebut

Implikasi:
- secara teknis Paho sudah membuktikan bahwa ia bisa menjadi UI live read/write ke file nyata
- tetapi pola ini masih sporadis dan belum menjadi arsitektur utama aplikasi

## 3) Mayoritas route aplikasi tetap DB-centric

Contoh:
- `src/app/api/tasks/route.ts` -> baca/tulis tabel `tasks`
- `src/app/api/reminders/route.ts` -> baca/tulis tabel `reminders`
- `src/app/api/jobs/route.ts` -> baca/tulis tabel `handoffJobs`
- `src/app/api/logs/route.ts` -> baca tabel `executionLogs`
- `src/app/api/pilot/route.ts` -> baca tabel `pilotEvaluationItems`

Implikasi:
- kalau dibiarkan seperti sekarang, Paho akan terus menjadi sistem data paralel
- ini berpotensi bentrok dengan source of truth file-based yang sudah kita tetapkan

## 4) Frontend state Paho juga diasumsikan berasal dari API DB

Bukti:
- `src/lib/store.ts` melakukan `fetchAll()` ke:
  - `/api/tasks`
  - `/api/task-groups`
  - `/api/reminders`
  - `/api/projects`
  - `/api/jobs`
  - `/api/logs`
  - `/api/approvals`
  - `/api/pilot`
  - `/api/policies`
  - `/api/metrics`
- lalu menyimpan hasilnya di Zustand store

Implikasi:
- UI Paho sudah siap jadi dashboard kaya fitur
- tapi sumber datanya harus kita ubah agar tidak lagi dominan dari DB lokal jika kita ingin file-first architecture

## 5) Secara produk/UX, Paho sangat cocok jadi UI utama

Bukti:
- sudah ada halaman dashboard yang sesuai domain problem:
  - dashboard/tasks
  - dashboard/jobs
  - dashboard/logs
  - dashboard/policy
  - dashboard/openclaw
  - dashboard/hermes
  - dashboard/pilot
  - dashboard/approvals
  - dashboard/projects
- stack modern dan bagus untuk UI utama:
  - Next.js
  - React
  - TypeScript
  - auth
  - component system

Implikasi:
- Paho sangat layak dipertahankan sebagai frontend utama
- masalahnya bukan di UI, tapi di ownership data layer

## Audit per mode arsitektur

## Opsi A — Full live read/write langsung ke file/runtime sources

### Bentuk
Paho membaca dan menulis langsung ke:
- `/root/assistant/shared/...`
- `/root/.hermes/cron/jobs.json`
- `/root/.hermes/memories/...`
- `/root/.openclaw/...`
- mungkin CLI Hermes/OpenClaw untuk action runtime

### Kelebihan
- source of truth tunggal tetap terjaga
- tidak ada sinkronisasi ganda
- perubahan langsung terasa di sistem nyata

### Kekurangan
- implementasi write path jadi rumit
- format file beda-beda: YAML, JSON, MD, JSONL
- aksi runtime seperti cron/service/approval tidak aman jika ditulis mentah ke file saja
- raw file write berisiko merusak state jika validasi lemah
- sulit menjaga transactional consistency

### Penilaian
- cocok untuk read-heavy views
- kurang ideal untuk write-heavy semua domain

## Opsi B — Full mirroring ke database Paho

### Bentuk
Paho punya DB sendiri sebagai source of truth, lalu sinkron ke file/runtime Hermes/OpenClaw

### Kelebihan
- UI dan query jadi mudah
- data relational, gampang untuk filtering/search/dashboard
- UX paling enak untuk aplikasi modern

### Kekurangan
- bertentangan dengan prinsip source of truth tunggal yang sudah kita tetapkan
- rawan drift antara DB Paho dan file/runtime nyata
- perlu sync engine dua arah yang cukup kompleks
- kalau sync gagal, user tidak tahu state mana yang benar

### Penilaian
- ini yang sedang terjadi secara default sekarang
- saya tidak sarankan dijadikan model final utama

## Opsi C — Hybrid (rekomendasi)

### Bentuk
Paho tetap jadi UI utama, tetapi data dibagi seperti ini:

#### Live read langsung dari source nyata
Untuk:
- blueprint docs `/root/assistant`
- policy YAML
- decision notes
- SOP/checklist
- archive/reference docs
- sebagian runtime status Hermes/OpenClaw
- cron list runtime dari Hermes
- session/status/log summary yang aman

#### Controlled write via adapter/service layer
Untuk:
- edit policy docs
- create/update decision notes
- create/update templates
- create/update tasks dan reminders yang memang kita putuskan source-nya file-first
- create/update cron via Hermes CLI wrapper, bukan edit raw file manual

#### Selective mirroring ke DB Paho
Hanya untuk:
- cache index/search
- derived metrics
- UI-only denormalized views
- event history / analytics non-authoritative

### Kelebihan
- tetap menjaga source of truth utama
- tetap dapat UX modern dari Paho
- DB hanya jadi cache/view layer, bukan otoritas utama
- lebih aman dan lebih sesuai dengan blueprint owner-first

### Kekurangan
- perlu refactor lebih serius daripada sekadar patch kecil
- perlu membuat adapter abstraction yang rapi

### Penilaian
- ini pilihan terbaik

## Area Paho yang bisa langsung diubah ke live read/write

### Mudah / cepat
1. Policy pages
- baca langsung file YAML/MD dari `/root/assistant`
- edit melalui safe file service

2. Decision notes / SOP / pilot checklist
- baca langsung file markdown
- edit lewat adapter file

3. Logs viewer
- baca langsung JSONL / markdown logs di `/root/assistant/shared/memory/execution_logs`

4. OpenClaw approvals-like views
- pola `api/openclaw/route.ts` bisa dijadikan contoh

## Area yang perlu adapter khusus
1. Cron jobs
- read: bisa dari `/root/.hermes/cron/jobs.json`
- write: lebih aman via Hermes CLI/service wrapper daripada edit raw file

2. Tasks / reminders
Perlu keputusan arsitektur:
- apakah source of truth mau tetap file-based di `/root/assistant`
- atau memang dipindah ke DB Paho sebagai structured layer resmi

Saat ini menurut blueprint aktif:
- task dashboard utama milik Hermes/assistant system
- jadi jika Paho dipakai, saya sarankan tasks/reminders tidak jadi tabel paralel authoritative tanpa adapter

3. Hermes/OpenClaw runtime status
- perlu read-only adapters yang aman
- jangan write langsung ke config/runtime tanpa guardrail dan SSH review path

## Refactor yang dibutuhkan agar Paho cocok jadi UI utama

## Tahap 1 — Jadikan Paho file-first aware
Buat service layer seperti:
- `src/lib/live-sources/assistant-files.ts`
- `src/lib/live-sources/hermes-cron.ts`
- `src/lib/live-sources/hermes-memory.ts`
- `src/lib/live-sources/openclaw-files.ts`

Tujuan:
- semua page membaca lewat adapter, bukan query DB langsung

## Tahap 2 — Bedakan authoritative vs mirrored data
Tambahkan konsep eksplisit per dataset:
- authoritative_source: file | runtime | db_cache

Contoh:
- policy docs -> file
- decisions -> file
- cron list -> runtime/file
- metrics -> db_cache / derived

## Tahap 3 — Ganti API route satu per satu
Contoh target:
- `/api/policies` -> file-backed
- `/api/pilot` -> file-backed markdown/checklist-backed atau hybrid
- `/api/logs` -> file-backed JSONL/MD summary
- `/api/jobs` -> hybrid, tapi source of truth tetap adapter
- `/api/tasks` dan `/api/reminders` -> perlu keputusan final sebelum migrasi

## Tahap 4 — Pertahankan DB hanya untuk cache/index/analytics
DB Paho tetap berguna untuk:
- auth
- indexing
- fast search
- derived dashboards
- temporary mirror/cache

Tapi jangan lagi menjadi truth utama untuk data blueprint yang sudah file-first.

## Rekomendasi final

### Rekomendasi saya
Gunakan Paho sebagai:
- UI utama
- frontend utama
- authenticated control surface utama

Tetapi ubah model datanya menjadi:
- file-first + runtime adapters + selective mirroring

### Jangan lakukan
- jangan pertahankan Paho DB sebagai truth utama untuk tasks/reminders/policies bila itu menciptakan state paralel dengan Hermes/OpenClaw
- jangan write langsung ke raw config/runtime files tanpa adapter dan guardrail

## Verdict akhir

Apakah Paho bisa diubah menjadi live reading/writing atau mirroring?
- Bisa

Apakah bisa menjadi live reading/writing penuh langsung ke semua sumber?
- Bisa secara teknis, tapi tidak ideal untuk semua area

Apakah mirroring penuh ke DB lebih baik?
- Tidak, terlalu rawan drift dan melawan source of truth tunggal

Arsitektur terbaik:
- Paho sebagai UI utama
- live read dari source nyata
- controlled write via adapters/wrappers
- selective mirroring ke DB hanya untuk cache/search/analytics

## Nilai akhir
- Paho sebagai UI utama: 95%
- Paho dalam bentuk sekarang untuk source of truth aktif: 65%
- Paho setelah refactor hybrid file-first: 90%+

## Next step yang paling tepat
1. Buat migration plan teknis Paho -> hybrid live UI
2. Petakan dataset satu per satu: mana file-backed, mana runtime-backed, mana db-cache
3. Implement read-only live adapters dulu sebelum write path
