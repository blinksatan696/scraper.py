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
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    # Longgarkan pemisah teks untuk menangkap elemen dinamis
    raw_text = soup.get_text(separator=' ', strip=True)
    
    # Format NY biasanya menampilkan tanggal lalu tipe undian, misal: "08/25/2026 Midday 4 7 1 1"
    # Kita cari blok teks yang mengandung tipe undian
    date_pattern = r'(\d{2}/\d{2}/\d{4})'
    
    # Pisahkan berdasarkan kata Midday atau Evening agar lebih fokus
    segments = re.split(draw_type, raw_text, flags=re.IGNORECASE)
    
    for i in range(len(segments) - 1):
        segment_before = segments[i]
        segment_after = segments[i+1]
        
        # Cari tanggal di segmen sebelumnya
        date_match = re.findall(date_pattern, segment_before)
        if date_match:
            raw_date = date_match[-1] # Ambil tanggal terdekat sebelum label Midday/Evening
            m, d, y = raw_date.split('/')
            formatted_date = f"{int(d):02d}-{int(m):02d}-{y}"
            
            # Cari 4 angka berurutan di segmen setelahnya (di NY sering ada spasi antar angka)
            # Menangkap pola seperti "4 7 1 1" atau "4711"
            clean_after = re.sub(r'[^\d]', '', segment_after[:30]) # Ambil 30 karakter pertama saja setelah label
            if len(clean_after) >= 4:
                results.append({"tanggal": formatted_date, "nomor": clean_after[:4]})
                
    return results

# --- 3. FUNGSI PEMBEDAH NORTH CAROLINA ---
def parse_north_carolina(html_text, draw_type):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    raw_text = soup.get_text(separator=' ', strip=True)
    current_year = datetime.now().year
    
    # NC Format: "Tue, Aug 25 6 1 5 3" (Biasanya angka dipisah spasi)
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    segments = re.split(draw_type, raw_text, flags=re.IGNORECASE)
    
    for i in range(1, len(segments)):
        text_chunk = segments[i][:50] # Periksa 50 karakter setelah label
        
        # Cari bulan dan tanggal
        for month in months:
            match = re.search(rf'{month}\s+(\d{{1,2}})', text_chunk, re.IGNORECASE)
            if match:
                day = match.group(1)
                try:
                    dt_obj = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")
                    formatted_date = dt_obj.strftime("%d-%m-%Y")
                    
                    # Potong string setelah tanggal, lalu ambil 4 digit pertamanya
                    after_date = text_chunk[match.end():]
                    clean_nums = re.sub(r'[^\d]', '', after_date)
                    
                    if len(clean_nums) >= 4:
                        results.append({"tanggal": formatted_date, "nomor": clean_nums[:4]})
                        break # Berhenti mencari bulan lain jika sudah ketemu
                except Exception:
                    pass
    return results

# --- 4. FUNGSI PEMBEDAH MACAU ---
def parse_macau(html_text, _):
    results = []
    soup = BeautifulSoup(html_text, 'html.parser')
    # Macau menggunakan tabel sederhana, kita bisa bedah per baris TR
    rows = soup.find_all('tr')
    
    for row in rows:
        cells = row.find_all('td')
        if len(cells) >= 2: # Setidaknya ada kolom tanggal dan nomor
            date_text = cells[0].get_text(strip=True)
            num_text = cells[-1].get_text(strip=True) # Kolom terakhir biasanya prize/angka
            
            # Cocokkan tanggal format YYYY-MM-DD
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_text)
            if date_match:
                raw_date = date_match.group(1)
                try:
                    dt_obj = datetime.strptime(raw_date, "%Y-%m-%d")
                    formatted_date = dt_obj.strftime("%d-%m-%Y")
                    
                    clean_num = re.sub(r'\D', '', num_text)
                    if len(clean_num) >= 4:
                        results.append({"tanggal": formatted_date, "nomor": clean_num[-4:]})
                except Exception:
                    pass
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
