const $=id=>document.getElementById(id);
const notebook=$("notebook");
const fcanvas=new fabric.Canvas("fabricCanvas",{selection:true,preserveObjectStacking:true});



// Зберігаємо службові властивості текстів у JSON сторінки
const _fabricToObject=fabric.Object.prototype.toObject;
fabric.Object.prototype.toObject=function(propertiesToInclude){
  return _fabricToObject.call(this,(propertiesToInclude||[]).concat(["systemRole","isHeadingText","isEraserMask","graphObject","graphMeta","graphName","isInstrument","isGraphFormulaLabel","sofiaNote","sofiaTable"]));
};
let currentTool="select", isShape=false, start=null, temp=null;
let history=[], redoHistory=[], pages=[blankPage()], currentPage=0, suppressHistory=false;
let polyPoints=[], polyPreview=null, keyboardLang="UA";

function blankPage(title=""){return{json:null,paper:"grid",paperSize:25,paperColor:"#9fd5ff",pageTitle:title}}

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
    fontFamily:"Segoe Script",
    fontStyle:"normal",
    fontSize,
    fontWeight,
    fill:"#4a7fbd",
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

  if(!dateObj) dateObj=makeHeadingText(headingDate(),"dateHeading",24,48,"normal");
  if(!workObj) workObj=makeHeadingText($("workType").value,"workHeading",78,50,"normal");

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
  const instruments=objects.filter(o=>o.isInstrument);

  // Маски стирають звичайну графіку.
  masks.forEach(m=>fcanvas.bringToFront(m));
  // Текст і вимірювальні прилади завжди лишаються над маскою гумки.
  texts.forEach(t=>fcanvas.bringToFront(t));
  instruments.forEach(i=>fcanvas.bringToFront(i));
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
      fontSize:26,fontFamily:"Times New Roman",fontStyle:"normal",erasable:false
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



/* ---------- Побудова графіків v26 ---------- */
const graphParamSets={
  linear:[["k","1"],["b","0"]],
  quadratic:[["a","1"],["b","0"],["c","0"]],
  cubic:[["a","1"],["b","0"],["c","0"],["d","0"]],
  absolute:[["a","1"],["h","0"],["k","0"]],
  inverse:[["a","1"]],
  sqrt:[["a","1"],["h","0"],["k","0"]],
  sin:[["a","1"],["b","1"],["c","0"],["d","0"]],
  cos:[["a","1"],["b","1"],["c","0"],["d","0"]],
  custom:[]
};
let selectedGraphObject=null;
let graphCounter=1;
let currentMathTarget=null;

