const $ = (id) => document.getElementById(id);
const notebook = $("notebook");
const canvas = $("drawingCanvas");
const ctx = canvas.getContext("2d");
const textLayer = $("textLayer");
const objectsLayer = $("objectsLayer");

let mode = "pen";
let drawing = false;
let startX = 0, startY = 0;
let snapshot = null;
let curvePoints = [];
let pages = [blankPage()];
let currentPage = 0;
let undoStack = [];
let redoStack = [];
let zoom = 1;
let timerInterval = null;
let timerSeconds = 300;
let isBold = false, isItalic = false, isUnderline = false;

function blankPage(){
  return {
    drawing:"",
    text:"",
    objects:[],
    paper:"grid5"
  };
}

/* ---------------- CLOCK ---------------- */
function updateClock(){
  $("liveClock").textContent = new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
setInterval(updateClock,1000); updateClock();

/* ---------------- DATE / HEADING ---------------- */
const monthsGenitive = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
const dayWords = [
  "","Перше","Друге","Третє","Четверте","П’яте","Шосте","Сьоме","Восьме","Дев’яте","Десяте",
  "Одинадцяте","Дванадцяте","Тринадцяте","Чотирнадцяте","П’ятнадцяте","Шістнадцяте","Сімнадцяте",
  "Вісімнадцяте","Дев’ятнадцяте","Двадцяте","Двадцять перше","Двадцять друге","Двадцять третє",
  "Двадцять четверте","Двадцять п’яте","Двадцять шосте","Двадцять сьоме","Двадцять восьме",
  "Двадцять дев’яте","Тридцяте","Тридцять перше"
];
function getWorkType(){
  return $("workType").value === "custom" ? ($("customWorkType").value.trim() || "Інше") : $("workType").value;
}
function updateHeading(){
  const d = new Date();
  const dm = $("dateMode").value;
  if(dm==="words") $("dateHeading").textContent = `${dayWords[d.getDate()]} ${monthsGenitive[d.getMonth()]}`;
  else if(dm==="numeric") $("dateHeading").textContent = d.toLocaleDateString("uk-UA");
  else $("dateHeading").textContent = "";
  $("workHeading").textContent = getWorkType();
}
["workType","dateMode"].forEach(id=>$(id).addEventListener("change", updateHeading));
$("customWorkType").addEventListener("input",updateHeading);
$("workType").addEventListener("change",()=>{
  $("customWorkType").classList.toggle("hidden",$("workType").value!=="custom");
});
updateHeading();

/* ---------------- PAPER ---------------- */
const paperClasses = ["paper-grid5","paper-grid10","paper-lines","paper-slant","paper-music","paper-millimeter","paper-clean"];
function applyPaper(type){
  notebook.classList.remove(...paperClasses);
  notebook.classList.add("paper-"+type);
  pages[currentPage].paper = type;
}
$("paperType").addEventListener("change",()=>{ saveCurrentPage(); applyPaper($("paperType").value); autoSave(); });

/* ---------------- CANVAS ---------------- */
function resizeCanvas(){
  const data = canvas.width && canvas.height ? canvas.toDataURL() : "";
  canvas.width = notebook.clientWidth;
  canvas.height = notebook.clientHeight;
  if(data){
    const img = new Image();
    img.onload=()=>ctx.drawImage(img,0,0);
    img.src=data;
  }
}
resizeCanvas();
window.addEventListener("resize",resizeCanvas);

function pos(e){
  const r = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return {x:(p.clientX-r.left)/zoom, y:(p.clientY-r.top)/zoom};
}
function dashPattern(){
  const s=$("lineStyle").value;
  if(s==="dashed") return [14,9];
  if(s==="dotted") return [2,8];
  if(s==="dashdot") return [16,7,2,7];
  return [];
}
function setStrokeStyle(){
  ctx.strokeStyle=$("colorPicker").value;
  ctx.lineWidth=Number($("lineWidth").value);
  ctx.lineCap="round"; ctx.lineJoin="round";
  ctx.setLineDash(dashPattern());
  ctx.globalCompositeOperation = mode==="eraser" ? "destination-out" : "source-over";
  if(mode==="eraser"){ctx.lineWidth=28;ctx.setLineDash([]);}
}
function saveUndo(){
  undoStack.push({drawing:canvas.toDataURL(), text:textLayer.innerHTML, objects:serializeObjects()});
  if(undoStack.length>40) undoStack.shift();
  redoStack=[];
}
function beginDraw(e){
  if(["text","select"].includes(mode)) return;
  e.preventDefault();
  const p=pos(e); startX=p.x; startY=p.y; drawing=true; saveUndo(); setStrokeStyle();
  snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(["pen","eraser"].includes(mode)){ctx.beginPath();ctx.moveTo(p.x,p.y);}
  if(mode==="curve") curvePoints=[p];
}
function moveDraw(e){
  if(!drawing) return;
  e.preventDefault();
  const p=pos(e);
  setStrokeStyle();
  if(["pen","eraser"].includes(mode)){
    ctx.lineTo(p.x,p.y);ctx.stroke();return;
  }
  if(mode==="curve"){
    curvePoints.push(p);
    ctx.putImageData(snapshot,0,0);ctx.beginPath();ctx.moveTo(curvePoints[0].x,curvePoints[0].y);
    for(let i=1;i<curvePoints.length-1;i++){
      const xc=(curvePoints[i].x+curvePoints[i+1].x)/2;
      const yc=(curvePoints[i].y+curvePoints[i+1].y)/2;
      ctx.quadraticCurveTo(curvePoints[i].x,curvePoints[i].y,xc,yc);
    }
    ctx.stroke();return;
  }
  ctx.putImageData(snapshot,0,0);
  drawShape(mode,startX,startY,p.x,p.y,false);
}
function endDraw(e){
  if(!drawing) return;
  drawing=false;
  if(!["pen","eraser","curve"].includes(mode) && e){
    const p=pos(e);ctx.putImageData(snapshot,0,0);drawShape(mode,startX,startY,p.x,p.y,true);
  }
  ctx.beginPath();autoSave();
}
canvas.addEventListener("mousedown",beginDraw);
canvas.addEventListener("mousemove",moveDraw);
canvas.addEventListener("mouseup",endDraw);
canvas.addEventListener("mouseleave",endDraw);
canvas.addEventListener("touchstart",beginDraw,{passive:false});
canvas.addEventListener("touchmove",moveDraw,{passive:false});
canvas.addEventListener("touchend",(e)=>endDraw(e.changedTouches?.[0]?{clientX:e.changedTouches[0].clientX,clientY:e.changedTouches[0].clientY}:null));

function drawShape(type,x1,y1,x2,y2){
  setStrokeStyle();
  const w=x2-x1,h=y2-y1;
  ctx.beginPath();
  if(type==="line"){ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);}
  if(type==="arrow"){
    ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
    const a=Math.atan2(y2-y1,x2-x1), len=18+ctx.lineWidth;
    ctx.moveTo(x2,y2);ctx.lineTo(x2-len*Math.cos(a-Math.PI/6),y2-len*Math.sin(a-Math.PI/6));
    ctx.moveTo(x2,y2);ctx.lineTo(x2-len*Math.cos(a+Math.PI/6),y2-len*Math.sin(a+Math.PI/6));
  }
  if(type==="rectangle") ctx.rect(x1,y1,w,h);
  if(type==="ellipse") ctx.ellipse((x1+x2)/2,(y1+y2)/2,Math.abs(w)/2,Math.abs(h)/2,0,0,Math.PI*2);
  if(type==="triangle"){
    ctx.moveTo((x1+x2)/2,y1);ctx.lineTo(x2,y2);ctx.lineTo(x1,y2);ctx.closePath();
  }
  ctx.stroke();
}

