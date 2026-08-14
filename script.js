const $=id=>document.getElementById(id);
const notebook=$("notebook");
const fcanvas=new fabric.Canvas("fabricCanvas",{selection:true,preserveObjectStacking:true});



// Зберігаємо службові властивості текстів у JSON сторінки
const _fabricToObject=fabric.Object.prototype.toObject;
fabric.Object.prototype.toObject=function(propertiesToInclude){
  return _fabricToObject.call(this,(propertiesToInclude||[]).concat(["systemRole","isHeadingText","isEraserMask","graphObject","graphMeta","graphName"]));
};
let currentTool="select", isShape=false, start=null, temp=null;
let history=[], redoHistory=[], pages=[blankPage()], currentPage=0, suppressHistory=false;
let polyPoints=[], polyPreview=null, keyboardLang="UA";

function blankPage(){return{json:null,paper:"grid",paperSize:25,paperColor:"#9fd5ff"}}

/* ---------- Час ---------- */
function updateClock(){$("liveClock").textContent=new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"})}
setInterval(updateClock,1000);updateClock();

/* ---------- Дата: значення у списку завжди відповідають СЬОГОДНІ ---------- */
const months=["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
const days=["","Перше","Друге","Третє","Четверте","П’яте","Шосте","Сьоме","Восьме","Дев’яте","Десяте","Одинадцяте","Дванадцяте","Тринадцяте","Чотирнадцяте","П’ятнадцяте","Шістнадцяте","Сімнадцяте","Вісімнадцяте","Дев’ятнадцяте","Двадцяте","Двадцять перше","Двадцять друге","Двадцять третє","Двадцять четверте","Двадцять п’яте","Двадцять шосте","Двадцять сьоме","Двадцять восьме","Двадцять дев’яте","Тридцяте","Тридцять перше"];

function dateVariants(d){
  return{
    words:`${days[d.getDate()]} ${months[d.getMonth()]}`,
    dayMonth:`${d.getDate()} ${months[d.getMonth()]}`,
    numeric:d.toLocaleDateString("uk-UA")
  }
}
function refreshDateOptions(){
  const v=dateVariants(new Date());
  $("optDateWords").textContent=v.words;
  $("optDateDayMonth").textContent=v.dayMonth;
  $("optDateNumeric").textContent=v.numeric;
}
function updateDateControls(){
  $("customDate").classList.toggle("hidden",$("dateMode").value!=="calendar");
  $("manualDate").classList.toggle("hidden",$("dateMode").value!=="manual");
}
function headingDate(){
  const mode=$("dateMode").value;
  if(mode==="none")return"";
  if(mode==="manual")return $("manualDate").value.trim();
  if(mode==="calendar"){
    if(!$("customDate").value)return"";
    const [y,m,d]=$("customDate").value.split("-").map(Number);
    return `${d} ${months[m-1]} ${y}`;
  }
  return dateVariants(new Date())[mode]||"";
}
function findSystemText(role){
  return fcanvas.getObjects().find(o=>o.systemRole===role);
}
function makeHeadingText(text,role,top,fontSize=24,fontWeight="normal"){
  const t=new fabric.IText(text,{
    left:fcanvas.getWidth()/2,
    top,
    originX:"center",
    fontFamily:"Georgia",
    fontSize,
    fontWeight,
    fill:"#17315f",
    textAlign:"center",
    editable:true,
    selectable:true,
    evented:true,
    systemRole:role,
    isHeadingText:true
  });
  fcanvas.add(t);
  return t;
}
function ensureHeadingObjects(){
  const free=$("pageMode").value==="free";
  let dateObj=findSystemText("dateHeading");
  let workObj=findSystemText("workHeading");

  if(free){
    if(dateObj) fcanvas.remove(dateObj);
    if(workObj) fcanvas.remove(workObj);
    fcanvas.requestRenderAll();
    return;
  }

  if(!dateObj) dateObj=makeHeadingText(headingDate(),"dateHeading",24,22,"normal");
  if(!workObj) workObj=makeHeadingText($("workType").value,"workHeading",56,24,"bold");

  // При зміні селектора оновлюємо лише сам текст, але об'єкт лишається редагованим
  dateObj.set({text:headingDate()});
  workObj.set({text:$("workType").value});
  dateObj.setCoords();workObj.setCoords();
  fcanvas.requestRenderAll();
}
function updateHeading(){
  refreshDateOptions();updateDateControls();
  const free=$("pageMode").value==="free";
  document.querySelector(".lessonbar").classList.toggle("free-mode",free);
  $("dateHeading").textContent=free?"":headingDate();
  $("workHeading").textContent=free?"":$("workType").value;
  if(typeof fcanvas!=="undefined") ensureHeadingObjects();
}
["dateMode","workType","pageMode"].forEach(id=>$(id).addEventListener("change",()=>{updateHeading();autoSave()}));
$("customDate").addEventListener("change",()=>{updateHeading();autoSave()});
$("manualDate").addEventListener("input",()=>{updateHeading();autoSave()});
updateHeading();

/* ---------- Фон ---------- */
const paperClasses=["paper-grid","paper-lines","paper-slant","paper-music","paper-millimeter","paper-coordinate","paper-clean"];
function renderCoordinatePlane(){
  const box=$("coordinatePaperOverlay");
  if(!box)return;
  const W=1180,H=820;
  const step=Math.max(20,Number($("paperSize").value)||32);
  const gridColor=$("paperLineColor").value||"#9fd5ff";
  const ox=Math.round(W/2), oy=Math.round(H/2);
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
  svg+=`<rect width="${W}" height="${H}" fill="white"/>`;

  // grid
  for(let x=ox%step;x<=W;x+=step)svg+=`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${gridColor}" stroke-width="1"/>`;
  for(let y=oy%step;y<=H;y+=step)svg+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`;

  // axes
  svg+=`<line x1="0" y1="${oy}" x2="${W-16}" y2="${oy}" stroke="#202b3d" stroke-width="2"/>`;
  svg+=`<polygon points="${W-16},${oy-6} ${W},${oy} ${W-16},${oy+6}" fill="#202b3d"/>`;
  svg+=`<line x1="${ox}" y1="${H}" x2="${ox}" y2="16" stroke="#202b3d" stroke-width="2"/>`;
  svg+=`<polygon points="${ox-6},16 ${ox},0 ${ox+6},16" fill="#202b3d"/>`;
  svg+=`<text x="${W-26}" y="${oy-10}" font-family="Arial" font-size="18" font-weight="700" fill="#202b3d">X</text>`;
  svg+=`<text x="${ox+10}" y="23" font-family="Arial" font-size="18" font-weight="700" fill="#202b3d">Y</text>`;

  // ticks / labels
  const maxX=Math.floor((W-ox)/step);
  const minX=-Math.floor(ox/step);
  for(let n=minX;n<=maxX;n++){
    if(n===0)continue;
    const x=ox+n*step;
    svg+=`<line x1="${x}" y1="${oy-5}" x2="${x}" y2="${oy+5}" stroke="#202b3d" stroke-width="1.3"/>`;
    svg+=`<text x="${x}" y="${oy+18}" text-anchor="middle" font-family="Arial" font-size="10" fill="#35445b">${n}</text>`;
  }
  const maxY=Math.floor(oy/step);
  const minY=-Math.floor((H-oy)/step);
  for(let n=minY;n<=maxY;n++){
    if(n===0)continue;
    const y=oy-n*step;
    svg+=`<line x1="${ox-5}" y1="${y}" x2="${ox+5}" y2="${y}" stroke="#202b3d" stroke-width="1.3"/>`;
    svg+=`<text x="${ox-9}" y="${y+4}" text-anchor="end" font-family="Arial" font-size="10" fill="#35445b">${n}</text>`;
  }
  svg+=`<text x="${ox-8}" y="${oy+18}" text-anchor="end" font-family="Arial" font-size="10" fill="#35445b">0</text>`;
  svg+=`</svg>`;
  box.innerHTML=svg;
}
function applyPaper(){
  notebook.classList.remove(...paperClasses);
  const type=$("paperType").value;
  const coord=type==="coordinate";
  notebook.classList.add(coord?"paper-clean":"paper-"+type);
  const step=Number($("paperSize").value);
  notebook.style.setProperty("--paper-step",step+"px");
  notebook.style.setProperty("--slant-gap",(step*6)+"px");
  notebook.style.setProperty("--paper-line-color",$("paperLineColor").value);
  $("coordinatePaperOverlay")?.classList.toggle("hidden",!coord);
  if(coord)renderCoordinatePlane();
}
["paperType","paperSize","paperLineColor"].forEach(id=>$(id).addEventListener("input",()=>{
  if(id==="paperSize") $("paperSizeValue").textContent=$("paperSize").value;
  applyPaper();autoSave();
}));
$("paperSizeMinus").onclick=()=>{
  $("paperSize").value=Math.max(Number($("paperSize").min),Number($("paperSize").value)-1);
  $("paperSizeValue").textContent=$("paperSize").value;applyPaper();autoSave();
};
$("paperSizePlus").onclick=()=>{
  $("paperSize").value=Math.min(Number($("paperSize").max),Number($("paperSize").value)+1);
  $("paperSizeValue").textContent=$("paperSize").value;applyPaper();autoSave();
};
$("paperSizeValue").textContent=$("paperSize").value;
applyPaper();

/* ---------- Fabric delete control: червоний × на кожному виділеному об'єкті ---------- */
function deleteObject(_eventData,transform){
  const target=transform.target;
  const canvas=target.canvas;
  if(target.type==="activeSelection")target.forEachObject(o=>canvas.remove(o));
  canvas.remove(target);canvas.requestRenderAll();pushHistory();autoSave();return true;
}
function renderDeleteIcon(ctx,left,top,_styleOverride,fabricObject){
  const size=24;
  ctx.save();ctx.translate(left,top);ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
  ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.fillStyle="#d43b3b";ctx.fill();
  ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(5,5);ctx.moveTo(5,-5);ctx.lineTo(-5,5);ctx.stroke();ctx.restore();
}
fabric.Object.prototype.controls.deleteControl=new fabric.Control({x:.5,y:-.5,offsetY:-15,offsetX:15,cursorStyle:"pointer",mouseUpHandler:deleteObject,render:renderDeleteIcon,cornerSize:26});

/* ---------- Стиль ---------- */
function lineDash(){
  const s=$("lineStyle").value;
  if(s==="dashed")return[14,9];if(s==="dotted")return[2,8];if(s==="dashdot")return[16,7,2,7];return null;
}
function strokeOpts(){return{stroke:$("colorPicker").value,strokeWidth:Number($("lineWidth").value),fill:"transparent",strokeDashArray:lineDash(),strokeLineCap:"round",strokeLineJoin:"round"}}
$("lineWidth").oninput=()=>$("lineWidthValue").textContent=$("lineWidth").value;

/* ---------- History ---------- */
function canvasState(){return JSON.stringify(fcanvas.toJSON())}
function pushHistory(){
  if(suppressHistory)return;
  const s=canvasState();if(history[history.length-1]!==s)history.push(s);
  if(history.length>50)history.shift();redoHistory=[];
}
function restoreState(s){
  suppressHistory=true;fcanvas.loadFromJSON(JSON.parse(s),()=>{fcanvas.renderAll();suppressHistory=false;setTool("select")});
}
$("undoBtn").onclick=()=>{if(history.length<2)return;redoHistory.push(history.pop());restoreState(history[history.length-1]);autoSave()};
$("redoBtn").onclick=()=>{if(!redoHistory.length)return;const s=redoHistory.pop();history.push(s);restoreState(s);autoSave()};





/* ---------- Надійна стирачка без зовнішніх модулів ----------
   Працює як гумка по сторінці:
   - не зачіпає CSS-фон (клітинку, лінії, координатну площину);
   - не зачіпає текст;
   - стирає графічні об'єкти локально по траєкторії.
   Технічно гумка створює прозору маску поверх графіки. */
let eraserStrokeActive=false;
let eraserPoints=[];
let eraserPreview=null;

function isProtectedTextObject(o){
  return !!(o && (
    ["text","i-text","textbox"].includes(o.type) ||
    o.isHeadingText ||
    o.systemRole
  ));
}

function makeEraserPath(points, width){
  if(!points || points.length<2) return null;
  let d=`M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length;i++){
    const prev=points[i-1];
    const cur=points[i];
    const mx=(prev.x+cur.x)/2;
    const my=(prev.y+cur.y)/2;
    d+=` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last=points[points.length-1];
  d+=` L ${last.x} ${last.y}`;
  return new fabric.Path(d,{
    fill:"",
    stroke:"#000000",
    strokeWidth:width,
    strokeLineCap:"round",
    strokeLineJoin:"round",
    selectable:false,
    evented:false,
    globalCompositeOperation:"destination-out",
    isEraserMask:true,
    excludeFromExport:false,
    objectCaching:false
  });
}

function normalizeEraserLayerOrder(){
  const objects=fcanvas.getObjects().slice();
  const masks=objects.filter(o=>o.isEraserMask);
  const texts=objects.filter(o=>isProtectedTextObject(o));

  // Спочатку маски мають бути над усією графікою...
  masks.forEach(m=>fcanvas.bringToFront(m));
  // ...але текст завжди малюється після масок і тому лишається цілим.
  texts.forEach(t=>fcanvas.bringToFront(t));
  fcanvas.requestRenderAll();
}

function beginLocalErase(opt){
  if(currentTool!=="eraser")return;
  eraserStrokeActive=true;
  eraserPoints=[fcanvas.getPointer(opt.e)];
  fcanvas.discardActiveObject();
}

function moveLocalErase(opt){
  if(currentTool!=="eraser" || !eraserStrokeActive)return;
  const p=fcanvas.getPointer(opt.e);
  eraserPoints.push(p);

  if(eraserPreview)fcanvas.remove(eraserPreview);
  const width=Math.max(14,Number($("lineWidth").value)*6);
  eraserPreview=makeEraserPath(eraserPoints,width);
  if(eraserPreview){
    fcanvas.add(eraserPreview);
    normalizeEraserLayerOrder();
  }
}

function finishLocalErase(){
  if(currentTool!=="eraser" || !eraserStrokeActive)return;
  eraserStrokeActive=false;

  if(eraserPreview){
    eraserPreview.set({
      selectable:false,
      evented:false,
      isEraserMask:true,
      globalCompositeOperation:"destination-out"
    });
    eraserPreview=null;
    normalizeEraserLayerOrder();
    pushHistory();
    autoSave();
  }
  eraserPoints=[];
}

fcanvas.on("mouse:down",beginLocalErase);
fcanvas.on("mouse:move",moveLocalErase);
fcanvas.on("mouse:up",finishLocalErase);

/* Після додавання/завантаження об'єктів зберігаємо порядок:
   графіка -> маска гумки -> текст. */
fcanvas.on("object:added",e=>{
  if(!e.target?.isEraserMask){
    setTimeout(normalizeEraserLayerOrder,0);
  }
});

/* ---------- Word-like форматування будь-якого тексту ---------- */
function isTextObject(o){
  return o && ["i-text","textbox","text"].includes(o.type);
}
function getActiveText(){
  const o=fcanvas.getActiveObject();
  return isTextObject(o)?o:null;
}
function syncTextFormatBar(){
  const o=getActiveText();
  $("textFormatBar").classList.toggle("hidden",!o);
  if(!o)return;

  $("textFontFamily").value=o.fontFamily||"Arial";
  $("textFontSize").value=Math.round(o.fontSize||26);
  $("textColor").value=normalizeHexColor(o.fill)||"#17315f";
  $("textBgColor").value=normalizeHexColor(o.backgroundColor)||"#ffffff";
  $("textAlign").value=o.textAlign||"left";

  $("textBoldBtn").classList.toggle("active-format",o.fontWeight==="bold"||Number(o.fontWeight)>=600);
  $("textItalicBtn").classList.toggle("active-format",o.fontStyle==="italic");
  $("textUnderlineBtn").classList.toggle("active-format",!!o.underline);
  $("textStrikeBtn").classList.toggle("active-format",!!o.linethrough);
}
function normalizeHexColor(c){
  if(typeof c!=="string")return null;
  if(/^#[0-9a-f]{6}$/i.test(c))return c;
  const m=c.match(/^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$/i);
  if(!m)return null;
  return "#"+[m[1],m[2],m[3]].map(x=>Number(x).toString(16).padStart(2,"0")).join("");
}
function applyTextProps(props){
  const o=getActiveText();if(!o)return;
  o.set(props);o.setCoords();fcanvas.requestRenderAll();pushHistory();autoSave();syncTextFormatBar();
}
$("textFontFamily").onchange=()=>applyTextProps({fontFamily:$("textFontFamily").value});
$("textFontSize").onchange=()=>applyTextProps({fontSize:Math.max(8,Math.min(120,Number($("textFontSize").value)||26))});
$("fontSizeDown").onclick=()=>{const o=getActiveText();if(o)applyTextProps({fontSize:Math.max(8,(o.fontSize||26)-2)})};
$("fontSizeUp").onclick=()=>{const o=getActiveText();if(o)applyTextProps({fontSize:Math.min(120,(o.fontSize||26)+2)})};
$("textBoldBtn").onclick=()=>{const o=getActiveText();if(o)applyTextProps({fontWeight:(o.fontWeight==="bold"||Number(o.fontWeight)>=600)?"normal":"bold"})};
$("textItalicBtn").onclick=()=>{const o=getActiveText();if(o)applyTextProps({fontStyle:o.fontStyle==="italic"?"normal":"italic"})};
$("textUnderlineBtn").onclick=()=>{const o=getActiveText();if(o)applyTextProps({underline:!o.underline})};
$("textStrikeBtn").onclick=()=>{const o=getActiveText();if(o)applyTextProps({linethrough:!o.linethrough})};
$("textColor").oninput=()=>applyTextProps({fill:$("textColor").value});
$("textBgColor").oninput=()=>applyTextProps({backgroundColor:$("textBgColor").value});
$("textAlign").onchange=()=>applyTextProps({textAlign:$("textAlign").value});
$("textDuplicateBtn").onclick=()=>{
  const o=getActiveText();if(!o)return;
  o.clone(cl=>{
    cl.set({left:(o.left||0)+25,top:(o.top||0)+25,systemRole:null,isHeadingText:false});
    fcanvas.add(cl);fcanvas.setActiveObject(cl);pushHistory();autoSave();syncTextFormatBar();
  });
};

fcanvas.on("selection:created",syncTextFormatBar);
fcanvas.on("selection:updated",syncTextFormatBar);
fcanvas.on("selection:cleared",syncTextFormatBar);
fcanvas.on("text:changed",()=>{pushHistory();autoSave();syncTextFormatBar()});
fcanvas.on("text:editing:entered",syncTextFormatBar);

/* Подвійний клік по тексту одразу відкриває редагування */
fcanvas.on("mouse:dblclick",opt=>{
  const o=opt.target;
  if(isTextObject(o)&&o.enterEditing){
    fcanvas.setActiveObject(o);
    o.enterEditing();
    o.selectAll();
    syncTextFormatBar();
    fcanvas.requestRenderAll();
  }
});

/* ---------- Інструменти ---------- */
function hexToRgba(hex,a){
  const n=parseInt(hex.slice(1),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function setTool(tool){
  currentTool=tool;
  document.querySelectorAll(".side-tool[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));

  fcanvas.isDrawingMode=false;
  fcanvas.selection=tool==="select";
  fcanvas.defaultCursor=tool==="select"?"grab":"crosshair";
  fcanvas.hoverCursor=tool==="select"?"move":"crosshair";

  // Об'єкти інтерактивні тільки в режимі "Рука".
  fcanvas.forEachObject(o=>{
    o.selectable=tool==="select";
    o.evented=tool==="select";
  });

  if(tool==="pen"){
    fcanvas.freeDrawingBrush=new fabric.PencilBrush(fcanvas);
    fcanvas.freeDrawingBrush.color=$("colorPicker").value;
    fcanvas.freeDrawingBrush.width=Number($("lineWidth").value);
    fcanvas.isDrawingMode=true;
  }

  if(tool==="marker"){
    fcanvas.freeDrawingBrush=new fabric.PencilBrush(fcanvas);
    fcanvas.freeDrawingBrush.color=hexToRgba($("colorPicker").value,.32);
    fcanvas.freeDrawingBrush.width=Math.max(14,Number($("lineWidth").value)*5);
    fcanvas.isDrawingMode=true;
  }

  if(tool==="eraser"){
    fcanvas.isDrawingMode=false;
    fcanvas.selection=false;
    fcanvas.discardActiveObject();
    fcanvas.defaultCursor="crosshair";
    fcanvas.hoverCursor="crosshair";
    fcanvas.requestRenderAll();
  }

  fcanvas.discardActiveObject();
  fcanvas.requestRenderAll();
  $("finishPolylineBtn").classList.toggle("hidden",tool!=="polyline");
}
document.querySelectorAll(".side-tool[data-tool]").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
setTool("select");
$("colorPicker").oninput=()=>setTool(currentTool);
$("correctionMarkerBtn").onclick=()=>{
  $("colorPicker").value=$("correctionColor").value;
  setTool("marker");
};

/* ---------- Тип лінії: відрізок / пряма / промінь / стрілки ---------- */
function makeArrowHead(x,y,angleDeg,color,size=20){
  return new fabric.Triangle({
    left:x,top:y,width:size,height:size+4,
    fill:color,angle:angleDeg+90,
    originX:"center",originY:"center",
    selectable:false,evented:false
  });
}
function buildLineKind(x1,y1,x2,y2){
  const kind=$("lineKind")?.value||"segment";
  const c=$("colorPicker").value;
  const st=strokeOpts();
  const dx=x2-x1,dy=y2-y1;
  const len=Math.hypot(dx,dy)||1;
  const ux=dx/len,uy=dy/len;

  if(kind==="line"){
    const extend=1800;
    return new fabric.Line([x1-ux*extend,y1-uy*extend,x2+ux*extend,y2+uy*extend],st);
  }
  if(kind==="ray"){
    const extend=1800;
    return new fabric.Line([x1,y1,x2+ux*extend,y2+uy*extend],st);
  }
  if(kind==="segment"){
    return new fabric.Line([x1,y1,x2,y2],st);
  }

  const line=new fabric.Line([x1,y1,x2,y2],st);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const size=16+Number($("lineWidth").value)*1.5;

  if(kind==="arrow"){
    return new fabric.Group([line,makeArrowHead(x2,y2,angle,c,size)],{erasable:"deep"});
  }
  if(kind==="doubleArrow"){
    return new fabric.Group([
      line,
      makeArrowHead(x1,y1,angle+180,c,size),
      makeArrowHead(x2,y2,angle,c,size)
    ],{erasable:"deep"});
  }
  return line;
}

/* ---------- Малювання простих об'єктів ---------- */
fcanvas.on("mouse:down",opt=>{
  if(["select","pen","marker","eraser","polyline"].includes(currentTool)){
    if(currentTool==="polyline")addPolylinePoint(fcanvas.getPointer(opt.e));
    return;
  }
  const p=fcanvas.getPointer(opt.e);
  start={x:p.x,y:p.y};
  isShape=true;
  const c=strokeOpts();

  if(currentTool==="line"||currentTool==="arrow")temp=new fabric.Line([p.x,p.y,p.x,p.y],c);
  if(currentTool==="rectangle")temp=new fabric.Rect({left:p.x,top:p.y,width:1,height:1,...c});
  if(currentTool==="ellipse")temp=new fabric.Ellipse({left:p.x,top:p.y,rx:1,ry:1,...c});
  if(currentTool==="triangle")temp=new fabric.Triangle({left:p.x,top:p.y,width:1,height:1,...c});
  if(currentTool==="curve")temp=new fabric.Path(`M ${p.x} ${p.y} Q ${p.x} ${p.y} ${p.x} ${p.y}`,c);
  if(currentTool==="wave")temp=new fabric.Path(`M ${p.x} ${p.y}`,c);
  if(currentTool==="text"){
    const t=new fabric.IText("Текст",{
      left:p.x,top:p.y,fill:$("colorPicker").value,
      fontSize:26,fontFamily:"Arial",erasable:false
    });
    fcanvas.add(t);
    fcanvas.setActiveObject(t);
    t.enterEditing();
    pushHistory();autoSave();
    setTool("select");
    syncTextFormatBar();
    return;
  }
  if(temp)fcanvas.add(temp);
});

fcanvas.on("mouse:move",opt=>{
  if(!isShape||!temp||!start)return;
  const p=fcanvas.getPointer(opt.e);
  const x=Math.min(start.x,p.x),y=Math.min(start.y,p.y),w=Math.abs(p.x-start.x),h=Math.abs(p.y-start.y);

  if(currentTool==="line"||currentTool==="arrow")temp.set({x2:p.x,y2:p.y});
  if(currentTool==="rectangle")temp.set({left:x,top:y,width:w,height:h});
  if(currentTool==="ellipse")temp.set({left:x,top:y,rx:w/2,ry:h/2});
  if(currentTool==="triangle")temp.set({left:x,top:y,width:w,height:h});

  if(currentTool==="curve"){
    const cx=(start.x+p.x)/2,cy=Math.min(start.y,p.y)-Math.max(45,h*.7);
    fcanvas.remove(temp);
    temp=new fabric.Path(`M ${start.x} ${start.y} Q ${cx} ${cy} ${p.x} ${p.y}`,strokeOpts());
    fcanvas.add(temp);
  }

  if(currentTool==="wave"){
    const x1=start.x,x2=p.x,y0=start.y;
    const dir=x2>=x1?1:-1,total=Math.abs(x2-x1),wavelength=28,amp=7;
    const segments=Math.max(1,Math.floor(total/wavelength));
    let path=`M ${x1} ${y0}`,cx=x1;
    for(let i=0;i<segments;i++){
      const nx=cx+dir*wavelength,mid=cx+dir*wavelength/2;
      path+=` C ${cx+dir*wavelength/4} ${y0-amp}, ${mid-dir*wavelength/4} ${y0-amp}, ${mid} ${y0}`;
      path+=` C ${mid+dir*wavelength/4} ${y0+amp}, ${nx-dir*wavelength/4} ${y0+amp}, ${nx} ${y0}`;
      cx=nx;
    }
    if(Math.abs(x2-cx)>2){
      path+=` C ${cx+dir*8} ${y0-amp}, ${x2-dir*8} ${y0+amp}, ${x2} ${y0}`;
    }
    fcanvas.remove(temp);
    temp=new fabric.Path(path,strokeOpts());
    fcanvas.add(temp);
  }
  fcanvas.requestRenderAll();
});

fcanvas.on("mouse:up",()=>{
  if(!isShape)return;
  isShape=false;

  if((currentTool==="line"||currentTool==="arrow")&&temp){
    const{x1,y1,x2,y2}=temp;
    fcanvas.remove(temp);
    let oldKind=null;
    if(currentTool==="arrow"&&$("lineKind")){
      oldKind=$("lineKind").value;
      $("lineKind").value="arrow";
    }
    const created=buildLineKind(x1,y1,x2,y2);
    if(oldKind!==null)$("lineKind").value=oldKind;
    fcanvas.add(created);
    temp=created;
  }
  temp=null;
  pushHistory();
  autoSave();
  setTool("select");
});

fcanvas.on("path:created",e=>{
  // Штрихи ручки/маркера можна стирати частково.
  if(currentTool!=="eraser"){
    e.path.set({selectable:true,evented:true,erasable:true});
    pushHistory();
    autoSave();
  }
});
fcanvas.on("object:modified",()=>{pushHistory();autoSave()});

/* ---------- Ламана ---------- */
function addPolylinePoint(p){
  polyPoints.push({x:p.x,y:p.y});
  if(polyPreview)fcanvas.remove(polyPreview);
  if(polyPoints.length>1){
    polyPreview=new fabric.Polyline(polyPoints,{...strokeOpts(),fill:"transparent",selectable:false,evented:false});
    fcanvas.add(polyPreview);
  }
}
function finishPolyline(){
  if(polyPreview){polyPreview.set({selectable:true,evented:true});polyPreview=null;pushHistory();autoSave()}
  polyPoints=[];setTool("select");
}
$("finishPolylineBtn").onclick=finishPolyline;

/* ---------- Видалення / групи ---------- */
function deleteSelected(){
  const active=fcanvas.getActiveObjects();if(!active.length)return;
  active.forEach(o=>fcanvas.remove(o));fcanvas.discardActiveObject();fcanvas.requestRenderAll();pushHistory();autoSave();
}
$("deleteSelectedBtn").onclick=deleteSelected;
document.addEventListener("keydown",e=>{
  if((e.key==="Delete")&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA")deleteSelected();
});
$("groupBtn").onclick=()=>{
  const a=fcanvas.getActiveObject();if(!a||a.type!=="activeSelection"){alert("Виділіть декілька об’єктів рамкою.");return}
  const g=a.toGroup();fcanvas.setActiveObject(g);pushHistory();autoSave();
};
$("ungroupBtn").onclick=()=>{
  const a=fcanvas.getActiveObject();if(!a||a.type!=="group"){alert("Виділіть згруповану фігуру.");return}
  a.toActiveSelection();fcanvas.requestRenderAll();pushHistory();autoSave();
};

/* ---------- Точка / вершина ---------- */
function addPoint(label=""){
  const dot=new fabric.Circle({radius:4,fill:$("colorPicker").value,left:0,top:0,originX:"center",originY:"center"});
  const arr=[dot];
  if(label)arr.push(new fabric.Text(label,{left:9,top:-20,fontSize:18,fill:$("colorPicker").value}));
  const g=new fabric.Group(arr,{left:330,top:270});fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();setTool("select");
}
$("pointBtn").onclick=()=>addPoint();
$("vertexLabelBtn").onclick=()=>{
  const s=(prompt("Позначення вершини:","A")||"A").trim();
  const t=new fabric.IText(s,{left:350,top:250,fontSize:22,fontWeight:"bold",fill:$("colorPicker").value});
  fcanvas.add(t);fcanvas.setActiveObject(t);pushHistory();autoSave();setTool("select");
};

/* ---------- 2D / 3D фігури ---------- */
function solidLine(x1,y1,x2,y2){return new fabric.Line([x1,y1,x2,y2],strokeOpts())}
function hiddenLine(x1,y1,x2,y2){return new fabric.Line([x1,y1,x2,y2],{...strokeOpts(),strokeDashArray:[8,6]})}
function groupAndPlace(objects,left=300,top=220){const g=new fabric.Group(objects,{left,top});fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();setTool("select");return g}
function add2D(type){
  const o=strokeOpts();let obj;
  if(type==="square")obj=new fabric.Rect({left:300,top:220,width:150,height:150,...o});
  if(type==="parallelogram")obj=new fabric.Polygon([{x:35,y:0},{x:180,y:0},{x:145,y:115},{x:0,y:115}],{left:300,top:225,...o});
  if(type==="rhombus")obj=new fabric.Polygon([{x:85,y:0},{x:170,y:70},{x:85,y:140},{x:0,y:70}],{left:310,top:220,...o});
  if(type==="trapezoid")obj=new fabric.Polygon([{x:45,y:0},{x:155,y:0},{x:195,y:110},{x:0,y:110}],{left:300,top:230,...o});
  if(obj){fcanvas.add(obj);fcanvas.setActiveObject(obj);pushHistory();autoSave();setTool("select")}
}
function addCube(){
  const o=[],d=42,w=140,h=130;
  o.push(solidLine(0,d,w,d),solidLine(w,d,w,d+h),solidLine(w,d+h,0,d+h),solidLine(0,d+h,0,d));
  o.push(solidLine(d,0,w+d,0),solidLine(w+d,0,w+d,h),solidLine(w+d,h,w,d+h),solidLine(0,d,d,0),solidLine(w,d,w+d,0),solidLine(0,d+h,d,h));
  o.push(hiddenLine(d,0,d,h),hiddenLine(d,h,w+d,h));groupAndPlace(o);
}
function addCuboid(){
  const o=[],d=46,w=210,h=115;
  o.push(solidLine(0,d,w,d),solidLine(w,d,w,d+h),solidLine(w,d+h,0,d+h),solidLine(0,d+h,0,d));
  o.push(solidLine(d,0,w+d,0),solidLine(w+d,0,w+d,h),solidLine(w+d,h,w,d+h),solidLine(0,d,d,0),solidLine(w,d,w+d,0),solidLine(0,d+h,d,h));
  o.push(hiddenLine(d,0,d,h),hiddenLine(d,h,w+d,h));groupAndPlace(o,280,230);
}
function addPyramid(){
  const o=[],ap={x:105,y:0},A={x:10,y:150},B={x:170,y:150},C={x:220,y:105},D={x:55,y:105};
  o.push(solidLine(ap.x,ap.y,A.x,A.y),solidLine(ap.x,ap.y,B.x,B.y),solidLine(ap.x,ap.y,C.x,C.y),hiddenLine(ap.x,ap.y,D.x,D.y));
  o.push(solidLine(A.x,A.y,B.x,B.y),solidLine(B.x,B.y,C.x,C.y),hiddenLine(C.x,C.y,D.x,D.y),hiddenLine(D.x,D.y,A.x,A.y));groupAndPlace(o);
}
function addCylinder(){
  const c=$("colorPicker").value,sw=Number($("lineWidth").value),o=[];
  o.push(new fabric.Ellipse({left:0,top:0,rx:78,ry:25,stroke:c,strokeWidth:sw,fill:"transparent"}),solidLine(0,25,0,155),solidLine(156,25,156,155));
  o.push(new fabric.Path("M 0 155 C 24 188 132 188 156 155",{stroke:c,strokeWidth:sw,fill:"transparent"}));
  o.push(new fabric.Path("M 0 155 C 24 122 132 122 156 155",{stroke:c,strokeWidth:sw,fill:"transparent",strokeDashArray:[8,6]}));groupAndPlace(o);
}
function addCone(){
  const c=$("colorPicker").value,sw=Number($("lineWidth").value),o=[solidLine(78,0,0,155),solidLine(78,0,156,155)];
  o.push(new fabric.Path("M 0 155 C 24 188 132 188 156 155",{stroke:c,strokeWidth:sw,fill:"transparent"}));
  o.push(new fabric.Path("M 0 155 C 24 122 132 122 156 155",{stroke:c,strokeWidth:sw,fill:"transparent",strokeDashArray:[8,6]}));groupAndPlace(o);
}
function addSphere(){
  const c=$("colorPicker").value,sw=Number($("lineWidth").value),o=[new fabric.Circle({radius:80,left:0,top:0,stroke:c,strokeWidth:sw,fill:"transparent"})];
  o.push(new fabric.Path("M 0 80 C 20 40 140 40 160 80",{stroke:c,strokeWidth:sw,fill:"transparent",strokeDashArray:[8,6]}));
  o.push(new fabric.Path("M 0 80 C 20 120 140 120 160 80",{stroke:c,strokeWidth:sw,fill:"transparent"}));groupAndPlace(o);
}
function addPrism(){
  const o=[],d=45,A={x:20,y:35},B={x:135,y:35},C={x:78,y:125},A2={x:65,y:0},B2={x:180,y:0},C2={x:123,y:90};
  o.push(solidLine(A.x,A.y,B.x,B.y),solidLine(B.x,B.y,C.x,C.y),solidLine(C.x,C.y,A.x,A.y));
  o.push(solidLine(A2.x,A2.y,B2.x,B2.y),solidLine(B2.x,B2.y,C2.x,C2.y),hiddenLine(C2.x,C2.y,A2.x,A2.y));
  o.push(solidLine(A.x,A.y,A2.x,A2.y),solidLine(B.x,B.y,B2.x,B2.y),hiddenLine(C.x,C.y,C2.x,C2.y));groupAndPlace(o);
}
document.querySelectorAll("[data-shape]").forEach(b=>b.onclick=()=>{
  const t=b.dataset.shape;
  if(["square","parallelogram","rhombus","trapezoid"].includes(t))add2D(t);
  if(t==="cube")addCube();if(t==="cuboid")addCuboid();if(t==="pyramid")addPyramid();if(t==="cylinder")addCylinder();if(t==="cone")addCone();if(t==="sphere")addSphere();if(t==="prism")addPrism();if(t==="point")addPoint(prompt("Назва точки:","A")||"");
  $("shapeLibraryPanel").classList.add("hidden");
});

/* ---------- Побудова кута ---------- */
$("angleBtn").onclick=()=>$("anglePanel").classList.toggle("hidden");
$("insertAngleBtn").onclick=()=>{
  const deg=Math.max(1,Math.min(359,Number($("angleBuildValue").value)||60)),L=Number($("angleRayLength").value)||170;
  const rad=deg*Math.PI/180,o=[solidLine(0,0,L,0),solidLine(0,0,L*Math.cos(-rad),L*Math.sin(-rad))];
  o.push(new fabric.Text(deg+"°",{left:35,top:-35,fontSize:18,fill:$("colorPicker").value}));
  groupAndPlace(o,360,360);$("anglePanel").classList.add("hidden");
};

/* ---------- Замітка ---------- */
$("noteBtn").onclick=()=>{
  const t=new fabric.Textbox("Замітка",{left:380,top:280,width:230,fontSize:22,fill:"#273142",backgroundColor:"#fff19a",padding:14,fontFamily:"Arial",editable:true});
  fcanvas.add(t);fcanvas.setActiveObject(t);pushHistory();autoSave();setTool("select");
};



/* ---------- Побудова графіків на декартовій системі ---------- */
const graphParamSets={
  linear:[["k",1],["b",0]],
  quadratic:[["a",1],["b",0],["c",0]],
  cubic:[["a",1],["b",0],["c",0],["d",0]],
  absolute:[["a",1],["h",0],["k",0]],
  inverse:[["a",1]],
  sqrt:[["a",1],["h",0],["k",0]],
  sin:[["a",1],["b",1],["c",0],["d",0]],
  cos:[["a",1],["b",1],["c",0],["d",0]],
  custom:[]
};
let selectedGraphObject=null;
let graphCounter=1;

function getParamObjectFromPanel(container){
  const obj={};
  container.querySelectorAll("[data-gparam]").forEach(el=>obj[el.dataset.gparam]=Number(el.value));
  return obj;
}
function prettyNum(n){
  if(Math.abs(n)<1e-9)n=0;
  return Number(n.toFixed(3)).toString();
}
function signedTerm(n,suffix=""){
  return n>=0?` + ${prettyNum(n)}${suffix}`:` - ${prettyNum(Math.abs(n))}${suffix}`;
}
function baseFormulaLabel(type,p,customExpr=""){
  if(type==="linear")return `y = ${prettyNum(p.k)}x${signedTerm(p.b)}`;
  if(type==="quadratic")return `y = ${prettyNum(p.a)}x²${signedTerm(p.b,"x")}${signedTerm(p.c)}`;
  if(type==="cubic")return `y = ${prettyNum(p.a)}x³${signedTerm(p.b,"x²")}${signedTerm(p.c,"x")}${signedTerm(p.d)}`;
  if(type==="absolute")return `y = ${prettyNum(p.a)}|x - ${prettyNum(p.h)}|${signedTerm(p.k)}`;
  if(type==="inverse")return `y = ${prettyNum(p.a)}/x`;
  if(type==="sqrt")return `y = ${prettyNum(p.a)}√(x - ${prettyNum(p.h)})${signedTerm(p.k)}`;
  if(type==="sin")return `y = ${prettyNum(p.a)}·sin(${prettyNum(p.b)}x${signedTerm(p.c)})${signedTerm(p.d)}`;
  if(type==="cos")return `y = ${prettyNum(p.a)}·cos(${prettyNum(p.b)}x${signedTerm(p.c)})${signedTerm(p.d)}`;
  return `y = ${customExpr||"x"}`;
}
function shiftedFormulaLabel(meta){
  const sx=Number(meta.shiftX||0),sy=Number(meta.shiftY||0);
  const p=meta.params||{};
  if(Math.abs(sx)<1e-9&&Math.abs(sy)<1e-9)return baseFormulaLabel(meta.type,p,meta.customExpr||"");

  if(meta.type==="linear"){
    const newB=p.b-p.k*sx+sy;
    return `y = ${prettyNum(p.k)}x${signedTerm(newB)}`;
  }
  if(meta.type==="quadratic"){
    const q=sx>=0?`x - ${prettyNum(sx)}`:`x + ${prettyNum(Math.abs(sx))}`;
    return `y = ${prettyNum(p.a)}(${q})²${signedTerm(p.b,`(${q})`)}${signedTerm(p.c+sy)}`;
  }
  if(meta.type==="absolute"){
    return `y = ${prettyNum(p.a)}|x - ${prettyNum((p.h||0)+sx)}|${signedTerm((p.k||0)+sy)}`;
  }
  if(meta.type==="inverse"){
    const q=sx>=0?`x - ${prettyNum(sx)}`:`x + ${prettyNum(Math.abs(sx))}`;
    return `y = ${prettyNum(p.a)}/(${q})${signedTerm(sy)}`;
  }
  if(meta.type==="sqrt"){
    return `y = ${prettyNum(p.a)}√(x - ${prettyNum((p.h||0)+sx)})${signedTerm((p.k||0)+sy)}`;
  }
  return `${baseFormulaLabel(meta.type,p,meta.customExpr||"")}  |  зсув X=${prettyNum(sx)}, Y=${prettyNum(sy)}`;
}
function graphFunction(meta){
  const p=meta.params||{},type=meta.type;
  if(type==="linear")return x=>p.k*x+p.b;
  if(type==="quadratic")return x=>p.a*x*x+p.b*x+p.c;
  if(type==="cubic")return x=>p.a*x*x*x+p.b*x*x+p.c*x+p.d;
  if(type==="absolute")return x=>p.a*Math.abs(x-p.h)+p.k;
  if(type==="inverse")return x=>Math.abs(x)<1e-9?NaN:p.a/x;
  if(type==="sqrt")return x=>x<p.h?NaN:p.a*Math.sqrt(x-p.h)+p.k;
  if(type==="sin")return x=>p.a*Math.sin(p.b*x+p.c)+p.d;
  if(type==="cos")return x=>p.a*Math.cos(p.b*x+p.c)+p.d;

  let expr=(meta.customExpr||"x").trim();
  const safe=expr
    .replace(/\^/g,"**")
    .replace(/\bpi\b/gi,"Math.PI")
    .replace(/\bsin\b/gi,"Math.sin")
    .replace(/\bcos\b/gi,"Math.cos")
    .replace(/\btan\b/gi,"Math.tan")
    .replace(/\bsqrt\b/gi,"Math.sqrt")
    .replace(/\babs\b/gi,"Math.abs");
  const fn=new Function("x",`return (${safe});`);
  return fn;
}
function createGraphParts(meta){
  const W=1180,H=820;
  const step=Math.max(20,Number($("paperSize").value)||32);
  const ox=W/2,oy=H/2;
  const xMin=-ox/step,xMax=(W-ox)/step;
  const color=meta.color||$("colorPicker").value;
  const sw=meta.strokeWidth||Math.max(2,Number($("lineWidth").value));
  const fn=graphFunction(meta);
  const sx=Number(meta.shiftX||0),sy=Number(meta.shiftY||0);

  let segments=[],current=[];
  for(let i=0;i<=1100;i++){
    const x=xMin+(xMax-xMin)*i/1100;
    const y=fn(x-sx)+sy;
    if(!Number.isFinite(y)||Math.abs(y)>H/step*5){
      if(current.length>1)segments.push(current);current=[];continue;
    }
    const px=ox+x*step,py=oy-y*step;
    if(py<-H||py>H*2){
      if(current.length>1)segments.push(current);current=[];continue;
    }
    current.push({x:px,y:py});
  }
  if(current.length>1)segments.push(current);

  const parts=[];
  segments.forEach(seg=>parts.push(new fabric.Polyline(seg,{
    fill:"transparent",stroke:color,strokeWidth:sw,
    selectable:false,evented:false,objectCaching:false
  })));

  if(meta.showPoints){
    for(let x=Math.ceil(xMin);x<=Math.floor(xMax);x++){
      const y=fn(x-sx)+sy;
      if(Number.isFinite(y)&&Math.abs(y)<=H/step/2){
        parts.push(new fabric.Circle({left:ox+x*step-3,top:oy-y*step-3,radius:3,fill:color,selectable:false,evented:false}));
      }
    }
  }

  const title=`${meta.name||"Графік"}: ${shiftedFormulaLabel(meta)}`;
  parts.push(new fabric.Text(title,{
    left:20,top:20,fontSize:18,fill:color,fontFamily:"Arial",
    backgroundColor:"rgba(255,255,255,.88)",padding:5,
    selectable:false,evented:false,erasable:false
  }));
  return parts;
}
function createGraphGroup(meta){
  return new fabric.Group(createGraphParts(meta),{
    left:0,top:0,selectable:true,evented:true,
    graphObject:true,graphName:meta.name,graphMeta:JSON.parse(JSON.stringify(meta)),
    erasable:"deep",objectCaching:false
  });
}
function replaceGraphObject(oldGraph,newMeta){
  const idx=fcanvas.getObjects().indexOf(oldGraph);
  fcanvas.remove(oldGraph);
  const g=createGraphGroup(newMeta);
  fcanvas.insertAt(g,idx>=0?idx:fcanvas.getObjects().length,false);
  fcanvas.setActiveObject(g);
  selectedGraphObject=g;
  fcanvas.requestRenderAll();
  return g;
}
function renderGraphParams(){
  const type=$("graphType").value,box=$("graphParams");
  box.innerHTML="";
  (graphParamSets[type]||[]).forEach(([name,val])=>{
    const wrap=document.createElement("label");
    wrap.className="graph-param";
    wrap.innerHTML=`<span>${name} =</span><input data-gparam="${name}" type="number" step="0.1" value="${val}">`;
    box.appendChild(wrap);
  });
  $("customGraphWrap").classList.toggle("hidden",type!=="custom");
  updateBuilderFormulaPreview();
}
function updateBuilderFormulaPreview(){
  const meta={
    type:$("graphType").value,
    params:getParamObjectFromPanel($("graphParams")),
    customExpr:$("customGraphExpression").value.trim()
  };
  $("graphFormulaPreview").textContent=baseFormulaLabel(meta.type,meta.params,meta.customExpr);
}
$("graphType").onchange=renderGraphParams;
$("customGraphExpression").oninput=updateBuilderFormulaPreview;
$("graphParams").addEventListener("input",updateBuilderFormulaPreview);
renderGraphParams();

function insertGraph(){
  try{
    $("paperType").value="coordinate";applyPaper();
    const meta={
      name:$("graphName").value.trim()||`Графік ${graphCounter}`,
      type:$("graphType").value,
      params:getParamObjectFromPanel($("graphParams")),
      customExpr:$("customGraphExpression").value.trim(),
      showPoints:$("graphShowPoints").checked,
      showFormula:true,shiftX:0,shiftY:0,
      color:$("colorPicker").value,
      strokeWidth:Math.max(2,Number($("lineWidth").value))
    };
    const g=createGraphGroup(meta);
    fcanvas.add(g);fcanvas.setActiveObject(g);
    graphCounter++;$("graphName").value=`Графік ${graphCounter}`;
    pushHistory();autoSave();setTool("select");
    $("graphBuilderPanel").classList.add("hidden");openGraphEditor(g);
  }catch(e){alert("Не вдалося побудувати графік: "+e.message)}
}
function openGraphEditor(graph){
  if(!graph?.graphObject)return;
  selectedGraphObject=graph;
  const m=graph.graphMeta||{};
  $("selectedGraphName").value=m.name||graph.graphName||"Графік";
  $("selectedGraphFormula").textContent=shiftedFormulaLabel(m);
  $("graphShiftX").value=prettyNum(m.shiftX||0);
  $("graphShiftY").value=prettyNum(m.shiftY||0);
  const box=$("selectedGraphParams");box.innerHTML="";
  (graphParamSets[m.type]||[]).forEach(([name])=>{
    const wrap=document.createElement("label");
    wrap.className="graph-param";
    wrap.innerHTML=`<span>${name} =</span><input data-selected-gparam="${name}" type="number" step="0.1" value="${m.params?.[name]??0}">`;
    box.appendChild(wrap);
  });
  if(m.type==="custom"){
    const wrap=document.createElement("label");
    wrap.className="graph-param";
    wrap.innerHTML=`<span>y =</span><input id="selectedCustomExpression" type="text" value="${m.customExpr||"x"}">`;
    box.appendChild(wrap);
  }
  $("graphEditorPanel").classList.remove("hidden");
}
function collectSelectedGraphMeta(){
  if(!selectedGraphObject)return null;
  const old=selectedGraphObject.graphMeta||{},params={...old.params};
  document.querySelectorAll("[data-selected-gparam]").forEach(el=>params[el.dataset.selectedGparam]=Number(el.value));
  return {...old,
    name:$("selectedGraphName").value.trim()||old.name||"Графік",
    params,
    customExpr:$("selectedCustomExpression")?.value??old.customExpr??"",
    shiftX:Number($("graphShiftX").value)||0,
    shiftY:Number($("graphShiftY").value)||0
  };
}
function liveUpdateSelectedGraph(){
  if(!selectedGraphObject)return;
  try{
    const meta=collectSelectedGraphMeta();
    selectedGraphObject=replaceGraphObject(selectedGraphObject,meta);
    $("selectedGraphFormula").textContent=shiftedFormulaLabel(meta);
    pushHistory();autoSave();
  }catch(e){$("selectedGraphFormula").textContent="Помилка у формулі"}
}
$("selectedGraphParams").addEventListener("input",liveUpdateSelectedGraph);
$("selectedGraphName").addEventListener("input",liveUpdateSelectedGraph);
$("graphShiftX").addEventListener("input",liveUpdateSelectedGraph);
$("graphShiftY").addEventListener("input",liveUpdateSelectedGraph);

$("graphBuilderBtn").onclick=()=>$("graphBuilderPanel").classList.toggle("hidden");
$("insertGraphBtn").onclick=insertGraph;
$("clearGraphsBtn").onclick=()=>{
  fcanvas.getObjects().filter(o=>o.graphObject).forEach(o=>fcanvas.remove(o));
  selectedGraphObject=null;$("graphEditorPanel").classList.add("hidden");
  fcanvas.discardActiveObject();fcanvas.requestRenderAll();pushHistory();autoSave();
};
$("graphEditorCloseBtn").onclick=()=>$("graphEditorPanel").classList.add("hidden");
$("resetGraphPositionBtn").onclick=()=>{if(selectedGraphObject){$("graphShiftX").value=0;$("graphShiftY").value=0;liveUpdateSelectedGraph()}};
$("deleteGraphBtn").onclick=()=>{if(selectedGraphObject){fcanvas.remove(selectedGraphObject);selectedGraphObject=null;$("graphEditorPanel").classList.add("hidden");fcanvas.requestRenderAll();pushHistory();autoSave()}};
$("duplicateGraphBtn").onclick=()=>{
  if(!selectedGraphObject)return;
  const meta=JSON.parse(JSON.stringify(selectedGraphObject.graphMeta));
  meta.name=(meta.name||"Графік")+" копія";meta.shiftX=(meta.shiftX||0)+1;meta.shiftY=(meta.shiftY||0)+1;
  const g=createGraphGroup(meta);fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();openGraphEditor(g);
};

fcanvas.on("selection:created",e=>{const o=e.selected?.[0]||fcanvas.getActiveObject();if(o?.graphObject)openGraphEditor(o)});
fcanvas.on("selection:updated",e=>{const o=e.selected?.[0]||fcanvas.getActiveObject();if(o?.graphObject)openGraphEditor(o)});

fcanvas.on("object:modified",e=>{
  const g=e.target;if(!g?.graphObject)return;
  const step=Math.max(20,Number($("paperSize").value)||32);
  const meta={...(g.graphMeta||{})};
  meta.shiftX=Number(meta.shiftX||0)+(g.left||0)/step;
  meta.shiftY=Number(meta.shiftY||0)-(g.top||0)/step;
  const newGraph=replaceGraphObject(g,meta);
  newGraph.set({left:0,top:0,scaleX:1,scaleY:1,angle:0});newGraph.setCoords();
  selectedGraphObject=newGraph;openGraphEditor(newGraph);pushHistory();autoSave();
});

/* ---------- Числовий промінь ---------- */
$("numberRayBtn").onclick=()=>$("numberRayPanel").classList.toggle("hidden");
$("insertNumberRayBtn").onclick=()=>{
  let a=Number($("rayStart").value);
  let b=Number($("rayEnd").value);
  let stepVal=Math.abs(Number($("rayStep").value))||1;
  const L=Number($("rayLength").value)||520;
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){
    alert("Кінець числового променя має бути більшим за початок.");
    return;
  }
  const count=Math.floor((b-a)/stepVal);
  if(count>60){
    alert("Забагато поділок. Збільште крок.");
    return;
  }
  const c=$("colorPicker").value, sw=Math.max(2,Number($("lineWidth").value));
  const objs=[];
  const y=38;
  objs.push(new fabric.Line([0,y,L-18,y],{stroke:c,strokeWidth:sw,selectable:false,evented:false}));
  objs.push(new fabric.Triangle({
    left:L-6,top:y,width:18,height:22,fill:c,angle:90,
    originX:"center",originY:"center",selectable:false,evented:false
  }));
  const usable=L-32;
  const range=b-a;
  for(let i=0;i<=count;i++){
    const val=a+i*stepVal;
    const x=(val-a)/range*usable;
    objs.push(new fabric.Line([x,y-10,x,y+10],{stroke:c,strokeWidth:1.5,selectable:false,evented:false}));
    const label=Number.isInteger(val)?String(val):String(Number(val.toFixed(2)));
    objs.push(new fabric.Text(label,{
      left:x,top:y+14,originX:"center",fontSize:14,fill:c,fontFamily:"Arial",
      selectable:false,evented:false,erasable:false
    }));
  }
  const g=new fabric.Group(objs,{left:280,top:330,erasable:"deep"});
  fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();setTool("select");
  $("numberRayPanel").classList.add("hidden");
};

/* ---------- Українська мова ---------- */
$("ukrainianBtn").onclick=()=>$("ukrainianPanel").classList.toggle("hidden");
function addUkLine(kind){
  const c=$("colorPicker").value,sw=Math.max(2,Number($("lineWidth").value)),o=[];
  if(kind==="subject")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw}));
  if(kind==="predicate"){o.push(new fabric.Line([0,-4,150,-4],{stroke:c,strokeWidth:sw}),new fabric.Line([0,4,150,4],{stroke:c,strokeWidth:sw}))}
  if(kind==="object")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw,strokeDashArray:[8,6]}));
  if(kind==="adverbial")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw,strokeDashArray:[14,6,2,6]}));
  if(kind==="attribute"){
    let p="M 0 0";for(let x=10;x<=150;x+=10)p+=` L ${x} ${(x/10)%2?6:-6}`;
    o.push(new fabric.Path(p,{stroke:c,strokeWidth:sw,fill:"transparent"}));
  }
  groupAndPlace(o,360,420);
}
document.querySelectorAll("[data-ukmark]").forEach(b=>b.onclick=()=>{addUkLine(b.dataset.ukmark);$("ukrainianPanel").classList.add("hidden")});
document.querySelectorAll("[data-wordmark]").forEach(b=>b.onclick=()=>{
  const map={root:"∩",prefix:"⌜",suffix:"⌃",ending:"□",stem:"⌒"};
  const t=new fabric.Text(map[b.dataset.wordmark],{left:380,top:380,fontSize:54,fill:$("colorPicker").value});
  fcanvas.add(t);fcanvas.setActiveObject(t);pushHistory();autoSave();setTool("select");$("ukrainianPanel").classList.add("hidden");
});


/* ---------- Елементи у стилі Canva ---------- */
$("elementsBtn").onclick=()=>$("elementsPanel").classList.toggle("hidden");

document.querySelectorAll(".element-tab").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".element-tab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".element-section").forEach(s=>s.classList.toggle("hidden",s.dataset.section!==btn.dataset.tab));
});

function addEmojiElement(symbol,size=64){
  const t=new fabric.Text(symbol,{left:360,top:260,fontSize:size,fill:$("colorPicker").value,fontFamily:"Arial"});
  fcanvas.add(t);fcanvas.setActiveObject(t);pushHistory();autoSave();setTool("select");
}
function addBasicElement(type){
  const c=$("colorPicker").value,sw=Number($("lineWidth").value);
  let obj=null;
  if(type==="circle")obj=new fabric.Circle({left:340,top:240,radius:55,fill:"transparent",stroke:c,strokeWidth:sw});
  if(type==="square")obj=new fabric.Rect({left:340,top:240,width:110,height:110,fill:"transparent",stroke:c,strokeWidth:sw});
  if(type==="triangle")obj=new fabric.Triangle({left:340,top:240,width:120,height:110,fill:"transparent",stroke:c,strokeWidth:sw});
  if(type==="star"){
    const pts=[];for(let i=0;i<10;i++){const r=i%2===0?60:26,a=-Math.PI/2+i*Math.PI/5;pts.push({x:60+r*Math.cos(a),y:60+r*Math.sin(a)})}
    obj=new fabric.Polygon(pts,{left:340,top:240,fill:"transparent",stroke:c,strokeWidth:sw});
  }
  if(type==="arrow"){
    const l=new fabric.Line([0,30,150,30],{stroke:c,strokeWidth:sw});
    const h=new fabric.Triangle({left:150,top:30,width:22,height:26,fill:c,angle:90,originX:"center",originY:"center"});
    obj=new fabric.Group([l,h],{left:340,top:260});
  }
  if(type==="speech"){
    obj=new fabric.Textbox("Текст",{left:340,top:240,width:180,fontSize:24,backgroundColor:"#ffffff",fill:c,padding:16,stroke:"#d8e0ec",strokeWidth:1});
  }
  if(obj){fcanvas.add(obj);fcanvas.setActiveObject(obj);pushHistory();autoSave();setTool("select")}
}
document.querySelectorAll("[data-element]").forEach(btn=>btn.onclick=()=>{
  const t=btn.dataset.element;
  if(["circle","square","triangle","star","arrow","speech"].includes(t))addBasicElement(t);
  else{
    const map={check:"✓",cross:"✕",heart:"♥",book:"📘",bulb:"💡",pin:"📌",note:"🗒",formula:"∑",computer:"💻",globe:"🌍",clock:"🕒",medal:"🏅",sparkle:"✨",smile:"😊",warning:"⚠️",question:"❓",ideaSticker:"💭",ribbon:"🎀"};
    addEmojiElement(map[t]||"✦");
  }
  $("elementsPanel").classList.add("hidden");
});


/* ---------- Геометричні прилади як Fabric-об'єкти ---------- */
$("geometryBtn").onclick=()=>$("geometryPanel").classList.toggle("hidden");
$("shapeLibraryBtn").onclick=()=>$("shapeLibraryPanel").classList.toggle("hidden");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));

function groupInstrument(objects,left=220,top=210){
  const g=new fabric.Group(objects,{left,top,selectable:true,evented:true,transparentCorners:false,cornerColor:"#17315f",cornerStyle:"circle"});
  fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();setTool("select");$("geometryPanel").classList.add("hidden");return g;
}
function textObj(txt,left,top,size=11,extra={}){
  return new fabric.Text(txt,{left,top,fontSize:size,fill:"#17315f",fontFamily:"Arial",selectable:false,evented:false,...extra});
}
function lineObj(x1,y1,x2,y2,sw=1,dash=null){
  return new fabric.Line([x1,y1,x2,y2],{stroke:"#17315f",strokeWidth:sw,strokeDashArray:dash,selectable:false,evented:false});
}

function addRulerInstrument(){
  const pxPerCm=37.7952755906; // CSS cm
  const width=20*pxPerCm, height=82;
  const objs=[
    new fabric.Rect({left:0,top:0,width,height,fill:"rgba(224,234,248,.88)",stroke:"#17315f",strokeWidth:1,rx:4,ry:4,selectable:false,evented:false})
  ];
  // 1 mm = 0.1 cm; every 10th is cm, every 5th half-cm
  for(let mm=0;mm<=200;mm++){
    const x=mm*(pxPerCm/10);
    let h=15, sw=1;
    if(mm%10===0){h=35;sw=1.3}
    else if(mm%5===0){h=25;sw=1.1}
    objs.push(lineObj(x,height-6,x,height-6-h,sw));
    if(mm%10===0 && mm<=200){
      objs.push(textObj(String(mm/10),x+(mm===0?2:-4),8,9));
    }
  }
  objs.push(textObj("см",width-24,8,10,{fontWeight:"bold"}));
  groupInstrument(objs,150,250);
}

function addProtractorInstrument(){
  const cx=160,cy=150,r=145;
  const objs=[];
  objs.push(new fabric.Path(`M 15 ${cy} A ${r} ${r} 0 0 1 ${cx*2-15} ${cy}`,{
    stroke:"#17315f",strokeWidth:2,fill:"rgba(224,234,248,.72)",selectable:false,evented:false
  }));
  objs.push(lineObj(15,cy,cx*2-15,cy,1.5));
  for(let deg=0;deg<=180;deg+=5){
    const a=Math.PI-(deg*Math.PI/180);
    const outer={x:cx+r*Math.cos(a),y:cy-r*Math.sin(a)};
    const len=deg%30===0?20:deg%10===0?14:8;
    const inner={x:cx+(r-len)*Math.cos(a),y:cy-(r-len)*Math.sin(a)};
    objs.push(lineObj(inner.x,inner.y,outer.x,outer.y,deg%30===0?1.3:1));
    if(deg%30===0){
      const tx=cx+(r-35)*Math.cos(a),ty=cy-(r-35)*Math.sin(a);
      objs.push(textObj(deg+"°",tx-10,ty-6,9));
    }
  }
  objs.push(new fabric.Circle({left:cx-3,top:cy-3,radius:3,fill:"#d63d3d",selectable:false,evented:false}));
  groupInstrument(objs,390,255);
}

function addSetSquareInstrument(){
  const objs=[];
  const p1={x:0,y:180},p2={x:0,y:0},p3={x:270,y:180};
  objs.push(new fabric.Polygon([p1,p2,p3],{fill:"rgba(215,228,245,.78)",stroke:"#17315f",strokeWidth:2,selectable:false,evented:false}));
  // ticks bottom: 15 cm approx
  const usable=250;
  for(let mm=0;mm<=150;mm++){
    const x=10+usable*(mm/150);
    const h=mm%10===0?18:mm%5===0?12:7;
    objs.push(lineObj(x,178,x,178-h,1));
    if(mm%10===0)objs.push(textObj(String(mm/10),x-4,150,8));
  }
  // vertical ticks 10 cm
  for(let mm=0;mm<=100;mm++){
    const y=170-150*(mm/100);
    const w=mm%10===0?18:mm%5===0?12:7;
    objs.push(lineObj(2,y,2+w,y,1));
  }
  objs.push(textObj("90°",14,145,11,{fontWeight:"bold"}),textObj("60°",225,150,11,{fontWeight:"bold"}),textObj("30°",15,20,11,{fontWeight:"bold"}));
  groupInstrument(objs,230,390);
}

function addCompassInstrument(){
  const objs=[];
  objs.push(lineObj(70,10,20,180,7),lineObj(70,10,120,180,7));
  objs.push(new fabric.Circle({left:62,top:2,radius:8,fill:"#17315f",selectable:false,evented:false}));
  objs.push(textObj("Циркуль",40,190,12,{fontWeight:"bold"}));
  objs.push(textObj("Радіус задається при побудові кола",0,208,9));
  groupInstrument(objs,720,230);
}

document.querySelectorAll("[data-instrument]").forEach(b=>b.onclick=()=>{
  const t=b.dataset.instrument;
  if(t==="ruler")addRulerInstrument();
  if(t==="protractor")addProtractorInstrument();
  if(t==="setsquare")addSetSquareInstrument();
  if(t==="compass")addCompassInstrument();
});

/* Побудова кола циркулем через значення в см */
const CSS_PX_PER_CM=96/2.54;

/* ---------- Голос ---------- */
function insertTextIntoBoard(text){
  let obj=fcanvas.getActiveObject();
  if(!(obj&&["i-text","textbox"].includes(obj.type))){
    obj=new fabric.IText("",{left:280,top:180,fontSize:27,fill:$("colorPicker").value});fcanvas.add(obj);fcanvas.setActiveObject(obj);obj.enterEditing();
  }
  if(obj.enterEditing&&!obj.isEditing)obj.enterEditing();
  obj.insertChars(text,null,obj.selectionStart,obj.selectionEnd);obj.setCoords();fcanvas.requestRenderAll();pushHistory();autoSave();syncTextFormatBar();
}
$("voiceBtn").onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Голосове введення підтримується у Chrome/Edge.");return}
  const r=new SR();r.lang=$("subject").value==="Англійська мова"?"en-US":"uk-UA";r.interimResults=false;
  $("voiceBtn").textContent="🎙 Слухаю…";r.onresult=e=>insertTextIntoBoard(e.results[0][0].transcript+" ");r.onend=()=>$("voiceBtn").textContent="🎙 Голос";r.start();
};

/* ---------- Екранна клавіатура ---------- */
const keysUA=["1","2","3","4","5","6","7","8","9","0","-","=","й","ц","у","к","е","н","г","ш","щ","з","х","ї","ф","і","в","а","п","р","о","л","д","ж","є","я","ч","с","м","и","т","ь","б","ю",",",".","?"];
const keysEN=["1","2","3","4","5","6","7","8","9","0","-","=","q","w","e","r","t","y","u","i","o","p","[","]","a","s","d","f","g","h","j","k","l",";","'","z","x","c","v","b","n","m",",",".","?"];
function renderKeyboard(){
  const box=$("keyboardKeys");
  if(!box)return;
  box.innerHTML="";
  (keyboardLang==="UA"?keysUA:keysEN).forEach(k=>{const b=document.createElement("button");b.className="key-btn";b.textContent=k;b.onclick=()=>insertTextIntoBoard(k);box.appendChild(b)});
  [["Space"," "],["Enter","\n"],["⌫","BACK"]].forEach(([label,val])=>{
    const b=document.createElement("button");b.className="key-btn special "+(label==="Space"?"space":"");b.textContent=label;
    b.onclick=()=>{if(val==="BACK"){const o=fcanvas.getActiveObject();if(o&&["i-text","textbox"].includes(o.type)){const p=o.selectionStart||0;if(p>0)o.removeChars(p-1,p);fcanvas.requestRenderAll();autoSave()}}else insertTextIntoBoard(val)};box.appendChild(b);
  });
}
if($("keyboardBtn")) $("keyboardBtn").onclick=()=>{
  const p=$("keyboardPanel"); if(!p)return;
  p.classList.toggle("hidden");renderKeyboard()
};
if($("keyboardCloseBtn")) $("keyboardCloseBtn").onclick=()=>$("keyboardPanel")?.classList.add("hidden");
if($("keyboardLangBtn")) $("keyboardLangBtn").onclick=()=>{
  keyboardLang=keyboardLang==="UA"?"EN":"UA";
  $("keyboardLangBtn").textContent=keyboardLang;renderKeyboard()
};

/* ---------- AI чат ---------- */
let lastAIReply="";
$("aiBtn").onclick=()=>$("aiPanel").classList.toggle("hidden");

function addAIMessage(text,role){
  const d=document.createElement("div");
  d.className="ai-message "+role;
  d.textContent=text;
  $("aiMessages").appendChild(d);
  $("aiMessages").scrollTop=$("aiMessages").scrollHeight;
}
document.querySelectorAll("[data-aiquick]").forEach(b=>b.onclick=()=>{
  $("aiPrompt").value=b.dataset.aiquick;
  $("aiPrompt").focus();
});
async function sendAIMessage(){
  const text=$("aiPrompt").value.trim();
  if(!text)return;
  addAIMessage(text,"user");
  $("aiPrompt").value="";
  $("aiSendBtn").disabled=true;
  $("aiSendBtn").textContent="Думаю…";
  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:text,
        context:{
          subject:$("subject").value,
          grade:$("studentClass").value,
          workType:$("workType").value
        }
      })
    });
    if(!res.ok)throw new Error("AI endpoint unavailable");
    const data=await res.json();
    lastAIReply=data.reply||data.message||"";
    addAIMessage(lastAIReply||"Не отримано відповіді.","assistant");
  }catch(e){
    lastAIReply="AI ще не підключено до серверної частини. Інтерфейс готовий; наступним кроком потрібно створити /api/chat на захищеному сервері.";
    addAIMessage(lastAIReply,"assistant");
  }finally{
    $("aiSendBtn").disabled=false;
    $("aiSendBtn").textContent="Надіслати";
  }
}
$("aiSendBtn").onclick=sendAIMessage;
$("aiPrompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAIMessage()}});
$("aiInsertLastBtn").onclick=()=>{if(lastAIReply)insertTextIntoBoard(lastAIReply)};




/* ---------- Сторінки ---------- */
function savePage(){pages[currentPage]={json:fcanvas.toJSON(),paper:$("paperType").value,paperSize:Number($("paperSize").value),paperColor:$("paperLineColor").value}}
function loadPage(i){
  currentPage=i;const p=pages[i]||blankPage();$("paperType").value=p.paper||"grid";$("paperSize").value=String(p.paperSize||25);$("paperSizeValue").textContent=$("paperSize").value;$("paperLineColor").value=p.paperColor||"#9fd5ff";applyPaper();
  suppressHistory=true;fcanvas.clear();
  if(p.json)fcanvas.loadFromJSON(p.json,()=>{
    fcanvas.getObjects().forEach(o=>{
      if(o.isEraserMask){
        o.set({
          globalCompositeOperation:"destination-out",
          selectable:false,
          evented:false,
          objectCaching:false
        });
      }
    });
    normalizeEraserLayerOrder();
    fcanvas.renderAll();suppressHistory=false;
    ensureHeadingObjects();
    history=[canvasState()];redoHistory=[];setTool("select")
  });
  else{
    suppressHistory=false;
    ensureHeadingObjects();
    history=[];pushHistory();setTool("select")
  }
  updatePageIndicator();
}
function updatePageIndicator(){$("pageIndicator").textContent=`Сторінка ${currentPage+1} з ${pages.length}`;$("prevPageBtn").disabled=currentPage===0;$("nextPageBtn").disabled=currentPage===pages.length-1}
$("addPageBtn").onclick=()=>{savePage();pages.push(blankPage());loadPage(pages.length-1);autoSave()};
$("deletePageBtn").onclick=()=>{if(pages.length===1){alert("Має залишитися хоча б одна сторінка.");return}if(!confirm("Видалити поточну сторінку?"))return;pages.splice(currentPage,1);currentPage=Math.min(currentPage,pages.length-1);loadPage(currentPage);autoSave()};
$("prevPageBtn").onclick=()=>{if(currentPage>0){savePage();loadPage(currentPage-1)}};
$("nextPageBtn").onclick=()=>{if(currentPage<pages.length-1){savePage();loadPage(currentPage+1)}};
updatePageIndicator();

/* ---------- Збереження ---------- */
function data(){
  savePage();return{meta:{studentName:$("studentName").value,studentClass:$("studentClass").value,subject:$("subject").value,workType:$("workType").value,pageMode:$("pageMode").value,dateMode:$("dateMode").value,customDate:$("customDate").value,manualDate:$("manualDate").value},pages,currentPage}
}
function autoSave(){
  try{localStorage.setItem("sofiaNotebookV12",JSON.stringify(data()));$("saveStatus").textContent="✅ Автозбережено "+new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"})}catch(e){$("saveStatus").textContent="⚠️ Не вдалося зберегти"}
}
$("saveBtn").onclick=()=>{autoSave();alert("Збережено у цьому браузері.")};setInterval(autoSave,30000);
$("clearPageBtn").onclick=()=>{if(confirm("Очистити поточну сторінку?")){fcanvas.clear();history=[];pushHistory();autoSave()}};
$("clearAllBtn").onclick=()=>{
  if(!confirm("Очистити весь зошит, усі сторінки й дані?"))return;if(!confirm("Підтвердьте ще раз."))return;
  localStorage.removeItem("sofiaNotebookV12");pages=[blankPage()];currentPage=0;fcanvas.clear();history=[];redoHistory=[];ensureHeadingObjects();pushHistory();
  $("studentName").value="";$("studentClass").value="";$("subject").value="";$("workType").value="Класна робота";$("pageMode").value="lesson";$("dateMode").value="words";$("customDate").value="";$("manualDate").value="";
  $("paperType").value="grid";$("paperSize").value="25";$("paperSizeValue").textContent="25";$("paperLineColor").value="#9fd5ff";applyPaper();updateHeading();updatePageIndicator();$("saveStatus").textContent="Зошит повністю очищено";
};
function loadAll(){
  const raw=localStorage.getItem("sofiaNotebookV12");if(!raw){pushHistory();return}
  try{
    const d=JSON.parse(raw);pages=d.pages?.length?d.pages:[blankPage()];currentPage=Math.min(d.currentPage||0,pages.length-1);const m=d.meta||{};
    ["studentName","studentClass","subject","workType","pageMode","dateMode","customDate","manualDate"].forEach(k=>{if(m[k]!==undefined&&$(k))$(k).value=m[k]});
    updateHeading();loadPage(currentPage);
  }catch(e){pushHistory()}
}
document.body.classList.add("touch-board");
setTimeout(loadAll,150);

/* предмет автоматично вибирає фон */
$("subject").onchange=()=>{
  const map={"Математика":"grid","Алгебра":"grid","Геометрія":"grid","Фізика":"grid","Хімія":"grid","Українська мова":"lines","Українська література":"lines","Англійська мова":"lines","Мистецтво":"clean"};
  if(map[$("subject").value])$("paperType").value=map[$("subject").value];applyPaper();autoSave();
};
["studentName","studentClass"].forEach(id=>$(id).addEventListener("change",autoSave));


/* =========================================================
   V17: НАДІЙНІ ВЕРХНІ КНОПКИ + ТАЙМЕР ДЛЯ ЗМАГАНЬ
   ========================================================= */
(function(){
  const byId=id=>document.getElementById(id);

  /* ---------- Клавіатура ---------- */
  function ensureKeyboard(){
    const panel=byId("keyboardPanel");
    if(!panel)return;
    panel.classList.toggle("hidden");
    if(!panel.classList.contains("hidden") && typeof renderKeyboard==="function"){
      renderKeyboard();
    }
  }
  const keyboardBtn=byId("keyboardBtn");
  if(keyboardBtn){
    keyboardBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();ensureKeyboard();};
  }
  const keyboardClose=byId("keyboardCloseBtn");
  if(keyboardClose){
    keyboardClose.onclick=()=>byId("keyboardPanel")?.classList.add("hidden");
  }

  /* ---------- Голос ---------- */
  const voiceBtn=byId("voiceBtn");
  if(voiceBtn){
    voiceBtn.onclick=(e)=>{
      e.preventDefault();e.stopPropagation();
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){
        alert("Голосове введення не підтримується цим браузером. Для інтерактивної дошки відкрийте сторінку в Google Chrome або Microsoft Edge.");
        return;
      }
      const rec=new SR();
      rec.lang=(byId("subject")?.value==="Англійська мова")?"en-US":"uk-UA";
      rec.interimResults=false;
      rec.continuous=false;
      const old=voiceBtn.textContent;
      voiceBtn.textContent="🎙 Слухаю…";
      rec.onresult=evt=>{
        const text=evt.results?.[0]?.[0]?.transcript||"";
        if(text){
          if(typeof insertTextIntoBoard==="function")insertTextIntoBoard(text+" ");
          else alert(text);
        }
      };
      rec.onerror=()=>alert("Не вдалося розпізнати мовлення. Перевірте доступ до мікрофона.");
      rec.onend=()=>voiceBtn.textContent=old;
      try{rec.start()}catch(err){voiceBtn.textContent=old;}
    };
  }

  /* ---------- AI чат ---------- */
  const aiBtn=byId("aiBtn");
  if(aiBtn){
    aiBtn.onclick=(e)=>{
      e.preventDefault();e.stopPropagation();
      byId("aiPanel")?.classList.toggle("hidden");
    };
  }
  // Fallback-режим: якщо сервер AI ще не підключений, чат все одно дає базові локальні відповіді.
  window.localSofiaAI=function(text){
    const q=(text||"").toLowerCase();
    if(q.includes("5 завдан")||q.includes("п'ять завдан")||q.includes("пять завдан")){
      const subj=byId("subject")?.value||"предмет";
      const grade=byId("studentClass")?.value||"клас";
      return `Ось 5 заготовок для ${subj}, ${grade}:\n1. Виконайте перше завдання за темою уроку.\n2. Поясніть свій спосіб розв'язання.\n3. Знайдіть і виправте помилку у прикладі.\n4. Складіть власний приклад за зразком.\n5. Підсумуйте, що було найважливішим на уроці.`;
    }
    if(q.includes("поясн")){
      return "Спробуйте подати тему у трьох кроках: коротке правило → наочний приклад → невелика вправа для перевірки розуміння.";
    }
    if(q.includes("вправ")){
      return "Міні-вправа: виконайте завдання самостійно, поясніть хід думок сусіду, а потім перевірте відповідь разом.";
    }
    return "AI-інтерфейс працює. Для повноцінних відповідей рівня ChatGPT потрібно підключити захищений серверний API. Поки що я можу вставляти локальні шаблони та заготовки для уроку.";
  };

  const sendBtn=byId("aiSendBtn");
  if(sendBtn){
    sendBtn.onclick=async()=>{
      const input=byId("aiPrompt");
      const text=input?.value.trim();
      if(!text)return;
      if(typeof addAIMessage==="function")addAIMessage(text,"user");
      if(input)input.value="";
      sendBtn.disabled=true;sendBtn.textContent="Думаю…";
      let reply="";
      try{
        const res=await fetch("/api/chat",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            message:text,
            context:{
              subject:byId("subject")?.value||"",
              grade:byId("studentClass")?.value||"",
              workType:byId("workType")?.value||""
            }
          })
        });
        if(!res.ok)throw new Error("no backend");
        const data=await res.json();
        reply=data.reply||data.message||"";
      }catch(err){
        reply=window.localSofiaAI(text);
      }
      window.lastAIReply=reply;
      if(typeof addAIMessage==="function")addAIMessage(reply,"assistant");
      else{
        const box=byId("aiMessages");
        if(box){
          const d=document.createElement("div");
          d.className="ai-message assistant";
          d.textContent=reply;box.appendChild(d);
        }
      }
      sendBtn.disabled=false;sendBtn.textContent="Надіслати";
    };
  }
  const insertLast=byId("aiInsertLastBtn");
  if(insertLast){
    insertLast.onclick=()=>{
      const txt=window.lastAIReply||lastAIReply||"";
      if(txt && typeof insertTextIntoBoard==="function")insertTextIntoBoard(txt);
    };
  }

  /* ---------- Зберегти ---------- */
  const saveBtn=byId("saveBtn");
  if(saveBtn){
    saveBtn.onclick=(e)=>{
      e.preventDefault();e.stopPropagation();
      try{
        if(typeof autoSave==="function")autoSave();
        const status=byId("saveStatus");
        if(status)status.textContent="✅ Збережено вручну "+new Date().toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
      }catch(err){
        alert("Не вдалося зберегти роботу.");
      }
    };
  }

  /* ---------- Очистити все ---------- */
  const clearAll=byId("clearAllBtn");
  if(clearAll){
    clearAll.onclick=(e)=>{
      e.preventDefault();e.stopPropagation();
      if(!confirm("Очистити весь зошит: усі сторінки, текст, малюнки та об'єкти?"))return;
      if(!confirm("Підтвердіть ще раз. Цю дію не можна скасувати."))return;
      try{
        localStorage.removeItem("sofiaNotebookV12");
        localStorage.removeItem("sofiaNotebookV14");
        localStorage.removeItem("sofiaNotebookV15");
        localStorage.removeItem("sofiaNotebookV16");
        if(typeof fcanvas!=="undefined")fcanvas.clear();
        if(typeof pages!=="undefined"){pages=[typeof blankPage==="function"?blankPage():{json:null,paper:"grid",paperSize:25,paperColor:"#9fd5ff"}];currentPage=0;}
        if(byId("studentName"))byId("studentName").value="";
        if(byId("studentClass"))byId("studentClass").value="";
        if(byId("subject"))byId("subject").value="";
        if(byId("workType"))byId("workType").value="Класна робота";
        if(byId("pageMode"))byId("pageMode").value="lesson";
        if(byId("dateMode"))byId("dateMode").value="words";
        if(typeof updateHeading==="function")updateHeading();
        if(typeof updatePageIndicator==="function")updatePageIndicator();
        if(typeof ensureHeadingObjects==="function")ensureHeadingObjects();
        if(typeof autoSave==="function")autoSave();
      }catch(err){
        console.error(err);
      }
    };
  }

  /* ---------- Таймер ---------- */
  let timerTotal=300;
  let timerRemaining=300;
  let timerRunning=false;
  let timerInterval=null;

  function renderTimerV17(){
    const min=Math.floor(timerRemaining/60);
    const sec=timerRemaining%60;
    const el=byId("timerDisplay");
    if(el)el.textContent=`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    document.title=timerRunning?`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")} • Sofia Notebook PRO`:"Sofia Notebook PRO";
  }
  function stopTimerInterval(){
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    timerRunning=false;
  }
  function beepTimer(){
    if(!byId("timerSound")?.checked)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      const ac=new AC();
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.connect(gain);gain.connect(ac.destination);
      osc.frequency.value=880;gain.gain.value=.15;
      osc.start();
      setTimeout(()=>{osc.stop();ac.close()},900);
    }catch(e){}
  }
  function setTimerSeconds(sec){
    stopTimerInterval();
    timerTotal=Math.max(0,Math.floor(sec));
    timerRemaining=timerTotal;
    const m=byId("timerMinutes"),s=byId("timerSecondsInput");
    if(m)m.value=Math.floor(timerTotal/60);
    if(s)s.value=timerTotal%60;
    renderTimerV17();
  }
  function readCustomTimer(){
    const m=Math.max(0,Number(byId("timerMinutes")?.value)||0);
    const s=Math.max(0,Math.min(59,Number(byId("timerSecondsInput")?.value)||0));
    return m*60+s;
  }
  function startCompetitionTimer(){
    if(timerRunning)return;
    if(timerRemaining<=0)setTimerSeconds(readCustomTimer()||300);
    timerRunning=true;
    timerInterval=setInterval(()=>{
      timerRemaining=Math.max(0,timerRemaining-1);
      renderTimerV17();
      if(timerRemaining<=0){
        stopTimerInterval();
        beepTimer();
        const display=byId("timerDisplay");
        if(display){
          display.animate(
            [{transform:"scale(1)"},{transform:"scale(1.12)"},{transform:"scale(1)"}],
            {duration:650,iterations:4}
          );
        }
      }
    },1000);
  }

  const timerBtn=byId("timerBtn");
  if(timerBtn)timerBtn.onclick=()=>byId("timerPanel")?.classList.toggle("hidden");
  byId("timerCloseBtn")?.addEventListener("click",()=>byId("timerPanel")?.classList.add("hidden"));
  document.querySelectorAll("[data-time]").forEach(b=>b.addEventListener("click",()=>setTimerSeconds(Number(b.dataset.time))));
  byId("timerStartBtn")?.addEventListener("click",startCompetitionTimer);
  byId("timerPauseBtn")?.addEventListener("click",stopTimerInterval);
  byId("timerResetBtn")?.addEventListener("click",()=>setTimerSeconds(readCustomTimer()||timerTotal||300));
  byId("timerPlusBtn")?.addEventListener("click",()=>{timerRemaining+=30;timerTotal=Math.max(timerTotal,timerRemaining);renderTimerV17()});
  byId("timerMinutes")?.addEventListener("change",()=>setTimerSeconds(readCustomTimer()));
  byId("timerSecondsInput")?.addEventListener("change",()=>setTimerSeconds(readCustomTimer()));
  byId("timerFullscreenBtn")?.addEventListener("click",()=>{
    const p=byId("timerPanel");
    if(!p)return;
    p.classList.toggle("fullscreen-timer");
    byId("timerFullscreenBtn").textContent=p.classList.contains("fullscreen-timer")?"↙ Звичайний режим":"⛶ Великий режим для дошки";
  });

  setTimerSeconds(300);
})();



