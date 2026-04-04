#!/bin/bash
# Skrip deploy otomatis untuk VPS

echo "🚀 Memulai proses deployment ASPRI Gateway..."

# Pastikan berada di direktori project
# cd /var/www/aspri (contoh)

echo "📥 Menarik kode terbaru dari repository..."
git pull origin main

echo "📦 Menginstall dependencies (Node.js)..."
npm install

echo "🔄 Menjalankan migrasi database..."
npm run db:migrate

# Note: Jika ini deploy pertama kali di VPS dan butuh seed data awal, gunakan ini:
# npm run db:setup

echo "🏗️ Membangun proyek (Next.js build)..."
npm run build

echo "🔄 Me-restart service PM2..."
# Asumsinya Anda menggunakan PM2 dengan nama aplikasi "aspri-gateway"
pm2 restart aspri-gateway || pm2 start npm --name "aspri-gateway" -- start

echo "✅ Deployment selesai!"