/* ---------------- TOOLS ---------------- */
document.querySelectorAll(".tool[data-tool]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tool[data-tool]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); mode=b.dataset.tool;
  if(mode==="text"){
    canvas.style.pointerEvents="none"; textLayer.classList.add("active"); textLayer.contentEditable="true";
    applyTextStyle();textLayer.focus();
  }else{
    canvas.style.pointerEvents="auto"; textLayer.classList.remove("active"); textLayer.contentEditable="false";
  }
}));
$("lineWidth").addEventListener("input",()=>$("lineWidthValue").textContent=$("lineWidth").value);

/* ---------------- TEXT STYLES ---------------- */
function applyTextStyle(){
  textLayer.style.fontFamily=$("fontFamily").value;
  textLayer.style.fontSize=$("fontSize").value+"px";
  textLayer.style.color=$("colorPicker").value;
  textLayer.style.fontWeight=isBold?"700":"400";
  textLayer.style.fontStyle=isItalic?"italic":"normal";
  textLayer.style.textDecoration=isUnderline?"underline":"none";
}
["fontFamily","fontSize","colorPicker"].forEach(id=>$(id).addEventListener("change",applyTextStyle));
$("boldBtn").onclick=()=>{isBold=!isBold;$("boldBtn").classList.toggle("active",isBold);applyTextStyle();};
$("italicBtn").onclick=()=>{isItalic=!isItalic;$("italicBtn").classList.toggle("active",isItalic);applyTextStyle();};
$("underlineBtn").onclick=()=>{isUnderline=!isUnderline;$("underlineBtn").classList.toggle("active",isUnderline);applyTextStyle();};
textLayer.addEventListener("input",autoSave);

