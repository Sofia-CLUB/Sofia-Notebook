
(function(){
"use strict";
const q=id=>document.getElementById(id);
function make(tag,attrs={},html=""){
  const el=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{if(k==="class")el.className=v;else el.setAttribute(k,v)});
  if(html)el.innerHTML=html;
  return el;
}
function show(el,on=true){el?.classList.toggle("hidden",!on)}
function safeText(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function getCanvas(){try{return window.fcanvas||fcanvas}catch(e){return null}}
function addTextToBoard(text, opts={}){
  try{
    if(typeof insertTextIntoBoard==="function"){insertTextIntoBoard(text);return true}
  }catch(e){}
  const c=getCanvas();
  if(c && window.fabric){
    const t=new fabric.Textbox(text,{left:opts.left||300,top:opts.top||180,width:opts.width||520,
      fontSize:opts.fontSize||24,fill:"#17315f",fontFamily:"Arial",editable:true});
    c.add(t);c.setActiveObject(t);c.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
    return true;
  }
  return false;
}

/* Top button */
const top=document.querySelector(".top-actions");
if(!top || q("teacherToolsBtn")) return;
const btn=make("button",{id:"teacherToolsBtn",type:"button",class:"top-btn"},"🎓 Інструменти");
const aiBtn=q("aiBtn");
if(aiBtn)top.insertBefore(btn,aiBtn); else top.appendChild(btn);

const translateTopBtn=make("button",{id:"translateTopBtn",type:"button",class:"top-btn"},"🌐 Перекладач");
if(aiBtn)top.insertBefore(translateTopBtn,aiBtn); else top.appendChild(translateTopBtn);

/* Panel */
const panel=make("div",{id:"teacherToolsPanel",class:"tt31-panel hidden"});
panel.innerHTML=`
  <div class="tt31-head">
    <div><b>🎓 Інструменти вчителя</b><span>колесо фортуни • картки • тест • списки • перекладач • зображення</span></div>
    <button class="tt31-close" id="teacherToolsClose">×</button>
  </div>
  <div class="tt31-tabs">
    <button class="active" data-tt31="wheel">🎡 Колесо</button>
    <button data-tt31="cards">🃏 Картки</button>
    <button data-tt31="test">✅ Тест</button>
    <button data-tt31="lists">☷ Списки</button>
    <button data-tt31="translate">🌐 Перекладач</button>
    <button data-tt31="image">🖼 Зображення</button>
  </div>

  <section class="tt31-section" data-tt31-section="wheel">
    <label>Учасники / слова / завдання — по одному в рядку
      <textarea id="tt31WheelItems" rows="7">Команда 1
Команда 2
Команда 3
Команда 4</textarea>
    </label>
    <div class="tt31-wheel-wrap">
      <div class="tt31-pointer"></div>
      <div id="tt31Wheel" class="tt31-wheel"></div>
    </div>
    <div id="tt31WheelResult" class="tt31-result"></div>
    <div class="tt31-actions"><button id="tt31Spin" class="tt31-primary">🎡 Крутити колесо</button><button id="tt31RemoveWinner">Прибрати переможця</button></div>
  </section>

  <section class="tt31-section hidden" data-tt31-section="cards">
    <label>Картки: одна картка в рядку. Формат «Питання | Відповідь»
      <textarea id="tt31CardsInput" rows="7" placeholder="2+2 | 4&#10;Столиця України | Київ"></textarea>
    </label>
    <div class="tt31-actions">
      <button id="tt31MakeCards" class="tt31-primary">Створити картки</button>
      <button id="tt31CardsAI">✨ Створити з AI</button>
      <button id="tt31CardsToBoard">Вставити всі на дошку</button>
    </div>
    <div id="tt31CardsGrid" class="tt31-card-grid"></div>
  </section>

  <section class="tt31-section hidden" data-tt31-section="test">
    <label>Тема тесту <input id="tt31TestTopic" placeholder="Напр.: Дроби, 5 клас"></label>
    <label>Кількість питань
      <select id="tt31TestCount"><option>3</option><option selected>5</option><option>10</option></select>
    </label>
    <div class="tt31-actions">
      <button id="tt31CreateTestAI" class="tt31-primary">✨ Створити тест з AI</button>
      <button id="tt31ClearTest">Очистити</button>
    </div>
    <div id="tt31TestArea"></div>
    <div id="tt31TestScore" class="tt31-score"></div>
  </section>

  <section class="tt31-section hidden" data-tt31-section="lists">
    <label>Елементи списку — кожен з нового рядка
      <textarea id="tt31ListInput" rows="7" placeholder="Перший пункт&#10;Другий пункт&#10;Третій пункт"></textarea>
    </label>
    <div class="tt31-list-row">
      <label>Тип
        <select id="tt31ListType">
          <option value="number">1. Нумерований</option>
          <option value="bullet">• Маркований</option>
          <option value="check">☐ Чекліст</option>
          <option value="letter">A. Літерний</option>
          <option value="roman">I. Римський</option>
        </select>
      </label>
      <label>Почати з <input id="tt31ListStart" type="number" value="1" min="1"></label>
    </div>
    <div id="tt31ListPreview" class="tt31-list-preview">Список з’явиться тут</div>
    <div class="tt31-actions"><button id="tt31InsertList" class="tt31-primary">Вставити список на дошку</button></div>
  </section>


  <section class="tt31-section hidden" data-tt31-section="translate">
    <div class="tt32-lang-row">
      <label>З мови
        <select id="tt32SourceLang">
          <option value="auto">Визначити автоматично</option>
          <option value="uk">Українська</option>
          <option value="en">Англійська</option>
          <option value="pl">Польська</option>
          <option value="de">Німецька</option>
          <option value="fr">Французька</option>
          <option value="es">Іспанська</option>
          <option value="it">Італійська</option>
          <option value="cs">Чеська</option>
          <option value="sk">Словацька</option>
          <option value="ro">Румунська</option>
          <option value="hu">Угорська</option>
          <option value="tr">Турецька</option>
        </select>
      </label>
      <button id="tt32SwapLangs" class="tt32-swap" title="Поміняти мови місцями">⇄</button>
      <label>На мову
        <select id="tt32TargetLang">
          <option value="en">Англійська</option>
          <option value="uk">Українська</option>
          <option value="pl">Польська</option>
          <option value="de">Німецька</option>
          <option value="fr">Французька</option>
          <option value="es">Іспанська</option>
          <option value="it">Італійська</option>
          <option value="cs">Чеська</option>
          <option value="sk">Словацька</option>
          <option value="ro">Румунська</option>
          <option value="hu">Угорська</option>
          <option value="tr">Турецька</option>
        </select>
      </label>
    </div>
    <label>Слово або текст
      <textarea id="tt32TranslateInput" rows="5" placeholder="Введіть слово/текст або натисніть «Взяти виділене»"></textarea>
    </label>
    <div class="tt31-actions">
      <button id="tt32TakeSelected">✂ Взяти виділене</button>
      <button id="tt32TranslateBtn" class="tt31-primary">🌐 Перекласти</button>
    </div>
    <div class="tt32-selected-note" id="tt32SelectionInfo">Можна виділити слово або частину тексту прямо в зошиті.</div>
    <div id="tt32TranslateResult" class="tt32-translate-result">Переклад з’явиться тут.</div>
    <div class="tt31-actions">
      <button id="tt32InsertTranslation" disabled>Вставити переклад на дошку</button>
      <button id="tt32ReplaceSelected" disabled>Замінити виділене</button>
      <button id="tt32CopyTranslation" disabled>Копіювати</button>
    </div>
  </section>

  <section class="tt31-section hidden" data-tt31-section="image">
    <label>Опишіть зображення
      <textarea id="tt31ImagePrompt" rows="4" placeholder="Напр.: яскрава навчальна ілюстрація Сонячної системи для 5 класу, підписи українською"></textarea>
    </label>
    <label>Розмір
      <select id="tt31ImageSize"><option>1024x1024</option><option>1024x768</option><option>768x1024</option><option>512x512</option></select>
    </label>
    <div class="tt31-actions">
      <button id="tt31GenerateImage" class="tt31-primary">🖼 Згенерувати</button>
      <button id="tt31InsertImage" disabled>Вставити на дошку</button>
    </div>
    <div id="tt31ImageStatus" class="tt31-muted">Для генерації використовується окремий endpoint /api/image.</div>
    <div id="tt31ImagePreview" class="tt31-image-preview">Попередній перегляд</div>
  </section>
`;
document.body.appendChild(panel);

btn.onclick=()=>panel.classList.toggle("hidden");
q("teacherToolsClose").onclick=()=>panel.classList.add("hidden");

document.querySelectorAll("[data-tt31]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-tt31]").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll("[data-tt31-section]").forEach(s=>show(s,s.dataset.tt31Section===b.dataset.tt31));
});

