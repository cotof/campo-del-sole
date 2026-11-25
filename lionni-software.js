import {clamp} from "./lionni-modello.js";
export function software(canvas,geo,picture) {
  const ctx=canvas.getContext("2d",{alpha:true});
  if(!ctx)throw Error("Il browser non consente di disegnare il modello.");
  const atlas=document.createElement("canvas");
  atlas.width=picture.width;atlas.height=picture.height;
  const painter=atlas.getContext("2d",{willReadFrequently:true});
  painter.drawImage(picture,0,0);const pixels=painter.getImageData(0,0,atlas.width,atlas.height).data;
  const tw=atlas.width,th=atlas.height;atlas.width=atlas.height=1;
  const displayTone=Uint8Array.from({length:256},(_,i)=>Math.round(255*Math.pow(i/255,.90)));
  for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)pixels[i+c]=displayTone[pixels[i+c]];}
  const sx=new Float32Array(geo.nv),sy=new Float32Array(geo.nv),dep=new Float32Array(geo.nv);
  const lighting=new Float32Array(geo.nv),su=new Float32Array(geo.nv),sv=new Float32Array(geo.nv);
  for(let i=0;i<geo.nv;i++){su[i]=geo.uv[i*2]*tw/65535-.5;sv[i]=geo.uv[i*2+1]*th/65535-.5;}
  let frameImage=null,zbuf=null;
  return {draw(canvas,s,fr,active){
    const W=canvas.clientWidth,H=canvas.clientHeight;
    const ratio=Math.min(active?.83:1.5,(active?675:1250)/Math.max(200,H),1850/Math.max(200,W),window.devicePixelRatio||1);
    const w=Math.max(1,Math.round(W*ratio)),h=Math.max(1,Math.round(H*ratio));
    if(!frameImage||frameImage.width!==w||frameImage.height!==h||canvas.width!==w||canvas.height!==h){
      canvas.width=w;canvas.height=h;frameImage=ctx.createImageData(w,h);zbuf=new Float32Array(w*h);
    }
    const dest=frameImage.data;dest.fill(0);zbuf.fill(-Infinity);
    const p=geo.p,n=geo.n,r=fr.right,u=fr.up,e=fr.eye;
    const scale=fr.size*ratio/30000,cx=fr.x*ratio,cy=fr.y*ratio;
    const lx=-.58*r[0]+.54*u[0]+.61*e[0],ly=-.58*r[1]+.54*u[1]+.61*e[1],lz=-.58*r[2]+.54*u[2]+.61*e[2];
    for(let i=0,j=0;i<geo.nv;i++,j+=3){
      const x=p[j],y=p[j+1],z=p[j+2];
      sx[i]=cx+scale*(x*r[0]+y*r[1]+z*r[2]);sy[i]=cy-scale*(x*u[0]+y*u[1]+z*u[2]);
      dep[i]=x*e[0]+y*e[1]+z*e[2];
      const nx=n[j],ny=n[j+1],nz=n[j+2];
      const key=Math.max(0,(nx*lx+ny*ly+nz*lz)/127),front=Math.max(0,(nx*e[0]+ny*e[1]+nz*e[2])/127);
      lighting[i]=.86+.27*key+.06*front;
    }
    const face=geo.triangles;
    for(let j=0;j<face.length;j+=3){
      const a=face[j],b=face[j+1],c=face[j+2];
      const xa=sx[a],ya=sy[a],xb=sx[b],yb=sy[b],xc=sx[c],yc=sy[c];
      const den=(yb-yc)*(xa-xc)+(xc-xb)*(ya-yc);
      if(Math.abs(den)<1.e-7)continue;
      const xlo=Math.max(0,Math.ceil(Math.min(xa,xb,xc)-.5)),xhi=Math.min(w-1,Math.floor(Math.max(xa,xb,xc)-.5));
      const ylo=Math.max(0,Math.ceil(Math.min(ya,yb,yc)-.5)),yhi=Math.min(h-1,Math.floor(Math.max(ya,yb,yc)-.5));
      if(xhi<xlo||yhi<ylo)continue;
      const ia=(yb-yc)/den,ja=(xc-xb)/den,ib=(yc-ya)/den,jb=(xa-xc)/den;
      const dzA=dep[a]-dep[c],dzB=dep[b]-dep[c],dlA=lighting[a]-lighting[c],dlB=lighting[b]-lighting[c];
      const duA=su[a]-su[c],duB=su[b]-su[c],dvA=sv[a]-sv[c],dvB=sv[b]-sv[c];
      for(let y=ylo;y<=yhi;y++){
        let wA=ia*(xlo+.5-xc)+ja*(y+.5-yc),wB=ib*(xlo+.5-xc)+jb*(y+.5-yc);
        for(let x=xlo,k=y*w+xlo;x<=xhi;x++,k++,wA+=ia,wB+=ib){
          if(wA<-.00001||wB<-.00001||wA+wB>1.00001)continue;
          const z=dep[c]+wA*dzA+wB*dzB;
          if(z<=zbuf[k])continue;
          zbuf[k]=z;const color=k*4,light=lighting[c]+wA*dlA+wB*dlB;
          const tx=clamp(su[c]+wA*duA+wB*duB,0,tw-1.001),ty=clamp(sv[c]+wA*dvA+wB*dvB,0,th-1.001);
          const ix=tx|0,iy=ty|0,fx=tx-ix,fy=ty-iy,ptr=(iy*tw+ix)*4;
          for(let channel=0;channel<3;channel++){
            const top=pixels[ptr+channel]*(1-fx)+pixels[ptr+4+channel]*fx;
            const bot=pixels[ptr+tw*4+channel]*(1-fx)+pixels[ptr+tw*4+4+channel]*fx;
            dest[color+channel]=8+light*((1-fy)*top+fy*bot);
          }
          dest[color+3]=255;
        }
      }
    }
    ctx.putImageData(frameImage,0,0);
  }};
}