/* ---------------- UNDO / REDO ---------------- */
function restoreState(st){
  const current={drawing:canvas.toDataURL(),text:textLayer.innerHTML,objects:serializeObjects()};
  const img=new Image();img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0)};
  img.src=st.drawing;textLayer.innerHTML=st.text;renderObjects(st.objects);return current;
}
$("undoBtn").onclick=()=>{
  if(!undoStack.length)return;
  const prev=undoStack.pop();redoStack.push(restoreState(prev));autoSave();
};
$("redoBtn").onclick=()=>{
  if(!redoStack.length)return;
  const nxt=redoStack.pop();undoStack.push(restoreState(nxt));autoSave();
};
$("clearBtn").onclick=()=>{
  if(!confirm("Очистити поточну сторінку?"))return;
  saveUndo();ctx.clearRect(0,0,canvas.width,canvas.height);textLayer.innerHTML="";objectsLayer.innerHTML="";autoSave();
};

/* ---------------- OBJECTS ---------------- */
function makeDraggable(el){
  let dragging=false,ox=0,oy=0;
  el.addEventListener("pointerdown",(e)=>{
    if(e.target.classList.contains("object-delete"))return;
    dragging=true; const r=el.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove",(e)=>{
    if(!dragging)return;
    const nr=notebook.getBoundingClientRect();
    el.style.left=((e.clientX-nr.left)/zoom-ox)+"px";
    el.style.top=((e.clientY-nr.top)/zoom-oy)+"px";
  });
  el.addEventListener("pointerup",()=>{dragging=false;autoSave();});
}
function addObject(html,x=120,y=150,cls=""){
  const el=document.createElement("div");
  el.className="embedded-object "+cls;el.style.left=x+"px";el.style.top=y+"px";el.innerHTML=html;
  const del=document.createElement("button");del.className="object-delete";del.textContent="×";del.onclick=()=>{el.remove();autoSave();};
  el.appendChild(del);objectsLayer.appendChild(el);makeDraggable(el);autoSave();return el;
}
function serializeObjects(){
  return [...objectsLayer.children].map(el=>({html:el.innerHTML.replace(/<button class="object-delete">×<\/button>/,""),left:el.style.left,top:el.style.top,cls:el.className}));
}
function renderObjects(arr=[]){
  objectsLayer.innerHTML="";
  arr.forEach(o=>{const el=addObject(o.html,parseFloat(o.left)||120,parseFloat(o.top)||150,(o.cls||"").replace("embedded-object","").trim());});
}

