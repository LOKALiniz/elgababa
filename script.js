// script.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApt5XYht8LLg7_khCNaRNH5iVF7COuRZ0",
  authDomain: "dogum-gunu-232e7.firebaseapp.com",
  projectId: "dogum-gunu-232e7",
  storageBucket: "dogum-gunu-232e7.firebasestorage.app",
  messagingSenderId: "113880436778",
  appId: "1:113880436778:web:8ba400d799def3edf4f353"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Config =====
const UNLOCK_DATE = new Date('2025-12-26T00:00:00+03:00'); // Ankara (GMT+3)
const STORAGE_KEY = 'envelopes.v11';
const ADMIN_KEY = 'admin.mode';
const BANNED_WORDS = [
  'davut','davud','davood','daut',
  'büber','buber','bueber','bubér'
];

// ===== Admin state =====
function setAdminMode(on) { localStorage.setItem(ADMIN_KEY, JSON.stringify(!!on)); }
function getAdminMode() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY)) === true; }
  catch { return false; }
}
let adminMode = getAdminMode();

// ===== Utils =====
function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}
function containsBannedWords(text) {
  const t = normalizeText(text);
  return BANNED_WORDS.some(w => t.includes(normalizeText(w)));
}
function loadEnvelopes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveEnvelopes(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
function deleteEnvelope(id) { saveEnvelopes(loadEnvelopes().filter(e => e.id !== id)); }
function deleteAllEnvelopes() { saveEnvelopes([]); }
function isLocked() { return new Date() < UNLOCK_DATE; }
function formatCountdown(target) {
  const diff = target - new Date();
  if (diff <= 0) return 'Kilidi açıldı.';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `Kalan: ${days} gün ${hours} saat ${minutes} dakika ${seconds} saniye`;
}


// ===== Router =====
function pageInit(kind) {
  if (kind === 'index') initEnvelopeForm();
  if (kind === 'list') { setupAdmin(); renderEnvelopeList(); }
  if (kind === 'detail') renderEnvelopeDetail();
}

// ===== index.html =====
function initEnvelopeForm() {
  const form = document.getElementById('envelopeForm');
  const banHint = document.getElementById('banHint');

  // Logo/Emoji toggle aynı satırda
  const emojiToggle = document.getElementById('emojiToggle');
  const logoInput = document.getElementById('logo');
  const emojiInput = document.getElementById('emoji');

  emojiToggle.addEventListener('click', () => {
    const logoVisible = logoInput.style.display !== 'none';
    if (logoVisible) {
      logoInput.style.display = 'none';
      emojiInput.style.display = 'inline-block';
      emojiToggle.textContent = 'Emoji seçiliyor';
    } else {
      logoInput.style.display = 'inline-block';
      emojiInput.style.display = 'none';
      emojiToggle.textContent = 'Logo/Emoji';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const sender = document.getElementById('sender').value.trim();
    const content = document.getElementById('content').value.trim();
    const color = document.getElementById('color').value;
    const emoji = (emojiInput.value || '').trim();

    if (!sender || !content) {
      alert('Gönderen ve Mesaj alanları zorunludur.');
      return;
    }

    // Yasaklı kelime kontrolü sadece içerikte
    if (containsBannedWords(content)) {
      banHint.textContent = 'Mesajda yasaklı kelime var! Lütfen düzenleyin.';
      banHint.classList.add('error');
      alert('Mesaj yasaklı kelime içeriyor. Gönderim engellendi.');
      return;
    } else {
      banHint.textContent = 'Yasaklı kelime kontrolü: sadece içerikte yapılır.';
      banHint.classList.remove('error');
    }

    // Logo seçildiyse base64 olarak oku
    const hasLogo = logoInput.style.display !== 'none' && logoInput.files && logoInput.files[0];
    if (hasLogo) {
      const reader = new FileReader();
      reader.onload = () => {
        persistEnvelope(sender, content, color, reader.result, emoji);
      };
      reader.readAsDataURL(logoInput.files[0]);
    } else {
      persistEnvelope(sender, content, color, null, emoji);
    }
  });

  function persistEnvelope(from, content, color, logo, emoji) {
    const env = {
      id: crypto.randomUUID(),
      from,
      content,
      color,
      logo,              // base64 data URL veya null
      emoji,             // '' olabilir
      showEmoji: !!emoji,// varsayılan: emoji varsa emoji göster
      createdAt: new Date().toISOString()
    };
    const list = loadEnvelopes();
    list.push(env);
    saveEnvelopes(list);
    alert('Zarf oluşturuldu!');
    window.location.href = 'zarflar.html';
  }
}

// ===== zarflar.html =====
function renderEnvelopeList() {
  const grid = document.getElementById('envelopeGrid');
  const list = loadEnvelopes().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<p class="muted">Henüz zarf yok.</p>';
    return;
  }

  for (const env of list) {
    const card = document.createElement('div');
    card.className = 'envelope-card';

    const stampHtml = env.showEmoji && env.emoji
      ? `<div class="stamp">${env.emoji}</div>`
      : (env.logo
         ? `<img src="${env.logo}" class="stamp" style="border:2px dashed #94d3f1;border-radius:6px;background:#fff;" />`
         : `<div class="stamp"></div>`);

    card.innerHTML = `
      <div class="envelope envelope--small" style="background:${env.color || '#fbfbf7'}">
        <div class="envelope-flap"></div>
        <div class="stamp-area">
          ${stampHtml}
          <button class="toggleEmoji btn">Emoji</button>
        </div>
        <div class="address"><strong>Kimden:</strong> ${env.from || '—'}</div>
        <div class="thread"></div>
      </div>
      ${adminMode ? `<button class="btn danger deleteBtn">Sil</button>` : ''}
    `;

    // Zarf tıklayınca detay
    card.querySelector('.envelope').addEventListener('click', () => {
      window.location.href = `zarf.html?id=${env.id}`;
    });

    // Logo/Emoji toggle kart üzerinde
    const toggleBtn = card.querySelector('.toggleEmoji');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      env.showEmoji = !env.showEmoji;
      const listAll = loadEnvelopes();
      const idx = listAll.findIndex(x => x.id === env.id);
      if (idx >= 0) {
        listAll[idx] = env;
        saveEnvelopes(listAll);
      }
      renderEnvelopeList();
    });

    // Admin sil
    if (adminMode) {
      const delBtn = card.querySelector('.deleteBtn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Bu zarfı silmek istiyor musun?')) {
          deleteEnvelope(env.id);
          renderEnvelopeList();
        }
      });
    }

    grid.appendChild(card);
  }
}

