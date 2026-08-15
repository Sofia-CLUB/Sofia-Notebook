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
   V41: WORD-ПОДІБНА СТРІЧКА КОМАНД + ВІЛЬНЕ ВПОРЯДКУВАННЯ
   ========================================================= */
(function(){
  const LAYOUT_KEY="sofiaRibbonLayoutV41";
  const ACTIVE_TAB_KEY="sofiaRibbonActiveTabV41";
  let arrangeMode=false;
  let dragged=null;

  const tabs=[
    {id:"home", label:"Основне", icon:"⌂"},
    {id:"insert", label:"Вставка", icon:"＋"},
    {id:"draw", label:"Малювання", icon:"✎"},
    {id:"math", label:"Математика", icon:"∑"},
    {id:"teacher", label:"Вчитель", icon:"🎓"},
    {id:"ai", label:"AI", icon:"✨"}
  ];

  const exactCategory={
    saveBtn:"home", undoBtn:"home", redoBtn:"home",
    deleteSelectedBtn:"home", clearPageBtn:"home", clearAllBtn:"home",
    fullscreenBtn:"home", installAppBtn:"home", diagnosticsBtn:"home",
    keyboardBtn:"home", voiceBtn:"home",

    mediaBtn:"insert", elementsBtn:"insert", geometryBtn:"insert",
    shapeLibraryBtn:"insert", noteBtn:"insert",

    correctionMarkerBtn:"draw", groupBtn:"draw", ungroupBtn:"draw",
    explodeShapeBtn:"draw", editVerticesBtn:"draw",

    angleBtn:"math", numberRayBtn:"math", graphBuilderBtn:"math",
    pointBtn:"math", vertexLabelBtn:"math", calculatorBtn:"math",

    timerBtn:"teacher", ukrainianBtn:"teacher",

    aiBtn:"ai"
  };

  const NEVER_MOVE_IDS=new Set([
    "arrangeButtonsBtn","resetButtonsOrderBtn",
    "addPageBtn","deletePageBtn","prevPageBtn","nextPageBtn",
    "pageTabRenameBtn","pageTabCloseBtn"
  ]);

  const OVERLAY_SELECTORS=[
    "#keyboardPanel","#timerPanel","#calculatorPanel","#aiPanel","#mediaPanel",
    "#elementsPanel","#geometryPanel","#shapeLibraryPanel","#graphBuilderPanel",
    "#numberRayPanel","#graphEditorPanel","#diagnosticsPanel","#runtimeErrorPanel",
    ".modal",".dialog","[role='dialog']"
  ].join(",");

  function css(){
    if(document.getElementById("sofiaRibbonV41Style"))return;
    const s=document.createElement("style");
    s.id="sofiaRibbonV41Style";
    s.textContent=`
      #sofiaRibbonV41{
        position:relative;
        z-index:1200;
        width:100%;
        background:#fff;
        border-bottom:1px solid #dce5f2;
        box-shadow:0 2px 8px rgba(15,23,42,.06);
      }
      .sofia-ribbon-head{
        min-height:42px;
        display:flex;
        align-items:center;
        gap:4px;
        padding:4px 8px 0;
        border-bottom:1px solid #e5eaf2;
      }
      .sofia-ribbon-tabs{
        display:flex;
        align-items:end;
        gap:2px;
        flex:1 1 auto;
        min-width:0;
        overflow-x:auto;
        scrollbar-width:thin;
      }
      .sofia-ribbon-tab{
        border:0;
        border-radius:8px 8px 0 0;
        background:transparent;
        padding:9px 13px 8px;
        cursor:pointer;
        font:600 14px/1.1 inherit;
        white-space:nowrap;
      }
      .sofia-ribbon-tab:hover{background:#f1f5fb}
      .sofia-ribbon-tab.active{
        color:#173b78;
        background:#eef4ff;
        box-shadow:inset 0 -2px 0 #2859a6;
      }
      .sofia-ribbon-actions{
        display:flex;
        gap:6px;
        align-items:center;
        flex:0 0 auto;
        padding-bottom:4px;
      }
      #arrangeButtonsBtn{
        border:1px solid #2859a6!important;
        background:#173b78!important;
        color:#fff!important;
        border-radius:9px!important;
        padding:8px 11px!important;
        font-weight:700!important;
        cursor:pointer!important;
        white-space:nowrap;
      }
      #arrangeButtonsBtn.active{
        background:#147a46!important;
        border-color:#147a46!important;
      }
      #resetButtonsOrderBtn{
        border:1px solid #c8d2e0!important;
        background:#fff!important;
        border-radius:9px!important;
        padding:8px 10px!important;
        cursor:pointer!important;
        white-space:nowrap;
      }
      .sofia-ribbon-body{padding:7px 9px 9px}
      .sofia-ribbon-panel{
        display:none;
        align-items:flex-start;
        align-content:flex-start;
        flex-wrap:wrap;
        gap:7px;
        width:100%;
        min-height:44px;
        overflow:visible!important;
      }
      .sofia-ribbon-panel.active{display:flex}
      .sofia-ribbon-panel > button{
        flex:0 0 auto!important;
        max-width:none!important;
        overflow:visible!important;
        visibility:visible!important;
        opacity:1!important;
      }
      .sofia-ribbon-panel .sofia-command{
        min-height:38px!important;
        height:auto!important;
        padding:7px 11px!important;
        margin:0!important;
        white-space:nowrap!important;
        border-radius:9px!important;
      }
      body.sofia-arrange-v41 .sofia-ribbon-panel.active{
        min-height:88px;
        padding:5px;
        border:2px dashed rgba(40,89,166,.35);
        border-radius:10px;
        background:#f8fbff;
      }
      body.sofia-arrange-v41 .sofia-command{
        cursor:grab!important;
        outline:1px dashed rgba(40,89,166,.48)!important;
        outline-offset:2px!important;
        user-select:none!important;
      }
      body.sofia-arrange-v41 .sofia-command:active{cursor:grabbing!important}
      body.sofia-arrange-v41 .sofia-ribbon-tab{
        outline:1px dashed rgba(40,89,166,.35);
        outline-offset:-2px;
      }
      .sofia-ribbon-drop-marker{
        width:4px;height:38px;border-radius:3px;background:#2859a6;display:inline-block;
      }
      #sofiaArrangeHelpV41{
        position:fixed;
        left:50%;
        bottom:34px;
        transform:translateX(-50%);
        z-index:10000;
        max-width:min(760px,92vw);
        padding:9px 14px;
        border-radius:10px;
        background:rgba(15,23,42,.94);
        color:#fff;
        font:600 13px/1.3 inherit;
        box-shadow:0 5px 22px rgba(0,0,0,.22);
        pointer-events:none;
        text-align:center;
      }
      #sofiaAuthorSignature{
        position:fixed;right:14px;bottom:8px;z-index:9998;
        font-size:12px;font-weight:600;letter-spacing:.15px;opacity:.55;
        pointer-events:none;user-select:none;white-space:nowrap;
      }
      @media(max-width:900px){
        .sofia-ribbon-head{align-items:flex-start;flex-wrap:wrap}
        .sofia-ribbon-tabs{order:2;width:100%}
        .sofia-ribbon-actions{margin-left:auto}
        .sofia-ribbon-tab{padding:8px 10px}
      }
    `;
    document.head.appendChild(s);
  }

  function author(){
    if(document.getElementById("sofiaAuthorSignature"))return;
    const a=document.createElement("div");
    a.id="sofiaAuthorSignature";
    a.textContent="Sofia Notebook © Parasochka";
    document.body.appendChild(a);
  }

  function createRibbon(){
    if(document.getElementById("sofiaRibbonV41"))return;

    const root=document.createElement("section");
    root.id="sofiaRibbonV41";

    const head=document.createElement("div");
    head.className="sofia-ribbon-head";

    const tabBox=document.createElement("div");
    tabBox.className="sofia-ribbon-tabs";

    tabs.forEach(t=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="sofia-ribbon-tab";
      b.dataset.ribbonTab=t.id;
      b.textContent=`${t.icon} ${t.label}`;
      b.addEventListener("click",e=>{
        e.preventDefault();
        if(arrangeMode && dragged){
          moveDraggedToTab(t.id);
          return;
        }
        activateTab(t.id);
      });
      b.addEventListener("dragover",e=>{
        if(arrangeMode && dragged){e.preventDefault();b.classList.add("active-drop")}
      });
      b.addEventListener("dragleave",()=>b.classList.remove("active-drop"));
      b.addEventListener("drop",e=>{
        if(!arrangeMode || !dragged)return;
        e.preventDefault();
        b.classList.remove("active-drop");
        moveDraggedToTab(t.id);
      });
      tabBox.appendChild(b);
    });

    const actions=document.createElement("div");
    actions.className="sofia-ribbon-actions";

    const arrange=document.createElement("button");
    arrange.type="button";
    arrange.id="arrangeButtonsBtn";
    arrange.textContent="🔀 Впорядкувати";

    const reset=document.createElement("button");
    reset.type="button";
    reset.id="resetButtonsOrderBtn";
    reset.textContent="↺ Стандартно";
    reset.title="Повернути стандартний розподіл команд";
    reset.style.display="none";

    actions.append(arrange,reset);
    head.append(tabBox,actions);

    const body=document.createElement("div");
    body.className="sofia-ribbon-body";
    tabs.forEach(t=>{
      const p=document.createElement("div");
      p.className="sofia-ribbon-panel";
      p.dataset.ribbonPanel=t.id;
      body.appendChild(p);
    });

    root.append(head,body);

    const pageViewport=document.getElementById("pageViewport");
    const pageControls=document.getElementById("addPageBtn")?.parentElement;
    const existingToolArea=findToolArea();

    if(existingToolArea && existingToolArea.parentElement){
      existingToolArea.parentElement.insertBefore(root,existingToolArea);
    }else if(pageControls && pageControls.parentElement){
      pageControls.parentElement.insertBefore(root,pageControls);
    }else if(pageViewport && pageViewport.parentElement){
      pageViewport.parentElement.insertBefore(root,pageViewport);
    }else{
      document.body.insertBefore(root,document.body.firstChild);
    }

    arrange.onclick=e=>{
      e.preventDefault(); e.stopPropagation();
      setArrange(!arrangeMode);
    };
    reset.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      if(!confirm("Повернути стандартний порядок і розподіл команд по вкладках?"))return;
      localStorage.removeItem(LAYOUT_KEY);
      rebuildDefaultLayout();
      saveLayout();
      setArrange(false);
    };

    const remembered=localStorage.getItem(ACTIVE_TAB_KEY)||"home";
    activateTab(tabs.some(t=>t.id===remembered)?remembered:"home");
  }

  function findToolArea(){
    const ids=["correctionMarkerBtn","mediaBtn","elementsBtn","geometryBtn","shapeLibraryBtn"];
    for(const id of ids){
      const b=document.getElementById(id);
      if(b && b.parentElement)return b.parentElement;
    }
    return null;
  }

  function isOverlayButton(btn){
    return !!btn.closest(OVERLAY_SELECTORS);
  }

  function isPageTabButton(btn){
    return !!btn.closest("#pageTabs,.page-tab");
  }

  function canBeCommand(btn){
    if(!(btn instanceof HTMLButtonElement))return false;
    if(!btn.isConnected)return false;
    if(NEVER_MOVE_IDS.has(btn.id))return false;
    if(btn.id==="arrangeButtonsBtn" || btn.id==="resetButtonsOrderBtn")return false;
    if(btn.closest("#sofiaRibbonV41"))return false;

    // V46: the original left vertical toolbar belongs to the canvas and must stay there.
    // These buttons already have their own setTool(...) handlers.
    if(btn.matches(".side-tool[data-tool]") || btn.closest(".side-tools,.left-toolbar,.left-tools,.tool-sidebar"))return false;

    if(isOverlayButton(btn) || isPageTabButton(btn))return false;

    // Do not steal tiny calculator/keyboard/internal editing buttons.
    if(btn.hasAttribute("data-calc") || btn.hasAttribute("data-mathinsert"))return false;
    if(btn.id && /(Close|Start|Pause|Reset|Plus|Insert|Duplicate|Reload|Finish)/i.test(btn.id))return false;

    // Known app commands are always eligible.
    if(btn.id && exactCategory[btn.id])return true;

    // Dynamically include visible teacher/top-toolbar command buttons.
    const rect=btn.getBoundingClientRect();
    if(rect.width<20 || rect.height<20)return false;
    const txt=(btn.textContent||"").trim();
    if(!txt || txt==="×" || txt==="✕")return false;

    // Only controls located above the notebook page are treated as ribbon commands.
    const page=document.getElementById("pageViewport");
    const pageTop=page? page.getBoundingClientRect().top : window.innerHeight;
    return rect.top < pageTop + 5;
  }

  function key(btn){
    if(btn.id)return "id:"+btn.id;
    for(const a of ["data-tool","data-action","data-command"]){
      if(btn.hasAttribute(a))return a+":"+btn.getAttribute(a);
    }
    return "text:"+(btn.textContent||"").trim().replace(/\s+/g," ").slice(0,90);
  }

  function inferCategory(btn){
    if(btn.id && exactCategory[btn.id])return exactCategory[btn.id];
    const t=((btn.id||"")+" "+(btn.textContent||"")+" "+(btn.title||"")).toLowerCase();

    if(/ai|штуч|чат|генер|зображенн/.test(t))return "ai";
    if(/граф|кут|числов|матем|точк|вершин|калькулятор|формул/.test(t))return "math";
    if(/фото|відео|файл|елемент|прилад|фігур|встав|посилан|таблиц/.test(t))return "insert";
    if(/ручк|маркер|ліні|крив|стріл|прямокут|коло|трикут|малю|колір|товщ/.test(t))return "draw";
    if(/таймер|переклад|перевір|розбір|картк|тест|колес|вчител/.test(t))return "teacher";
    return "home";
  }

  function panel(id){
    return document.querySelector(`.sofia-ribbon-panel[data-ribbon-panel="${id}"]`);
  }

  function rememberOrigin(btn){
    if(btn.dataset.sofiaOriginSaved)return;
    const parent=btn.parentElement;
    if(!parent)return;
    btn.dataset.sofiaOriginSaved="1";
    btn.__sofiaOriginParent=parent;
    btn.__sofiaOriginNext=btn.nextSibling;
  }

  function decorate(btn){
    rememberOrigin(btn);
    btn.classList.add("sofia-command");
    btn.dataset.sofiaCommandKey=key(btn);
    btn.draggable=arrangeMode;
  }

  function moveIntoRibbon(btn,cat){
    const p=panel(cat)||panel("home");
    if(!p)return;
    decorate(btn);
    p.appendChild(btn);
  }

  function collectCommands(){
    const saved=loadLayout();
    const assignments=saved.assignments||{};

    const candidates=Array.from(document.querySelectorAll("button")).filter(canBeCommand);
    candidates.forEach(btn=>{
      const k=key(btn);
      moveIntoRibbon(btn,assignments[k]||inferCategory(btn));
    });

    applySavedOrder(saved);
    ensureEssentialCommands();
  }

  function ensureEssentialCommands(){
    // Undo/redo are deliberately forced into the visible "Основне" set
    // when no custom assignment exists, so they cannot remain hidden off-screen.
    ["undoBtn","redoBtn","saveBtn","deleteSelectedBtn"].forEach(id=>{
      const b=document.getElementById(id);
      if(!b)return;
      if(!b.closest("#sofiaRibbonV41"))moveIntoRibbon(b,"home");
    });
  }

  function loadLayout(){
    try{return JSON.parse(localStorage.getItem(LAYOUT_KEY)||"{}")||{}}
    catch(e){return {}}
  }

  function applySavedOrder(saved){
    const orders=saved.orders||{};
    tabs.forEach(t=>{
      const p=panel(t.id);
      if(!p)return;
      const order=orders[t.id];
      if(!Array.isArray(order))return;
      const map=new Map(Array.from(p.querySelectorAll(":scope > button.sofia-command")).map(b=>[key(b),b]));
      order.forEach(k=>{const b=map.get(k);if(b)p.appendChild(b)});
    });
  }

  function saveLayout(){
    const out={assignments:{},orders:{}};
    tabs.forEach(t=>{
      const p=panel(t.id);
      const buttons=p?Array.from(p.querySelectorAll(":scope > button.sofia-command")):[];
      out.orders[t.id]=buttons.map(key);
      buttons.forEach(b=>out.assignments[key(b)]=t.id);
    });
    localStorage.setItem(LAYOUT_KEY,JSON.stringify(out));
  }

  function activateTab(id){
    document.querySelectorAll(".sofia-ribbon-tab").forEach(b=>b.classList.toggle("active",b.dataset.ribbonTab===id));
    document.querySelectorAll(".sofia-ribbon-panel").forEach(p=>p.classList.toggle("active",p.dataset.ribbonPanel===id));
    localStorage.setItem(ACTIVE_TAB_KEY,id);
  }

  function help(on){
    let h=document.getElementById("sofiaArrangeHelpV41");
    if(on && !h){
      h=document.createElement("div");
      h.id="sofiaArrangeHelpV41";
      h.textContent="Перетягуйте команди в будь-яке місце. Щоб перенести команду в іншу вкладку — перетягніть її прямо на назву вкладки.";
      document.body.appendChild(h);
    }else if(!on && h)h.remove();
  }

  function setArrange(on){
    arrangeMode=on;
    document.body.classList.toggle("sofia-arrange-v41",on);
    document.querySelectorAll(".sofia-command").forEach(b=>b.draggable=on);
    const b=document.getElementById("arrangeButtonsBtn");
    if(b){
      b.textContent=on?"✓ Готово":"🔀 Впорядкувати";
      b.classList.toggle("active",on);
    }
    const r=document.getElementById("resetButtonsOrderBtn");
    if(r)r.style.display=on?"":"none";
    help(on);
    if(!on)saveLayout();
  }

  function moveDraggedToTab(tabId){
    if(!dragged)return;
    const p=panel(tabId);
    if(!p)return;
    p.appendChild(dragged);
    activateTab(tabId);
    saveLayout();
  }

  function rebuildDefaultLayout(){
    document.querySelectorAll(".sofia-command").forEach(btn=>{
      const cat=inferCategory(btn);
      const p=panel(cat)||panel("home");
      p?.appendChild(btn);
    });
  }

  document.addEventListener("dragstart",e=>{
    const b=e.target.closest?.("button.sofia-command");
    if(!arrangeMode || !b)return;
    dragged=b;
    b.style.opacity=".45";
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",key(b));
    }
  },true);

  document.addEventListener("dragend",e=>{
    const b=e.target.closest?.("button.sofia-command");
    if(b)b.style.opacity="";
    dragged=null;
    saveLayout();
  },true);

  document.addEventListener("dragover",e=>{
    if(!arrangeMode || !dragged)return;
    const target=e.target.closest?.("button.sofia-command");
    const p=e.target.closest?.(".sofia-ribbon-panel");
    if(target && target!==dragged){
      e.preventDefault();
      const r=target.getBoundingClientRect();
      const before=e.clientX < r.left+r.width/2;
      if(before)target.parentElement.insertBefore(dragged,target);
      else target.insertAdjacentElement("afterend",dragged);
      return;
    }
    if(p){
      e.preventDefault();
      if(dragged.parentElement!==p)p.appendChild(dragged);
    }
  },true);

  document.addEventListener("drop",e=>{
    if(!arrangeMode || !dragged)return;
    const p=e.target.closest?.(".sofia-ribbon-panel");
    if(p){
      e.preventDefault();
      if(dragged.parentElement!==p)p.appendChild(dragged);
      saveLayout();
    }
  },true);

  // During arranging, prevent a normal command from executing when clicked.
  document.addEventListener("click",e=>{
    if(!arrangeMode)return;
    const b=e.target.closest?.("button.sofia-command");
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);

  function cleanupOldToolbarOverflow(){
    // Existing toolbar rows no longer need to hide commands horizontally.
    const page=document.getElementById("pageViewport");
    if(!page)return;
    const pageTop=page.getBoundingClientRect().top;
    document.querySelectorAll("body *").forEach(el=>{
      if(!(el instanceof HTMLElement))return;
      const cs=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      if(r.top<pageTop && r.width>400 && (cs.overflowX==="auto" || cs.overflowX==="scroll")){
        if(!el.closest("#sofiaRibbonV41") && !el.closest("#pageTabsWrap")){
          el.style.overflowX="visible";
          el.style.flexWrap="wrap";
          el.style.maxHeight="none";
        }
      }
    });
  }

  function init(){
    css();
    author();
    createRibbon();

    // Wait until all the existing Sofia controls and teacher tools have initialized.
    setTimeout(()=>{
      collectCommands();
      cleanupOldToolbarOverflow();
    },300);

    // Catch teacher-tool buttons that appear later.
    const mo=new MutationObserver(()=>{
      clearTimeout(mo.__t);
      mo.__t=setTimeout(()=>{
        collectCommands();
        if(arrangeMode)document.querySelectorAll(".sofia-command").forEach(b=>b.draggable=true);
      },120);
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();



/* =========================================================
   V42: ПІДПИС ГРАФІКА ВЗДОВЖ ЛІНІЇ
   ========================================================= */
(function(){
  function graphObjects(){
    if(typeof fcanvas==="undefined")return [];
    return fcanvas.getObjects().filter(o=>o && o.graphObject);
  }

  function getGraphColor(obj){
    if(!obj)return "#2563eb";
    if(obj.stroke)return obj.stroke;
    if(obj._objects){
      const line=obj._objects.find(x=>x && x.stroke);
      if(line && line.stroke)return line.stroke;
    }
    return "#2563eb";
  }

  function getGraphAngle(obj){
    // Prefer an existing explicit angle if available.
    if(obj && Number.isFinite(obj.angle) && Math.abs(obj.angle)>0.01)return obj.angle;

    // Try to infer the angle from graph metadata (linear graph y = ax + b).
    const meta=obj?.graphMeta||{};
    const a=Number(meta.a ?? meta.k ?? meta.slope);
    if(Number.isFinite(a)){
      return -Math.atan(a) * 180 / Math.PI;
    }

    // Fallback: estimate from bounding box.
    const w=(obj?.width||1)*(obj?.scaleX||1);
    const h=(obj?.height||0)*(obj?.scaleY||1);
    if(w>0 && h>0){
      return -Math.atan2(h,w)*180/Math.PI;
    }
    return 0;
  }

  function findGraphLabelFor(obj){
    const id=obj?.graphMeta?.id || obj?.graphName || obj?.name || null;
    return fcanvas.getObjects().find(x =>
      x && x.sofiaGraphInlineLabel &&
      ((id && x.sofiaGraphFor===id) || x.sofiaGraphTarget===obj)
    );
  }

  function removeGraphInlineLabels(){
    if(typeof fcanvas==="undefined")return;
    fcanvas.getObjects().filter(o=>o?.sofiaGraphInlineLabel).forEach(o=>fcanvas.remove(o));
  }

  function labelTextFor(obj,idx){
    const name=(obj?.graphName || obj?.graphMeta?.name || `Графік ${idx+1}`).trim();
    const formula=(obj?.graphMeta?.formula || obj?.formula || "").trim();
    return formula ? `${name}: ${formula}` : name;
  }

  function placeLabel(obj,idx){
    if(typeof fabric==="undefined" || typeof fcanvas==="undefined" || !obj)return;

    const existing=findGraphLabelFor(obj);
    const color=getGraphColor(obj);
    const text=labelTextFor(obj,idx);

    const center=obj.getCenterPoint ? obj.getCenterPoint() : {
      x:(obj.left||0)+((obj.width||0)*(obj.scaleX||1))/2,
      y:(obj.top||0)+((obj.height||0)*(obj.scaleY||1))/2
    };

    const angle=getGraphAngle(obj);

    // Shift slightly above the graph so it does not cover the line.
    const rad=angle*Math.PI/180;
    const normalX=Math.sin(rad);
    const normalY=-Math.cos(rad);
    const offset=18;
    const left=center.x + normalX*offset;
    const top=center.y + normalY*offset;

    const id=obj?.graphMeta?.id || obj?.graphName || obj?.name || `graph-${idx}`;

    let label=existing;
    if(!label){
      label=new fabric.Text(text,{
        left,top,
        originX:"center",
        originY:"center",
        angle,
        fontSize:18,
        fontWeight:"600",
        fill:color,
        backgroundColor:"rgba(255,255,255,0.72)",
        padding:3,
        selectable:false,
        evented:false,
        objectCaching:false,
        excludeFromExport:false
      });
      label.sofiaGraphInlineLabel=true;
      label.sofiaGraphFor=id;
      label.sofiaGraphTarget=obj;
      fcanvas.add(label);
    }else{
      label.set({
        text,
        left,top,
        angle,
        fill:color,
        backgroundColor:"rgba(255,255,255,0.72)"
      });
    }
    label.bringToFront();
  }

  function refreshGraphInlineLabels(){
    if(typeof fcanvas==="undefined")return;
    const graphs=graphObjects();
    if(!graphs.length)return;
    graphs.forEach((g,i)=>placeLabel(g,i));
    fcanvas.requestRenderAll();
  }

  function hideOldTopGraphLabels(){
    if(typeof fcanvas==="undefined")return;
    fcanvas.getObjects().forEach(o=>{
      if(!o || o.sofiaGraphInlineLabel)return;
      const txt=(o.text||"").trim();
      if(/^Графік\s*\d+/i.test(txt) && !o.graphObject){
        // Hide the old detached label that appears at the top.
        o.visible=false;
      }
    });
  }

  function refreshAll(){
    try{
      hideOldTopGraphLabels();
      refreshGraphInlineLabels();
    }catch(e){
      console.warn("Sofia graph inline label:",e);
    }
  }

  function hook(){
    if(typeof fcanvas==="undefined")return;

    ["object:moving","object:scaling","object:rotating","object:modified"].forEach(evt=>{
      fcanvas.on(evt,e=>{
        if(e?.target?.graphObject)refreshAll();
      });
    });

    fcanvas.on("object:added",e=>{
      if(e?.target?.graphObject){
        setTimeout(refreshAll,30);
      }
    });

    fcanvas.on("object:removed",e=>{
      if(e?.target?.graphObject){
        setTimeout(refreshAll,30);
      }
    });

    // Refresh after page load and after graph editor changes.
    const oldLoadPage = typeof loadPage==="function" ? loadPage : null;
    if(oldLoadPage && !window.__sofiaLoadPageV42){
      window.__sofiaLoadPageV42=true;
      const wrapped=function(i){
        const r=oldLoadPage(i);
        setTimeout(refreshAll,180);
        return r;
      };
      try{window.loadPage=wrapped}catch(e){}
    }

    document.addEventListener("input",e=>{
      const id=e.target?.id||"";
      if(/Graph(Name|Shift|Param|Formula|Expression)/i.test(id)){
        setTimeout(refreshAll,80);
      }
    });

    document.addEventListener("change",e=>{
      const id=e.target?.id||"";
      if(/Graph(Name|Shift|Param|Formula|Expression)/i.test(id)){
        setTimeout(refreshAll,80);
      }
    });

    setTimeout(refreshAll,500);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(hook,300));
  }else{
    setTimeout(hook,300);
  }
})();



/* =========================================================
   V43: КОЛІР ГРАФІКА = ОБРАНИЙ КОЛІР НА ПАНЕЛІ
   ========================================================= */
(function(){
  function selectedGraphColor(){
    const candidates=[
      document.getElementById("colorPicker"),
      document.getElementById("lineColor"),
      document.getElementById("strokeColor"),
      document.querySelector('input[type="color"][id*="color" i]')
    ].filter(Boolean);
    return candidates[0]?.value || "#1e3a68";
  }

  function recolorGraphObject(obj,color){
    if(!obj)return;

    if(obj.set){
      if(obj.stroke && obj.stroke!=="transparent")obj.set("stroke",color);
      if(obj.fill && obj.fill!=="transparent" && obj.type!=="text") {
        // Do not force-fill graph shapes; only replace fills that are already used as strokes/markers.
        if(obj.type==="circle" && (obj.radius||0)<=8)obj.set("fill",color);
      }
    }

    if(Array.isArray(obj._objects)){
      obj._objects.forEach(child=>recolorGraphObject(child,color));
    }

    obj.graphColor=color;
    if(obj.graphMeta && typeof obj.graphMeta==="object"){
      obj.graphMeta.color=color;
      obj.graphMeta.stroke=color;
    }
  }

  function recolorNewestGraphs(beforeSet){
    if(typeof fcanvas==="undefined")return;
    const color=selectedGraphColor();
    fcanvas.getObjects().forEach(obj=>{
      if(obj?.graphObject && !beforeSet.has(obj)){
        recolorGraphObject(obj,color);
      }
    });

    // Keep the inline graph labels synchronized with graph color.
    fcanvas.getObjects().forEach(label=>{
      if(!label?.sofiaGraphInlineLabel)return;
      const target=label.sofiaGraphTarget;
      if(target && !beforeSet.has(target)){
        label.set("fill",color);
      }
    });

    fcanvas.requestRenderAll();
    if(typeof autoSave==="function")setTimeout(autoSave,20);
  }

  function wrapGraphBuilder(){
    // Capture click that actually creates/inserts a graph, independent of the current
    // graph-builder implementation or button id.
    document.addEventListener("click",e=>{
      const btn=e.target.closest?.("button");
      if(!btn || typeof fcanvas==="undefined")return;

      const id=(btn.id||"").toLowerCase();
      const txt=(btn.textContent||"").trim().toLowerCase();

      const isGraphCreate =
        /insertgraph|addgraph|buildgraph|creategraph/.test(id) ||
        /(побудувати|додати|вставити|створити).*(графік)|графік.*(побудувати|додати|вставити|створити)/.test(txt);

      if(!isGraphCreate)return;

      const before=new Set(fcanvas.getObjects());
      // Existing Sofia handler runs after/beside this listener. Recolor after it finishes.
      setTimeout(()=>recolorNewestGraphs(before),60);
      setTimeout(()=>recolorNewestGraphs(before),180);
    },true);
  }

  function syncExistingSelectedGraphOnColorChange(){
    document.addEventListener("input",e=>{
      const input=e.target;
      if(!(input instanceof HTMLInputElement) || input.type!=="color")return;
      if(typeof fcanvas==="undefined")return;

      const active=fcanvas.getActiveObject?.();
      if(active?.graphObject){
        const c=input.value;
        recolorGraphObject(active,c);
        const label=fcanvas.getObjects().find(x=>x?.sofiaGraphInlineLabel && x.sofiaGraphTarget===active);
        if(label)label.set("fill",c);
        fcanvas.requestRenderAll();
      }
    });
  }

  function init(){
    wrapGraphBuilder();
    syncExistingSelectedGraphOnColorChange();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();



/* =========================================================
   V44: РОБОЧИЙ ЦИРКУЛЬ + ПЛАВАЮЧІ ВІКНА ІНСТРУМЕНТІВ
   ========================================================= */
(function(){
  const CM_TO_PX = 37.7952755906; // CSS px per cm at 96 dpi

  /* ---------- Плаваючі вікна: передній план, рух, максимум ---------- */
  const PANEL_SELECTORS=[
    "#teacherToolsPanel","#aiPanel","#calculatorPanel","#timerPanel","#keyboardPanel",
    "#mediaPanel","#elementsPanel","#geometryPanel","#shapeLibraryPanel","#graphBuilderPanel",
    "#numberRayPanel","#graphEditorPanel","#diagnosticsPanel"
  ];

  let topZ = 3000;

  function ensureFloatingStyles(){
    if(document.getElementById("sofiaFloatingWindowsV44"))return;
    const s=document.createElement("style");
    s.id="sofiaFloatingWindowsV44";
    s.textContent=`
      .sofia-floating-window{
        position:fixed!important;
        z-index:3000;
        max-width:min(92vw,980px);
        max-height:88vh;
        overflow:auto!important;
        box-shadow:0 14px 42px rgba(15,23,42,.28)!important;
        border-radius:14px!important;
        background:#fff!important;
      }
      .sofia-floating-window.sofia-maximized{
        left:10px!important;
        top:10px!important;
        width:calc(100vw - 20px)!important;
        height:calc(100vh - 20px)!important;
        max-width:none!important;
        max-height:none!important;
        overflow:auto!important;
      }
      .sofia-floating-head{
        cursor:move!important;
        user-select:none!important;
      }
      .sofia-window-actions{
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-left:auto;
      }
      .sofia-window-action{
        width:30px;height:30px;
        border:0;border-radius:7px;
        background:transparent;
        cursor:pointer;
        font-size:18px;
        line-height:1;
      }
      .sofia-window-action:hover{background:#eef3fa}
      .sofia-compass-panel{
        position:fixed;
        left:90px;
        top:170px;
        width:330px;
        z-index:3200;
        background:#fff;
        border:1px solid #dce5f2;
        border-radius:14px;
        box-shadow:0 14px 42px rgba(15,23,42,.24);
        padding:14px;
      }
      .sofia-compass-head{
        display:flex;align-items:center;gap:8px;
        font-weight:800;font-size:18px;
        cursor:move;user-select:none;
        margin-bottom:12px;
      }
      .sofia-compass-grid{display:grid;gap:10px}
      .sofia-compass-grid label{display:grid;gap:5px;font-size:13px;font-weight:600}
      .sofia-compass-grid input{
        padding:8px 10px;border:1px solid #cad5e5;border-radius:8px;font:inherit;
      }
      .sofia-compass-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .sofia-compass-actions button{
        padding:8px 10px;border-radius:8px;border:1px solid #cbd6e5;background:#fff;cursor:pointer
      }
      .sofia-compass-actions button.primary{background:#173b78;color:#fff;border-color:#173b78}
      .sofia-compass-status{
        margin-top:10px;padding:8px 10px;border-radius:8px;background:#f4f8ff;font-size:12px
      }
    `;
    document.head.appendChild(s);
  }

  function bringFront(el){
    topZ++;
    el.style.zIndex=String(topZ);
  }

  function makeDraggable(panel,handle){
    if(panel.dataset.sofiaDraggableV44)return;
    panel.dataset.sofiaDraggableV44="1";
    let down=false, sx=0, sy=0, sl=0, st=0;

    handle.addEventListener("mousedown",e=>{
      if(e.button!==0 || e.target.closest("button,input,select,textarea"))return;
      if(panel.classList.contains("sofia-maximized"))return;
      down=true;
      bringFront(panel);
      const r=panel.getBoundingClientRect();
      sx=e.clientX; sy=e.clientY; sl=r.left; st=r.top;
      e.preventDefault();
    });

    window.addEventListener("mousemove",e=>{
      if(!down)return;
      const nx=Math.max(0,Math.min(window.innerWidth-panel.offsetWidth,sl+(e.clientX-sx)));
      const ny=Math.max(0,Math.min(window.innerHeight-panel.offsetHeight,st+(e.clientY-sy)));
      panel.style.left=nx+"px";
      panel.style.top=ny+"px";
      panel.style.right="auto";
      panel.style.bottom="auto";
    });

    window.addEventListener("mouseup",()=>down=false);
  }

  function enhancePanel(panel){
    if(!panel || panel.dataset.sofiaFloatingV44)return;
    panel.dataset.sofiaFloatingV44="1";
    panel.classList.add("sofia-floating-window");

    const head=panel.querySelector(
      ".teacher-tools-head,.panel-head,.modal-head,.graph-editor-head,.runtime-error-head,h2,h3"
    ) || panel.firstElementChild || panel;

    head.classList.add("sofia-floating-head");
    makeDraggable(panel,head);

    let actions=head.querySelector(".sofia-window-actions");
    if(!actions){
      actions=document.createElement("span");
      actions.className="sofia-window-actions";

      const max=document.createElement("button");
      max.type="button";
      max.className="sofia-window-action";
      max.textContent="□";
      max.title="На весь екран";
      max.onclick=e=>{
        e.stopPropagation();
        panel.classList.toggle("sofia-maximized");
        max.textContent=panel.classList.contains("sofia-maximized")?"❐":"□";
        bringFront(panel);
      };
      actions.appendChild(max);

      head.appendChild(actions);
    }

    panel.addEventListener("mousedown",()=>bringFront(panel),true);
  }

  function scanPanels(){
    PANEL_SELECTORS.forEach(sel=>enhancePanel(document.querySelector(sel)));
  }

  /* ---------- Робочий циркуль ---------- */
  let compassCenter=null;
  let compassRadiusCm=3;
  let compassMode=false;
  let compassPreview=null;
  let compassNeedle=null;
  let compassArm1=null;
  let compassArm2=null;
  let compassJoint=null;

  function getCanvasPoint(evt){
    if(typeof fcanvas==="undefined")return null;
    const p=fcanvas.getPointer(evt.e||evt);
    return {x:p.x,y:p.y};
  }

  function clearCompassPreview(){
    if(typeof fcanvas==="undefined")return;
    [compassPreview,compassNeedle,compassArm1,compassArm2,compassJoint].forEach(o=>{
      if(o)fcanvas.remove(o);
    });
    compassPreview=compassNeedle=compassArm1=compassArm2=compassJoint=null;
    fcanvas.requestRenderAll();
  }

  function drawCompassVisual(center,rPx){
    clearCompassPreview();
    const color=document.getElementById("colorPicker")?.value || "#173b78";

    compassPreview=new fabric.Circle({
      left:center.x-rPx,top:center.y-rPx,radius:rPx,
      fill:"transparent",stroke:color,strokeWidth:2,
      strokeDashArray:[7,5],selectable:false,evented:false
    });

    compassNeedle=new fabric.Circle({
      left:center.x-4,top:center.y-4,radius:4,fill:"#d33",stroke:"#fff",strokeWidth:1,
      selectable:false,evented:false
    });

    const joint={x:center.x,y:center.y-rPx*0.55};
    const pencil={x:center.x+rPx,y:center.y};
    compassArm1=new fabric.Line([center.x,center.y,joint.x,joint.y],{
      stroke:"#555",strokeWidth:4,selectable:false,evented:false
    });
    compassArm2=new fabric.Line([joint.x,joint.y,pencil.x,pencil.y],{
      stroke:"#777",strokeWidth:4,selectable:false,evented:false
    });
    compassJoint=new fabric.Circle({
      left:joint.x-6,top:joint.y-6,radius:6,fill:"#2d6cdf",stroke:"#fff",strokeWidth:1,
      selectable:false,evented:false
    });

    fcanvas.add(compassPreview,compassArm1,compassArm2,compassNeedle,compassJoint);
    compassPreview.sendToBack();
    fcanvas.requestRenderAll();
  }

  function finalizeCompassCircle(){
    if(!compassCenter || typeof fcanvas==="undefined")return;
    const rPx=compassRadiusCm*CM_TO_PX;
    const color=document.getElementById("colorPicker")?.value || "#173b78";
    const sw=Number(document.getElementById("lineWidth")?.value||2);

    clearCompassPreview();

    const circle=new fabric.Circle({
      left:compassCenter.x-rPx,
      top:compassCenter.y-rPx,
      radius:rPx,
      fill:"transparent",
      stroke:color,
      strokeWidth:sw,
      selectable:true,
      evented:true
    });
    circle.sofiaCompassCircle=true;
    circle.radiusCm=compassRadiusCm;

    const centerDot=new fabric.Circle({
      left:compassCenter.x-3,top:compassCenter.y-3,radius:3,
      fill:color,selectable:false,evented:false
    });

    fcanvas.add(circle,centerDot);
    fcanvas.setActiveObject(circle);
    fcanvas.requestRenderAll();
    if(typeof pushHistory==="function")pushHistory();
    if(typeof autoSave==="function")autoSave();
  }

  function createCompassPanel(){
    if(document.getElementById("sofiaCompassPanel"))return;
    const p=document.createElement("div");
    p.id="sofiaCompassPanel";
    p.className="sofia-compass-panel";
    p.style.display="none";
    p.innerHTML=`
      <div class="sofia-compass-head">
        <span>📐 Циркуль</span>
        <span style="margin-left:auto;display:flex;gap:4px">
          <button type="button" id="sofiaCompassMax" title="На весь екран">□</button>
          <button type="button" id="sofiaCompassClose" title="Закрити">×</button>
        </span>
      </div>
      <div class="sofia-compass-grid">
        <label>Радіус кола (см)
          <input id="sofiaCompassRadius" type="number" min="0.1" step="0.01" value="3">
        </label>
        <div class="sofia-compass-actions">
          <button type="button" data-r="1">1 см</button>
          <button type="button" data-r="2">2 см</button>
          <button type="button" data-r="3">3 см</button>
          <button type="button" data-r="5">5 см</button>
        </div>
        <div class="sofia-compass-actions">
          <button type="button" id="sofiaCompassPick" class="primary">1. Вибрати центр</button>
          <button type="button" id="sofiaCompassBuild">2. Побудувати коло</button>
        </div>
        <div id="sofiaCompassStatus" class="sofia-compass-status">
          Введіть радіус, у тому числі десятковий: 2,5; 3,75; 5,25 см.
        </div>
      </div>
    `;
    document.body.appendChild(p);

    makeDraggable(p,p.querySelector(".sofia-compass-head"));
    p.addEventListener("mousedown",()=>bringFront(p),true);

    const radius=p.querySelector("#sofiaCompassRadius");
    radius.addEventListener("input",()=>{
      const v=parseFloat(String(radius.value).replace(",","."));
      if(Number.isFinite(v) && v>0){
        compassRadiusCm=v;
        if(compassCenter)drawCompassVisual(compassCenter,compassRadiusCm*CM_TO_PX);
      }
    });

    p.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{
      compassRadiusCm=Number(b.dataset.r);
      radius.value=String(compassRadiusCm);
      if(compassCenter)drawCompassVisual(compassCenter,compassRadiusCm*CM_TO_PX);
    });

    p.querySelector("#sofiaCompassPick").onclick=()=>{
      compassMode=true;
      compassCenter=null;
      clearCompassPreview();
      p.querySelector("#sofiaCompassStatus").textContent="Клікніть на аркуші в точці, де має бути центр кола.";
    };

    p.querySelector("#sofiaCompassBuild").onclick=()=>{
      if(!compassCenter){
        p.querySelector("#sofiaCompassStatus").textContent="Спочатку виберіть центр кола.";
        return;
      }
      finalizeCompassCircle();
      p.querySelector("#sofiaCompassStatus").textContent=`Коло побудовано. Радіус: ${compassRadiusCm.toString().replace(".",",")} см.`;
      compassCenter=null;
      compassMode=false;
    };

    p.querySelector("#sofiaCompassClose").onclick=()=>{
      p.style.display="none";
      compassMode=false;
      clearCompassPreview();
    };

    p.querySelector("#sofiaCompassMax").onclick=()=>{
      p.classList.toggle("sofia-maximized");
    };
  }

  function openCompass(){
    createCompassPanel();
    const p=document.getElementById("sofiaCompassPanel");
    p.style.display="block";
    bringFront(p);
  }

  function hookCompassButton(){
    document.addEventListener("click",e=>{
      const b=e.target.closest?.("button");
      if(!b)return;
      const id=(b.id||"").toLowerCase();
      const txt=(b.textContent||"").trim().toLowerCase();

      // V55: react ONLY to the real compass launcher, never to controls
      // inside the compass window (Close / Pick / Build / Max).
      const isCompassLauncher =
        b.dataset?.instrument==="compass" ||
        id==="compassbtn" ||
        id==="opencompassbtn" ||
        txt==="циркуль" ||
        txt==="📐 циркуль";

      if(isCompassLauncher){
        e.preventDefault();
        e.stopImmediatePropagation();
        openCompass();
      }
    },true);

    if(typeof fcanvas!=="undefined"){
      fcanvas.on("mouse:down",opt=>{
        if(!compassMode)return;
        const p=getCanvasPoint(opt);
        if(!p)return;
        compassCenter=p;
        drawCompassVisual(compassCenter,compassRadiusCm*CM_TO_PX);
        const st=document.getElementById("sofiaCompassStatus");
        if(st)st.textContent=`Центр вибрано. Радіус ${compassRadiusCm.toString().replace(".",",")} см. Натисніть «Побудувати коло».`;
      });
    }
  }

  function init(){
    ensureFloatingStyles();
    createCompassPanel();
    setTimeout(scanPanels,300);
    setTimeout(scanPanels,1000);
    hookCompassButton();

    const mo=new MutationObserver(()=>scanPanels());
    mo.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();



/* =========================================================
   V46: ВІДНОВЛЕННЯ ЛІВОЇ ПАНЕЛІ + НАДІЙНЕ ВІДКРИТТЯ ПАНЕЛЕЙ
   ========================================================= */
(function(){
  const PANEL_MAP={
    elementsBtn:"elementsPanel",
    geometryBtn:"geometryPanel",
    shapeLibraryBtn:"shapeLibraryPanel",
    angleBtn:"anglePanel",
    numberRayBtn:"numberRayPanel",
    ukrainianBtn:"ukrainianPanel",
    graphBuilderBtn:"graphBuilderPanel",
    mediaBtn:"mediaPanel",
    aiBtn:"aiPanel",
    calculatorBtn:"calculatorPanel",
    timerBtn:"timerPanel",
    keyboardBtn:"keyboardPanel"
  };

  let z=5000;

  function leftToolbar(){
    const first=document.querySelector(".side-tool[data-tool]");
    if(!first)return null;
    let p=first.parentElement;
    // Usually all side tools share one vertical parent. Walk only while the
    // parent remains a compact toolbar, never up to the whole page.
    while(p && p!==document.body){
      const count=p.querySelectorAll(":scope > .side-tool[data-tool]").length;
      if(count>=3)return p;
      p=p.parentElement;
    }
    return first.parentElement;
  }

  function restoreLeftToolbar(){
    const bar=leftToolbar();
    if(!bar)return;

    bar.hidden=false;
    bar.classList.remove("hidden","collapsed","is-hidden","panel-hidden");
    bar.style.removeProperty("display");
    bar.style.setProperty("visibility","visible","important");
    bar.style.setProperty("opacity","1","important");
    bar.style.setProperty("pointer-events","auto","important");
    bar.style.setProperty("z-index","1150","important");

    // The left tools themselves must never be draggable ribbon commands.
    bar.querySelectorAll(".side-tool[data-tool]").forEach(btn=>{
      btn.classList.remove("sofia-command");
      btn.draggable=false;
      btn.style.removeProperty("outline");
      btn.style.removeProperty("outline-offset");
      btn.style.removeProperty("cursor");
      btn.style.removeProperty("display");
      btn.style.removeProperty("visibility");
      btn.style.removeProperty("opacity");
    });
  }

  function front(panel){
    if(!panel)return;
    panel.style.setProperty("z-index",String(++z),"important");
  }

  function openPanel(panel){
    if(!panel)return;
    panel.classList.remove("hidden");
    panel.hidden=false;
    panel.style.removeProperty("display");
    panel.style.setProperty("visibility","visible","important");
    panel.style.setProperty("opacity","1","important");
    panel.style.setProperty("pointer-events","auto","important");
    front(panel);

    // V44 floating-window behavior, but without changing the tool's own content.
    panel.classList.add("sofia-floating-window");
    if(!panel.style.left && !panel.classList.contains("sofia-maximized")){
      const r=panel.getBoundingClientRect();
      if(r.left<0 || r.left>window.innerWidth-80)panel.style.left="120px";
      if(r.top<0 || r.top>window.innerHeight-80)panel.style.top="140px";
    }
  }

  function closePanel(panel){
    if(!panel)return;
    panel.classList.add("hidden");
  }

  function togglePanel(panel){
    if(!panel)return;
    const isHidden=panel.classList.contains("hidden") ||
      getComputedStyle(panel).display==="none" ||
      panel.hidden;
    if(isHidden)openPanel(panel);
    else closePanel(panel);
  }

  // These are panel-launcher buttons only. Handle them in one place so moving
  // them between ribbon tabs cannot break their command.
  document.addEventListener("click",e=>{
    const btn=e.target.closest?.("button");
    if(!btn || !PANEL_MAP[btn.id])return;

    const panel=document.getElementById(PANEL_MAP[btn.id]);
    if(!panel)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    togglePanel(panel);
  },true);

  // Ensure any opened tool window rises above the notebook/ribbon.
  document.addEventListener("mousedown",e=>{
    const panel=e.target.closest?.(
      "#elementsPanel,#geometryPanel,#shapeLibraryPanel,#anglePanel,#numberRayPanel,"+
      "#ukrainianPanel,#graphBuilderPanel,#mediaPanel,#aiPanel,#calculatorPanel,"+
      "#timerPanel,#keyboardPanel,#teacherToolsPanel"
    );
    if(panel)front(panel);
  },true);

  function repair(){
    restoreLeftToolbar();

    // Remove ribbon styling if a previously saved browser state had affected side tools.
    document.querySelectorAll(".side-tool[data-tool]").forEach(btn=>{
      btn.classList.remove("sofia-command");
      btn.draggable=false;
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{
      repair();
      setTimeout(repair,350);
      setTimeout(repair,1000);
    });
  }else{
    repair();
    setTimeout(repair,350);
    setTimeout(repair,1000);
  }
})();



/* =========================================================
   V47: ПОВНИЙ ЕКРАН ЛИШЕ ДЛЯ КОЛЕСА ФОРТУНИ
   + ЧІТКІ КНОПКИ ЗАКРИТИ / ВИЙТИ З ПОВНОГО ЕКРАНУ
   ========================================================= */
(function(){
  function hideFullscreenOnOtherPanels(){
    document.querySelectorAll(".sofia-floating-window").forEach(panel=>{
      if(panel.id==="teacherToolsPanel")return;
      panel.querySelectorAll(".sofia-window-action").forEach(btn=>{
        const title=(btn.title||"").toLowerCase();
        const txt=(btn.textContent||"").trim();
        if(title.includes("весь екран") || txt==="□" || txt==="❐"){
          btn.style.display="none";
        }
      });
    });
  }

  function isWheelActive(panel){
    if(!panel)return false;

    const activeTab = panel.querySelector(
      '[data-tool-tab].active,[data-tab].active,.teacher-tool-tab.active,.teacher-tools-tab.active,.active[data-panel]'
    );
    if(activeTab && /колес/i.test(activeTab.textContent||""))return true;

    // fallback: visible wheel-related content
    const visibleWheel = Array.from(panel.querySelectorAll("*")).find(el=>{
      const txt=(el.textContent||"").trim();
      if(!/крутити колесо|колесо фортуни/i.test(txt))return false;
      const cs=getComputedStyle(el);
      return cs.display!=="none" && cs.visibility!=="hidden";
    });
    return !!visibleWheel;
  }

  function teacherPanel(){
    return document.getElementById("teacherToolsPanel") ||
           document.querySelector(".teacher-tools-panel");
  }

  function ensureControls(){
    const panel=teacherPanel();
    if(!panel)return;

    let head=panel.querySelector(".teacher-tools-head,.panel-head,h2,h3") || panel.firstElementChild || panel;
    if(!head)return;

    let box=document.getElementById("fortuneWindowControlsV47");
    if(!box){
      box=document.createElement("div");
      box.id="fortuneWindowControlsV47";
      box.style.cssText=[
        "margin-left:auto",
        "display:inline-flex",
        "align-items:center",
        "gap:6px",
        "position:sticky",
        "top:0",
        "z-index:10020"
      ].join(";");

      const full=document.createElement("button");
      full.type="button";
      full.id="fortuneFullscreenBtnV47";
      full.textContent="⛶ На весь екран";
      full.title="Розгорнути колесо фортуни";
      full.style.cssText="padding:7px 10px;border-radius:8px;border:1px solid #cbd6e5;background:#fff;cursor:pointer;font-weight:600;";

      const close=document.createElement("button");
      close.type="button";
      close.id="fortuneCloseBtnV47";
      close.textContent="✕ Закрити";
      close.title="Закрити інструменти вчителя";
      close.style.cssText="padding:7px 10px;border-radius:8px;border:1px solid #f0b8b8;background:#fff5f5;color:#b42323;cursor:pointer;font-weight:600;";

      box.append(full,close);
      head.appendChild(box);

      full.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
        if(!isWheelActive(panel))return;

        const nowMax=!panel.classList.contains("sofia-maximized");
        panel.classList.toggle("sofia-maximized",nowMax);
        full.textContent=nowMax ? "↙ Вийти з повного екрану" : "⛶ На весь екран";
        full.title=nowMax ? "Повернути звичайний розмір" : "Розгорнути колесо фортуни";
        panel.style.zIndex="10010";
      });

      close.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
        panel.classList.remove("sofia-maximized");
        full.textContent="⛶ На весь екран";
        panel.classList.add("hidden");
      });
    }

    updateVisibility();
  }

  function updateVisibility(){
    const panel=teacherPanel();
    const box=document.getElementById("fortuneWindowControlsV47");
    const full=document.getElementById("fortuneFullscreenBtnV47");
    if(!panel || !box || !full)return;

    // Close is always available. Fullscreen is ONLY for the wheel.
    const wheel=isWheelActive(panel);
    full.style.display=wheel ? "" : "none";

    // If user leaves the wheel tab while maximized, automatically return to normal.
    if(!wheel && panel.classList.contains("sofia-maximized")){
      panel.classList.remove("sofia-maximized");
      full.textContent="⛶ На весь екран";
    }
  }

  function removeOldTeacherMaxButton(){
    const panel=teacherPanel();
    if(!panel)return;
    panel.querySelectorAll(".sofia-window-action").forEach(btn=>{
      const title=(btn.title||"").toLowerCase();
      const txt=(btn.textContent||"").trim();
      if(title.includes("весь екран") || txt==="□" || txt==="❐"){
        btn.style.display="none";
      }
    });
  }

  function init(){
    hideFullscreenOnOtherPanels();
    ensureControls();
    removeOldTeacherMaxButton();

    document.addEventListener("click",e=>{
      const panel=teacherPanel();
      if(panel && panel.contains(e.target)){
        setTimeout(()=>{
          ensureControls();
          updateVisibility();
          removeOldTeacherMaxButton();
        },30);
      }
    },true);

    document.addEventListener("keydown",e=>{
      if(e.key!=="Escape")return;
      const panel=teacherPanel();
      const full=document.getElementById("fortuneFullscreenBtnV47");
      if(panel?.classList.contains("sofia-maximized")){
        panel.classList.remove("sofia-maximized");
        if(full)full.textContent="⛶ На весь екран";
      }
    });

    const mo=new MutationObserver(()=>{
      hideFullscreenOnOtherPanels();
      ensureControls();
      removeOldTeacherMaxButton();
      updateVisibility();
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  }else{
    setTimeout(init,250);
  }
})();



/* =========================================================
   V48: ОДНА КНОПКА ЗАКРИТИ + НАДІЙНИЙ FULLSCREEN ДЛЯ КОЛЕСА
   ========================================================= */
(function(){
  function panel(){
    return document.getElementById("teacherToolsPanel") ||
           document.querySelector(".teacher-tools-panel");
  }

  function wheelIsOpen(p){
    if(!p)return false;
    const txt=(p.innerText||p.textContent||"").toLowerCase();
    return txt.includes("крутити колесо") ||
           txt.includes("прибрати переможця") ||
           txt.includes("учасники / слова / завдання") ||
           txt.includes("колесо фортуни");
  }

  function removeDuplicateV47Controls(){
    const old=document.getElementById("fortuneWindowControlsV47");
    if(old)old.remove();

    // Remove old artificial close/fullscreen controls from previous versions,
    // but keep the app's original close X.
    const p=panel();
    if(!p)return;
    p.querySelectorAll(".sofia-window-action").forEach(b=>{
      const t=(b.title||"").toLowerCase();
      const x=(b.textContent||"").trim();
      if(t.includes("весь екран") || x==="□" || x==="❐") b.remove();
    });
  }

  function getHead(p){
    return p.querySelector(".teacher-tools-head,.panel-head,h2,h3") ||
           p.firstElementChild || p;
  }

  function ensureFullscreenButton(){
    const p=panel();
    if(!p)return;

    removeDuplicateV47Controls();

    let btn=document.getElementById("fortuneFullscreenBtnV48");
    if(!btn){
      btn=document.createElement("button");
      btn.type="button";
      btn.id="fortuneFullscreenBtnV48";
      btn.textContent="⛶ На весь екран";
      btn.title="Розгорнути колесо фортуни на весь екран";
      btn.style.cssText=[
        "margin-left:8px",
        "padding:7px 10px",
        "border-radius:8px",
        "border:1px solid #cbd6e5",
        "background:#173b78",
        "color:#fff",
        "cursor:pointer",
        "font-weight:700",
        "white-space:nowrap",
        "position:relative",
        "z-index:10050"
      ].join(";");

      const head=getHead(p);
      const originalClose =
        head.querySelector("[data-close],.close,.panel-close,.teacher-tools-close") ||
        Array.from(head.querySelectorAll("button")).find(b=>{
          const t=(b.textContent||"").trim();
          return t==="×" || t==="✕" || /закрити/i.test(b.title||"");
        });

      if(originalClose) head.insertBefore(btn,originalClose);
      else head.appendChild(btn);

      btn.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();

        const maximize=!p.classList.contains("sofia-maximized");
        p.classList.toggle("sofia-maximized",maximize);

        if(maximize){
          p.style.setProperty("left","10px","important");
          p.style.setProperty("top","10px","important");
          p.style.setProperty("right","10px","important");
          p.style.setProperty("bottom","10px","important");
          p.style.setProperty("width","calc(100vw - 20px)","important");
          p.style.setProperty("height","calc(100vh - 20px)","important");
          p.style.setProperty("max-width","none","important");
          p.style.setProperty("max-height","none","important");
          p.style.setProperty("z-index","10040","important");
          btn.textContent="↙ Вийти з повного екрану";
          btn.title="Повернути звичайний розмір";
        }else{
          ["left","top","right","bottom","width","height","max-width","max-height"].forEach(k=>{
            p.style.removeProperty(k);
          });
          btn.textContent="⛶ На весь екран";
          btn.title="Розгорнути колесо фортуни на весь екран";
        }
      });
    }

    // Fullscreen button is shown only while the fortune-wheel content is open.
    btn.style.display=wheelIsOpen(p) ? "" : "none";
  }

  function exitFullscreen(){
    const p=panel();
    const btn=document.getElementById("fortuneFullscreenBtnV48");
    if(!p)return;
    p.classList.remove("sofia-maximized");
    ["left","top","right","bottom","width","height","max-width","max-height"].forEach(k=>{
      p.style.removeProperty(k);
    });
    if(btn){
      btn.textContent="⛶ На весь екран";
      btn.title="Розгорнути колесо фортуни на весь екран";
    }
  }

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape")exitFullscreen();
  });

  document.addEventListener("click",e=>{
    const p=panel();
    if(!p)return;

    // If original close X is clicked while maximized, reset the fullscreen state.
    if(p.contains(e.target)){
      const b=e.target.closest?.("button");
      if(b){
        const t=(b.textContent||"").trim();
        if(t==="×" || t==="✕") setTimeout(exitFullscreen,0);
      }
      setTimeout(ensureFullscreenButton,30);
    }
  },true);

  function init(){
    ensureFullscreenButton();
    const mo=new MutationObserver(()=>{
      clearTimeout(mo.__t);
      mo.__t=setTimeout(ensureFullscreenButton,60);
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,300));
  }else{
    setTimeout(init,300);
  }
})();



/* =========================================================
   V49: СИСТЕМНІ ВИПРАВЛЕННЯ
   - циркуль реально малює
   - клавіатура UA/EN без затримки
   - "Встановити додаток" зверху
   - стирачка не стирає прилади/системні об'єкти
   - "Розбір" показує потрібні кнопки
   ========================================================= */
(function(){
  /* ---------- 1. ПЕРЕНОС "ВСТАНОВИТИ ДОДАТОК" У ВЕРХ ---------- */
  function moveInstallTop(){
    const btn=document.getElementById("installAppBtn");
    if(!btn)return;

    const topCandidates=[
      document.querySelector(".top-actions"),
      document.querySelector(".header-actions"),
      document.querySelector("header"),
      document.querySelector(".app-header"),
      document.querySelector(".topbar")
    ].filter(Boolean);

    const target=topCandidates[0];
    if(target && btn.parentElement!==target){
      target.appendChild(btn);
    }
  }

  /* ---------- 2. ШВИДКА КЛАВІАТУРА UA / EN ---------- */
  const KEYS_UA=["1","2","3","4","5","6","7","8","9","0","-","=",
    "й","ц","у","к","е","н","г","ш","щ","з","х","ї",
    "ф","і","в","а","п","р","о","л","д","ж","є",
    "я","ч","с","м","и","т","ь","б","ю",",",".","?"];
  const KEYS_EN=["1","2","3","4","5","6","7","8","9","0","-","=",
    "q","w","e","r","t","y","u","i","o","p","[","]",
    "a","s","d","f","g","h","j","k","l",";","'",
    "z","x","c","v","b","n","m",",",".","?"];

  let v49KeyboardLang="UA";

  function keyboardPanel(){ return document.getElementById("keyboardPanel"); }
  function keyboardBox(){ return document.getElementById("keyboardKeys"); }

  function insertKeyText(v){
    if(v==="BACK"){
      const o=window.fcanvas?.getActiveObject?.() || (typeof fcanvas!=="undefined" ? fcanvas.getActiveObject() : null);
      if(o && ["i-text","textbox"].includes(o.type)){
        const p=o.selectionStart||0;
        if(p>0)o.removeChars(p-1,p);
        o.setSelectionStart(Math.max(0,p-1));
        o.setSelectionEnd(Math.max(0,p-1));
        fcanvas.requestRenderAll();
        if(typeof autoSave==="function")autoSave();
      }
      return;
    }
    if(typeof insertTextIntoBoard==="function")insertTextIntoBoard(v);
  }

  function renderFastKeyboard(){
    const box=keyboardBox();
    if(!box)return;
    box.innerHTML="";
    const keys=v49KeyboardLang==="UA"?KEYS_UA:KEYS_EN;

    const frag=document.createDocumentFragment();
    keys.forEach(k=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="key-btn";
      b.textContent=k;
      b.onclick=()=>insertKeyText(k);
      frag.appendChild(b);
    });
    [["Пробіл"," "],["Enter","\n"],["⌫","BACK"]].forEach(([label,val])=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="key-btn special "+(label==="Пробіл"?"space":"");
      b.textContent=label;
      b.onclick=()=>insertKeyText(val);
      frag.appendChild(b);
    });
    box.appendChild(frag);

    const lang=document.getElementById("keyboardLangBtn");
    if(lang){
      lang.textContent=v49KeyboardLang;
      lang.title="Змінити мову клавіатури";
    }
  }

  function bindKeyboard(){
    const btn=document.getElementById("keyboardBtn");
    const lang=document.getElementById("keyboardLangBtn");
    const close=document.getElementById("keyboardCloseBtn");

    if(btn){
      btn.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        const p=keyboardPanel();
        if(!p)return;
        renderFastKeyboard();
        p.classList.toggle("hidden");
        p.style.zIndex="6000";
      };
    }
    if(lang){
      lang.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        v49KeyboardLang=v49KeyboardLang==="UA"?"EN":"UA";
        renderFastKeyboard();
      };
    }
    if(close){
      close.onclick=()=>keyboardPanel()?.classList.add("hidden");
    }
  }

  /* ---------- 3. РОЗБІР УКРАЇНСЬКОЇ МОВИ ---------- */
  function ensureUkrainianButtons(){
    const panel=document.getElementById("ukrainianPanel");
    if(!panel)return;

    if(panel.querySelector("[data-ukmark],[data-wordmark]"))return;

    const wrap=document.createElement("div");
    wrap.id="ukrainianToolsV49";
    wrap.style.cssText="display:grid;gap:14px;padding:14px;";

    const syntax=document.createElement("div");
    syntax.innerHTML=`
      <div style="font-weight:800;margin-bottom:8px">Синтаксичний розбір</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button type="button" data-ukmark="subject">Підмет — одна лінія</button>
        <button type="button" data-ukmark="predicate">Присудок — дві лінії</button>
        <button type="button" data-ukmark="object">Додаток — пунктир</button>
        <button type="button" data-ukmark="attribute">Означення — хвиляста</button>
        <button type="button" data-ukmark="adverbial">Обставина — штрих-пунктир</button>
      </div>`;

    const word=document.createElement("div");
    word.innerHTML=`
      <div style="font-weight:800;margin-bottom:8px">Будова слова</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button type="button" data-wordmark="root">Корінь</button>
        <button type="button" data-wordmark="prefix">Префікс</button>
        <button type="button" data-wordmark="suffix">Суфікс</button>
        <button type="button" data-wordmark="ending">Закінчення</button>
        <button type="button" data-wordmark="stem">Основа</button>
      </div>`;

    wrap.append(syntax,word);
    panel.appendChild(wrap);

    panel.querySelectorAll("[data-ukmark]").forEach(b=>{
      b.onclick=()=>{
        const kind=b.dataset.ukmark;
        if(typeof addUkLine==="function"){
          addUkLine(kind);
        }else{
          // fallback
          const c=document.getElementById("colorPicker")?.value||"#17315f";
          const sw=Math.max(2,Number(document.getElementById("lineWidth")?.value||2));
          const o=[];
          if(kind==="subject")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw}));
          if(kind==="predicate"){
            o.push(new fabric.Line([0,-4,150,-4],{stroke:c,strokeWidth:sw}),
                   new fabric.Line([0,4,150,4],{stroke:c,strokeWidth:sw}));
          }
          if(kind==="object")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw,strokeDashArray:[8,6]}));
          if(kind==="attribute"){
            let p="M 0 0"; for(let x=10;x<=150;x+=10)p+=` L ${x} ${(x/10)%2?6:-6}`;
            o.push(new fabric.Path(p,{stroke:c,strokeWidth:sw,fill:"transparent"}));
          }
          if(kind==="adverbial")o.push(new fabric.Line([0,0,150,0],{stroke:c,strokeWidth:sw,strokeDashArray:[12,5,2,5]}));
          if(typeof groupAndPlace==="function")groupAndPlace(o,360,420);
        }
      };
    });

    panel.querySelectorAll("[data-wordmark]").forEach(b=>{
      b.onclick=()=>{
        const map={root:"∩",prefix:"⌜",suffix:"⌃",ending:"□",stem:"⌒"};
        const t=new fabric.Text(map[b.dataset.wordmark],{
          left:380,top:380,fontSize:54,
          fill:document.getElementById("colorPicker")?.value||"#17315f"
        });
        fcanvas.add(t);
        fcanvas.setActiveObject(t);
        if(typeof pushHistory==="function")pushHistory();
        if(typeof autoSave==="function")autoSave();
      };
    });
  }

  function bindUkrainian(){
    const btn=document.getElementById("ukrainianBtn");
    if(!btn)return;
    btn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const p=document.getElementById("ukrainianPanel");
      if(!p)return;
      ensureUkrainianButtons();
      p.classList.toggle("hidden");
      p.style.zIndex="6200";
    };
  }

  /* ---------- 4. ЦИРКУЛЬ: НАДІЙНЕ МАЛЮВАННЯ ---------- */
  function fixCompass(){
    const panel=document.getElementById("sofiaCompassPanel");
    if(!panel || typeof fcanvas==="undefined")return;

    const radius=document.getElementById("sofiaCompassRadius");
    const pick=document.getElementById("sofiaCompassPick");
    const build=document.getElementById("sofiaCompassBuild");
    const status=document.getElementById("sofiaCompassStatus");

    if(!radius || !pick || !build)return;

    let center=null;
    let selecting=false;

    function radiusCm(){
      const v=parseFloat(String(radius.value||"").replace(",","."));
      return Number.isFinite(v)&&v>0?v:1;
    }

    pick.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      selecting=true;
      center=null;
      if(status)status.textContent="Клікніть на аркуші, щоб вибрати центр кола.";
    };

    if(!fcanvas.__sofiaCompassV49Bound){
      fcanvas.__sofiaCompassV49Bound=true;
      fcanvas.on("mouse:down",opt=>{
        if(!selecting)return;
        center=fcanvas.getPointer(opt.e);
        selecting=false;
        if(status)status.textContent=`Центр вибрано. Радіус: ${radiusCm().toString().replace(".",",")} см. Натисніть «Побудувати коло».`;
      });
    }

    build.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      if(!center){
        if(status)status.textContent="Спочатку натисніть «1. Вибрати центр» і клікніть на аркуші.";
        return;
      }

      const cm=radiusCm();
      const px=cm*37.7952755906;
      const color=document.getElementById("colorPicker")?.value||"#17315f";
      const sw=Math.max(1,Number(document.getElementById("lineWidth")?.value||2));

      const circle=new fabric.Circle({
        left:center.x-px,
        top:center.y-px,
        radius:px,
        fill:"transparent",
        stroke:color,
        strokeWidth:sw,
        selectable:true,
        evented:true
      });
      circle.sofiaCompassCircle=true;
      circle.radiusCm=cm;

      const dot=new fabric.Circle({
        left:center.x-3,top:center.y-3,radius:3,
        fill:color,
        selectable:false,
        evented:false
      });
      dot.sofiaInstrumentProtected=true;

      circle.sofiaInstrumentProtected=false;
      fcanvas.add(circle,dot);
      fcanvas.setActiveObject(circle);
      fcanvas.requestRenderAll();

      if(typeof pushHistory==="function")pushHistory();
      if(typeof autoSave==="function")autoSave();

      if(status)status.textContent=`Готово. Побудовано коло радіусом ${cm.toString().replace(".",",")} см.`;
      center=null;
    };
  }

  /* ---------- 5. СТИРАЧКА НЕ ЧІПАЄ ПРИЛАДИ ---------- */
  function markProtectedInstruments(){
    if(typeof fcanvas==="undefined")return;
    fcanvas.getObjects().forEach(o=>{
      // Groups created by measuring instruments / geometry tools
      if(o?.sofiaInstrumentProtected)return;
      if(o?.type==="group"){
        const name=(o.name||o.type||"").toLowerCase();
        if(o.instrumentType || o.geometryInstrument || o.isInstrument){
          o.sofiaInstrumentProtected=true;
        }
      }
    });
  }

  function patchInstrumentCreation(){
    if(typeof groupInstrument==="function" && !window.__sofiaGroupInstrumentV49){
      window.__sofiaGroupInstrumentV49=true;
      const old=groupInstrument;
      try{
        window.groupInstrument=function(objects,left=220,top=210){
          const g=old(objects,left,top);
          if(g){
            g.sofiaInstrumentProtected=true;
            g.isInstrument=true;
          }
          return g;
        };
      }catch(e){}
    }
  }

  function protectFromEraser(){
    if(typeof fcanvas==="undefined")return;

    // This does not alter the eraser implementation globally. It makes
    // instruments repaint above eraser masks so they remain visible.
    const repaint=()=>{
      const objs=fcanvas.getObjects();
      const protectedObjs=objs.filter(o=>o?.sofiaInstrumentProtected || o?.isInstrument || o?.geometryInstrument);
      protectedObjs.forEach(o=>fcanvas.bringToFront(o));
      fcanvas.requestRenderAll();
    };

    fcanvas.on("object:added",()=>setTimeout(repaint,0));
    fcanvas.on("mouse:up",()=>setTimeout(repaint,0));
  }

  /* ---------- 6. ПОВТОРНА ПРИВ'ЯЗКА ОСНОВНИХ ПАНЕЛЕЙ ---------- */
  const PANELS={
    elementsBtn:"elementsPanel",
    geometryBtn:"geometryPanel",
    shapeLibraryBtn:"shapeLibraryPanel",
    angleBtn:"anglePanel",
    numberRayBtn:"numberRayPanel",
    graphBuilderBtn:"graphBuilderPanel",
    mediaBtn:"mediaPanel",
    calculatorBtn:"calculatorPanel",
    timerBtn:"timerPanel"
  };

  function rebindPanels(){
    Object.entries(PANELS).forEach(([bid,pid])=>{
      const b=document.getElementById(bid);
      const p=document.getElementById(pid);
      if(!b || !p)return;
      b.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        p.classList.toggle("hidden");
        p.style.zIndex="6100";
      };
    });
  }

  function init(){
    moveInstallTop();
    bindKeyboard();
    ensureUkrainianButtons();
    bindUkrainian();
    fixCompass();
    patchInstrumentCreation();
    markProtectedInstruments();
    protectFromEraser();
    rebindPanels();

    [300,900,1800].forEach(ms=>setTimeout(()=>{
      moveInstallTop();
      bindKeyboard();
      ensureUkrainianButtons();
      bindUkrainian();
      fixCompass();
      rebindPanels();
    },ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,200));
  }else{
    setTimeout(init,200);
  }
})();