/* ---------------- SYMBOLS ---------------- */
const mathSymbols=["+","−","×","÷","=","≠","≈","<",">","≤","≥","±","∞","√","∛","π","°","∠","⊥","∥","∑","∏","∫","∆","∇","∈","∉","⊂","⊆","∪","∩","∅","ℕ","ℤ","ℚ","ℝ","²","³","½","⅓","¼","¾","%","‰","→","↔","α","β","γ","θ","λ","μ"];
mathSymbols.forEach(s=>{
  const b=document.createElement("button");b.className="symbol-btn";b.textContent=s;
  b.onclick=()=>insertTextAtCursor(s);$("mathSymbols").appendChild(b);
});
function insertTextAtCursor(txt){
  mode="text";textLayer.classList.add("active");textLayer.contentEditable="true";canvas.style.pointerEvents="none";textLayer.focus();
  document.execCommand("insertText",false,txt);autoSave();
}
const stickers=["⭐","✅","❗","💡","🎯","🏆","👏","❤️","😊","🤔","📌","📚","🧠","🚀","🌟","👍","🔔","📝","🎉","💬","📐","➗","💻","🇬🇧"];
stickers.forEach(s=>{
  const b=document.createElement("button");b.className="symbol-btn";b.textContent=s;b.onclick=()=>addObject(s,150,170,"sticker-object");
  $("stickers").appendChild(b);
});

/* ---------------- PANELS ---------------- */
function togglePanel(id){
  ["mathPanel","insertPanel","geometryPanel","stickerPanel"].forEach(p=>{if(p!==id)$(p).classList.add("hidden")});
  $(id).classList.toggle("hidden");
}
$("mathBtn").onclick=()=>togglePanel("mathPanel");
$("insertBtn").onclick=()=>togglePanel("insertPanel");
$("geometryBtn").onclick=()=>togglePanel("geometryPanel");
$("stickerBtn").onclick=()=>togglePanel("stickerPanel");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));

/* ---------------- INSERT ---------------- */
$("insertImageBtn").onclick=()=>$("imageInput").click();
$("imageInput").addEventListener("change",(e)=>{
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();reader.onload=()=>addObject(`<img src="${reader.result}" style="width:300px">`,140,170);reader.readAsDataURL(f);
});
$("insertLinkBtn").onclick=()=>{
  const url=prompt("Вставте посилання:");if(!url)return;
  const text=prompt("Текст посилання:","Відкрити матеріал")||"Відкрити матеріал";
  addObject(`<a href="${url}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`,140,170);
};
$("insertVideoBtn").onclick=()=>{
  const url=prompt("Вставте посилання YouTube:");if(!url)return;
  const id=(url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/)||[])[1];
  if(!id){alert("Не вдалося визначити YouTube-відео.");return;}
  addObject(`<iframe width="360" height="203" src="https://www.youtube.com/embed/${id}" title="YouTube video" allowfullscreen></iframe>`,140,170);
};
$("insertFileBtn").onclick=()=>{
  const url=prompt("Вставте посилання на файл або матеріал:");if(!url)return;
  const name=prompt("Назва матеріалу:","Навчальний матеріал")||"Навчальний матеріал";
  addObject(`<a href="${url}" target="_blank" rel="noopener">📄 ${escapeHtml(name)}</a>`,140,170);
};

/* ---------------- TABLE ---------------- */
$("tableBtn").onclick=()=>{
  const rows=Math.max(1,Math.min(12,Number(prompt("Кількість рядків:",3))||3));
  const cols=Math.max(1,Math.min(8,Number(prompt("Кількість стовпців:",3))||3));
  let h="<table>";
  for(let r=0;r<rows;r++){h+="<tr>";for(let c=0;c<cols;c++)h+=`<td contenteditable="true">&nbsp;</td>`;h+="</tr>"}
  h+="</table>";addObject(h,140,170,"table-object");
};

