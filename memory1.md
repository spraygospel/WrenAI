### **Bab 1: Pendahuluan & Tujuan Proyek**

#### **1.1 Gambaran Umum Proyek**

Dokumen ini berfungsi sebagai panduan teknis dan arsitektural untuk proyek VisiAI (selanjutnya disebut "proyek" atau "aplikasi"). Proyek ini merupakan sebuah *fork* yang telah dimodifikasi secara ekstensif dari proyek *open-source* **WrenAI**.

Pada intinya, aplikasi ini adalah sebuah *Generative Business Intelligence (GenBI) Agent*. Tujuannya adalah untuk memungkinkan pengguna berinteraksi dengan basis data mereka menggunakan bahasa manusia alami. Pengguna dapat mengajukan pertanyaan seperti "Tunjukkan 5 material teratas berdasarkan volume penjualan," dan sistem akan secara otomatis:
1.  Memahami maksud dari pertanyaan tersebut menggunakan *Large Language Model* (LLM).
2.  Menerjemahkan pertanyaan menjadi *query* SQL yang valid.
3.  Menjalankan *query* tersebut pada basis data yang terhubung.
4.  Menyajikan hasilnya dalam bentuk jawaban teks, tabel, atau visualisasi grafik.

Kemampuan ini didasarkan pada konsep **Semantic Layer**, di mana hubungan dan konteks bisnis dari data didefinisikan, memungkinkan AI untuk menghasilkan *query* yang akurat dan relevan.

#### **1.2 Tujuan Modifikasi & Rebranding**

Versi asli dari WrenAI telah disesuaikan untuk memenuhi kebutuhan spesifik dan identitas merek VisiAI. Tujuan utama dari modifikasi ini adalah:

1.  **Rebranding Antarmuka Pengguna (UI):** Mengganti semua elemen visual, seperti logo dan skema warna, yang merujuk pada WrenAI dengan identitas merek VisiAI.
2.  **Penyederhanaan Fungsionalitas:** Menghapus fitur-fitur yang tidak relevan atau tautan eksternal (seperti Discord, GitHub, dan item menu tertentu) untuk menciptakan pengalaman pengguna yang lebih bersih dan lebih fokus.
3.  **Peningkatan Kompatibilitas Lingkungan:** Melakukan serangkaian perbaikan teknis untuk memastikan aplikasi dapat dijalankan dan dikembangkan dengan andal di berbagai sistem operasi (khususnya Windows), baik dalam mode development *hybrid* maupun mode produksi penuh dalam kontainer Docker.

#### **1.3 Tujuan Dokumentasi Ini**

Dokumentasi ini dibuat dengan dua tujuan utama:

1.  **Sebagai Panduan Komprehensif untuk Developer Manusia:** Menyediakan peta jalan yang jelas bagi setiap developer untuk dapat melakukan instalasi, konfigurasi, pengembangan, dan *deployment* aplikasi ini. Ini mencakup penjelasan arsitektur, panduan praktis, dan solusi untuk masalah umum.

2.  **Sebagai Basis Pengetahuan untuk Asisten AI (LLM):** Dokumen ini sengaja ditulis dengan sangat detail dan terstruktur secara teknis. Tujuannya adalah agar dapat "dibaca" dan dipahami oleh *Large Language Model* di masa depan. Dengan basis pengetahuan ini, LLM dapat membantu dalam tugas-tugas seperti:
    *   Memandu developer baru melalui proses setup.
    *   Membantu dalam proses *debugging* dengan memahami alur kerja aplikasi.
    *   Mengidentifikasi file atau komponen yang relevan untuk dimodifikasi saat ada permintaan fitur baru.
    *   Menghasilkan potongan kode atau konfigurasi berdasarkan konteks yang ada di dalam dokumen ini.

Dengan kata lain, dokumen ini tidak hanya menjelaskan "cara melakukan sesuatu", tetapi juga "mengapa sesuatu dirancang seperti itu", memberikan fondasi yang kuat untuk pemeliharaan dan pengembangan proyek jangka panjang.

---

### **Bab 2: Arsitektur Proyek & Alur Komunikasi**

#### **2.1 Diagram Arsitektur**

Untuk memahami cara kerja proyek, penting untuk membedakan antara arsitektur mode produksi (di mana semua komponen berjalan di dalam Docker) dan arsitektur mode development *hybrid* (di mana beberapa komponen berjalan secara lokal).

**Arsitektur Mode Produksi (Full Docker):**

```
+-------------------------------------------------------------+
|                     Lingkungan Docker                       |
|                                                             |
|  +----------------+      +-------------------+      +-------------+
|  |    wren-ui     |<---->|  wren-ai-service  |<---->|   Qdrant    |
|  | (Port 3000)    |      |   (Port 5555)     |      | (Vektor DB) |
|  +----------------+      +-------------------+      +-------------+
|         ^                                                 |
|         |                                                 |
|         v                                                 |
|  +----------------+                                       |
|  |  ibis-server   |----------------------------------------+
|  |  (Port 8000)   |
|  +----------------+
|         |
+---------|-----------------------------------------------------+
          |
          v
+-----------------------+
| Database SQL Eksternal|
| (MySQL, PostgreSQL)   |
+-----------------------+
```

**Arsitektur Mode Development (Hybrid):**

```
+---------------------------+       +-------------------------------------+
| Mesin Lokal (Host)        |       |          Lingkungan Docker          |
|                           |       |                                     |
|  +----------------+       |       |  +-------------------+      +-------------+
|  |    wren-ui     |<----->|------>|  |  wren-ai-service  |<---->|   Qdrant    |
|  | (Lokal)        |       |       |  |  (Lokal)          |      | (Kontainer) |
|  +----------------+       |       |  +-------------------+      +-------------+
|         ^                 |       |           ^                       |
|         |                 |       |           |                       |
|         |                 |       |           v                       |
|         v                 |       |  +----------------+               |
|  +----------------+       |<------|--|  ibis-server   |---------------+
|  | Database MySQL |       |       |  |  (Kontainer)   |
|  | (Lokal)        |       |       |  +----------------+
|  +----------------+       |       |
+---------------------------+       +-------------------------------------+
```

