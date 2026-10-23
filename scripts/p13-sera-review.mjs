import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {finishCandidate} from '../packages/cli/dist/commands/candidate-baseline.js';
import {decodePng,encodePng} from '../packages/cli/dist/io/png.js';
import {lineupCommand} from '../packages/cli/dist/commands/lineup.js';
const cwd=process.cwd(),src='out/P13-sera-before',out='out/P13-sera-review';mkdirSync(out,{recursive:true});
const old=readFileSync(join(src,'hero_sera_sheet.png')),raw=JSON.parse(readFileSync(join(src,'hero_sera_manifest.json')));
const result=finishCandidate(cwd,'hero_sera',old,raw,32);result.manifest.provenance.processingStages=['despill-before-palette'];result.manifest.provenance.adoption='P12 review addendum section16: candidate only; exact HSV boundary correction';
writeFileSync(join(out,'hero_sera_sheet.png'),result.png);writeFileSync(join(out,'hero_sera_manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
const before=decodePng(old),after=decodePng(result.png),rows=[];
const green=(r,g,b)=>{const max=Math.max(r,g,b),d=max-Math.min(r,g,b);return d>0&&g===max&&Math.abs(6*(b-r))<=5*d&&100*d>12*max;};
const [w,h]=raw.frame_size;
for(const [anim,clip]of Object.entries(raw.animations))for(let frame=0;frame<clip.frames;frame++){
 const counts=[0,0];for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const [side,img]of [before,after].entries()){
  const at=(y*img.w+(clip.start_column+frame)*w+x)*4;if(img.rgba[at+3]&&green(...img.rgba.subarray(at,at+3)))counts[side]++;
 }
 rows.push({anim,frame,green_before:counts[0],green_after:counts[1]});
}
for(let i=3;i<before.rgba.length;i+=4)if(before.rgba[i]!==after.rgba[i])throw Error('alpha changed');
if(rows.some(r=>r.green_after))throw Error('green remains');
writeFileSync(join(out,'diagnosis.json'),JSON.stringify({rows,green_after:0,alpha_identical:true,criterion:'exact integer HSV H70..170 inclusive, S>.12; old float check missed H70 boundary'},null,2)+'\n');
const list=[];
for(const [anim,frame]of [['idle',0],['walk',2],['attack',4],['death',0]])for(const [side,img]of [['before',before],['after',after]]){
 const rgba=new Uint8Array(w*h*4);for(let y=0;y<h;y++)rgba.set(img.rgba.subarray((y*img.w+(raw.animations[anim].start_column+frame)*w)*4,(y*img.w+(raw.animations[anim].start_column+frame+1)*w)*4),y*w*4);
 const path=`${out}/${anim}${frame}-${side}.png`;writeFileSync(path,encodePng({w,h,rgba}));list.push(path);
}
lineupCommand(out+'/sera-cleanup-lineup.png',list,cwd,2);console.log('P13-SERA 33 frames green=0 alpha=identical');