/* ---------------- GEOMETRY OVERLAYS ---------------- */
document.querySelectorAll(".geo-toggle").forEach(b=>b.onclick=()=>$(b.dataset.target).classList.toggle("hidden"));
document.querySelectorAll(".geometry-overlay").forEach(el=>{
  const handle=el.querySelector(".drag-handle");let drag=false,ox=0,oy=0;
  handle.addEventListener("pointerdown",(e)=>{drag=true;const r=el.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;handle.setPointerCapture(e.pointerId)});
  handle.addEventListener("pointermove",(e)=>{if(!drag)return;const nr=notebook.getBoundingClientRect();el.style.left=((e.clientX-nr.left)/zoom-ox)+"px";el.style.top=((e.clientY-nr.top)/zoom-oy)+"px"});
  handle.addEventListener("pointerup",()=>drag=false);
});
$("drawCircleFromCompass").onclick=()=>{
  saveUndo();setStrokeStyle();
  const el=$("compassOverlay"),r=el.getBoundingClientRect(),nr=notebook.getBoundingClientRect();
  const cx=(r.left-nr.left)/zoom+75, cy=(r.top-nr.top)/zoom+175;
  ctx.beginPath();ctx.arc(cx,cy,90,0,Math.PI*2);ctx.stroke();autoSave();
};

/* ---------------- VOICE ---------------- */
$("voiceBtn").onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Голосове введення підтримується переважно в Google Chrome / Edge.");return;}
  const rec=new SR();rec.lang="uk-UA";rec.interimResults=false;rec.continuous=false;
  $("voiceBtn").textContent="🎙 Слухаю…";
  rec.onresult=(e)=>insertTextAtCursor(e.results[0][0].transcript+" ");
  rec.onerror=()=>alert("Не вдалося розпізнати мовлення.");
  rec.onend=()=>$("voiceBtn").textContent="🎙 Голос";
  rec.start();
};

/* ---------------- TRANSLATE ---------------- */
$("translateBtn").onclick=()=>{
  const selected=window.getSelection()?.toString()||"";
  $("translateText").value=selected;
  $("translateModal").classList.remove("hidden");
};
$("openTranslate").onclick=()=>{
  const txt=$("translateText").value.trim();if(!txt)return;
  const lang=$("translateLang").value;
  const url=`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(lang)}&text=${encodeURIComponent(txt)}&op=translate`;
  window.open(url,"_blank","noopener");
};

/* ---------------- TIMER ---------------- */
$("timerBtn").onclick=()=>$("timerModal").classList.remove("hidden");
function renderTimer(){
  const m=Math.floor(timerSeconds/60).toString().padStart(2,"0"),s=(timerSeconds%60).toString().padStart(2,"0");
  $("timerDisplay").textContent=`${m}:${s}`;
}
$("startTimer").onclick=()=>{
  if(timerInterval)return;
  if(timerSeconds<=0)timerSeconds=(Number($("timerMinutes").value)||5)*60;
  timerInterval=setInterval(()=>{timerSeconds--;renderTimer();if(timerSeconds<=0){clearInterval(timerInterval);timerInterval=null;alert("⏱ Час вийшов!");}},1000);
};
$("pauseTimer").onclick=()=>{clearInterval(timerInterval);timerInterval=null;};
$("resetTimer").onclick=()=>{clearInterval(timerInterval);timerInterval=null;timerSeconds=(Number($("timerMinutes").value)||5)*60;renderTimer();};
$("timerMinutes").addEventListener("change",()=>{timerSeconds=(Number($("timerMinutes").value)||5)*60;renderTimer();});
renderTimer();

/* ---------------- AI DEMO ---------------- */
$("aiBtn").onclick=()=>$("aiModal").classList.remove("hidden");
$("aiInsertTemplate").onclick=()=>{
  const p=$("aiPrompt").value.trim();
  const t=p ? `\nЗавдання від Sofia AI (демо):\n${p}\n\n1. __________________________________\n2. __________________________________\n3. __________________________________\n` :
  "\nSofia AI (демо): введіть опис завдання у вікні помічника.\n";
  insertTextAtCursor(t);$("aiModal").classList.add("hidden");
};
$("aiCreateShape").onclick=()=>{
  saveUndo();setStrokeStyle();ctx.beginPath();ctx.rect(220,220,180,120);ctx.stroke();
  ctx.beginPath();ctx.arc(520,280,65,0,Math.PI*2);ctx.stroke();autoSave();$("aiModal").classList.add("hidden");
};