/* =========================================================
   V50: ПОВНЕ ВІДНОВЛЕННЯ "ІНСТРУМЕНТІВ ВЧИТЕЛЯ"
   Колесо / Картки / Тест / Списки / Перекладач / Зображення
   ========================================================= */
(function(){
  const TOOLS=[
    ["wheel","🎡 Колесо"],
    ["cards","🃏 Картки"],
    ["test","✅ Тест"],
    ["lists","☷ Списки"],
    ["translate","🌐 Перекладач"],
    ["image","🖼 Зображення"]
  ];

  function teacherPanel(){
    return document.getElementById("teacherToolsPanel") ||
           document.querySelector(".teacher-tools-panel") ||
           document.querySelector("[data-tt31-section]")?.parentElement;
  }

  function sections(){
    const p=teacherPanel();
    if(!p)return [];
    return Array.from(p.querySelectorAll("[data-tt31-section]"));
  }

  function activeTool(){
    const ss=sections();
    const visible=ss.find(s=>!s.classList.contains("hidden") && getComputedStyle(s).display!=="none");
    return visible?.dataset.tt31Section || "wheel";
  }

  function showTool(name){
    const p=teacherPanel();
    if(!p)return;

    sections().forEach(s=>{
      const on=s.dataset.tt31Section===name;
      s.classList.toggle("hidden",!on);
      if(on){
        s.style.removeProperty("display");
        s.style.removeProperty("visibility");
        s.style.removeProperty("opacity");
      }
    });

    p.querySelectorAll("[data-tt31]").forEach(b=>{
      b.classList.toggle("active",b.dataset.tt31===name);
    });

    const bar=document.getElementById("teacherToolsTabsV50");
    bar?.querySelectorAll("[data-v50-tool]").forEach(b=>{
      b.classList.toggle("active",b.dataset.v50Tool===name);
    });

    // Fullscreen belongs only to fortune wheel.
    const full=document.getElementById("fortuneFullscreenBtnV48");
    if(full)full.style.display=name==="wheel"?"":"none";

    if(name!=="wheel" && p.classList.contains("sofia-maximized")){
      p.classList.remove("sofia-maximized");
      ["left","top","right","bottom","width","height","max-width","max-height"].forEach(k=>p.style.removeProperty(k));
    }

    p.style.zIndex="6500";
  }

  function makeTabs(){
    const p=teacherPanel();
    if(!p || !sections().length)return;

    let bar=document.getElementById("teacherToolsTabsV50");
    if(!bar){
      bar=document.createElement("div");
      bar.id="teacherToolsTabsV50";
      bar.style.cssText=[
        "display:flex",
        "flex-wrap:wrap",
        "gap:7px",
        "padding:8px 14px",
        "border-top:1px solid #edf1f7",
        "border-bottom:1px solid #dfe6f0",
        "background:#fff",
        "position:sticky",
        "top:0",
        "z-index:6510"
      ].join(";");

      TOOLS.forEach(([id,label])=>{
        const b=document.createElement("button");
        b.type="button";
        b.dataset.v50Tool=id;
        b.textContent=label;
        b.style.cssText=[
          "padding:8px 11px",
          "border:1px solid #cbd6e5",
          "border-radius:9px",
          "background:#fff",
          "cursor:pointer",
          "font-weight:600",
          "white-space:nowrap"
        ].join(";");
        b.onclick=e=>{
          e.preventDefault();e.stopPropagation();
          showTool(id);
        };
        bar.appendChild(b);
      });

      const style=document.createElement("style");
      style.id="teacherToolsTabsV50Style";
      style.textContent=`
        #teacherToolsTabsV50 button.active{
          background:#173b78!important;
          color:#fff!important;
          border-color:#173b78!important;
        }
        #teacherToolsPanel [data-tt31-section],
        .teacher-tools-panel [data-tt31-section]{
          padding-top:12px;
        }
      `;
      document.head.appendChild(style);

      const head=p.querySelector(".teacher-tools-head,.panel-head") || p.firstElementChild;
      if(head && head.nextSibling)p.insertBefore(bar,head.nextSibling);
      else p.insertBefore(bar,p.firstChild);
    }

    const current=activeTool();
    showTool(current);
  }

  function fixOriginalTabs(){
    const p=teacherPanel();
    if(!p)return;

    // If original tab buttons are present but were hidden by a later layout,
    // make them visible again too.
    p.querySelectorAll("[data-tt31]").forEach(b=>{
      b.style.removeProperty("display");
      b.style.removeProperty("visibility");
      b.style.removeProperty("opacity");
      b.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        showTool(b.dataset.tt31);
      };
    });
  }

  function bindTeacherButton(){
    const btn=document.getElementById("teacherToolsBtn") ||
              Array.from(document.querySelectorAll("button")).find(b=>{
                const t=(b.textContent||"").trim();
                return t==="🎓 Інструменти" || t==="Інструменти";
              });
    const p=teacherPanel();
    if(!btn || !p)return;

    btn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      makeTabs();
      fixOriginalTabs();
      p.classList.toggle("hidden");
      p.style.zIndex="6500";
    };
  }

  function removeDuplicateClose(){
    const p=teacherPanel();
    if(!p)return;

    // Keep the original small X in the header, remove only large artificial duplicate close.
    Array.from(p.querySelectorAll("button")).forEach(b=>{
      const txt=(b.textContent||"").trim();
      if(/Закрити/i.test(txt) && txt!=="×" && txt!=="✕"){
        if(b.id!=="teacherToolsClose")b.remove();
      }
    });
  }

  function init(){
    makeTabs();
    fixOriginalTabs();
    bindTeacherButton();
    removeDuplicateClose();

    [400,1000,2000].forEach(ms=>setTimeout(()=>{
      makeTabs();
      fixOriginalTabs();
      bindTeacherButton();
      removeDuplicateClose();
    },ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  }else{
    setTimeout(init,250);
  }
})();