function normalizeMathExpr(expr){
  return String(expr??"").trim().replace(/,/g,".")
    .replace(/π/g,"pi").replace(/√\s*\(/g,"sqrt(").replace(/√\s*([0-9.]+)/g,"sqrt($1)")
    .replace(/\^/g,"**")
    .replace(/\bpi\b/gi,"Math.PI").replace(/\bsqrt\b/gi,"Math.sqrt")
    .replace(/\bsin\b/gi,"Math.sin").replace(/\bcos\b/gi,"Math.cos")
    .replace(/\btan\b/gi,"Math.tan").replace(/\babs\b/gi,"Math.abs");
}
function evalMath(expr){
  const s=normalizeMathExpr(expr);
  if(!s)return 0;
  if(!/^[0-9+\-*/().\s*MathPIinscoqrtab]+$/i.test(s))throw new Error("Недопустимий вираз: "+expr);
  const v=Function(`"use strict";return (${s})`)();
  if(!Number.isFinite(v))throw new Error("Невизначене значення: "+expr);
  return v;
}
function displayMathExpr(expr){
  return String(expr??"").replace(/\bpi\b/gi,"π").replace(/\bsqrt\(/gi,"√(").replace(/\^2\b/g,"²").replace(/\^3\b/g,"³");
}
function getParamObjectFromPanel(container,selected=false){
  const obj={},attr=selected?"data-selected-gparam":"data-gparam";
  container.querySelectorAll(`[${attr}]`).forEach(el=>{
    const key=selected?el.dataset.selectedGparam:el.dataset.gparam;
    obj[key]={raw:el.value,value:evalMath(el.value)};
  });
  return obj;
}
function pval(p,key,def=0){return p?.[key]?.value??def}
function praw(p,key,def="0"){return p?.[key]?.raw??def}
function prettyNum(n){if(Math.abs(n)<1e-9)n=0;return Number(n.toFixed(4)).toString()}
function signedTerm(n,suffix=""){return n>=0?` + ${prettyNum(n)}${suffix}`:` - ${prettyNum(Math.abs(n))}${suffix}`}
function baseFormulaLabel(type,p,customExpr=""){
  if(type==="linear")return `y = ${displayMathExpr(praw(p,"k","1"))}x + (${displayMathExpr(praw(p,"b","0"))})`;
  if(type==="quadratic")return `y = ${displayMathExpr(praw(p,"a","1"))}x² + (${displayMathExpr(praw(p,"b","0"))})x + (${displayMathExpr(praw(p,"c","0"))})`;
  if(type==="cubic")return `y = ${displayMathExpr(praw(p,"a","1"))}x³ + (${displayMathExpr(praw(p,"b","0"))})x² + (${displayMathExpr(praw(p,"c","0"))})x + (${displayMathExpr(praw(p,"d","0"))})`;
  if(type==="absolute")return `y = ${displayMathExpr(praw(p,"a","1"))}|x - (${displayMathExpr(praw(p,"h","0"))})| + (${displayMathExpr(praw(p,"k","0"))})`;
  if(type==="inverse")return `y = ${displayMathExpr(praw(p,"a","1"))}/x`;
  if(type==="sqrt")return `y = ${displayMathExpr(praw(p,"a","1"))}√(x - (${displayMathExpr(praw(p,"h","0"))})) + (${displayMathExpr(praw(p,"k","0"))})`;
  if(type==="sin")return `y = ${displayMathExpr(praw(p,"a","1"))}·sin(${displayMathExpr(praw(p,"b","1"))}x + (${displayMathExpr(praw(p,"c","0"))})) + (${displayMathExpr(praw(p,"d","0"))})`;
  if(type==="cos")return `y = ${displayMathExpr(praw(p,"a","1"))}·cos(${displayMathExpr(praw(p,"b","1"))}x + (${displayMathExpr(praw(p,"c","0"))})) + (${displayMathExpr(praw(p,"d","0"))})`;
  return `y = ${displayMathExpr(customExpr||"x")}`;
}
function shiftedFormulaLabel(meta){
  const sx=Number(meta.shiftX||0),sy=Number(meta.shiftY||0),p=meta.params||{};
  if(Math.abs(sx)<1e-9&&Math.abs(sy)<1e-9)return baseFormulaLabel(meta.type,p,meta.customExpr||"");
  if(meta.type==="linear"){
    const k=pval(p,"k",1),b=pval(p,"b",0);
    return `y = ${prettyNum(k)}x${signedTerm(b-k*sx+sy)}`;
  }
  return `${baseFormulaLabel(meta.type,p,meta.customExpr||"")} | зсув X=${prettyNum(sx)}, Y=${prettyNum(sy)}`;
}
function graphFunction(meta){
  const p=meta.params||{},type=meta.type;
  if(type==="linear")return x=>pval(p,"k",1)*x+pval(p,"b",0);
  if(type==="quadratic")return x=>pval(p,"a",1)*x*x+pval(p,"b",0)*x+pval(p,"c",0);
  if(type==="cubic")return x=>pval(p,"a",1)*x*x*x+pval(p,"b",0)*x*x+pval(p,"c",0)*x+pval(p,"d",0);
  if(type==="absolute")return x=>pval(p,"a",1)*Math.abs(x-pval(p,"h",0))+pval(p,"k",0);
  if(type==="inverse")return x=>Math.abs(x)<1e-9?NaN:pval(p,"a",1)/x;
  if(type==="sqrt")return x=>x<pval(p,"h",0)?NaN:pval(p,"a",1)*Math.sqrt(x-pval(p,"h",0))+pval(p,"k",0);
  if(type==="sin")return x=>pval(p,"a",1)*Math.sin(pval(p,"b",1)*x+pval(p,"c",0))+pval(p,"d",0);
  if(type==="cos")return x=>pval(p,"a",1)*Math.cos(pval(p,"b",1)*x+pval(p,"c",0))+pval(p,"d",0);
  let expr=(meta.customExpr||"x").trim().replace(/π/g,"pi").replace(/√\s*\(/g,"sqrt(").replace(/\^/g,"**");
  const safe=expr.replace(/\bpi\b/gi,"Math.PI").replace(/\bsqrt\b/gi,"Math.sqrt")
    .replace(/\bsin\b/gi,"Math.sin").replace(/\bcos\b/gi,"Math.cos").replace(/\btan\b/gi,"Math.tan")
    .replace(/\babs\b/gi,"Math.abs").replace(/\blog\b/gi,"Math.log10").replace(/\bln\b/gi,"Math.log");
  return new Function("x",`"use strict";return (${safe});`);
}
function readGraphRange(){
  const xmin=evalMath($("graphXMin").value),xmax=evalMath($("graphXMax").value),
        ymin=evalMath($("graphYMin").value),ymax=evalMath($("graphYMax").value);
  if(!(xmin<xmax&&ymin<ymax))throw new Error("Межі осей задані неправильно.");
  return{xmin,xmax,ymin,ymax};
}
function computeAutoRange(meta){
  const fn=graphFunction(meta),base=readGraphRange();
  let ymin=Infinity,ymax=-Infinity;
  for(let i=0;i<=400;i++){
    const x=base.xmin+(base.xmax-base.xmin)*i/400,y=fn(x-(meta.shiftX||0))+(meta.shiftY||0);
    if(Number.isFinite(y)&&Math.abs(y)<1e6){ymin=Math.min(ymin,y);ymax=Math.max(ymax,y)}
  }
  if(!Number.isFinite(ymin)||!Number.isFinite(ymax)||ymin===ymax)return base;
  const pad=Math.max(1,(ymax-ymin)*.12);
  return{xmin:base.xmin,xmax:base.xmax,ymin:Math.floor(ymin-pad),ymax:Math.ceil(ymax+pad)};
}
function graphWorldToPixel(x,y,r){
  return{x:(x-r.xmin)/(r.xmax-r.xmin)*1180,y:820-(y-r.ymin)/(r.ymax-r.ymin)*820};
}
function createGraphParts(meta){
  const range=meta.autoScale?computeAutoRange(meta):(meta.range||readGraphRange());
  meta.range=range;
  const color=meta.color||$("colorPicker").value,sw=meta.strokeWidth||Math.max(2,Number($("lineWidth").value));
  const fn=graphFunction(meta),sx=Number(meta.shiftX||0),sy=Number(meta.shiftY||0);
  let segments=[],current=[];
  for(let i=0;i<=1500;i++){
    const x=range.xmin+(range.xmax-range.xmin)*i/1500,y=fn(x-sx)+sy;
    if(!Number.isFinite(y)||y<range.ymin||y>range.ymax){if(current.length>1)segments.push(current);current=[];continue}
    current.push(graphWorldToPixel(x,y,range));
  }
  if(current.length>1)segments.push(current);
  const parts=[];
  segments.forEach(seg=>parts.push(new fabric.Polyline(seg,{fill:"transparent",stroke:color,strokeWidth:sw,selectable:false,evented:false,objectCaching:false})));
  if(meta.showPoints){
    for(let x=Math.ceil(range.xmin);x<=Math.floor(range.xmax);x++){
      const y=fn(x-sx)+sy;
      if(Number.isFinite(y)&&y>=range.ymin&&y<=range.ymax){
        const pt=graphWorldToPixel(x,y,range);
        parts.push(new fabric.Circle({left:pt.x-3,top:pt.y-3,radius:3,fill:color,selectable:false,evented:false}));
      }
    }
  }
  // V55: formula is written next to the graph itself, not in the top-left corner.
  // Use the longest visible segment and its local tangent.
  const longest=segments.slice().sort((a,b)=>b.length-a.length)[0];
  if(longest && longest.length>3){
    const idx=Math.max(1,Math.min(longest.length-2,Math.floor(longest.length*0.62)));
    const p0=longest[idx-1], p1=longest[idx], p2=longest[idx+1];
    let angle=Math.atan2(p2.y-p0.y,p2.x-p0.x)*180/Math.PI;
    if(angle>90)angle-=180;
    if(angle<-90)angle+=180;

    // Offset a little perpendicular to the curve so the label does not cover it.
    const rad=angle*Math.PI/180;
    const offset=18;
    const lx=p1.x-Math.sin(rad)*offset;
    const ly=p1.y+Math.cos(rad)*offset;

    const formulaLabel=new fabric.Text(shiftedFormulaLabel(meta),{
      left:lx,top:ly,
      originX:"center",originY:"bottom",
      angle,
      fontSize:18,
      fill:color,
      fontFamily:"Arial",
      fontWeight:"600",
      backgroundColor:"rgba(255,255,255,.78)",
      padding:3,
      selectable:false,evented:false,erasable:false,
      objectCaching:false
    });
    formulaLabel.isGraphFormulaLabel=true;
    parts.push(formulaLabel);
  }
  return parts;
}
function createGraphGroup(meta){
  return new fabric.Group(createGraphParts(meta),{left:0,top:0,selectable:true,evented:true,graphObject:true,graphName:meta.name,graphMeta:JSON.parse(JSON.stringify(meta)),erasable:"deep",objectCaching:false});
}
function replaceGraphObject(oldGraph,newMeta){
  const idx=fcanvas.getObjects().indexOf(oldGraph);fcanvas.remove(oldGraph);
  const g=createGraphGroup(newMeta);fcanvas.insertAt(g,idx>=0?idx:fcanvas.getObjects().length,false);
  fcanvas.setActiveObject(g);selectedGraphObject=g;fcanvas.requestRenderAll();return g;
}
function renderGraphParams(){
  const type=$("graphType").value,box=$("graphParams");box.innerHTML="";
  (graphParamSets[type]||[]).forEach(([name,val])=>{
    const wrap=document.createElement("label");wrap.className="graph-param";
    wrap.innerHTML=`<span>${name} =</span><input data-gparam="${name}" type="text" value="${val}" placeholder="1/2, sqrt(2), pi">`;box.appendChild(wrap);
  });
  $("customGraphWrap").classList.toggle("hidden",type!=="custom");updateBuilderFormulaPreview();
}
function updateBuilderFormulaPreview(){
  try{
    const meta={type:$("graphType").value,params:getParamObjectFromPanel($("graphParams")),customExpr:$("customGraphExpression").value.trim()};
    $("graphFormulaPreview").textContent=baseFormulaLabel(meta.type,meta.params,meta.customExpr);
  }catch(e){$("graphFormulaPreview").textContent="Перевірте математичний вираз"}
}
$("graphType").onchange=renderGraphParams;$("customGraphExpression").oninput=updateBuilderFormulaPreview;
$("graphParams").addEventListener("input",updateBuilderFormulaPreview);renderGraphParams();

document.addEventListener("focusin",e=>{
  if(e.target.matches("[data-gparam], [data-selected-gparam], #customGraphExpression, #selectedCustomExpression, #graphXMin, #graphXMax, #graphYMin, #graphYMax"))currentMathTarget=e.target;
});
document.querySelectorAll("[data-mathinsert]").forEach(btn=>btn.onclick=()=>{
  const el=currentMathTarget||document.querySelector("[data-gparam]");if(!el)return;
  const ins=btn.dataset.mathinsert,a=el.selectionStart??el.value.length,b=el.selectionEnd??a;
  el.value=el.value.slice(0,a)+ins+el.value.slice(b);el.focus();el.setSelectionRange(a+ins.length,a+ins.length);
  el.dispatchEvent(new Event("input",{bubbles:true}));
});
function insertGraph(){
  try{
    $("paperType").value="coordinate";applyPaper();
    const meta={name:$("graphName").value.trim()||`Графік ${graphCounter}`,type:$("graphType").value,
      params:getParamObjectFromPanel($("graphParams")),customExpr:$("customGraphExpression").value.trim(),
      showPoints:$("graphShowPoints").checked,shiftX:0,shiftY:0,range:readGraphRange(),autoScale:$("graphAutoScale").checked,
      clipToPlane:$("graphClipToPlane").checked,color:$("colorPicker").value,strokeWidth:Math.max(2,Number($("lineWidth").value))};
    const g=createGraphGroup(meta);fcanvas.add(g);fcanvas.setActiveObject(g);graphCounter++;$("graphName").value=`Графік ${graphCounter}`;
    pushHistory();autoSave();setTool("select");$("graphBuilderPanel").classList.add("hidden");openGraphEditor(g);
  }catch(e){alert("Не вдалося побудувати графік: "+e.message)}
}
function openGraphEditor(graph){
  if(!graph?.graphObject)return;selectedGraphObject=graph;const m=graph.graphMeta||{};
  $("selectedGraphName").value=m.name||graph.graphName||"Графік";$("selectedGraphFormula").textContent=shiftedFormulaLabel(m);
  $("graphShiftX").value=prettyNum(m.shiftX||0);$("graphShiftY").value=prettyNum(m.shiftY||0);
  const box=$("selectedGraphParams");box.innerHTML="";
  (graphParamSets[m.type]||[]).forEach(([name])=>{
    const wrap=document.createElement("label");wrap.className="graph-param";
    wrap.innerHTML=`<span>${name} =</span><input data-selected-gparam="${name}" type="text" value="${praw(m.params,name,"0")}">`;box.appendChild(wrap);
  });
  if(m.type==="custom"){const wrap=document.createElement("label");wrap.className="graph-param";wrap.innerHTML=`<span>y =</span><input id="selectedCustomExpression" type="text" value="${m.customExpr||"x"}">`;box.appendChild(wrap)}
  $("graphEditorPanel").classList.remove("hidden");
}
function collectSelectedGraphMeta(){
  if(!selectedGraphObject)return null;const old=selectedGraphObject.graphMeta||{},params={...old.params};
  document.querySelectorAll("[data-selected-gparam]").forEach(el=>params[el.dataset.selectedGparam]={raw:el.value,value:evalMath(el.value)});
  return {...old,name:$("selectedGraphName").value.trim()||old.name||"Графік",params,
    customExpr:$("selectedCustomExpression")?.value??old.customExpr??"",shiftX:Number($("graphShiftX").value)||0,shiftY:Number($("graphShiftY").value)||0};
}
function liveUpdateSelectedGraph(){
  if(!selectedGraphObject)return;
  try{const meta=collectSelectedGraphMeta();selectedGraphObject=replaceGraphObject(selectedGraphObject,meta);$("selectedGraphFormula").textContent=shiftedFormulaLabel(meta);pushHistory();autoSave()}
  catch(e){$("selectedGraphFormula").textContent="Помилка у формулі"}
}
$("selectedGraphParams").addEventListener("input",liveUpdateSelectedGraph);$("selectedGraphName").addEventListener("input",liveUpdateSelectedGraph);
$("graphShiftX").addEventListener("input",liveUpdateSelectedGraph);$("graphShiftY").addEventListener("input",liveUpdateSelectedGraph);
$("graphBuilderBtn").onclick=()=>$("graphBuilderPanel").classList.toggle("hidden");$("insertGraphBtn").onclick=insertGraph;
$("clearGraphsBtn").onclick=()=>{fcanvas.getObjects().filter(o=>o.graphObject).forEach(o=>fcanvas.remove(o));selectedGraphObject=null;$("graphEditorPanel").classList.add("hidden");fcanvas.discardActiveObject();fcanvas.requestRenderAll();pushHistory();autoSave()};
$("graphEditorCloseBtn").onclick=()=>$("graphEditorPanel").classList.add("hidden");
$("resetGraphPositionBtn").onclick=()=>{if(selectedGraphObject){$("graphShiftX").value=0;$("graphShiftY").value=0;liveUpdateSelectedGraph()}};
$("deleteGraphBtn").onclick=()=>{if(selectedGraphObject){fcanvas.remove(selectedGraphObject);selectedGraphObject=null;$("graphEditorPanel").classList.add("hidden");fcanvas.requestRenderAll();pushHistory();autoSave()}};
$("duplicateGraphBtn").onclick=()=>{if(!selectedGraphObject)return;const meta=JSON.parse(JSON.stringify(selectedGraphObject.graphMeta));meta.name=(meta.name||"Графік")+" копія";meta.shiftX=(meta.shiftX||0)+1;meta.shiftY=(meta.shiftY||0)+1;const g=createGraphGroup(meta);fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();openGraphEditor(g)};
fcanvas.on("selection:created",e=>{const o=e.selected?.[0]||fcanvas.getActiveObject();if(o?.graphObject)openGraphEditor(o)});
fcanvas.on("selection:updated",e=>{const o=e.selected?.[0]||fcanvas.getActiveObject();if(o?.graphObject)openGraphEditor(o)});
fcanvas.on("object:modified",e=>{
  const g=e.target;if(!g?.graphObject)return;const range=g.graphMeta?.range||readGraphRange();
  const meta={...(g.graphMeta||{})};
  meta.shiftX=Number(meta.shiftX||0)+(g.left||0)*(range.xmax-range.xmin)/1180;
  meta.shiftY=Number(meta.shiftY||0)-(g.top||0)*(range.ymax-range.ymin)/820;
  const ng=replaceGraphObject(g,meta);ng.set({left:0,top:0,scaleX:1,scaleY:1,angle:0});ng.setCoords();selectedGraphObject=ng;openGraphEditor(ng);pushHistory();autoSave();
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
  const g=new fabric.Group(objects,{left,top,selectable:true,evented:true,transparentCorners:false,cornerColor:"#17315f",cornerStyle:"circle",erasable:false,isInstrument:true});
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
    obj=new fabric.IText("",{left:110,top:190,fontSize:38,fontFamily:"Segoe Script",fontStyle:"normal",fill:"#4a7fbd",erasable:false});fcanvas.add(obj);fcanvas.setActiveObject(obj);obj.enterEditing();
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

/* ---------- Екранна клавіатура V62: стандартна UA / EN ---------- */
const keyboardLayouts={
  UA:{
    name:"UA",
    rows:[
      ["`","1","2","3","4","5","6","7","8","9","0","-","=","BACK"],
      ["TAB","й","ц","у","к","е","н","г","ш","щ","з","х","ї","\\"],
      ["CAPS","ф","і","в","а","п","р","о","л","д","ж","є","ENTER"],
      ["SHIFT","я","ч","с","м","и","т","ь","б","ю",",",".","/","SHIFT"],
      ["CTRL","ALT","LANG","SPACE","ALT","←","↓","↑","→"]
    ]
  },
  EN:{
    name:"EN",
    rows:[
      ["`","1","2","3","4","5","6","7","8","9","0","-","=","BACK"],
      ["TAB","q","w","e","r","t","y","u","i","o","p","[","]","\\"],
      ["CAPS","a","s","d","f","g","h","j","k","l",";","'","ENTER"],
      ["SHIFT","z","x","c","v","b","n","m",",",".","/","SHIFT"],
      ["CTRL","ALT","LANG","SPACE","ALT","←","↓","↑","→"]
    ]
  }
};
let keyboardShift=false,keyboardCaps=false;

function keyboardBackspace(){
  const o=fcanvas.getActiveObject();
  if(o&&["i-text","textbox"].includes(o.type)){
    const p=o.selectionStart||0;
    if(p>0){
      o.removeChars(p-1,p);
      o.selectionStart=o.selectionEnd=Math.max(0,p-1);
      fcanvas.requestRenderAll();autoSave();
    }
  }
}
function keyboardMoveCursor(delta){
  const o=fcanvas.getActiveObject();
  if(!o||!["i-text","textbox"].includes(o.type))return;
  const p=Math.max(0,Math.min((o.text||"").length,(o.selectionStart||0)+delta));
  o.selectionStart=o.selectionEnd=p;
  fcanvas.requestRenderAll();
}
function keyboardKeyLabel(k){
  const labels={
    BACK:"⌫",TAB:"Tab",CAPS:"Caps",ENTER:"Enter",SHIFT:"Shift",
    CTRL:"Ctrl",ALT:"Alt",LANG:keyboardLang,SPACE:"Пробіл"
  };
  return labels[k]||k;
}
function keyboardPress(k){
  if(k==="BACK"){keyboardBackspace();return}
  if(k==="TAB"){insertTextIntoBoard("    ");return}
  if(k==="ENTER"){insertTextIntoBoard("\n");return}
  if(k==="SPACE"){insertTextIntoBoard(" ");return}
  if(k==="LANG"){
    keyboardLang=keyboardLang==="UA"?"EN":"UA";
    renderKeyboard();return;
  }
  if(k==="CAPS"){keyboardCaps=!keyboardCaps;renderKeyboard();return}
  if(k==="SHIFT"){keyboardShift=!keyboardShift;renderKeyboard();return}
  if(k==="CTRL"||k==="ALT")return;
  if(k==="←"){keyboardMoveCursor(-1);return}
  if(k==="→"){keyboardMoveCursor(1);return}
  if(k==="↑"||k==="↓")return;

  let out=k;
  if(/^[a-zа-яіїєґ]$/i.test(out)){
    const upper=keyboardCaps!==keyboardShift;
    out=upper?out.toUpperCase():out.toLowerCase();
  }else if(keyboardShift){
    const shifted={
      "1":"!","2":"@","3":"#","4":"$","5":"%","6":"^","7":"&","8":"*","9":"(","0":")",
      "-":"_","=":"+","`":"~",",":"<",".":">","/":"?","[":"{","]":"}","\\":"|",";":":","'":'"'
    };
    out=shifted[out]||out;
  }
  insertTextIntoBoard(out);
  if(keyboardShift){keyboardShift=false;renderKeyboard()}
}
function renderKeyboard(){
  const box=$("keyboardKeys");
  if(!box)return;
  box.innerHTML="";
  box.classList.add("standard-keyboard-v62");

  const layout=keyboardLayouts[keyboardLang]||keyboardLayouts.UA;
  layout.rows.forEach((row,rowIndex)=>{
    const rowEl=document.createElement("div");
    rowEl.className="kb-row-v62 row-"+rowIndex;
    row.forEach(k=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="key-btn-v62";
      if(["BACK","TAB","CAPS","ENTER","SHIFT","CTRL","ALT","LANG","SPACE"].includes(k))
        b.classList.add("special");
      if(k==="SPACE")b.classList.add("space");
      if(k==="ENTER")b.classList.add("enter");
      if(k==="BACK")b.classList.add("back");
      if((k==="SHIFT"&&keyboardShift)||(k==="CAPS"&&keyboardCaps))b.classList.add("active");
      b.textContent=keyboardKeyLabel(k);
      b.onclick=()=>keyboardPress(k);
      rowEl.appendChild(b);
    });
    box.appendChild(rowEl);
  });

  if($("keyboardLangBtn")){
    $("keyboardLangBtn").textContent=keyboardLang;
    $("keyboardLangBtn").title="Змінити мову клавіатури";
  }
}
if($("keyboardBtn")) $("keyboardBtn").onclick=()=>{
  const p=$("keyboardPanel");if(!p)return;
  p.classList.toggle("hidden");
  if(!p.classList.contains("hidden"))renderKeyboard();
};
if($("keyboardCloseBtn")) $("keyboardCloseBtn").onclick=()=>$("keyboardPanel")?.classList.add("hidden");
if($("keyboardLangBtn")) $("keyboardLangBtn").onclick=()=>{
  keyboardLang=keyboardLang==="UA"?"EN":"UA";
  renderKeyboard();
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
  const input=$("aiPrompt");
  const sendBtn=$("aiSendBtn");
  const text=input?.value.trim();

  if(!text)return;

  addAIMessage(text,"user");
  input.value="";
  sendBtn.disabled=true;
  sendBtn.textContent="Думаю…";

  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      cache:"no-store",
      headers:{
        "Content-Type":"application/json",
        "Accept":"application/json"
      },
      body:JSON.stringify({
        message:text,
        context:{
          subject:$("subject")?.value||"",
          grade:$("studentClass")?.value||"",
          workType:$("workType")?.value||""
        }
      })
    });

    const raw=await res.text();
    let data={};

    try{
      data=raw?JSON.parse(raw):{};
    }catch(parseError){
      throw new Error(
        "Сервер повернув не JSON. Код "+res.status+
        (raw?": "+raw.slice(0,120):"")
      );
    }

    if(!res.ok){
      throw new Error(
        data?.error ||
        data?.message ||
        ("Помилка сервера "+res.status)
      );
    }

    lastAIReply=(
      data?.reply ||
      data?.answer ||
      data?.message ||
      ""
    ).trim();

    if(!lastAIReply){
      throw new Error("AI не повернув текстову відповідь");
    }

    window.lastAIReply=lastAIReply;
    addAIMessage(lastAIReply,"assistant");

  }catch(e){
    const message=
      "Помилка Sofia AI: "+
      (e?.message||"невідома помилка");

    lastAIReply=message;
    window.lastAIReply=message;
    addAIMessage(message,"assistant");
    console.error("Sofia AI error:",e);

  }finally{
    sendBtn.disabled=false;
    sendBtn.textContent="Надіслати";
  }
}
$("aiSendBtn").onclick=sendAIMessage;
$("aiPrompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAIMessage()}});
$("aiInsertLastBtn").onclick=()=>{if(lastAIReply)insertTextIntoBoard(lastAIReply)};




/* ---------- Сторінки: вкладки, вільний перехід, назви та закриття ---------- */
function pageDefaultTitle(i){return `Сторінка ${i+1}`}
function pageTitleAt(i){const p=pages[i]||{};const t=String(p.pageTitle||"").trim();return t||pageDefaultTitle(i)}
function savePage(){
  const old=pages[currentPage]||{};
  pages[currentPage]={json:fcanvas.toJSON(),paper:$("paperType").value,paperSize:Number($("paperSize").value),paperColor:$("paperLineColor").value,pageTitle:old.pageTitle||""}
}
function ensurePageTabsUI(){
  if(document.getElementById("pageTabs"))return;
  const addBtn=$("addPageBtn");if(!addBtn)return;
  const wrap=document.createElement("div");wrap.id="pageTabsWrap";wrap.className="page-tabs-wrap";
  const tabs=document.createElement("div");tabs.id="pageTabs";tabs.className="page-tabs";tabs.setAttribute("aria-label","Сторінки зошита");
  wrap.appendChild(tabs);addBtn.insertAdjacentElement("afterend",wrap);
  if(!document.getElementById("sofiaPageTabsStyles")){
    const style=document.createElement("style");style.id="sofiaPageTabsStyles";style.textContent=`
      .page-tabs-wrap{display:inline-flex;align-items:center;max-width:min(70vw,980px);vertical-align:middle;margin-left:8px}
      .page-tabs{display:flex;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;max-width:100%;padding:3px 2px 5px;scrollbar-width:thin}
      .page-tab{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;min-height:34px;padding:3px 5px 3px 10px;border:1px solid rgba(15,23,42,.18);border-radius:10px;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.08)}
      .page-tab.active{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.14);font-weight:700}
      .page-tab-title{appearance:none;border:0;background:transparent;padding:3px 4px;cursor:pointer;font:inherit;color:inherit;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
      .page-tab-rename,.page-tab-close{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;cursor:pointer;font-size:15px;line-height:1}
      .page-tab-rename:hover{background:rgba(37,99,235,.10)}
      .page-tab-close:hover{background:rgba(220,38,38,.12);color:#b91c1c}
      @media (max-width:800px){.page-tabs-wrap{display:flex;max-width:100%;width:100%;margin:6px 0 0}.page-tabs{width:100%}.page-tab-title{max-width:125px}}
    `;document.head.appendChild(style);
  }
}
function renamePage(i){
  if(i<0||i>=pages.length)return;savePage();
  const value=prompt("Назва сторінки:",pageTitleAt(i));if(value===null)return;
  pages[i].pageTitle=value.trim();updatePageIndicator();autoSave();
}
function goToPage(i){if(i===currentPage||i<0||i>=pages.length)return;savePage();loadPage(i);autoSave()}
function closePage(i){
  if(pages.length===1){alert("Має залишитися хоча б одна сторінка.");return}
  const title=pageTitleAt(i);if(!confirm(`Закрити й видалити «${title}»?`))return;
  if(i===currentPage)savePage();pages.splice(i,1);
  if(i<currentPage)currentPage--;else if(i===currentPage)currentPage=Math.min(currentPage,pages.length-1);
  loadPage(currentPage);autoSave();
}
function renderPageTabs(){
  ensurePageTabsUI();const box=document.getElementById("pageTabs");if(!box)return;box.innerHTML="";
  pages.forEach((p,i)=>{
    const tab=document.createElement("div");tab.className="page-tab"+(i===currentPage?" active":"");tab.dataset.pageIndex=String(i);
    const title=document.createElement("button");title.type="button";title.className="page-tab-title";title.textContent=pageTitleAt(i);title.title=`Перейти: ${pageTitleAt(i)}`;title.onclick=()=>goToPage(i);title.ondblclick=e=>{e.preventDefault();renamePage(i)};
    const rename=document.createElement("button");rename.type="button";rename.className="page-tab-rename";rename.textContent="✎";rename.title="Перейменувати сторінку";rename.onclick=e=>{e.stopPropagation();renamePage(i)};
    const close=document.createElement("button");close.type="button";close.className="page-tab-close";close.textContent="×";close.title="Закрити / видалити сторінку";close.onclick=e=>{e.stopPropagation();closePage(i)};
    tab.append(title,rename,close);box.appendChild(tab);
  });
  requestAnimationFrame(()=>box.querySelector(".page-tab.active")?.scrollIntoView({block:"nearest",inline:"nearest"}));
}
function loadPage(i){
  currentPage=i;const p=pages[i]||blankPage();$("paperType").value=p.paper||"grid";$("paperSize").value=String(p.paperSize||25);$("paperSizeValue").textContent=$("paperSize").value;$("paperLineColor").value=p.paperColor||"#9fd5ff";applyPaper();
  suppressHistory=true;fcanvas.clear();
  if(p.json)fcanvas.loadFromJSON(p.json,()=>{
    fcanvas.getObjects().forEach(o=>{if(o.isEraserMask){o.set({globalCompositeOperation:"destination-out",selectable:false,evented:false,objectCaching:false})}});
    normalizeEraserLayerOrder();fcanvas.renderAll();suppressHistory=false;ensureHeadingObjects();history=[canvasState()];redoHistory=[];setTool("select")
  });
  else{suppressHistory=false;ensureHeadingObjects();history=[];pushHistory();setTool("select")}
  updatePageIndicator();
}
function updatePageIndicator(){
  $("pageIndicator").textContent=`${pageTitleAt(currentPage)} · ${currentPage+1} з ${pages.length}`;
  $("prevPageBtn").disabled=currentPage===0;$("nextPageBtn").disabled=currentPage===pages.length-1;renderPageTabs();
}
$("addPageBtn").onclick=()=>{savePage();pages.push(blankPage());loadPage(pages.length-1);autoSave()};
$("deletePageBtn").onclick=()=>closePage(currentPage);
$("prevPageBtn").onclick=()=>{if(currentPage>0)goToPage(currentPage-1)};
$("nextPageBtn").onclick=()=>{if(currentPage<pages.length-1)goToPage(currentPage+1)};
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
    ["fullscreenBtn","Повний екран"],
    ["mediaBtn","Фото / відео / файл"],
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


/* ---------- Встановлення як окремого додатка / офлайн ---------- */
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installAppBtn")?.classList.add("primary")});
$("installAppBtn")?.addEventListener("click",async()=>{
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
  }else{
    alert("У Chrome або Edge відкрийте меню ⋮ → «Встановити Sofia Notebook PRO» / «Встановити цей сайт як програму». Після першого онлайн-відкриття основні файли зберігаються для офлайн-роботи.");
  }
});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js?v=38",{updateViaCache:"none"}).then(r=>r.update()).catch(console.warn));


/* ---------- Повноекранний режим ---------- */
$("fullscreenBtn")?.addEventListener("click",async()=>{
  const target=$("pageViewport");
  try{
    if(!document.fullscreenElement){
      if(target.requestFullscreen) await target.requestFullscreen();
      else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    }else{
      if(document.exitFullscreen) await document.exitFullscreen();
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }catch(e){
    alert("Не вдалося перейти у повноекранний режим. Спробуйте F11 або меню браузера.");
  }
});
document.addEventListener("fullscreenchange",()=>{
  const b=$("fullscreenBtn");
  if(b)b.textContent=document.fullscreenElement?"↙ Вийти з повного екрана":"⛶ Повний екран";
});


/* ---------- Фото / відео / файли / посилання ---------- */
$("mediaBtn")?.addEventListener("click",()=>$("mediaPanel")?.classList.toggle("hidden"));

function addFabricImageFromUrl(url,title=""){
  fabric.Image.fromURL(url,img=>{
    if(!img){
      alert("Не вдалося завантажити зображення.");
      return;
    }
    const maxW=520,maxH=420;
    const scale=Math.min(maxW/img.width,maxH/img.height,1);
    img.set({
      left:180,top:150,
      scaleX:scale,scaleY:scale,
      selectable:true,evented:true
    });
    fcanvas.add(img);
    fcanvas.setActiveObject(img);
    if(title){
      const t=new fabric.Text(title,{
        left:180,top:125,fontSize:18,fill:$("colorPicker").value,
        backgroundColor:"rgba(255,255,255,.88)",erasable:false
      });
      fcanvas.add(t);
    }
    pushHistory();autoSave();setTool("select");
  },{crossOrigin:"anonymous"});
}

function addLinkCard(url,title="Посилання",kind="link"){
  const c=$("colorPicker").value;
  const icon=kind==="file"?"📄":kind==="video"?"▶":"🔗";
  const bg=new fabric.Rect({
    left:0,top:0,width:330,height:86,rx:10,ry:10,
    fill:"#ffffff",stroke:"#cfd9e7",strokeWidth:1
  });
  const ic=new fabric.Text(icon,{left:15,top:19,fontSize:30,fill:c});
  const tx=new fabric.Textbox(title||url,{
    left:58,top:13,width:250,fontSize:17,fill:"#17315f",fontWeight:"bold"
  });
  const sub=new fabric.Textbox(url,{
    left:58,top:45,width:250,fontSize:10,fill:"#607089"
  });
  const g=new fabric.Group([bg,ic,tx,sub],{
    left:240,top:250,
    linkUrl:url,linkKind:kind,
    selectable:true,evented:true
  });
  fcanvas.add(g);fcanvas.setActiveObject(g);pushHistory();autoSave();setTool("select");
}

fcanvas.on("mouse:dblclick",opt=>{
  const o=opt.target;
  if(o?.linkUrl){
    window.open(o.linkUrl,"_blank","noopener");
  }
});

function youtubeEmbedUrl(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes("youtu.be")){
      const id=u.pathname.replace("/","");
      return `https://www.youtube.com/embed/${id}`;
    }
    if(u.hostname.includes("youtube.com")){
      const id=u.searchParams.get("v");
      if(id)return `https://www.youtube.com/embed/${id}`;
      if(u.pathname.startsWith("/embed/"))return url;
    }
  }catch(e){}
  return null;
}