/* ---------------- PAGES ---------------- */
function saveCurrentPage(){
  pages[currentPage]={
    drawing:canvas.toDataURL(),
    text:textLayer.innerHTML,
    objects:serializeObjects(),
    paper:$("paperType").value
  };
}
function loadPage(i){
  currentPage=i;const p=pages[i];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(p.drawing){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=p.drawing;}
  textLayer.innerHTML=p.text||"";renderObjects(p.objects||[]);
  $("paperType").value=p.paper||"grid5";applyPaper($("paperType").value);updatePageIndicator();autoSave();
}
function updatePageIndicator(){
  $("pageIndicator").textContent=`Сторінка ${currentPage+1} з ${pages.length}`;
  $("prevPageBtn").disabled=currentPage===0;$("nextPageBtn").disabled=currentPage===pages.length-1;
}
$("addPageBtn").onclick=()=>{saveCurrentPage();pages.push(blankPage());loadPage(pages.length-1)};
$("deletePageBtn").onclick=()=>{
  if(pages.length===1){alert("Має залишитися хоча б одна сторінка.");return}
  if(!confirm("Видалити поточну сторінку?"))return;
  pages.splice(currentPage,1);currentPage=Math.min(currentPage,pages.length-1);loadPage(currentPage);
};
$("prevPageBtn").onclick=()=>{if(currentPage>0){saveCurrentPage();loadPage(currentPage-1)}};
$("nextPageBtn").onclick=()=>{if(currentPage<pages.length-1){saveCurrentPage();loadPage(currentPage+1)}};
updatePageIndicator();

/* ---------------- ZOOM ---------------- */
function applyZoom(){notebook.style.transform=`scale(${zoom})`;$("zoomValue").textContent=Math.round(zoom*100)+"%";}
$("zoomIn").onclick=()=>{zoom=Math.min(1.5,zoom+.1);applyZoom()};
$("zoomOut").onclick=()=>{zoom=Math.max(.6,zoom-.1);applyZoom()};

/* ---------------- SAVE / LOAD ---------------- */
function notebookData(){
  saveCurrentPage();
  return {
    meta:{
      studentName:$("studentName").value,studentClass:$("studentClass").value,subject:$("subject").value,
      workType:$("workType").value,customWorkType:$("customWorkType").value,dateMode:$("dateMode").value
    },
    pages,currentPage
  };
}
function autoSave(){
  try{
    localStorage.setItem("sofiaNotebookPro",JSON.stringify(notebookData()));
    $("saveStatus").textContent="✅ Автозбережено "+new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
  }catch(e){$("saveStatus").textContent="⚠️ Не вдалося автозберегти (можливо, забагато великих зображень).";}
}
$("saveBtn").onclick=()=>{autoSave();alert("Збережено у цьому браузері.");};
setInterval(autoSave,30000);

function loadAll(){
  const raw=localStorage.getItem("sofiaNotebookPro");if(!raw)return;
  try{
    const d=JSON.parse(raw);pages=d.pages?.length?d.pages:[blankPage()];currentPage=Math.min(d.currentPage||0,pages.length-1);
    const m=d.meta||{};
    ["studentName","studentClass","subject","workType","customWorkType","dateMode"].forEach(k=>{if(m[k]!==undefined && $(k))$(k).value=m[k]});
    $("customWorkType").classList.toggle("hidden",$("workType").value!=="custom");
    updateHeading();loadPage(currentPage);
  }catch(e){console.warn(e)}
}
setTimeout(loadAll,150);

/* ---------------- SUBJECT DEFAULT PAPER ---------------- */
$("subject").addEventListener("change",()=>{
  const s=$("subject").value;
  const map={
    "Математика":"grid5","Алгебра":"grid5","Геометрія":"grid5","Фізика":"grid5","Хімія":"grid5",
    "Українська мова":"lines","Українська література":"lines","Англійська мова":"lines","Мистецтво":"clean"
  };
  if(map[s]){$("paperType").value=map[s];applyPaper(map[s]);autoSave();}
});
["studentName","studentClass","subject"].forEach(id=>$(id).addEventListener("change",autoSave));

function escapeHtml(s){
  return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
