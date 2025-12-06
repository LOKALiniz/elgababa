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
function isLocked(){ return new Date() < UNLOCK_DATE; }
function formatCountdown(target){
  const diff = target - new Date();
  if (diff <= 0) return "Kilidi açıldı.";
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff/3600000)%24);
  const m = Math.floor((diff/60000)%60);
  const s = Math.floor((diff/1000)%60);
  return `Kalan: ${d} gün ${h} saat ${m} dakika ${s} saniye`;
}
function byId(id){ return document.getElementById(id); }
function escapeHtml(str){
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
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

  birthdayBtn?.addEventListener("click", () => {
    byId("content").value = "Doğum günün kutlu olsun 🎂🎉 Nice mutlu senelere...";
    alert("Doğum günü için özel mesaj eklendi. İstersen düzenleyebilirsin.");
  });

  emojiToggle?.addEventListener("click", () => {
    const logoVisible = logoInput.style.display !== "none";
    if (logoVisible) {
      logoInput.style.display = "none";
      emojiInput.style.display = "inline-block";
    } else {
      logoInput.style.display = "inline-block";
      emojiInput.style.display = "none";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = byId("sender").value.trim();
    const content = byId("content").value.trim();
    const color = byId("color").value;
    const emoji = (emojiInput.value || "").trim();

    if (!from || !content) { alert("Gönderen ve mesaj zorunlu."); return; }
    if (containsBannedWords(content)) {
      banHint.textContent = "Mesajda yasaklı kelime var!";
      banHint.classList.add("error");
      alert("Mesaj yasaklı kelime içeriyor.");
      return;
    }

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
  const payload = { ...env, createdAt: new Date().toISOString() };
  await addDoc(collection(db, "envelopes"), payload);
  alert("Zarf kaydedildi!");
  window.location.href = "zarflar.html";
}

/*************************
 * Zarflar: Liste Sayfa  *
 *************************/
function initListPage(){
  const grid = byId("envelopeGrid");
  const adminPanel = byId("adminPanel");
  const adminToggle = byId("adminToggle");
  const deleteAllBtn = byId("deleteAll");
  const exitAdminBtn = byId("exitAdmin");

  // Admin mod
  adminToggle?.addEventListener("click", () => {
    const pass = prompt("Admin şifresi:");
    if (pass === "2009") {
      adminMode = true;
      adminPanel.hidden = false;
      alert("Admin mod aktif.");
    } else {
      alert("Yanlış şifre!");
    }
  });
  exitAdminBtn?.addEventListener("click", () => {
    adminMode = false;
    adminPanel.hidden = true;
    alert("Admin mod kapatıldı.");
  });
  deleteAllBtn?.addEventListener("click", async () => {
    if (!adminMode) { alert("Önce admin moduna geç."); return; }
    if (confirm("Tüm zarfları silmek istiyor musun?")) {
      const snap = await getDocs(collection(db, "envelopes"));
      for (const d of snap.docs) { await deleteDoc(d.ref); }
      alert("Tüm zarflar silindi.");
    }
  });

  // Real-time listeleme
  const q = query(collection(db, "envelopes"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEnvelopeList(grid, list);
  });

  // Geri sayım canlı
  setInterval(() => {
    document.querySelectorAll("[data-countdown]").forEach(el => {
      el.textContent = formatCountdown(UNLOCK_DATE);
    });
  }, 1000);
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
      <div class="envelope envelope--small" style="background:${env.color || "#fbfbf7"};padding:12px;border:1px solid #ddd;border-radius:8px;">
        <div class="stamp-area">
          ${stampHtml}
          <button class="btn xs toggleEmoji">Emoji</button>
        </div>
        <div class="address"><strong>Kimden:</strong> ${escapeHtml(env.from || "—")}</div>
        <div class="content-preview">${locked ? "🔒 Kilitli" : escapeHtml(env.content || "")}</div>
        <div class="countdown" data-countdown>${formatCountdown(UNLOCK_DATE)}</div>
      </div>
      <div class="card-actions" style="margin-top:8px;">
        <a class="btn" href="zarf.html?id=${env.id}">Aç</a>
        ${adminMode ? `<button class="btn danger deleteBtn">Sil</button>` : ""}
      </div>
    `;

    // Emoji toggle
    card.querySelector(".toggleEmoji")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await updateDoc(doc(db, "envelopes", env.id), { showEmoji: !env.showEmoji });
    });

    // Admin sil
    if (adminMode) {
      card.querySelector(".deleteBtn")?.addEventListener("click", async (e) => {
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
    el && (el.textContent = "Zarf bulunamadı.");
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
  const adminToggle = byId("adminToggle");

  // Admin mod toggle
  adminToggle?.addEventListener("click", () => {
    const pass = prompt("Admin şifresi:");
    if (pass === "2009") { adminMode = true; alert("Admin mod aktif."); }
    else { alert("Yanlış şifre!"); }
    // Görünüm güncellenecek (onSnapshot renderDetail içinde)
  });

  const ref = doc(db, "envelopes", id);
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      messageContent && (messageContent.textContent = "Zarf bulunamadı.");
      return;
    }
    const env = { id: snap.id, ...snap.data() };
    renderDetail(env);
  });

  function renderDetail(env){
    fromName && (fromName.textContent = env.from || "—");

    // Stamp
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
    toggleEmojiBtn?.addEventListener("click", async () => {
      await updateDoc(ref, { showEmoji: !env.showEmoji });
    });

    // Kilitli görüntü
    function updateView(){
      if (isLocked() && !adminMode) {
        lockPanel && (lockPanel.hidden = false);
        contentPanel && (contentPanel.hidden = true);
        countdown && (countdown.textContent = formatCountdown(UNLOCK_DATE));
      } else {
        lockPanel && (lockPanel.hidden = true);
        contentPanel && (contentPanel.hidden = false);

        if (adminMode) {
          adminEdit && (adminEdit.hidden = false);
          editContent && (editContent.value = env.content || "");
          messageContent && (messageContent.innerHTML = "");
        } else {
          adminEdit && (adminEdit.hidden = true);
          messageContent && (messageContent.textContent = env.content || "");
        }
      }
    }
    updateView();

    // Geri sayım canlı
    const interval = setInterval(() => {
      updateView();
      if (!isLocked()) clearInterval(interval);
    }, 1000);

    // Admin düzenleme
    saveEdit?.addEventListener("click", async () => {
      const newContent = editContent?.value || "";
      if (containsBannedWords(newContent)) {
        alert("Mesaj yasaklı kelime içeriyor. Lütfen düzenleyin.");
        return;
      }
      await updateDoc(ref, { content: newContent });
      alert("Mesaj güncellendi.");
    });
  }
}
