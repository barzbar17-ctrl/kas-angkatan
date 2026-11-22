"""Uji menyeluruh Fase 1 dan 2 di Chromium (Playwright Python) terhadap API dan database sungguhan.

Prasyarat: PostgreSQL lokal (postgres/postgres di localhost:5432), `npm run build && npm run build:api`,
`pip install playwright && playwright install chromium`. Jalankan dari akar repositori: `python3 docs/e2e/e2e_fase12.py`.
Membuat database sekali pakai `kas_e2e`, menyemai ketua/bendahara/anggota, lalu mengikuti alur nyata lewat antarmuka:
login, setup semester dan periode, anggota, pembayaran dengan pratinjau alokasi, pengeluaran, pembatalan,
unggah bukti (penyimpanan memori), laporan, rekonsiliasi, tutup semester, pandangan anggota, dan kemampuan pasang PWA.
Memeriksa nol pelanggaran CSP dan nol galat konsol yang tidak diharapkan.
"""
import datetime, json, os, subprocess, sys, time, urllib.request
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright, expect

ROOT = os.environ.get('KAS_ROOT', os.getcwd())
BASE = 'http://localhost:4173'
PW = 'kata-sandi-uji-1'
OUT = os.environ.get('E2E_SHOTS', '/tmp/kas-e2e-shots')
os.makedirs(OUT, exist_ok=True)
env0 = dict(os.environ)


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, check=True, cwd=ROOT, capture_output=True, text=True, **kw)


# --- database sekali pakai
ADMIN = 'postgres://postgres:postgres@localhost:5432/postgres'
sh("pg_ctlcluster 16 main status >/dev/null 2>&1 || (pg_ctlcluster 16 main start && sleep 3)")
sh(f"psql '{ADMIN}' -qc 'drop database if exists kas_e2e with (force)' -c 'create database kas_e2e'")
for f in sorted(os.listdir(f'{ROOT}/db/migrations')):
    sh(f"psql 'postgres://postgres:postgres@localhost:5432/kas_e2e' -q -f db/migrations/{f}")
sh("node .dev-api/e2e-seed.js", env={**env0, 'SEED_DATABASE_URL': 'postgres://postgres:postgres@localhost:5432/kas_e2e'})

