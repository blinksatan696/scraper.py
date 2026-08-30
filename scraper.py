import json
import os
import re
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

# ==========================================
# KONFIGURASI TARGET
# ==========================================
# Format: (nama_file_json, url, tipe_parser)
TARGETS = [
    # New York
    ("new-york-midday", "https://kingdomtotox73.com/pasaran/liinkkua.html", "kingdom"),
    ("new-york-evening", "https://kingdomtotox73.com/pasaran/wzyn4asu.html", "kingdom"),
    
    # California
    ("california-daily-4", "https://kingdomtotox73.com/pasaran/sr6dyibs.html", "kingdom"),
    
    # North Carolina
    ("north-carolina-day", "https://kingdomtotox73.com/pasaran/vxpgtjuj.html", "kingdom"),
    ("north-carolina-evening", "https://kingdomtotox73.com/pasaran/xty6pp5c.html", "kingdom"),
    
    # Oregon (Dipetakan ke nama file yang sudah disepakati)
    ("oregon-3", "https://kingdomtotox73.com/pasaran/fbyqi1ei.html", "kingdom"),
    ("oregon-6", "https://kingdomtotox73.com/pasaran/nkkwks2m.html", "kingdom"),
    ("oregon-9", "https://kingdomtotox73.com/pasaran/vvjpntz9.html", "kingdom"),
    ("oregon-12", "https://kingdomtotox73.com/pasaran/leus8kqq.html", "kingdom"),
    
    # Kentucky (Dipisah Midday & Evening)
    ("kentucky-midday", "https://kingdomtotox73.com/pasaran/q9t5wwhf.html", "kingdom"),
    ("kentucky-evening", "https://kingdomtotox73.com/pasaran/555xyssd.html", "kingdom"),
    
    # Macau
    ("macau-00", "http://178.128.19.32/", "macau"),
    ("macau-13", "http://178.128.19.32/", "macau"),
    ("macau-16", "http://178.128.19.32/", "macau"),
    ("macau-19", "http://178.128.19.32/", "macau"),
    ("macau-22", "http://178.128.19.32/", "macau"),
    ("macau-23", "http://178.128.19.32/", "macau"),
]

def fetch_html_robust(url):
    """Mengambil HTML dengan menyamar total sebagai browser manusia"""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = context.new_page()
            
            # Tambahkan header agar terlihat seperti permintaan browser asli
            page.set_extra_http_headers({
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            })
            
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # TUNGGU 2-3 DETIK: Ini trik penting untuk melewati deteksi bot sederhana
            page.wait_for_timeout(2500) 
            
            html_text = page.content()
            browser.close()
            return html_text
    except Exception as e:
        print(f"   ⚠️ Error koneksi: {e}")
        return None

