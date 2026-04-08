# Finance System Notes - Genio Syariah Hotel

Dokumen ini adalah catatan fungsional Finance System saat ini. Fokusnya menjelaskan apa yang dikerjakan tiap modul, bagaimana alur kerjanya, dan endpoint apa saja yang mendukung UI. Dokumen ini sengaja ditulis rinci supaya bisa dipakai sebagai referensi operasional, QA, dan onboarding.

## 1. Gambaran Besar

Finance System dibangun sebagai pusat kontrol finansial hotel. Area ini memisahkan proses keuangan dari operasional POS, tetapi tetap menerima data transaksi dari POS, folio, cash/bank, dan night audit. Pendekatan yang dipakai adalah full-stack Next.js App Router dengan route handler di server, PostgreSQL sebagai source of truth, dan validasi akses berbasis role + unit.

Prinsip desain utama:
- Semua transaksi finansial penting harus tercatat ke jurnal.
- Data uang disimpan dalam integer/bigint, bukan floating point.
- Akses lintas unit dibatasi di server, bukan hanya di UI.
- Modul finance dibuat saling terhubung, bukan berdiri sendiri.

## 2. Arsitektur & Keamanan

### 2.1 Teknologi

- Frontend: React + TypeScript
- Routing: Next.js App Router
- API: Route Handlers di `app/api/*`
- Database: PostgreSQL
- Query layer: `pg` dengan raw SQL dan transaksi manual
- UI: komponen style shadcn/ui + Tailwind CSS
- State: Zustand

### 2.2 Authentication

Login memverifikasi username dan password terhadap tabel `users`. Setelah valid, server membuat JWT dan menyimpannya sebagai cookie HttpOnly. Ini berarti browser menyimpan sesi, tetapi JavaScript di client tidak bisa membaca token langsung.

Logout menghapus cookie tersebut. Dengan desain ini, semua route protected bisa membaca user session dari request cookie tanpa perlu token di body request.

### 2.3 Authorization

Authorization dilakukan di server menggunakan helper `requireAuth` dan `canAccessUnit`.

Aturan umum:
- Role finance-level boleh masuk area finance.
- Role operasional POS hanya boleh ke route sesuai unit dan peran.
- User tanpa izin unit akan ditolak meskipun tokennya valid.

### 2.4 Audit Trail

Setiap operasi sensitif dicatat ke tabel `audit_logs`. Audit ini penting untuk jejak perubahan master data, posting jurnal, pembatalan charge, perubahan rate, dan proses closing period.

Field audit yang dipakai:
- siapa yang melakukan
- aksi apa yang terjadi
- resource mana yang terpengaruh
- record mana yang berubah
- metadata tambahan yang relevan

## 3. Finance Dashboard

Finance Dashboard adalah landing page finansial hotel. Fungsinya bukan sekadar ringkasan angka, tetapi titik awal untuk melihat kondisi bisnis secara cepat.

Yang ditampilkan:
- Revenue hari ini
- Outstanding AR
- Cash position
- Occupancy
- Grafik tren beberapa hari
- Risiko overdue dan credit alert
- Shortcut ke modul kerja utama

Karakter dashboard:
- Data real-time dari endpoint agregasi khusus
- Tampilan lebih visual dan ringkas
- Bisa difilter per unit, rentang hari, dan tanggal acuan

Tujuan dashboard ini:
- memberi gambaran cepat kondisi hotel
- memandu user finance ke modul yang paling sering dipakai
- jadi pusat navigasi, bukan halaman statis

## 4. Chart of Accounts

Chart of Accounts atau COA adalah master daftar akun akuntansi. Semua transaksi, jurnal, dan posting akan merujuk ke struktur ini.

### 4.1 Fungsi utama

- Menyimpan daftar akun aktif hotel
- Mendukung kategori akun: Asset, Liability, Equity, Revenue, Expense
- Mendukung hierarki parent-child supaya akun bisa dikelompokkan secara logis
- Menyediakan validasi agar akun yang sudah dipakai transaksi tidak dihapus sembarangan

### 4.2 Alur kerja

1. Finance membuka halaman COA.
2. User dapat melihat struktur akun per kategori.
3. User finance bisa menambah akun baru.
4. Akun bisa diubah atau dinonaktifkan sesuai kebutuhan.
5. Penghapusan dilindungi jika akun sudah terhubung ke jurnal atau masih punya anak akun.

### 4.3 Detail behavior

- Parent code menentukan level akun.
- Account type membantu grouping akun di tampilan dan reporting.
- Normal balance dipakai untuk menjaga konsistensi debit/kredit.
- Soft delete dipakai supaya histori transaksi tetap utuh.

### 4.4 Endpoint

- `GET /api/finance/coa`
- `POST /api/finance/coa`
- `PUT /api/finance/coa/[code]`
- `DELETE /api/finance/coa/[code]`

