import json
from datetime import datetime
import os
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

# --- 1. FUNGSI PEMBEDAH OREGON ---
def parse_oregon(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    # Cari pola tanggal MM/DD/YYYY
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        
        # Ambil 200 karakter setelah tanggal untuk mencari waktu dan angka
        snippet = text[match.end():match.end()+200]
        
        if time_label.lower() in snippet.lower():
            # Cari 4 angka terpisah (misal: "7 2 9 2") atau 1 angka 4 digit (misal: "7292")
            digits = re.findall(r'\b\d\b', snippet)
            if len(digits) >= 4:
                nomor = "".join(digits[:4])
            else:
                four_digits = re.findall(r'\b(\d{4})\b', snippet)
                if four_digits:
                    nomor = four_digits[0]
                else:
                    continue
            
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- 2. FUNGSI PEMBEDAH NEW YORK ---
def parse_new_york(html_text, draw_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{2})/(\d{2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+200]
        
        if draw_type.lower() in snippet.lower():
            digits = re.findall(r'\b\d\b', snippet)
            if len(digits) >= 4:
                nomor = "".join(digits[:4])
            else:
                four_digits = re.findall(r'\b(\d{4})\b', snippet)
                if four_digits:
                    nomor = four_digits[0]
                else:
                    continue
            
            if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA ---
def parse_north_carolina(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+200]
        
        is_evening = "evening" in snippet.lower() or "night" in snippet.lower()
        is_midday = "midday" in snippet.lower() or "day" in snippet.lower()
        
        if session_type == "evening" and not is_evening:
            continue
        if session_type == "midday" and not is_midday:
            continue
            
        digits = re.findall(r'\b\d\b', snippet)
        if len(digits) >= 4:
            nomor = "".join(digits[:4])
        else:
            four_digits = re.findall(r'\b(\d{4})\b', snippet)
            if four_digits:
                nomor = four_digits[0]
            else:
                continue
                
        if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
            results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- 4. FUNGSI PEMBEDAH CALIFORNIA ---
def parse_california(html_text, _):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+200]
        
        digits = re.findall(r'\b\d\b', snippet)
        if len(digits) >= 4:
            nomor = "".join(digits[:4])
        else:
            four_digits = re.findall(r'\b(\d{4})\b', snippet)
            if four_digits:
                nomor = four_digits[0]
            else:
                continue
                
        if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
            results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- 5. FUNGSI PEMBEDAH KENTUCKY ---
def parse_kentucky(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)
    
    date_pattern = r'(\d{1,2})/(\d{1,2})/(\d{4})'
    for match in re.finditer(date_pattern, text):
        m, d, y = match.groups()
        formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
        snippet = text[match.end():match.end()+200]
        
        is_evening = "evening" in snippet.lower()
        is_midday = "midday" in snippet.lower()
        
        if session_type == "evening" and not is_evening:
            continue
        if session_type == "midday" and not is_midday:
            continue
            
        digits = re.findall(r'\b\d\b', snippet)
        if len(digits) >= 4:
            nomor = "".join(digits[:4])
        else:
            four_digits = re.findall(r'\b(\d{4})\b', snippet)
            if four_digits:
                nomor = four_digits[0]
            else:
                continue
                
        if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
            results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- 6. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all('tr')
    
    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2:
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
            
            time_mapping = {"00": 1, "13": 2, "16": 3, "19": 4, "22": 5, "23": 6}
            col_index = time_mapping.get(time_label)
            
            if col_index and col_index < len(cells):
                nomor = cells[col_index].get_text(strip=True)
                if len(nomor) == 4 and nomor.isdigit():
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                        results.append({"tanggal": formatted_date, "nomor": nomor})
    return results

# --- FUNGSI UTAMA FETCH & SAVE ---
def fetch_and_parse(url, parser_function, param):
    print(f"Menarik data dari {url} (Param: {param}) ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            html_text = page.content()
            
            # DETEKSI PEMBLOKIRAN (Cloudflare/CAPTCHA)
            if "cloudflare" in html_text.lower() or "access denied" in html_text.lower() or "captcha" in html_text.lower() or "checking your browser" in html_text.lower():
                print(f"⚠️ PERINGATAN: Terdeteksi pemblokiran (Cloudflare/CAPTCHA) untuk {url}")
                print(f"Snippet HTML: {html_text[:300]}...")
                
            browser.close()
            return parser_function(html_text, param)
    except Exception as e:
        print(f"Error koneksi/loading: {e}")
        return []

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"⚠️ FAILED: Tidak ada data ditarik untuk {market_name}")
        return
    
    if not os.path.exists('data_market'):
        os.makedirs('data_market')
        
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception:
            pass

    existing_records = set()
    for item in existing_data:
        tanggal = item.get('tanggal', item.get('tanggal ', '')).strip()
        nomor = item.get('nomor', item.get('nomor ', '')).strip()
        if tanggal and nomor:
            existing_records.add((tanggal, nomor))
    
    added_count = 0
    for item in new_data:
        tanggal = item.get('tanggal', '').strip()
        nomor = item.get('nomor', '').strip()
        identifier = (tanggal, nomor)
        if identifier and identifier not in existing_records:
            existing_data.append({"tanggal": tanggal, "nomor": nomor})
            existing_records.add(identifier)
            added_count += 1

    # SORTIR: Tanggal terbaru di atas (reverse=True)
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x.get('tanggal', '').strip(), "%d-%m-%Y"), reverse=True)
    except Exception as e:
        print(f"Warning: Gagal sorting data: {e}")

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
    print(f"✅ SUCCESS: {added_count} data baru ditambahkan. Total {len(existing_data)} data untuk {market_name}")

def main():
    TARGETS = [
        ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "1:00 PM"),
        ("oregon-6", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "4:00 PM"),
        ("oregon-9", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "7:00 PM"),
        ("oregon-12", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "10:00 PM"),
        ("new-york-midday", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york, "Midday"),
        ("new-york-evening", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york, "Evening"),
        ("north-carolina-day", "https://nclottery.com/pick4-past", parse_north_carolina, "midday"),
        ("north-carolina-evening", "https://nclottery.com/pick4-past", parse_north_carolina, "evening"),
        ("california-daily-4", "https://www.calottery.com/en/draw-games/daily-4", parse_california, ""),
        ("kentucky-pick-4", "https://www.kylottery.com/en-us/games/draw-games/pick-4.html", parse_kentucky, "midday"),
        ("macau-00", "http://178.128.19.32/", parse_macau, "00"),
        ("macau-13", "http://178.128.19.32/", parse_macau, "13"),
        ("macau-16", "http://178.128.19.32/", parse_macau, "16"),
        ("macau-19", "http://178.128.19.32/", parse_macau, "19"),
        ("macau-22", "http://178.128.19.32/", parse_macau, "22"),
        ("macau-23", "http://178.128.19.32/", parse_macau, "23"),
    ]

    for market_name, url, parser_func, param in TARGETS:
        data = fetch_and_parse(url, parser_func, param)
        save_with_smart_append(market_name, data)

if __name__ == "__main__":
    main()