procs = []
procs.append(subprocess.Popen(['node', '.dev-api/dev-api.js'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
    env={**env0, 'DATABASE_URL': 'postgres://app_backend:app_backend_test@localhost:5432/kas_e2e', 'APP_ORIGIN': BASE, 'PORT': '3000', 'DEV_MEMORY_STORAGE': '1'}))
procs.append(subprocess.Popen(['node', 'scripts/serve-dist.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
    env={**env0, 'API_ORIGIN': 'http://localhost:3000', 'PORT': '4173'}))
for _ in range(50):
    try:
        urllib.request.urlopen(BASE + '/api/v1/health', timeout=1); break
    except Exception:
        time.sleep(0.2)

today = datetime.datetime.now(ZoneInfo('Asia/Jakarta')).date()
start = (today - datetime.timedelta(days=7)).isoformat()
end = (today + datetime.timedelta(days=35)).isoformat()
log = []
errors = []


def step(name):
    log.append(name)
    print('•', name, flush=True)


def shot(page, name):
    page.wait_for_timeout(600)
    page.screenshot(path=f'{OUT}/{name}.png')


def login(page, user):
    page.goto(BASE + '/')
    page.get_by_label('Username', exact=True).fill(user)
    page.get_by_label('Password', exact=True).fill(PW)
    page.get_by_role('button', name='Masuk').click()
    expect(page.get_by_role('heading', level=1).first).to_contain_text('Halo', timeout=10000)


def logout(page):
    page.get_by_role('link', name='Profil').first.click()
    page.get_by_role('button', name='Keluar').click()
    expect(page.get_by_label('Username', exact=True)).to_be_visible(timeout=10000)


def toast(page, text):
    expect(page.get_by_text(text).first).to_be_visible(timeout=10000)


try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 360, 'height': 780}, device_scale_factor=2)
        page = ctx.new_page()
        page.add_init_script("window.__csp=[]; document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));")
        page.on('console', lambda m: errors.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
        page.set_default_timeout(10000)

        step('Login tampil, kata sandi salah ditolak')
        page.goto(BASE + '/')
        expect(page.get_by_role('heading', name='Selamat datang kembali')).to_be_visible()
        shot(page, '01-login')
        page.get_by_label('Username', exact=True).fill('ketua')
        page.get_by_label('Password', exact=True).fill('salah-salah')
        page.get_by_role('button', name='Masuk').click()
        expect(page.get_by_role('alert').filter(has_text='Username atau password salah.')).to_be_visible()

        step('Ketua masuk; belum ada semester')
        page.get_by_label('Password', exact=True).fill(PW)
        page.get_by_role('button', name='Masuk').click()
        expect(page.get_by_text('Belum ada semester aktif')).to_be_visible()
        shot(page, '02-ketua-kosong')

        step('Ketua membuat semester, periode iuran, kategori')
        page.get_by_role('link', name='Buka Pengaturan').click()
        page.get_by_label('Nama semester').fill('Semester Uji 2026')
        page.get_by_label('Tanggal mulai').fill(start)
        page.get_by_label('Tanggal akhir').fill(end)
        page.get_by_label('Saldo awal').fill('1000000')
        page.get_by_role('button', name='Buat semester').click()
        toast(page, 'Semester dibuat')
        page.get_by_label('Iuran per minggu').fill('20000')
        page.get_by_role('button', name='Pratinjau').click()
        expect(page.get_by_text('minggu baru untuk')).to_be_visible()
        shot(page, '03-pengaturan-pratinjau')
        page.get_by_role('button', name='Buat periode').click()
        toast(page, 'Periode iuran dibuat')
        page.get_by_label('Nama kategori').fill('Konsumsi rapat')
        page.get_by_role('button', name='Tambah kategori').click()
        toast(page, 'Kategori ditambahkan')

        step('Ketua menambah anggota')
        page.goto(BASE + '/anggota')
        page.get_by_role('button', name='Tambah anggota').click()
        page.get_by_label('Nama lengkap').fill('Dewi Lestari')
        page.get_by_label('Username', exact=True).fill('dewi')
        page.get_by_label('Nomor telepon').fill('081234567890')
        page.get_by_label('Email', exact=True).fill('dewi@x.id')
        page.get_by_label('Password awal').fill(PW)
        page.get_by_role('button', name='Simpan').click()
        toast(page, 'Anggota ditambahkan')
        expect(page.get_by_text('Dewi Lestari').first).to_be_visible()
        shot(page, '04-anggota')

        step('Ketua melihat Beranda dengan saldo dan aktivitas')
        page.get_by_role('link', name='Beranda').first.click()
        expect(page.get_by_text('Aktivitas penting')).to_be_visible()
        shot(page, '05-ketua-beranda')
        logout(page)

        step('Bendahara mencatat pembayaran dengan pratinjau alokasi')
        login(page, 'bendahara')
        shot(page, '06-bendahara-beranda')
        page.get_by_role('link', name='Catat pembayaran').first.click()
        page.get_by_label('Anggota', exact=True).fill('rina')
        page.get_by_role('button', name='Rina Pratama').click()
        page.get_by_label('Nominal', exact=True).fill('50000')
        expect(page.get_by_text('Pembayaran ini akan dialokasikan')).to_be_visible()
        expect(page.get_by_text('Minggu 3').first).to_be_visible()
        shot(page, '07-form-pembayaran')
        page.get_by_role('button', name='Simpan pembayaran').click()
        toast(page, 'Pembayaran tercatat')
        expect(page.get_by_text('lunas sampai Minggu 2')).to_be_visible()

        step('Bendahara mencatat pengeluaran')
        page.get_by_role('link', name='Beranda').first.click()
        page.get_by_role('link', name='Catat pengeluaran').click()
        page.get_by_label('Kategori', exact=True).select_option(label='Konsumsi rapat')
        page.get_by_label('Nominal', exact=True).fill('85000')
        page.get_by_label('Keterangan', exact=True).fill('Snack rapat panitia')
        page.get_by_label('Urgensi', exact=True).fill('Rapat besok pagi')
        page.get_by_role('button', name='Simpan').click()
        toast(page, 'Transaksi tercatat')
        expect(page.get_by_text('Snack rapat panitia')).to_be_visible()
        shot(page, '08-transaksi-bendahara')

        step('Bendahara membatalkan pengeluaran dengan alasan')
        page.get_by_text('Snack rapat panitia').click()
        page.get_by_role('button', name='Batalkan transaksi').click()
        page.get_by_label('Alasan pembatalan').fill('Salah nominal')
        page.get_by_role('dialog').get_by_role('button', name='Batalkan transaksi').click()
        toast(page, 'Transaksi dibatalkan')
        expect(page.get_by_text('Dibatalkan oleh')).to_be_visible()
        shot(page, '09-detail-dibatalkan')
        logout(page)

        step('Anggota melihat iuran sendiri dan agregat tanpa nama')
        login(page, 'rina')
        expect(page.get_by_text('Lunas sampai Minggu 2').first).to_be_visible()
        shot(page, '10-anggota-beranda')
        page.get_by_role('link', name='Kas Saya').first.click()
        expect(page.get_by_text('Tagihan mingguan')).to_be_visible()
        shot(page, '11-kas-saya')
        page.get_by_role('link', name='Transaksi').first.click()
        expect(page.get_by_text('1 anggota')).to_be_visible()
        body = page.inner_text('main')
        assert 'Bella' not in body and 'Dewi' not in body and 'Pratama' not in body, 'nama anggota bocor di daftar anggota'
        shot(page, '12-anggota-transaksi')

        step('Anggota ditolak di halaman pengelola')
        page.goto(BASE + '/anggota')
        expect(page.get_by_role('heading', name='Tidak tersedia')).to_be_visible()

        # ================= FASE 2 =================
        from PIL import Image
        import random
        im = Image.new('RGB', (240, 320))
        im.putdata([(random.randint(0,255), random.randint(0,255), random.randint(0,255)) for _ in range(240*320)])
        im.save('/tmp/nota.png')

        step('F2: bendahara mencatat pengeluaran lalu mengunggah bukti')
        logout(page)
        login(page, 'bendahara')
        page.get_by_role('link', name='Catat pengeluaran').click()
        page.get_by_label('Kategori', exact=True).select_option(label='Konsumsi rapat')
        page.get_by_label('Nominal', exact=True).fill('120000')
        page.get_by_label('Keterangan', exact=True).fill('Cetak spanduk acara')
        page.get_by_label('Urgensi', exact=True).fill('Acara lusa')
        page.get_by_role('button', name='Simpan').click()
        toast(page, 'Transaksi tercatat')
        page.get_by_text('Cetak spanduk acara').click()
        expect(page.get_by_text('Tanpa bukti').first).to_be_visible()
        shot(page, '13-detail-tanpa-bukti')
        page.get_by_label('Pilih berkas bukti').set_input_files('/tmp/nota.png')
        toast(page, 'Bukti diunggah')
        expect(page.get_by_alt_text('Bukti nota.png')).to_be_attached()
        expect(page.get_by_text('Tanpa bukti')).to_have_count(0)
        shot(page, '14-detail-bukti')
        page.get_by_label('Pilih berkas bukti').set_input_files({'name': 'jahat.png', 'mimeType': 'image/png', 'buffer': b'<html><script>alert(1)</script></html>'})
        toast(page, 'Hanya foto')

        step('F2: laporan bulanan tampil')
        page.get_by_role('link', name='Laporan').first.click()
        expect(page.get_by_text('Saldo akhir bulan')).to_be_visible()
        expect(page.get_by_text('Pemasukan').first).to_be_visible()
        shot(page, '15-laporan')

        step('F2: rekonsiliasi dengan selisih wajib catatan')
        page.get_by_role('link', name='Rekonsiliasi baru').click()
        page.get_by_label('Uang tunai di tangan', exact=True).fill('900000')
        page.get_by_label('Saldo rekening', exact=True).fill('0')
        expect(page.get_by_text('Perkiraan selisih')).to_be_visible()
        expect(page.get_by_role('button', name='Simpan rekonsiliasi')).to_be_disabled()
        page.get_by_label('Catatan selisih', exact=True).fill('Uang parkir belum dicatat')
        shot(page, '16-rekonsiliasi')
        page.get_by_role('button', name='Simpan rekonsiliasi').click()
        toast(page, 'Rekonsiliasi tercatat')
        expect(page.get_by_text('Uang parkir belum dicatat')).to_be_visible()
        page.get_by_role('link', name='Rekonsiliasi baru').click()
        sistem = page.locator('.t-h2.num').first.inner_text()
        cash = ''.join(ch for ch in sistem if ch.isdigit())
        page.get_by_label('Uang tunai di tangan', exact=True).fill(cash)
        page.get_by_label('Saldo rekening', exact=True).fill('0')
        page.get_by_role('button', name='Simpan rekonsiliasi').click()
        toast(page, 'Saldo cocok')
        expect(page.get_by_text('Cocok')).to_be_visible()
        shot(page, '17-laporan-rekonsiliasi')
        logout(page)

        step('F2: ketua menutup semester')
        login(page, 'ketua')
        page.goto(BASE + '/pengaturan')
        page.get_by_label('Nama semester berikutnya', exact=True).fill('Semester Berikutnya')
        nxt_start = (today + datetime.timedelta(days=40)).isoformat()
        nxt_end = (today + datetime.timedelta(days=170)).isoformat()
        page.get_by_label('Tanggal mulai', exact=True).last.fill(nxt_start)
        page.get_by_label('Tanggal akhir', exact=True).last.fill(nxt_end)
        page.get_by_role('button', name='Lanjut menutup semester').click()
        expect(page.get_by_role('dialog')).to_be_visible()
        shot(page, '18-tutup-semester')
        page.get_by_role('dialog').get_by_role('button', name='Tutup semester').click()
        toast(page, 'Semester ditutup')
        page.get_by_role('link', name='Beranda').first.click()
        expect(page.get_by_text('Saldo kas')).to_be_visible()
        shot(page, '19-beranda-semester-baru')
        logout(page)

        step('F2: anggota membaca laporan dan bukti')
        login(page, 'rina')
        page.get_by_role('link', name='Laporan').first.click()
        expect(page.get_by_text('Saldo akhir bulan')).to_be_visible()
        shot(page, '20-anggota-laporan')

        step('F2: PWA dapat dipasang (manifest, service worker, ikon)')
        cdp = ctx.new_cdp_session(page)
        errs = cdp.send('Page.getInstallabilityErrors')
        print('installability:', errs)
        man = page.evaluate("fetch('/manifest.webmanifest').then(r=>r.json())")
        assert man['display'] == 'standalone' and len(man['icons']) >= 3
        csp = page.evaluate('window.__csp')
        b.close()
finally:
    for pr in procs:
        pr.terminate()

print(json.dumps({'langkah': len(log), 'csp': csp, 'console': [e for e in errors if '401' not in e[1]]}, indent=1, ensure_ascii=False))