/* AI panel shortcut buttons */
const aiCompose=document.querySelector("#aiPanel .ai-compose");
if(aiCompose && !q("tt31AiTools")){
  const tools=make("div",{id:"tt31AiTools",class:"tt31-ai-tools"});
  tools.innerHTML=`<button type="button" data-open-tool="image">🖼 Створити зображення</button>
  <button type="button" data-open-tool="cards">🃏 Картки</button>
  <button type="button" data-open-tool="test">✅ Тест</button>
  <button type="button" data-open-tool="translate">🌐 Перекладач</button>
  <button type="button" data-open-tool="wheel">🎡 Колесо</button>`;
  aiCompose.parentNode.insertBefore(tools,aiCompose);
  tools.querySelectorAll("[data-open-tool]").forEach(x=>x.onclick=()=>{
    q("aiPanel")?.classList.add("hidden");
    panel.classList.remove("hidden");
    const target=x.dataset.openTool;
    panel.querySelector(`[data-tt31="${target}"]`)?.click();
  });
}

/* Wheel */
let lastWinner="";
function wheelItems(){return q("tt31WheelItems").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function renderWheel(){
  const items=wheelItems(),n=Math.max(1,items.length);
  const colors=["#17315f","#5b6fd8","#f0a23a","#38a786","#d95467","#8f5bd7","#2c8ecb","#6a8f4e"];
  let stops=[];
  items.forEach((_,i)=>{
    const a=i*360/n,b=(i+1)*360/n;stops.push(`${colors[i%colors.length]} ${a}deg ${b}deg`);
  });
  q("tt31Wheel").style.background=`conic-gradient(${stops.join(",")})`;
}
q("tt31WheelItems").addEventListener("input",renderWheel);renderWheel();
q("tt31Spin").onclick=()=>{
  const items=wheelItems();if(!items.length)return;
  const idx=Math.floor(Math.random()*items.length);lastWinner=items[idx];
  const deg=1440+Math.floor(Math.random()*360);
  q("tt31Wheel").style.transform=`rotate(${deg}deg)`;
  q("tt31WheelResult").textContent="Крутимо…";
  setTimeout(()=>q("tt31WheelResult").textContent=`🎉 ${lastWinner}`,3600);
};
q("tt31RemoveWinner").onclick=()=>{
  if(!lastWinner)return;
  const items=wheelItems().filter(x=>x!==lastWinner);
  q("tt31WheelItems").value=items.join("\n");lastWinner="";q("tt31WheelResult").textContent="";renderWheel();
};

/* Cards */
let currentCards=[];
function parseCards(text){
  return text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>{
    const [front,...rest]=line.split("|");return{front:front.trim(),back:(rest.join("|").trim()||"Натисніть, щоб перевернути")};
  });
}
function renderCards(){
  currentCards=parseCards(q("tt31CardsInput").value);
  const grid=q("tt31CardsGrid");grid.innerHTML="";
  currentCards.forEach((c,i)=>{
    const el=make("div",{class:"tt31-card"});
    el.innerHTML=`<div><b>${safeText(c.front)}</b><small>Натисніть, щоб перевернути</small></div>`;
    let back=false;
    el.onclick=()=>{back=!back;el.innerHTML=back?`<div>${safeText(c.back)}<small>Відповідь</small></div>`:`<div><b>${safeText(c.front)}</b><small>Натисніть, щоб перевернути</small></div>`};
    grid.appendChild(el);
  });
}
q("tt31MakeCards").onclick=renderCards;
q("tt31CardsToBoard").onclick=()=>{
  if(!currentCards.length)renderCards();
  const text=currentCards.map((c,i)=>`${i+1}. ${c.front}\n   ${c.back}`).join("\n\n");
  addTextToBoard(text,{width:600,fontSize:22});
};
q("tt31CardsAI").onclick=async()=>{
  const topic=prompt("Тема карток:","");
  if(!topic)return;
  q("tt31CardsAI").disabled=true;q("tt31CardsAI").textContent="Створюю…";
  try{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message:`Створи 8 навчальних карток на тему "${topic}". Поверни ЛИШЕ рядки у форматі: Питання | Відповідь. Без нумерації та пояснень.`,
      context:{subject:q("subject")?.value||"",grade:q("studentClass")?.value||"",workType:"Навчальні картки"}
    })});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"AI error");
    q("tt31CardsInput").value=data.reply||data.message||data.answer||"";renderCards();
  }catch(e){alert("Не вдалося створити картки: "+e.message)}
  finally{q("tt31CardsAI").disabled=false;q("tt31CardsAI").textContent="✨ Створити з AI"}
};

