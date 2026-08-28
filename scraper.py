import json
from datetime import datetime
import os
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

# Menyamar sebagai browser manusia (Windows + Chrome)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# --- 1. FUNGSI PEMBEDAH OREGON ---
def parse_oregon(html_text, time_label):
    # time_label akan berisi "1:00 PM", "4:00 PM", "7:00 PM", atau "10:00 PM"
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    
    # Hancurkan HTML menjadi teks biasa dengan pemisah "|"
    raw_text = soup.get_text(separator='|', strip=True)
    
    # Format Oregon: "8/25/2026 - 4:00 PM"
    # Kita pecah berdasarkan tanggal
    chunks = raw_text.split('|')
    
    for i in range(len(chunks)):
        text = chunks[i]
        # Cari teks yang mengandung waktu yang dituju (misal: "1:00 PM") dan format tanggal AS
        if time_label in text and re.search(r'\d{1,2}/\d{1,2}/\d{4}', text):
            # Ekstrak tanggalnya
            date_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
            if date_match:
                m, d, y = date_match.groups()
                formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
                
                # Cari 4 angka terdekat di elemen-elemen berikutnya
                digits_found = []
                for j in range(1, 15): # Telusuri hingga 15 elemen teks ke depan
                    if i + j < len(chunks):
                        # Ambil angka tunggal yang berdiri sendiri (seperti di gambar Oregon)
                        if chunks[i+j].isdigit() and len(chunks[i+j]) == 1:
                            digits_found.append(chunks[i+j])
                        # Jika sudah dapat 4 angka, hentikan pencarian
                        if len(digits_found) == 4:
                            break
                            
                if len(digits_found) >= 4:
                    results.append({"tanggal": formatted_date, "nomor": "".join(digits_found[:4])})
    return results

# --- 2. FUNGSI PEMBEDAH NEW YORK ---
def parse_new_york(html_text, draw_type):
    # draw_type akan berisi "Midday" atau "Evening"
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    chunks = soup.get_text(separator='|', strip=True).split('|')
    
    current_date = None
    
    for i in range(len(chunks)):
        text = chunks[i]
        # Cek apakah teks ini adalah tanggal (Format NY: 08/25/2026)
        date_match = re.search(r'^(\d{2})/(\d{2})/(\d{4})$', text)
        if date_match:
            m, d, y = date_match.groups()
            current_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
        # Jika menemukan label Midday/Evening dan kita punya current_date
        if text.lower() == draw_type.lower() and current_date:
            # Di NY, angka biasanya berada tepat *sebelum* tulisan Midday/Evening
            digits_found = []
            for j in range(1, 10):
                if i - j >= 0:
                    if chunks[i-j].isdigit() and len(chunks[i-j]) == 1:
                        digits_found.insert(0, chunks[i-j])
                    elif len(digits_found) > 0: 
                        break # Berhenti jika sudah melewati blok angka
            
            if len(digits_found) >= 4:
                # Ambil 4 angka terakhir (mengabaikan extra ball jika ada)
                results.append({"tanggal": current_date, "nomor": "".join(digits_found[-4:])})
                current_date = None # Reset agar tidak terduplikasi
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA ---
def parse_north_carolina(html_text, draw_type):
    # draw_type akan berisi "DAYTIME" atau "EVENING"
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    chunks = soup.get_text(separator='|', strip=True).split('|')
    
    current_year = datetime.now().year
    
    for i in range(len(chunks)):
        text = chunks[i]
        # Format NC: "Tue, Aug 25" -> Kita cari nama bulan
        month_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})', text, re.IGNORECASE)
        
        # Cek apakah blok teks ini mengandung tipe undian yang dicari DAN bulan
        if draw_type.lower() in chunks[max(0, i-2):i+1] and month_match:
            try:
                dt_obj = datetime.strptime(f"{month_match.group(1)} {month_match.group(2)} {current_year}", "%b %d %Y")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
                
                # Angka biasanya ada tepat setelah tanggal
                digits_found = []
                for j in range(1, 10):
                    if i + j < len(chunks):
                        if chunks[i+j].isdigit() and len(chunks[i+j]) == 1:
                            digits_found.append(chunks[i+j])
                        if len(digits_found) == 4:
                            break
                
                if len(digits_found) >= 4:
                    results.append({"tanggal": formatted_date, "nomor": "".join(digits_found[:4])})
            except Exception:
                pass
    return results

# --- 4. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, _):
    # Menggunakan metode universal pencarian tanggal YYYY-MM-DD
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    rows = soup.find_all('tr')
    
    for row in rows:
        text = row.get_text(separator=' ', strip=True)
        date_match = re.search(r'(\d{4}-\d{2}-\d{2})', text)
        if date_match:
            raw_date = date_match.group(1)
            try:
                dt_obj = datetime.strptime(raw_date, "%Y-%m-%d")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
                
                clean_text = re.sub(r'\D', '', text.replace(raw_date, ''))
                if len(clean_text) >= 4:
                    results.append({"tanggal": formatted_date, "nomor": clean_text[-4:]})
            except ValueError:
                continue
    return results


# --- MESIN UTAMA PENARIKAN DATA ---
def fetch_and_parse(url, parser_function, param):
    print(f"Menarik data dari {url} ({param}) ...")
    try:
        with sync_playwright() as p:
            # Buka Chrome secara tersembunyi
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            # Kunjungi web dan tunggu hingga aktivitas jaringan (loading JS) benar-benar berhenti
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
        
        ("north-carolina-day", "https://nclottery.com/pick4", parse_north_carolina, "DAYTIME"),
        ("north-carolina-evening", "https://nclottery.com/pick4", parse_north_carolina, "EVENING"),
        
        ("macau", "http://178.128.19.32/", parse_macau, "")
    ]

    for market_name, url, parser_func, param in TARGETS:
        data = fetch_and_parse(url, parser_func, param)
        save_with_smart_append(market_name, data)

if __name__ == "__main__":
    main()
