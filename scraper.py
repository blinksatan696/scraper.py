import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import os
import re

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
            
        # Deteksi jika web memunculkan halaman pelindung Cloudflare
        if "cloudflare" in response.text.lower() or "just a moment" in response.text.lower():
            print(f"TERBLOKIR: Cloudflare mendeteksi bot pada {url}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        results = []

        # Pendekatan tangguh: Cari semua container yang membungkus elemen tanggal
        # Biasanya ada di dalam <tr> (tabel), <li> (list), atau <article>/<div>
        draw_containers = soup.find_all(['tr', 'li', 'div', 'article'])

        for container in draw_containers:
            try:
                # 1. Cari elemen waktu (<time>) di dalam container ini
                date_element = container.find('time')
                if not date_element:
                    continue
                    
                raw_date_str = date_element.get_text(strip=True)
                
                # Format dari web biasanya: "Thursday, Aug 24, 2026"
                # Kita hapus nama hari agar sisa "Aug 24 2026"
                clean_str = re.sub(r'^[A-Za-z]+,\s*', '', raw_date_str).replace(',', '').strip()
                dt_obj = datetime.strptime(clean_str, "%b %d %Y")
                formatted_date = dt_obj.strftime("%d-%m-%Y")

                # 2. Cari semua elemen angka yang ada di dekat tanggal tersebut
                # Angka 4D biasanya dibungkus di dalam <li> atau <span>
                number_elements = container.find_all(['li', 'span'])
                
                # Saring hanya elemen yang berisi angka mutlak (tanpa huruf)
                digits = [el.get_text(strip=True) for el in number_elements if el.get_text(strip=True).isdigit()]
                result_number = "".join(digits)
                
                # 3. Validasi dan simpan angka (Ambil 4 digit pertama)
                if len(result_number) >= 4:
                    result_4d = result_number[:4]
                    
                    # Pastikan belum ada data di tanggal yang sama (mencegah duplikasi)
                    if not any(r['tanggal'] == formatted_date for r in results):
                        results.append({
                            "tanggal": formatted_date,
                            "nomor": result_4d
                        })
            except Exception as e:
                # Lewati jika struktur tidak cocok
                continue
        
        return results
    except Exception as e:
        print(f"Error tidak terduga saat memproses {url}: {e}")
        return []

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
            print(f"SUCCESS: {len(data)} data tersimpan untuk {market_name}")
        else:
            print(f"FAILED: Tidak ada data valid ditemukan untuk {market_name}")

if __name__ == "__main__":
    main()
