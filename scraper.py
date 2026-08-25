import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os

# Daftar Market dan URL-nya
MARKETS = {
    "california-daily-4": "https://www.lotteryusa.com/california/daily-4/",
    "oregon-pick-4-1pm": "https://www.lotteryusa.com/oregon/pick-4-1pm/",
    "oregon-pick-4-4pm": "https://www.lotteryusa.com/oregon/pick-4-4pm/",
    "oregon-pick-4-7pm": "https://www.lotteryusa.com/oregon/pick-4-7pm/",
    "oregon-pick-4-10pm": "https://www.lotteryusa.com/oregon/pick-4-10pm/",
    "nc-midday-pick-4": "https://www.lotteryusa.com/north-carolina/midday-pick-4/",
    "nc-pick-4": "https://www.lotteryusa.com/north-carolina/pick-4/",
    "ny-midday-win-4": "https://www.lotteryusa.com/new-york/midday-win-4/",
    "ny-win-4": "https://www.lotteryusa.com/new-york/win-4/",
    "ky-midday-pick-4": "https://www.lotteryusa.com/kentucky/midday-pick-4/",
    "ky-pick-4": "https://www.lotteryusa.com/kentucky/pick-4/"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def parse_date(date_str):
    # Mengubah format tanggal dari web (misal: "Thursday, Aug 24, 2026") menjadi "DD-MM-YYYY"
    try:
        # Menghapus nama hari dan koma
        clean_str = date_str.split(', ', 1)[-1].replace(',', '')
        dt_obj = datetime.strptime(clean_str.strip(), "%b %d %Y")
        return dt_obj.strftime("%d-%m-%Y")
    except Exception as e:
        return None

def scrape_market(url):
    print(f"Scraping {url} ...")
    response = requests.get(url, headers=HEADERS)
    if response.status_code != 200:
        print(f"Gagal mengakses {url}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    results = []

    # Target elemen HTML pada situs LotteryUSA (struktur umum mereka)
    # Catatan: Class ini bisa disesuaikan jika situs mengalami perubahan struktur HTML
    draw_rows = soup.find_all('tr', class_='c-result-table__row') 
    
    # Jika menggunakan struktur tabel tradisional
    for row in draw_rows:
        try:
            # Ambil Tanggal
            date_element = row.find('time')
            if not date_element:
                continue
            raw_date = date_element.get_text(strip=True)
            formatted_date = parse_date(raw_date)
            
            # Ambil Nomor (Mencari elemen daftar angka)
            numbers_wrapper = row.find('ul', class_='c-result-string')
            if numbers_wrapper:
                digits = [li.get_text(strip=True) for li in numbers_wrapper.find_all('li') if li.get_text(strip=True).isdigit()]
                result_number = "".join(digits)
                
                # Memastikan angka yang didapat adalah 4D
                if formatted_date and len(result_number) == 4:
                    results.append({
                        "tanggal": formatted_date,
                        "nomor": result_number
                    })
        except Exception as e:
            continue
            
    return results

def main():
    # Buat folder 'data_market' jika belum ada
    if not os.path.exists('data_market'):
        os.makedirs('data_market')

    for market_name, url in MARKETS.items():
        data = scrape_market(url)
        if data:
            # Simpan ke file JSON
            file_path = os.path.join('data_market', f"{market_name}.json")
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=4)
            print(f"Berhasil menyimpan {len(data)} data untuk {market_name}")
        else:
            print(f"Tidak ada data ditemukan untuk {market_name}")

if __name__ == "__main__":
    main()  