#### **2.2 Peran Setiap Service Utama**

Aplikasi ini terdiri dari beberapa service independen yang bekerja sama:

*   **`wren-ui` (Antarmuka Pengguna & Backend-for-Frontend)**
    *   **Fungsi:** Merupakan komponen yang dilihat dan berinteraksi dengan pengguna. Ini adalah aplikasi Next.js yang tidak hanya merender halaman web, tetapi juga memiliki server GraphQL sendiri untuk menangani logika bisnis UI, seperti manajemen proyek dan otentikasi.
    *   **Lokasi Kode:** `wren-ui/`

*   **`wren-ai-service` (Otak AI)**
    *   **Fungsi:** Service Python ini adalah inti dari kecerdasan buatan. Ia bertanggung jawab untuk menerima pertanyaan dalam bahasa alami, berinteraksi dengan LLM, dan menjalankan berbagai "pipeline" untuk tugas-tugas seperti menerjemahkan teks ke SQL, mengoreksi SQL, atau menghasilkan ringkasan.
    *   **Lokasi Kode:** `wren-ai-service/`

*   **`ibis-server` (Spesialis & Eksekutor SQL)**
    *   **Fungsi:** Service ini berfungsi sebagai jembatan langsung ke database target (misalnya MySQL). Tugas utamanya adalah memvalidasi sintaks SQL terhadap dialek database yang spesifik dan mengeksekusi *query* tersebut untuk mengambil data mentah.
    *   **Lokasi Kode:** Kode untuk ini tidak ada dalam repositori utama; kita menggunakan *image* Docker yang sudah jadi.

*   **`qdrant` ("Memori" Jangka Panjang AI)**
    *   **Fungsi:** Ini adalah *vector database*. Ia menyimpan representasi numerik (vektor atau *embeddings*) dari metadata database Anda (nama tabel, kolom, deskripsi). Ini memungkinkan `wren-ai-service` untuk dengan cepat menemukan tabel dan kolom yang paling relevan secara semantik dengan pertanyaan pengguna.
    *   **Lokasi Kode:** Menggunakan *image* Docker resmi Qdrant.

#### **2.3 Alur Komunikasi Sebuah Permintaan**

Berikut adalah contoh alur kerja saat pengguna mengajukan pertanyaan:

1.  **Input Pengguna:** Pengguna mengetik "Tampilkan 5 pelanggan teratas berdasarkan jumlah transaksi" di antarmuka `wren-ui`.
2.  **Kirim ke Otak AI:** `wren-ui` mengirimkan pertanyaan ini ke `wren-ai-service`.
3.  **Pencarian Konteks:** `wren-ai-service` mengubah pertanyaan menjadi vektor dan menanyakannya ke `qdrant` untuk menemukan tabel yang relevan (misalnya, `customers` dan `transactions`).
4.  **Generasi SQL:** `wren-ai-service` menggabungkan pertanyaan asli dengan konteks dari `qdrant` dan mengirimkannya ke LLM (misalnya, DeepSeek) untuk diterjemahkan menjadi *query* SQL.
5.  **Validasi SQL:** SQL yang dihasilkan kemudian dikirim dari `wren-ui` ke `ibis-server`.
6.  **Eksekusi:** `ibis-server` menerima SQL tersebut, terhubung ke database MySQL eksternal, dan menjalankannya.
7.  **Pengambilan Data:** Database MySQL mengembalikan hasil data mentah ke `ibis-server`.
8.  **Kirim Hasil:** `ibis-server` meneruskan data tersebut kembali ke `wren-ui`.
9.  **Tampilkan ke Pengguna:** `wren-ui` menerima data mentah dan menampilkannya dalam format yang mudah dibaca (tabel, grafik, atau ringkasan).

#### **2.4 Perbedaan Jaringan: Mode Development vs. Produksi**

Cara service-service ini berkomunikasi satu sama lain berbeda tergantung pada modenya, dan ini sangat penting untuk dipahami saat melakukan *debugging*.

*   **Mode Produksi (Full Docker):**
    *   Semua service berada dalam satu jaringan internal Docker.
    *   Mereka dapat saling memanggil menggunakan nama service mereka sebagai *hostname* (misalnya, `wren-ai-service` bisa menghubungi `qdrant` di alamat `http://qdrant:6333`).

*   **Mode Development (Hybrid):**
    *   Komunikasi menjadi lebih kompleks karena menjembatani antara mesin lokal (Host) dan jaringan Docker.
    *   **Aturan 1 (Lokal ke Docker):** Saat service lokal (misalnya, `wren-ai-service` di Windows) perlu berbicara dengan service di dalam Docker (misalnya, `qdrant`), ia harus menggunakan alamat `localhost` dengan port yang dipetakan (misalnya, `http://localhost:6333`).
    *   **Aturan 2 (Docker ke Lokal):** Saat service di dalam Docker (misalnya, `ibis-server`) perlu berbicara dengan database yang berjalan di mesin lokal (MySQL di Windows), ia harus menggunakan alamat DNS khusus: **`host.docker.internal`**. Kode di `ibisAdaptor.ts` secara otomatis menerjemahkan `localhost` menjadi alamat ini saat mode development aktif.

---

### **Bab 3: Persiapan Lingkungan & Instalasi Awal**

#### **3.1 Prasyarat Instalasi**

Sebelum memulai, pastikan mesin pengembangan Anda telah terinstal perangkat lunak berikut. Sangat disarankan untuk menginstal dalam urutan yang tercantum untuk menghindari masalah dependensi.

