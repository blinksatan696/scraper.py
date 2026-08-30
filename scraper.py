import json
import os
import re
from datetime import datetime
from bs4 import BeautifulSoup
from curl_cffi import requests
from playwright.sync_api import sync_playwright

# ==========================================
# KONFIGURASI TARGET
# ==========================================
TARGETS = [
    ("new-york-midday", "https://kingdomtotox73.com/pasaran/liinkkua.html", "kingdom"),
    ("new-york-evening", "https://kingdomtotox73.com/pasaran/wzyn4asu.html", "kingdom"),
    ("california-daily-4", "https://kingdomtotox73.com/pasaran/sr6dyibs.html", "kingdom"),
    ("north-carolina-day", "https://kingdomtotox73.com/pasaran/vxpgtjuj.html", "kingdom"),
    ("north-carolina-evening", "https://kingdomtotox73.com/pasaran/xty6pp5c.html", "kingdom"),
    ("oregon-3", "https://kingdomtotox73.com/pasaran/fbyqi1ei.html", "kingdom"),
    ("oregon-6", "https://kingdomtotox73.com/pasaran/nkkwks2m.html", "kingdom"),
    ("oregon-9", "https://kingdomtotox73.com/pasaran/vvjpntz9.html", "kingdom"),
    ("oregon-12", "https://kingdomtotox73.com/pasaran/leus8kqq.html", "kingdom"),
    ("kentucky-midday", "https://kingdomtotox73.com/pasaran/q9t5wwhf.html", "kingdom"),
    ("kentucky-evening", "https://kingdomtotox73.com/pasaran/555xyssd.html", "kingdom"),
    ("macau-00", "http://178.128.19.32/", "macau"),
    ("macau-13", "http://178.128.19.32/", "macau"),
    ("macau-16", "http://178.128.19.32/", "macau"),
    ("macau-19", "http://178.128.19.32/", "macau"),
    ("macau-22", "http://178.128.19.32/", "macau"),
    ("macau-23", "http://178.128.19.32/", "macau"),
]

def fetch_html_stealth(url):
    try:
        # impersonate="chrome124" memalsukan sidik jari browser untuk melewati Cloudflare
        response = requests.get(url, impersonate="chrome124", timeout=20)
        if response.status_code == 403 or "cloudflare" in response.text.lower() or "access denied" in response.text.lower():
            return None
        return response.text
    except Exception:
        return None

def parse_kingdom_toto(html_text):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li'])
    
    for row in rows:
        text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{2})-(\d{2})-(\d{4})', text) or re.search(r'(\d{4})-(\d{2})-(\d{2})', text)
        if not date_match:
            continue
            
        groups = date_match.groups()
        if len(groups[0]) == 4:
            y, m, d = groups
        else:
            d, m, y = groups
            
        formatted_date = f"{d}-{m}-{y}"
        numbers = re.findall(r'\b(\d{4})\b', text)
        
        for num in numbers:
            if num == y:
                continue
            if not any(r['tanggal'] == formatted_date and r['nomor'] == num for r in results):
                results.append({"tanggal": formatted_date, "nomor": num})
            break
    return results

def parse_macau(html_text, time_label):
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
    if parser_type == "kingdom":
        html = fetch_html_stealth(url)
        if not html:
            return []
        return parse_kingdom_toto(html)
    elif parser_type == "macau":
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                html_text = page.content()
                browser.close()
            return parse_macau(html_text, param)
        except Exception:
            return []
    return []

def save_with_smart_append(market_name, new_data):
    os.makedirs('data_market', exist_ok=True)
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception:
            pass

    # AUTO-CLEAN SAFETY NET: Membersihkan spasi di key dan value data lama
    cleaned_existing = []
    for item in existing_data:
        t = str(item.get("tanggal", item.get("tanggal ", ""))).strip()
        n = str(item.get("nomor", item.get("nomor ", ""))).strip()
        if t and n:
            cleaned_existing.append({"tanggal": t, "nomor": n})
    
    existing_records = {(item['tanggal'], item['nomor']) for item in cleaned_existing}
    added_count = 0
    
    # Tambah Data Baru
    if new_data:
        for item in new_data:
            tanggal = str(item.get('tanggal', '')).strip()
            nomor = str(item.get('nomor', '')).strip()
            if tanggal and nomor and (tanggal, nomor) not in existing_records:
                cleaned_existing.append({"tanggal": tanggal, "nomor": nomor})
                existing_records.add((tanggal, nomor))
                added_count += 1
    
    # Sortir: Tanggal terbaru di paling atas (Descending)
    try:
        cleaned_existing.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"), reverse=True)
    except Exception:
        pass
    
    # Simpan ke File
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(cleaned_existing, f, indent=2, ensure_ascii=False)
    
    if added_count > 0:
        print(f"   ✅ {market_name}: {added_count} data baru | Total: {len(cleaned_existing)}")
    else:
        print(f"   ℹ️ {market_name}: Tidak ada data baru (Total tetap: {len(cleaned_existing)})")

def main():
    print("🚀 Memulai Scraper (Auto-Clean + curl_cffi)...")
    for market_name, url, parser_type in TARGETS:
        param = market_name.split('-')[-1] if market_name.startswith('macau-') else None
        data = fetch_and_parse(url, parser_type, market_name, param)
        save_with_smart_append(market_name, data)
    print("🎉 Proses Selesai!")

if __name__ == "__main__":
    main()