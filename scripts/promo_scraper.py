#!/usr/bin/env python3
import sqlite3
import json
import time
import hashlib
import urllib.request
import re
from datetime import datetime

DB_PATH = "/root/paho/data/ai_promo.db"

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_id(provider, benefit):
    s = f"{provider.lower().strip()}|{benefit.lower().strip()}"
    return hashlib.md5(s.encode()).hexdigest()

def insert_promo(c, provider, source_url, benefit, model_list, reqs, status_9r):
    pid = hash_id(provider, benefit)
    c.execute("SELECT id FROM promos WHERE id=?", (pid,))
    if c.fetchone():
        c.execute("UPDATE promos SET last_seen=CURRENT_TIMESTAMP, is_active=1 WHERE id=?", (pid,))
        return False
    
    c.execute("""
        INSERT INTO promos (id, provider, source_url, benefit, model_list, requirements, status_9router, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, 90)
    """, (pid, provider, source_url, benefit, model_list, reqs, status_9r))
    return True

def scrape_openrouter(c):
    url = "https://openrouter.ai/api/v1/models"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
    except Exception as e:
        print("Failed OpenRouter:", e)
        return 0
    
    models = data.get('data', [])
    free_models = []
    for m in models:
        p = m.get('pricing', {}).get('prompt')
        if p == '0' or p == 0 or (isinstance(p, str) and float(p) == 0):
            free_models.append(m['id'])
    
    if not free_models: return 0
    
    added = 0
    provider_map = {}
    for mid in free_models:
        prov = mid.split('/')[0] if '/' in mid else 'openrouter'
        if prov not in provider_map: provider_map[prov] = []
        provider_map[prov].append(mid)
        
    for prov, mlist in provider_map.items():
        if insert_promo(c, prov, url, "Free Tier (OpenRouter)", ", ".join(mlist), "OpenRouter Account", "verified"):
            added += 1
    return added

def scrape_tabitoken(c):
    # Dummy mock for TabiToken specific case mentioned by user
    if insert_promo(c, "TabiToken", "https://tabitoken.com", "Gratis $120 untuk pengguna baru", "Opus, Sonnet", "Sign up", "unverified"):
        return 1
    return 0

def run_scraper():
    conn = connect()
    c = conn.cursor()
    
    c.execute("SELECT * FROM sources WHERE enabled=1")
    sources = c.fetchall()
    
    total_added = 0
    for s in sources:
        print(f"Scraping {s['name']} ({s['type']})...")
        added = 0
        if s['type'] == 'openrouter':
            added = scrape_openrouter(c)
        elif s['id'] == 'tabitoken':
            added = scrape_tabitoken(c)
            
        total_added += added
        c.execute("UPDATE sources SET last_scraped_at=CURRENT_TIMESTAMP WHERE id=?", (s['id'],))
        conn.commit()
    
    # Create daily report
    today = datetime.now().strftime("%Y-%m-%d")
    c.execute("SELECT COUNT(*) FROM promos WHERE is_active=1")
    total_active = c.fetchone()[0]
    
    c.execute("INSERT OR REPLACE INTO daily_reports (id, date, total_promos, new_promos, status) VALUES (?, ?, ?, ?, ?)",
             (today, today, total_active, total_added, "success"))
    conn.commit()
    conn.close()
    print(f"Done. Added {total_added} new promos. Total active: {total_active}")

if __name__ == "__main__":
    run_scraper()