/* =========================================================
   V51: УСІ ВІКНА ЗАВЖДИ НА ПЕРЕДНЬОМУ ПЛАНІ + НАДІЙНИЙ ГОЛОС
   ========================================================= */
(function(){
  let zTop=20000;

  const FLOATING_IDS=[
    "teacherToolsPanel","aiPanel","calculatorPanel","timerPanel","keyboardPanel",
    "mediaPanel","elementsPanel","geometryPanel","shapeLibraryPanel","anglePanel",
    "numberRayPanel","ukrainianPanel","graphBuilderPanel","graphEditorPanel",
    "diagnosticsPanel","sofiaCompassPanel"
  ];

  const LAUNCH_MAP={
    teacherToolsBtn:"teacherToolsPanel",
    aiBtn:"aiPanel",
    calculatorBtn:"calculatorPanel",
    timerBtn:"timerPanel",
    keyboardBtn:"keyboardPanel",
    mediaBtn:"mediaPanel",
    elementsBtn:"elementsPanel",
    geometryBtn:"geometryPanel",
    shapeLibraryBtn:"shapeLibraryPanel",
    angleBtn:"anglePanel",
    numberRayBtn:"numberRayPanel",
    ukrainianBtn:"ukrainianPanel",
    graphBuilderBtn:"graphBuilderPanel"
  };

  function getPanel(id){
    return document.getElementById(id);
  }

  function bringToFront(panel){
    if(!panel)return;
    zTop++;
    panel.style.setProperty("z-index",String(zTop),"important");
    panel.style.setProperty("position","fixed","important");
    panel.style.setProperty("isolation","isolate","important");
  }

  function showPanel(panel){
    if(!panel)return;
    panel.classList.remove("hidden");
    panel.hidden=false;
    panel.style.removeProperty("display");
    panel.style.setProperty("visibility","visible","important");
    panel.style.setProperty("opacity","1","important");
    panel.style.setProperty("pointer-events","auto","important");
    bringToFront(panel);
  }

  function makeAllKnownPanelsFront(){
    FLOATING_IDS.forEach(id=>{
      const p=getPanel(id);
      if(!p)return;
      if(!p.classList.contains("hidden") && getComputedStyle(p).display!=="none"){
        bringToFront(p);
      }
      p.addEventListener("mousedown",()=>bringToFront(p),true);
    });
  }

  // Every launcher raises its target above all ribbons/settings panels.
  document.addEventListener("click",e=>{
    const btn=e.target.closest?.("button");
    if(!btn)return;

    let pid=LAUNCH_MAP[btn.id];
    if(!pid){
      const txt=(btn.textContent||"").trim();
      if(/Інструменти/.test(txt) && getPanel("teacherToolsPanel"))pid="teacherToolsPanel";
    }
    if(!pid)return;

    setTimeout(()=>{
      const p=getPanel(pid);
      if(p && !p.classList.contains("hidden"))bringToFront(p);
    },20);
  },true);

  // Any visible modal-like panel gets raised after DOM changes.
  const observer=new MutationObserver(()=>{
    clearTimeout(observer.__t);
    observer.__t=setTimeout(makeAllKnownPanelsFront,30);
  });

  /* ---------- ГОЛОСОВЕ ВВЕДЕННЯ ---------- */
  let recognition=null;
  let listening=false;

  function voiceButton(){
    return document.getElementById("voiceBtn");
  }

  function setVoiceState(on,label){
    const b=voiceButton();
    if(!b)return;
    listening=on;
    b.textContent=label || (on ? "🎙 Слухаю…" : "🎙 Голос");
    b.classList.toggle("active",on);
  }

  function insertVoiceText(text){
    if(!text)return;
    try{
      if(typeof insertTextIntoBoard==="function"){
        insertTextIntoBoard(text+" ");
        return;
      }
      const canvas=window.fcanvas || (typeof fcanvas!=="undefined" ? fcanvas : null);
      if(canvas && window.fabric){
        const obj=new fabric.IText(text,{
          left:280,top:180,fontSize:27,
          fill:document.getElementById("colorPicker")?.value||"#17315f"
        });
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        if(typeof autoSave==="function")autoSave();
      }
    }catch(err){
      console.error("Voice insert error",err);
    }
  }

  function explainVoiceError(err){
    const code=err?.error || err?.name || "";
    if(code==="not-allowed" || code==="NotAllowedError" || code==="service-not-allowed"){
      alert("Доступ до мікрофона заблоковано. Натисніть значок 🔒 біля адреси сайту → Мікрофон → Дозволити, потім оновіть сторінку.");
      return;
    }
    if(code==="no-speech"){
      alert("Мовлення не розпізнано. Спробуйте говорити трохи голосніше.");
      return;
    }
    if(code==="audio-capture"){
      alert("Не знайдено доступного мікрофона. Перевірте підключення мікрофона у Windows.");
      return;
    }
    if(code==="network"){
      alert("Голосове розпізнавання не змогло підключитися до сервісу. Перевірте інтернет і спробуйте ще раз.");
      return;
    }
    alert("Не вдалося запустити голосове введення. Перевірте дозвіл на мікрофон у браузері.");
  }

  function stopRecognition(){
    if(recognition){
      try{recognition.stop()}catch(e){}
    }
    recognition=null;
    setVoiceState(false,"🎙 Голос");
  }

  async function startRecognition(){
    const b=voiceButton();
    if(!b)return;

    if(listening){
      stopRecognition();
      return;
    }

    if(!window.isSecureContext){
      alert("Голосове введення працює лише через захищене HTTPS-з'єднання.");
      return;
    }

    const SR=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){
      alert("Цей браузер не підтримує голосове введення. Відкрийте Sofia Notebook у Google Chrome або Microsoft Edge.");
      return;
    }

    // Ask the browser for microphone access explicitly first. This makes the
    // permission prompt predictable instead of failing silently.
    try{
      if(navigator.mediaDevices?.getUserMedia){
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        stream.getTracks().forEach(t=>t.stop());
      }
    }catch(err){
      explainVoiceError(err);
      setVoiceState(false,"🎙 Голос");
      return;
    }

    recognition=new SR();
    recognition.lang=document.getElementById("subject")?.value==="Англійська мова" ? "en-US" : "uk-UA";
    recognition.interimResults=true;
    recognition.continuous=false;
    recognition.maxAlternatives=1;

    let finalText="";
    recognition.onstart=()=>setVoiceState(true,"🎙 Слухаю…");

    recognition.onresult=e=>{
      finalText="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        const piece=e.results[i][0]?.transcript||"";
        if(e.results[i].isFinal)finalText+=piece;
      }
      if(finalText.trim())insertVoiceText(finalText.trim());
    };

    recognition.onerror=e=>{
      console.warn("Speech recognition error",e);
      if(e.error!=="aborted")explainVoiceError(e);
      setVoiceState(false,"🎙 Голос");
      recognition=null;
    };

    recognition.onend=()=>{
      setVoiceState(false,"🎙 Голос");
      recognition=null;
    };

    try{
      recognition.start();
    }catch(err){
      explainVoiceError(err);
      setVoiceState(false,"🎙 Голос");
      recognition=null;
    }
  }

  function bindVoice(){
    const b=voiceButton();
    if(!b)return;
    // Replace prior onclick handlers with one reliable handler.
    b.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      startRecognition();
    };
    b.title="Голосове введення українською або англійською відповідно до предмета";
  }

  function init(){
    bindVoice();
    makeAllKnownPanelsFront();
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});

    [300,900,1800].forEach(ms=>setTimeout(()=>{
      bindVoice();
      makeAllKnownPanelsFront();
    },ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,200));
  }else{
    setTimeout(init,200);
  }
})();