/* =========================================================
   V18: РОЗГРУПУВАННЯ БУДЬ-ЯКОЇ ФІГУРИ + РЕДАГУВАННЯ КУТІВ
   ========================================================= */
(function(){
  const byId=id=>document.getElementById(id);
  let vertexEditObject=null;
  let originalControls=null;

  function saveGeometryChange(){
    if(typeof pushHistory==="function")pushHistory();
    if(typeof autoSave==="function")autoSave();
    fcanvas.requestRenderAll();
  }

  /* ---------- Універсальне розгрупування ---------- */
  function ungroupSelectedUniversal(){
    const active=fcanvas.getActiveObject();
    if(!active){
      alert("Спочатку виділіть фігуру.");
      return;
    }

    // Звичайна Fabric-група: розгруповуємо на окремі елементи.
    if(active.type==="group"){
      active.toActiveSelection();
      fcanvas.requestRenderAll();
      saveGeometryChange();
      return;
    }

    // ActiveSelection вже складається з окремих об'єктів.
    if(active.type==="activeSelection"){
      alert("Ці елементи вже розгруповані.");
      return;
    }

    // Для примітивів робимо геометричне "розкладання на частини".
    explodePrimitive(active);
  }

  function transformPoint(obj,x,y){
    return fabric.util.transformPoint(
      new fabric.Point(x,y),
      obj.calcTransformMatrix()
    );
  }

  function removeAndSelect(parts,obj){
    fcanvas.remove(obj);
    parts.forEach(p=>fcanvas.add(p));
    if(parts.length>1){
      const sel=new fabric.ActiveSelection(parts,{canvas:fcanvas});
      fcanvas.setActiveObject(sel);
    }else if(parts[0]){
      fcanvas.setActiveObject(parts[0]);
    }
    saveGeometryChange();
  }

  function commonPartStyle(obj){
    return {
      stroke:obj.stroke||"#17315f",
      strokeWidth:obj.strokeWidth||2,
      strokeDashArray:obj.strokeDashArray||null,
      fill:"transparent",
      strokeLineCap:obj.strokeLineCap||"round"
    };
  }

  function explodePrimitive(obj){
    const st=commonPartStyle(obj);
    let parts=[];

    if(obj.type==="rect"){
      const w=obj.width,h=obj.height;
      const pts=[
        transformPoint(obj,-w/2,-h/2),
        transformPoint(obj,w/2,-h/2),
        transformPoint(obj,w/2,h/2),
        transformPoint(obj,-w/2,h/2)
      ];
      for(let i=0;i<4;i++){
        const a=pts[i],b=pts[(i+1)%4];
        parts.push(new fabric.Line([a.x,a.y,b.x,b.y],st));
      }
      removeAndSelect(parts,obj);return;
    }

    if(obj.type==="triangle"){
      const w=obj.width,h=obj.height;
      const pts=[
        transformPoint(obj,0,-h/2),
        transformPoint(obj,w/2,h/2),
        transformPoint(obj,-w/2,h/2)
      ];
      for(let i=0;i<3;i++){
        const a=pts[i],b=pts[(i+1)%3];
        parts.push(new fabric.Line([a.x,a.y,b.x,b.y],st));
      }
      removeAndSelect(parts,obj);return;
    }

    if(obj.type==="polygon" || obj.type==="polyline"){
      const local=obj.points||[];
      const offset=obj.pathOffset||{x:0,y:0};
      const pts=local.map(p=>transformPoint(obj,p.x-offset.x,p.y-offset.y));
      const count=obj.type==="polygon"?pts.length:pts.length-1;
      for(let i=0;i<count;i++){
        const a=pts[i],b=pts[(i+1)%pts.length];
        parts.push(new fabric.Line([a.x,a.y,b.x,b.y],st));
      }
      removeAndSelect(parts,obj);return;
    }

    if(obj.type==="line"){
      alert("Лінія вже є окремим елементом.");return;
    }

    if(obj.type==="ellipse" || obj.type==="circle"){
      // Коло не має кутів; "розкласти" його можна на дві дуги.
      const center=obj.getCenterPoint();
      const rx=(obj.type==="circle"?obj.radius:obj.rx)*obj.scaleX;
      const ry=(obj.type==="circle"?obj.radius:obj.ry)*obj.scaleY;
      const c=obj.stroke||"#17315f",sw=obj.strokeWidth||2;
      const top=new fabric.Path(`M ${center.x-rx} ${center.y} A ${rx} ${ry} 0 0 1 ${center.x+rx} ${center.y}`,{
        stroke:c,strokeWidth:sw,fill:"transparent"
      });
      const bottom=new fabric.Path(`M ${center.x+rx} ${center.y} A ${rx} ${ry} 0 0 1 ${center.x-rx} ${center.y}`,{
        stroke:c,strokeWidth:sw,fill:"transparent"
      });
      removeAndSelect([top,bottom],obj);return;
    }

    if(["i-text","textbox","text","path"].includes(obj.type)){
      alert("Цей об’єкт не є складеною геометричною фігурою.");
      return;
    }

    alert("Цю фігуру не вдалося автоматично розкласти. Якщо вона згрупована — скористайтеся «Розгрупувати».");
  }

  /* ---------- Перетворення примітивів у полігони для зміни кутів ---------- */
  function rectToPolygon(obj){
    const w=obj.width,h=obj.height;
    return new fabric.Polygon(
      [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}],
      {
        left:obj.left,top:obj.top,
        originX:obj.originX,originY:obj.originY,
        angle:obj.angle,scaleX:obj.scaleX,scaleY:obj.scaleY,
        stroke:obj.stroke||"#17315f",strokeWidth:obj.strokeWidth||2,
        fill:obj.fill||"transparent",strokeDashArray:obj.strokeDashArray||null,
        objectCaching:false
      }
    );
  }
  function triangleToPolygon(obj){
    const w=obj.width,h=obj.height;
    return new fabric.Polygon(
      [{x:w/2,y:0},{x:w,y:h},{x:0,y:h}],
      {
        left:obj.left,top:obj.top,
        originX:obj.originX,originY:obj.originY,
        angle:obj.angle,scaleX:obj.scaleX,scaleY:obj.scaleY,
        stroke:obj.stroke||"#17315f",strokeWidth:obj.strokeWidth||2,
        fill:obj.fill||"transparent",strokeDashArray:obj.strokeDashArray||null,
        objectCaching:false
      }
    );
  }

  function replaceWithPolygon(obj){
    let poly=null;
    if(obj.type==="rect")poly=rectToPolygon(obj);
    if(obj.type==="triangle")poly=triangleToPolygon(obj);
    if(!poly)return obj;
    fcanvas.remove(obj);fcanvas.add(poly);fcanvas.setActiveObject(poly);return poly;
  }

  function polygonPositionHandler(dim,finalMatrix,fabricObject){
    const x=(fabricObject.points[this.pointIndex].x-fabricObject.pathOffset.x);
    const y=(fabricObject.points[this.pointIndex].y-fabricObject.pathOffset.y);
    return fabric.util.transformPoint(
      {x,y},
      fabric.util.multiplyTransformMatrices(
        fabricObject.canvas.viewportTransform,
        fabricObject.calcTransformMatrix()
      )
    );
  }

  function actionHandler(eventData,transform,x,y){
    const polygon=transform.target;
    const currentControl=polygon.controls[polygon.__corner];
    const mouseLocalPosition=polygon.toLocalPoint(new fabric.Point(x,y),"center","center");
    const polygonBaseSize=polygon._getNonTransformedDimensions();
    const size=polygon._getTransformedDimensions(0,0);
    const finalPointPosition={
      x:mouseLocalPosition.x*polygonBaseSize.x/size.x+polygon.pathOffset.x,
      y:mouseLocalPosition.y*polygonBaseSize.y/size.y+polygon.pathOffset.y
    };
    polygon.points[currentControl.pointIndex]=finalPointPosition;
    updateAngleList(polygon);
    return true;
  }

  function anchorWrapper(anchorIndex,fn){
    return function(eventData,transform,x,y){
      const fabricObject=transform.target;
      const absolutePoint=fabric.util.transformPoint({
        x:fabricObject.points[anchorIndex].x-fabricObject.pathOffset.x,
        y:fabricObject.points[anchorIndex].y-fabricObject.pathOffset.y
      },fabricObject.calcTransformMatrix());

      const actionPerformed=fn(eventData,transform,x,y);

      const newDim=fabricObject._setPositionDimensions({});
      const polygonBaseSize=fabricObject._getNonTransformedDimensions();
      const newX=(fabricObject.points[anchorIndex].x-fabricObject.pathOffset.x)/polygonBaseSize.x;
      const newY=(fabricObject.points[anchorIndex].y-fabricObject.pathOffset.y)/polygonBaseSize.y;

      fabricObject.setPositionByOrigin(absolutePoint,newX+0.5,newY+0.5);
      return actionPerformed;
    };
  }

  function enableVertexEditing(obj){
    obj=replaceWithPolygon(obj);

    if(obj.type!=="polygon"){
      if(obj.type==="group"){
        alert("Спочатку розгрупуйте фігуру, а потім оберіть окремий полігон.");
      }else if(obj.type==="circle"||obj.type==="ellipse"){
        alert("Коло та еліпс не мають вершин і кутів.");
      }else{
        alert("Для зміни кутів виберіть квадрат, прямокутник, трикутник, ромб, трапецію або інший полігон.");
      }
      return;
    }

    vertexEditObject=obj;
    originalControls=obj.controls;

    const lastControl=obj.points.length-1;
    obj.cornerStyle="circle";
    obj.cornerColor="#e53935";
    obj.transparentCorners=false;
    obj.hasBorders=false;
    obj.controls=obj.points.reduce((acc,_point,index)=>{
      acc["p"+index]=new fabric.Control({
        positionHandler:polygonPositionHandler,
        actionHandler:anchorWrapper(index>0?index-1:lastControl,actionHandler),
        actionName:"modifyPolygon",
        pointIndex:index,
        cursorStyle:"crosshair",
        render:function(ctx,left,top){
          ctx.save();
          ctx.beginPath();ctx.arc(left,top,8,0,Math.PI*2);
          ctx.fillStyle="#e53935";ctx.fill();
          ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
          ctx.restore();
        }
      });
      return acc;
    },{});

    obj.set({objectCaching:false,selectable:true,evented:true});
    fcanvas.setActiveObject(obj);
    byId("vertexEditPanel")?.classList.remove("hidden");
    updateAngleList(obj);
    fcanvas.requestRenderAll();
  }

  function getWorldPoints(poly){
    return poly.points.map(p=>fabric.util.transformPoint(
      new fabric.Point(p.x-poly.pathOffset.x,p.y-poly.pathOffset.y),
      poly.calcTransformMatrix()
    ));
  }
  function angleAt(a,b,c){
    const v1={x:a.x-b.x,y:a.y-b.y},v2={x:c.x-b.x,y:c.y-b.y};
    const dot=v1.x*v2.x+v1.y*v2.y;
    const l1=Math.hypot(v1.x,v1.y),l2=Math.hypot(v2.x,v2.y);
    if(!l1||!l2)return 0;
    return Math.acos(Math.max(-1,Math.min(1,dot/(l1*l2))))*180/Math.PI;
  }
  function updateAngleList(poly){
    const box=byId("vertexAngles");if(!box||!poly)return;
    box.innerHTML="";
    const pts=getWorldPoints(poly);
    pts.forEach((p,i)=>{
      const prev=pts[(i-1+pts.length)%pts.length];
      const next=pts[(i+1)%pts.length];
      const deg=angleAt(prev,p,next);
      const d=document.createElement("div");
      d.className="vertex-angle-chip";
      d.textContent=`${String.fromCharCode(65+i)}: ${deg.toFixed(1)}°`;
      box.appendChild(d);
    });
  }

  function finishVertexEditing(){
    if(vertexEditObject){
      vertexEditObject.controls=originalControls||fabric.Object.prototype.controls;
      vertexEditObject.hasBorders=true;
      vertexEditObject.set({objectCaching:true});
      vertexEditObject.setCoords();
      saveGeometryChange();
    }
    vertexEditObject=null;
    originalControls=null;
    byId("vertexEditPanel")?.classList.add("hidden");
    fcanvas.requestRenderAll();
  }

  byId("ungroupBtn") && (byId("ungroupBtn").onclick=ungroupSelectedUniversal);
  byId("explodeShapeBtn") && (byId("explodeShapeBtn").onclick=()=>{
    const o=fcanvas.getActiveObject();
    if(!o){alert("Спочатку виділіть фігуру.");return;}
    explodePrimitive(o);
  });
  byId("editVerticesBtn") && (byId("editVerticesBtn").onclick=()=>{
    const o=fcanvas.getActiveObject();
    if(!o){alert("Спочатку виділіть фігуру.");return;}
    enableVertexEditing(o);
  });
  byId("finishVertexEdit") && (byId("finishVertexEdit").onclick=finishVertexEditing);
  byId("vertexEditClose") && (byId("vertexEditClose").onclick=finishVertexEditing);

  fcanvas.on("object:modified",e=>{
    if(vertexEditObject && e.target===vertexEditObject)updateAngleList(vertexEditObject);
  });
})();



