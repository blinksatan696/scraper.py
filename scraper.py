import json
from datetime import datetime, timedelta
import os
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import time

# Enable debug mode - akan save HTML untuk analisis
DEBUG_MODE = True

def save_debug_html(market_name, html):
    """Save HTML untuk debugging"""
    if DEBUG_MODE:
        os.makedirs('debug_html', exist_ok=True)
        with open(f'debug_html/{market_name}.html', 'w', encoding='utf-8') as f:
            f.write(html)
        print(f" HTML disimpan ke debug_html/{market_name}.html")

def parse_oregon_v2(html_text, time_label):
    """Parser Oregon dengan multiple strategies"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # Strategy 1: Cari pattern tanggal + angka
    text = soup.get_text(separator=' ', strip=True)
    
    # Pattern: MM/DD/YYYY diikuti angka
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    matches = list(re.finditer(date_pattern, text))
    
    for i, match in enumerate(matches):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        
        # Ambil 300 karakter setelah tanggal
        snippet = text[match.end():match.end()+300]
        
        # Cek apakah ada time_label (1:00 PM, 4:00 PM, dll)
        if time_label.lower() in snippet.lower() or (i+1 < len(matches) and time_label.lower() in text[match.end():matches[i+1].start()].lower()):
            # Cari 4 angka (bisa terpisah atau menyatu)
            digits_separated = re.findall(r'\b(\d)\s+(\d)\s+(\d)\s+(\d)\b', snippet)
            digits_combined = re.findall(r'\b(\d{4})\b', snippet)
            
            if digits_separated:
                nomor = "".join(digits_separated[0])
            elif digits_combined:
                nomor = digits_combined[0]
            else:
                continue
            
            if nomor and len(nomor) == 4:
                if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                    results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def parse_new_york_v2(html_text, draw_type):
    """Parser New York - handle Cloudflare"""
    # Cek apakah terkena Cloudflare block
    if "cloudflare" in html_text.lower() or "checking your browser" in html_text.lower():
        print(f"⛔ NEW YORK BLOCKED - Cloudflare terdeteksi")
        return []
    
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    # Pattern: MM/DD/YYYY
    date_pattern = r'(\d{2})/(\d{2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        if draw_type.lower() in snippet.lower():
            # Cari angka dalam lingkaran (biasanya terpisah)
            digits = re.findall(r'\b(\d)\s+(\d)\s+(\d)\s+(\d)\b', snippet)
            if digits:
                nomor = "".join(digits[0])
                if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                    results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def parse_north_carolina_v2(html_text, session_type):
    """Parser North Carolina dengan flexible detection"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        is_evening = "evening" in snippet.lower() or "night" in snippet.lower()
        is_midday = "midday" in snippet.lower() or "day" in snippet.lower()
        
        if session_type == "evening" and not is_evening:
            continue
        if session_type == "midday" and not is_midday:
            continue
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        if digits:
            nomor = digits[0]
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def parse_california_v2(html_text, _):
    """Parser California"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        if digits:
            nomor = digits[0]
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def parse_kentucky_v2(html_text, session_type):
    """Parser Kentucky"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+300]
        
        is_evening = "evening" in snippet.lower()
        is_midday = "midday" in snippet.lower()
        
        if session_type == "evening" and not is_evening:
            continue
        if session_type == "midday" and not is_midday:
            continue
        
        digits = re.findall(r'\b(\d{4})\b', snippet)
        if digits:
            nomor = digits[0]
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def parse_macau_v2(html_text, time_label):
    """Parser Macau - sudah berfungsi baik"""
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all('tr')
    
    time_mapping = {"00": 1, "13": 2, "16": 3, "19": 4, "22": 5, "23": 6}
    col_index = time_mapping.get(time_label)
    
    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2 or not col_index or col_index >= len(cells):
            continue
        
        date_cell = cells[0].get_text(strip=True)
        date_match = re.search(r'(\d{1,2})\s+([A-Za-z]{3})', date_cell) or re.search(r'([A-Za-z]{3})\s+(\d{1,2})', date_cell)
        
        if date_match:
            if date_match.group(1).isdigit():
                day, month_str = date_match.groups()
            else:
                month_str, day = date_match.groups()
            
            try:
                dt_obj = datetime.strptime(f"{month_str} {day} 2026", "%b %d %Y")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
            except:
                continue
            
            nomor = cells[col_index].get_text(strip=True)
            if len(nomor) == 4 and nomor.isdigit():
                if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                    results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

