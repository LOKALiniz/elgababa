/***********************
 * Firebase Bağlantısı *
 ***********************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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

/******************
 * Genel Ayarlar  *
 ******************/
const UNLOCK_DATE = new Date("2025-12-26T00:00:00+03:00");
let adminMode = false;

const BANNED_WORDS = ["davut","davud","daut","büber","buber","bueber","bubér"];
function normalizeText(str){
  return (str||"").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/ı/g,"i")
    .trim();
}
function containsBannedWords(text){
  const t = normalizeText(text);
  return BANNED_WORDS.some(w => t.includes(normalizeText(w)));
}
function isLocked(){
  return new Date() < UNLOCK_DATE;
}
function formatCountdown(target){
  const diff = target - new Date();
  if(diff <= 0) return "Kilidi açıldı.";
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff/3600000)%24);
  const m = Math.floor((diff/60000)%60);
  const s = Math.floor((diff/1000)%60);
  return `Kalan: ${d} gün ${h} saat ${m} dakika ${s} saniye`;
}

/******************
 * Router/Boot     *
 ******************/
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.endsWith("/") || path.endsWith("index.html")) initEnvelopeForm();
  else if (path.endsWith("zarflar.html")) initListPage();
  else if (path.endsWith("zarf.html")) initDetailPage();
});

/***********************
 * Index: Zarf Yazma   *
 ***********************/
function initEnvelopeForm(){
  const form = byId("envelopeForm");
  const birthdayBtn = byId("birthdayEnvelope");
  const emojiToggle = byId("emojiToggle");
  const logoInput = byId("logo");
  const emojiInput = byId("emoji");
  const banHint = byId("banHint");

  // Doğum günü hızlı mesaj
  if (birthdayBtn) {
    birthdayBtn.addEventListener("click", () => {
      byId("content").value = "Doğum günün kutlu olsun 🎂🎉 Nice mutlu senelere...";
      alert("Doğum günü için özel mesaj eklendi. İstersen düzenleyebilirsin.");
    });
  }

  // Logo/Emoji toggle
  if (emojiToggle) {
    emojiToggle.addEventListener("click", () => {
      const logoVisible = logoInput.style.display !== "none";
      if (logoVisible) {
        logoInput.style.display = "none";
        emojiInput.style.display = "inline-block";
      } else {
        logoInput.style.display = "inline-block";
        emojiInput.style.display = "none";
      }
    });
  }

  // Submit → Firestore’a kaydet
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = byId("sender").value.trim();
    const content = byId("content").value.trim();
    const color = byId("color").value;
    const emoji = (emojiInput.value || "").trim();

    if (!from || !content) {
      alert("Gönderen ve mesaj zorunlu.");
      return;
    }
    if (containsBannedWords(content)) {
      banHint.textContent = "Mesajda yasaklı kelime var!";
      banHint.classList.add("error");
      alert("Mesaj yasaklı kelime içeriyor.");
      return;
    }

    // Logo dosyası base64 olarak eklenir (küçük dosyalar için pratik)
    let logoData = null;
    const file = logoInput.files && logoInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        logoData = reader.result;
        await saveEnvelope({ from, content, color, logo: logoData, emoji, showEmoji: !!emoji });
      };
      reader.readAsDataURL(file);
    } else {
      await saveEnvelope({ from, content, color, logo: logoData, emoji, showEmoji: !!emoji });
    }
  });
}

async function saveEnvelope(env){
  const payload = {
    ...env,
    createdAt: new Date().toISOString()
  };
  await addDoc(collection(db, "envelopes"), payload);
  alert("Zarf kaydedildi!");
  // Liste sayfasına yönlendir
  window.location.href = "zarflar.html";
}

/*************************
 * Zarflar: Liste Sayfa  *
 *************************/
function initListPage(){
  const grid = byId("envelopeGrid");
  const adminToggle = makeAdminControls();

  // Realtime dinleme (yeni zarf anında düşer)
  const q = query(collection(db, "envelopes"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEnvelopeList(grid, list);
  });

  // Her saniye geri sayımı güncelle (tek satırlık footer veya kartlarda)
  setInterval(() => {
    const counters = document.querySelectorAll("[data-countdown]");
    counters.forEach(el => el.textContent = formatCountdown(UNLOCK_DATE));
  }, 1000);

  // Admin toggle
  if (adminToggle) {
    adminToggle.addEventListener("click", () => {
      const pass = prompt("Admin şifresi:");
      if (pass === "2009") {
        adminMode = true;
        alert("Admin mod aktif.");
      } else {
        alert("Yanlış şifre!");
      }
      // Re-render
      // Not: onSnapshot zaten yeniden çiziyor, ama admin buton görünürlüğü için manuel tetikleyebiliriz
      grid.dataset.admin = adminMode ? "1" : "0";
    });
  }
}

