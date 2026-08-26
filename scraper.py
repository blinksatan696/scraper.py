import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re

# Header untuk menyamar sebagai browser manusia asli
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# --- FUNGSI PEMBEDAH KHUSUS SETIAP NEGARA BAGIAN ---

def parse_oregon(html_text):
    # Logika untuk membaca web resmi Oregon Lottery akan kita letakkan di sini
    results = []
    # (Menunggu analisis HTML lengkap)
    return results

def parse_new_york(html_text):
    # Logika untuk membaca web resmi New York Lottery
    results = []
    # (Menunggu analisis HTML lengkap)
    return results

def parse_north_carolina(html_text):
    # Logika untuk membaca web resmi North Carolina Lottery
    results = []
    # (Menunggu analisis HTML lengkap)
    return results

# --- MESIN UTAMA PENARIKAN DATA ---

def fetch_and_parse(market_name, url, parser_function):
    print(f"Menarik data dari {url} ...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code != 200:
            print(f"Gagal! Status Code: {response.status_code}")
            return []
            
        # Kirim teks HTML ke fungsi pembedah khusus masing-masing web
        return parser_function(response.text)
    except Exception as e:
        print(f"Error koneksi: {e}")
        return []

def save_with_smart_append(market_name, new_data):
    if not new_data:
        print(f"FAILED: Tidak ada data ditarik untuk {market_name}")
        return

    if not os.path.exists('data_market'):
        os.makedirs('data_market')
        
    file_path = os.path.join('data_market', f"{market_name}.json")
    existing_data = []
    
    # Baca data lama
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                existing_data = json.load(f)
        except Exception:
            pass
            
    # Gabungkan tanpa duplikasi tanggal
    existing_dates = {item['tanggal'] for item in existing_data}
    for item in new_data:
        if item['tanggal'] not in existing_dates:
            existing_data.append(item)
            
    # Urutkan tanggal dan simpan
    try:
        existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"))
    except Exception:
        pass
        
    with open(file_path, 'w') as f:
        json.dump(existing_data, f, indent=4)
    print(f"SUCCESS: Total {len(existing_data)} data terkumpul untuk {market_name}")

def main():
    # Daftar Market Resmi yang akan dieksekusi
    # Struktur: [Nama File, URL Resmi, Fungsi Pembedah]
    TARGETS = [
        # ("oregon-3", "https://www.oregonlottery.org/pick-4/winning-numbers/", parse_oregon),
        # ("new-york-midday", "https://nylottery.ny.gov/all-winning-numbers", parse_new_york),
        # Akan diaktifkan setelah Anda memberikan sisa tautannya
    ]

    for market_name, url, parser_func in TARGETS:
        data = fetch_and_parse(market_name, url, parser_func)
        save_with_smart_append(market_name, data)

if __name__ == "__main__":
    main()