def fetch_and_parse(url, parser_function, param, market_name):
    print(f"\n📡 Menarik data dari {url} (Param: {param}) ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            # Tunggu lebih lama untuk JavaScript
            page.goto(url, wait_until="networkidle", timeout=60000)
            time.sleep(3)  # Tunggu tambahan untuk lazy loading
            
            html_text = page.content()
            browser.close()
            
            # Save HTML untuk debugging
            save_debug_html(market_name, html_text)
            
            # Cek blocking
            if "cloudflare" in html_text.lower() or "access denied" in html_text.lower():
                print(f"⛔ TERDETEKSI PEMBLOKIRAN untuk {market_name}")
                return []
            
            return parser_function(html_text, param)
    except Exception as e:
        print(f" Error koneksi: {e}")
        return []

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"⚠️ FAILED: Tidak ada data untuk {market_name}")
        return
    
    os.makedirs('data_market', exist_ok=True)
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except:
            pass
    
    # Clean existing data (remove trailing spaces)
    existing_data = [{
        "tanggal": item.get('tanggal', item.get('tanggal ', '')).strip(),
        "nomor": item.get('nomor', item.get('nomor ', '')).strip()
    } for item in existing_data if item.get('tanggal') or item.get('tanggal ')]
    
    existing_records = {(item['tanggal'], item['nomor']) for item in existing_data}
    
    added_count = 0
    for item in new_data:
        tanggal = item.get('tanggal', '').strip()
        nomor = item.get('nomor', '').strip()
        if (tanggal, nomor) not in existing_records and tanggal and nomor:
            existing_data.append({"tanggal": tanggal, "nomor": nomor})
            existing_records.add((tanggal, nomor))
            added_count += 1
    
    # Sort terbaru di atas
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"), reverse=True)
    except:
        pass
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ {market_name}: {added_count} data baru | Total: {len(existing_data)}")

def main():
    TARGETS = [
        ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon_v2, "1:00 PM"),
        ("oregon-6", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon_v2, "4:00 PM"),
        ("oregon-9", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon_v2, "7:00 PM"),
        ("oregon-12", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon_v2, "10:00 PM"),
        ("new-york-midday", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york_v2, "Midday"),
        ("new-york-evening", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york_v2, "Evening"),
        ("north-carolina-day", "https://nclottery.com/pick4-past", parse_north_carolina_v2, "midday"),
        ("north-carolina-evening", "https://nclottery.com/pick4-past", parse_north_carolina_v2, "evening"),
        ("california-daily-4", "https://www.calottery.com/en/draw-games/daily-4", parse_california_v2, ""),
        ("kentucky-pick-4", "https://www.kylottery.com/en-us/games/draw-games/pick-4.html", parse_kentucky_v2, "midday"),
        ("macau-00", "http://178.128.19.32/", parse_macau_v2, "00"),
        ("macau-13", "http://178.128.19.32/", parse_macau_v2, "13"),
        ("macau-16", "http://178.128.19.32/", parse_macau_v2, "16"),
        ("macau-19", "http://178.128.19.32/", parse_macau_v2, "19"),
        ("macau-22", "http://178.128.19.32/", parse_macau_v2, "22"),
        ("macau-23", "http://178.128.19.32/", parse_macau_v2, "23"),
    ]

    for market_name, url, parser_func, param in TARGETS:
        data = fetch_and_parse(url, parser_func, param, market_name)
        save_with_smart_append(market_name, data)

if __name__ == "__main__":
    main()
