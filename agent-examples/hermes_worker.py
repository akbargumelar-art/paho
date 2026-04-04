#!/usr/bin/env python3
import sqlite3
import time
from datetime import datetime
import json

# Pastikan path ini menunjuk ke /root/paho/data/aspri.db di VPS Anda
DB_PATH = "/root/paho/data/aspri.db"

def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_pending_jobs():
    """Mengambil semua job dengan status 'queued' untuk HERMES"""
    conn = connect_db()
    cursor = conn.cursor()
    # Ambil antrean job yang ditujukan untuk HERMES
    cursor.execute("""
        SELECT * FROM handoff_jobs 
        WHERE worker = 'HERMES' AND status = 'queued'
    """)
    jobs = cursor.fetchall()
    conn.close()
    return jobs

def log_execution(job_id, message, level="INFO", metadata={}):
    """Menambahkan baris log ke execution_logs agar tampil di Dashboard Gateway"""
    conn = connect_db()
    cursor = conn.cursor()
    log_id = f"log-{int(time.time()*1000)}"
    timestamp = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO execution_logs 
        (id, job_id, message, level, source, owner, domain, status, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (log_id, job_id, message, level, "Hermes", "Hermes", "personal", "success", json.dumps(metadata), timestamp))
    conn.commit()
    conn.close()

def update_job_status(job_id, status, return_output=""):
    """Mengupdate status job di gateway"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE handoff_jobs 
        SET status = ?, return_output = ? 
        WHERE id = ?
    """, (status, return_output, job_id))
    conn.commit()
    conn.close()
    print(f"✅ Job {job_id} diupdate ke status: {status}")

def process_job(job):
    print(f"▶️ Memulai eksekusi Job: {job['id']}")
    
    # Beri tahu Web bahwa Hermes mulai bekerja
    update_job_status(job['id'], "running")
    log_execution(job['id'], "Hermes Agent mulai memproses job internal.", "INFO")
    
    try:
        instruction = job['context_instruction']
        print(f"Instruksi: {instruction}")
        
        # ---
        # TULIS KODE LOGIKA/AI HERMES ANDA DI SINI
        time.sleep(2) # Simulasi processing AI
        hasil_ai = f"Pesan Dibalas Otomatis: Saya telah mengeksekusi instruksi '{instruction}' dengan sukses!"
        # ---

        # Beri tahu Web bahwa Hermes selesai
        update_job_status(job['id'], "done", hasil_ai)
        log_execution(job['id'], f"Job selesai dieksekusi oleh Hermes. Status akhir: Sukses", "INFO")
        
    except Exception as e:
        # Jika gagal, kembalikan status error
        update_job_status(job['id'], "queued", f"Error: {str(e)}")
        log_execution(job['id'], f"Terjadi kesalahan fatal: {str(e)}", "ERROR")

if __name__ == "__main__":
    print("🤖 Hermes Agent Worker Starting (Polling Mode)...")
    while True:
        jobs = fetch_pending_jobs()
        if jobs:
            print(f"📥 Ditemukan {len(jobs)} job antrean. Memproses...")
            for job in jobs:
                process_job(dict(job))
        else:
            print("💤 Tidak ada job. Menunggu 10 detik...", end="\r")
        
        # Cek database setiap 10 detik
        time.sleep(10)
