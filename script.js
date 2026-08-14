* { box-sizing: border-box; }
:root{
  --navy:#17315f;
  --navy2:#102345;
  --bg:#f3f6fb;
  --card:#ffffff;
  --border:#dfe5ef;
  --text:#1c2738;
  --muted:#6d7687;
  --danger:#c73535;
}
body{
  margin:0;
  font-family:Arial, Helvetica, sans-serif;
  background:var(--bg);
  color:var(--text);
}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.hidden{display:none !important}

.app-header{
  min-height:86px;background:#fff;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;padding:14px 24px;
  position:sticky;top:0;z-index:50;
}
.brand{display:flex;align-items:center;gap:14px}
.logo{
  width:52px;height:52px;border-radius:15px;background:var(--navy);color:#fff;
  display:grid;place-items:center;font-weight:700;letter-spacing:1px;
}
.brand h1{margin:0;color:var(--navy);font-size:24px}
.subtitle{font-size:12px;color:var(--muted);margin-top:4px}
.header-actions{display:flex;align-items:center;gap:10px}
.clock-box{display:flex;align-items:center;gap:8px}
#liveClock{font-weight:700;color:var(--navy);min-width:76px;text-align:center}

.btn,.tool,.mini-btn,.panel-action{
  border:1px solid var(--border);background:#f8faff;color:var(--text);
  border-radius:9px;padding:9px 12px;
}
.btn.primary,.tool.active{background:var(--navy);color:#fff;border-color:var(--navy)}
.btn.ai{background:linear-gradient(135deg,#6f52df,#326ce5);color:#fff;border:none}
.btn.secondary{background:#fff}
.btn.danger-soft,.tool.danger{background:#fff3f3;color:var(--danger);border-color:#f0cccc}

.app{max-width:1500px;margin:auto;padding:24px}
.card{
  background:var(--card);border:1px solid #edf0f5;border-radius:18px;
  box-shadow:0 7px 28px rgba(20,40,80,.05);
}
.meta-panel{
  display:grid;grid-template-columns:1.35fr .8fr 1fr 1fr .8fr 1fr;
  gap:14px;padding:16px;margin-bottom:16px;
}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;font-weight:700;color:#586276}
.field input,.field select{
  width:100%;padding:11px 12px;border:1px solid #d8deea;border-radius:9px;background:#fff;outline:none;
}
.field input:focus,.field select:focus{border-color:var(--navy)}

.toolbar{
  padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px;
}
.tool-group{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding-right:10px;border-right:1px solid #edf0f5}
.tool{padding:8px 10px;background:#fff}
.tool:hover,.mini-btn:hover,.panel-action:hover{background:#eef3fb}
.tool.active:hover{background:var(--navy2)}
.tool-group.compact label{font-size:12px;color:#5e687a;display:flex;align-items:center;gap:5px}
.tool-group select{border:1px solid #d8deea;border-radius:7px;padding:6px}
#colorPicker{width:36px;height:30px;padding:0;border:1px solid #ccd4e1;border-radius:5px}
#lineWidth{width:110px}
.mini-btn{min-width:34px;padding:7px}

.workspace{padding:16px}
.page-topbar{
  display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap
}
.page-nav,.zoom{display:flex;align-items:center;gap:8px}
#pageViewport{
  overflow:auto;background:#e9eef6;border-radius:12px;padding:18px;min-height:650px;
}
.notebook{
  width:1120px;min-height:790px;margin:auto;position:relative;background:#fff;
  border:1px solid #cfd7e4;box-shadow:0 8px 30px rgba(21,39,70,.12);
  transform-origin:top center;overflow:hidden;
}
.page-heading{
  position:absolute;top:22px;left:50%;transform:translateX(-50%);
  z-index:5;text-align:center;font-family:Georgia,serif;font-size:21px;line-height:1.45;
  pointer-events:none;min-width:280px;color:#182642;
}
#workHeading{font-weight:700}

.paper-grid5{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px),linear-gradient(90deg,#d8e5f2 1px,transparent 1px);
  background-size:25px 25px;
}
.paper-grid10{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px),linear-gradient(90deg,#d8e5f2 1px,transparent 1px);
  background-size:50px 50px;
}
.paper-lines{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px);
  background-size:100% 32px;
}
.paper-slant{
  background-image:
    linear-gradient(#dbe7f3 1px,transparent 1px),
    repeating-linear-gradient(65deg,transparent 0 25px,rgba(210,224,239,.8) 26px,transparent 27px 52px);
  background-size:100% 32px,100% 32px;
}
.paper-music{
  background-image:repeating-linear-gradient(to bottom,transparent 0 16px,#b9c9dd 17px,#b9c9dd 18px,transparent 19px 24px);
  background-size:100% 120px;
}
.paper-millimeter{
  background-image:
    linear-gradient(rgba(204,218,234,.75) 1px,transparent 1px),
    linear-gradient(90deg,rgba(204,218,234,.75) 1px,transparent 1px),
    linear-gradient(rgba(161,185,213,.7) 1px,transparent 1px),
    linear-gradient(90deg,rgba(161,185,213,.7) 1px,transparent 1px);
  background-size:10px 10px,10px 10px,50px 50px,50px 50px;
}
.paper-clean{background-image:none}

#drawingCanvas{position:absolute;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
.text-layer{
  position:absolute;inset:0;z-index:3;padding:92px 45px 45px;outline:none;
  pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;
}
.text-layer.active{pointer-events:auto}
.objects-layer{position:absolute;inset:0;z-index:4;pointer-events:none}
.embedded-object{
  position:absolute;min-width:80px;min-height:40px;border:1px dashed transparent;
  pointer-events:auto;background:rgba(255,255,255,.82);padding:4px;border-radius:8px;
}
.embedded-object:hover{border-color:#6a82ac}
.embedded-object img,.embedded-object iframe{max-width:100%;display:block;border-radius:6px}
.object-delete{
  position:absolute;right:-9px;top:-9px;width:24px;height:24px;border-radius:50%;
  border:none;background:#d94b4b;color:#fff;display:none
}
.embedded-object:hover .object-delete{display:block}
.sticker-object{font-size:44px;background:transparent;border:none}
.table-object table{border-collapse:collapse;background:white}
.table-object td,.table-object th{border:1px solid #253958;padding:8px;min-width:70px}

.geometry-overlay{
  position:absolute;z-index:15;user-select:none;touch-action:none;
  border:1px solid rgba(25,49,95,.35);background:rgba(221,231,247,.62);
  box-shadow:0 5px 18px rgba(20,40,80,.15)
}
.drag-handle{font-size:11px;padding:5px 8px;background:rgba(23,49,95,.88);color:#fff;cursor:move}
.ruler{left:130px;top:220px;width:520px;height:80px}
.ruler .ticks{
  height:48px;background:repeating-linear-gradient(90deg,#243b62 0 1px,transparent 1px 10px);
  mask:linear-gradient(to bottom,#000 0 55%,transparent 56%);
}
.protractor{left:420px;top:270px;width:300px;height:160px;border-radius:300px 300px 0 0;overflow:hidden}
.protractor-face{
  height:125px;display:grid;place-items:end center;padding-bottom:8px;
  background:repeating-conic-gradient(from 270deg at 50% 100%,rgba(23,49,95,.6) 0 1deg,transparent 1deg 10deg);
}
.setsquare{left:250px;top:400px;width:260px;height:220px;background:transparent;border:none}
.triangle-face{
  width:0;height:0;border-left:0 solid transparent;border-right:260px solid transparent;
  border-bottom:190px solid rgba(210,224,243,.62);filter:drop-shadow(0 2px 2px rgba(0,0,0,.15))
}
.compass{left:700px;top:260px;width:150px;height:235px;text-align:center}
.compass-body{font-size:130px;line-height:150px;color:#263f68}
.tiny-action{border:none;border-radius:6px;padding:6px 8px;background:var(--navy);color:#fff}

.statusbar{
  display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12px;color:var(--muted)
}

.floating-panel{
  position:fixed;right:24px;top:105px;z-index:120;width:330px;max-height:70vh;overflow:auto;
  background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 45px rgba(10,30,60,.22);padding:12px
}
.panel-title{display:flex;justify-content:space-between;align-items:center;font-weight:700;color:var(--navy);margin-bottom:12px}
.panel-title button{border:none;background:transparent;font-size:24px;color:#667085}
.symbol-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}
.symbol-btn{
  border:1px solid var(--border);background:#fff;border-radius:8px;padding:10px 5px;font-size:20px
}
.panel-action{width:100%;text-align:left;margin:4px 0;background:#fff}

.modal{
  position:fixed;inset:0;z-index:200;background:rgba(11,24,44,.44);
  display:grid;place-items:center;padding:20px
}
.modal-card{
  width:min(480px,95vw);background:#fff;border-radius:18px;box-shadow:0 25px 80px rgba(0,0,0,.28);padding:18px
}
.modal-card.large{width:min(700px,95vw)}
.modal textarea,.modal input,.modal select{
  width:100%;border:1px solid #d8deea;border-radius:9px;padding:10px;margin:6px 0
}
.timer-display{text-align:center;font-size:48px;font-weight:700;color:var(--navy);margin:18px 0}
.timer-row{display:flex;gap:8px;align-items:center;margin-top:10px}
.muted{color:var(--muted);font-size:13px;line-height:1.5}

@media(max-width:1100px){
  .meta-panel{grid-template-columns:repeat(3,1fr)}
  .notebook{width:1000px}
}
@media(max-width:720px){
  .app{padding:10px}.app-header{padding:10px}.subtitle{display:none}
  .meta-panel{grid-template-columns:1fr 1fr}
  .header-actions .clock-box{display:none}
  .toolbar{align-items:flex-start}
}
* { box-sizing: border-box; }
:root{
  --navy:#17315f;
  --navy2:#102345;
  --bg:#f3f6fb;
  --card:#ffffff;
  --border:#dfe5ef;
  --text:#1c2738;
  --muted:#6d7687;
  --danger:#c73535;
}
body{
  margin:0;
  font-family:Arial, Helvetica, sans-serif;
  background:var(--bg);
  color:var(--text);
}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.hidden{display:none !important}

.app-header{
  min-height:86px;background:#fff;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;padding:14px 24px;
  position:sticky;top:0;z-index:50;
}
.brand{display:flex;align-items:center;gap:14px}
.logo{
  width:52px;height:52px;border-radius:15px;background:var(--navy);color:#fff;
  display:grid;place-items:center;font-weight:700;letter-spacing:1px;
}
.brand h1{margin:0;color:var(--navy);font-size:24px}
.subtitle{font-size:12px;color:var(--muted);margin-top:4px}
.header-actions{display:flex;align-items:center;gap:10px}
.clock-box{display:flex;align-items:center;gap:8px}
#liveClock{font-weight:700;color:var(--navy);min-width:76px;text-align:center}

.btn,.tool,.mini-btn,.panel-action{
  border:1px solid var(--border);background:#f8faff;color:var(--text);
  border-radius:9px;padding:9px 12px;
}
.btn.primary,.tool.active{background:var(--navy);color:#fff;border-color:var(--navy)}
.btn.ai{background:linear-gradient(135deg,#6f52df,#326ce5);color:#fff;border:none}
.btn.secondary{background:#fff}
.btn.danger-soft,.tool.danger{background:#fff3f3;color:var(--danger);border-color:#f0cccc}

.app{max-width:1500px;margin:auto;padding:24px}
.card{
  background:var(--card);border:1px solid #edf0f5;border-radius:18px;
  box-shadow:0 7px 28px rgba(20,40,80,.05);
}
.meta-panel{
  display:grid;grid-template-columns:1.35fr .8fr 1fr 1fr .8fr 1fr;
  gap:14px;padding:16px;margin-bottom:16px;
}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;font-weight:700;color:#586276}
.field input,.field select{
  width:100%;padding:11px 12px;border:1px solid #d8deea;border-radius:9px;background:#fff;outline:none;
}
.field input:focus,.field select:focus{border-color:var(--navy)}

.toolbar{
  padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px;
}
.tool-group{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding-right:10px;border-right:1px solid #edf0f5}
.tool{padding:8px 10px;background:#fff}
.tool:hover,.mini-btn:hover,.panel-action:hover{background:#eef3fb}
.tool.active:hover{background:var(--navy2)}
.tool-group.compact label{font-size:12px;color:#5e687a;display:flex;align-items:center;gap:5px}
.tool-group select{border:1px solid #d8deea;border-radius:7px;padding:6px}
#colorPicker{width:36px;height:30px;padding:0;border:1px solid #ccd4e1;border-radius:5px}
#lineWidth{width:110px}
.mini-btn{min-width:34px;padding:7px}

.workspace{padding:16px}
.page-topbar{
  display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap
}
.page-nav,.zoom{display:flex;align-items:center;gap:8px}
#pageViewport{
  overflow:auto;background:#e9eef6;border-radius:12px;padding:18px;min-height:650px;
}
.notebook{
  width:1120px;min-height:790px;margin:auto;position:relative;background:#fff;
  border:1px solid #cfd7e4;box-shadow:0 8px 30px rgba(21,39,70,.12);
  transform-origin:top center;overflow:hidden;
}
.page-heading{
  position:absolute;top:22px;left:50%;transform:translateX(-50%);
  z-index:5;text-align:center;font-family:Georgia,serif;font-size:21px;line-height:1.45;
  pointer-events:none;min-width:280px;color:#182642;
}
#workHeading{font-weight:700}

.paper-grid5{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px),linear-gradient(90deg,#d8e5f2 1px,transparent 1px);
  background-size:25px 25px;
}
.paper-grid10{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px),linear-gradient(90deg,#d8e5f2 1px,transparent 1px);
  background-size:50px 50px;
}
.paper-lines{
  background-image:linear-gradient(#d8e5f2 1px,transparent 1px);
  background-size:100% 32px;
}
.paper-slant{
  background-image:
    linear-gradient(#dbe7f3 1px,transparent 1px),
    repeating-linear-gradient(65deg,transparent 0 25px,rgba(210,224,239,.8) 26px,transparent 27px 52px);
  background-size:100% 32px,100% 32px;
}
.paper-music{
  background-image:repeating-linear-gradient(to bottom,transparent 0 16px,#b9c9dd 17px,#b9c9dd 18px,transparent 19px 24px);
  background-size:100% 120px;
}
.paper-millimeter{
  background-image:
    linear-gradient(rgba(204,218,234,.75) 1px,transparent 1px),
    linear-gradient(90deg,rgba(204,218,234,.75) 1px,transparent 1px),
    linear-gradient(rgba(161,185,213,.7) 1px,transparent 1px),
    linear-gradient(90deg,rgba(161,185,213,.7) 1px,transparent 1px);
  background-size:10px 10px,10px 10px,50px 50px,50px 50px;
}
.paper-clean{background-image:none}

#drawingCanvas{position:absolute;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
.text-layer{
  position:absolute;inset:0;z-index:3;padding:92px 45px 45px;outline:none;
  pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;
}
.text-layer.active{pointer-events:auto}
.objects-layer{position:absolute;inset:0;z-index:4;pointer-events:none}
.embedded-object{
  position:absolute;min-width:80px;min-height:40px;border:1px dashed transparent;
  pointer-events:auto;background:rgba(255,255,255,.82);padding:4px;border-radius:8px;
}
.embedded-object:hover{border-color:#6a82ac}
.embedded-object img,.embedded-object iframe{max-width:100%;display:block;border-radius:6px}
.object-delete{
  position:absolute;right:-9px;top:-9px;width:24px;height:24px;border-radius:50%;
  border:none;background:#d94b4b;color:#fff;display:none
}
.embedded-object:hover .object-delete{display:block}
.sticker-object{font-size:44px;background:transparent;border:none}
.table-object table{border-collapse:collapse;background:white}
.table-object td,.table-object th{border:1px solid #253958;padding:8px;min-width:70px}

.geometry-overlay{
  position:absolute;z-index:15;user-select:none;touch-action:none;
  border:1px solid rgba(25,49,95,.35);background:rgba(221,231,247,.62);
  box-shadow:0 5px 18px rgba(20,40,80,.15)
}
.drag-handle{font-size:11px;padding:5px 8px;background:rgba(23,49,95,.88);color:#fff;cursor:move}
.ruler{left:130px;top:220px;width:520px;height:80px}
.ruler .ticks{
  height:48px;background:repeating-linear-gradient(90deg,#243b62 0 1px,transparent 1px 10px);
  mask:linear-gradient(to bottom,#000 0 55%,transparent 56%);
}
.protractor{left:420px;top:270px;width:300px;height:160px;border-radius:300px 300px 0 0;overflow:hidden}
.protractor-face{
  height:125px;display:grid;place-items:end center;padding-bottom:8px;
  background:repeating-conic-gradient(from 270deg at 50% 100%,rgba(23,49,95,.6) 0 1deg,transparent 1deg 10deg);
}
.setsquare{left:250px;top:400px;width:260px;height:220px;background:transparent;border:none}
.triangle-face{
  width:0;height:0;border-left:0 solid transparent;border-right:260px solid transparent;
  border-bottom:190px solid rgba(210,224,243,.62);filter:drop-shadow(0 2px 2px rgba(0,0,0,.15))
}
.compass{left:700px;top:260px;width:150px;height:235px;text-align:center}
.compass-body{font-size:130px;line-height:150px;color:#263f68}
.tiny-action{border:none;border-radius:6px;padding:6px 8px;background:var(--navy);color:#fff}

.statusbar{
  display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12px;color:var(--muted)
}

.floating-panel{
  position:fixed;right:24px;top:105px;z-index:120;width:330px;max-height:70vh;overflow:auto;
  background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 14px 45px rgba(10,30,60,.22);padding:12px
}
.panel-title{display:flex;justify-content:space-between;align-items:center;font-weight:700;color:var(--navy);margin-bottom:12px}
.panel-title button{border:none;background:transparent;font-size:24px;color:#667085}
.symbol-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}
.symbol-btn{
  border:1px solid var(--border);background:#fff;border-radius:8px;padding:10px 5px;font-size:20px
}
.panel-action{width:100%;text-align:left;margin:4px 0;background:#fff}

.modal{
  position:fixed;inset:0;z-index:200;background:rgba(11,24,44,.44);
  display:grid;place-items:center;padding:20px
}
.modal-card{
  width:min(480px,95vw);background:#fff;border-radius:18px;box-shadow:0 25px 80px rgba(0,0,0,.28);padding:18px
}
.modal-card.large{width:min(700px,95vw)}
.modal textarea,.modal input,.modal select{
  width:100%;border:1px solid #d8deea;border-radius:9px;padding:10px;margin:6px 0
}
.timer-display{text-align:center;font-size:48px;font-weight:700;color:var(--navy);margin:18px 0}
.timer-row{display:flex;gap:8px;align-items:center;margin-top:10px}
.muted{color:var(--muted);font-size:13px;line-height:1.5}

@media(max-width:1100px){
  .meta-panel{grid-template-columns:repeat(3,1fr)}
  .notebook{width:1000px}
}
@media(max-width:720px){
  .app{padding:10px}.app-header{padding:10px}.subtitle{display:none}
  .meta-panel{grid-template-columns:1fr 1fr}
  .header-actions .clock-box{display:none}
  .toolbar{align-items:flex-start}
}
