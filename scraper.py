import json
from datetime import datetime
import os
import re
import urllib.request
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import time

# ==========================================
# KONFIGURASI RAPIDAPI
# ==========================================
RAPIDAPI_KEY = "52ef60fa19msh5a0d6a071ecf14cp173a73jsnd3fa3138b311"

def fetch_rapidapi(host, endpoint, market_name):
    print(f"\n📡 [API] Mencoba mengambil data untuk {market_name} ...")
    try:
        req = urllib.request.Request(f"https://{host}{endpoint}", method="GET")
        req.add_header("X-RapidAPI-Key", RAPIDAPI_KEY)
        req.add_header("X-RapidAPI-Host", host)
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"   ✅ Berhasil via API untuk {market_name}")
            return data
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"   ⚠️ Limit API Habis (429 Too Many Requests) untuk {market_name}. Beralih ke Scraping...")
        elif e.code == 403:
            print(f"   ⚠️ API Diblokir (403 Forbidden) untuk {market_name}. Beralih ke Scraping...")
        else:
            print(f"   ⚠️ Error API {e.code} untuk {market_name}. Beralih ke Scraping...")
        return None
    except Exception as e:
        print(f"   ⚠️ Error koneksi API untuk {market_name}: {e}. Beralih ke Scraping...")
        return None