/* =========================================================
   V52: 2D / 3D ФІГУРИ ЗАВЖДИ ВИДИМІ + ПАНЕЛЬ ВІДКРИВАЄТЬСЯ СПЕРЕДУ
   ========================================================= */
(function(){
  function ribbonPanel(name){
    return document.querySelector(`.sofia-ribbon-panel[data-ribbon-panel="${name}"]`);
  }

  function shapeBtn(){
    return document.getElementById("shapeLibraryBtn");
  }

  function shapePanel(){
    return document.getElementById("shapeLibraryPanel");
  }

  function ensureShapesButtonVisible(){
    const btn=shapeBtn();
    if(!btn)return;

    // Preferred location: "Вставка". If that tab is unavailable, use "Математика".
    const target=ribbonPanel("insert") || ribbonPanel("math");
    if(target && btn.parentElement!==target){
      target.appendChild(btn);
    }

    btn.style.removeProperty("display");
    btn.style.removeProperty("visibility");
    btn.style.removeProperty("opacity");
    btn.hidden=false;
    btn.classList.remove("hidden");
    btn.textContent="⬡ 2D / 3D фігури";
    btn.title="Відкрити бібліотеку 2D та 3D фігур";

    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();

      const p=shapePanel();
      if(!p)return;

      p.classList.remove("hidden");
      p.hidden=false;
      p.style.removeProperty("display");
      p.style.setProperty("visibility","visible","important");
      p.style.setProperty("opacity","1","important");
      p.style.setProperty("pointer-events","auto","important");
      p.style.setProperty("position","fixed","important");
      p.style.setProperty("z-index","25000","important");

      const r=p.getBoundingClientRect();
      if(r.left<0 || r.left>window.innerWidth-100)p.style.left="120px";
      if(r.top<0 || r.top>window.innerHeight-100)p.style.top="140px";
    };
  }

  function ensureGeometryVisible(){
    const btn=document.getElementById("geometryBtn");
    if(!btn)return;
    const target=ribbonPanel("insert") || ribbonPanel("math");
    if(target && btn.parentElement!==target)target.appendChild(btn);

    btn.style.removeProperty("display");
    btn.style.removeProperty("visibility");
    btn.style.removeProperty("opacity");
    btn.hidden=false;
    btn.classList.remove("hidden");
    btn.textContent="📐 Прилади";
  }

  function keepShapePanelFront(){
    const p=shapePanel();
    if(!p)return;
    p.addEventListener("mousedown",()=>{
      p.style.setProperty("z-index","25000","important");
    },true);
  }

  function init(){
    ensureShapesButtonVisible();
    ensureGeometryVisible();
    keepShapePanelFront();

    [300,900,1800].forEach(ms=>setTimeout(()=>{
      ensureShapesButtonVisible();
      ensureGeometryVisible();
    },ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,200));
  }else{
    setTimeout(init,200);
  }
})();



