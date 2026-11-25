const vs = `
attribute vec3 aP;
attribute vec3 aN;
attribute vec2 aUv;
uniform vec3 uRight,uUp,uEye;
uniform vec2 uScale,uCentre;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 p = aP / 30000.0;
  gl_Position = vec4(uCentre + vec2(dot(p,uRight),dot(p,uUp))*uScale,-dot(p,uEye)*0.75,1.0);
  vN = vec3(dot(aN,uRight),dot(aN,uUp),dot(aN,uEye));
  vUv = aUv;
}`;
const fs = `
uniform sampler2D uStone;
varying vec2 vUv;
varying vec3 vN;
void main(){
  vec3 n = normalize(vN);
  float key = max(dot(n,vec3(-.58,.54,.61)),0.0);
  float front = max(n.z,0.0);
  vec3 stone = pow(texture2D(uStone,vUv).rgb,vec3(.90));
  vec3 photographic = stone*(.89+.27*key+.06*front)+.030*(1.-stone);
  gl_FragColor = vec4(photographic,1.);
}`;
export function contextFor(canvas){
  const opts={alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:"default"};
  const gl=canvas.getContext("webgl",opts) || canvas.getContext("experimental-webgl",opts);
  if (!gl || !gl.getExtension("OES_element_index_uint") || gl.getParameter(gl.MAX_TEXTURE_SIZE)<2048) return null;
  return gl;
}
export function renderer(gl,geo,picture) {
  const high=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  const precision=high&&high.precision>0?"highp":"mediump";
  function shader(type,src){
    const sh=gl.createShader(type);gl.shaderSource(sh,"precision "+precision+" float;\n"+src);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error("Impossibile inizializzare la scena.");
    return sh;
  }
  const prog=gl.createProgram();
  const a=shader(gl.VERTEX_SHADER,vs),b=shader(gl.FRAGMENT_SHADER,fs);
  gl.attachShader(prog,a);gl.attachShader(prog,b);gl.linkProgram(prog);
  gl.deleteShader(a);gl.deleteShader(b);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error("Impossibile inizializzare la scena.");
  gl.useProgram(prog);
  const attr={};for(const name of ["aP","aN","aUv"]){attr[name]=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(attr[name]);}
  const u={};for(const name of ["uScale","uCentre","uRight","uUp","uEye","uStone"])u[name]=gl.getUniformLocation(prog,name);
  function upload(data,kind=gl.ARRAY_BUFFER){
    const buf=gl.createBuffer();gl.bindBuffer(kind,buf);gl.bufferData(kind,data,gl.STATIC_DRAW);return buf;
  }
  const pos=upload(geo.p),normal=upload(geo.n),uv=upload(geo.uv),faces=upload(geo.triangles,gl.ELEMENT_ARRAY_BUFFER);
  const tx=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,picture);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(u.uStone,0);gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  if(gl.getError()!==gl.NO_ERROR)throw Error("Memoria grafica insufficiente.");
  function bind(name,buffer,count,type,normalized){
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(attr[name],count,type,normalized,0,0);
  }
  return {draw(canvas,s,frame){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const dpr=Math.min(window.devicePixelRatio||1,2,2350/Math.max(w,h));
    const iw=Math.max(1,Math.round(w*dpr)),ih=Math.max(1,Math.round(h*dpr));
    if(canvas.width!==iw||canvas.height!==ih){canvas.width=iw;canvas.height=ih;}
    gl.useProgram(prog);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx);
    for(const key of Object.values(attr))gl.enableVertexAttribArray(key);
    gl.uniform1i(u.uStone,0);
    gl.viewport(0,0,iw,ih);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(u.uScale,2*frame.size/w,2*frame.size/h);gl.uniform2f(u.uCentre,2*frame.x/w-1,1-2*frame.y/h);
    gl.uniform3fv(u.uRight,frame.right);gl.uniform3fv(u.uUp,frame.up);gl.uniform3fv(u.uEye,frame.eye);
    bind("aP",pos,3,gl.SHORT,false);bind("aN",normal,3,gl.BYTE,true);bind("aUv",uv,2,gl.UNSIGNED_SHORT,true);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,faces);gl.drawElements(gl.TRIANGLES,geo.triangles.length,gl.UNSIGNED_INT,0);
  }};
}
