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
    raw_text = soup.get_text(separator='|', strip=True)
    chunks = raw_text.split('|')
    
    for i in range(len(chunks)):
        text = chunks[i]
        if time_label in text and re.search(r'\d{1,2}/\d{1,2}/\d{4}', text):
            date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
            if date_match:
                m, d, y = date_match.groups()
                formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
                
                digits_found = []
                for j in range(1, 15):
                    if i + j < len(chunks):
                        if chunks[i+j].isdigit() and len(chunks[i+j]) == 1:
                            digits_found.append(chunks[i+j])
                        if len(digits_found) == 4:
                            break
                            
                if len(digits_found) >= 4:
                    results.append({"tanggal": formatted_date, "nomor": "".join(digits_found[:4])})
    return results

# --- 2. FUNGSI PEMBEDAH NEW YORK ---
def parse_new_york(html_text, draw_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    elements = soup.find_all(['tr', 'div', 'li', 'p', 'span'])
    
    current_date = None
    for el in elements:
        text = el.get_text(strip=True)
        date_match = re.search(r'^(\d{2})/(\d{2})/(\d{4})$', text)
        if date_match:
            m, d, y = date_match.groups()
            current_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
        if draw_type.lower() in text.lower() and current_date:
            clean_digits = re.sub(r'[^\d]', '', text)
            if len(clean_digits) >= 4:
                results.append({"tanggal": current_date, "nomor": clean_digits[-4:]})
                current_date = None
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA (BERDASARKAN URL BARU) ---
def parse_north_carolina(html_text, session_type):
    # session_type diisi "day" (matahari) atau "evening" (bulan)
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # Berdasarkan screenshot, data tersusun dalam baris-baris teks/tabel
    rows = soup.find_all(['tr', 'div', 'li'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        
        # Cek apakah baris memuat format tanggal NC: "2026, Aug 27"
        date_match = re.search(r'(\d{4}),\s+([A-Za-z]{3})\s+(\d{1,2})', row_text)
        if date_match:
            year, month_str, day = date_match.groups()
            
            # Tentukan apakah ini sesi Day (Matahari/Kuning) atau Evening (Bulan/Biru)
            is_evening = "🌙" in row_text or "evening" in row.decode_contents().lower() or "night" in row_text.lower()
            
            # Filter berdasarkan sesi yang diminta
            if session_type == "evening" and not is_evening:
                continue
            if session_type == "day" and is_evening:
                continue
                
            try:
                dt_obj = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
                
                # Ambil semua angka di baris setelah tanggal
                all_digits = re.findall(r'\d+', row_text.replace(date_match.group(0), ''))
                # Filter angka 1 digit yang berderet (hasil undian 4 digit pertama)
                valid_digits = [d for d in all_digits if len(d) == 1]
                
                if len(valid_digits) >= 4:
                    result_num = "".join(valid_digits[:4])
                    if not any(r['tanggal'] == formatted_date for r in results):
                        results.append({"tanggal": formatted_date, "nomor": result_num})
            except Exception:
                pass
    return results

# --- 4. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, _):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all('tr')
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', row_text)
        if date_match:
            raw_date = date_match.group(1)
            try:
                dt_obj = datetime.strptime(raw_date, "%Y-%m-%d")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
                
                all_digits = re.findall(r'\d+', row_text.replace(raw_date, ''))
                combined_digits = "".join(all_digits)
                
                if len(combined_digits) >= 4:
                    results.append({"tanggal": formatted_date, "nomor": combined_digits[-4:]})
            except Exception:
                pass
    return results

# --- MESIN UTAMA PENARIKAN DATA ---
def fetch_and_parse(url, parser_function, param):
    print(f"Menarik data dari {url} ({param}) ...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            page.goto(url, wait_until="networkidle", timeout=45000)
            html_text = page.content()
            browser.close()
            return parser_function(html_text, param)
    except Exception as e:
        print(f"Error koneksi/loading: {e}")
        return []

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"FAILED: Tidak ada data ditarik untuk {market_name}")
        return

    if not os.path.exists('data_market'):
        os.makedirs('data_market')
        
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                existing_data = json.load(f)
        except Exception:
            pass
            
    existing_dates = {item['tanggal'] for item in existing_data}
    for item in new_data:
        if item['tanggal'] not in existing_dates:
            existing_data.append(item)
            
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"))
    except Exception:
        pass
        
    with open(file_path, 'w') as f:
        json.dump(existing_data, f, indent=4)
    print(f"SUCCESS: Total {len(existing_data)} data terkumpul untuk {market_name}")

def main():
    TARGETS = [
        ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "1:00 PM"),
        ("oregon-6", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "4:00 PM"),
        ("oregon-9", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "7:00 PM"),
        ("oregon-12", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "10:00 PM"),
        
        ("new-york-midday", "https://nylottery.ny.gov/all-winning-numbers", parse_new_york, "Midday"),
        ("new-york-evening", "https://nylottery.ny.gov/all-winning-numbers", parse_new_york, "Evening"),
        
        # Menggunakan tautan baru khusus halaman riwayat North Carolina
        ("north-carolina-day", "https://nclottery.com/pick4-past", parse_north_carolina, "day"),
        ("north-carolina-evening", "https://nclottery.com/pick4-past", parse_north_carolina, "evening"),
        
        ("macau", "http://178.128.19.32/", parse_macau, "")
    ]

    for market_name, url, parser_func, param in TARGETS:
        data = fetch_and_parse(url, parser_func, param)
        save_with_smart_append(market_name, data)

if __name__ == "__main__":
    main()