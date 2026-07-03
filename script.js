// ═══════════════════════════════════════════════════════════════
//  FRUITRIPENESS AI × PERSONA 4  —  Frontend Script
//  Tugas Praktikum Pengolahan Citra Digital
// ═══════════════════════════════════════════════════════════════
//  Versi ini panggil Gemini API LANGSUNG dari browser (tanpa
//  backend/server), sehingga bisa di-host di GitHub Pages.
//
//  ⚠  CATATAN KEAMANAN:
//     API key di sini bisa dilihat siapa saja lewat kode sumber.
//     Untuk tugas kuliah dengan key gratis, ini AMAN —
//     lo tidak akan kena tagihan, Google hanya membatasi kuota.
//     Jangan pakai cara ini untuk project komersial.
// ═══════════════════════════════════════════════════════════════


// ──────────────────────────────────────────────────────────────
//  ❶  KONFIGURASI  —  GANTI API KEY DI SINI
// ──────────────────────────────────────────────────────────────
const CONFIG = {
  // ↓ Ganti string ini dengan API key Gemini lo dari aistudio.google.com
  API_KEY: 'AQ.Ab8RN6LmXOQfuD7b1mbO-V7Tp-RBKCyw3hUFd7ISCT9zAZdiaw',

  // Model yang dipakai — gemini-2.0-flash support input gambar (vision)
  // Kalau error "model not found", coba: gemini-1.5-flash
  MODEL: 'gemini-2.0-flash',
};