### 4.5 Nilai operasional

COA adalah fondasi. Kalau COA tidak rapi, semua modul lain akan sulit dipetakan ke jurnal dengan benar.

## 5. General Ledger

General Ledger adalah inti pencatatan akuntansi. Di sini transaksi diterjemahkan ke jurnal dan lini jurnal dengan prinsip double-entry.

### 5.1 Fungsi utama

- Membuat jurnal umum manual
- Menjaga keseimbangan debit dan kredit
- Menyusun trial balance per tanggal acuan
- Menegakkan period lock agar posting tidak masuk ke periode tertutup
- Menyimpan metadata sumber transaksi

### 5.2 Struktur data penting

- `journal_entries`: header jurnal
- `journal_lines`: detail debit/kredit per akun
- `fiscal_years`: tahun fiskal
- `accounting_periods`: periode akuntansi

### 5.3 Alur kerja

1. User finance membuka jurnal atau trial balance.
2. Sistem memeriksa apakah period yang dimaksud masih open.
3. Jika transaksi manual dibuat, sistem memvalidasi total debit dan total kredit harus sama.
4. Jurnal disimpan bersama detail line.
5. Trial balance dapat dihitung kapan saja sebagai pemeriksaan saldo.

### 5.4 Kenapa penting

GL adalah sumber kebenaran akuntansi. Semua modul lain pada akhirnya bermuara ke sini: POS, folio, AR, night audit, dan cash/bank.

### 5.5 Endpoint

- `GET /api/finance/general-ledger/trial-balance`
- `POST /api/finance/general-ledger/journals`
- `GET /api/finance/general-ledger/periods`
- `POST /api/finance/general-ledger/periods/[id]/lock`
- `POST /api/finance/general-ledger/periods/[id]/reopen`
- `POST /api/finance/general-ledger/periods/[id]/close`

### 5.6 UI

- Halaman General Ledger menampilkan trial balance.
- User bisa melihat apakah saldo balanced atau tidak.
- Modul period membantu kontrol cut-off akuntansi.

## 6. Cash & Bank

Modul Cash & Bank dipakai untuk mengelola kas dan rekening bank hotel, termasuk kurs dan pencatatan transaksi bank.

### 6.1 Fungsi utama

- Menyimpan rekening bank per unit
- Mendukung mata uang rekening
- Menyimpan exchange rate harian
- Menyediakan fondasi untuk transaksi bank dan rekonsiliasi

### 6.2 Alur kerja

1. User finance menambah bank account untuk unit tertentu.
2. User memasukkan kurs harian jika ada transaksi lintas mata uang.
3. Rekening dapat dipakai sebagai dasar transaksi bank berikutnya.

### 6.3 Mengapa perlu

Hotel sering memiliki lebih dari satu sumber kas: cash, transfer, QRIS, card, dan rekening bank. Modul ini membantu membedakan dan menata posisinya secara akuntansi.

### 6.4 Endpoint

- `GET /api/finance/cash-bank/accounts`
- `POST /api/finance/cash-bank/accounts`
- `GET /api/finance/cash-bank/exchange-rates`
- `POST /api/finance/cash-bank/exchange-rates`

### 6.5 UI

- Tambah rekening bank
- Lihat daftar rekening
- Input kurs harian
- Lihat histori kurs yang sudah dicatat

## 7. Guest Folio

Guest Folio adalah modul untuk mencatat tagihan tamu atau akun city ledger. Modul ini sangat penting untuk hotel karena banyak transaksi non-POS masuknya lewat folio.

### 7.1 Fungsi utama

- Membuat folio tamu
- Menghubungkan data guest ke folio
- Menyimpan nomor reservasi, room number, check-in, check-out, dan room rate
- Posting charge ke folio
- Void charge dengan alasan yang tercatat
- Membuat reversal jurnal otomatis saat charge dibatalkan

### 7.2 Alur kerja

1. User finance membuat folio untuk tamu atau akun tertentu.
2. Saat ada biaya tambahan, charge diposting ke folio.
3. Sistem membuat jurnal debit/credit sesuai mapping akun.
4. Jika charge harus dibatalkan, user melakukan void.
5. Sistem membuat reversal, bukan menghapus histori asli.

### 7.3 Karakter akuntansi

- Posting charge menambah piutang atau tagihan sesuai mapping.
- Pendapatan diakui pada akun yang sesuai jenis charge.
- Void harus traceable dan tidak merusak audit trail.

### 7.4 Endpoint

- `GET /api/finance/folios`
- `POST /api/finance/folios`
- `GET /api/finance/folios/[id]/charges`
- `POST /api/finance/folios/[id]/charges`
- `POST /api/finance/folios/charges/[chargeId]/void`

### 7.5 UI

