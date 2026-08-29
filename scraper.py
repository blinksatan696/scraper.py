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
                current_date = None # Reset agar tidak double match
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA ---
def parse_north_carolina(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        # Support format: MM/DD/YYYY atau Month DD, YYYY
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text) or re.search(r'([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})', row_text)
        
        if date_match:
            if len(date_match.groups()) == 3 and date_match.group(1).isdigit():
                m, d, y = date_match.groups()
                formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            else:
                month_str, day, year = date_match.groups()
                try:
                    dt_obj = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                    formatted_date = dt_obj.strftime("%d-%m-%Y")
                except:
                    continue

            is_evening = "evening" in row_text.lower() or "night" in row_text.lower() or "🌙" in row_text
            is_midday = "midday" in row_text.lower() or "day" in row_text.lower() or "☀️" in row_text

            if session_type == "evening" and not is_evening:
                continue
            if session_type == "midday" and not is_midday:
                continue

            all_digits = re.findall(r'\d+', row_text)
            # Cari kombinasi 4 digit
            for digit_str in all_digits:
                if len(digit_str) == 4:
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == digit_str for r in results):
                        results.append({"tanggal": formatted_date, "nomor": digit_str})
                    break
    return results

# --- 4. FUNGSI PEMBEDAH CALIFORNIA ---
def parse_california(html_text, _):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text)
        if date_match:
            m, d, y = date_match.groups()
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            all_digits = re.findall(r'\d+', row_text)
            for digit_str in all_digits:
                if len(digit_str) == 4:
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == digit_str for r in results):
                        results.append({"tanggal": formatted_date, "nomor": digit_str})
                    break
    return results

# --- 5. FUNGSI PEMBEDAH KENTUCKY ---
def parse_kentucky(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text)
        if date_match:
            m, d, y = date_match.groups()
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            is_evening = "evening" in row_text.lower()
            is_midday = "midday" in row_text.lower()
            
            if session_type == "evening" and not is_evening:
                continue
            if session_type == "midday" and not is_midday:
                continue
                
            all_digits = re.findall(r'\d+', row_text)
            for digit_str in all_digits:
                if len(digit_str) == 4:
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == digit_str for r in results):
                        results.append({"tanggal": formatted_date, "nomor": digit_str})
                    break
    return results

# --- 6. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', row_text) or re.search(r'(\d{2})/(\d{2})/(\d{4})', row_text)
        
        if date_match:
            if len(date_match.groups()) == 3 and '-' in date_match.group(0):
                raw_date = date_match.group(0)
                formatted_date = datetime.strptime(raw_date, "%Y-%m-%d").strftime("%d-%m-%Y")
            else:
                m, d, y = date_match.groups()
                formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            # Cek apakah label waktu (00, 13, 16, dll) ada di sekitar teks ini
            if time_label and time_label not in row_text:
                continue
                
            all_digits = re.findall(r'\d+', row_text)
            combined = "".join(all_digits)
            # Ambil 4 digit terakhir sebagai nomor undian (sesuai logika lama Anda)
            if len(combined) >= 4:
                num_val = combined[-4:]
                if not any(r['tanggal'] == formatted_date and r['nomor'] == num_val for r in results):
                    results.append({"tanggal": formatted_date, "nomor": num_val})
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

    # PERBAIKAN KRITIS: Key sekarang PASTI "tanggal" dan "nomor" (tanpa spasi)
    existing_records = {(item['tanggal'], item['nomor']) for item in existing_data if 'tanggal' in item and 'nomor' in item}
    
    added_count = 0
    for item in new_data:
        identifier = (item['tanggal'], item['nomor'])
        if identifier not in existing_records:
            existing_data.append(item)
            existing_records.add(identifier)
            added_count += 1

    try:
        existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"))
    except Exception:
        pass

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
        
    print(f"✅ SUCCESS: {added_count} data baru ditambahkan. Total {len(existing_data)} data untuk {market_name}")

def main():
    TARGETS = [
        # Oregon
        ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "1:00 PM"),
        ("oregon-6", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "4:00 PM"),
        ("oregon-9", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "7:00 PM"),
        ("oregon-12", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon, "10:00 PM"),
        
        # New York
        ("new-york-midday", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york, "Midday"),
        ("new-york-evening", "https://nylottery.ny.gov/all-winning-numbers?nid=46", parse_new_york, "Evening"),
        
        # North Carolina
        ("north-carolina-day", "https://nclottery.com/pick4-past", parse_north_carolina, "midday"),
        ("north-carolina-evening", "https://nclottery.com/pick4-past", parse_north_carolina, "evening"),
        
        # California & Kentucky (Baru)
        ("california-daily-4", "https://www.calottery.com/en/draw-games/daily-4", parse_california, ""),
        ("kentucky-pick-4", "https://www.kylottery.com/en-us/games/draw-games/pick-4.html", parse_kentucky, "midday"), # Bisa di-split jadi midday/evening jika perlu
        
        # Macau (Multiple Sessions)
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

# PERBAIKAN KRITIS: Typo __name__ diperbaiki
if __name__ == "__main__":
    main()