/* Test */
let testData=[],score=0,answered=0;
function renderTest(){
  score=0;answered=0;q("tt31TestScore").textContent="";
  const area=q("tt31TestArea");area.innerHTML="";
  testData.forEach((item,idx)=>{
    const box=make("div",{class:"tt31-test-box"});
    box.innerHTML=`<div class="tt31-test-q">${idx+1}. ${safeText(item.q)}</div><div class="tt31-options"></div>`;
    const opts=box.querySelector(".tt31-options");
    item.options.forEach((o,oi)=>{
      const b=make("button",{} ,safeText(o));
      b.onclick=()=>{
        if(box.dataset.done)return;box.dataset.done="1";answered++;
        if(oi===item.correct){score++;b.style.background="#e8f7ef"}else{b.style.background="#fff0f0";opts.children[item.correct].style.background="#e8f7ef"}
        q("tt31TestScore").textContent=`Результат: ${score} / ${answered}`;
      };
      opts.appendChild(b);
    });
    area.appendChild(box);
  });
}
function parseTestJson(text){
  const cleaned=text.replace(/```json|```/g,"").trim();
  const data=JSON.parse(cleaned);
  if(!Array.isArray(data))throw new Error("Очікувався масив");
  return data.map(x=>({q:String(x.q||x.question||""),options:(x.options||[]).map(String),correct:Number(x.correct)}))
    .filter(x=>x.q&&x.options.length>=2&&x.correct>=0&&x.correct<x.options.length);
}
q("tt31CreateTestAI").onclick=async()=>{
  const topic=q("tt31TestTopic").value.trim();if(!topic){alert("Вкажіть тему тесту.");return}
  const count=Number(q("tt31TestCount").value)||5;
  q("tt31CreateTestAI").disabled=true;q("tt31CreateTestAI").textContent="Створюю…";
  try{
    const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message:`Створи тест на тему "${topic}" з ${count} питань. У кожному 4 варіанти і лише 1 правильний. Поверни ЛИШЕ валідний JSON-масив без markdown: [{"q":"...","options":["...","...","...","..."],"correct":0}]`,
      context:{subject:q("subject")?.value||"",grade:q("studentClass")?.value||"",workType:"Тестування"}
    })});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"AI error");
    testData=parseTestJson(data.reply||data.message||data.answer||"");renderTest();
  }catch(e){alert("Не вдалося створити тест. Спробуйте ще раз. "+e.message)}
  finally{q("tt31CreateTestAI").disabled=false;q("tt31CreateTestAI").textContent="✨ Створити тест з AI"}
};
q("tt31ClearTest").onclick=()=>{testData=[];q("tt31TestArea").innerHTML="";q("tt31TestScore").textContent=""};