def fetch_html(url, market_name):
    print(f"\n📡 [SCRAPING] Mencoba mengambil HTML untuk {market_name} ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(3) # Tunggu render JS
            html_text = page.content()
            browser.close()
            
            if "cloudflare" in html_text.lower() or "access denied" in html_text.lower():
                print(f"   ⛔ Terdeteksi Cloudflare Block untuk {market_name}")
                return None
            return html_text
    except Exception as e:
        print(f"   ⚠️ Error scraping untuk {market_name}: {e}")
        return None

# --- PARSER API ---
def parse_api_data(data, market_name):
    results = []
    if not data: return results
    
    # Coba berbagai struktur JSON umum
    draws = data if isinstance(data, list) else data.get('draws', data.get('results', data.get('data', [])))
    if isinstance(draws, dict): draws = draws.get('draws', [])
    
    for draw in draws:
        date_str = str(draw.get('draw_date', draw.get('date', draw.get('drawDate', ''))))
        numbers = str(draw.get('winning_numbers', draw.get('numbers', draw.get('winningNumbers', ''))))
        
        if date_str and numbers:
            try:
                # Bersihkan dan format tanggal
                clean_date = re.sub(r'T.*', '', date_str)
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        dt = datetime.strptime(clean_date, fmt)
                        formatted_date = dt.strftime("%d-%m-%Y")
                        break
                    except: continue
                else:
                    formatted_date = clean_date
                
                clean_number = re.sub(r'\D', '', numbers)
                if len(clean_number) >= 4:
                    nomor = clean_number[-4:] if len(clean_number) > 4 else clean_number
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                        results.append({"tanggal": formatted_date, "nomor": nomor})
            except: continue
    return results

# --- PARSER HTML (FALLBACK) ---
def parse_ny_html(html_text):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    # Cari pola MM/DD/YYYY
    for match in re.finditer(r'(\d{2})/(\d{2})/(\d{4})', text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        # Cari 4 angka terpisah atau menyatu
        digits = re.findall(r'\b\d\b', snippet)
        nomor = "".join(digits[:4]) if len(digits) >= 4 else ""
        if not nomor:
            four_digits = re.findall(r'\b(\d{4})\b', snippet)
            if four_digits: nomor = four_digits[0]
            
        if len(nomor) == 4 and not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
            results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

def parse_ca_html(html_text):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    for match in re.finditer(r'(\d{1,2})/(\d{1,2})/(\d{4})', text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+400]
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        for nomor in digits:
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
                break
    return results

def parse_north_carolina(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    for match in re.finditer(r'(\d{1,2})/(\d{1,2})/(\d{4})', text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+500]
        
        is_evening = "evening" in snippet.lower() or "night" in snippet.lower() or "pm" in snippet.lower()
        is_midday = "midday" in snippet.lower() or "day" in snippet.lower() or "am" in snippet.lower()
        
        if session_type == "evening" and not is_evening: continue
        if session_type == "midday" and not is_midday: continue
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        for nomor in digits:
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
                break
    return results

def parse_oregon(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    for match in re.finditer(r'(\d{1,2})/(\d{1,2})/(\d{4})', text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        if time_label.lower() in snippet.lower():
            digits = re.findall(r'\b\d\b', snippet)
            nomor = "".join(digits[:4]) if len(digits) >= 4 else (re.findall(r'\b(\d{4})\b', snippet)[0] if re.findall(r'\b(\d{4})\b', snippet) else "")
            if len(nomor) == 4 and not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

def parse_kentucky(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    for match in re.finditer(r'(\d{1,2})/(\d{1,2})/(\d{4})', text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        is_evening = "evening" in snippet.lower()
        is_midday = "midday" in snippet.lower()
        if session_type == "evening" and not is_evening: continue
        if session_type == "midday" and not is_midday: continue
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        if digits:
            nomor = digits[0]
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

def parse_macau(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    time_mapping = {"00": 1, "13": 2, "16": 3, "19": 4, "22": 5, "23": 6}
    col_index = time_mapping.get(time_label)
    
    for row in soup.find_all('tr'):
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2 or not col_index or col_index >= len(cells): continue
        
        date_cell = cells[0].get_text(strip=True)
        date_match = re.search(r'(\d{1,2})\s+([A-Za-z]{3})', date_cell) or re.search(r'([A-Za-z]{3})\s+(\d{1,2})', date_cell)
        if date_match:
            day, month_str = (date_match.groups() if date_match.group(1).isdigit() else (date_match.group(2), date_match.group(1)))
            try:
                formatted_date = datetime.strptime(f"{month_str} {day} 2026", "%b %d %Y").strftime("%d-%m-%Y")
            except: continue
            
            nomor = cells[col_index].get_text(strip=True)
            if len(nomor) == 4 and nomor.isdigit():
                if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                    results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"⚠️ FAILED: Tidak ada data baru untuk {market_name} (Website mungkin belum update atau parser perlu penyesuaian)")
        return
    
    os.makedirs('data_market', exist_ok=True)
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except: pass
    
    # Bersihkan data lama dari spasi
    existing_data = [{"tanggal": item.get('tanggal', item.get('tanggal ', '')).strip(), 
                      "nomor": item.get('nomor', item.get('nomor ', '')).strip()} 
                     for item in existing_data if item.get('tanggal') or item.get('tanggal ')]
    
    existing_records = {(item['tanggal'], item['nomor']) for item in existing_data}
    added_count = 0
    
    for item in new_data:
        tanggal = item.get('tanggal', '').strip()
        nomor = item.get('nomor', '').strip()
        if (tanggal, nomor) not in existing_records and tanggal and nomor:
            existing_data.append({"tanggal": tanggal, "nomor": nomor})
            existing_records.add((tanggal, nomor))
            added_count += 1
    
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"), reverse=True)
    except: pass
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ {market_name}: {added_count} data baru | Total: {len(existing_data)}")

def main():
    print("🚀 Memulai Scraper Hybrid (API + Fallback Scraping)...")
    
    # 1. NEW YORK (Coba API, jika gagal fallback ke Scraping)
    ny_api_data = fetch_rapidapi("new-york-lottery.p.rapidapi.com", "/get_draw_results", "new-york")
    if ny_api_data:
        ny_results = parse_api_data(ny_api_data, "new-york")
        # Asumsi API mengembalikan semua, kita simpan ke satu file atau pisah jika strukturnya memungkinkan
        # Untuk amannya, kita simpan ke midday dan evening (data yang sama jika API tidak memisahkan)
        save_with_smart_append("new-york-midday", ny_results)
        save_with_smart_append("new-york-evening", ny_results)
    else:
        print("   🔄 Menggunakan Fallback Scraping untuk New York...")
        ny_html = fetch_html("https://nylottery.ny.gov/all-winning-numbers?nid=46", "new-york")
        if ny_html:
            ny_results = parse_ny_html(ny_html)
            save_with_smart_append("new-york-midday", ny_results)
            save_with_smart_append("new-york-evening", ny_results)

    # 2. CALIFORNIA (Coba API, jika gagal fallback ke Scraping)
    ca_api_data = fetch_rapidapi("ca-lottery.p.rapidapi.com", "/DrawGamePastDrawResults/14/1/20", "california")
    if ca_api_data:
        ca_results = parse_api_data(ca_api_data, "california")
        save_with_smart_append("california-daily-4", ca_results)
    else:
        print("   🔄 Menggunakan Fallback Scraping untuk California...")
        ca_html = fetch_html("https://www.calottery.com/en/draw-games/daily-4", "california")
        if ca_html:
            ca_results = parse_ca_html(ca_html)
            save_with_smart_append("california-daily-4", ca_results)

    # 3. MARKET LAINNYA (Langsung Scraping karena sudah stabil)
    TARGETS = [
        ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "1:00 PM"),
        ("oregon-6", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "4:00 PM"),
        ("oregon-9", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "7:00 PM"),
        ("oregon-12", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "10:00 PM"),
        ("north-carolina-day", "https://nclottery.com/pick4-past", parse_north_carolina, "midday"),
        ("north-carolina-evening", "https://nclottery.com/pick4-past", parse_north_carolina, "evening"),
        ("kentucky-pick-4", "https://www.kylottery.com/en-us/games/draw-games/pick-4.html", parse_kentucky, "midday"),
        ("macau-00", "http://178.128.19.32/", parse_macau, "00"),
        ("macau-13", "http://178.128.19.32/", parse_macau, "13"),
        ("macau-16", "http://178.128.19.32/", parse_macau, "16"),
        ("macau-19", "http://178.128.19.32/", parse_macau, "19"),
        ("macau-22", "http://178.128.19.32/", parse_macau, "22"),
        ("macau-23", "http://178.128.19.32/", parse_macau, "23"),
    ]

    for market_name, url, parser_func, param in TARGETS:
        html = fetch_html(url, market_name)
        if html:
            data = parser_func(html, param)
            save_with_smart_append(market_name, data)
        else:
            print(f"⚠️ Gagal total mengambil HTML untuk {market_name}")

if __name__ == "__main__":
    main()
