import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,relative} from 'node:path';
import {z} from 'zod';
import {ForgeError} from '@pixel-forge/core';
import {boxDownscale,clearIllustrationKeyInPlace,fitIllustration,imageBounds,medianCut,quantize} from '@pixel-forge/import';
import {decodePng,encodePng,type RgbaImage} from '../io/png.js';
import {resolveInside} from '../io/paths.js';
import {resolveOut} from '../io/targets.js';
import {writeFileEnsured} from '../io/files.js';
const schema=z.object({kind:z.enum(['prop','ground','keyart']),as:z.string().regex(/^[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*$/),at:z.string().optional(),out:z.string().optional(),size:z.union([z.literal(16),z.literal(32)]).optional()});
function pixelAsset(source:RgbaImage,kind:string,size:number){
 const img={...source,rgba:new Uint8Array(source.rgba)};if(kind==='prop')clearIllustrationKeyInPlace(img);
 const b=kind==='prop'?imageBounds(img):{x0:0,y0:0,w:img.w,h:img.h},crop={w:b.w,h:b.h,rgba:new Uint8Array(b.w*b.h*4)};
 for(let y=0;y<b.h;y++)crop.rgba.set(img.rgba.subarray(((b.y0+y)*img.w+b.x0)*4,((b.y0+y)*img.w+b.x0+b.w)*4),y*b.w*4);
 const small=boxDownscale(crop,Math.min(1,size/Math.max(crop.w,crop.h)),128),palette=medianCut([small],24),q=quantize(small,palette),out={...small,rgba:new Uint8Array(small.w*small.h*4)};
 for(let i=0;i<q.px.length;i++){const index=q.px[i]??0;if(index){const c=palette[index-1]??0;out.rgba.set([c>>>16,c>>>8&255,c&255,255],i*4);}}
 return{image:out,palette};
}
function seam(img:RgbaImage):number{
 let total=0,n=0;
 const compare=(a:number,b:number)=>{for(let c=0;c<3;c++){total+=Math.abs((img.rgba[a+c]??0)-(img.rgba[b+c]??0));n++;}};
 for(let y=0;y<img.h;y++)compare(y*img.w*4,(y*img.w+img.w-1)*4);
 for(let x=0;x<img.w;x++)compare(x*4,((img.h-1)*img.w+x)*4);
 return total/Math.max(1,n);
}
export function intakeAsset(file:string,cwd:string,options:{kind?:string;as?:string;at?:string;out?:string;size?:number}){
 const o=schema.parse(options),source=resolveInside(cwd,file),bytes=readFileSync(source),image=decodePng(bytes),[actor='',name='']=o.as.split('/');
 if(o.kind==='ground'&&image.w!==image.h)throw new ForgeError('ground.square','Ground source must be square');
 const sha=createHash('sha256').update(bytes).digest('hex'),createdAt=o.at??statSync(source).mtime.toISOString(),stamp=createdAt.replace(/[-:]/g,'').replace(/\.\d+/,'')+'_'+sha.slice(0,8);
 const raw=join('data/import',actor,o.kind,name,stamp+'.png');writeFileEnsured(join(cwd,raw),bytes);
 writeFileSync(join(cwd,raw.replace(/\.png$/,'.intake.json')),JSON.stringify({origin:'chatgpt-manual',model:'미확인',createdAt,sourceName:basename(source),sha256:sha,size:[image.w,image.h],warnings:[]},null,2)+'\n');
 const size=o.kind==='ground'?(o.size??32):96,pixel=o.kind==='keyart'?undefined:pixelAsset(image,o.kind,size),out=pixel?.image??fitIllustration(image,1280,720,false),assetId=o.kind+'_'+actor+'_'+name;
 const local=join(cwd,'out/generated',assetId),dest=resolveInside(resolveOut(cwd,o.out??'out'),join('art/candidates',assetId));
 const metric=o.kind==='ground'?seam(out):0;
 const manifest={assetId,kind:o.kind,quality:o.kind==='keyart'||o.kind==='ground'?'proposal':'candidate',size:[out.w,out.h],anchor:[Math.floor(out.w/2),out.h-1],display_scale:2,sourceSha256:sha,
  provenance:{assetId,creator:'미확인',sourceUrl:'',license:'사용자 생성물; 권리 확인 필요',aiUsed:true,promptRecord:'',editedBy:'pixel-forge asset intake',sourceFile:raw,exportFile:'asset.png',rightsReviewed:false,creditText:''},
  qa:{palette:pixel?.palette.length??null,seamMeanRGB:metric,pass:metric<=12,scope:'technical; art grade and approval separate'}};
 for(const folder of new Set([local,dest])){writeFileEnsured(join(folder,'asset.png'),encodePng(out));writeFileSync(join(folder,assetId+'_manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
 return{ok:true as const,cmd:'intake',kind:o.kind,actor,stamp,out:raw,outputDirs:[local,dest],dest:relative(cwd,dest),qa:manifest.qa};
}