// Endpoint Gemini (key dikirim lewat query param karena ini direct browser call)
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.API_KEY}`;


// ──────────────────────────────────────────────────────────────
//  ❷  REFERENSI DOM
// ──────────────────────────────────────────────────────────────
const tvFrame      = document.getElementById('tvFrame');
const tvIdle       = document.getElementById('tvIdle');
const tvPreview    = document.getElementById('tvPreview');
const previewImg   = document.getElementById('previewImg');
const removeBtn    = document.getElementById('removeBtn');
const fileInput    = document.getElementById('fileInput');
const validationMsg= document.getElementById('validationMsg');
const analyzeBtn   = document.getElementById('analyzeBtn');

const stateEmpty   = document.getElementById('stateEmpty');
const stateLoading = document.getElementById('stateLoading');
const stateError   = document.getElementById('stateError');
const resultCard   = document.getElementById('resultCard');

const resultFruitName = document.getElementById('resultFruitName');
const rboxMentah      = document.getElementById('rboxMentah');
const rboxMatang      = document.getElementById('rboxMatang');
const rboxOverripe    = document.getElementById('rboxOverripe');
const confValue       = document.getElementById('confValue');
const hpFill          = document.getElementById('hpFill');
const hpProgressBar   = document.getElementById('hpProgressBar');
const traitWarna      = document.getElementById('traitWarna');
const traitTekstur    = document.getElementById('traitTekstur');
const traitBentuk     = document.getElementById('traitBentuk');
const recText         = document.getElementById('recText');
const errorMsg        = document.getElementById('errorMsg');


// ──────────────────────────────────────────────────────────────
//  ❸  STATE
// ──────────────────────────────────────────────────────────────
let selectedFile = null; // file gambar yang sedang dipilih user


// ──────────────────────────────────────────────────────────────
//  ❹  EVENT LISTENERS  —  Upload & Drag-Drop
// ──────────────────────────────────────────────────────────────

// Klik TV frame → buka file picker (kecuali klik di tombol hapus)
tvFrame.addEventListener('click', (e) => {
  if (e.target === removeBtn) return;
  fileInput.click();
});

// Keyboard accessibility: Enter / Space di TV frame → buka picker
tvFrame.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// User pilih file lewat dialog
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFileSelected(file);
});

// Drag over: beri visual cue
tvFrame.addEventListener('dragover', (e) => {
  e.preventDefault();
  tvFrame.classList.add('dragging');
});
tvFrame.addEventListener('dragleave', () => tvFrame.classList.remove('dragging'));
tvFrame.addEventListener('dragend',   () => tvFrame.classList.remove('dragging'));

// Drop file
tvFrame.addEventListener('drop', (e) => {
  e.preventDefault();
  tvFrame.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
});

// Tombol hapus gambar
removeBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // jangan trigger click di tvFrame
  resetImageSelection();
});

// Klik Analisis
analyzeBtn.addEventListener('click', handleAnalyze);


// ──────────────────────────────────────────────────────────────
//  ❺  FUNGSI: HANDLE FILE DIPILIH
// ──────────────────────────────────────────────────────────────
function handleFileSelected(file) {
  // Validasi tipe file (client-side)
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showValidation('FORMAT TIDAK DIDUKUNG — gunakan JPG, PNG, atau WEBP');
    return;
  }

  // Validasi ukuran file (maks 8MB)
  if (file.size > 8 * 1024 * 1024) {
    showValidation('UKURAN TERLALU BESAR — maksimal 8MB');
    return;
  }

  selectedFile = file;
  hideValidation();
  resetResultState(); // reset panel kanan saat gambar diganti

  // Tampilkan preview di "layar TV"
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    tvIdle.hidden    = true;
    tvPreview.hidden = false;
  };
  reader.readAsDataURL(file);
}

function resetImageSelection() {
  selectedFile     = null;
  fileInput.value  = '';
  previewImg.src   = '';
  tvPreview.hidden = true;
  tvIdle.hidden    = false;
  resetResultState();
  hideValidation();
}


// ──────────────────────────────────────────────────────────────
//  ❻  FUNGSI: VALIDASI MESSAGE
// ──────────────────────────────────────────────────────────────
function showValidation(msg) {
  validationMsg.textContent = msg;
  validationMsg.hidden = false;
}
function hideValidation() {
  validationMsg.hidden = true;
}


// ──────────────────────────────────────────────────────────────
//  ❼  FUNGSI: HANDLER ANALISIS
// ──────────────────────────────────────────────────────────────
async function handleAnalyze() {
  // Cek apakah user sudah pilih gambar
  if (!selectedFile) {
    showValidation('PILIH GAMBAR BUAH TERLEBIH DAHULU !');
    tvFrame.focus();
    return;
  }

  // Cek API key sudah diisi (bukan placeholder)
  if (CONFIG.API_KEY === 'MASUKKAN_API_KEY_GEMINI_LO_DI_SINI' || !CONFIG.API_KEY) {
    setErrorState(
      'API Key belum diisi. Buka file script.js, ganti nilai CONFIG.API_KEY dengan key dari aistudio.google.com'
    );
    return;
  }

  hideValidation();
  setLoadingState();
  analyzeBtn.disabled = true;

  try {
    const result = await callGeminiAPI(selectedFile);
    renderResult(result);
  } catch (err) {
    console.error('Error analisis:', err);
    setErrorState(err.message || 'Gagal menghubungi Gemini API. Periksa koneksi atau API key.');
  } finally {
    analyzeBtn.disabled = false;
  }
}


// ──────────────────────────────────────────────────────────────
//  ❽  FUNGSI: PANGGIL GEMINI API
// ──────────────────────────────────────────────────────────────
async function callGeminiAPI(file) {
  // Konversi file gambar ke base64
  const base64 = await fileToBase64(file);

  // Payload request ke Gemini
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: buildPrompt() },
        {
          inline_data: {
            mime_type: file.type,
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.2,                    // rendah = hasil konsisten
      responseMimeType: 'application/json' // minta Gemini balas JSON langsung
    }
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  // Tangani error dari API (contoh: key salah, kuota habis, model tidak ada)
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status} — Gemini API error`;
    throw new Error(msg);
  }

  // Ambil teks respons
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Respons Gemini kosong atau tidak valid.');

  // Parse JSON (bersihkan kemungkinan markdown fence ```json...```)
  let parsed;
  try {
    const cleaned = rawText.replace(/```json|```/gi, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Gagal membaca hasil AI. Coba ulangi analisis.');
  }

  // Kalau Gemini bilang gambarnya bukan buah
  if (parsed.error) throw new Error(parsed.error);

  return parsed;
}


