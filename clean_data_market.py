import json
import os
import glob
from datetime import datetime

def clean_json_file(file_path):
    """Membersihkan satu file JSON dari spasi dan mengurutkan data"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print(f"   ⚠️ {os.path.basename(file_path)}: Bukan format list, dilewati")
            return False
        
        # 1. Bersihkan key dan value dari spasi
        cleaned_data = []
        for item in data:
            # Handle key dengan atau tanpa spasi
            tanggal = str(item.get("tanggal", item.get("tanggal ", ""))).strip()
            nomor = str(item.get("nomor", item.get("nomor ", ""))).strip()
            
            if tanggal and nomor:
                cleaned_data.append({
                    "tanggal": tanggal,
                    "nomor": nomor
                })
        
        # 2. Hapus duplikasi dalam file yang sama
        unique_data = []
        seen = set()
        for item in cleaned_data:
            key = (item['tanggal'], item['nomor'])
            if key not in seen:
                unique_data.append(item)
                seen.add(key)
        
        # 3. Urutkan dari tanggal terbaru ke terlama (descending)
        try:
            unique_data.sort(key=lambda x: datetime.strptime(x['tanggal'], "%d-%m-%Y"), reverse=True)
        except Exception as e:
            print(f"   ⚠️ {os.path.basename(file_path)}: Gagal mengurutkan - {e}")
        
        # 4. Simpan kembali dengan format bersih
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(unique_data, f, indent=2, ensure_ascii=False)
        
        print(f"   ✅ {os.path.basename(file_path)}: {len(unique_data)} data dibersihkan")
        return True
        
    except Exception as e:
        print(f"   ❌ {os.path.basename(file_path)}: Error - {e}")
        return False

def main():
    print("🧹 Memulai pembersihan folder data_market...\n")
    
    # Pastikan folder data_market ada
    if not os.path.exists('data_market'):
        print("❌ Folder data_market tidak ditemukan!")
        return
    
    # Cari semua file JSON di folder data_market
    json_files = glob.glob(os.path.join('data_market', '*.json'))
    
    if not json_files:
        print("⚠️ Tidak ada file JSON ditemukan di data_market")
        return
    
    print(f"📁 Ditemukan {len(json_files)} file JSON\n")
    
    success_count = 0
    fail_count = 0
    
    for file_path in sorted(json_files):
        if clean_json_file(file_path):
            success_count += 1
        else:
            fail_count += 1
    
    print(f"\n Selesai! {success_count} file berhasil dibersihkan, {fail_count} file gagal.")
    print("\n📋 File yang sudah dibersihkan:")
    print("   - Semua key sekarang: 'tanggal' dan 'nomor' (tanpa spasi)")
    print("   - Semua value sudah di-trim (tanpa spasi di awal/akhir)")
    print("   - Data diurutkan dari tanggal terbaru ke terlama")
    print("   - Duplikasi dalam file yang sama sudah dihapus")

if __name__ == "__main__":
    main()
