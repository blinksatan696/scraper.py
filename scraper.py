import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re

# Daftar Market dan URL-nya
MARKETS = {
    "kentucky-midday": "https://presidenttotop6.com/pasaran/q9t5wwhf.html",
    "new-york-midday": "https://presidenttotop6.com/pasaran/liinkkua.html",
    "north-carolina-day": "https://presidenttotop6.com/pasaran/vxpgtjuj.html",
    "oregon-3": "https://presidenttotop6.com/pasaran/fbyqi1ei.html",
    "oregon-6": "https://presidenttotop6.com/pasaran/nkkwks2m.html",
    "california": "https://presidenttotop6.com/pasaran/sr6dyibs.html",
    "oregon-9": "https://presidenttotop6.com/pasaran/vvjpntz9.html",
    "new-york-evening": "https://presidenttotop6.com/pasaran/wzyn4asu.html",
    "kentucky-evening": "https://presidenttotop6.com/pasaran/wjollysr.html",
    "north-carolina-evening": "https://presidenttotop6.com/pasaran/xty6pp5c.html",
    "oregon-12": "https://presidenttotop6.com/pasaran/leus8kqq.html",
    "bullseye": "https://presidenttotop6.com/pasaran/7jr1lkpo.html",
    "pcso": "https://presidenttotop6.com/pasaran/o1uxt3mn.html",
    "macau": "http://178.128.19.32/"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}

def scrape_market(url):
    print(f"Mengakses {url} ...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            print(f"Gagal! Status Code: {response.status_code}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        results = []

        # Mencari semua baris tabel (tr)
        rows = soup.find_all('tr')
        for row in rows:
            cells = row.find_all('td')
            if not cells or len(cells) < 2:
                continue
            
            row_text = row.get_text(separator=' ', strip=True)
            
            # 1. Cari pola tanggal (YYYY-MM-DD)
            date_match = re.search(r'(\d{4}-\d{2}-\d{2})', row_text)
            if not date_match:
                continue
                
            raw_date = date_match.group(1)
            # Konversi format ke DD-MM-YYYY
            try:
                dt_obj = datetime.strptime(raw_date, "%Y-%m-%d")
                formatted_date = dt_obj.strftime("%d-%m-%Y")
            except ValueError:
                continue

            # 2. Ambil angka result dari kolom paling kanan (PRIZE)
            prize_cell = cells[-1]
            
            # Ekstrak elemen spesifik yang berisi angka (biasanya di-span)
            digits = [el.get_text(strip=True) for el in prize_cell.find_all(['span', 'div', 'li', 'b']) if el.get_text(strip=True).isdigit()]
            
            # Jika tidak ada elemen span/div (HTML plain text), tarik langsung angka dari teksnya
            if not digits:
                clean_prize_text = re.sub(r'\D', '', prize_cell.get_text(strip=True))
                if len(clean_prize_text) >= 4:
                    digits = list(clean_prize_text[-4:])
                    
            result_number = "".join(digits)
            
            # 3. Validasi & Simpan angka 4D
            if len(result_number) >= 4:
                result_4d = result_number[-4:] # Ambil tepat 4 digit terakhir
                
                # Mencegah duplikasi data per tanggal
                if not any(r['tanggal'] == formatted_date for r in results):
                    results.append({
                        "tanggal": formatted_date,
                        "nomor": result_4d
                    })
        
        return results
    except Exception as e:
        print(f"Error saat memproses {url}: {e}")
        return []
        
def main():
    # Buat folder 'data_market' jika belum ada
    if not os.path.exists('data_market'):
        os.makedirs('data_market')

    for market_name, url in MARKETS.items():
        new_data = scrape_market(url)
        if new_data:
            file_path = os.path.join('data_market', f"{market_name}.json")
            existing_data = []
            
            # 1. Buka dan baca file JSON lama jika sudah ada
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        existing_data = json.load(f)
                except Exception:
                    pass
                    
            # 2. Gabungkan data baru ke data lama (Cek agar tidak ada tanggal ganda)
            existing_dates = {item['tanggal'] for item in existing_data}
            for item in new_data:
                if item['tanggal'] not in existing_dates:
                    existing_data.append(item)
                    
            # 3. Urutkan kembali data berdasarkan tanggal (terlama ke terbaru)
            try:
                existing_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"))
            except Exception:
                pass
                
            # 4. Simpan kembali seluruh data (lama + baru) ke JSON
            with open(file_path, 'w') as f:
                json.dump(existing_data, f, indent=4)
                
            print(f"SUCCESS: Total {len(existing_data)} data terkumpul untuk {market_name}")
        else:
            print(f"FAILED: Tidak ada data valid ditemukan untuk {market_name}")

if __name__ == "__main__":
    main()