// ──────────────────────────────────────────────────────────────
//  ❾  PROMPT  —  Instruksi ke Gemini Vision
// ──────────────────────────────────────────────────────────────
function buildPrompt() {
  return `
Kamu adalah sistem AI computer vision untuk tugas praktikum Pengolahan Citra Digital.
Tugasmu: analisis gambar buah berdasarkan tiga fitur citra utama:
  1. WARNA    — distribusi dan dominasi warna permukaan buah
  2. TEKSTUR  — kehalusan, kilap, keriput, atau bercak pada kulit
  3. BENTUK   — kebulatan, kekencangan, kondisi fisik buah

Berdasarkan ketiga fitur itu, tentukan tingkat kematangan ke dalam:
"Mentah", "Matang", atau "Terlalu Matang".

Kembalikan HANYA satu objek JSON murni (tanpa markdown, tanpa teks lain):

{
  "jenis_buah": "nama buah dalam Bahasa Indonesia",
  "tingkat_kematangan": "Mentah | Matang | Terlalu Matang",
  "confidence": 85,
  "ciri_visual": {
    "warna": "deskripsi warna dominan (1 kalimat)",
    "tekstur": "deskripsi tekstur permukaan (1 kalimat)",
    "bentuk": "deskripsi bentuk dan kondisi fisik (1 kalimat)"
  },
  "rekomendasi_konsumsi": "saran praktis untuk konsumen (1-2 kalimat)"
}

"confidence" = angka bulat 0–100.
Semua teks dalam Bahasa Indonesia.
Jika gambar BUKAN buah, kembalikan: { "error": "Gambar tidak terdeteksi sebagai buah." }
`.trim();
}


// ──────────────────────────────────────────────────────────────
//  ❿  FUNGSI: RENDER HASIL KE UI
// ──────────────────────────────────────────────────────────────
function renderResult(data) {
  // Nama buah
  resultFruitName.textContent = (data.jenis_buah || 'TIDAK DIKETAHUI').toUpperCase();

  // Ripeness boxes — set yang aktif
  const level = (data.tingkat_kematangan || '').trim().toLowerCase();
  [rboxMentah, rboxMatang, rboxOverripe].forEach(el => el.classList.remove('active'));

  if (level === 'mentah')           rboxMentah.classList.add('active');
  else if (level === 'matang')      rboxMatang.classList.add('active');
  else if (level.includes('matang')) rboxOverripe.classList.add('active'); // "terlalu matang"

  // Confidence HP bar (animasi bar naik setelah frame berikutnya)
  const pct = Math.min(Math.max(Number(data.confidence) || 0, 0), 100);
  confValue.textContent = pct + '%';
  hpProgressBar.setAttribute('aria-valuenow', pct);
  requestAnimationFrame(() => {
    hpFill.style.width = pct + '%';
  });

  // Ciri visual
  const cv = data.ciri_visual || {};
  traitWarna.textContent   = cv.warna   || '-';
  traitTekstur.textContent = cv.tekstur || '-';
  traitBentuk.textContent  = cv.bentuk  || '-';

  // Rekomendasi
  recText.textContent = data.rekomendasi_konsumsi || '-';

  // Tampilkan result card
  showState('result');
}


// ──────────────────────────────────────────────────────────────
//  STATE MANAGEMENT  —  tampil/sembunyikan panel kanan
// ──────────────────────────────────────────────────────────────
function showState(which) {
  stateEmpty.hidden   = which !== 'empty';
  stateLoading.hidden = which !== 'loading';
  stateError.hidden   = which !== 'error';
  resultCard.hidden   = which !== 'result';
}

function setLoadingState()         { showState('loading'); }
function resetResultState()        { showState('empty'); }
function setErrorState(msg)        {
  errorMsg.textContent = msg;
  showState('error');
}


// ──────────────────────────────────────────────────────────────
//  HELPER: File → Base64 string (tanpa prefix data:...)
// ──────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      // Result format: "data:image/jpeg;base64,XXXXXX"
      // Kita hanya butuh bagian setelah koma
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}