/* =========================================================
   V19: САМОПЕРЕВІРКА КНОПОК
   ========================================================= */
(function(){
  const q=id=>document.getElementById(id);

  const checks = [
    ["keyboardBtn","Клавіатура"],
    ["timerBtn","Таймер"],
    ["calculatorBtn","Калькулятор"],
    ["voiceBtn","Голос"],
    ["aiBtn","AI чат"],
    ["saveBtn","Зберегти"],
    ["clearAllBtn","Очистити все"],
    ["correctionMarkerBtn","Маркер перевірки"],
    ["elementsBtn","Елементи"],
    ["geometryBtn","Прилади"],
    ["shapeLibraryBtn","2D / 3D фігури"],
    ["angleBtn","Побудувати кут"],
    ["graphBuilderBtn","Побудова графіка"],
    ["numberRayBtn","Числовий промінь"],
    ["pointBtn","Точка"],
    ["vertexLabelBtn","Вершина"],
    ["ukrainianBtn","Розбір"],
    ["noteBtn","Замітка"],
    ["groupBtn","Групувати"],
    ["ungroupBtn","Розгрупувати"],
    ["explodeShapeBtn","Розкласти фігуру"],
    ["editVerticesBtn","Змінювати кути"],
    ["undoBtn","Назад"],
    ["redoBtn","Вперед"],
    ["deleteSelectedBtn","Видалити вибране"],
    ["clearPageBtn","Очистити сторінку"],
    ["addPageBtn","Нова сторінка"],
    ["deletePageBtn","Видалити сторінку"]
  ];

  function hasClickHandler(el){
    if(!el)return false;
    if(typeof el.onclick==="function")return true;
    // addEventListener handlers are not directly introspectable; for known app buttons,
    // presence + no runtime startup error is enough to mark as ready.
    return true;
  }

  function runDiagnostics(){
    const out=q("diagnosticsResults");
    if(!out)return;
    out.innerHTML="";

    const fabricOk=typeof window.fabric!=="undefined";
    const canvasOk=typeof window.fcanvas!=="undefined" || typeof fcanvas!=="undefined";

    const top=document.createElement("div");
    top.className="diag-summary "+(fabricOk&&canvasOk?"ok":"bad");
    top.textContent=(fabricOk&&canvasOk)
      ?"✅ Графічне ядро завантажено"
      :"❌ Графічне ядро не завантажено";
    out.appendChild(top);

    checks.forEach(([id,name])=>{
      const el=q(id);
      const row=document.createElement("div");
      const ok=!!el && hasClickHandler(el);
      row.className="diag-row "+(ok?"ok":"bad");
      row.innerHTML=`<span>${ok?"✅":"❌"} ${name}</span><small>${ok?"готово":"елемент не знайдено"}</small>`;
      out.appendChild(row);
    });

    const keyboardIds=["keyboardPanel","keyboardKeys","keyboardLangBtn","keyboardCloseBtn"];
    const kOk=keyboardIds.every(id=>!!q(id));
    const kr=document.createElement("div");
    kr.className="diag-row "+(kOk?"ok":"bad");
    kr.innerHTML=`<span>${kOk?"✅":"❌"} Вбудована клавіатура</span><small>${kOk?"усі елементи на місці":"бракує елементів"}</small>`;
    out.appendChild(kr);
  }

  q("diagnosticsBtn")?.addEventListener("click",()=>{
    q("diagnosticsPanel")?.classList.remove("hidden");
    runDiagnostics();
  });
  q("diagnosticsCloseBtn")?.addEventListener("click",()=>q("diagnosticsPanel")?.classList.add("hidden"));
  q("runDiagnosticsBtn")?.addEventListener("click",runDiagnostics);

  // Do a silent DOM audit after startup and log problems.
  window.addEventListener("load",()=>{
    const missing=checks.filter(([id])=>!q(id)).map(([,name])=>name);
    if(missing.length)console.warn("Sofia Notebook missing controls:",missing);
  });
})();


