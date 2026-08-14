(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const notebook = $("notebook");

  // Mark that the independent controller has loaded.
  document.documentElement.dataset.controlsVersion = "37";
  if ($("appVersionBadge")) $("appVersionBadge").textContent = "v37";

  /* ---------- FULL SCREEN v30: controls remain visible ---------- */
  let exitButton = $("v37FullscreenExit");
  if (!exitButton) {
    exitButton = document.createElement("button");
    exitButton.id = "v37FullscreenExit";
    exitButton.type = "button";
    exitButton.textContent = "↙ Вийти з повного екрана";
    document.body.appendChild(exitButton);
  }

  async function enterBoardFullscreen() {
    document.body.classList.add("board-fullscreen-v37");
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      // CSS board mode remains active even if browser blocks native Fullscreen API.
      console.warn("Native fullscreen blocked:", err);
    }
  }

  async function exitBoardFullscreen() {
    document.body.classList.remove("board-fullscreen-v37");
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch (err) {}
  }

  const fullscreenBtn = $("fullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (document.body.classList.contains("board-fullscreen-v37")) exitBoardFullscreen();
      else enterBoardFullscreen();
    }, true);
  }
  exitButton.addEventListener("click", exitBoardFullscreen);

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("board-fullscreen-v37")) {
      document.body.classList.remove("board-fullscreen-v37");
    }
  });

  /* ---------- MEDIA PANEL ---------- */
  const mediaBtn = $("mediaBtn");
  const mediaPanel = $("mediaPanel");
  if (mediaBtn && mediaPanel) {
    mediaBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      mediaPanel.classList.toggle("hidden");
    }, true);
  }

  function saveCanvas() {
    try {
      if (typeof pushHistory === "function") pushHistory();
      if (typeof autoSave === "function") autoSave();
    } catch (e) {}
  }

  function addImage(dataUrl, title = "") {
    if (window.fabric && window.fcanvas && fabric.Image) {
      fabric.Image.fromURL(dataUrl, img => {
        if (!img) return alert("Не вдалося вставити зображення.");
        const maxW = 560, maxH = 460;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        img.set({ left: 170, top: 145, scaleX: scale, scaleY: scale, selectable: true, evented: true });
        fcanvas.add(img);
        fcanvas.setActiveObject(img);
        if (title) {
          const t = new fabric.IText(title, {
            left: 170, top: 115, fontSize: 18, fill: "#17315f", erasable: false
          });
          fcanvas.add(t);
        }
        fcanvas.requestRenderAll();
        saveCanvas();
      }, { crossOrigin: "anonymous" });
      return;
    }

    // DOM fallback if Fabric is unavailable.
    const wrap = document.createElement("div");
    wrap.className = "v30-dom-image";
    wrap.style.left = "15%";
    wrap.style.top = "18%";
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title || "Зображення";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "close";
    del.textContent = "×";
    del.onclick = () => wrap.remove();
    wrap.appendChild(img);
    wrap.appendChild(del);
    notebook?.appendChild(wrap);
    makeDraggable(wrap);
  }

  function makeDraggable(element, handle = element) {
    let down = false, ox = 0, oy = 0;
    handle.addEventListener("pointerdown", e => {
      if (e.target.closest("button,a,input,video,iframe")) return;
      down = true;
      const er = element.getBoundingClientRect();
      ox = e.clientX - er.left;
      oy = e.clientY - er.top;
      handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if (!down || !notebook) return;
      const nr = notebook.getBoundingClientRect();
      let left = e.clientX - nr.left - ox;
      let top = e.clientY - nr.top - oy;
      left = Math.max(0, Math.min(nr.width - element.offsetWidth, left));
      top = Math.max(0, Math.min(nr.height - element.offsetHeight, top));
      element.style.left = (left / nr.width * 100) + "%";
      element.style.top = (top / nr.height * 100) + "%";
    });
    handle.addEventListener("pointerup", () => down = false);
  }

  function addFileCard(name, url, type = "file") {
    if (!notebook) return;
    const card = document.createElement("div");
    card.className = "v29-file-card";
    card.style.left = "22%";
    card.style.top = "25%";
    card.innerHTML = `
      <span class="icon">${type === "link" ? "🔗" : "📄"}</span>
      <div class="name">${name || "Файл"}</div>
      <div class="sub">Подвійний клік — відкрити</div>
      <button class="close" type="button">×</button>
    `;
    card.querySelector(".close").onclick = () => card.remove();
    card.ondblclick = e => {
      if (!e.target.closest("button")) window.open(url, "_blank", "noopener");
    };
    makeDraggable(card);
    notebook.appendChild(card);
  }

  function ytEmbed(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return "https://www.youtube.com/embed/" + u.pathname.replace("/", "");
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        if (id) return "https://www.youtube.com/embed/" + id;
        if (u.pathname.startsWith("/embed/")) return url;
      }
    } catch (e) {}
    return null;
  }

  function addVideo(url, title = "Відео") {
    if (!notebook) return;
    const box = document.createElement("div");
    box.className = "media-overlay";
    box.style.left = "26%";
    box.style.top = "20%";
    box.style.width = "45%";
    box.style.height = "42%";
    box.innerHTML = `
      <div class="media-overlay-bar">
        <span>${title}</span>
        <span class="media-overlay-actions">
          <button class="open" type="button">↗</button>
          <button class="close" type="button">×</button>
        </span>
      </div>
      <div class="body" style="height:calc(100% - 30px)"></div>
      <div class="media-overlay-resize"></div>
    `;
    const body = box.querySelector(".body");
    const embed = ytEmbed(url);
    if (embed) {
      const frame = document.createElement("iframe");
      frame.src = embed;
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      frame.style.cssText = "width:100%;height:100%;border:0;";
      body.appendChild(frame);
    } else {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.playsInline = true;
      video.style.cssText = "width:100%;height:100%;background:#000;";
      body.appendChild(video);
    }
    box.querySelector(".close").onclick = () => box.remove();
    box.querySelector(".open").onclick = () => window.open(url, "_blank", "noopener");
    makeDraggable(box, box.querySelector(".media-overlay-bar"));

    // resize
    const h = box.querySelector(".media-overlay-resize");
    let resize = false, sx = 0, sy = 0, sw = 0, sh = 0;
    h.addEventListener("pointerdown", e => {
      resize = true; sx = e.clientX; sy = e.clientY; sw = box.offsetWidth; sh = box.offsetHeight;
      h.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    h.addEventListener("pointermove", e => {
      if (!resize || !notebook) return;
      const nr = notebook.getBoundingClientRect();
      box.style.width = Math.max(200, sw + e.clientX - sx) / nr.width * 100 + "%";
      box.style.height = Math.max(130, sh + e.clientY - sy) / nr.height * 100 + "%";
    });
    h.addEventListener("pointerup", () => resize = false);

    notebook.appendChild(box);
  }

  function handleFile(file) {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => addImage(reader.result, file.name);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      addVideo(URL.createObjectURL(file), file.name);
    } else {
      addFileCard(file.name, URL.createObjectURL(file), "file");
    }
    mediaPanel?.classList.add("hidden");
  }

  const fileInput = $("mediaFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", e => handleFile(e.target.files?.[0]), true);
  }

  const dropZone = $("mediaDropZone");
  if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();
    ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => {
      e.preventDefault(); dropZone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => {
      e.preventDefault(); dropZone.classList.remove("dragover");
    }));
    dropZone.addEventListener("drop", e => handleFile(e.dataTransfer?.files?.[0]));
  }

  function detectType(url) {
    const s = url.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(s)) return "image";
    if (/youtu\.be|youtube\.com|\.(mp4|webm|ogg)(\?|#|$)/.test(s)) return "video";
    return "link";
  }

  function insertUrl(forced = null) {
    const input = $("mediaUrlInput");
    const url = input?.value?.trim();
    if (!url) return alert("Вставте посилання.");
    const title = $("mediaTitleInput")?.value?.trim() || "";
    let type = forced || $("mediaUrlType")?.value || "auto";
    if (type === "auto") type = detectType(url);

    if (type === "image") addImage(url, title);
    else if (type === "video") addVideo(url, title || "Відео");
    else addFileCard(title || url, url, "link");

    mediaPanel?.classList.add("hidden");
  }

  [["insertMediaUrlBtn", null], ["insertWebLinkBtn", "link"], ["insertImageUrlBtn", "image"], ["insertVideoUrlBtn", "video"]]
    .forEach(([id, type]) => {
      const b = $(id);
      if (b) b.addEventListener("click", e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        insertUrl(type);
      }, true);
    });


  /* ---------- Universal delete for inserted / drawn objects ---------- */
  function deleteActiveCanvasObject() {
    try {
      if (!window.fcanvas) return;
      const active = fcanvas.getActiveObject();
      if (!active) return;
      if (active.type === "activeSelection" && active.getObjects) {
        active.getObjects().slice().forEach(o => fcanvas.remove(o));
      } else {
        fcanvas.remove(active);
      }
      fcanvas.discardActiveObject();
      fcanvas.requestRenderAll();
      saveCanvas();
    } catch (e) {
      console.warn("Delete object:", e);
    }
  }

  let floatingDelete = $("v37ObjectDelete");
  if (!floatingDelete) {
    floatingDelete = document.createElement("button");
    floatingDelete.id = "v37ObjectDelete";
    floatingDelete.type = "button";
    floatingDelete.textContent = "×";
    floatingDelete.title = "Видалити вибраний об'єкт";
    document.body.appendChild(floatingDelete);
  }
  floatingDelete.addEventListener("click", e => {
    e.preventDefault();
    deleteActiveCanvasObject();
    floatingDelete.classList.remove("show");
  });

  function positionFloatingDelete() {
    if (!window.fcanvas) return;
    const active = fcanvas.getActiveObject();
    if (!active || !active.getBoundingRect) {
      floatingDelete.classList.remove("show");
      return;
    }
    const rect = active.getBoundingRect(true, true);
    const canvasEl = fcanvas.upperCanvasEl;
    if (!canvasEl) return;
    const cr = canvasEl.getBoundingClientRect();
    const sx = cr.width / fcanvas.getWidth();
    const sy = cr.height / fcanvas.getHeight();
    floatingDelete.style.left = (cr.left + (rect.left + rect.width) * sx - 18) + "px";
    floatingDelete.style.top = (cr.top + rect.top * sy - 18) + "px";
    floatingDelete.classList.add("show");
  }

  if (window.fcanvas) {
    fcanvas.on("selection:created", positionFloatingDelete);
    fcanvas.on("selection:updated", positionFloatingDelete);
    fcanvas.on("selection:cleared", () => floatingDelete.classList.remove("show"));
    fcanvas.on("object:moving", positionFloatingDelete);
    fcanvas.on("object:scaling", positionFloatingDelete);
    fcanvas.on("object:rotating", positionFloatingDelete);
    fcanvas.on("object:modified", positionFloatingDelete);
  }

  document.addEventListener("keydown", e => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const tag = document.activeElement?.tagName;
    if (["INPUT","TEXTAREA"].includes(tag)) return;
    if (window.fcanvas?.getActiveObject()) {
      e.preventDefault();
      deleteActiveCanvasObject();
      floatingDelete.classList.remove("show");
    }
  });


  /* ---------- v32: навчальні картки / тести ---------- */
  const learnBtn = $("quickCardsBtn");
  const learnPanel = $("learningGeneratorPanel");
  if (learnBtn && learnPanel) {
    learnBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      learnPanel.classList.toggle("hidden");
    }, true);
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function makeBlankLearningItems(mode, topic, count) {
    const arr = [];
    for (let i=1;i<=count;i++) {
      if (mode === "cards") arr.push({front:`${topic || "Тема"} — картка ${i}`,back:"Введіть відповідь / пояснення"});
      else if (mode === "quiz") arr.push({question:`Питання ${i} за темою «${topic || "Тема"}»`,options:["Варіант A","Варіант B","Варіант C","Варіант D"],answer:0});
      else if (mode === "truefalse") arr.push({question:`Твердження ${i} за темою «${topic || "Тема"}»`,answer:true});
      else arr.push({left:`Поняття ${i}`,right:`Відповідність ${i}`});
    }
    return arr;
  }

  function renderLearningPreview(items, mode) {
    const box = $("learningPreview");
    if (!box) return;
    box.innerHTML = "";
    items.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "learning-preview-card";
      if (mode === "cards") {
        card.innerHTML = `<b>${idx+1}. ${escapeHtml(item.front)}</b><div class="answer">${escapeHtml(item.back)}</div>`;
      } else if (mode === "quiz") {
        card.innerHTML = `<b>${idx+1}. ${escapeHtml(item.question)}</b><div class="answer">${(item.options||[]).map((o,i)=>`${String.fromCharCode(65+i)}. ${escapeHtml(o)}`).join("<br>")}</div>`;
      } else if (mode === "truefalse") {
        card.innerHTML = `<b>${idx+1}. ${escapeHtml(item.question)}</b><div class="answer">Відповідь: ${item.answer ? "Правда" : "Неправда"}</div>`;
      } else {
        card.innerHTML = `<b>${idx+1}. ${escapeHtml(item.left)}</b><div class="answer">↔ ${escapeHtml(item.right)}</div>`;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Вставити цю картку";
      b.onclick = () => insertLearningItem(item, mode, idx);
      card.appendChild(b);
      box.appendChild(card);
    });

    if (items.length) {
      const all = document.createElement("button");
      all.type = "button";
      all.className = "primary";
      all.textContent = "＋ Вставити все на сторінку";
      all.onclick = () => items.forEach((item, idx) => insertLearningItem(item, mode, idx, true));
      box.prepend(all);
    }
  }

  function insertLearningItem(item, mode, idx, batch=false) {
    if (!window.fcanvas || !window.fabric) {
      alert("Графічне полотно ще не готове.");
      return;
    }
    const color = "#17315f";
    const left = 120 + ((idx % 3) * 350);
    const top = 150 + (Math.floor(idx / 3) * 190);
    let text = "";
    if (mode === "cards") text = `${item.front}\n\n${item.back}`;
    else if (mode === "quiz") text = `${item.question}\n${(item.options||[]).map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join("\n")}`;
    else if (mode === "truefalse") text = `${item.question}\n□ Правда    □ Неправда`;
    else text = `${item.left}  ↔  ${item.right}`;

    const bg = new fabric.Rect({
      left:0,top:0,width:310,height:150,rx:12,ry:12,
      fill:"#ffffff",stroke:"#cfd9e7",strokeWidth:2
    });
    const tx = new fabric.Textbox(text,{
      left:14,top:14,width:282,fontSize:18,fill:color,
      fontFamily:"Arial",lineHeight:1.25,erasable:false
    });
    const g = new fabric.Group([bg,tx],{
      left,top,selectable:true,evented:true,
      learningCard:true,erasable:"deep"
    });
    fcanvas.add(g);
    if (!batch) fcanvas.setActiveObject(g);
    fcanvas.requestRenderAll();
    saveCanvas();
  }

  async function generateLearningWithAI() {
    const mode = $("learningMode")?.value || "cards";
    const topic = $("learningTopic")?.value?.trim() || "";
    const grade = $("learningGrade")?.value || "";
    const count = Math.max(2, Math.min(20, Number($("learningCount")?.value) || 6));
    const extra = $("learningExtra")?.value?.trim() || "";
    const status = $("learningGenerateStatus");

    if (!topic) {
      alert("Введіть тему.");
      return;
    }

    if (status) status.textContent = "AI створює матеріал…";

    const instruction = mode === "cards"
      ? `Створи ${count} навчальних карток. Поверни JSON масив [{"front":"...","back":"..."}].`
      : mode === "quiz"
      ? `Створи ${count} тестових питань з 4 варіантами і однією правильною відповіддю. Поверни JSON масив [{"question":"...","options":["...","...","...","..."],"answer":0}].`
      : mode === "truefalse"
      ? `Створи ${count} тверджень правда/неправда. Поверни JSON масив [{"question":"...","answer":true}].`
      : `Створи ${count} пар на відповідність. Поверни JSON масив [{"left":"...","right":"..."}].`;

    const message = `${instruction}\nТема: ${topic}.\nКлас: ${grade || "не вказано"}.\nПобажання: ${extra || "немає"}.\nБез markdown, тільки JSON.`;

    let items = null;
    try {
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message, context:{topic,grade,mode,count}})
      });
      if (!res.ok) throw new Error("AI backend unavailable");
      const data = await res.json();
      const raw = data.reply || data.message || data.content || "";
      const cleaned = String(raw).replace(/^```json\s*/i,"").replace(/```$/,"").trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) throw new Error("Wrong AI response");
      if (status) status.textContent = "Готово. Перегляньте й вставте потрібні матеріали.";
    } catch (e) {
      items = makeBlankLearningItems(mode, topic, count);
      if (status) status.textContent = "AI-сервер ще не підключений. Створено редагований шаблон; після підключення /api/chat тут будуть готові матеріали за темою.";
    }
    renderLearningPreview(items, mode);
  }

  $("generateLearningBtn")?.addEventListener("click", generateLearningWithAI);
  $("createBlankLearningBtn")?.addEventListener("click", () => {
    const mode = $("learningMode")?.value || "cards";
    const topic = $("learningTopic")?.value?.trim() || "Тема";
    const count = Math.max(2, Math.min(20, Number($("learningCount")?.value) || 6));
    renderLearningPreview(makeBlankLearningItems(mode, topic, count), mode);
  });

  /* ---------- v32: Колесо фортуни ---------- */
  const wheelBtn = $("quickWheelBtn");
  const wheelPanel = $("fortuneWheelPanel");
  const wheelCanvas = $("fortuneCanvas");
  let wheelEntries = [];
  let wheelAngle = 0;
  let wheelSpinning = false;

  if (wheelBtn && wheelPanel) {
    wheelBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      wheelPanel.classList.toggle("hidden");
      updateFortuneEntries();
    }, true);
  }
  $("fortuneCloseBtn")?.addEventListener("click", () => wheelPanel?.classList.add("hidden"));

  function normalizedWheelEntries() {
    const count = Math.max(2, Math.min(30, Number($("fortuneCount")?.value) || 8));
    let entries = ($("fortuneEntries")?.value || "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (!entries.length) entries = Array.from({length:count},(_,i)=>`Варіант ${i+1}`);
    if (entries.length < count) {
      for (let i=entries.length;i<count;i++) entries.push(`Варіант ${i+1}`);
    }
    return entries.slice(0,count);
  }

  function updateFortuneEntries() {
    wheelEntries = normalizedWheelEntries();
    drawWheel();
  }

  function wheelColor(i,n) {
    const hue = Math.round((i * 360 / n + 215) % 360);
    return `hsl(${hue} 68% ${i%2?58:68}%)`;
  }

  function drawWheel() {
    if (!wheelCanvas) return;
    const ctx = wheelCanvas.getContext("2d");
    const W=wheelCanvas.width,H=wheelCanvas.height,cx=W/2,cy=H/2,r=245;
    ctx.clearRect(0,0,W,H);
    const n = wheelEntries.length || 1;
    const slice = Math.PI*2/n;

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(wheelAngle);

    for (let i=0;i<n;i++) {
      const a0=-Math.PI/2+i*slice;
      const a1=a0+slice;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,r,a0,a1);
      ctx.closePath();
      ctx.fillStyle=wheelColor(i,n);
      ctx.fill();
      ctx.strokeStyle="#fff";
      ctx.lineWidth=3;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0+slice/2);
      ctx.translate(r*0.62,0);
      ctx.rotate(Math.PI/2);
      ctx.fillStyle="#102345";
      ctx.font=`700 ${n>18?12:n>12?14:17}px Arial`;
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      let txt=wheelEntries[i];
      if(txt.length>22)txt=txt.slice(0,20)+"…";
      ctx.fillText(txt,0,0,r*0.62);
      ctx.restore();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx,cy,70,0,Math.PI*2);
    ctx.fillStyle="#17315f";
    ctx.fill();
    ctx.strokeStyle="#fff";
    ctx.lineWidth=7;
    ctx.stroke();
  }

  function easeOutCubic(t){return 1-Math.pow(1-t,3)}

  function spinFortune() {
    if (wheelSpinning || wheelEntries.length<2) return;
    wheelSpinning=true;
    const n=wheelEntries.length;
    const slice=Math.PI*2/n;
    const chosen=Math.floor(Math.random()*n);

    // Sector center should end under pointer at -PI/2.
    const sectorCenter=-Math.PI/2+(chosen+.5)*slice;
    const current=((wheelAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    let desired=(-Math.PI/2-sectorCenter)%(Math.PI*2);
    if(desired<0)desired+=Math.PI*2;
    let delta=desired-current;
    if(delta<0)delta+=Math.PI*2;
    delta+=Math.PI*2*(5+Math.floor(Math.random()*3));

    const start=performance.now(),duration=4300,startAngle=wheelAngle;
    const animate=now=>{
      const t=Math.min(1,(now-start)/duration);
      wheelAngle=startAngle+delta*easeOutCubic(t);
      drawWheel();
      if(t<1)requestAnimationFrame(animate);
      else{
        wheelSpinning=false;
        const result=wheelEntries[chosen];
        if($("fortuneResult"))$("fortuneResult").textContent=result;
        if($("fortuneRemoveWinner")?.checked && wheelEntries.length>2){
          const lines=($("fortuneEntries")?.value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
          const idx=lines.indexOf(result);
          if(idx>=0){
            lines.splice(idx,1);
            $("fortuneEntries").value=lines.join("\n");
            $("fortuneCount").value=Math.max(2,lines.length);
            updateFortuneEntries();
          }
        }
      }
    };
    requestAnimationFrame(animate);
  }

  $("fortuneApplyBtn")?.addEventListener("click",updateFortuneEntries);
  $("fortuneCount")?.addEventListener("change",updateFortuneEntries);
  $("fortuneEntries")?.addEventListener("input",()=>{
    clearTimeout(window.__fortuneDelay);
    window.__fortuneDelay=setTimeout(updateFortuneEntries,250);
  });
  $("fortuneShuffleBtn")?.addEventListener("click",()=>{
    const arr=normalizedWheelEntries();
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    $("fortuneEntries").value=arr.join("\n");
    $("fortuneCount").value=arr.length;
    updateFortuneEntries();
  });
  $("fortuneSpinBtn")?.addEventListener("click",spinFortune);
  updateFortuneEntries();


  /* ---------- v33 quick visible buttons ---------- */
$("quickWheelBtn")?.addEventListener("click", e=>{
    e.preventDefault(); e.stopImmediatePropagation();
    $("fortuneWheelPanel")?.classList.toggle("hidden");
    if (typeof updateFortuneEntries === "function") updateFortuneEntries();
  }, true);
  $("quickTableBtn")?.addEventListener("click", e=>{
    e.preventDefault(); e.stopImmediatePropagation();
    $("tableBuilderPanel")?.classList.toggle("hidden");
  }, true);
  $("quickAIImageBtn")?.addEventListener("click", e=>{
    e.preventDefault(); e.stopImmediatePropagation();
    $("aiImagePanel")?.classList.toggle("hidden");
  }, true);

  /* ---------- v33 local table builder ---------- */
  $("tableBuilderCloseBtn")?.addEventListener("click",()=>$("tableBuilderPanel")?.classList.add("hidden"));
  $("insertTableBuilderBtn")?.addEventListener("click",()=>{
    if(!window.fcanvas || !window.fabric){alert("Полотно ще не готове.");return;}
    const rows=Math.max(1,Math.min(20,Number($("tableRows")?.value)||4));
    const cols=Math.max(1,Math.min(12,Number($("tableCols")?.value)||4));
    const totalW=Math.max(300,Number($("tableWidth")?.value)||650);
    const cellW=totalW/cols, cellH=56;
    const header=$("tableHeaderRow")?.checked;
    const objects=[];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const rect=new fabric.Rect({
          left:c*cellW,top:r*cellH,width:cellW,height:cellH,
          fill:header&&r===0?"#eef4fb":"#ffffff",
          stroke:"#17315f",strokeWidth:1
        });
        const text=new fabric.IText(header&&r===0?`Заголовок ${c+1}`:"",{
          left:c*cellW+8,top:r*cellH+16,fontSize:16,fill:"#17315f",
          fontFamily:"Arial",erasable:false
        });
        objects.push(rect,text);
      }
    }
    const group=new fabric.Group(objects,{left:180,top:180,selectable:true,evented:true,erasable:"deep"});
    fcanvas.add(group);fcanvas.setActiveObject(group);fcanvas.requestRenderAll();
    saveCanvas();
    $("tableBuilderPanel")?.classList.add("hidden");
  });

  /* ---------- v33 AI image ---------- */
  $("aiImageCloseBtn")?.addEventListener("click",()=>$("aiImagePanel")?.classList.add("hidden"));
  $("generateAIImageBtn")?.addEventListener("click",async()=>{
    const prompt=$("aiImagePrompt")?.value?.trim();
    if(!prompt){alert("Опишіть, яке зображення потрібно створити.");return;}
    const status=$("aiImageStatus"),preview=$("aiImagePreview");
    if(status)status.textContent="AI створює зображення…";
    if(preview)preview.innerHTML="";
    try{
      const res=await fetch("/api/image",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          prompt,
          ratio:$("aiImageRatio")?.value||"square",
          style:$("aiImageStyle")?.value||"Навчальна ілюстрація"
        })
      });
      if(!res.ok)throw new Error("AI image backend unavailable");
      const data=await res.json();
      const url=data.url||data.image_url||data.image;
      if(!url)throw new Error("No image returned");
      if(status)status.textContent="Готово.";
      if(preview){
        const img=document.createElement("img");img.src=url;img.alt=prompt;
        const b=document.createElement("button");b.type="button";b.className="insert-ai-image";b.textContent="＋ Вставити на сторінку";
        b.onclick=()=>addImage(url,prompt.slice(0,60));
        preview.append(img,b);
      }
    }catch(err){
      if(status)status.textContent="Генерація ще не підключена. Потрібно налаштувати захищений /api/image. Інтерфейс уже готовий.";
    }
  });

  /* ---------- Basic button diagnostics ---------- */
  const diagnosticButton = $("diagnosticsBtn");
  if (diagnosticButton) {
    diagnosticButton.addEventListener("click", () => {
      setTimeout(() => {
        const box = $("diagnosticsResults");
        if (!box) return;
        const checks = [
          ["Повний екран", !!$("fullscreenBtn")],
          ["Медіа", !!$("mediaBtn") && !!$("mediaPanel") && !!$("mediaFileInput")],
          ["Калькулятор", !!$("calculatorBtn") && !!$("calculatorPanel")],
          ["Таймер", !!$("timerBtn") && !!$("timerPanel")],
          ["Клавіатура", !!$("keyboardBtn") && !!$("keyboardPanel")],
          ["Графіки", !!$("graphBuilderBtn") && !!$("graphBuilderPanel")],
          ["Картки / тест", !!$("teacherToolsBtn") && !!$("teacherToolsPanel")],
          ["Колесо фортуни", !!$("teacherToolsBtn") && !!$("teacherToolsPanel")],
          ["Таблиці", !!$("quickTableBtn") && !!$("tableBuilderPanel")],
          ["AI-зображення", !!$("quickAIImageBtn") && !!$("aiImagePanel")]
        ];
        checks.forEach(([name, ok]) => {
          const row = document.createElement("div");
          row.className = "diag-row " + (ok ? "ok" : "bad");
          row.innerHTML = `<span>${ok ? "✅" : "❌"} ${name} v31</span><small>${ok ? "готово" : "не знайдено"}</small>`;
          box.appendChild(row);
        });
      }, 50);
    }, true);
  }
  /* ---------- v34 critical feature rebinding ---------- */
  const canvasReady = () => !!window.fcanvas && !!window.fabric;

  function togglePanel(id){
    const p=$(id);
    if(!p){ alert("Панель не знайдена: "+id); return; }
    p.classList.toggle("hidden");
  }

  $("quickTableBtn")?.addEventListener("click",e=>{
    e.preventDefault();e.stopImmediatePropagation();togglePanel("tableBuilderPanel");
  },true);
  $("quickAIImageBtn")?.addEventListener("click",e=>{
    e.preventDefault();e.stopImmediatePropagation();togglePanel("aiImagePanel");
  },true);

  /* Compass circle button was present but had no handler in v33 */
  $("drawCircleFromCompass")?.addEventListener("click",()=>{
    if(!canvasReady())return alert("Полотно ще не готове.");
    const radiusEl=$("compassRadius");
    const px=Math.max(20,Number(radiusEl?.value)||120);
    const circle=new fabric.Circle({
      left:300,top:220,radius:px,
      fill:"transparent",
      stroke:$("colorPicker")?.value||"#17315f",
      strokeWidth:Number($("lineWidth")?.value)||2,
      selectable:true,evented:true
    });
    fcanvas.add(circle);fcanvas.setActiveObject(circle);fcanvas.requestRenderAll();
    try{ if(typeof pushHistory==="function")pushHistory(); if(typeof autoSave==="function")autoSave(); }catch(e){}
  });

  /* Better runtime status */
  window.addEventListener("load",()=>{
    const missing=[];
    [
      ["Картки / тест","quickCardsBtn","learningGeneratorPanel"],
      ["Колесо","quickWheelBtn","fortuneWheelPanel"],
      ["Таблиця","quickTableBtn","tableBuilderPanel"],
      ["AI-зображення","quickAIImageBtn","aiImagePanel"],
      ["Медіа","mediaBtn","mediaPanel"],
      ["Повний екран","fullscreenBtn","pageViewport"]
    ].forEach(([name,b,p])=>{ if(!$(b)||!$(p))missing.push(name); });
    if(!canvasReady())missing.push("Графічне полотно");
    if(missing.length)console.warn("v34 missing features:",missing);
  });

})();