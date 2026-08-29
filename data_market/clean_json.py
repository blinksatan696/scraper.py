import json
import os
import glob

# Pastikan folder data_market ada
if not os.path.exists('data_market'):
    print("Folder data_market tidak ditemukan.")
    exit()

# Cari semua file JSON di dalam folder
json_files = glob.glob(os.path.join('data_market', '*.json'))

for file_path in json_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Bersihkan key dan value dari spasi di awal/akhir
        cleaned_data = []
        for item in data:
            clean_item = {
                "tanggal": str(item.get("tanggal", "")).strip(),
                "nomor": str(item.get("nomor", "")).strip()
            }
            cleaned_data.append(clean_item)
        
        # Simpan kembali dengan format yang bersih
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Bersih: {os.path.basename(file_path)}")
    except Exception as e:
        print(f"❌ Gagal memproses {os.path.basename(file_path)}: {e}")

print("\n🎉 Proses pembersihan selesai!")