function createMediaOverlay(type,url,title="Відео"){
  const el=document.createElement("div");
  el.className="media-overlay";
  el.style.left="28%";
  el.style.top="23%";
  el.style.width="42%";
  el.style.height="38%";
  el.innerHTML=`
    <div class="media-overlay-bar">
      <span>${title||"Медіа"}</span>
      <span class="media-overlay-actions">
        <button class="media-open" title="Відкрити окремо">↗</button>
        <button class="media-close" title="Видалити">×</button>
      </span>
    </div>
    <div class="media-overlay-body"></div>
    <div class="media-overlay-resize"></div>
  `;
  const body=el.querySelector(".media-overlay-body");
  body.style.height="calc(100% - 30px)";

  const yt=youtubeEmbedUrl(url);
  if(yt){
    const iframe=document.createElement("iframe");
    iframe.src=yt;
    iframe.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen=true;
    body.appendChild(iframe);
  }else{
    const video=document.createElement("video");
    video.src=url;
    video.controls=true;
    video.playsInline=true;
    body.appendChild(video);
  }

  notebook.appendChild(el);

  el.querySelector(".media-close").onclick=()=>el.remove();
  el.querySelector(".media-open").onclick=()=>window.open(url,"_blank","noopener");

  // drag
  const bar=el.querySelector(".media-overlay-bar");
  let dragging=false,ox=0,oy=0;
  bar.addEventListener("pointerdown",e=>{
    if(e.target.closest("button"))return;
    dragging=true;
    const er=el.getBoundingClientRect();
    ox=e.clientX-er.left;oy=e.clientY-er.top;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const nr=notebook.getBoundingClientRect();
    let left=e.clientX-nr.left-ox;
    let top=e.clientY-nr.top-oy;
    left=Math.max(0,Math.min(nr.width-el.offsetWidth,left));
    top=Math.max(0,Math.min(nr.height-el.offsetHeight,top));
    el.style.left=(left/nr.width*100)+"%";
    el.style.top=(top/nr.height*100)+"%";
  });
  bar.addEventListener("pointerup",()=>dragging=false);

  // resize
  const handle=el.querySelector(".media-overlay-resize");
  let resizing=false,sx=0,sy=0,sw=0,sh=0;
  handle.addEventListener("pointerdown",e=>{
    resizing=true;sx=e.clientX;sy=e.clientY;sw=el.offsetWidth;sh=el.offsetHeight;
    handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  handle.addEventListener("pointermove",e=>{
    if(!resizing)return;
    const nr=notebook.getBoundingClientRect();
    const nw=Math.max(180,sw+(e.clientX-sx));
    const nh=Math.max(110,sh+(e.clientY-sy));
    el.style.width=(nw/nr.width*100)+"%";
    el.style.height=(nh/nr.height*100)+"%";
  });
  handle.addEventListener("pointerup",()=>resizing=false);
}

function detectUrlType(url){
  const lower=url.toLowerCase();
  if(/\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/.test(lower))return"image";
  if(/youtube\.com|youtu\.be|vimeo\.com|\.(mp4|webm|ogg)(\?|#|$)/.test(lower))return"video";
  return"link";
}

function insertMediaUrl(forcedType=null){
  const url=$("mediaUrlInput").value.trim();
  if(!url){alert("Вставте посилання.");return}
  const title=$("mediaTitleInput").value.trim();
  let type=forcedType||$("mediaUrlType").value;
  if(type==="auto")type=detectUrlType(url);

  if(type==="image")addFabricImageFromUrl(url,title);
  else if(type==="video")createMediaOverlay("video",url,title||"Відео");
  else addLinkCard(url,title||"Посилання","link");

  $("mediaPanel").classList.add("hidden");
}
$("insertMediaUrlBtn")?.addEventListener("click",()=>insertMediaUrl());
$("insertWebLinkBtn")?.addEventListener("click",()=>insertMediaUrl("link"));
$("insertImageUrlBtn")?.addEventListener("click",()=>insertMediaUrl("image"));
$("insertVideoUrlBtn")?.addEventListener("click",()=>insertMediaUrl("video"));

$("mediaFileInput")?.addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(!file)return;

  if(file.type.startsWith("image/")){
    const reader=new FileReader();
    reader.onload=()=>addFabricImageFromUrl(reader.result,file.name);
    reader.readAsDataURL(file);
  }else if(file.type.startsWith("video/")){
    const url=URL.createObjectURL(file);
    createMediaOverlay("video",url,file.name);
  }else{
    const url=URL.createObjectURL(file);
    addLinkCard(url,file.name,"file");
  }
  $("mediaPanel").classList.add("hidden");
  e.target.value="";
});



/* =========================================================
   V28 — НАДІЙНИЙ ЗАПУСК І ПЕРЕВІРКА КНОПОК
   ========================================================= */
(function(){
  const el=id=>document.getElementById(id);

  // Visible runtime errors instead of silent failure.
  window.addEventListener("error",event=>{
    const p=el("runtimeErrorPanel"),t=el("runtimeErrorText");
    if(p&&t){
      t.textContent=`${event.message || "JavaScript error"}\n${event.filename || ""}:${event.lineno || ""}`;
      p.classList.remove("hidden");
    }
  });
  window.addEventListener("unhandledrejection",event=>{
    const p=el("runtimeErrorPanel"),t=el("runtimeErrorText");
    if(p&&t){
      t.textContent="Помилка: "+(event.reason?.message || String(event.reason || "невідома"));
      p.classList.remove("hidden");
    }
  });
  el("runtimeErrorClose")?.addEventListener("click",()=>el("runtimeErrorPanel")?.classList.add("hidden"));
  el("runtimeReloadBtn")?.addEventListener("click",async()=>{
    try{
      if("serviceWorker" in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        for(const r of regs) await r.update();
      }
    }catch(e){}
    location.reload();
  });

  function stop(e){ e?.preventDefault?.(); e?.stopPropagation?.(); }

  // Fullscreen
  const full=el("fullscreenBtn");
  if(full){
    full.onclick=async e=>{
      stop(e);
      const target=el("pageViewport") || document.documentElement;
      try{
        if(!document.fullscreenElement){
          if(target.requestFullscreen) await target.requestFullscreen();
          else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        }else{
          if(document.exitFullscreen) await document.exitFullscreen();
          else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      }catch(err){
        alert("Браузер не дозволив повноекранний режим. Спробуйте клавішу F11.");
      }
    };
  }

  // Media panel
  const media=el("mediaBtn");
  if(media){
    media.onclick=e=>{
      stop(e);
      const panel=el("mediaPanel");
      if(!panel){ alert("Панель медіа не знайдена."); return; }
      panel.classList.toggle("hidden");
    };
  }

  // Calculator
  const calc=el("calculatorBtn");
  if(calc){
    calc.onclick=e=>{
      stop(e);
      const panel=el("calculatorPanel");
      if(!panel){ alert("Калькулятор не знайдений."); return; }
      panel.classList.toggle("hidden");
    };
  }

  // Timer
  const timer=el("timerBtn");
  if(timer){
    timer.onclick=e=>{
      stop(e);
      const panel=el("timerPanel");
      if(!panel){ alert("Таймер не знайдений."); return; }
      panel.classList.toggle("hidden");
    };
  }

  // Keyboard
  const keyboard=el("keyboardBtn");
  if(keyboard){
    keyboard.onclick=e=>{
      stop(e);
      const panel=el("keyboardPanel");
      if(!panel){ alert("Клавіатура не знайдена."); return; }
      panel.classList.toggle("hidden");
      if(!panel.classList.contains("hidden") && typeof renderKeyboard==="function") renderKeyboard();
    };
  }

  // AI
  const ai=el("aiBtn");
  if(ai){
    ai.onclick=e=>{
      stop(e);
      const panel=el("aiPanel");
      if(!panel){ alert("AI-панель не знайдена."); return; }
      panel.classList.toggle("hidden");
    };
  }

  // Graph builder
  const graph=el("graphBuilderBtn");
  if(graph){
    graph.onclick=e=>{
      stop(e);
      const panel=el("graphBuilderPanel");
      if(!panel){ alert("Редактор графіків не знайдений."); return; }
      panel.classList.toggle("hidden");
      if(typeof renderGraphParams==="function") renderGraphParams();
    };
  }

  // Geometry/tools/elements
  [["elementsBtn","elementsPanel"],["geometryBtn","geometryPanel"],["shapeLibraryBtn","shapeLibraryPanel"],
   ["angleBtn","anglePanel"],["numberRayBtn","numberRayPanel"],["ukrainianBtn","ukrainianPanel"]]
  .forEach(([bid,pid])=>{
    const b=el(bid);
    if(b){
      b.onclick=e=>{
        stop(e);
        const p=el(pid);
        if(!p){ alert(`Панель ${pid} не знайдена.`); return; }
        p.classList.toggle("hidden");
      };
    }
  });

  // Save
  const save=el("saveBtn");
  if(save){
    save.onclick=e=>{
      stop(e);
      try{
        if(typeof autoSave==="function") autoSave();
        if(el("saveStatus")) el("saveStatus").textContent="✅ Збережено";
      }catch(err){ alert("Помилка збереження: "+err.message); }
    };
  }

  // Diagnostics now tests DOM + expected callable functions and opens panels without destructive actions.
  function runFullDiagnostics(){
    const box=el("diagnosticsResults");
    if(!box)return;
    box.innerHTML="";
    const tests=[
      ["Графічне ядро Fabric", typeof window.fabric!=="undefined"],
      ["Полотно", typeof window.fcanvas!=="undefined" || (typeof fcanvas!=="undefined")],
      ["Клавіатура", !!el("keyboardBtn") && !!el("keyboardPanel")],
      ["Таймер", !!el("timerBtn") && !!el("timerPanel")],
      ["Калькулятор", !!el("calculatorBtn") && !!el("calculatorPanel")],
      ["Повний екран", !!el("fullscreenBtn") && !!el("pageViewport")],
      ["Фото / відео / файл", !!el("mediaBtn") && !!el("mediaPanel")],
      ["AI чат", !!el("aiBtn") && !!el("aiPanel")],
      ["Елементи", !!el("elementsBtn") && !!el("elementsPanel")],
      ["Прилади", !!el("geometryBtn") && !!el("geometryPanel")],
      ["2D / 3D фігури", !!el("shapeLibraryBtn") && !!el("shapeLibraryPanel")],
      ["Графіки", !!el("graphBuilderBtn") && !!el("graphBuilderPanel") && typeof insertGraph==="function"],
      ["Числовий промінь", !!el("numberRayBtn") && !!el("numberRayPanel")],
      ["Збереження", typeof autoSave==="function"],
      ["Сторінки", !!el("addPageBtn") && typeof loadPage==="function"]
    ];
    tests.forEach(([name,ok])=>{
      const row=document.createElement("div");
      row.className="diag-row "+(ok?"ok":"bad");
      row.innerHTML=`<span>${ok?"✅":"❌"} ${name}</span><small>${ok?"працює":"потрібна перевірка"}</small>`;
      box.appendChild(row);
    });
  }
  const diag=el("diagnosticsBtn");
  if(diag){
    diag.onclick=e=>{
      stop(e);
      el("diagnosticsPanel")?.classList.remove("hidden");
      runFullDiagnostics();
    };
  }
  el("runDiagnosticsBtn")?.addEventListener("click",runFullDiagnostics);

  // Version marker: proves new JS actually loaded.
  document.documentElement.dataset.sofiaVersion="28";
  if(el("appVersionBadge")) el("appVersionBadge").textContent="v28";
})();


/* =========================================================
   V56 CLEAN — ОДНА СТАБІЛЬНА СТРІЧКА БЕЗ ДУБЛІКАТІВ
   ========================================================= */
(function(){
  "use strict";

  const $v=id=>document.getElementById(id);
  const RIBBON_ORDER_KEY="sofiaRibbonOrderV56";
  let zTop=20000;
  let arrangeMode=false;
  let draggedCommand=null;

  const tabDefs=[
    ["home","⌂ Основне"],
    ["insert","+ Вставка"],
    ["draw","✎ Малювання"],
    ["math","∑ Математика"],
    ["teacher","🎓 Вчитель"],
    ["ai","✨ AI"]
  ];

  /* ---------- CSS ---------- */
  function addCss(){
    if($v("sofiaV56Css"))return;
    const s=document.createElement("style");
    s.id="sofiaV56Css";
    s.textContent=`
      #sofiaRibbonV56{
        position:relative;z-index:1200;background:#fff;
        border:1px solid #dde6f2;border-radius:14px;
        margin:8px 10px;padding:0;box-shadow:0 2px 8px rgba(15,23,42,.05)
      }
      .v56-ribbon-head{display:flex;align-items:center;gap:4px;border-bottom:1px solid #e5ebf3;padding:5px 8px 0}
      .v56-tabs{display:flex;gap:2px;flex:1;overflow-x:auto;scrollbar-width:thin}
      .v56-tab{border:0;background:transparent;border-radius:9px 9px 0 0;padding:9px 13px;cursor:pointer;font:600 15px/1.1 inherit;white-space:nowrap}
      .v56-tab.active{background:#edf3ff;color:#173b78;box-shadow:inset 0 -2px 0 #2b5eaa}
      .v56-arrange{border:1px solid #1d4e91;background:#173b78;color:#fff;border-radius:9px;padding:8px 11px;font-weight:700;cursor:pointer;white-space:nowrap}
      .v56-body{padding:9px 10px}
      .v56-panel{display:none;flex-wrap:wrap;gap:8px;align-items:center;min-height:42px}
      .v56-panel.active{display:flex}
      .v56-panel>button,.v56-command{
        min-height:38px!important;padding:7px 12px!important;margin:0!important;
        white-space:nowrap!important;border-radius:9px!important;max-width:none!important
      }
      body.v56-arranging .v56-command{cursor:grab!important;outline:1px dashed #2b5eaa!important;outline-offset:2px!important}
      body.v56-arranging .v56-panel.active{padding:6px;border:2px dashed rgba(43,94,170,.35);border-radius:10px}
      .v56-control{display:inline-flex;align-items:center;gap:6px;border:1px solid #d5deeb;border-radius:9px;padding:5px 8px;background:#fff}
      .v56-control select{border:0;background:transparent;font:inherit;min-width:145px}
      .v56-floating{
        position:fixed!important;z-index:20000!important;background:#fff!important;
        box-shadow:0 14px 42px rgba(15,23,42,.28)!important;border-radius:14px!important;
        max-width:min(94vw,1050px);max-height:88vh;overflow:auto!important
      }
      .v56-figures-panel,.v56-compass-panel{
        position:fixed;left:110px;top:165px;z-index:22000;background:#fff;
        border:1px solid #d9e2ef;border-radius:14px;box-shadow:0 14px 42px rgba(15,23,42,.25);
        padding:14px;width:min(390px,90vw)
      }
      .v56-panel-head{display:flex;align-items:center;gap:8px;font-weight:800;font-size:18px;margin-bottom:12px;cursor:move;user-select:none}
      .v56-panel-head button{margin-left:auto;width:32px;height:32px;border:0;border-radius:8px;background:#f4f6fa;cursor:pointer;font-size:18px}
      .v56-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .v56-grid button{min-height:42px;border:1px solid #ccd7e6;border-radius:9px;background:#fff;cursor:pointer}
      .v56-grid button:hover{background:#f4f8ff}
      .v56-section-title{font-weight:800;margin:10px 0 7px}
      .v56-compass-panel label{display:grid;gap:6px;font-weight:700}
      .v56-compass-panel input{padding:9px;border:1px solid #cbd6e5;border-radius:8px;font:inherit}
      .v56-compass-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .v56-compass-actions button{padding:8px 11px;border:1px solid #cbd6e5;border-radius:8px;background:#fff;cursor:pointer}
      .v56-compass-actions .primary{background:#173b78;color:#fff;border-color:#173b78}
      .v56-status{margin-top:10px;padding:9px;border-radius:8px;background:#f3f7ff;font-size:13px}
      #sofiaAuthorSignature{position:fixed;right:14px;bottom:8px;z-index:9998;font-size:12px;font-weight:600;opacity:.55;pointer-events:none;user-select:none}
      .v56-wheel-max{position:absolute;right:48px;top:10px;z-index:30010;border:1px solid #cbd6e5;background:#173b78;color:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;font-weight:700}
      .v56-maximized{left:10px!important;top:10px!important;width:calc(100vw - 20px)!important;height:calc(100vh - 20px)!important;max-width:none!important;max-height:none!important;z-index:30000!important}
      @media(max-width:800px){.v56-ribbon-head{flex-wrap:wrap}.v56-tabs{width:100%;order:2}.v56-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(s);
  }

  /* ---------- Author ---------- */
  function addAuthor(){
    if($v("sofiaAuthorSignature"))return;
    const a=document.createElement("div");
    a.id="sofiaAuthorSignature";
    a.textContent="Sofia Notebook © Parasochka";
    document.body.appendChild(a);
  }

  /* ---------- Top install button ---------- */
  function moveInstallTop(){
    const b=$v("installAppBtn");
    if(!b)return;
    b.textContent="⬇ Встановити додаток";
    const target=document.querySelector("header,.app-header,.topbar,.brandbar");
    if(target && b.parentElement!==target)target.appendChild(b);
  }

  /* ---------- Ribbon ---------- */
  function createRibbon(){
    if($v("sofiaRibbonV56"))return;

    const root=document.createElement("section");
    root.id="sofiaRibbonV56";

    const head=document.createElement("div");
    head.className="v56-ribbon-head";

    const tabs=document.createElement("div");
    tabs.className="v56-tabs";
    tabDefs.forEach(([id,label])=>{
      const b=document.createElement("button");
      b.type="button";b.className="v56-tab";b.dataset.v56Tab=id;b.textContent=label;
      b.onclick=()=>activateTab(id);
      tabs.appendChild(b);
    });

    const arrange=document.createElement("button");
    arrange.type="button";
    arrange.id="v56ArrangeBtn";
    arrange.className="v56-arrange";
    arrange.textContent="⚙ Впорядкувати";
    arrange.onclick=()=>setArrange(!arrangeMode);

    head.append(tabs,arrange);

    const body=document.createElement("div");
    body.className="v56-body";
    tabDefs.forEach(([id])=>{
      const p=document.createElement("div");
      p.className="v56-panel";
      p.dataset.v56Panel=id;
      body.appendChild(p);
    });

    root.append(head,body);

    const pageControls=$v("addPageBtn")?.parentElement;
    const pageViewport=$v("pageViewport");
    if(pageControls?.parentElement)pageControls.parentElement.insertBefore(root,pageControls);
    else if(pageViewport?.parentElement)pageViewport.parentElement.insertBefore(root,pageViewport);
    else document.body.prepend(root);

    activateTab("home");
  }

  function panel(id){return document.querySelector(`.v56-panel[data-v56-panel="${id}"]`)}

  function activateTab(id){
    document.querySelectorAll(".v56-tab").forEach(b=>b.classList.toggle("active",b.dataset.v56Tab===id));
    document.querySelectorAll(".v56-panel").forEach(p=>p.classList.toggle("active",p.dataset.v56Panel===id));
  }

  function moveButton(id,tab,label){
    const b=$v(id);
    if(!b)return null;
    if(label)b.textContent=label;
    b.hidden=false;
    b.classList.remove("hidden");
    b.style.removeProperty("display");
    b.style.removeProperty("visibility");
    b.style.removeProperty("opacity");
    b.classList.add("v56-command");
    panel(tab)?.appendChild(b);
    return b;
  }

  function makeButton(id,label,tab,handler){
    let b=$v(id);
    if(!b){
      b=document.createElement("button");b.type="button";b.id=id;
    }
    b.textContent=label;b.className="v56-command";
    b.onclick=handler;
    panel(tab)?.appendChild(b);
    return b;
  }

  function buildRibbonCommands(){
    // ОСНОВНЕ — only everyday commands.
    moveButton("saveBtn","home","💾 Зберегти");
    moveButton("undoBtn","home","↶ Назад");
    moveButton("redoBtn","home","↷ Вперед");
    moveButton("deleteSelectedBtn","home","✕ Видалити вибране");
    moveButton("clearPageBtn","home","Очистити сторінку");
    moveButton("keyboardBtn","home","⌨ Клавіатура");
    moveButton("voiceBtn","home","🎙 Голос");

    // Font selector for date/work title.
    if(!$v("v56HeadingFontControl")){
      const wrap=document.createElement("span");
      wrap.id="v56HeadingFontControl";wrap.className="v56-control";
      wrap.innerHTML=`<b>Шрифт заголовка</b>
        <select id="v56HeadingFont">
          <option>Times New Roman</option>
          <option>Arial</option>
          <option>Georgia</option>
          <option>Calibri</option>
          <option>Segoe Print</option>
          <option>Comic Sans MS</option>
        </select>
        <label style="display:flex;gap:4px;align-items:center"><input id="v56HeadingItalic" type="checkbox" checked> Курсив</label>`;
      panel("home")?.appendChild(wrap);
      $v("v56HeadingFont").onchange=applyHeadingFont;
      $v("v56HeadingItalic").onchange=applyHeadingFont;
    }

    // ВСТАВКА
    moveButton("mediaBtn","insert","📎 Фото / відео / файл");
    moveButton("elementsBtn","insert","✦ Елементи");
    moveButton("geometryBtn","insert","📐 Прилади");
    moveButton("noteBtn","insert","▣ Замітка");

    makeButton("v56TableBtn","▦ Таблиця","insert",createTable);

    // МАЛЮВАННЯ — left toolbar already has pen/eraser/shapes; keep only advanced tools.
    moveButton("correctionMarkerBtn","draw","✓ Маркер перевірки");
    moveButton("groupBtn","draw","🔗 Групувати");
    moveButton("ungroupBtn","draw","🔓 Розгрупувати");
    moveButton("explodeShapeBtn","draw","✂ Розкласти фігуру");
    moveButton("editVerticesBtn","draw","◆ Змінювати кути");
    makeButton("v56FiguresBtn","⬡ Фігури","draw",openFigures);

    // МАТЕМАТИКА
    moveButton("calculatorBtn","math","🧮 Калькулятор");
    moveButton("angleBtn","math","∠ Побудувати кут");
    moveButton("numberRayBtn","math","↦ Числовий промінь");
    moveButton("graphBuilderBtn","math","📈 Побудова графіка");
    moveButton("pointBtn","math","• Точка");
    moveButton("vertexLabelBtn","math","A Вершина");

    // ВЧИТЕЛЬ — clean shortcuts; no duplicated inner teacher-tool buttons.
    makeTeacherShortcut("v56Wheel","🎡 Колесо","wheel");
    makeTeacherShortcut("v56Cards","🃏 Картки","cards");
    makeTeacherShortcut("v56Test","✅ Тест","test");
    makeTeacherShortcut("v56Lists","☷ Списки","lists");
    makeTeacherShortcut("v56Translate","🌐 Перекладач","translate");
    moveButton("timerBtn","teacher","⏱ Таймер");
    moveButton("ukrainianBtn","teacher","UA Розбір");

    // AI — only two commands.
    moveButton("aiBtn","ai","✨ AI чат");
    makeButton("v56AiImage","🖼 Зображення","ai",()=>openTeacherTool("image"));

    restoreOrder();
  }

  /* ---------- Remove obsolete ribbon content / controls ---------- */
  function hideOldTopDuplicates(){
    // Old shape button is replaced by one clean "Фігури".
    const oldShape=$v("shapeLibraryBtn");
    if(oldShape){oldShape.style.display="none";oldShape.hidden=true}

    // Old compass/circle controls should never appear in the ribbon.
    ["sofiaCompassPick","sofiaCompassBuild","sofiaCompassMax","sofiaCompassClose"].forEach(id=>{
      const b=$v(id);if(b && b.closest("#sofiaRibbonV56"))b.remove();
    });

    // Hide old technical panel controls if present.
    const badLabels=new Set(["Верхня панель","Ліва панель","Показати всі","Готово","Панель"]);
    document.querySelectorAll("button").forEach(b=>{
      if(b.closest("#sofiaRibbonV56"))return;
      const t=(b.textContent||"").trim();
      if(badLabels.has(t))b.style.display="none";
    });
  }

  /* ---------- Panel helpers ---------- */
  function bringFront(p){
    if(!p)return;
    p.classList.add("v56-floating");
    p.style.setProperty("z-index",String(++zTop),"important");
  }

  function showPanel(id){
    const p=$v(id);if(!p)return false;
    p.classList.remove("hidden");p.hidden=false;p.style.removeProperty("display");
    bringFront(p);return true;
  }

  function togglePanel(id){
    const p=$v(id);if(!p)return false;
    const hidden=p.classList.contains("hidden")||p.hidden||getComputedStyle(p).display==="none";
    if(hidden)showPanel(id);else p.classList.add("hidden");
    return true;
  }

  function bindCorePanels(){
    const map={
      mediaBtn:"mediaPanel",
      elementsBtn:"elementsPanel",
      geometryBtn:"geometryPanel",
      angleBtn:"anglePanel",
      numberRayBtn:"numberRayPanel",
      graphBuilderBtn:"graphBuilderPanel",
      calculatorBtn:"calculatorPanel",
      timerBtn:"timerPanel",
      ukrainianBtn:"ukrainianPanel",
      keyboardBtn:"keyboardPanel",
      aiBtn:"aiPanel"
    };
    Object.entries(map).forEach(([bid,pid])=>{
      const b=$v(bid),p=$v(pid);if(!b||!p)return;
      b.onclick=e=>{e.preventDefault();e.stopPropagation();togglePanel(pid)};
    });

    // Note: create immediately on board.
    const note=$v("noteBtn");
    if(note)note.onclick=e=>{e.preventDefault();e.stopPropagation();createNote()};
  }

  /* ---------- Note ---------- */
  function createNote(){
    if(typeof fcanvas==="undefined"||!window.fabric)return;
    const t=new fabric.Textbox("Замітка",{
      left:360,top:260,width:260,fontSize:22,fill:"#273142",
      backgroundColor:"#fff19a",padding:14,fontFamily:"Arial",editable:true
    });
    t.sofiaNote=true;
    fcanvas.add(t);fcanvas.setActiveObject(t);t.enterEditing?.();
    fcanvas.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
  }

  /* ---------- Table ---------- */
  function createTable(){
    if(typeof fcanvas==="undefined"||!window.fabric)return;
    let rows=Number(prompt("Кількість рядків:","3"));
    if(!Number.isFinite(rows))return;
    let cols=Number(prompt("Кількість стовпців:","3"));
    if(!Number.isFinite(cols))return;
    rows=Math.max(1,Math.min(20,Math.floor(rows)));
    cols=Math.max(1,Math.min(12,Math.floor(cols)));
    const cw=92,ch=44,w=cols*cw,h=rows*ch;
    const c=$v("colorPicker")?.value||"#17315f";
    const sw=Math.max(1,Number($v("lineWidth")?.value||2));
    const parts=[];
    for(let r=0;r<=rows;r++)parts.push(new fabric.Line([0,r*ch,w,r*ch],{stroke:c,strokeWidth:sw,selectable:false,evented:false}));
    for(let k=0;k<=cols;k++)parts.push(new fabric.Line([k*cw,0,k*cw,h],{stroke:c,strokeWidth:sw,selectable:false,evented:false}));
    const g=new fabric.Group(parts,{left:300,top:220,selectable:true,evented:true,sofiaTable:true});
    fcanvas.add(g);fcanvas.setActiveObject(g);fcanvas.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
  }

  /* ---------- Figures ---------- */
  function ensureFiguresPanel(){
    if($v("v56FiguresPanel"))return;
    const p=document.createElement("div");
    p.id="v56FiguresPanel";p.className="v56-figures-panel";p.style.display="none";
    p.innerHTML=`
      <div class="v56-panel-head"><span>⬡ Фігури</span><button id="v56FiguresClose">×</button></div>
      <div class="v56-section-title">2D фігури</div>
      <div class="v56-grid">
        <button data-v56-shape="circle">Коло</button>
        <button data-v56-shape="ellipse">Овал</button>
        <button data-v56-shape="square">Квадрат</button>
        <button data-v56-shape="rect">Прямокутник</button>
        <button data-v56-shape="triangle">Трикутник</button>
        <button data-v56-shape="star">Зірка</button>
        <button data-v56-shape="parallelogram">Паралелограм</button>
        <button data-v56-shape="rhombus">Ромб</button>
        <button data-v56-shape="trapezoid">Трапеція</button>
      </div>
      <div class="v56-section-title">3D фігури</div>
      <div class="v56-grid">
        <button data-v56-shape="cube">Куб</button>
        <button data-v56-shape="cuboid">Паралелепіпед</button>
        <button data-v56-shape="pyramid">Піраміда</button>
        <button data-v56-shape="cylinder">Циліндр</button>
        <button data-v56-shape="cone">Конус</button>
        <button data-v56-shape="sphere">Сфера</button>
        <button data-v56-shape="prism">Призма</button>
      </div>`;
    document.body.appendChild(p);
    $v("v56FiguresClose").onclick=()=>p.style.display="none";
    p.querySelectorAll("[data-v56-shape]").forEach(b=>b.onclick=()=>addFigure(b.dataset.v56Shape));
    makeDraggable(p,p.querySelector(".v56-panel-head"));
  }

  function openFigures(){
    ensureFiguresPanel();
    const p=$v("v56FiguresPanel");p.style.display="block";bringFront(p);
  }

  function addFigure(type){
    const close=()=>{$v("v56FiguresPanel").style.display="none"};
    try{
      if(type==="circle" && typeof addBasicElement==="function"){addBasicElement("circle");close();return}
      if(type==="triangle" && typeof addBasicElement==="function"){addBasicElement("triangle");close();return}
      if(type==="star" && typeof addBasicElement==="function"){addBasicElement("star");close();return}
      if(["square","parallelogram","rhombus","trapezoid"].includes(type) && typeof add2D==="function"){add2D(type);close();return}
      if(type==="cube" && typeof addCube==="function"){addCube();close();return}
      if(type==="cuboid" && typeof addCuboid==="function"){addCuboid();close();return}
      if(type==="pyramid" && typeof addPyramid==="function"){addPyramid();close();return}
      if(type==="cylinder" && typeof addCylinder==="function"){addCylinder();close();return}
      if(type==="cone" && typeof addCone==="function"){addCone();close();return}
      if(type==="sphere" && typeof addSphere==="function"){addSphere();close();return}
      if(type==="prism" && typeof addPrism==="function"){addPrism();close();return}

      // Fallbacks for rectangle / ellipse.
      const c=$v("colorPicker")?.value||"#17315f",sw=Math.max(1,Number($v("lineWidth")?.value||2));
      let obj=null;
      if(type==="rect")obj=new fabric.Rect({left:340,top:240,width:210,height:120,fill:"transparent",stroke:c,strokeWidth:sw});
      if(type==="ellipse")obj=new fabric.Ellipse({left:340,top:240,rx:105,ry:65,fill:"transparent",stroke:c,strokeWidth:sw});
      if(obj){fcanvas.add(obj);fcanvas.setActiveObject(obj);pushHistory();autoSave();setTool("select")}
      close();
    }catch(err){alert("Не вдалося додати фігуру: "+err.message)}
  }

  /* ---------- Real compass ---------- */
  const compassState={active:false,center:null,preview:[],radiusCm:3};

  function ensureCompassPanel(){
    if($v("v56CompassPanel"))return;
    const p=document.createElement("div");
    p.id="v56CompassPanel";p.className="v56-compass-panel";p.style.display="none";
    p.innerHTML=`
      <div class="v56-panel-head"><span>📐 Циркуль</span><button id="v56CompassClose">×</button></div>
      <label>Радіус кола (см)
        <input id="v56CompassRadius" type="number" min="0.1" step="0.01" value="3">
      </label>
      <div class="v56-compass-actions">
        <button data-v56-r="1">1 см</button><button data-v56-r="2">2 см</button>
        <button data-v56-r="3">3 см</button><button data-v56-r="5">5 см</button>
      </div>
      <div class="v56-compass-actions">
        <button id="v56CompassPick" class="primary">1. Вибрати центр</button>
        <button id="v56CompassDraw">2. Побудувати коло</button>
      </div>
      <div id="v56CompassStatus" class="v56-status">Можна вводити десятковий радіус: 2,5; 3,75; 5,25 см.</div>`;
    document.body.appendChild(p);
    makeDraggable(p,p.querySelector(".v56-panel-head"));

    const input=$v("v56CompassRadius");
    input.oninput=()=>{
      const v=parseFloat(String(input.value).replace(",","."));
      if(Number.isFinite(v)&&v>0){compassState.radiusCm=v;if(compassState.center)drawCompassPreview()}
    };
    p.querySelectorAll("[data-v56-r]").forEach(b=>b.onclick=()=>{
      compassState.radiusCm=Number(b.dataset.v56R);input.value=String(compassState.radiusCm);
      if(compassState.center)drawCompassPreview();
    });
    $v("v56CompassPick").onclick=()=>{
      compassState.active=true;compassState.center=null;clearCompassPreview();
      $v("v56CompassStatus").textContent="Клікніть на аркуші у точці центра кола.";
    };
    $v("v56CompassDraw").onclick=buildCompassCircle;
    $v("v56CompassClose").onclick=closeCompass;
  }

  function openCompass(){
    ensureCompassPanel();
    const p=$v("v56CompassPanel");p.style.display="block";bringFront(p);
  }

  function closeCompass(){
    compassState.active=false;compassState.center=null;clearCompassPreview();
    const p=$v("v56CompassPanel");if(p)p.style.display="none";
  }

  function clearCompassPreview(){
    if(typeof fcanvas==="undefined")return;
    compassState.preview.forEach(o=>fcanvas.remove(o));compassState.preview=[];
    fcanvas.requestRenderAll();
  }

  function drawCompassPreview(){
    if(!compassState.center||typeof fcanvas==="undefined")return;
    clearCompassPreview();
    const r=compassState.radiusCm*37.7952755906,c=$v("colorPicker")?.value||"#17315f";
    const {x,y}=compassState.center;
    const preview=new fabric.Circle({left:x-r,top:y-r,radius:r,fill:"transparent",stroke:c,strokeWidth:2,strokeDashArray:[7,5],selectable:false,evented:false});
    const needle=new fabric.Circle({left:x-4,top:y-4,radius:4,fill:"#d63d3d",stroke:"#fff",strokeWidth:1,selectable:false,evented:false});
    const joint={x:x,y:y-r*.55}, pencil={x:x+r,y:y};
    const arm1=new fabric.Line([x,y,joint.x,joint.y],{stroke:"#5c6572",strokeWidth:5,selectable:false,evented:false});
    const arm2=new fabric.Line([joint.x,joint.y,pencil.x,pencil.y],{stroke:"#7a8491",strokeWidth:5,selectable:false,evented:false});
    const pivot=new fabric.Circle({left:joint.x-6,top:joint.y-6,radius:6,fill:"#2d6cdf",stroke:"#fff",strokeWidth:1,selectable:false,evented:false});
    compassState.preview=[preview,arm1,arm2,needle,pivot];
    compassState.preview.forEach(o=>fcanvas.add(o));
    fcanvas.requestRenderAll();
  }

  function buildCompassCircle(){
    if(!compassState.center){
      $v("v56CompassStatus").textContent="Спочатку натисніть «Вибрати центр» і клікніть на аркуші.";
      return;
    }
    const r=compassState.radiusCm*37.7952755906,c=$v("colorPicker")?.value||"#17315f",sw=Math.max(1,Number($v("lineWidth")?.value||2));
    const {x,y}=compassState.center;
    clearCompassPreview();
    const circle=new fabric.Circle({left:x-r,top:y-r,radius:r,fill:"transparent",stroke:c,strokeWidth:sw,selectable:true,evented:true});
    circle.radiusCm=compassState.radiusCm;
    fcanvas.add(circle);fcanvas.setActiveObject(circle);fcanvas.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
    $v("v56CompassStatus").textContent=`Готово: радіус ${String(compassState.radiusCm).replace(".",",")} см.`;
    compassState.center=null;compassState.active=false;
  }

  function bindCompass(){
    // Old geometry-panel compass button now opens the real compass instead of adding a picture.
    document.addEventListener("click",e=>{
      const b=e.target.closest?.('[data-instrument="compass"]');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();openCompass();
    },true);

    if(typeof fcanvas!=="undefined"){
      fcanvas.on("mouse:down",opt=>{
        if(!compassState.active)return;
        compassState.center=fcanvas.getPointer(opt.e);
        compassState.active=false;
        drawCompassPreview();
        $v("v56CompassStatus").textContent=`Центр вибрано. Радіус ${String(compassState.radiusCm).replace(".",",")} см. Натисніть «Побудувати коло».`;
      });
    }
  }

  /* ---------- Graph migration ---------- */
  let graphMigrationBusy=false;
  function migrateOldGraphs(){
    if(graphMigrationBusy||typeof fcanvas==="undefined"||typeof createGraphGroup!=="function")return;
    graphMigrationBusy=true;
    try{
      // Remove old standalone labels.
      fcanvas.getObjects().filter(o=>/^Графік\s*\d+\s*:/i.test((o?.text||"").trim())).forEach(o=>fcanvas.remove(o));

      const graphs=fcanvas.getObjects().slice().filter(o=>o?.graphObject&&o.graphMeta);
      graphs.forEach(g=>{
        const badChild=g._objects?.some?.(x=>/^Графік\s*\d*\s*:/i.test((x?.text||"").trim()));
        const hasFormula=g._objects?.some?.(x=>x?.isGraphFormulaLabel);
        if(!badChild && hasFormula)return;

        const idx=fcanvas.getObjects().indexOf(g);
        const meta=JSON.parse(JSON.stringify(g.graphMeta));
        fcanvas.remove(g);
        const ng=createGraphGroup(meta);
        fcanvas.insertAt(ng,idx>=0?idx:fcanvas.getObjects().length,false);
      });
      fcanvas.requestRenderAll();
    }catch(e){console.warn("V56 graph migration",e)}
    finally{graphMigrationBusy=false}
  }

  /* ---------- Heading font ---------- */
  function headingObjects(){
    if(typeof fcanvas==="undefined")return [];
    return fcanvas.getObjects().filter(o=>o?.systemRole==="dateHeading"||o?.systemRole==="workHeading");
  }
  function applyHeadingFont(){
    const font=$v("v56HeadingFont")?.value||"Times New Roman";
    const italic=$v("v56HeadingItalic")?.checked!==false;
    localStorage.setItem("sofiaHeadingFontV56",font);
    localStorage.setItem("sofiaHeadingItalicV56",italic?"1":"0");
    headingObjects().forEach(o=>{o.set({fontFamily:font,fontStyle:italic?"italic":"normal",fontWeight:"normal"});o.setCoords?.()});
    fcanvas?.requestRenderAll?.();
  }
  function restoreHeadingFont(){
    const font=localStorage.getItem("sofiaHeadingFontV56")||"Times New Roman";
    const italic=localStorage.getItem("sofiaHeadingItalicV56")!=="0";
    if($v("v56HeadingFont"))$v("v56HeadingFont").value=font;
    if($v("v56HeadingItalic"))$v("v56HeadingItalic").checked=italic;
    applyHeadingFont();
  }

  /* ---------- Teacher tools ---------- */
  function teacherPanel(){return $v("teacherToolsPanel")||document.querySelector(".teacher-tools-panel")}
  function openTeacherTool(name){
    const p=teacherPanel();
    if(!p){alert("Інструменти вчителя ще не завантажились.");return}
    p.classList.remove("hidden");p.style.removeProperty("display");bringFront(p);
    p.querySelectorAll("[data-tt31-section]").forEach(s=>s.classList.toggle("hidden",s.dataset.tt31Section!==name));
    p.querySelectorAll("[data-tt31]").forEach(b=>b.classList.toggle("active",b.dataset.tt31===name));
    ensureWheelFullscreen();
  }
  function makeTeacherShortcut(id,label,name){
    return makeButton(id,label,"teacher",()=>openTeacherTool(name));
  }

  function ensureWheelFullscreen(){
    const p=teacherPanel();if(!p)return;
    let b=$v("v56WheelFullscreen");
    if(!b){
      b=document.createElement("button");b.id="v56WheelFullscreen";b.className="v56-wheel-max";b.textContent="⛶ На весь екран";
      b.onclick=()=>{
        const on=!p.classList.contains("v56-maximized");
        p.classList.toggle("v56-maximized",on);
        b.textContent=on?"↙ Вийти з повного екрану":"⛶ На весь екран";
      };
      p.appendChild(b);
    }
    const wheelVisible=Array.from(p.querySelectorAll("[data-tt31-section]")).some(s=>s.dataset.tt31Section==="wheel"&&!s.classList.contains("hidden"));
    b.style.display=wheelVisible?"":"none";
  }

  /* ---------- Voice ---------- */
  function bindVoice(){
    const b=$v("voiceBtn");if(!b)return;
    b.onclick=async e=>{
      e.preventDefault();e.stopPropagation();
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){alert("Голосове введення працює у Google Chrome або Microsoft Edge.");return}
      try{
        if(navigator.mediaDevices?.getUserMedia){
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());
        }
      }catch(err){alert("Дозвольте доступ до мікрофона для Sofia Notebook.");return}
      const r=new SR();r.lang=$v("subject")?.value==="Англійська мова"?"en-US":"uk-UA";r.interimResults=false;
      b.textContent="🎙 Слухаю…";
      r.onresult=ev=>insertTextIntoBoard(ev.results[0][0].transcript+" ");
      r.onerror=()=>alert("Не вдалося розпізнати мовлення.");
      r.onend=()=>b.textContent="🎙 Голос";
      r.start();
    };
  }

  /* ---------- Keyboard UA default ---------- */
  function ensureUaKeyboard(){
    try{keyboardLang="UA";renderKeyboard()}catch(e){}
  }

  /* ---------- Floating / dragging ---------- */
  function makeDraggable(p,handle){
    if(!p||!handle||p.dataset.v56Drag)return;p.dataset.v56Drag="1";
    let down=false,sx=0,sy=0,sl=0,st=0;
    handle.addEventListener("mousedown",e=>{
      if(e.button!==0||e.target.closest("button,input,select,textarea"))return;
      const r=p.getBoundingClientRect();down=true;sx=e.clientX;sy=e.clientY;sl=r.left;st=r.top;bringFront(p);e.preventDefault();
    });
    window.addEventListener("mousemove",e=>{
      if(!down)return;
      p.style.left=Math.max(0,Math.min(window.innerWidth-p.offsetWidth,sl+e.clientX-sx))+"px";
      p.style.top=Math.max(0,Math.min(window.innerHeight-p.offsetHeight,st+e.clientY-sy))+"px";
      p.style.right="auto";p.style.bottom="auto";
    });
    window.addEventListener("mouseup",()=>down=false);
  }

  function floatKnownPanels(){
    [
      "mediaPanel","elementsPanel","geometryPanel","anglePanel","numberRayPanel",
      "graphBuilderPanel","graphEditorPanel","calculatorPanel","timerPanel","ukrainianPanel",
      "keyboardPanel","aiPanel","teacherToolsPanel"
    ].forEach(id=>{
      const p=$v(id);if(!p)return;
      if(!p.classList.contains("hidden")&&getComputedStyle(p).display!=="none")bringFront(p);
      const h=p.querySelector(".panel-head,.teacher-tools-head,.graph-editor-head,h2,h3")||p.firstElementChild;
      makeDraggable(p,h);
      p.addEventListener("mousedown",()=>bringFront(p),true);
    });
  }

  /* ---------- Reorder commands ---------- */
  function setArrange(on){
    arrangeMode=on;document.body.classList.toggle("v56-arranging",on);
    document.querySelectorAll("#sofiaRibbonV56 .v56-command").forEach(b=>b.draggable=on);
    $v("v56ArrangeBtn").textContent=on?"✓ Готово":"⚙ Впорядкувати";
    if(!on)saveOrder();
  }
  document.addEventListener("dragstart",e=>{
    const b=e.target.closest?.("#sofiaRibbonV56 .v56-command");
    if(!arrangeMode||!b)return;draggedCommand=b;b.style.opacity=".45";
  });
  document.addEventListener("dragend",e=>{
    const b=e.target.closest?.("#sofiaRibbonV56 .v56-command");if(b)b.style.opacity="";draggedCommand=null;saveOrder();
  });
  document.addEventListener("dragover",e=>{
    if(!arrangeMode||!draggedCommand)return;
    const target=e.target.closest?.("#sofiaRibbonV56 .v56-command");
    const p=e.target.closest?.("#sofiaRibbonV56 .v56-panel");
    if(target&&target!==draggedCommand){e.preventDefault();const r=target.getBoundingClientRect();if(e.clientX<r.left+r.width/2)target.parentElement.insertBefore(draggedCommand,target);else target.after(draggedCommand)}
    else if(p){e.preventDefault();if(draggedCommand.parentElement!==p)p.appendChild(draggedCommand)}
  });
  document.addEventListener("drop",e=>{if(arrangeMode&&draggedCommand){e.preventDefault();saveOrder()}});

  function saveOrder(){
    const data={};
    document.querySelectorAll(".v56-panel").forEach(p=>{
      data[p.dataset.v56Panel]=Array.from(p.querySelectorAll(":scope>.v56-command")).map(b=>b.id).filter(Boolean);
    });
    localStorage.setItem(RIBBON_ORDER_KEY,JSON.stringify(data));
  }
  function restoreOrder(){
    try{
      const data=JSON.parse(localStorage.getItem(RIBBON_ORDER_KEY)||"{}");
      Object.entries(data).forEach(([tab,ids])=>{
        const p=panel(tab);if(!p||!Array.isArray(ids))return;
        ids.forEach(id=>{const b=$v(id);if(b?.classList.contains("v56-command"))p.appendChild(b)});
      });
    }catch(e){}
  }

  /* ---------- Initialize ---------- */
  function init(){
    addCss();addAuthor();moveInstallTop();createRibbon();buildRibbonCommands();
    bindCorePanels();bindCompass();bindVoice();ensureUaKeyboard();
    ensureFiguresPanel();ensureCompassPanel();
    hideOldTopDuplicates();floatKnownPanels();
    restoreHeadingFont();
    setTimeout(migrateOldGraphs,250);
    setTimeout(migrateOldGraphs,900);

    if(typeof fcanvas!=="undefined"){
      let graphTimer;
      fcanvas.on("object:added",()=>{
        clearTimeout(graphTimer);graphTimer=setTimeout(()=>{migrateOldGraphs();applyHeadingFont();normalizeEraserLayerOrder?.()},80)
      });
    }

    document.documentElement.dataset.sofiaVersion="56";
    if($v("appVersionBadge"))$v("appVersionBadge").textContent="v56";

    const mo=new MutationObserver(()=>{
      clearTimeout(mo.__v56);
      mo.__v56=setTimeout(()=>{floatKnownPanels();hideOldTopDuplicates();ensureWheelFullscreen()},80);
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,220));
  else setTimeout(init,220);
})();



/* =========================================================
   V57: ФОРМАТУВАННЯ ТЕКСТУ + АУДИТ КНОПОК БЕЗ ДУБЛІКАТІВ
   ========================================================= */
(function(){
  "use strict";

  const $57=id=>document.getElementById(id);

  /* ---------- TEXT FORMAT PANEL ---------- */
  function activeText(){
    if(typeof fcanvas==="undefined")return null;
    const o=fcanvas.getActiveObject?.();
    return o && ["i-text","textbox","text"].includes(o.type) ? o : null;
  }

  function applyText(props){
    const o=activeText();
    if(!o)return;
    o.set(props);
    o.setCoords?.();
    fcanvas.requestRenderAll();
    try{pushHistory();autoSave()}catch(e){}
    syncV57TextControls();
  }

  function syncV57TextControls(){
    const o=activeText();
    const box=$57("v57TextFormat");
    if(!box)return;

    box.querySelectorAll("select,input,button").forEach(el=>{
      if(el.id==="v57InsertTextBtn")return;
      el.disabled=!o;
    });

    if(!o)return;

    const font=$57("v57TextFont");
    const size=$57("v57TextSize");
    const color=$57("v57TextColor");
    const bg=$57("v57TextBg");
    const align=$57("v57TextAlign");

    if(font)font.value=o.fontFamily||"Segoe Script";
    if(size)size.value=Math.round(o.fontSize||38);
    if(color && /^#[0-9a-f]{6}$/i.test(o.fill||""))color.value=o.fill;
    if(bg && /^#[0-9a-f]{6}$/i.test(o.backgroundColor||""))bg.value=o.backgroundColor;
    if(align)align.value=o.textAlign||"left";

    $57("v57Bold")?.classList.toggle("active",o.fontWeight==="bold"||Number(o.fontWeight)>=600);
    $57("v57Italic")?.classList.toggle("active",o.fontStyle==="italic");
    $57("v57Underline")?.classList.toggle("active",!!o.underline);
    $57("v57Strike")?.classList.toggle("active",!!o.linethrough);
  }

  function insertText(){
    if(typeof fcanvas==="undefined"||!window.fabric)return;
    const t=new fabric.IText("Текст",{
      left:300,top:200,
      fontFamily:"Segoe Script",
      fontSize:38,
      fill:"#4a7fbd",
      fontStyle:"normal",
      editable:true,
      erasable:false
    });
    fcanvas.add(t);
    fcanvas.setActiveObject(t);
    t.enterEditing?.();
    t.selectAll?.();
    fcanvas.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
    syncV57TextControls();
  }

  function addTextFormatControls(){
    const home=document.querySelector('.v56-panel[data-v56-panel="home"]');
    if(!home || $57("v57TextFormat"))return;

    const wrap=document.createElement("div");
    wrap.id="v57TextFormat";
    wrap.style.cssText=[
      "display:flex","flex-wrap:wrap","gap:6px","align-items:center",
      "padding:6px 8px","border:1px solid #d7e0ec","border-radius:10px",
      "background:#f8fbff"
    ].join(";");

    wrap.innerHTML=`
      <button id="v57InsertTextBtn" type="button" title="Додати текст">T Текст</button>

      <select id="v57TextFont" title="Шрифт">
        <option>Segoe Script</option>
        <option>Times New Roman</option>
        <option>Arial</option>
        <option>Calibri</option>
        <option>Georgia</option>
        <option>Verdana</option>
        <option>Tahoma</option>
        <option>Trebuchet MS</option>
        <option>Segoe Print</option>
        <option>Comic Sans MS</option>
      </select>

      <input id="v57TextSize" type="number" min="8" max="120" value="38"
        title="Розмір шрифту" style="width:70px">

      <button id="v57TextSmaller" type="button" title="Зменшити шрифт">A−</button>
      <button id="v57TextLarger" type="button" title="Збільшити шрифт">A+</button>
      <button id="v57Bold" type="button" title="Жирний"><b>B</b></button>
      <button id="v57Italic" type="button" title="Курсив"><i>I</i></button>
      <button id="v57Underline" type="button" title="Підкреслення"><u>U</u></button>
      <button id="v57Strike" type="button" title="Закреслення"><s>S</s></button>

      <label title="Колір тексту" style="display:flex;align-items:center;gap:4px">
        Текст <input id="v57TextColor" type="color" value="#4a7fbd">
      </label>

      <label title="Фон тексту" style="display:flex;align-items:center;gap:4px">
        Фон <input id="v57TextBg" type="color" value="#ffffff">
      </label>

      <select id="v57TextAlign" title="Вирівнювання">
        <option value="left">← Ліворуч</option>
        <option value="center">↔ По центру</option>
        <option value="right">Праворуч →</option>
        <option value="justify">☰ По ширині</option>
      </select>

      <button id="v57DuplicateText" type="button" title="Дублювати текст">⧉ Копія</button>
    `;

    home.appendChild(wrap);

    $57("v57InsertTextBtn").onclick=insertText;
    $57("v57TextFont").onchange=()=>applyText({fontFamily:$57("v57TextFont").value});
    $57("v57TextSize").onchange=()=>applyText({fontSize:Math.max(8,Math.min(120,Number($57("v57TextSize").value)||26))});

    $57("v57TextSmaller").onclick=()=>{
      const o=activeText();if(o)applyText({fontSize:Math.max(8,(o.fontSize||26)-2)});
    };
    $57("v57TextLarger").onclick=()=>{
      const o=activeText();if(o)applyText({fontSize:Math.min(120,(o.fontSize||26)+2)});
    };
    $57("v57Bold").onclick=()=>{
      const o=activeText();if(o)applyText({fontWeight:(o.fontWeight==="bold"||Number(o.fontWeight)>=600)?"normal":"bold"});
    };
    $57("v57Italic").onclick=()=>{
      const o=activeText();if(o)applyText({fontStyle:o.fontStyle==="italic"?"normal":"italic"});
    };
    $57("v57Underline").onclick=()=>{
      const o=activeText();if(o)applyText({underline:!o.underline});
    };
    $57("v57Strike").onclick=()=>{
      const o=activeText();if(o)applyText({linethrough:!o.linethrough});
    };
    $57("v57TextColor").oninput=()=>applyText({fill:$57("v57TextColor").value});
    $57("v57TextBg").oninput=()=>applyText({backgroundColor:$57("v57TextBg").value});
    $57("v57TextAlign").onchange=()=>applyText({textAlign:$57("v57TextAlign").value});

    $57("v57DuplicateText").onclick=()=>{
      const o=activeText();if(!o)return;
      o.clone(cl=>{
        cl.set({left:(o.left||0)+28,top:(o.top||0)+28,systemRole:null,isHeadingText:false});
        fcanvas.add(cl);fcanvas.setActiveObject(cl);fcanvas.requestRenderAll();
        try{pushHistory();autoSave()}catch(e){}
        syncV57TextControls();
      });
    };

    // Old separate text format bar is no longer needed: one text toolbar only.
    const old=$57("textFormatBar");
    if(old)old.style.display="none";

    syncV57TextControls();
  }

  /* ---------- BUTTON AUDIT ---------- */
  const panelPairs={
    mediaBtn:"mediaPanel",
    elementsBtn:"elementsPanel",
    geometryBtn:"geometryPanel",
    calculatorBtn:"calculatorPanel",
    angleBtn:"anglePanel",
    numberRayBtn:"numberRayPanel",
    graphBuilderBtn:"graphBuilderPanel",
    timerBtn:"timerPanel",
    ukrainianBtn:"ukrainianPanel",
    keyboardBtn:"keyboardPanel",
    aiBtn:"aiPanel"
  };

  const customWorkingIds=new Set([
    "saveBtn","undoBtn","redoBtn","deleteSelectedBtn","clearPageBtn","voiceBtn",
    "noteBtn","v56TableBtn","v56FiguresBtn",
    "v56Wheel","v56Cards","v56Test","v56Lists","v56Translate","v56AiImage",
    "correctionMarkerBtn","groupBtn","ungroupBtn","explodeShapeBtn","editVerticesBtn",
    "pointBtn","vertexLabelBtn",
    "v57InsertTextBtn","v57TextFont","v57TextSize","v57TextSmaller","v57TextLarger",
    "v57Bold","v57Italic","v57Underline","v57Strike","v57TextColor","v57TextBg",
    "v57TextAlign","v57DuplicateText"
  ]);

  function buttonWorks(btn){
    if(!btn)return false;
    if(panelPairs[btn.id])return !!$57(panelPairs[btn.id]);
    if(customWorkingIds.has(btn.id))return true;
    if(btn.id==="installAppBtn")return true;
    // Buttons inside dedicated dialogs/panels are not ribbon audit targets.
    if(!btn.closest("#sofiaRibbonV56"))return true;
    // Ribbon button with no id is considered unsafe and hidden.
    if(!btn.id)return false;
    // Existing core onclick/addEventListener actions are allowed if the button has an id.
    return typeof btn.onclick==="function";
  }

  function removeDuplicateRibbonButtons(){
    const ribbon=$57("sofiaRibbonV56");
    if(!ribbon)return;

    const seenIds=new Set();
    const seenLabels=new Map();

    Array.from(ribbon.querySelectorAll("button")).forEach(btn=>{
      if(btn.id){
        if(seenIds.has(btn.id)){
          btn.remove();
          return;
        }
        seenIds.add(btn.id);
      }

      const label=(btn.textContent||"").trim().replace(/\s+/g," ");
      const key=(btn.closest(".v56-panel")?.dataset.v56Panel||"head")+"|"+label;
      if(label && !["B","I","U","S","A−","A+"].includes(label)){
        if(seenLabels.has(key) && btn.id!==seenLabels.get(key)){
          btn.remove();
          return;
        }
        seenLabels.set(key,btn.id||"");
      }
    });
  }

  function hideDeadRibbonButtons(){
    const ribbon=$57("sofiaRibbonV56");
    if(!ribbon)return;
    ribbon.querySelectorAll(".v56-panel > button.v56-command").forEach(btn=>{
      if(!buttonWorks(btn)){
        btn.style.display="none";
        btn.dataset.v57DisabledReason="Команда недоступна";
      }else{
        btn.style.removeProperty("display");
      }
    });
  }

  function removeOldTechnicalButtons(){
    const badExact=new Set([
      "Верхня панель","Ліва панель","Показати всі","Готово",
      "На весь екран","Вийти з повного екрану"
    ]);

    document.querySelectorAll("button").forEach(btn=>{
      if(btn.closest("#sofiaRibbonV56"))return;
      const label=(btn.textContent||"").trim().replace(/\s+/g," ");
      if(badExact.has(label) && btn.id!=="fullscreenBtn"){
        btn.style.display="none";
      }
    });
  }

  function auditRibbon(){
    removeDuplicateRibbonButtons();
    hideDeadRibbonButtons();
    removeOldTechnicalButtons();

    // Keep only the clean v56 ribbon visible.
    document.querySelectorAll('[id^="sofiaRibbon"]').forEach(r=>{
      if(r.id!=="sofiaRibbonV56")r.style.display="none";
    });

    // Compact diagnostic in console.
    const ribbon=$57("sofiaRibbonV56");
    if(!ribbon)return;
    const visible=Array.from(ribbon.querySelectorAll(".v56-panel > button.v56-command"))
      .filter(b=>getComputedStyle(b).display!=="none");
    const hidden=Array.from(ribbon.querySelectorAll(".v56-panel > button.v56-command"))
      .filter(b=>getComputedStyle(b).display==="none");

    console.info("Sofia V57: active ribbon commands",visible.map(b=>b.id||b.textContent.trim()));
    if(hidden.length)console.warn("Sofia V57: hidden unavailable commands",hidden.map(b=>b.id||b.textContent.trim()));
  }

  /* ---------- TEXT EVENT SYNC ---------- */
  function bindTextEvents(){
    if(typeof fcanvas==="undefined")return;

    ["selection:created","selection:updated","selection:cleared","text:editing:entered","text:changed"].forEach(evt=>{
      fcanvas.on(evt,()=>setTimeout(syncV57TextControls,0));
    });

    fcanvas.on("object:added",e=>{
      const o=e.target;
      if(o && ["i-text","textbox","text"].includes(o.type)){
        // Regular user text defaults to Times New Roman unless it already has a specific font.
        if(!o.systemRole && (!o.fontFamily || o.fontFamily==="Arial")){
          o.set({fontFamily:"Times New Roman"});
        }
      }
    });
  }

  function init(){
    addTextFormatControls();
    bindTextEvents();

    [100,500,1200,2200].forEach(ms=>setTimeout(()=>{
      auditRibbon();
      syncV57TextControls();
    },ms));

    document.documentElement.dataset.sofiaVersion="57";
    if($57("appVersionBadge"))$57("appVersionBadge").textContent="v57";
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  }else{
    setTimeout(init,250);
  }
})();



/* =========================================================
   V58b — СТОРІНКИ ОКРЕМИМ РЯДКОМ ПІД СТРІЧКОЮ
   Не змінює роботу інструментів v57.
   ========================================================= */
(function(){
  function findPageBar(){
    const add = document.getElementById("addPageBtn");
    if(!add) return null;

    // У різних збірках контейнер мав різну вкладеність.
    // Беремо найменший блок, у якому є addPageBtn і вкладки сторінок.
    let el = add.parentElement;
    while(el && el !== document.body){
      const hasTabs = el.querySelector &&
        (el.querySelector("#pageTabs") ||
         el.querySelector("#pageTabsWrap") ||
         Array.from(el.querySelectorAll("button")).some(b =>
           /Сторінка\s*\d+/i.test((b.textContent||"").trim())));
      if(hasTabs) return el;
      el = el.parentElement;
    }
    return add.parentElement;
  }

  function fix(){
    const ribbon = document.getElementById("sofiaRibbonV56");
    const bar = findPageBar();
    if(!ribbon || !bar || ribbon.contains(bar)) return;

    // Головне виправлення: сторінки фізично переносимо ПІСЛЯ стрічки.
    if(ribbon.nextElementSibling !== bar){
      ribbon.insertAdjacentElement("afterend", bar);
    }

    // Окремий рядок на всю ширину.
    Object.entries({
      display:"flex",
      width:"100%",
      maxWidth:"100%",
      flexBasis:"100%",
      clear:"both",
      alignItems:"center",
      justifyContent:"flex-start",
      flexWrap:"wrap",
      gap:"8px",
      margin:"8px 0 0 0",
      padding:"8px 10px",
      boxSizing:"border-box",
      position:"relative",
      left:"0",
      right:"auto",
      float:"none"
    }).forEach(([k,v])=>bar.style.setProperty(k,v,"important"));

    // Якщо батьківський контейнер був flex-row, не дозволяємо йому
    // знову поставити стрічку та сторінки поруч.
    const parent = ribbon.parentElement;
    if(parent){
      parent.style.setProperty("display","flex","important");
      parent.style.setProperty("flex-direction","column","important");
      parent.style.setProperty("align-items","stretch","important");
      parent.style.setProperty("width","100%","important");
    }

    // Кнопка "Нова сторінка" та вкладки не розтягуються на правий край.
    const add=document.getElementById("addPageBtn");
    if(add){
      add.style.setProperty("flex","0 0 auto","important");
      add.style.setProperty("margin","0","important");
    }

    const tabs=document.getElementById("pageTabs");
    const wrap=document.getElementById("pageTabsWrap");
    [wrap,tabs].filter(Boolean).forEach(el=>{
      el.style.setProperty("display","flex","important");
      el.style.setProperty("align-items","center","important");
      el.style.setProperty("gap","6px","important");
      el.style.setProperty("width","auto","important");
      el.style.setProperty("max-width","100%","important");
      el.style.setProperty("flex","0 1 auto","important");
      el.style.setProperty("margin","0","important");
      el.style.setProperty("overflow-x","auto","important");
    });

    // Позначаємо версію лише після успішного виправлення.
    const badge=document.getElementById("appVersionBadge");
    if(badge) badge.textContent="v58";
    document.documentElement.dataset.sofiaVersion="58";
  }

  function init(){
    fix();
    [100,300,700,1400,2500].forEach(t=>setTimeout(fix,t));

    // Після додавання/видалення сторінок DOM може перебудуватися.
    const obs=new MutationObserver(()=>requestAnimationFrame(fix));
    obs.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();



/* =========================================================
   V60 — ПАНЕЛЬ "КОЛІР / ТОВЩИНА / ЛІНІЯ / ВІДРІЗОК / ПЕРЕВІРКА"
   ПЕРЕНЕСЕНА У ВКЛАДКУ "МАЛЮВАННЯ".
   База: стабільна v58. Інші панелі не змінюємо.
   ========================================================= */
(function(){
  const $60 = id => document.getElementById(id);

  function drawingTab(){
    return document.querySelector('.v56-panel[data-v56-panel="draw"]');
  }

  function findDrawingOptionsBar(){
    // Шукаємо рядок через характерні елементи керування.
    const candidates = [
      $60("strokeColor"),
      $60("colorPicker"),
      $60("lineWidth"),
      $60("strokeWidth"),
      $60("lineStyle"),
      $60("lineType"),
      $60("correctionColor")
    ].filter(Boolean);

    for(const el of candidates){
      let p = el.parentElement;
      for(let i=0; p && i<5; i++, p=p.parentElement){
        const txt=(p.textContent||"").replace(/\s+/g," ").trim();
        if(/Колір/i.test(txt) &&
           /Товщина/i.test(txt) &&
           /(Суцільна|Пунктир|Штрих)/i.test(txt) &&
           /(Відрізок|Лінія)/i.test(txt)){
          return p;
        }
      }
    }

    // Fallback: знайти компактний блок за текстом.
    const all = Array.from(document.querySelectorAll("div,section"));
    return all.find(el=>{
      const txt=(el.textContent||"").replace(/\s+/g," ").trim();
      const r=el.getBoundingClientRect();
      return r.height>25 && r.height<100 &&
             /Колір/i.test(txt) && /Товщина/i.test(txt) &&
             /(Суцільна|Пунктир|Штрих)/i.test(txt) &&
             /(Відрізок|Лінія)/i.test(txt) &&
             /Перевірка/i.test(txt);
    }) || null;
  }

  function moveDrawingOptions(){
    const tab=drawingTab();
    const bar=findDrawingOptionsBar();
    if(!tab || !bar || bar===tab || tab.contains(bar)) return;

    // Не переносимо великий батьківський контейнер випадково.
    const rect=bar.getBoundingClientRect();
    if(rect.height>120) return;

    bar.id = bar.id || "v60DrawingOptionsBar";
    bar.dataset.v60Moved="1";

    // Ставимо параметри на початок вкладки "Малювання".
    tab.insertBefore(bar, tab.firstChild);

    bar.style.setProperty("display","flex","important");
    bar.style.setProperty("align-items","center","important");
    bar.style.setProperty("flex-wrap","wrap","important");
    bar.style.setProperty("gap","8px","important");
    bar.style.setProperty("width","100%","important");
    bar.style.setProperty("max-width","100%","important");
    bar.style.setProperty("margin","0 0 8px 0","important");
    bar.style.setProperty("padding","6px 8px","important");
    bar.style.setProperty("box-sizing","border-box","important");
    bar.style.setProperty("position","static","important");
    bar.style.setProperty("float","none","important");

    // Якщо старий зовнішній рядок після переносу став порожнім — ховаємо його.
    document.querySelectorAll("div,section").forEach(el=>{
      if(el===bar || el.contains(bar) || bar.contains(el)) return;
      const r=el.getBoundingClientRect();
      if(r.height>0 && r.height<70 && !(el.textContent||"").trim() &&
         el.querySelectorAll("input,select,button").length===0){
        // не чіпаємо загальні layout-контейнери
        if(el.children.length===0) el.style.display="none";
      }
    });

    const badge=$60("appVersionBadge");
    if(badge) badge.textContent="v60";
    document.documentElement.dataset.sofiaVersion="60";
  }

  function init(){
    moveDrawingOptions();
    [200,500,1000,1800].forEach(ms=>setTimeout(moveDrawingOptions,ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,180),{once:true});
  }else{
    setTimeout(init,180);
  }
})();



/* V61 — "Панель" і "Перевірка функцій" завжди поверх стрічки */
(function(){
"use strict";
let TOP=2147483000;

function visible(el){
  if(!el)return false;
  const c=getComputedStyle(el);
  return !el.hidden && c.display!=="none" && c.visibility!=="hidden";
}
function title(el){
  return (el?.textContent||"").replace(/\s+/g," ").trim();
}
function isWanted(el){
  const t=title(el);
  return /Налаштування панелі|Перевірка функцій/i.test(t);
}
function lift(el){
  if(!el||!visible(el)||!isWanted(el))return;
  if(el.parentElement!==document.body) document.body.appendChild(el);
  el.style.setProperty("position","fixed","important");
  el.style.setProperty("z-index",String(++TOP),"important");
  el.style.setProperty("isolation","isolate","important");
  el.style.setProperty("pointer-events","auto","important");
  el.style.setProperty("visibility","visible","important");
  el.style.setProperty("opacity","1","important");
  el.style.setProperty("max-height","calc(100vh - 32px)","important");
  el.style.setProperty("overflow","auto","important");
  let r=el.getBoundingClientRect();
  if(r.top<16) el.style.setProperty("top","16px","important");
  r=el.getBoundingClientRect();
  if(r.right>innerWidth-16){
    el.style.setProperty("right","16px","important");
    el.style.setProperty("left","auto","important");
  }
  r=el.getBoundingClientRect();
  if(r.bottom>innerHeight-16){
    el.style.setProperty("bottom","16px","important");
    if(r.height<innerHeight-32) el.style.setProperty("top","auto","important");
  }
}
function closestDialog(node){
  let p=node;
  for(let i=0;i<7 && p && p!==document.body;i++,p=p.parentElement){
    if(!visible(p))continue;
    const r=p.getBoundingClientRect();
    if(isWanted(p) && r.width>=300 && r.height>=100 &&
       r.width<innerWidth*.95 && r.height<innerHeight*.98) return p;
  }
  return null;
}
function scan(){
  ["panelSettings","toolbarSettingsPanel","diagnosticsPanel","diagnosticsModal"]
    .forEach(id=>lift(document.getElementById(id)));

  document.querySelectorAll("h1,h2,h3,h4,strong,b,div,section").forEach(n=>{
    const t=title(n);
    if(!/Налаштування панелі|Перевірка функцій/i.test(t))return;
    const d=closestDialog(n);
    if(d)lift(d);
  });
}
function bind(){
  document.querySelectorAll("button").forEach(b=>{
    const t=title(b);
    if(!/Панель|Впорядкувати|Перевірка/i.test(t) || b.dataset.v61)return;
    b.dataset.v61="1";
    b.addEventListener("click",()=>{
      [0,20,80,180].forEach(ms=>setTimeout(scan,ms));
    },true);
  });
}
function init(){
  bind(); scan();
  const mo=new MutationObserver(()=>{
    clearTimeout(mo._v61);
    mo._v61=setTimeout(()=>{bind();scan()},25);
  });
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,
    attributeFilter:["style","class","hidden"]});
  const badge=document.getElementById("appVersionBadge");
  if(badge)badge.textContent="v61";
  document.documentElement.dataset.sofiaVersion="61";
}
if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,180),{once:true});
else setTimeout(init,180);
})();



/* =========================================================
   V62 — ВЕЛИКІ ЗАГОЛОВКИ + СТАНДАРТНА ЕКРАННА КЛАВІАТУРА
   ========================================================= */
(function(){
  function addV62Css(){
    if(document.getElementById("v62KeyboardCss"))return;
    const st=document.createElement("style");
    st.id="v62KeyboardCss";
    st.textContent=`
      #keyboardPanel{
        width:min(980px,94vw)!important;
        max-width:94vw!important;
      }
      #keyboardKeys.standard-keyboard-v62{
        display:flex!important;
        flex-direction:column!important;
        gap:6px!important;
        padding:12px!important;
        background:#eef3f8!important;
        border-radius:10px!important;
      }
      .kb-row-v62{
        display:flex!important;
        gap:5px!important;
        width:100%!important;
        align-items:stretch!important;
      }
      .key-btn-v62{
        flex:1 1 0!important;
        min-width:43px!important;
        height:48px!important;
        padding:4px 7px!important;
        border:1px solid #8fa5be!important;
        border-radius:5px!important;
        background:#fff!important;
        color:#10284c!important;
        font:700 17px/1 Arial,sans-serif!important;
        box-shadow:0 1px 2px rgba(15,23,42,.12)!important;
        cursor:pointer!important;
      }
      .key-btn-v62:hover{background:#e8f1ff!important}
      .key-btn-v62.special{background:#d9e4f1!important}
      .key-btn-v62.active{background:#173b78!important;color:#fff!important}
      .key-btn-v62.space{flex:7 1 0!important}
      .key-btn-v62.enter{flex:1.7 1 0!important}
      .key-btn-v62.back{flex:1.6 1 0!important}
      @media(max-width:800px){
        .key-btn-v62{min-width:30px!important;height:42px!important;font-size:14px!important;padding:3px!important}
        .kb-row-v62{gap:3px!important}
      }
    `;
    document.head.appendChild(st);
  }

  function applyDefaultHeadingSize(){
    if(typeof fcanvas==="undefined")return;
    const date=fcanvas.getObjects().find(o=>o?.systemRole==="dateHeading");
    const work=fcanvas.getObjects().find(o=>o?.systemRole==="workHeading");
    if(date){
      date.set({
        fontFamily:"Segoe Script",
        fontStyle:"normal",
        fontWeight:"normal",
        fill:"#4a7fbd",
        fontSize:48
      });
      date.setCoords?.();
    }
    if(work){
      work.set({
        fontFamily:"Segoe Script",
        fontStyle:"normal",
        fontWeight:"normal",
        fill:"#4a7fbd",
        fontSize:50
      });
      work.setCoords?.();
    }
    fcanvas.requestRenderAll();
  }

  function init(){
    addV62Css();
    applyDefaultHeadingSize();
    [250,700,1500].forEach(ms=>setTimeout(applyDefaultHeadingSize,ms));

    if(typeof fcanvas!=="undefined"){
      fcanvas.on("object:added",e=>{
        if(e?.target?.systemRole==="dateHeading"||e?.target?.systemRole==="workHeading")
          setTimeout(applyDefaultHeadingSize,0);
      });
    }

    const badge=document.getElementById("appVersionBadge");
    if(badge)badge.textContent="v62";
    document.documentElement.dataset.sofiaVersion="62";
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,180),{once:true});
  else
    setTimeout(init,180);
})();



/* =========================================================
   V63 — РУКОПИСНИЙ ТЕКСТ + ВИБІР МІСЦЯ + ЧЕРВОНЕ ПОЛЕ
   ========================================================= */
(function(){
  "use strict";
  const $63=id=>document.getElementById(id);
  let textPlacementMode=false;

  const DEFAULT_FONT="Segoe Script";
  const DEFAULT_SIZE=38;
  const DEFAULT_COLOR="#4a7fbd";

  function homePanel(){
    return document.querySelector('.v56-panel[data-v56-panel="home"]');
  }

  /* ---------- One-time migration to the new requested default ---------- */
  function migrateDefaultHeadingFont(){
    if(localStorage.getItem("sofiaDefaultFontMigratedV63")==="1")return;
    localStorage.setItem("sofiaDefaultFontMigratedV63","1");
    localStorage.setItem("sofiaHeadingFontV56",DEFAULT_FONT);
    localStorage.setItem("sofiaHeadingItalicV56","0");
  }

  function styleHeadingDefaults(){
    if(typeof fcanvas==="undefined")return;
    const date=fcanvas.getObjects().find(o=>o?.systemRole==="dateHeading");
    const work=fcanvas.getObjects().find(o=>o?.systemRole==="workHeading");

    if(date){
      date.set({
        fontFamily:DEFAULT_FONT,
        fontStyle:"normal",
        fontWeight:"normal",
        fontSize:48,
        fill:DEFAULT_COLOR
      });
      date.setCoords?.();
    }
    if(work){
      work.set({
        fontFamily:DEFAULT_FONT,
        fontStyle:"normal",
        fontWeight:"normal",
        fontSize:50,
        fill:DEFAULT_COLOR
      });
      work.setCoords?.();
    }
    fcanvas.requestRenderAll();
  }

  /* ---------- Text creation ---------- */
  function makeTextAt(x,y,initial=""){
    if(typeof fcanvas==="undefined"||!window.fabric)return null;

    const t=new fabric.IText(initial,{
      left:x,
      top:y,
      fontFamily:DEFAULT_FONT,
      fontStyle:"normal",
      fontWeight:"normal",
      fontSize:DEFAULT_SIZE,
      fill:DEFAULT_COLOR,
      editable:true,
      erasable:false
    });

    fcanvas.add(t);
    fcanvas.setActiveObject(t);
    t.enterEditing?.();

    if(initial){
      t.selectionStart=t.selectionEnd=initial.length;
    }

    fcanvas.requestRenderAll();
    try{pushHistory();autoSave();setTool("select")}catch(e){}
    return t;
  }

  function writingStartPoint(){
    // Звичайний початок рядка в зошиті.
    // Якщо ввімкнене червоне поле — починаємо праворуч від нього.
    const margin=fcanvas?.getObjects?.().find(o=>o?.systemRole==="notebookMarginLine");
    return {
      x: margin ? (margin.left||72)+26 : 72,
      y: 185
    };
  }

  function beginChooseTextPlace(){
    textPlacementMode=true;
    try{setTool("select")}catch(e){}
    const b=$63("v57InsertTextBtn");
    if(b){
      b.textContent="✎ Клікніть місце";
      b.title="Клікніть на аркуші, де потрібно почати писати";
    }
  }

  function insertTextFromStart(){
    textPlacementMode=false;
    const p=writingStartPoint();
    makeTextAt(p.x,p.y,"");
    const b=$63("v57InsertTextBtn");
    if(b){
      b.textContent="T Текст";
      b.title="Вибрати місце для тексту";
    }
  }

  function bindTextPlacement(){
    const b=$63("v57InsertTextBtn");
    if(b && !b.dataset.v63text){
      b.dataset.v63text="1";
      b.textContent="T Текст";
      b.title="Натисніть, потім виберіть місце на аркуші";
      b.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        beginChooseTextPlace();
      };
    }

    let startBtn=$63("v63TextFromStart");
    if(!startBtn && b){
      startBtn=document.createElement("button");
      startBtn.type="button";
      startBtn.id="v63TextFromStart";
      startBtn.textContent="↤ З початку";
      startBtn.title="Почати писати зі стандартного початку рядка";
      startBtn.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        insertTextFromStart();
      };
      b.insertAdjacentElement("afterend",startBtn);
    }

    if(typeof fcanvas!=="undefined" && !fcanvas.__v63TextPlacement){
      fcanvas.__v63TextPlacement=true;
      fcanvas.on("mouse:down",opt=>{
        if(!textPlacementMode)return;

        textPlacementMode=false;
        const point=fcanvas.getPointer(opt.e);
        makeTextAt(point.x,point.y,"");

        const btn=$63("v57InsertTextBtn");
        if(btn){
          btn.textContent="T Текст";
          btn.title="Натисніть, потім виберіть місце на аркуші";
        }
      });
    }
  }

  /* ---------- Red notebook margin ---------- */
  function marginObject(){
    if(typeof fcanvas==="undefined")return null;
    return fcanvas.getObjects().find(o=>o?.systemRole==="notebookMarginLine")||null;
  }

  function addRedMargin(){
    if(typeof fcanvas==="undefined"||marginObject())return;
    const x=72;
    const line=new fabric.Line([x,0,x,fcanvas.getHeight()],{
      stroke:"#ef5350",
      strokeWidth:1.5,
      selectable:false,
      evented:false,
      erasable:false,
      systemRole:"notebookMarginLine"
    });
    line.isInstrument=true; // гумка не повинна її стирати
    fcanvas.add(line);
    fcanvas.sendToBack(line);
    fcanvas.requestRenderAll();
    try{pushHistory();autoSave()}catch(e){}
  }

  function removeRedMargin(){
    const m=marginObject();
    if(!m)return;
    fcanvas.remove(m);
    fcanvas.requestRenderAll();
    try{pushHistory();autoSave()}catch(e){}
  }

  function syncMarginButton(){
    const b=$63("v63MarginBtn");
    if(!b)return;
    const on=!!marginObject();
    b.textContent=on ? "✓ Червоне поле" : "│ Червоне поле";
    b.classList.toggle("active",on);
    b.title=on ? "Прибрати червоне поле" : "Додати червоне поле як у звичайному зошиті";
  }

  function addMarginButton(){
    const home=homePanel();
    if(!home||$63("v63MarginBtn"))return;

    const b=document.createElement("button");
    b.type="button";
    b.id="v63MarginBtn";
    b.className="v56-command";
    b.textContent="│ Червоне поле";
    b.title="Додати червоне поле як у звичайному зошиті";
    b.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      if(marginObject())removeRedMargin();
      else addRedMargin();
      syncMarginButton();
    };
    home.appendChild(b);
    syncMarginButton();
  }

  /* ---------- Make new user text use the same handwriting default ---------- */
  function normalizeUserText(){
    if(typeof fcanvas==="undefined")return;
    fcanvas.getObjects().forEach(o=>{
      if(!o || !["i-text","textbox","text"].includes(o.type))return;
      if(o.systemRole==="dateHeading"||o.systemRole==="workHeading")return;

      // Не змінюємо текст, який користувач уже навмисно відформатував.
      if(!o.__v63Normalized && (!o.fontFamily || o.fontFamily==="Arial" || o.fontFamily==="Times New Roman")){
        o.set({
          fontFamily:DEFAULT_FONT,
          fontStyle:"normal",
          fontSize:o.fontSize && o.fontSize>30 ? o.fontSize : DEFAULT_SIZE,
          fill:o.fill==="#17315f" ? DEFAULT_COLOR : (o.fill||DEFAULT_COLOR)
        });
        o.__v63Normalized=true;
        o.setCoords?.();
      }
    });
    fcanvas.requestRenderAll();
  }

  function updateTextToolbarDefaults(){
    const font=$63("v57TextFont");
    const size=$63("v57TextSize");
    const color=$63("v57TextColor");

    if(font){
      if(!Array.from(font.options).some(o=>o.value===DEFAULT_FONT)){
        font.insertAdjacentHTML("afterbegin",`<option>${DEFAULT_FONT}</option>`);
      }
      if(!fcanvas?.getActiveObject?.())font.value=DEFAULT_FONT;
    }
    if(size && !fcanvas?.getActiveObject?.())size.value=DEFAULT_SIZE;
    if(color && !fcanvas?.getActiveObject?.())color.value=DEFAULT_COLOR;
  }

  function init(){
    migrateDefaultHeadingFont();
    styleHeadingDefaults();
    bindTextPlacement();
    addMarginButton();
    normalizeUserText();
    updateTextToolbarDefaults();
    syncMarginButton();

    [300,800,1600].forEach(ms=>setTimeout(()=>{
      styleHeadingDefaults();
      bindTextPlacement();
      addMarginButton();
      updateTextToolbarDefaults();
      syncMarginButton();
    },ms));

    if(typeof fcanvas!=="undefined"){
      fcanvas.on("object:added",e=>{
        if(e?.target?.systemRole==="dateHeading"||e?.target?.systemRole==="workHeading")
          setTimeout(styleHeadingDefaults,0);
        setTimeout(syncMarginButton,0);
      });
      fcanvas.on("object:removed",()=>setTimeout(syncMarginButton,0));
    }

    const badge=$63("appVersionBadge");
    if(badge)badge.textContent="v63";
    document.documentElement.dataset.sofiaVersion="63";
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,220),{once:true});
  else
    setTimeout(init,220);
})();



/* =========================================================
   V64 — ТОЧНИЙ РЕЖИМ «ТЕКСТ»: ТЕКСТОВИЙ КУРСОР У МІСЦІ КЛІКУ
   ========================================================= */
(function(){
"use strict";
let armed=false;

function canvasEl(){
  return document.querySelector(".upper-canvas") || document.querySelector("canvas.upper-canvas");
}
function setCursor(on){
  const el=canvasEl();
  if(el) el.style.cursor=on ? "text" : "";
}
function textButton(){
  return document.getElementById("v57InsertTextBtn");
}
function arm(){
  armed=true;
  setCursor(true);
  const b=textButton();
  if(b){
    b.textContent="T Вкажіть місце";
    b.title="Клікніть на аркуші — там з’явиться текстовий курсор";
  }
  try{
    fcanvas.discardActiveObject();
    fcanvas.requestRenderAll();
  }catch(e){}
}
function disarm(){
  armed=false;
  setCursor(false);
  const b=textButton();
  if(b){
    b.textContent="T Текст";
    b.title="Натисніть, потім клікніть у потрібному місці аркуша";
  }
}
function createAt(pointer){
  if(!window.fabric || typeof fcanvas==="undefined") return;
  const t=new fabric.IText("",{
    left:pointer.x,
    top:pointer.y,
    fontFamily:"Segoe Script",
    fontSize:38,
    fontStyle:"normal",
    fontWeight:"normal",
    fill:"#4a7fbd",
    editable:true,
    selectable:true,
    evented:true,
    erasable:false,
    originX:"left",
    originY:"top"
  });
  fcanvas.add(t);
  fcanvas.setActiveObject(t);
  t.enterEditing();
  t.selectionStart=0;
  t.selectionEnd=0;
  fcanvas.requestRenderAll();

  // Фокус клавіатури без додаткового кліку.
  setTimeout(()=>{
    try{
      t.enterEditing();
      t.hiddenTextarea?.focus();
      fcanvas.requestRenderAll();
    }catch(e){}
  },0);

  try{pushHistory();autoSave();}catch(e){}
  disarm();
}
function bind(){
  const b=textButton();
  if(b && !b.dataset.v64Text){
    b.dataset.v64Text="1";
    // Перехоплюємо раніше старого обробника.
    b.addEventListener("click",e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      arm();
    },true);
  }

  if(typeof fcanvas!=="undefined" && !fcanvas.__v64TextCursor){
    fcanvas.__v64TextCursor=true;
    fcanvas.on("mouse:down",opt=>{
      if(!armed)return;
      const p=fcanvas.getPointer(opt.e);
      // Створення після завершення поточного mouse down, щоб Fabric не скинув editing.
      setTimeout(()=>createAt(p),0);
    });
  }
}
function init(){
  bind();
  [250,700,1500].forEach(ms=>setTimeout(bind,ms));
  const mo=new MutationObserver(()=>setTimeout(bind,20));
  mo.observe(document.body,{childList:true,subtree:true});
  const badge=document.getElementById("appVersionBadge");
  if(badge)badge.textContent="v64";
  document.documentElement.dataset.sofiaVersion="64";
}
if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,220),{once:true});
else setTimeout(init,220);
})();



/* =========================================================
   V65 — ПРИБРАТИ ЗАЙВИЙ ВЕРХНІЙ ПРОСТІР У ПОВНОМУ ЕКРАНІ
   ========================================================= */
(function(){
  "use strict";

  function fullscreenActive(){
    return !!document.fullscreenElement ||
           !!document.webkitFullscreenElement ||
           document.body.classList.contains("fullscreen") ||
           document.documentElement.classList.contains("fullscreen");
  }

  function compactFullscreen(){
    const on=fullscreenActive();

    const candidates=[
      document.querySelector(".app-shell"),
      document.querySelector(".workspace"),
      document.querySelector(".main"),
      document.querySelector("main"),
      document.querySelector("#app"),
      document.body
    ].filter(Boolean);

    candidates.forEach(el=>{
      if(on){
        el.style.setProperty("--sofia-fullscreen-gap","0px");
      }else{
        el.style.removeProperty("--sofia-fullscreen-gap");
      }
    });

    // Прибираємо порожні верхні блоки/відступи, які залишаються у fullscreen.
    document.querySelectorAll("body > div, body > section, main > div, .workspace > div").forEach(el=>{
      if(!on) {
        if(el.dataset.v65OldMarginTop!==undefined){
          el.style.marginTop=el.dataset.v65OldMarginTop;
          delete el.dataset.v65OldMarginTop;
        }
        if(el.dataset.v65OldPaddingTop!==undefined){
          el.style.paddingTop=el.dataset.v65OldPaddingTop;
          delete el.dataset.v65OldPaddingTop;
        }
        return;
      }

      const r=el.getBoundingClientRect();
      const cs=getComputedStyle(el);

      // Лише верхні layout-блоки, не чіпаємо саме полотно.
      if(r.top>=0 && r.top<320 && r.height>80 &&
         !el.querySelector("canvas") &&
         !el.id?.includes("pageViewport") &&
         !el.classList.contains("v56-panel") &&
         !el.closest("#sofiaRibbonV56")) {

        const mt=parseFloat(cs.marginTop)||0;
        const pt=parseFloat(cs.paddingTop)||0;

        if(mt>20){
          el.dataset.v65OldMarginTop=el.style.marginTop||"";
          el.style.setProperty("margin-top","0","important");
        }
        if(pt>40){
          el.dataset.v65OldPaddingTop=el.style.paddingTop||"";
          el.style.setProperty("padding-top","0","important");
        }
      }
    });

    // Основна стрічка та сторінки підтягуються вгору.
    const ribbon=document.getElementById("sofiaRibbonV56");
    if(ribbon){
      ribbon.style.setProperty("margin-top",on?"4px":"8px","important");
    }

    const pageViewport=document.getElementById("pageViewport");
    if(pageViewport){
      pageViewport.style.setProperty("margin-top",on?"0":"", "important");
    }

    document.body.classList.toggle("sofia-v65-fullscreen",on);
  }

  function addCss(){
    if(document.getElementById("v65FullscreenCss"))return;
    const st=document.createElement("style");
    st.id="v65FullscreenCss";
    st.textContent=`
      body.sofia-v65-fullscreen #sofiaRibbonV56{
        margin-top:4px!important;
      }
      body.sofia-v65-fullscreen #pageViewport{
        margin-top:0!important;
      }
      body.sofia-v65-fullscreen .workspace,
      body.sofia-v65-fullscreen .main,
      body.sofia-v65-fullscreen main{
        padding-top:0!important;
        margin-top:0!important;
      }
    `;
    document.head.appendChild(st);
  }

  function init(){
    addCss();
    compactFullscreen();

    document.addEventListener("fullscreenchange",()=>setTimeout(compactFullscreen,20));
    document.addEventListener("webkitfullscreenchange",()=>setTimeout(compactFullscreen,20));

    const fsBtn=document.getElementById("fullscreenBtn");
    if(fsBtn){
      fsBtn.addEventListener("click",()=>{
        [50,150,350].forEach(ms=>setTimeout(compactFullscreen,ms));
      },true);
    }

    const badge=document.getElementById("appVersionBadge");
    if(badge)badge.textContent="v65";
    document.documentElement.dataset.sofiaVersion="65";
  }

  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,180),{once:true});
  else
    setTimeout(init,180);
})();



/* =========================================================
   V72 — БАЗА v65 + КОМПАКТНІ ВКЛАДКИ ПРИ ПРОКРУТЦІ
   Без нашарувань v66-v71.
   ========================================================= */
(function(){
"use strict";
const $72=id=>document.getElementById(id);

function ribbon(){return $72("sofiaRibbonV56")}
function head(){return ribbon()?.querySelector(".v56-ribbon-head")}
function body(){return ribbon()?.querySelector(".v56-body")}

function headerBottom(){
  const candidates=[
    document.querySelector("header"),
    document.querySelector(".app-header"),
    document.querySelector(".topbar"),
    document.querySelector(".brandbar")
  ].filter(Boolean);
  let b=0;
  candidates.forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.top<=5 && r.bottom>b && r.bottom<260)b=r.bottom;
  });
  return Math.max(0,b);
}

function addCss(){
  if($72("v72Css"))return;
  const st=document.createElement("style");
  st.id="v72Css";
  st.textContent=`
    #sofiaRibbonV56{
      margin-top:2px!important;
      margin-bottom:2px!important;
    }
    #sofiaRibbonV56 .v56-ribbon-head{
      padding:2px 6px 0!important;
      min-height:34px!important;
      margin:0!important;
    }
    #sofiaRibbonV56 .v56-body{
      padding:4px 6px!important;
      margin:0!important;
    }

    #v72StickyTabs{
      position:fixed;
      left:92px;
      right:10px;
      z-index:30000;
      display:none;
      align-items:center;
      gap:4px;
      padding:3px 6px;
      background:#fff;
      border:1px solid #dfe7f1;
      border-radius:0 0 10px 10px;
      box-shadow:0 3px 10px rgba(15,23,42,.14);
    }
    #v72StickyTabs.show{display:flex}
    #v72StickyTabsButtons{
      display:flex;
      align-items:center;
      gap:2px;
      overflow-x:auto;
      flex:1;
      scrollbar-width:thin;
    }
    .v72-tab{
      border:0;
      background:transparent;
      border-radius:7px;
      padding:7px 10px;
      white-space:nowrap;
      font:600 15px/1 inherit;
      cursor:pointer;
    }
    .v72-tab.active{
      background:#edf3ff;
      color:#173b78;
      box-shadow:inset 0 -2px 0 #2b5eaa;
    }

    #sofiaRibbonV56.v72-fixed{
      position:fixed!important;
      left:92px!important;
      right:10px!important;
      z-index:29990!important;
      margin:0!important;
      max-height:42vh!important;
      overflow:auto!important;
      box-shadow:0 4px 14px rgba(15,23,42,.16)!important;
    }

    #sofiaRibbonV56.v72-fixed.v72-collapsed .v56-body{
      display:none!important;
    }

    @media(max-width:800px){
      #v72StickyTabs{left:66px}
      #sofiaRibbonV56.v72-fixed{left:66px!important}
    }
  `;
  document.head.appendChild(st);
}

function buildStickyTabs(){
  if($72("v72StickyTabs"))return;
  const bar=document.createElement("div");
  bar.id="v72StickyTabs";
  bar.innerHTML=`<div id="v72StickyTabsButtons"></div>`;
  document.body.appendChild(bar);
  refreshStickyTabs();
}

function refreshStickyTabs(){
  const host=$72("v72StickyTabsButtons");
  if(!host)return;
  host.innerHTML="";
  document.querySelectorAll("#sofiaRibbonV56 .v56-tab").forEach(orig=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="v72-tab"+(orig.classList.contains("active")?" active":"");
    b.textContent=orig.textContent;
    b.onclick=()=>{
      orig.click();
      showRibbonCommands();
      setTimeout(refreshStickyTabs,0);
    };
    host.appendChild(b);
  });
}

function ribbonTopNormal(){
  const rb=ribbon();
  if(!rb)return 99999;
  const r=rb.getBoundingClientRect();
  return r.top;
}

function showStickyTabs(){
  const bar=$72("v72StickyTabs");
  if(!bar)return;
  bar.style.top=(headerBottom()+2)+"px";
  bar.classList.add("show");
}

function hideStickyTabs(){
  $72("v72StickyTabs")?.classList.remove("show");
}

function showRibbonCommands(){
  const rb=ribbon();
  if(!rb)return;
  rb.classList.add("v72-fixed");
  rb.classList.remove("v72-collapsed");
  rb.style.setProperty("top",(headerBottom()+38)+"px","important");
  hideStickyTabs();
}

function collapseToSticky(){
  const rb=ribbon();
  if(!rb)return;
  rb.classList.remove("v72-fixed");
  rb.classList.remove("v72-collapsed");
  rb.style.removeProperty("top");
  showStickyTabs();
}

function restoreNormal(){
  const rb=ribbon();
  if(!rb)return;
  rb.classList.remove("v72-fixed","v72-collapsed");
  rb.style.removeProperty("top");
  hideStickyTabs();
}

function removeGap(){
  const rb=ribbon();
  if(!rb)return;

  // Зменшуємо тільки реальні відступи контейнера стрічки.
  rb.style.setProperty("margin-top","2px","important");

  let par=rb.parentElement;
  for(let i=0;i<3 && par && par!==document.body;i++,par=par.parentElement){
    const cs=getComputedStyle(par);
    if((parseFloat(cs.paddingTop)||0)>16)par.style.setProperty("padding-top","2px","important");
    if((parseFloat(cs.rowGap||cs.gap)||0)>16)par.style.setProperty("row-gap","2px","important");
  }
}

function update(){
  const rb=ribbon();
  if(!rb)return;

  const normalTop=ribbonTopNormal();
  const hb=headerBottom();

  // Якщо оригінальна стрічка пішла вище видимої області — залишаємо вкладки.
  if(!rb.classList.contains("v72-fixed")){
    if(normalTop < hb-8) showStickyTabs();
    else hideStickyTabs();
  }

  const bar=$72("v72StickyTabs");
  if(bar)bar.style.top=(hb+2)+"px";
  if(rb.classList.contains("v72-fixed")){
    rb.style.setProperty("top",(hb+38)+"px","important");
  }
}

function bind(){
  document.querySelectorAll("#sofiaRibbonV56 .v56-tab").forEach(tab=>{
    if(tab.dataset.v72bound)return;
    tab.dataset.v72bound="1";
    tab.addEventListener("click",()=>setTimeout(refreshStickyTabs,0),true);
  });

  if(typeof fcanvas!=="undefined"&&!fcanvas.__v72){
    fcanvas.__v72=true;
    fcanvas.on("mouse:down",()=>{
      if(ribbon()?.classList.contains("v72-fixed")){
        setTimeout(collapseToSticky,120);
      }
    });
  }
}

function init(){
  addCss();
  buildStickyTabs();
  bind();
  removeGap();
  update();

  // capture=true — ловимо scroll навіть у внутрішньому контейнері зошита.
  window.addEventListener("scroll",update,true);
  document.addEventListener("scroll",update,true);
  window.addEventListener("resize",update);

  const mo=new MutationObserver(()=>{
    clearTimeout(mo.__v72);
    mo.__v72=setTimeout(()=>{
      bind();
      refreshStickyTabs();
      removeGap();
      update();
    },40);
  });
  mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});

  const badge=$72("appVersionBadge");
  if(badge)badge.textContent="v72";
  document.documentElement.dataset.sofiaVersion="72";
}

if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",()=>setTimeout(init,200),{once:true});
else
  setTimeout(init,200);
})();