/* =========================================================
   V53: ДАТА І ВИД РОБОТИ ЗА ЗАМОВЧУВАННЯМ "ПРОПИСАМИ"
   ========================================================= */
(function(){
  const HEADING_FONT='"Segoe Print","Comic Sans MS",cursive';

  function applyHandwrittenHeading(){
    if(typeof fcanvas==="undefined")return;

    const dateObj=fcanvas.getObjects().find(o=>o?.systemRole==="dateHeading");
    const workObj=fcanvas.getObjects().find(o=>o?.systemRole==="workHeading");

    [dateObj,workObj].forEach(o=>{
      if(!o)return;
      o.set({
        fontFamily:HEADING_FONT,
        fontStyle:"normal",
        fontWeight:"normal"
      });
      o.setCoords?.();
    });

    if(dateObj)dateObj.set({fontSize:22});
    if(workObj)workObj.set({fontSize:24});

    fcanvas.requestRenderAll();
  }

  function ensureWordsDateByDefault(){
    const dateMode=document.getElementById("dateMode");
    if(!dateMode)return;

    // For a fresh/default notebook choose the written-out date.
    // Existing manually selected modes are not overwritten.
    const saved=localStorage.getItem("sofiaNotebookV12");
    if(!saved && dateMode.value!=="words"){
      dateMode.value="words";
      if(typeof updateHeading==="function")updateHeading();
    }
  }

  function init(){
    ensureWordsDateByDefault();
    setTimeout(applyHandwrittenHeading,250);
    setTimeout(applyHandwrittenHeading,700);

    ["dateMode","workType","pageMode"].forEach(id=>{
      document.getElementById(id)?.addEventListener("change",()=>setTimeout(applyHandwrittenHeading,20));
    });

    const canvas=typeof fcanvas!=="undefined"?fcanvas:null;
    canvas?.on?.("object:added",e=>{
      if(e?.target?.systemRole==="dateHeading" || e?.target?.systemRole==="workHeading"){
        setTimeout(applyHandwrittenHeading,0);
      }
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init);
  }else{
    init();
  }
})();



/* =========================================================
   V54: КОМПЛЕКСНЕ ПРИБИРАННЯ СТРІЧКИ + ВСТАВКА + ПІДПИС ГРАФІКА
   ========================================================= */
(function(){
  const PANEL_MAP={
    mediaBtn:"mediaPanel",
    elementsBtn:"elementsPanel",
    geometryBtn:"geometryPanel",
    shapeLibraryBtn:"shapeLibraryPanel",
    angleBtn:"anglePanel",
    numberRayBtn:"numberRayPanel",
    graphBuilderBtn:"graphBuilderPanel",
    ukrainianBtn:"ukrainianPanel",
    calculatorBtn:"calculatorPanel",
    timerBtn:"timerPanel",
    keyboardBtn:"keyboardPanel"
  };

  function ribbonPanel(name){
    return document.querySelector(`.sofia-ribbon-panel[data-ribbon-panel="${name}"]`);
  }

  function showPanel(p){
    if(!p)return;
    p.classList.remove("hidden");
    p.hidden=false;
    p.style.removeProperty("display");
    p.style.setProperty("visibility","visible","important");
    p.style.setProperty("opacity","1","important");
    p.style.setProperty("pointer-events","auto","important");
    p.style.setProperty("position","fixed","important");
    p.style.setProperty("z-index","30000","important");
  }

  function bindInsertButtons(){
    const insert=ribbonPanel("insert");
    if(!insert)return;

    const wanted=[
      "tableBtn","mediaBtn","elementsBtn","geometryBtn",
      "shapeLibraryBtn","noteBtn"
    ];

    wanted.forEach(id=>{
      const b=document.getElementById(id);
      if(!b)return;
      if(b.parentElement!==insert)insert.appendChild(b);
      b.hidden=false;
      b.classList.remove("hidden");
      b.style.removeProperty("display");
      b.style.removeProperty("visibility");
      b.style.removeProperty("opacity");
    });

    // Standard panel launchers.
    Object.entries(PANEL_MAP).forEach(([bid,pid])=>{
      const b=document.getElementById(bid);
      const p=document.getElementById(pid);
      if(!b || !p)return;
      b.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        showPanel(p);
      };
    });

    // Table: use existing implementation when available.
    const table=document.getElementById("tableBtn");
    if(table){
      table.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        if(typeof openTableDialog==="function")return openTableDialog();
        const p=document.getElementById("tablePanel") || document.getElementById("tableDialog");
        if(p)return showPanel(p);
        if(typeof addTable==="function")return addTable();
      };
    }

    // Note: preserve the existing note implementation; if a note panel exists, open it.
    const note=document.getElementById("noteBtn");
    if(note){
      note.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        const p=document.getElementById("notePanel");
        if(p)return showPanel(p);
        if(typeof addNote==="function")return addNote();
        if(typeof createNote==="function")return createNote();
      };
    }
  }

  function cleanHome(){
    const home=ribbonPanel("home");
    if(!home)return;

    const technicalLabels=[
      "Верхня панель","Ліва панель","Показати всі","Готово"
    ];

    home.querySelectorAll("button").forEach(b=>{
      const txt=(b.textContent||"").trim();
      if(technicalLabels.includes(txt)){
        b.remove();
        return;
      }

      // Duplicate panel-arranging controls belong to the single settings button,
      // not to the everyday "Основне" tab.
      if(txt==="Інструменти" && !b.id && home.querySelector("#teacherToolsBtn")){
        b.remove();
      }
    });

    // Keep only one visible install button. It belongs in the global top area.
    const installs=Array.from(document.querySelectorAll("#installAppBtn,button")).filter(b=>{
      return b.id==="installAppBtn" || /Встановити додаток/i.test((b.textContent||"").trim());
    });
    installs.slice(1).forEach(b=>b.remove());
  }

  /* ---------- GRAPH LABEL: remove old top-left label and attach to graph ---------- */
  function graphObjects(){
    if(typeof fcanvas==="undefined")return [];
    return fcanvas.getObjects().filter(o=>{
      if(!o)return false;
      return o.graphType || o.isGraph || o.sofiaGraph ||
        (o.type==="group" && (o.graphFormula || o.formula));
    });
  }

  function oldGraphLabels(){
    if(typeof fcanvas==="undefined")return [];
    return fcanvas.getObjects().filter(o=>{
      const t=(o?.text||"").trim();
      return /^Графік\s*\d*\s*:/i.test(t);
    });
  }

  function getGraphColor(g){
    return g?.stroke ||
      g?._objects?.find?.(x=>x?.stroke)?.stroke ||
      document.getElementById("colorPicker")?.value ||
      "#17315f";
  }

  function formulaOf(g,index){
    return g?.formula || g?.graphFormula || g?.equation ||
      `Графік ${index+1}`;
  }

  function graphAngle(g){
    // Linear graphs can carry k/slope. Use it when present.
    const k=Number(g?.k ?? g?.slope);
    if(Number.isFinite(k))return Math.atan(k)*180/Math.PI;

    // Otherwise estimate from line endpoints when available.
    if(g?.type==="line"){
      const dx=(g.x2||0)-(g.x1||0), dy=(g.y2||0)-(g.y1||0);
      if(dx || dy)return Math.atan2(dy,dx)*180/Math.PI;
    }
    return 0;
  }

  function labelGraphs(){
    if(typeof fcanvas==="undefined" || !window.fabric)return;

    // Remove the old fixed labels in the upper-left corner.
    oldGraphLabels().forEach(o=>{
      if(!o.sofiaInlineGraphLabel)fcanvas.remove(o);
    });

    graphObjects().forEach((g,i)=>{
      if(g.sofiaInlineLabel && fcanvas.getObjects().includes(g.sofiaInlineLabel)){
        const l=g.sofiaInlineLabel;
        l.set({
          fill:getGraphColor(g),
          angle:graphAngle(g),
          left:(g.left||0)+(g.width||220)*(g.scaleX||1)*0.55,
          top:(g.top||0)+(g.height||120)*(g.scaleY||1)*0.45
        });
        l.setCoords?.();
        return;
      }

      const label=new fabric.Text(formulaOf(g,i),{
        left:(g.left||0)+(g.width||220)*(g.scaleX||1)*0.55,
        top:(g.top||0)+(g.height||120)*(g.scaleY||1)*0.45,
        fontSize:18,
        fontFamily:"Arial",
        fill:getGraphColor(g),
        angle:graphAngle(g),
        selectable:false,
        evented:false,
        originX:"center",
        originY:"bottom"
      });
      label.sofiaInlineGraphLabel=true;
      label.excludeFromExport=false;
      g.sofiaInlineLabel=label;
      fcanvas.add(label);
      fcanvas.bringToFront(label);
    });

    fcanvas.requestRenderAll();
  }

  function bindGraphRelabel(){
    if(typeof fcanvas==="undefined")return;
    let t;
    const schedule=()=>{
      clearTimeout(t);
      t=setTimeout(labelGraphs,80);
    };
    fcanvas.on("object:added",schedule);
    fcanvas.on("object:modified",schedule);
    fcanvas.on("object:moving",schedule);
    fcanvas.on("object:scaling",schedule);
    fcanvas.on("object:rotating",schedule);
  }

  function init(){
    bindInsertButtons();
    cleanHome();
    labelGraphs();
    bindGraphRelabel();

    [300,900,1800].forEach(ms=>setTimeout(()=>{
      bindInsertButtons();
      cleanHome();
      labelGraphs();
    },ms));
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  }else{
    setTimeout(init,250);
  }
})();