1.  **Git**
    *   **Fungsi:** Sistem kontrol versi untuk mengunduh (clone) kode proyek dari repositori.
    *   **Instalasi:** Unduh dari [git-scm.com](https://git-scm.com/).

2.  **Docker Desktop**
    *   **Fungsi:** Platform untuk membuat dan mengelola kontainer. Ini akan menjalankan service-service pendukung seperti Qdrant dan Ibis.
    *   **Instalasi:** Unduh dari [docker.com](https://www.docker.com/products/docker-desktop/). Pastikan Docker Desktop berjalan sebelum melanjutkan ke langkah berikutnya.
    *   **Catatan Windows:** Pastikan Anda menggunakan backend WSL 2 untuk performa dan kompatibilitas terbaik.

3.  **Node.js**
    *   **Fungsi:** Lingkungan runtime JavaScript untuk menjalankan antarmuka pengguna (`wren-ui`).
    *   **Versi Wajib:** `18.x`.
    *   **Verifikasi:** Buka terminal dan jalankan `node -v`.
    *   **Instalasi:** Gunakan [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm) (untuk macOS/Linux) atau [nvm-windows](https://github.com/coreybutler/nvm-windows) untuk mengelola beberapa versi Node dengan mudah.

4.  **Python**
    *   **Fungsi:** Bahasa pemrograman untuk menjalankan `wren-ai-service`.
    *   **Versi Wajib:** `>=3.12, <3.13`.
    *   **Verifikasi:** Buka terminal dan jalankan `python --version` atau `python3 --version`.
    *   **Instalasi:** Unduh dari [python.org](https://www.python.org/) atau gunakan manajer versi seperti `pyenv`.

5.  **Poetry**
    *   **Fungsi:** Manajer dependensi dan lingkungan virtual untuk proyek Python (`wren-ai-service`). Ini setara dengan `npm` atau `yarn` di dunia JavaScript.
    *   **Instalasi:** Buka terminal dan jalankan perintah yang disarankan di [dokumentasi resmi Poetry](https://python-poetry.org/docs/#installation).

6.  **Just**
    *   **Fungsi:** Sebuah *command runner* yang digunakan untuk menyederhanakan eksekusi skrip-skrip kompleks di `wren-ai-service`.
    *   **Instalasi:** Ikuti panduan instalasi di [halaman GitHub Just](https://github.com/casey/just#installation). Untuk Windows, menggunakan `choco` atau `scoop` adalah cara termudah.

#### **3.2 Mengunduh Kode Proyek**

Buka terminal pilihan Anda (Git Bash sangat direkomendasikan di Windows) dan jalankan perintah berikut untuk mengunduh kode proyek dan masuk ke dalam direktorinya.

```bash
git clone <URL_REPOSITORI_ANDA>
cd <NAMA_FOLDER_PROYEK>
```

#### **3.3 Konfigurasi Terpusat**

Semua konfigurasi yang sensitif dan bisa berubah antar lingkungan (dev, prod) dikelola secara terpusat di dalam direktori `docker/`. Ini adalah langkah pertama yang harus dilakukan setelah mengunduh proyek.

1.  **Pindah ke Direktori `docker`:**
    ```bash
    cd docker
    ```

2.  **Buat File Konfigurasi `.env`:**
    *   Salin file contoh untuk membuat file konfigurasi lingkungan lokal Anda. File ini **tidak akan** terlacak oleh Git.
        ```bash
        cp .env.example .env.local
        ```
    *   **Edit file `.env.local`**. Buka dengan editor teks dan isi nilai untuk variabel-variabel berikut. Ini adalah minimum yang dibutuhkan untuk menjalankan aplikasi:
        *   `DEEPSEEK_API_KEY`: Kunci API Anda dari DeepSeek.
        *   `OPENAI_API_KEY`: Kunci API Anda dari OpenAI (dibutuhkan untuk service *embedding*).
        *   `HOST_PORT`: Port di mesin lokal Anda yang akan memetakan ke port 3000 di kontainer `wren-ui` saat mode produksi. Contoh: `3000`.

3.  **Buat File Konfigurasi `config.yaml`:**
    *   Salin file contoh untuk membuat file konfigurasi utama untuk AI service.
        ```bash
        cp config.example.yaml config.yaml
        ```
    *   **PENTING:** Buka file `config.yaml` yang baru dibuat, hapus seluruh isinya, dan ganti dengan konfigurasi yang telah disesuaikan untuk mode development hybrid dan LLM DeepSeek. Konfigurasi ini dijelaskan secara detail di Bab 5. Untuk memulai, pastikan alamat `endpoint` untuk service-service sudah benar (misalnya, `qdrant` menunjuk ke `http://localhost:6333` dan `wren_ui` menunjuk ke `http://localhost:3000` saat development).

Setelah menyelesaikan langkah-langkah ini, fondasi proyek Anda telah siap, dan Anda bisa melanjutkan untuk menjalankan aplikasi baik dalam mode development maupun produksi.
---

### **Bab 4: Menjalankan Aplikasi: Mode Development & Produksi**

Aplikasi ini dirancang untuk dapat dijalankan dalam dua mode yang berbeda: **Mode Development (Hybrid)** untuk pengeditan kode secara langsung, dan **Mode Produksi (Full Docker)** untuk simulasi lingkungan *deployment* yang sebenarnya.

#### **4.1 Mode Development (Hybrid)**

Mode ini adalah pilihan utama saat Anda ingin aktif melakukan perubahan pada kode `wren-ui` (frontend) dan/atau `wren-ai-service` (backend). Dalam mode ini, kedua service tersebut berjalan secara lokal di mesin Anda, sementara dependensi lainnya berjalan di dalam kontainer Docker.

**Prasyarat:** Pastikan Anda telah menyelesaikan semua langkah di Bab 3, termasuk instalasi dan konfigurasi awal.

**Langkah-langkah Menjalankan:**

1.  **Menjalankan Service Pendukung (via Docker):**
    *   Buka terminal dan navigasikan ke direktori pusat `docker/`.
    *   Edit file `docker/docker-compose-dev.yaml` dan pastikan service yang ingin Anda jalankan secara lokal (`wren-ai-service` dan `wren-ui`) telah dinonaktifkan dengan cara memberikan komentar (`#`) pada seluruh blok service tersebut. `wren-ui` secara default sudah tidak ada di file ini.
    *   Jalankan perintah berikut untuk menyalakan semua service pendukung (seperti Qdrant dan Ibis) di latar belakang:
        ```bash
        docker-compose -f docker-compose-dev.yaml --env-file .env.local up -d
        ```
    *   **Verifikasi:** Jalankan `docker ps`. Anda seharusnya melihat kontainer untuk `qdrant` dan `ibis-server`, tetapi **tidak ada** kontainer untuk `wren-ui` atau `wren-ai-service`.

2.  **Menjalankan Backend (`wren-ai-service`) Lokal:**
    *   Buka **terminal baru** (Terminal 1).
    *   Navigasikan ke direktori `wren-ai-service/`.
    *   Instal dependensi jika ini pertama kalinya: `poetry install`.
    *   Jalankan backend:
        ```bash
        just start
        ```    *   Biarkan terminal ini berjalan. Anda akan melihat log dari service AI di sini.

3.  **Menjalankan Frontend (`wren-ui`) Lokal:**
    *   Buka **terminal baru lainnya** (Terminal 2).
    *   Navigasikan ke direktori `wren-ui/`.
    *   Instal dependensi jika ini pertama kalinya: `yarn install`.
    *   Buat atau migrasikan database UI: `yarn migrate`. (Lakukan ini setiap kali Anda ingin me-reset konfigurasi proyek).
    *   Jalankan frontend:
        ```bash
        # Untuk Windows (Command Prompt)
        set NEXT_PUBLIC_OTHER_SERVICE_USING_DOCKER=true && yarn dev

        # Untuk macOS / Linux / Git Bash di Windows
        NEXT_PUBLIC_OTHER_SERVICE_USING_DOCKER=true yarn dev
        ```        Variabel `NEXT_PUBLIC_OTHER_SERVICE_USING_DOCKER` sangat penting untuk mengaktifkan logika "penerjemah alamat" jaringan di mode hybrid.
    *   Biarkan terminal ini berjalan. Anda akan melihat log kompilasi dari Next.js di sini.

4.  **Akses Aplikasi:** Buka browser dan kunjungi `http://localhost:3000`.

**Cara Menghentikan:**
1.  Tekan `Ctrl + C` di Terminal 1 dan Terminal 2.
2.  Di direktori `docker/`, jalankan `docker-compose -f docker-compose-dev.yaml down`.

---

#### **4.2 Mode Produksi (Full Docker)**

Mode ini mensimulasikan bagaimana aplikasi akan berjalan saat di-*deploy*. Semua service, termasuk `wren-ui` dan `wren-ai-service`, dibangun menjadi *image* Docker dan dijalankan sebagai kontainer. Gunakan mode ini untuk pengujian akhir atau saat Anda tidak perlu mengedit kode.

**Langkah-langkah Menjalankan:**

1.  **Membangun Image Docker Lokal:**
    *   Langkah ini hanya perlu dilakukan sekali, atau setiap kali Anda membuat perubahan signifikan pada kode sumber.
    *   Buka terminal dan navigasikan ke direktori `docker/`.
    *   Pastikan file `docker/docker-compose.yaml` telah dimodifikasi untuk `build` dari sumber lokal, bukan `pull` dari *image registry* (lihat Bab 7).
    *   Jalankan perintah build. Ini mungkin memakan waktu beberapa menit.
        ```bash
        docker-compose -f docker-compose.yaml build
        ```

2.  **Menjalankan Semua Kontainer:**
    *   Setelah proses build selesai, jalankan seluruh tumpukan aplikasi dengan perintah berikut:
        ```bash
        docker-compose -f docker-compose.yaml up -d
        ```

3.  **Akses Aplikasi:** Buka browser dan kunjungi `http://localhost:3000` (atau port yang Anda definisikan sebagai `HOST_PORT` di file `.env.local`).

**Cara Menghentikan:**
*   Di direktori `docker/`, jalankan `docker-compose -f docker-compose.yaml down`.
---

### **Bab 5: Konfigurasi Detail & Penyimpanan Data**

Bab ini merinci semua file dan variabel konfigurasi yang mengontrol perilaku aplikasi, serta menjelaskan di mana data persisten disimpan.

#### **5.1 Variabel Lingkungan (`docker/.env.local`)**

File ini digunakan untuk menyimpan nilai-nilai sensitif (seperti kunci API) dan konfigurasi tingkat tinggi yang mungkin berbeda antar lingkungan. File ini dibaca oleh Docker Compose dan service-service lainnya saat startup.

Variabel paling penting yang harus diatur adalah:

*   **`DEEPSEEK_API_KEY`**
    *   **Fungsi:** Kunci API untuk layanan LLM DeepSeek. Wajib diisi agar AI bisa berfungsi.
    *   **Contoh:** `dk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

*   **`OPENAI_API_KEY`**
    *   **Fungsi:** Kunci API untuk layanan OpenAI. Saat ini, ini wajib diisi karena proyek menggunakan model *embedding* dari OpenAI untuk mengubah teks menjadi vektor.
    *   **Contoh:** `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

*   **`HOST_PORT`**
    *   **Fungsi:** Mendefinisikan port di mesin *host* (komputer Anda) yang akan dipetakan ke port internal `3000` dari kontainer `wren-ui` saat berjalan dalam mode produksi.
    *   **Contoh:** `3000` (artinya aplikasi dapat diakses di `http://localhost:3000`).

*   **`NEXT_PUBLIC_OTHER_SERVICE_USING_DOCKER`**
    *   **Fungsi:** Berfungsi sebagai "saklar" untuk mode development *hybrid*. Jika diatur ke `true`, ini akan mengaktifkan logika khusus di dalam `wren-ui` untuk menangani komunikasi jaringan antara mesin lokal dan kontainer Docker.
    *   **Nilai:** `true` untuk development, biarkan kosong atau atur ke `false` untuk produksi.

#### **5.2 File Konfigurasi AI Service (`docker/config.yaml`)**

File ini adalah pusat kendali utama untuk `wren-ai-service`. File ini mendefinisikan komponen apa yang digunakan, model mana yang dipilih untuk tugas tertentu, dan bagaimana pipeline AI harus berperilaku.

Struktur utamanya adalah sebagai berikut:

*   **`llm` (Large Language Model)**
    *   **Fungsi:** Mendefinisikan LLM yang tersedia. Proyek ini dikonfigurasi untuk menggunakan `litellm_llm` sebagai *provider*, yang memungkinkannya memanggil berbagai model, termasuk DeepSeek.
    *   **Konfigurasi Kunci:** `api_base`, `model` (misalnya, `deepseek/deepseek-coder`).

*   **`embedder`**
    *   **Fungsi:** Mendefinisikan model yang digunakan untuk *embedding* (mengubah teks menjadi vektor). Saat ini menggunakan `litellm_embedder` untuk memanggil model `text-embedding-3-large` dari OpenAI.
    *   **Konfigurasi Kunci:** `model`, `api_base`.

*   **`engine`**
    *   **Fungsi:** Mendefinisikan koneksi ke service yang bisa mengeksekusi SQL, yaitu `wren_ui` (backend Next.js) dan `wren_ibis` (`ibis-server`).
    *   **Konfigurasi Kunci:** `endpoint`. Nilai ini harus disesuaikan antara mode dev (`http://localhost:xxxx`) dan prod (`http://nama-service:xxxx`).

*   **`document_store`**
    *   **Fungsi:** Mendefinisikan koneksi ke *vector database*.
    *   **Konfigurasi Kunci:** `provider` (`qdrant`), `location` (alamat server Qdrant), `embedding_model_dim` (dimensi vektor dari model embedder).

*   **`pipeline`**
    *   **Fungsi:** Bagian paling penting. Ini adalah serangkaian "resep" yang memberitahu AI service model dan komponen mana yang harus digunakan untuk setiap tugas spesifik (misalnya, `sql_generation` harus menggunakan `litellm_llm.default`, sedangkan `sql_answer` menggunakan `litellm_llm.deepseek/deepseek-chat`).

*   **`settings`**
    *   **Fungsi:** Berisi berbagai pengaturan operasional untuk AI service, seperti `logging_level`, `development` mode, `query_cache_ttl`, dll.

#### **5.3 Lokasi Penyimpanan Data (Memori Aplikasi)**

Data persisten (data yang tidak hilang saat aplikasi di-restart) disimpan di dua lokasi utama:

1.  **Database Aplikasi (`wren-ui/db.sqlite3`)**
    *   **Fungsi:** Menyimpan semua konfigurasi dan entitas yang dibuat melalui antarmuka pengguna. Ini termasuk detail koneksi database, definisi model dan relasi (Semantic Layer), histori chat, dan pengaturan proyek.
    *   **Teknologi:** SQLite.
    *   **Manajemen:** File ini dibuat dan diperbarui oleh `wren-ui` melalui migrasi Knex (`yarn migrate`). Menghapus file ini secara efektif akan me-reset proyek ke kondisi awal.
    *   **Mode Produksi:** Dalam mode produksi Docker, file ini disimpan di dalam *volume* Docker bernama `data` agar tidak hilang saat kontainer diperbarui.

2.  **Vector Store (Volume Docker `qdrant`)**
    *   **Fungsi:** Menyimpan "memori" atau pengetahuan yang telah diproses untuk AI. Ini BUKAN data mentah dari database Anda, melainkan *embeddings* (vektor) dari metadata skema Anda (nama tabel/kolom) dan contoh-contoh lain yang dapat dicari.
    *   **Teknologi:** Qdrant.
    *   **Manajemen:** Dikelola sepenuhnya oleh kontainer `qdrant`. Datanya disimpan di dalam *volume* Docker `data` untuk persistensi. Proses "indexing" adalah saat `wren-ai-service` membaca skema Anda dan mengisi database Qdrant ini.

---

### **Bab 6: Panduan Struktur Kode & Komponen Kunci**

Bab ini membedah struktur direktori proyek untuk memberikan pemahaman mendalam tentang lokasi fungsionalitas utama dan bagaimana berbagai komponen saling terhubung.

#### **6.1 Struktur Direktori Tingkat Atas**

Proyek ini terorganisir ke dalam beberapa direktori utama di tingkat akar:

*   **`wren-ui/`**: Berisi semua kode untuk antarmuka pengguna (frontend) dan server GraphQL-nya. Ini adalah aplikasi Next.js.
*   **`wren-ai-service/`**: Berisi semua kode untuk service AI utama (backend). Ini adalah aplikasi FastAPI (Python).
*   **`docker/`**: Berisi semua file yang berkaitan dengan orkestrasi kontainer (Docker Compose) dan file konfigurasi terpusat (`config.yaml`, `.env`).
*   **`deployment/`**: Berisi file-file konfigurasi untuk *deployment* ke lingkungan Kubernetes.

#### **6.2 Fokus pada `wren-ui` (Frontend & BFF)**

Direktori ini berisi aplikasi Next.js yang berfungsi ganda: sebagai frontend yang dirender di browser dan sebagai server backend-for-frontend (BFF) yang menangani logika bisnis UI melalui API GraphQL.

*   **`src/pages/`**
    *   **Fungsi:** Titik masuk (entrypoint) untuk setiap halaman aplikasi. Struktur folder di sini secara langsung memetakan ke rute URL.
    *   **File Kunci:**
        *   `setup/connection.tsx`: Halaman untuk proses onboarding dan koneksi ke sumber data.
        *   `home/[id].tsx`: Halaman utama yang menampilkan hasil chat dan prompt.
        *   `api/graphql.ts`: Endpoint API GraphQL yang menjadi gerbang untuk semua komunikasi data internal UI.

*   **`src/components/`**
    *   **Fungsi:** Berisi komponen-komponen React yang dapat digunakan kembali di seluruh aplikasi.
    *   **Sub-direktori Penting:**
        *   `modals/`: Berisi definisi untuk semua jendela modal, seperti `QuestionSQLPairModal.tsx`.
        *   `sidebar/`: Berisi logika dan tampilan untuk sidebar, termasuk `index.tsx`, `Home.tsx`, dan `Modeling.tsx`.
        *   `pages/`: Berisi komponen-komponen besar yang spesifik untuk halaman tertentu.
    *   **File Kunci:** `HeaderBar.tsx`, `Logo.tsx`.

*   **`src/apollo/`**
    *   **Fungsi:** Ini adalah jantung dari server BFF. Semua logika sisi server dari aplikasi `wren-ui` berada di sini.
    *   **Sub-direktori Penting:**
        *   `server/resolvers/`: Menerima permintaan GraphQL dan memanggil *service* yang sesuai.
        *   `server/services/`: Berisi logika bisnis utama (misalnya, `ProjectService` mengelola pembuatan proyek).
        *   `server/repositories/`: Bertanggung jawab untuk interaksi langsung dengan database aplikasi (`db.sqlite3`).
        *   `server/adaptors/`: **Sangat Penting.** Berfungsi sebagai "penerjemah" atau klien untuk berkomunikasi dengan service eksternal lainnya.
            *   `ibisAdaptor.ts`: Mengirim permintaan ke `ibis-server` untuk validasi dan eksekusi SQL. **Di sinilah logika penerjemahan alamat `localhost` ke `host.docker.internal` berada.**
            *   `wrenAIAdaptor.ts`: Mengirim permintaan ke `wren-ai-service`.

*   **`src/utils/`**
    *   **Fungsi:** Berisi fungsi pembantu (helpers), konstanta, dan validator.
    *   **File Kunci:** `validator/hostValidator.ts`, `env.ts`.

#### **6.3 Fokus pada `wren-ai-service` (Backend AI)**

Direktori ini berisi aplikasi Python dengan FastAPI yang berfungsi sebagai otak dari sistem GenBI.

*   **`src/__main__.py`**
    *   **Fungsi:** Titik masuk utama aplikasi. Bertanggung jawab untuk menginisialisasi dan menjalankan server web Uvicorn. File ini telah dimodifikasi untuk menangani kompatibilitas `uvloop` di Windows.

*   **`src/web/`**
    *   **Fungsi:** Mendefinisikan semua rute API (endpoints) dari service ini. `wren-ui` dan service lain berkomunikasi dengan `wren-ai-service` melalui rute-rute yang didefinisikan di sini.

*   **`src/pipelines/`**
    *   **Fungsi:** **Otak sebenarnya dari AI.** Setiap sub-direktori di sini mendefinisikan sebuah "pipeline" atau alur kerja untuk tugas tertentu. Sebuah pipeline adalah urutan langkah-langkah yang harus dijalankan.
    *   **Sub-direktori Penting:**
        *   `generation/`: Berisi logika untuk semua tugas yang melibatkan LLM, seperti `sql_generation.py`, `sql_correction.py`, dan `chart_generation.py`.
        *   `indexing/`: Berisi logika untuk memproses dan mengirim metadata skema ke Qdrant.
        *   `retrieval/`: Berisi logika untuk mengambil informasi yang relevan dari Qdrant.

*   **`src/providers/`**
    *   **Fungsi:** Berisi "konektor" ke layanan pihak ketiga. Ini adalah implementasi konkret tentang bagaimana pipeline berinteraksi dengan dunia luar.
    *   **Sub-direktori Penting:**
        *   `llm/`: Konektor ke LLM (misalnya, `litellm.py` untuk memanggil DeepSeek).
        *   `document_store/`: Konektor ke vector store (`qdrant.py`).
        *   `engine/`: Konektor ke SQL engine (`wren.py` untuk berinteraksi dengan `ibis-server`).

#### **6.4 Fokus pada `docker/` (Orkestrasi & Konfigurasi)**

Direktori ini adalah pusat kendali untuk menjalankan seluruh tumpukan aplikasi.

*   **`docker-compose.yaml`**: File orkestrasi untuk mode **produksi**. Mendefinisikan semua service dan bagaimana mereka terhubung. Telah dimodifikasi untuk `build` image `wren-ui` dan `wren-ai-service` dari sumber lokal.
*   **`docker-compose-dev.yaml`**: File orkestrasi untuk mode **development**. Didesain untuk menjalankan hanya service pendukung.
*   **`config.yaml`**: File konfigurasi *runtime* utama untuk `wren-ai-service`.
*   **`.env.example` / `.env.local`**: Template dan file sebenarnya untuk menyimpan rahasia dan variabel lingkungan.

---

### **Bab 7: Panduan Kustomisasi & Modifikasi Penting**

Bab ini merangkum perubahan-perubahan kunci yang telah diimplementasikan pada basis kode asli WrenAI untuk menciptakan versi VisiAI. Ini berfungsi sebagai panduan dan justifikasi untuk modifikasi yang telah dibuat.

#### **7.1 Rebranding & Penyederhanaan Antarmuka Pengguna (UI)**

Serangkaian perubahan telah dilakukan untuk menyesuaikan tampilan dan nuansa aplikasi serta untuk menyederhanakan pengalaman pengguna.

*   **Penggantian Aset Logo:**
    *   **Lokasi:** File-file logo SVG di `wren-ui/public/images/` telah diganti.
    *   **Modifikasi Terkait:** Properti `size` dan `color` yang tidak terpakai telah dihapus dari pemanggilan komponen `<Logo />` di seluruh aplikasi (misalnya, di `QuestionSQLPairModal.tsx` dan `EmptyDashboard.tsx`) untuk mengatasi error build `no-unused-vars` dan menyederhanakan komponen `Logo.tsx`.

*   **Penghapusan Tautan Eksternal:**
    *   **Lokasi:** `wren-ui/src/components/sidebar/index.tsx`.
    *   **Perubahan:** Tombol tautan ke Discord dan GitHub telah dihapus dari sidebar utama. Sebagai gantinya, sebuah `div` kosong dengan tinggi tetap ditambahkan untuk menjaga posisi vertikal tombol "Settings".

*   **Penyederhanaan Menu "Learning":**
    *   **Lokasi:** `wren-ui/src/components/learning/index.tsx`.
    *   **Perubahan:** Item menu yang tidak relevan ("View full SQL", "Export to Excel/Sheets", dll.) telah dihapus dari array `home` dan `modeling` di dalam fungsi `getData` untuk memfokuskan panduan pada fungsionalitas inti.

#### **7.2 Penyesuaian Jaringan untuk Mode Development Hybrid**

Modifikasi paling signifikan adalah untuk memungkinkan alur kerja pengembangan *hybrid* yang andal, di mana `wren-ui` dan `wren-ai-service` berjalan secara lokal sementara dependensi lainnya berjalan di Docker.

*   **Implementasi "Penerjemah Alamat Cerdas":**
    *   **Lokasi:** `wren-ui/src/apollo/server/adaptors/ibisAdaptor.ts`.
    *   **Perubahan:** Fungsi `updateConnectionInfo` telah dimodifikasi secara signifikan. Sekarang, jika mode development aktif (`NEXT_PUBLIC_OTHER_SERVICE_USING_DOCKER=true`), fungsi ini akan secara otomatis mengubah `host` koneksi dari `localhost` atau `127.0.0.1` menjadi `host.docker.internal` sebelum mengirimkannya ke `ibis-server`. Ini memungkinkan `ibis-server` (di dalam Docker) untuk terhubung kembali ke database yang berjalan di mesin *host*.

*   **Relaksasi Aturan Validator Host:**
    *   **Lokasi:** `wren-ui/src/utils/validator/hostValidator.ts`.
    *   **Perubahan:** Aturan yang secara eksplisit melarang penggunaan `localhost` atau `127.0.0.1` telah dihapus. Ini memungkinkan pengguna untuk memasukkan alamat `localhost` saat setup di mode development.

#### **7.3 Perbaikan Kompatibilitas Lintas-Platform (Windows)**

Beberapa perbaikan spesifik telah diimplementasikan untuk memastikan aplikasi dapat berjalan dengan lancar di sistem operasi Windows.

*   **Penanganan `uvloop` di `wren-ai-service`:**
    *   **Lokasi:** `wren-ai-service/src/__main__.py`.
    *   **Perubahan:** Logika startup server Uvicorn telah dimodifikasi. Sekarang ia memeriksa sistem operasi; jika berjalan di Windows (`win32`), ia akan secara eksplisit menggunakan `loop="asyncio"` dan `http="auto"`, karena `uvloop` dan `httptools` tidak didukung.

*   **Penanganan Encoding File (`UnicodeDecodeError`):**
    *   **Lokasi:** `wren-ui/src/pipelines/generation/chart_generation.py`.
    *   **Perubahan:** Saat membuka file skema JSON (`vega-lite-schema-v5.json`), parameter `encoding="utf-8"` telah ditambahkan secara eksplisit. Ini mencegah Windows menggunakan *encoding default* yang salah (`cp1252`) dan memastikan file dibaca dengan benar.

#### **7.4 Konfigurasi Build Produksi Lokal**

Untuk memungkinkan pembuatan *image* Docker yang mandiri dan tidak bergantung pada *registry* eksternal.

*   **Modifikasi `docker-compose.yaml`:**
    *   **Lokasi:** `docker/docker-compose.yaml`.
    *   **Perubahan:** Instruksi `image:` untuk service `wren-ui` dan `wren-ai-service` telah diganti dengan instruksi `build:`. Ini memberitahu Docker Compose untuk membangun *image* dari `Dockerfile` lokal di direktori masing-masing.

*   **Penanganan Akhir Baris (`CRLF`) saat Build:**
    *   **Lokasi:** `wren-ui/Dockerfile`.
    *   **Perubahan:** Sebuah langkah `RUN yarn prettier --write .` telah ditambahkan sebelum langkah `RUN yarn build`. Ini secara otomatis memperbaiki masalah format akhir baris file (CRLF dari Windows menjadi LF untuk Linux) di dalam lingkungan build, menyelesaikan error dari Prettier.

---

### **Bab 8: Pemecahan Masalah (Troubleshooting)**

Bab ini berisi daftar error umum yang mungkin ditemui selama proses instalasi dan pengembangan, beserta solusi yang telah terbukti berhasil.

#### **8.1 Error: Koneksi Ditolak ke Database MySQL**

*   **Gejala:** Saat melakukan setup koneksi database, Anda menerima error yang mirip dengan `Can't connect to MySQL server on 'host.docker.internal' (101)` atau `(2002)`. Error ini muncul setelah kode berhasil menerjemahkan `localhost` menjadi `host.docker.internal`, tetapi koneksi sebenarnya gagal.
*   **Penyebab Inti:** Ada sesuatu di mesin *host* (Windows) yang memblokir koneksi masuk dari jaringan Docker. Ada dua penyebab utama:
    1.  **Windows Defender Firewall:** Secara default, firewall memblokir koneksi masuk ke port `3306` (port MySQL) dari jaringan eksternal atau virtual.
    2.  **Konfigurasi MySQL `bind-address`:** Secara default, MySQL sering kali dikonfigurasi untuk hanya menerima koneksi dari `127.0.0.1` (dirinya sendiri) dan menolak koneksi dari alamat IP jaringan lain, termasuk yang digunakan oleh Docker.
*   **Solusi:**
    1.  **Buat Aturan Firewall Baru:** Buka "Windows Defender Firewall with Advanced Security", buat "Inbound Rule" baru untuk **Port**, pilih **TCP**, dan masukkan port spesifik **`3306`**. Izinkan koneksi (`Allow the connection`) untuk semua profil jaringan (Domain, Private, Public).
    2.  **Ubah `bind-address` MySQL:**
        *   Temukan dan buka file konfigurasi MySQL Anda (biasanya `my.ini` di `C:\ProgramData\MySQL\MySQL Server X.X\`).
        *   Cari baris yang berisi `bind-address`.
        *   Ubah nilainya dari `127.0.0.1` menjadi `0.0.0.0`.
        *   **Sangat Penting:** Restart service MySQL melalui `services.msc` agar perubahan ini diterapkan.

#### **8.2 Error: `no such table: <nama_tabel>` di `wren-ui`**

*   **Gejala:** Saat menjalankan `yarn dev` atau saat berinteraksi dengan UI, Anda mendapatkan `SqliteError` yang menyatakan sebuah tabel (seperti `thread_response` atau `dashboard`) tidak ditemukan.
*   **Penyebab Inti:** Database aplikasi frontend (`db.sqlite3`) tidak lengkap atau korup. Ini biasanya terjadi jika proses migrasi (`yarn migrate`) tidak berjalan dengan sempurna atau terputus.
*   **Solusi (Reset Database UI):**
    1.  Hentikan server `wren-ui` (`Ctrl + C` di terminal).
    2.  Navigasikan ke direktori `wren-ui/`.
    3.  Hapus file database yang bermasalah: `del db.sqlite3` (untuk Windows) atau `rm db.sqlite3` (untuk macOS/Linux).
    4.  Jalankan kembali proses migrasi untuk membuat database yang baru dan bersih: `yarn migrate`.
    5.  Mulai ulang server: `yarn dev`.

#### **8.3 Error: `Delete ␍` atau `prettier/prettier` saat `docker-compose build`**

*   **Gejala:** Proses `yarn build` di dalam Dockerfile `wren-ui` gagal dengan error yang menyebutkan karakter `␍` atau `CRLF`.
*   **Penyebab Inti:** Perbedaan format akhir baris antara Windows (CRLF) dan Linux/Docker (LF). Prettier, sebagai linter, menolak format CRLF.
*   **Solusi:**
    *   **Metode Utama (Perbaikan di Dockerfile):** Edit file `wren-ui/Dockerfile` dan tambahkan baris `RUN yarn prettier --write .` tepat sebelum baris `RUN yarn build`. Ini akan secara otomatis memperbaiki format file di dalam lingkungan build.
    *   **Metode Pencegahan (Konfigurasi Lokal):**
        1.  Atur Git untuk menangani akhir baris secara otomatis: `git config --global core.autocrlf true`.
        2.  Atur editor kode Anda (misalnya, VS Code) untuk menggunakan `\n` (LF) sebagai format akhir baris default ("Files: Eol").

#### **8.4 Error: `no-unused-vars` atau `Property 'x' does not exist` saat `docker-compose build`**

*   **Gejala:** Proses `yarn build` gagal dengan error dari ESLint atau TypeScript yang menyatakan sebuah variabel diimpor tetapi tidak digunakan, atau Anda mencoba menggunakan properti pada komponen yang sudah tidak ada lagi.
*   **Penyebab Inti:** Ini adalah efek samping dari proses *rebranding* dan penyederhanaan. Kita telah menghapus elemen UI yang menggunakan variabel atau properti tertentu, tetapi lupa menghapus baris `import`-nya atau pemanggilan propertinya.
*   **Solusi:**
    1.  Baca pesan error dengan teliti untuk mengidentifikasi **nama file** dan **nama variabel/properti** yang bermasalah.
    2.  Buka file tersebut.
    3.  **Jika error `no-unused-vars`:** Hapus baris `import` untuk variabel yang disebutkan.
    4.  **Jika error `Property does not exist`:** Temukan di mana komponen tersebut dipanggil dan hapus properti yang salah dari pemanggilannya (misalnya, ubah `<Logo size={16} />` menjadi `<Logo />`).

#### **8.5 Error: `ModuleNotFoundError: No module named 'uvloop'` di `wren-ai-service`**

*   **Gejala:** Saat menjalankan `just start` di Windows, aplikasi Python gagal dimulai dengan error yang menyatakan `uvloop` tidak ditemukan.
*   **Penyebab Inti:** `uvloop` adalah *event loop* berkinerja tinggi yang tidak didukung di Windows. Aplikasi secara default mencoba menggunakannya.
*   **Solusi:**
    *   Edit file `wren-ai-service/src/__main__.py`.
    *   Ubah blok startup Uvicorn di bagian bawah untuk memeriksa sistem operasi dan secara kondisional menggunakan `loop="asyncio"` untuk Windows, dan `loop="uvloop"` untuk yang lain. (Lihat Bab 7 untuk kode pastinya).
