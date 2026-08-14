(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const notebook = $("notebook");

  // Mark that the independent controller has loaded.
  document.documentElement.dataset.controlsVersion = "29";
  if ($("appVersionBadge")) $("appVersionBadge").textContent = "v29";

  /* ---------- FULL SCREEN ---------- */
  let exitButton = $("v29FullscreenExit");
  if (!exitButton) {
    exitButton = document.createElement("button");
    exitButton.id = "v29FullscreenExit";
    exitButton.type = "button";
    exitButton.textContent = "↙ Вийти з повного екрана";
    document.body.appendChild(exitButton);
  }

  async function enterBoardFullscreen() {
    document.body.classList.add("board-fullscreen");
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      // CSS full-screen workspace still works even if browser blocks native Fullscreen API.
      console.warn("Native fullscreen blocked:", err);
    }
  }

  async function exitBoardFullscreen() {
    document.body.classList.remove("board-fullscreen");
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch (err) {}
  }

  const fullscreenBtn = $("fullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (document.body.classList.contains("board-fullscreen")) exitBoardFullscreen();
      else enterBoardFullscreen();
    }, true);
  }
  exitButton.addEventListener("click", exitBoardFullscreen);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && document.body.classList.contains("board-fullscreen")) {
      document.body.classList.remove("board-fullscreen");
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
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title || "Зображення";
    img.style.cssText = "position:absolute;left:15%;top:18%;max-width:50%;max-height:55%;z-index:60;border:2px solid #17315f;border-radius:8px;";
    notebook?.appendChild(img);
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
          ["Графіки", !!$("graphBuilderBtn") && !!$("graphBuilderPanel")]
        ];
        checks.forEach(([name, ok]) => {
          const row = document.createElement("div");
          row.className = "diag-row " + (ok ? "ok" : "bad");
          row.innerHTML = `<span>${ok ? "✅" : "❌"} ${name} v29</span><small>${ok ? "готово" : "не знайдено"}</small>`;
          box.appendChild(row);
        });
      }, 50);
    }, true);
  }
})();