/* Lists */
function roman(n){const m=[["M",1000],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]];let r="";for(const [s,v] of m)while(n>=v){r+=s;n-=v}return r}
function listText(){
  const items=q("tt31ListInput").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const type=q("tt31ListType").value,start=Math.max(1,Number(q("tt31ListStart").value)||1);
  return items.map((x,i)=>{
    const n=start+i;
    const p=type==="number"?`${n}.`:type==="bullet"?"•":type==="check"?"☐":type==="letter"?`${String.fromCharCode(64+((n-1)%26)+1)}.`:`${roman(n)}.`;
    return `${p} ${x}`;
  }).join("\n");
}
function updateListPreview(){q("tt31ListPreview").textContent=listText()||"Список з’явиться тут"}
["tt31ListInput","tt31ListType","tt31ListStart"].forEach(id=>q(id).addEventListener("input",updateListPreview));
q("tt31InsertList").onclick=()=>{const t=listText();if(t)addTextToBoard(t,{width:560,fontSize:24})};


/* Translator v32 */
const langNames={
  auto:"автоматично визначеної мови",uk:"української",en:"англійської",pl:"польської",
  de:"німецької",fr:"французької",es:"іспанської",it:"італійської",cs:"чеської",
  sk:"словацької",ro:"румунської",hu:"угорської",tr:"турецької"
};
let tt32LastTranslation="";
let tt32SelectionRef=null;