- Create folio
- List folio aktif
- Detail charge per folio
- Tombol void charge

## 8. Night Audit

Night Audit adalah proses harian untuk menutup business date dan memindahkan aktivitas harian ke siklus akuntansi berikutnya.

### 8.1 Fungsi utama

- Menjalankan audit per unit
- Menutup business date aktif
- Mem-post room rate untuk folio in-house
- Mencegah posting ganda pada tanggal yang sama
- Menyimpan hasil audit agar bisa ditelusuri

### 8.2 Alur kerja

1. User finance membuka halaman Night Audit.
2. Sistem menampilkan business date aktif per unit.
3. User menjalankan audit.
4. Sistem memproses folio yang masih open dan belum dipost.
5. Hasil audit disimpan ke histori.
6. Business date bergeser ke hari berikutnya.

### 8.3 Kenapa penting

Night audit mengamankan cut-off harian hotel. Tanpa proses ini, revenue room dan outstanding harian tidak akan konsisten.

### 8.4 Endpoint

- `GET /api/finance/night-audit`
- `POST /api/finance/night-audit`

### 8.5 UI

- Lihat business date aktif
- Jalankan audit
- Lihat ringkasan hasil
- Cek total room charges dan total folios yang diproses

## 9. Finance Reports

Finance Reports adalah area monitoring dan analisis untuk receivable dan ringkasan finansial operasional.

### 9.1 Fungsi utama

- Menampilkan aging piutang
- Menampilkan overdue invoice
- Menampilkan credit alert
- Menampilkan payment history
- Mengizinkan export CSV untuk kebutuhan operasional
- Menyediakan viewer receipt payment

### 9.2 Isi data yang ditampilkan

- Aging bucket: current, 1-30, 31-60, 61-90, 90+
- Daftar akun yang melewati threshold kredit
- Invoice yang sudah lewat jatuh tempo
- Riwayat pembayaran terbaru
- Receipt payment berdasarkan ID pembayaran

### 9.3 Alur kerja

1. User finance memilih unit dan tanggal acuan.
2. Sistem mengambil data AR terkini.
3. User dapat melihat area yang paling berisiko.
4. Data bisa diekspor ke CSV.
5. Receipt pembayaran bisa dibuka untuk kebutuhan verifikasi.

### 9.4 Endpoint utama

- `GET /api/finance/ar/aging`
- `GET /api/finance/ar/credit-alerts`
- `GET /api/finance/ar/overdue`
- `GET /api/finance/ar/payments`
- `GET /api/finance/ar/payments/[id]/receipt`
- `GET /api/finance/ar/exports/aging`
- `GET /api/finance/ar/exports/overdue`
- `GET /api/finance/ar/exports/payments`

### 9.5 UI

- Filter unit, tanggal, threshold
- KPI AR
- Daftar overdue dan credit alert
- Tombol export CSV
- Receipt viewer

## 10. Struktur Data yang Sudah Aktif

Beberapa tabel finance utama yang sudah dipakai:

- `coa`
- `fiscal_years`
- `accounting_periods`
- `journal_entries`
- `journal_lines`
- `exchange_rates`
- `bank_accounts`
- `bank_transactions`
- `guests`
- `folios`
- `folio_charges`
- `folio_daily_postings`
- `unit_business_dates`
- `night_audits`
- `city_ledger_accounts`
- `invoices`
- `invoice_lines`
- `payments`
- `payment_allocations`
- `audit_logs`

## 11. Cara Finance Dashboard dan Modul Lain Terhubung

Finance Dashboard bukan modul terpisah dari yang lain. Ia membaca ringkasan dari:

- POS revenue untuk angka harian
- GL untuk cash position dan saldo jurnal
- AR untuk outstanding dan overdue
- Folio dan night audit untuk occupancy serta revenue hotel

Jadi dashboard adalah pintu masuk yang mengikat semuanya.

## 12. Catatan Operasional

Hal yang perlu diingat saat memakai sistem ini:

- User demo dipakai untuk pengujian role dan alur.
- Posting ke jurnal harus selalu balance.
- Period closed tidak boleh diposting ulang.
- Void harus meninggalkan jejak audit.
- Semua laporan finance harus dibaca per unit bila konteksnya operasional.

## 13. Ringkasan Singkat per Modul

- Finance Dashboard: pusat pantau KPI dan risiko.
- Chart of Accounts: master struktur akun.
- General Ledger: pencatatan jurnal dan trial balance.
- Cash & Bank: rekening, kas, dan exchange rate.
- Guest Folio: tagihan tamu dan charge posting.
- Night Audit: cut-off harian dan posting room rate.
- Finance Reports: monitoring AR, overdue, export, dan receipt.

---

Dokumen ini akan diperbarui setiap modul finance ditambah agar tetap menjadi referensi tunggal yang konsisten.
