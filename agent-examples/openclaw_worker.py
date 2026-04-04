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
    """Mengambil semua job dengan status 'queued' untuk OPENCLAW"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM handoff_jobs 
        WHERE worker = 'OPENCLAW' AND status = 'queued'
    """)
    jobs = cursor.fetchall()
    conn.close()
    return jobs

def log_execution(job_id, message, level="INFO", metadata={}):
    """Menambahkan baris log ke execution_logs agar tampil di Dashboard Gateway"""
    conn = connect_db()
    cursor = conn.cursor()
    log_id = f"log-oc-{int(time.time()*1000)}"
    timestamp = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO execution_logs 
        (id, job_id, message, level, source, owner, domain, status, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (log_id, job_id, message, level, "OpenClaw", "OpenClaw", "work", "success", json.dumps(metadata), timestamp))
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
    print(f"▶️ Memulai eksekusi OpenClaw Task: {job['id']}")
    
    # Beri tahu Web bahwa OpenClaw mulai bekerja
    update_job_status(job['id'], "running")
    log_execution(job['id'], "OpenClaw Worker telah mengunci job dan memulai perayapan (crawling).", "INFO")
    
    try:
        instruction = job['context_instruction']
        data_source = job['context_data_source']
        print(f"Scraping instruksi: {instruction} dari sumber: {data_source}")
        
        # ---
        # TULIS KODE CRAWLER/SCRAPER OPENCLAW ANDA DI SINI
        time.sleep(3) # Simulasi processing Scraper Scrapfly/Puppeteer
        hasil_scrape = f"Laporan Web Ekstraksi V1: Selesai mengambil data dari {data_source} sesuai perintah!"
        # ---

        # Beri tahu Web bahwa OpenClaw selesai
        update_job_status(job['id'], "done", hasil_scrape)
        log_execution(job['id'], f"Ekstraksi data selesai dan Payload disimpan.", "INFO")
        
    except Exception as e:
        update_job_status(job['id'], "failed", f"Error: {str(e)}")
        log_execution(job['id'], f"Eksekusi OpenClaw gagal: {str(e)}", "ERROR")

if __name__ == "__main__":
    print("🕷️ OpenClaw Background Worker Starting...")
    while True:
        jobs = fetch_pending_jobs()
        if jobs:
            print(f"📥 Ditemukan {len(jobs)} tugas scraping. Memproses...")
            for job in jobs:
                process_job(dict(job))
        else:
            print("💤 Menunggu tugas baru (10 detik)...", end="\r")
        
        time.sleep(10)