function tt32GetSelectedText(){
  // 1) Fabric text selection
  const c=getCanvas();
  const o=c?.getActiveObject?.();
  if(o && ["i-text","textbox","text"].includes(o.type)){
    const a=Number(o.selectionStart??0), b=Number(o.selectionEnd??0);
    if(b>a){
      tt32SelectionRef={kind:"fabric",object:o,start:a,end:b};
      return String(o.text||"").slice(a,b);
    }
    // if editing but no selection, try current word around cursor
    if(o.isEditing && typeof o.text==="string"){
      const pos=a;
      const left=o.text.slice(0,pos).search(/[^\s.,;:!?()[\]{}"'“”«»\-–—]+$/);
      const rightMatch=o.text.slice(pos).match(/^[^\s.,;:!?()[\]{}"'“”«»\-–—]+/);
      if(left>=0 || rightMatch){
        const start=left>=0?left:pos;
        const end=rightMatch?pos+rightMatch[0].length:pos;
        if(end>start){
          tt32SelectionRef={kind:"fabric",object:o,start,end};
          return o.text.slice(start,end);
        }
      }
    }
  }

  // 2) Normal DOM selection
  const sel=window.getSelection?.();
  const text=sel?.toString?.().trim()||"";
  if(text){
    tt32SelectionRef={kind:"dom",text};
    return text;
  }
  tt32SelectionRef=null;
  return "";
}

function tt32OpenTranslator(){
  panel.classList.remove("hidden");
  panel.querySelector('[data-tt31="translate"]')?.click();
  const selected=tt32GetSelectedText();
  if(selected){
    q("tt32TranslateInput").value=selected;
    q("tt32SelectionInfo").textContent=`Виділено: ${selected.length>80?selected.slice(0,80)+"…":selected}`;
  }
}
translateTopBtn.onclick=tt32OpenTranslator;

q("tt32TakeSelected").onclick=()=>{
  const selected=tt32GetSelectedText();
  if(!selected){
    q("tt32SelectionInfo").textContent="Нічого не виділено. Виділіть слово або текст у зошиті.";
    return;
  }
  q("tt32TranslateInput").value=selected;
  q("tt32SelectionInfo").textContent=`Виділено: ${selected.length>100?selected.slice(0,100)+"…":selected}`;
};

q("tt32SwapLangs").onclick=()=>{
  const s=q("tt32SourceLang"),t=q("tt32TargetLang");
  if(s.value==="auto"){s.value=t.value;t.value="uk";}
  else{const x=s.value;s.value=t.value;t.value=x;}
};

q("tt32TranslateBtn").onclick=async()=>{
  const text=q("tt32TranslateInput").value.trim();
  if(!text){alert("Введіть слово або текст для перекладу.");return}
  const src=q("tt32SourceLang").value, trg=q("tt32TargetLang").value;
  q("tt32TranslateBtn").disabled=true;
  q("tt32TranslateBtn").textContent="Перекладаю…";
  q("tt32TranslateResult").textContent="Перекладаю…";
  try{
    const srcInstruction=src==="auto"?"самостійно визнач мову оригіналу":`оригінал ${langNames[src]||src}`;
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:`Переклади наведений текст на ${langNames[trg]||trg}. ${srcInstruction}. Поверни ТІЛЬКИ переклад, без пояснень, лапок і приміток.\n\nТекст:\n${text}`,
        context:{subject:"Переклад",grade:q("studentClass")?.value||"",workType:"Перекладач"}
      })
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Помилка перекладу");
    tt32LastTranslation=(data.reply||data.message||data.answer||"").trim();
    if(!tt32LastTranslation)throw new Error("Порожня відповідь");
    q("tt32TranslateResult").textContent=tt32LastTranslation;
    q("tt32InsertTranslation").disabled=false;
    q("tt32CopyTranslation").disabled=false;
    q("tt32ReplaceSelected").disabled=!(tt32SelectionRef?.kind==="fabric");
  }catch(e){
    tt32LastTranslation="";
    q("tt32TranslateResult").textContent="Не вдалося перекласти: "+e.message;
    q("tt32InsertTranslation").disabled=true;
    q("tt32CopyTranslation").disabled=true;
    q("tt32ReplaceSelected").disabled=true;
  }finally{
    q("tt32TranslateBtn").disabled=false;
    q("tt32TranslateBtn").textContent="🌐 Перекласти";
  }
};

q("tt32InsertTranslation").onclick=()=>{
  if(tt32LastTranslation)addTextToBoard(tt32LastTranslation,{width:560,fontSize:24});
};

q("tt32CopyTranslation").onclick=async()=>{
  if(!tt32LastTranslation)return;
  try{
    await navigator.clipboard.writeText(tt32LastTranslation);
    q("tt32CopyTranslation").textContent="✓ Скопійовано";
    setTimeout(()=>q("tt32CopyTranslation").textContent="Копіювати",1200);
  }catch(e){
    alert("Не вдалося скопіювати автоматично.");
  }
};

q("tt32ReplaceSelected").onclick=()=>{
  if(!tt32LastTranslation || tt32SelectionRef?.kind!=="fabric")return;
  const {object,start,end}=tt32SelectionRef;
  if(!object || typeof object.text!=="string")return;
  object.text=object.text.slice(0,start)+tt32LastTranslation+object.text.slice(end);
  object.selectionStart=start;
  object.selectionEnd=start+tt32LastTranslation.length;
  object.dirty=true;
  object.setCoords?.();
  getCanvas()?.requestRenderAll?.();
  try{pushHistory();autoSave()}catch(e){}
  q("tt32SelectionInfo").textContent="✓ Виділений текст замінено перекладом.";
};

/* Image generation */
let lastImageSrc="";
q("tt31GenerateImage").onclick=async()=>{
  const prompt=q("tt31ImagePrompt").value.trim();if(!prompt){alert("Опишіть зображення.");return}
  q("tt31GenerateImage").disabled=true;q("tt31GenerateImage").textContent="Генерую…";
  q("tt31ImageStatus").textContent="Створюю зображення…";
  try{
    const res=await fetch("/api/image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      prompt,size:q("tt31ImageSize").value
    })});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"Image API error");
    lastImageSrc=data.url || (data.b64_json?`data:image/png;base64,${data.b64_json}`:"");
    if(!lastImageSrc)throw new Error("Зображення не отримано");
    q("tt31ImagePreview").innerHTML=`<img src="${lastImageSrc}" alt="AI image">`;
    q("tt31InsertImage").disabled=false;q("tt31ImageStatus").textContent="Готово.";
  }catch(e){
    q("tt31ImageStatus").textContent="Не вдалося згенерувати: "+e.message;
  }finally{
    q("tt31GenerateImage").disabled=false;q("tt31GenerateImage").textContent="🖼 Згенерувати";
  }
};
q("tt31InsertImage").onclick=()=>{
  if(!lastImageSrc)return;
  const c=getCanvas();
  if(c&&window.fabric){
    fabric.Image.fromURL(lastImageSrc,img=>{
      const maxW=520,maxH=420,s=Math.min(maxW/img.width,maxH/img.height,1);
      img.set({left:320,top:180,scaleX:s,scaleY:s,crossOrigin:"anonymous"});
      c.add(img);c.setActiveObject(img);c.requestRenderAll();
      try{pushHistory();autoSave();setTool("select")}catch(e){}
    },{crossOrigin:"anonymous"});
  }else alert("Не знайдено полотно для вставлення.");
};
})();
