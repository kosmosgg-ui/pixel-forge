import type { RgbaImage } from './types.js';
import { cornerBackground, despillEdgesInPlace, removeBackgroundInPlace } from './background.js';
import { ForgeError } from '@pixel-forge/core';
export function clearIllustrationKeyInPlace(img: RgbaImage): void {
 const key=cornerBackground(img);if(!key)return;
 const green=key[1]>key[0]+80&&key[1]>key[2]+80,magenta=key[0]>key[1]+80&&key[2]>key[1]+80;
 if(!green&&!magenta)return;
 removeBackgroundInPlace(img);
 for(let k=0;k<img.rgba.length;k+=4){const r=img.rgba[k]??0,g=img.rgba[k+1]??0,b=img.rgba[k+2]??0;
  if(green&&r<=64&&b<=64&&g>Math.max(r,b)+40||magenta&&g<=64&&r>g+40&&b>g+40)img.rgba[k+3]=0;
 }
 despillEdgesInPlace(img,key,2);
}
export function imageBounds(img:RgbaImage){
 let x0=img.w,y0=img.h,x1=-1,y1=-1;
 for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++)if(img.rgba[(y*img.w+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)throw new ForgeError('image.empty','No foreground');return{x0,y0,w:x1-x0+1,h:y1-y0+1};
}
// Approved illustration exception: premultiplied bilinear filtering, no quantization.
export function fitIllustration(src:RgbaImage,width:number,height:number,key=true):RgbaImage{
 const img={...src,rgba:new Uint8Array(src.rgba)};if(key)clearIllustrationKeyInPlace(img);
 const b=key?imageBounds(img):{x0:0,y0:0,w:img.w,h:img.h},scale=Math.min(1,(width-40)/b.w,(height-40)/b.h);
 const w=Math.max(1,Math.floor(b.w*scale)),h=Math.max(1,Math.floor(b.h*scale)),ox=Math.floor((width-w)/2),oy=Math.floor((height-h)/2),out={w:width,h:height,rgba:new Uint8Array(width*height*4)};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=b.x0+(x+.5)/scale-.5,sy=b.y0+(y+.5)/scale-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,v=[0,0,0,0];
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
   const tx=Math.max(0,Math.min(img.w-1,ix+dx)),ty=Math.max(0,Math.min(img.h-1,iy+dy)),at=(ty*img.w+tx)*4,a=(img.rgba[at+3]??0)/255,weight=(dx?fx:1-fx)*(dy?fy:1-fy);
   v[3]=(v[3]??0)+a*weight;for(let c=0;c<3;c++)v[c]=(v[c]??0)+(img.rgba[at+c]??0)*a*weight;
  }
  const at=((oy+y)*width+ox+x)*4,a=v[3]??0;out.rgba.set([Math.round((v[0]??0)/(a||1)),Math.round((v[1]??0)/(a||1)),Math.round((v[2]??0)/(a||1)),Math.round(a*255)],at);
 }
 return out;
}