function renderEnvelopeList(container, list){
  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = "<p class='muted'>Henüz zarf yok.</p>";
    return;
  }

  for (const env of list) {
    const card = document.createElement("div");
    card.className = "envelope-card";

    const stampHtml =
      env.showEmoji && env.emoji
        ? `<div class="stamp" title="Emoji">${escapeHtml(env.emoji)}</div>`
        : env.logo
          ? `<img src="${env.logo}" class="stamp" alt="Logo" />`
          : `<div class="stamp"></div>`;

    const locked = isLocked();

    card.innerHTML = `
      <div class="envelope envelope--small" style="background:${env.color || "#fbfbf7"}">
        <div class="envelope-flap"></div>
        <div class="stamp-area">
          ${stampHtml}
          <button class="btn xs toggleEmoji">Emoji</button>
        </div>
        <div class="address"><strong>Kimden:</strong> ${escapeHtml(env.from || "—")}</div>
        <div class="content-preview">
          ${locked ? "🔒 Kilitli" : escapeHtml(env.content || "")}
        </div>
        <div class="countdown" data-countdown>${formatCountdown(UNLOCK_DATE)}</div>
      </div>
      <div class="card-actions">
        <a class="btn" href="zarf.html?id=${env.id}">Aç</a>
        ${adminMode ? `<button class="btn danger deleteBtn">Sil</button>` : ""}
      </div>
    `;

    // Emoji toggle (Firestore güncelle)
    card.querySelector(".toggleEmoji").addEventListener("click", async (e) => {
      e.stopPropagation();
      const newShow = !(env.showEmoji);
      await updateDoc(doc(db, "envelopes", env.id), { showEmoji: newShow });
    });

    // Admin sil
    if (adminMode) {
      const del = card.querySelector(".deleteBtn");
      del?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm("Bu zarfı silmek istiyor musun?")) {
          await deleteDoc(doc(db, "envelopes", env.id));
          alert("Zarf silindi.");
        }
      });
    }

    container.appendChild(card);
  }
}

/*************************
 * Zarf: Detay Sayfası   *
 *************************/
function initDetailPage(){
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    const el = byId("messageContent");
    if (el) el.textContent = "Zarf bulunamadı.";
    return;
  }

  const fromName = byId("fromName");
  const logoOrEmoji = byId("logoOrEmoji");
  const toggleEmojiBtn = byId("toggleEmojiBtn");
  const lockPanel = byId("lockPanel");
  const contentPanel = byId("contentPanel");
  const countdown = byId("countdown");
  const messageContent = byId("messageContent");
  const adminEdit = byId("adminEdit");
  const editContent = byId("editContent");
  const saveEdit = byId("saveEdit");
  const adminToggle = makeAdminControls();

  // Doc'u realtime dinle
  const ref = doc(db, "envelopes", id);
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      if (messageContent) messageContent.textContent = "Zarf bulunamadı.";
      return;
    }
    const env = { id: snap.id, ...snap.data() };
    renderDetail(env);
  });

  function renderDetail(env){
    if (fromName) fromName.textContent = env.from || "—";

    // Stamp render
    function renderStamp(){
      if (!logoOrEmoji) return;
      if (env.showEmoji && env.emoji) {
        logoOrEmoji.innerHTML = "";
        logoOrEmoji.className = "stamp";
        logoOrEmoji.textContent = env.emoji;
      } else if (env.logo) {
        logoOrEmoji.innerHTML =
          `<img src="${env.logo}" class="stamp" style="border:2px dashed #94d3f1;border-radius:6px;background:#fff;object-fit:contain;" alt="Logo" />`;
      } else {
        logoOrEmoji.innerHTML = "";
        logoOrEmoji.className = "stamp";
      }
    }
    renderStamp();

    // Emoji toggle
    if (toggleEmojiBtn) {
      toggleEmojiBtn.onclick = async () => {
        await updateDoc(ref, { showEmoji: !env.showEmoji });
      };
    }

    // Kilitli görüntü
    function updateView(){
      if (isLocked() && !adminMode) {
        if (lockPanel) lockPanel.hidden = false;
        if (contentPanel) contentPanel.hidden = true;
        if (countdown) countdown.textContent = formatCountdown(UNLOCK_DATE);
      } else {
        if (lockPanel) lockPanel.hidden = true;
        if (contentPanel) contentPanel.hidden = false;

        if (adminMode) {
          if (adminEdit) adminEdit.hidden = false;
          if (editContent) editContent.value = env.content || "";
          if (messageContent) messageContent.innerHTML = "";
        } else {
          if (adminEdit) adminEdit.hidden = true;
          if (messageContent) messageContent.textContent = env.content || "";
        }
      }
    }
    updateView();

    // Canlı geri sayım
    const interval = setInterval(() => {
      updateView();
      if (!isLocked()) clearInterval(interval);
    }, 1000);

    // Admin düzenleme
    if (saveEdit) {
      saveEdit.onclick = async () => {
        const newContent = editContent?.value || "";
        if (containsBannedWords(newContent)) {
          alert("Mesaj yasaklı kelime içeriyor. Lütfen düzenleyin.");
          return;
        }
        await updateDoc(ref, { content: newContent });
        alert("Mesaj güncellendi.");
      };
    }
  }

  // Admin toggle
  if (adminToggle) {
    adminToggle.addEventListener("click", () => {
      const pass = prompt("Admin şifresi:");
      if (pass === "2009") { adminMode = true; alert("Admin mod aktif."); }
      else { alert("Yanlış şifre!"); }
    });
  }
}

/*******************
 * Admin Araçları  *
 *******************/
function makeAdminControls(){
  // Sayfada id="adminToggle" varsa ona bağlan
  const btn = byId("adminToggle");
  const deleteAllBtn = byId("deleteAll");
  const exitAdminBtn = byId("exitAdmin");

  if (deleteAllBtn) {
    deleteAllBtn.onclick = async () => {
      if (!adminMode) { alert("Önce admin moduna geç."); return; }
      if (confirm("Tüm zarfları silmek istiyor musun?")) {
        const snap = await getDocs(collection(db, "envelopes"));
        // Not: Firestore toplu silme için batched write önerilir, burada basit döngü kullanıyoruz.
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
        alert("Tüm zarflar silindi.");
      }
    };
  }
  if (exitAdminBtn) {
    exitAdminBtn.onclick = () => {
      adminMode = false;
      alert("Admin mod kapatıldı.");
    };
  }
  return btn;
}

/*******************
 * Küçük Yardımcı  *
 *******************/
function byId(id){ return document.getElementById(id); }
function escapeHtml(str){
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}