import {geometry,photograph,clamp,frame} from "./lionni-modello.js";
import {contextFor,renderer} from "./lionni-gpu.js";
import {software} from "./lionni-software.js";
import {unitaPerMetro,creaScala} from "./scala.js?v=3";
const root=document.getElementById("studio"),status=document.getElementById("attesa");
const aggiornaScala=creaScala(document.getElementById("scala"),document.getElementById("valore-scala"));
let unitaModelloPerMetro=0;
let canvas=document.getElementById("scena"),engine=null,needsFrame=false,idleTimer=0,request=0;
const initial={yaw:-2.07,pitch:.115,zoom:1,dx:0,dy:0};
const state={...initial};
const contacts=new Map();
const MIN=.43,MAX=13;
let moving=false;

function draw(){
  needsFrame=false;
  if(!engine||!canvas.clientWidth||!canvas.clientHeight)return;
  const fr=frame(state,canvas.clientWidth,canvas.clientHeight);
  engine.draw(canvas,state,fr,moving);
  aggiornaScala(fr.size*unitaModelloPerMetro,canvas.clientWidth);
}
function schedule(){
  if(!needsFrame){needsFrame=true;requestAnimationFrame(draw);}
}
function active(){
  moving=true;clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{moving=false;schedule();},145);
  schedule();
}
function zoom(factor,x,y){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  const fr=frame(state,width,height);
  const old=state.zoom;state.zoom=clamp(old*factor,MIN,MAX);const change=state.zoom/old;
  state.dx=(x-fr.x)*(1-change)+state.dx;
  state.dy=(y-fr.y)*(1-change)+state.dy;
  boundedPan();
}
function boundedPan(){
  const h=canvas.clientHeight,w=canvas.clientWidth,fr=frame(state,w,h);
  root.classList.toggle("dettaglio",state.zoom>1.55);
  state.dx=clamp(state.dx,-w*.36-fr.size*.3,w*.36+fr.size*.3);
  state.dy=clamp(state.dy,-h*.32-fr.size,h*.32+fr.size);
  document.getElementById("piu").disabled=state.zoom>=MAX-.0001;
  document.getElementById("meno").disabled=state.zoom<=MIN+.0001;
}
function zoomCentre(amount){zoom(amount,canvas.clientWidth/2,canvas.clientHeight/2);active();}
function reset(){Object.assign(state,initial);boundedPan();schedule();}
function rotate(dx,dy){
  state.yaw=(state.yaw-dx*.009)%(Math.PI*2);
  state.pitch=clamp(state.pitch+dy*.008,-Math.PI*.494,Math.PI*.494);
}
function group(){
  const p=[...contacts.values()].slice(0,2);
  if(p.length===2)return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.max(1,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y))};
  return {x:p[0].x,y:p[0].y,d:0};
}
function wire(el){
  el.addEventListener("pointerdown",ev=>{
    if(ev.button>2)return;
    el.classList.add("puntatore");
    ev.preventDefault();el.focus({preventScroll:true});el.setPointerCapture(ev.pointerId);
    contacts.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});el.classList.add("grab");
  });
  el.addEventListener("pointermove",ev=>{
    if(!contacts.has(ev.pointerId))return;
    const last=group();contacts.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});const next=group();
    if(contacts.size>=2){
      zoom(next.d/last.d,last.x,last.y);state.dx+=next.x-last.x;state.dy+=next.y-last.y;boundedPan();
    }else if(ev.shiftKey||(ev.buttons&6)){state.dx+=next.x-last.x;state.dy+=next.y-last.y;boundedPan();}
    else rotate(next.x-last.x,next.y-last.y);
    active();
  });
  function release(ev){contacts.delete(ev.pointerId);if(!contacts.size){el.classList.remove("grab");active();}}
  el.addEventListener("pointerup",release);el.addEventListener("pointercancel",release);el.addEventListener("lostpointercapture",release);
  el.addEventListener("contextmenu",ev=>ev.preventDefault());
  el.addEventListener("wheel",ev=>{
    ev.preventDefault();const delta=ev.deltaY*(ev.deltaMode===1?15:ev.deltaMode===2?canvas.clientHeight:1);
    zoom(Math.exp(clamp(-delta*.0017,-.7,.7)),ev.clientX,ev.clientY);active();
  },{passive:false});
  el.addEventListener("keydown",ev=>{
    el.classList.remove("puntatore");
    const step=ev.shiftKey?28:11;
    switch(ev.key){
      case "ArrowLeft":ev.shiftKey?state.dx-=step:rotate(-step,0);break;
      case "ArrowRight":ev.shiftKey?state.dx+=step:rotate(step,0);break;
      case "ArrowUp":ev.shiftKey?state.dy-=step:rotate(0,-step);break;
      case "ArrowDown":ev.shiftKey?state.dy+=step:rotate(0,step);break;
      case "+":case "=":zoomCentre(1.28);break;
      case "-":case "_":zoomCentre(1/1.28);break;
      case "Home":case "0":reset();break;
      default:return;
    }
    ev.preventDefault();boundedPan();active();
  });
  el.addEventListener("blur",()=>el.classList.remove("puntatore"));
}
document.getElementById("piu").addEventListener("click",()=>zoomCentre(1.43));
document.getElementById("meno").addEventListener("click",()=>zoomCentre(1/1.43));
document.getElementById("centra").addEventListener("click",reset);
let gpuContext=null;
let softwareMode=false;
let pendingGeometry=null;
function loadGeometry(){
  if(!pendingGeometry){
    pendingGeometry=geometry("colonna-027.bin").catch(error=>{
      pendingGeometry=null;
      throw error;
    });
  }
  return pendingGeometry;
}
function freshCanvas(){
  const el=canvas.cloneNode(false);canvas.replaceWith(el);canvas=el;contacts.clear();wire(el);
}
function startSoftware(){
  if(softwareMode)return;
  softwareMode=true;gpuContext=null;engine=null;freshCanvas();
}
async function load(){
  const ticket=++request;
  if(!softwareMode&&!gpuContext){
    gpuContext=contextFor(canvas);
    if(!gpuContext){startSoftware();}
    else canvas.addEventListener("webglcontextlost",ev=>{
      ev.preventDefault();startSoftware();load();
    },{once:true});
  }
  const light=softwareMode,gl=gpuContext;
  status.textContent="Caricamento della superficie.";
  try{
    const smaller=light||gl.getParameter(gl.MAX_TEXTURE_SIZE)<4096;
    const [data,picture]=await Promise.all([
      loadGeometry(),
      photograph(smaller?"pietra-2048.webp?v=3dc62f6666":"pietra-4096.webp?v=9b41a42074")
    ]);
    if(ticket!==request)return;
    unitaModelloPerMetro=unitaPerMetro(data.p,30000,4.4);
    engine=light?software(canvas,data,picture):renderer(gl,data,picture);
    root.dataset.renderer=light?"software":"gpu";status.textContent="";draw();
  }catch(error){
    if(ticket!==request)return;
    if(!light){startSoftware();await load();return;}
    document.getElementById("scala").hidden=true;
    status.textContent="Impossibile caricare la superficie. ";
    const retry=document.createElement("button");retry.type="button";retry.className="riprova";retry.textContent="Riprova";
    retry.addEventListener("click",load);status.append(retry);
  }
}
wire(canvas);
new ResizeObserver(()=>{boundedPan();schedule();}).observe(root);
load();
