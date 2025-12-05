// ===== Firebase import =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// ===== Config =====
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
const UNLOCK_DATE = new Date("2025-12-26T00:00:00+03:00");
const BANNED_WORDS = ["davut","davud","daut","büber","buber","bueber","bubér"];
let adminMode = false;

// ===== Utils =====
function normalizeText(str){return (str||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").trim();}
function containsBannedWords(text){const t=normalizeText(text);return BANNED_WORDS.some(w=>t.includes(normalizeText(w)));}
function isLocked(){return new Date()<UNLOCK_DATE;}
function formatCountdown(target){
  const diff=target-new Date();
  if(diff<=0) return "Kilidi açıldı.";
  const d=Math.floor(diff/86400000);
  const h=Math.floor((diff/3600000)%24);
  const m=Math.floor((diff/60000)%60);
  const s=Math.floor((diff/1000)%60);
  return `Kalan: ${d} gün ${h} saat ${m} dakika ${s} saniye`;
}

// ===== Router =====
export function pageInit(kind){
  if(kind==="index") initEnvelopeForm();
  if(kind==="list") { setupAdmin(); renderEnvelopeList(); }
  if(kind==="detail") renderEnvelopeDetail();
}

// ===== index.html =====
function initEnvelopeForm(){
  const form=document.getElementById("envelopeForm");
  const banHint=document.getElementById("banHint");
  const emojiToggle=document.getElementById("emojiToggle");
  const logoInput=document.getElementById("logo");
  const emojiInput=document.getElementById("emoji");
  const birthdayBtn=document.getElementById("birthdayEnvelope");

  // Doğum günü butonu
  if(birthdayBtn){
    birthdayBtn.addEventListener("click",()=>{
      document.getElementById("content").value="Doğum günün kutlu olsun 🎂🎉 Nice mutlu senelere...";
      alert("Doğum günü için özel mesaj eklendi. İstersen düzenleyebilirsin.");
    });
  }

  // Logo/Emoji toggle
  emojiToggle.addEventListener("click",()=>{
    const logoVisible=logoInput.style.display!=="none";
    if(logoVisible){
      logoInput.style.display="none";
      emojiInput.style.display="inline-block";
    }else{
      logoInput.style.display="inline-block";
      emojiInput.style.display="none";
    }
  });

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const sender=document.getElementById("sender").value.trim();
    const content=document.getElementById("content").value.trim();
    const color=document.getElementById("color").value;
    const emoji=(emojiInput.value||"").trim();

    if(!sender||!content){alert("Gönderen ve Mesaj zorunlu.");return;}
    if(containsBannedWords(content)){
      banHint.textContent="Mesajda yasaklı kelime var!";
      banHint.classList.add("error");
      alert("Mesaj yasaklı kelime içeriyor.");
      return;
    }

    let logoData=null;
    if(logoInput.files&&logoInput.files[0]){
      const reader=new FileReader();
      reader.onload=async()=>{logoData=reader.result;await saveEnvelope(sender,content,color,logoData,emoji);};
      reader.readAsDataURL(logoInput.files[0]);
    }else{
      await saveEnvelope(sender,content,color,logoData,emoji);
    }
  });
}

async function saveEnvelope(from,content,color,logo,emoji){
  const env={from,content,color,logo,emoji,showEmoji:!!emoji,createdAt:new Date().toISOString()};
  await addDoc(collection(db,"envelopes"),env);
  alert("Zarf kaydedildi!");
  window.location.href="zarflar.html";
}

// ===== zarflar.html =====
async function renderEnvelopeList(){
  const grid=document.getElementById("envelopeGrid");
  const snapshot=await getDocs(collection(db,"envelopes"));
  const list=snapshot.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  grid.innerHTML="";
  if(list.length===0){grid.innerHTML="<p class='muted'>Henüz zarf yok.</p>";return;}

  for(const env of list){
    const card=document.createElement("div");
    card.className="envelope-card";
    const stampHtml=env.showEmoji&&env.emoji?`<div class="stamp">${env.emoji}</div>`:(env.logo?`<img src="${env.logo}" class="stamp" />`:`<div class="stamp"></div>`);
    card.innerHTML=`
      <div class="envelope envelope--small" style="background:${env.color||"#fbfbf7"}">
        <div class="envelope-flap"></div>
        <div class="stamp-area">${stampHtml}<button class="toggleEmoji btn">Emoji</button></div>
        <div class="address"><strong>Kimden:</strong> ${env.from||"—"}</div>
        <div class="thread"></div>
      </div>
      ${adminMode?`<button class="btn danger deleteBtn">Sil</button>`:""}
    `;
    card.querySelector(".envelope").addEventListener("click",()=>{window.location.href=`zarf.html?id=${env.id}`;});
    card.querySelector(".toggleEmoji").addEventListener("click",async e=>{
      e.stopPropagation();
      env.showEmoji=!env.showEmoji;
      await updateDoc(doc(db,"envelopes",env.id),{showEmoji:env.showEmoji});
      renderEnvelopeList();
    });
    if(adminMode){
      card.querySelector(".deleteBtn").addEventListener("click",async e=>{
        e.stopPropagation();
        if(confirm("Silmek istiyor musun?")){await deleteDoc(doc(db,"envelopes",env.id));renderEnvelopeList();}
      });
    }
    grid.appendChild(card);
  }
}

function setupAdmin(){
  const adminToggle=document.getElementById("adminToggle");
  const adminPanel=document.getElementById("adminPanel");
  const deleteAllBtn=document.getElementById("deleteAll");
  const exitAdmin=document.getElementById("exitAdmin");

  adminPanel.hidden=!adminMode;
  adminToggle.addEventListener("click",()=>{
    const pass=prompt("Admin şifresi:");
    if(pass==="2009"){adminMode=true;adminPanel.hidden=false;renderEnvelopeList();alert("Admin mod aktif.");}
    else alert("Yanlış şifre!");
  });
  deleteAllBtn.addEventListener("click",async()=>{
    if(confirm("Tüm zarfları silmek istiyor musun?")){
      const snapshot=await getDocs(collection(db,"envelopes"));
      snapshot.forEach(async d=>await deleteDoc(d.ref));
      renderEnvelopeList();
    }
  });
  exitAdmin.addEventListener("click",()=>{adminMode=false;adminPanel.hidden=true;renderEnvelopeList();alert("Admin mod kapatıldı.");});
}

// ===== zarf.html =====
async function renderEnvelopeDetail(){
  const params=new URLSearchParams(window.location.search);
  const id=params.get("id");
  const snapshot=await getDocs(collection(db,"envelopes"));
  const envDoc=snapshot.docs.find(d=>d.id===id);
  if(!envDoc){document.getElementById("messageContent").textContent="Zarf bulunamadı.";return;}
  const env={id:envDoc.id,...envDoc.data()};
  const fromName=document.getElementById("fromName");
