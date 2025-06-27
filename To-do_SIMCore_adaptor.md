
### **To-Do List: Implementasi Adaptor SIM Core**

#### **Fase 1: Fondasi & Logika Inti Adaptor**
*Tujuan: Membuat semua komponen **baru** yang diperlukan sebagai fondasi, tanpa mengubah file yang sudah ada.*

*   **Langkah 1.1: Mendefinisikan Tipe Data & Enum Baru**
    *   1.1.1. **Ubah file:** `wren-ui/src/utils/enum/dataSources.ts`
        *   **Aksi:** Tambahkan `SIMCORE = 'SIMCORE'` ke dalam enum `DATA_SOURCES`.
    *   1.1.2. **Ubah file:** `wren-ui/src/apollo/server/models/adaptor.ts`
        *   **Aksi:** Tambahkan `export interface SIMCORE_CONNECTION_INFO` baru yang berisi properti: `apiUrl: string`, `user: string`, dan `password: string`.
    *   1.1.3. **Pengujian:**
        *   Lakukan kompilasi ulang proyek (`yarn dev`) untuk memastikan tidak ada *breaking changes* atau kesalahan tipe data setelah penambahan ini.

*   **Langkah 1.2: Membuat `simcoreAdaptor` Baru**
    *   1.2.1. **Buat file baru:** `wren-ui/src/apollo/server/adaptors/simcoreAdaptor.ts`
    *   1.2.2. **Aksi:** Di dalam file baru ini, buat kelas `SimcoreAdaptor` yang mengimplementasikan `interface IIbisAdaptor`.
    *   1.2.3. **Aksi:** Implementasikan metode privat `login()` untuk otentikasi ke SIM Core API dan menyimpan token beserta waktu kedaluwarsanya di dalam state kelas.
    *   1.2.4. **Aksi:** Implementasikan metode publik `query()`. Metode ini harus berisi logika untuk:
        *   Memeriksa validitas token.
        *   Memanggil `login()` jika token tidak ada atau sudah kedaluwarsa.
        *   Mengirim `SELECT query` ke endpoint `/api/dynamicquery`.
        *   Mentransformasi struktur respons dari API SIM Core menjadi struktur `IbisQueryResponse` yang diharapkan.
    *   1.2.5. **Aksi:** Implementasikan metode publik `getTables()`, `getConstraints()`, dan `validate()` agar mereka langsung melempar `new Error('Operation not supported for SIMCORE data source')`.
    *   1.2.6. **Pengujian:**
        *   Buat file tes unit terpisah (misal: `simcoreAdaptor.test.ts`).
        *   Gunakan `axios-mock-adapter` untuk mensimulasikan respons dari API SIM Core.
        *   Tes bahwa metode `query()` berhasil melakukan login, mengirim query, dan mentransformasi data dengan benar.
        *   Tes bahwa metode `getTables()` benar-benar melempar error yang diharapkan.

---

#### **Fase 2: Integrasi Antarmuka Pengguna (UI)**
*Tujuan: Memungkinkan pengguna untuk memilih, mengkonfigurasi, dan memulai setup koneksi SIM Core dari UI.*

*   **Langkah 2.1: Membuat Komponen Form untuk SIM Core**
    *   2.1.1. **Buat file baru:** `wren-ui/src/components/pages/setup/dataSources/SimcoreProperties.tsx`
    *   2.1.2. **Aksi:** Buat komponen form React (menggunakan Ant Design) yang berisi input untuk `displayName`, `apiUrl`, `user`, dan `password`.
    *   2.1.3. **Aksi:** Tambahkan elemen teks di dalam form yang menginstruksikan pengguna untuk memastikan file `erp_schema.json` sudah ada di `wren-ui/public/`.
    *   2.1.4. **Pengujian:**
        *   Untuk sementara, ubah file `connection.tsx` untuk me-render komponen `SimcoreProperties` secara langsung untuk memastikan komponen tampil dengan benar. Kembalikan seperti semula setelah selesai.

*   **Langkah 2.2: Mengintegrasikan Komponen Baru ke Alur Setup**
    *   2.2.1. **Ubah file:** `wren-ui/src/components/pages/setup/utils.tsx` (atau file konfigurasi setup yang relevan).
        *   **Aksi:** Impor `SimcoreProperties` dan daftarkan sebagai komponen untuk `DATA_SOURCES.SIMCORE`.
    *   2.2.2. **Ubah file:** `wren-ui/src/hooks/useSetupConnection.ts` (atau di mana logika `onNext` berada).
        *   **Aksi:** Tambahkan logika kondisional. Jika tipe data source adalah `SIMCORE`:
            *   Panggil API login SIM Core untuk validasi kredensial.
            *   Gunakan `fetch('/erp_schema.json')` untuk mengambil skema.
            *   Teruskan skema yang sudah di-parse ke state atau langkah selanjutnya.
    *   2.2.3. **Pengujian:**
        *   Jalankan aplikasi dan mulai proses setup.
        *   Verifikasi bahwa "SIM Core" muncul sebagai opsi data source.
        *   Pilih "SIM Core" dan isi form. Klik "Next".
        *   Gunakan Developer Tools di browser untuk memverifikasi adanya panggilan `fetch` ke `erp_schema.json` dan panggilan API untuk login. Pastikan alur berjalan ke halaman pemilihan model dengan data dari JSON.