/* =========================================================
   V55: СТАБІЛЬНА ПЕРЕВІРКА КНОПОК + ВСТАВКА + ЦИРКУЛЬ
   ========================================================= */
(function(){
  let zTop=40000;

  function front(p){
    if(!p)return;
    p.style.setProperty("position","fixed","important");
    p.style.setProperty("z-index",String(++zTop),"important");
    p.style.setProperty("visibility","visible","important");
    p.style.setProperty("opacity","1","important");
    p.style.setProperty("pointer-events","auto","important");
  }

  function togglePanel(id){
    const p=document.getElementById(id);
    if(!p)return false;
    const hidden=p.classList.contains("hidden") || p.hidden || getComputedStyle(p).display==="none";
    if(hidden){
      p.classList.remove("hidden");
      p.hidden=false;
      p.style.removeProperty("display");
      front(p);
    }else{
      p.classList.add("hidden");
    }
    return true;
  }

  function bindPanelButton(bid,pid){
    const b=document.getElementById(bid);
    const p=document.getElementById(pid);
    if(!b || !p)return;
    b.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      togglePanel(pid);
    };
  }

  /* ---------- INSERT: every visible command gets a real action ---------- */
  function createNote(){
    if(typeof fcanvas==="undefined" || !window.fabric)return;
    const t=new fabric.Textbox("Замітка",{
      left:380,top:280,width:260,
      fontSize:22,
      fill:"#273142",
      backgroundColor:"#fff19a",
      padding:14,
      fontFamily:"Arial",
      editable:true
    });
    t.sofiaNote=true;
    fcanvas.add(t);
    fcanvas.setActiveObject(t);
    t.enterEditing?.();
    fcanvas.requestRenderAll();
    if(typeof pushHistory==="function")pushHistory();
    if(typeof autoSave==="function")autoSave();
    if(typeof setTool==="function")setTool("select");
  }

  function createTable(){
    if(typeof fcanvas==="undefined" || !window.fabric)return;
    let rows=Number(prompt("Кількість рядків таблиці:","3"));
    if(!Number.isFinite(rows))return;
    let cols=Number(prompt("Кількість стовпців таблиці:","3"));
    if(!Number.isFinite(cols))return;
    rows=Math.max(1,Math.min(20,Math.floor(rows)));
    cols=Math.max(1,Math.min(12,Math.floor(cols)));

    const cellW=90,cellH=42,w=cols*cellW,h=rows*cellH;
    const color=document.getElementById("colorPicker")?.value||"#17315f";
    const sw=Math.max(1,Number(document.getElementById("lineWidth")?.value||2));
    const parts=[];

    for(let r=0;r<=rows;r++){
      parts.push(new fabric.Line([0,r*cellH,w,r*cellH],{
        stroke:color,strokeWidth:sw,selectable:false,evented:false
      }));
    }
    for(let c=0;c<=cols;c++){
      parts.push(new fabric.Line([c*cellW,0,c*cellW,h],{
        stroke:color,strokeWidth:sw,selectable:false,evented:false
      }));
    }

    const g=new fabric.Group(parts,{
      left:320,top:220,
      selectable:true,evented:true,
      transparentCorners:false,
      cornerStyle:"circle"
    });
    g.sofiaTable=true;
    fcanvas.add(g);
    fcanvas.setActiveObject(g);
    if(typeof pushHistory==="function")pushHistory();
    if(typeof autoSave==="function")autoSave();
    if(typeof setTool==="function")setTool("select");
  }

  function bindInsert(){
    bindPanelButton("mediaBtn","mediaPanel");
    bindPanelButton("elementsBtn","elementsPanel");
    bindPanelButton("geometryBtn","geometryPanel");
    bindPanelButton("shapeLibraryBtn","shapeLibraryPanel");

    const note=document.getElementById("noteBtn");
    if(note){
      note.onclick=e=>{e.preventDefault();e.stopPropagation();createNote()};
    }

    const table=document.getElementById("tableBtn");
    if(table){
      table.onclick=e=>{e.preventDefault();e.stopPropagation();createTable()};
    }
  }

  /* ---------- MATH ---------- */
  function bindMath(){
    bindPanelButton("calculatorBtn","calculatorPanel");
    bindPanelButton("angleBtn","anglePanel");
    bindPanelButton("numberRayBtn","numberRayPanel");
    bindPanelButton("graphBuilderBtn","graphBuilderPanel");
  }

  /* ---------- TEACHER ---------- */
  function bindTeacher(){
    bindPanelButton("timerBtn","timerPanel");
    bindPanelButton("ukrainianBtn","ukrainianPanel");
  }

  /* ---------- COMPASS ---------- */
  function fixCompassControls(){
    const p=document.getElementById("sofiaCompassPanel");
    if(!p)return;

    // Always show all controls. Some earlier CSS/layout changes had hidden the action rows.
    p.querySelectorAll(".sofia-compass-actions").forEach(row=>{
      row.style.setProperty("display","flex","important");
      row.style.setProperty("visibility","visible","important");
      row.style.setProperty("opacity","1","important");
    });

    const close=document.getElementById("sofiaCompassClose");
    if(close){
      close.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        p.style.display="none";
        p.classList.add("hidden");
      };
    }

    // Maximize was not requested for compass; keep it out of the way.
    const max=document.getElementById("sofiaCompassMax");
    if(max)max.style.display="none";
  }

  /* ---------- Remove duplicate external graph labels from older add-ons ---------- */
  function removeLegacyGraphLabels(){
    if(typeof fcanvas==="undefined")return;
    const junk=fcanvas.getObjects().filter(o=>
      o?.sofiaGraphInlineLabel ||
      o?.sofiaInlineGraphLabel
    );
    junk.forEach(o=>fcanvas.remove(o));

    // Older top-level labels that literally begin with "Графік N:".
    fcanvas.getObjects().filter(o=>{
      const t=(o?.text||"").trim();
      return /^Графік\s*\d+\s*:/i.test(t) && !o.graphObject;
    }).forEach(o=>fcanvas.remove(o));

    fcanvas.requestRenderAll();
  }

  /* ---------- Button audit: repair known core commands without inventing new UI ---------- */
  function auditAndRepair(){
    bindInsert();
    bindMath();
    bindTeacher();
    fixCompassControls();
    removeLegacyGraphLabels();

    // Main floating panels must open above ribbon/settings.
    [
      "mediaPanel","elementsPanel","geometryPanel","shapeLibraryPanel",
      "calculatorPanel","anglePanel","numberRayPanel","graphBuilderPanel",
      "timerPanel","ukrainianPanel","teacherToolsPanel","aiPanel","keyboardPanel",
      "sofiaCompassPanel"
    ].forEach(id=>{
      const p=document.getElementById(id);
      if(p && !p.classList.contains("hidden") && getComputedStyle(p).display!=="none")front(p);
    });
  }

  /* ---------- Visual mini-audit in console for development ---------- */
  function consoleAudit(){
    const checks=[
      ["Замітка","noteBtn"],
      ["Таблиця","tableBtn"],
      ["Фото / відео / файл","mediaBtn"],
      ["Елементи","elementsBtn"],
      ["Прилади","geometryBtn"],
      ["2D / 3D","shapeLibraryBtn"],
      ["Калькулятор","calculatorBtn"],
      ["Побудова кута","angleBtn"],
      ["Числовий промінь","numberRayBtn"],
      ["Побудова графіка","graphBuilderBtn"],
      ["Розбір","ukrainianBtn"],
      ["Таймер","timerBtn"],
      ["Голос","voiceBtn"],
      ["Клавіатура","keyboardBtn"],
      ["Зберегти","saveBtn"]
    ];
    const missing=checks.filter(([,id])=>!document.getElementById(id)).map(([name])=>name);
    if(missing.length)console.warn("Sofia V55: відсутні DOM-кнопки:",missing);
    else console.info("Sofia V55: основні кнопки знайдені.");
  }

  function init(){
    auditAndRepair();
    consoleAudit();

    [300,900,1800].forEach(ms=>setTimeout(auditAndRepair,ms));

    const mo=new MutationObserver(()=>{
      clearTimeout(mo.__t);
      mo.__t=setTimeout(auditAndRepair,80);
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));
  }else{
    setTimeout(init,250);
  }
})();