function setupAdmin() {
  const adminToggle = document.getElementById('adminToggle');
  const adminPanel = document.getElementById('adminPanel');
  const deleteAllBtn = document.getElementById('deleteAll');
  const exitAdminBtn = document.getElementById('exitAdmin');

  adminMode = getAdminMode();
  adminPanel.hidden = !adminMode;

  adminToggle.addEventListener('click', () => {
    const pass = prompt('Admin şifresi:');
    if (pass === '2009') {
      adminMode = true;
      setAdminMode(true);
      adminPanel.hidden = false;
      renderEnvelopeList();
      alert('Admin mod aktif.');
    } else {
      alert('Yanlış şifre!');
    }
  });

  deleteAllBtn.addEventListener('click', () => {
    if (confirm('Tüm zarfları silmek istediğine emin misin?')) {
      deleteAllEnvelopes();
      renderEnvelopeList();
    }
  });

  exitAdminBtn.addEventListener('click', () => {
    adminMode = false;
    setAdminMode(false);
    adminPanel.hidden = true;
    renderEnvelopeList();
    alert('Admin mod kapatıldı.');
  });
}

// ===== zarf.html =====
function renderEnvelopeDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const env = loadEnvelopes().find(e => e.id === id);
  const detailAdminMode = getAdminMode();

  const envelopeDetail = document.getElementById('envelopeDetail');
  const fromName = document.getElementById('fromName');
  const logoOrEmoji = document.getElementById('logoOrEmoji');
  const toggleEmojiBtn = document.getElementById('toggleEmoji');
  const lockPanel = document.getElementById('lockPanel');
  const contentPanel = document.getElementById('contentPanel');
  const countdown = document.getElementById('detailCountdown');
  const messageContent = document.getElementById('messageContent');
  const adminEdit = document.getElementById('adminEdit');
  const saveEdit = document.getElementById('saveEdit');

  if (!env) {
    lockPanel.hidden = true;
    contentPanel.hidden = false;
    messageContent.textContent = 'Zarf bulunamadı.';
    if (adminEdit) adminEdit.hidden = true;
    return;
  }

  // Zarf görseli
  envelopeDetail.style.background = env.color || '#fbfbf7';
  fromName.textContent = env.from || '—';

  // Pul/Logo/Emoji render
  function renderStamp() {
    if (env.showEmoji && env.emoji) {
      logoOrEmoji.innerHTML = '';
      logoOrEmoji.className = 'stamp';
      logoOrEmoji.textContent = env.emoji;
    } else if (env.logo) {
      logoOrEmoji.innerHTML =
        `<img src="${env.logo}" class="stamp" style="border:2px dashed #94d3f1;border-radius:6px;background:#fff;object-fit:contain;" />`;
    } else {
      logoOrEmoji.innerHTML = '';
      logoOrEmoji.className = 'stamp';
    }
  }
  renderStamp();

  // Emoji toggle detayda
  toggleEmojiBtn.addEventListener('click', () => {
    env.showEmoji = !env.showEmoji;
    const listAll = loadEnvelopes();
    const idx = listAll.findIndex(x => x.id === env.id);
    if (idx >= 0) {
      listAll[idx] = env;
      saveEnvelopes(listAll);
    }
    renderStamp();
  });

  // İçerik kilidi (admin bypass)
  function updateView() {
    if (isLocked() && !detailAdminMode) {
      lockPanel.hidden = false;
      contentPanel.hidden = true;
      countdown.textContent = formatCountdown(UNLOCK_DATE);
    } else {
      lockPanel.hidden = true;
      contentPanel.hidden = false;

      if (detailAdminMode) {
        // Admin düzenleme
        adminEdit.hidden = false;
        document.getElementById('editContent').value = env.content || '';
        messageContent.innerHTML = '';
      } else {
        adminEdit.hidden = true;
        messageContent.textContent = env.content || '';
      }
    }
  }
  updateView();
  const interval = setInterval(() => {
    updateView();
    if (!isLocked()) clearInterval(interval);
  }, 1000);

  // Admin içeriği kaydet
  if (saveEdit) {
    saveEdit.addEventListener('click', () => {
      const newContent = document.getElementById('editContent').value;
      if (containsBannedWords(newContent)) {
        alert('Mesaj yasaklı kelime içeriyor. Lütfen düzenleyin.');
        return;
      }
      env.content = newContent;
      const listAll = loadEnvelopes();
      const idx = listAll.findIndex(x => x.id === env.id);
      if (idx >= 0) {
        listAll[idx] = env;
        saveEnvelopes(listAll);
      }
      alert('Mesaj güncellendi.');
      updateView();
    });
  }
}