---

#### **Fase 3: Integrasi Backend Secara Modular**
*Tujuan: Merakit adaptor baru ke dalam logika bisnis backend menggunakan pola Factory untuk memastikan sistem tetap stabil dan mudah diperluas.*

*   **Langkah 3.1: Implementasi Adaptor Factory**
    *   3.1.1. **Ubah file:** `wren-ui/src/apollo/server/index.ts`
        *   **Aksi:** Di bagian atas file, impor `SimcoreAdaptor`.
        *   **Aksi:** Buat instance dari `IbisAdaptor` dan `SimcoreAdaptor`.
        *   **Aksi:** Buat fungsi `adaptorFactory` yang menerima `dataSourceType` dan mengembalikan instance adaptor yang sesuai.
        *   **Aksi:** Modifikasi inisialisasi `ProjectService` dan `QueryService` untuk menerima `adaptorFactory` sebagai argumen di konstruktor mereka.
    *   3.1.2. **Pengujian:**
        *   Kompilasi ulang proyek. Tahap ini kemungkinan akan menyebabkan error karena konstruktor di `ProjectService` dan `QueryService` belum diperbarui. Ini adalah hasil yang diharapkan.

*   **Langkah 3.2: Adaptasi Service untuk Menggunakan Factory**
    *   3.2.1. **Ubah file:** `wren-ui/src/apollo/server/services/projectService.ts` dan `wren-ui/src/apollo/server/services/queryService.ts`
        *   **Aksi:** Perbarui konstruktor kedua kelas ini untuk menerima `adaptorFactory`.
        *   **Aksi:** Di dalam setiap metode, ganti pemanggilan `this.ibisAdaptor` dengan `const adaptor = this.adaptorFactory(project.type);`.
        *   **Aksi (Khusus `ProjectService`):** Tambahkan pengecekan `if (project.type === 'SIMCORE')` sebelum memanggil `adaptor.getTables()` atau metode metadata lainnya untuk melempar error secara eksplisit.
    *   3.2.2. **Pengujian:**
        *   Kompilasi ulang proyek. Seharusnya tidak ada lagi error kompilasi.
        *   **Lakukan Tes Regresi:** Jalankan alur setup lengkap untuk data source yang sudah ada (misalnya MySQL). Pastikan semuanya berfungsi persis seperti sebelumnya. Ini memvalidasi bahwa refactoring kita tidak merusak fungsionalitas yang ada.

*   **Langkah 3.3: Menambahkan Logika Pembuatan Model dari JSON**
    *   3.3.1. **Ubah file:** `wren-ui/src/apollo/server/resolvers/projectResolver.ts`
        *   **Aksi:** Buat metode privat baru, `_createModelsFromJSONSchema`, yang menerima skema JSON dan daftar tabel yang dipilih pengguna. Logika di dalamnya akan mem-parsing JSON dan memanggil `modelRepository` dan `modelColumnRepository` untuk menyimpan data.
        *   **Aksi:** Modifikasi mutasi `saveTables`. Tambahkan parameter opsional untuk menerima skema JSON dari frontend.
        *   **Aksi:** Di dalam `saveTables`, tambahkan blok `if (project.type === 'SIMCORE')` untuk memanggil metode `_createModelsFromJSONSchema` yang baru. Alur `else` akan menjalankan logika yang sudah ada.
    *   3.3.2. **Pengujian:**
        *   Jalankan alur setup SIM Core. Setelah menyelesaikan pemilihan model dan menyimpannya, periksa database `wren-ui/db.sqlite3` secara manual atau melalui UI untuk memastikan bahwa model dan kolom telah dibuat dengan benar sesuai dengan `erp_schema.json`.

---

#### **Fase 4: Finalisasi & Pengujian End-to-End (E2E)**
*Tujuan: Memastikan seluruh alur kerja untuk SIM Core berfungsi dari awal hingga akhir dan tidak ada regresi pada fungsionalitas lain.*

*   **Langkah 4.1: Pengujian Alur Lengkap SIM Core**
    *   4.1.1. **Aksi:** Hapus proyek yang ada (jika ada) untuk memulai dari awal.
    *   4.1.2. **Aksi:** Lakukan proses setup untuk koneksi SIM Core.
    *   4.1.3. **Aksi:** Pilih tabel dan relasi (jika ada).
    *   4.1.4. **Aksi:** Buka halaman utama dan ajukan pertanyaan dalam bahasa natural yang akan menghasilkan `SELECT` query.
    *   4.1.5. **Aksi:** Verifikasi bahwa data yang ditampilkan di UI benar-benar berasal dari API SIM Core. Periksa log backend dan network tab di browser.
*   **Langkah 4.2: Pengujian Regresi Final**
    *   4.2.1. **Aksi:** Hapus proyek SIM Core.
    *   4.2.2. **Aksi:** Lakukan proses setup untuk koneksi database yang sudah ada (misal: MySQL via Ibis).
    *   4.2.3. **Aksi:** Pastikan alur lengkap untuk koneksi non-SIM Core masih berfungsi 100%.
*   **Langkah 4.3: Pembersihan Kode**
    *   4.3.1. **Aksi:** Tinjau semua perubahan. Hapus `console.log` atau komentar debugging. Pastikan kode mengikuti gaya penulisan yang sudah ada.