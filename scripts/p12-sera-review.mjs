import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildBiblePalette} from '../packages/core/dist/index.js';
import {finishCandidate} from '../packages/cli/dist/commands/candidate-baseline.js';
import {decodePng,encodePng} from '../packages/cli/dist/io/png.js';
import {lineupCommand} from '../packages/cli/dist/commands/lineup.js';
const cwd=process.cwd(),dir=join(cwd,'../seonggeom/outputs/geometry-prototype/art/candidates/hero_sera');
const original=readFileSync(join(dir,'hero_sera_sheet.png')),raw=JSON.parse(readFileSync(join(dir,'hero_sera_manifest.json')));
const bible=JSON.parse(readFileSync('data/projects/seonggeom/seonggeom.bible.json')),rules=JSON.parse(readFileSync('data/rules/default.rules.json'));
const ramps=buildBiblePalette(bible,rules),membership=new Map();
for(const [id,ramp]of Object.entries(ramps.ramps))for(const index of [...ramp.indices,ramp.outline])membership.set(ramps.palette.colors[index]>>>8,id);
const result=finishCandidate(cwd,'hero_sera',original,raw,32),before=decodePng(original),after=decodePng(result.png);
const out='out/P12-sera-review';mkdirSync(out,{recursive:true});writeFileSync(out+'/hero_sera_sheet.png',result.png);writeFileSync(out+'/hero_sera_manifest.json',JSON.stringify(result.manifest,null,2)+'\n');
const hue=(rgb)=>{const c=[rgb>>>16,(rgb>>>8)&255,rgb&255],max=Math.max(...c),min=Math.min(...c),d=max-min;const h=!d?0:max===c[0]?((c[1]-c[2])/d+6)%6*60:max===c[1]?((c[2]-c[0])/d+2)*60:((c[0]-c[1])/d+4)*60;return h>=70&&h<=170&&d/Math.max(1,max)>.12;};
const colors=[...new Set(Array.from({length:before.w*before.h},(_,i)=>before.rgba[i*4+3]?((before.rgba[i*4]<<16)|(before.rgba[i*4+1]<<8)|before.rgba[i*4+2]):-1).filter(c=>c>=0))].sort((a,b)=>a-b);
const rows=[];const [w,h]=raw.frame_size;
for(const [anim,clip] of Object.entries(raw.animations))for(let f=0;f<clip.frames;f++){
 const counts=[0,0],indices=new Set();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const [side,im] of [before,after].entries()){
  const i=(y*im.w+(clip.start_column+f)*w+x)*4;if(!im.rgba[i+3])continue;const c=(im.rgba[i]<<16)|(im.rgba[i+1]<<8)|im.rgba[i+2];if(hue(c)){counts[side]++;if(!side)indices.add(colors.indexOf(c)+1);}
 }
 rows.push({anim,frame:f,green_before:counts[0],green_after:counts[1],indices:[...indices].sort((a,b)=>a-b)});
}
const greenColors=colors.filter(hue).map(c=>({index:colors.indexOf(c)+1,color:'#'+c.toString(16).padStart(6,'0'),materialRamp:membership.get(c)??'비소속'}));
const md=['# P12 세라 녹색 진단/실험','', '주분류(a): 승인 재질 램프 비소속의 녹색 잔여. 공통 팔레트 이전 후보에도 존재하므로 (b)만으로 생긴 현상은 아님. 원본PNG가 없어 (c) 원화 질감 또는 과거 축소/번짐의 인과는 확정할 수 없다. 캐릭터 의상에 승인된 녹색 재질 없음. 원본 없는 제한을 유지하며 미래 Sera 합성은 공통 palette 생성 전 despill, palette 대표색의 재혼합 잔여도 억제한다. 적 피부에는 적용하지 않는다. 기존 게임 후보 교체 없음.','', '인덱스는 기존 PNG의 고유RGB 정렬+1(0투명), PNG 자체는RGBA이므로 원래 인덱스가 아니다. 램프는 buildBiblePalette(현재 바이블/rules)의 정확RGB멤버십.','', '|동작|프레임0기준|녹색전|녹색후|해당인덱스|','|---|---:|---:|---:|---|',...rows.map(r=>`|${r.anim}|${r.frame}|${r.green_before}|${r.green_after}|${r.indices}|`),'','```json',JSON.stringify(greenColors,null,2),'```'];
writeFileSync(out+'/diagnosis.md',md.join('\n')+'\n');writeFileSync(out+'/diagnosis.json',JSON.stringify({rows,greenColors,sourceSha256:createHash('sha256').update(original).digest('hex'),candidateReplaced:false},null,2));
for(let i=3;i<before.rgba.length;i+=4)if(before.rgba[i]!==after.rgba[i])throw Error('alpha changed');if(rows.some(r=>r.green_after))throw Error('green remains');
const list=[];
for(const [a,f]of [['idle',0],['walk',2],['attack',4],['death',0]])for(const [name,im]of [['before',before],['after',after]]){
 const rgba=new Uint8Array(w*h*4);for(let y=0;y<h;y++)rgba.set(im.rgba.subarray((y*im.w+(raw.animations[a].start_column+f)*w)*4,(y*im.w+(raw.animations[a].start_column+f+1)*w)*4),y*w*4);
 rgba.set([255,0,255,255],((raw.anchor[1]+1)*w+raw.anchor[0])*4);const file=`${out}/${a}${f}-${name}.png`;writeFileSync(file,encodePng({w,h,rgba}));list.push(file);
}
lineupCommand(out+'/sera-before-after-2x.png',list,cwd,2);console.log('P12-SERA frames='+rows.length+' green_after=0 alpha=PASS candidateReplaced=false');
