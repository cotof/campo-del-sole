export async function geometry(file) {
  const reply = await fetch(file);
  if (!reply.ok) throw Error("Il modello non è disponibile.");
  const raw = await reply.arrayBuffer();
  const h = new DataView(raw);
  if (raw.byteLength < 16 || h.getUint32(0, false) !== 0x53545035 || h.getUint32(4, true) !== 1) throw Error("Modello incompleto.");
  const nv = h.getUint32(8, true), nf = h.getUint32(12, true);
  let pos = 16;
  function part(Type, len) {
    const data = new Type(raw, pos, len);
    pos = Math.ceil((pos + data.byteLength) / 4) * 4;
    return data;
  }
  const p = part(Float32Array,nv*3);
  const n = part(Int8Array,nv*3);
  const uv = part(Uint16Array,nv*2), triangles = part(Uint32Array,nf*3);
  if (pos !== raw.byteLength || !nv || !nf) throw Error("Dati del modello incompleti.");
  return {p,n,uv,triangles,nv,nf};
}
export async function photograph(file) {
  const img = new Image();
  img.decoding = "async";
  const ready = new Promise((ok, fail) => { img.onload = () => ok(img); img.onerror = () => fail(Error("Texture non disponibile.")); });
  img.src = file;
  return ready;
}
export const clamp = (x,lo,hi) => Math.max(lo,Math.min(hi,x));
export function frame(state,w,h) {
  const cy=Math.cos(state.yaw), sy=Math.sin(state.yaw), cp=Math.cos(state.pitch), sp=Math.sin(state.pitch);
  const narrow=w<=650, small=h<500;
  const top = narrow ? 124 : small ? 18 : 43;
  const bottom = narrow ? 108 : small ? 37 : 62;
  const size = Math.min(Math.max(65,h-top-bottom)/2.01,Math.max(100,w-32)/.53)*state.zoom;
  return {right:[-sy,cy,0],up:[-cy*sp,-sy*sp,cp],eye:[cy*cp,sy*cp,sp],size,x:w*.5+state.dx,y:top+(h-top-bottom)*.5+state.dy};
}