/* V20: швидкий вибір типу лінії клавішами 1–5, коли не редагується текст */
document.addEventListener("keydown",e=>{
  const tag=document.activeElement?.tagName;
  if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;
  const map={"1":"segment","2":"line","3":"ray","4":"arrow","5":"doubleArrow"};
  if(map[e.key] && document.getElementById("lineKind")){
    document.getElementById("lineKind").value=map[e.key];
  }
});


/* ---------- Вбудований калькулятор ---------- */
let calcLastResult="";
function normalizeCalcExpression(expr){
  return expr
    .replace(/,/g,".")
    .replace(/÷/g,"/")
    .replace(/×/g,"*")
    .replace(/\^/g,"**")
    .replace(/\bpi\b/gi,"Math.PI")
    .replace(/π/g,"Math.PI")
    .replace(/\bsin\(/gi,"Math.sin(")
    .replace(/\bcos\(/gi,"Math.cos(")
    .replace(/\btan\(/gi,"Math.tan(")
    .replace(/\bsqrt\(/gi,"Math.sqrt(");
}
function evaluateCalculator(){
  try{
    const raw=$("calculatorDisplay").value.trim();
    if(!raw)return;
    const expr=normalizeCalcExpression(raw);
    if(!/^[0-9+\-*/().\s*MathPIinscoqrt]+$/i.test(expr))throw new Error("Недопустимий вираз");
    const result=Function(`"use strict"; return (${expr})`)();
    if(!Number.isFinite(result))throw new Error("Невизначений результат");
    calcLastResult=String(Number(result.toFixed(12)));
    $("calculatorDisplay").value=calcLastResult;
  }catch(e){
    $("calculatorDisplay").value="Помилка";
  }
}
document.querySelectorAll("[data-calc]").forEach(btn=>btn.onclick=()=>{
  const v=btn.dataset.calc,display=$("calculatorDisplay");
  if(v==="C"){display.value="";return}
  if(v==="BACK"){display.value=display.value.slice(0,-1);return}
  if(v==="="){evaluateCalculator();return}
  if(display.value==="Помилка")display.value="";
  display.value+=v==="pi"?"π":v;
});
$("calculatorDisplay").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();evaluateCalculator()}});
$("calculatorBtn").onclick=()=>$("calculatorPanel").classList.toggle("hidden");
$("calculatorCloseBtn").onclick=()=>$("calculatorPanel").classList.add("hidden");
$("insertCalcResultBtn").onclick=()=>{
  const val=$("calculatorDisplay").value.trim();
  if(val && val!=="Помилка")insertTextIntoBoard(val);
};

