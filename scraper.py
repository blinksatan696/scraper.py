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
    
    # Cari semua elemen yang mungkin berisi data
    elements = soup.find_all(['div', 'article', 'section'])
    
    for el in elements:
        text = el.get_text(separator=' ', strip=True)
        
        # Cek apakah ini bagian draw_type yang dicari
        if draw_type.lower() not in text.lower():
            continue
            
        # Cari tanggal format MM/DD/YYYY
        date_matches = re.findall(r'(\d{2})/(\d{2})/(\d{4})', text)
        
        for m, d, y in date_matches:
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            # Cari 4 angka yang terpisah (dalam lingkaran)
            numbers = re.findall(r'\b(\d)\s+(\d)\s+(\d)\s+(\d)\b', text)
            for num_tuple in numbers:
                nomor = "".join(num_tuple)
                if len(nomor) == 4:
                    # Cek duplikasi
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == nomor for r in results):
                        results.append({"tanggal": formatted_date, "nomor": nomor})
                    break
                    
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA ---
def parse_north_carolina(html_text, session_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        
        # Support format: MM/DD/YYYY
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text)
        if not date_match:
            # Support format: Month DD, YYYY
            date_match = re.search(r'([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})', row_text)
        
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

            # Cari 4 digit nomor
            all_digits = re.findall(r'\d+', row_text)
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
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        
        # Cari tanggal MM/DD/YYYY
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text)
        if date_match:
            m, d, y = date_match.groups()
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            # Cari 4 digit
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
    
    # Kentucky biasanya memiliki tabel atau list
    rows = soup.find_all(['tr', 'div', 'li', 'td'])
    
    for row in rows:
        row_text = row.get_text(separator=' ', strip=True)
        
        # Cari tanggal MM/DD/YYYY
        date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', row_text)
        if date_match:
            m, d, y = date_match.groups()
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            # Cek session type
            is_evening = "evening" in row_text.lower()
            is_midday = "midday" in row_text.lower()
            
            if session_type == "evening" and not is_evening:
                continue
            if session_type == "midday" and not is_midday:
                continue
            
            # Cari 4 digit nomor (bisa terpisah atau menyatu)
            all_digits = re.findall(r'\d+', row_text)
            for digit_str in all_digits:
                if len(digit_str) == 4:
                    if not any(r['tanggal'] == formatted_date and r['nomor'] == digit_str for r in results):
                        results.append({"tanggal": formatted_date, "nomor": digit_str})
                    break
                    
            # Jika tidak ada 4 digit menyatu, cari 4 digit terpisah
            if not any(r['tanggal'] == formatted_date for r in results):
                single_digits = re.findall(r'\b(\d)\b', row_text)
                if len(single_digits) >= 4:
                    nomor = "".join(single_digits[:4])
                    if not any(r['tanggal'] == formatted_date for r in results):
                        results.append({"tanggal": formatted_date, "nomor": nomor})
    
    return results

# --- 6. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, time_label):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # Macau menggunakan tabel
    rows = soup.find_all('tr')
    
    for row in rows:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2:
            continue
            
        # Kolom pertama biasanya tanggal
        date_cell = cells[0].get_text(strip=True)
        
        # Format tanggal: "24 Aug" atau "Aug 24"
        date_match = re.search(r'(\d{1,2})\s+([A-Za-z]{3})', date_cell)
        if not date_match:
            date_match = re.search(r'([A-Za-z]{3})\s+(\d{1,2})', date_cell)
        
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
            
            # Cari kolom yang sesuai dengan time_label
            # Mapping: 00->00:01, 13->13:00, 16->16:00, 19->19:00, 22->22:00, 23->23:00
            time_mapping = {
                "00": 1,  # Kolom ke-2 (index 1)
                "13": 2,  # Kolom ke-3
                "16": 3,  # Kolom ke-4
                "19": 4,  # Kolom ke-5
                "22": 5,  # Kolom ke-6
                "23": 6   # Kolom ke-7
            }
            
            col_index = time_mapping.get(time_label)
            if col_index and col_index < len(cells):
                nomor = cells[col_index].get_text(strip=True)
                # Pastikan nomor 4 digit
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

    # PERBAIKAN: Handle key dengan atau tanpa spasi
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
            # Simpan dengan key tanpa spasi
            existing_data.append({"tanggal": tanggal, "nomor": nomor})
            existing_records.add(identifier)
            added_count += 1

    # Sortir dari yang terbaru
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x.get('tanggal', x.get('tanggal ', '')).strip(), "%d-%m-%Y"), reverse=True)
    except Exception as e:
        print(f"Warning: Gagal sorting data: {e}")

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
        
        # California & Kentucky
        ("california-daily-4", "https://www.calottery.com/en/draw-games/daily-4", parse_california, ""),
        ("kentucky-pick-4", "https://www.kylottery.com/en-us/games/draw-games/pick-4.html", parse_kentucky, "midday"),
        
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