def parse_kingdom_toto(html_text):
    """Parser universal untuk situs kingdomtotox73.com"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # Cari semua elemen baris (biasanya <tr> atau <div> pembungkus data)
    rows = soup.find_all(['tr', 'div', 'li'])
    
    for row in rows:
        text = row.get_text(separator=' ', strip=True)
        
        # 1. Ekstrak Tanggal (Mendukung DD-MM-YYYY atau YYYY-MM-DD)
        date_match = re.search(r'(\d{2})-(\d{2})-(\d{4})', text) or re.search(r'(\d{4})-(\d{2})-(\d{2})', text)
        if not date_match:
            continue
            
        groups = date_match.groups()
        if len(groups[0]) == 4:  # Format YYYY-MM-DD
            y, m, d = groups
        else:                    # Format DD-MM-YYYY
            d, m, y = groups
            
        formatted_date = f"{d}-{m}-{y}"
        
        # 2. Ekstrak Nomor (4 digit)
        numbers = re.findall(r'\b(\d{4})\b', text)
        for num in numbers:
            # Pastikan angka 4 digit tersebut bukan bagian dari tahun (y)
            if num == y:
                continue
                
            # Cek duplikasi
            if not any(r['tanggal'] == formatted_date and r['nomor'] == num for r in results):
                results.append({"tanggal": formatted_date, "nomor": num})
            break  # Ambil satu nomor pertama yang valid per baris
            
    return results

def parse_macau(html_text, time_label):
    """Parser khusus Macau (sudah terbukti berhasil)"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    time_mapping = {"00": 1, "13": 2, "16": 3, "19": 4, "22": 5, "23": 6}
    col_index = time_mapping.get(time_label)
    
    for row in soup.find_all('tr'):
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2 or not col_index or col_index >= len(cells):
            continue
        
        date_cell = cells[0].get_text(strip=True)
        date_match = re.search(r'(\d{1,2})\s+([A-Za-z]{3})', date_cell) or re.search(r'([A-Za-z]{3})\s+(\d{1,2})', date_cell)
        
        if date_match:
            day, month_str = (date_match.groups() if date_match.group(1).isdigit() else (date_match.group(2), date_match.group(1)))
            try:
                formatted_date = datetime.strptime(f"{month_str} {day} 2026", "%b %d %Y").strftime("%d-%m-%Y")
            except:
                continue
            
            nomor = cells[col_index].get_text(strip=True)
            if len(nomor) == 4 and nomor.isdigit():
                if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                    results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

def fetch_and_parse(url, parser_type, market_name, param=None):
    print(f"📡 Memproses: {market_name} ...")
    html = fetch_html_robust(url)
    
    if not html:
        print(f"   ⚠️ Gagal total mengambil HTML untuk {market_name}")
        return []
        
    # Deteksi pemblokiran tingkat halaman
    if "403 Forbidden" in html or "access denied" in html.lower() or "cloudflare" in html.lower() or "checking your browser" in html.lower():
        print(f"   ⛔ Terdeteksi Pemblokiran (403/Cloudflare) untuk {market_name}")
        return []

    if parser_type == "kingdom":
        return parse_kingdom_toto(html)
    elif parser_type == "macau":
        return parse_macau(html, param)
    
    return []

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"   ⚠️ Tidak ada data baru untuk {market_name} (Data website mungkin belum update atau sama dengan database)")
        return
    
    os.makedirs('data_market', exist_ok=True)
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception:
            pass

    # 1. BERSIHKAN DATA LAMA DARI SPASI (Auto-Clean)
    cleaned_existing = []
    for item in existing_data:
        t = str(item.get("tanggal", item.get("tanggal ", ""))).strip()
        n = str(item.get("nomor", item.get("nomor ", ""))).strip()
        if t and n:
            cleaned_existing.append({"tanggal": t, "nomor": n})
    
    existing_records = {(item['tanggal'], item['nomor']) for item in cleaned_existing}
    added_count = 0
    
    # 2. TAMBAHKAN DATA BARU (yang sudah bersih)
    for item in new_data:
        tanggal = str(item.get('tanggal', '')).strip()
        nomor = str(item.get('nomor', '')).strip()
        
        if tanggal and nomor and (tanggal, nomor) not in existing_records:
            cleaned_existing.append({"tanggal": tanggal, "nomor": nomor})
            existing_records.add((tanggal, nomor))
            added_count += 1
    
    # 3. SORTIR: Tanggal terbaru di paling atas (Descending)
    try:
        cleaned_existing.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"), reverse=True)
    except Exception:
        pass
    
    # 4. SIMPAN KE FILE
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned_existing, f, indent=2, ensure_ascii=False)
    
    print(f"   ✅ {market_name}: {added_count} data baru | Total: {len(cleaned_existing)}")

def main():
    print("🚀 Memulai Scraper Universal (Full Browser Mimicry)...")
    for market_name, url, parser_type in TARGETS:
        param = market_name.split('-')[-1] if market_name.startswith('macau-') else None
        data = fetch_and_parse(url, parser_type, market_name, param)
        save_with_smart_append(market_name, data)
    print("🎉 Proses Selesai!")

if __name__ == "__main__":
    main()
