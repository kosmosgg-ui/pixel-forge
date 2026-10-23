import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {decodePng,encodePng} from '../packages/cli/dist/io/png.js';
import {slashGeometry} from '../packages/cli/dist/commands/fx-geometry.js';
import {lineupCommand} from '../packages/cli/dist/commands/lineup.js';
const pairs=JSON.parse(readFileSync('data/projects/seonggeom/fx/attack-specs.json')).pairs,out='out/P12-fx-analysis';mkdirSync(out,{recursive:true});
const evidence=[],items=[];
for(const pair of pairs){
 const id=`fx_slash_r${pair.reach}_a${pair.angle}`,dir='out/P12-fx-review/'+id;
 const m=JSON.parse(readFileSync(`${dir}/${id}_manifest.json`)),img=decodePng(readFileSync(`${dir}/${id}_sheet.png`));
 const rows=slashGeometry(img,m.frame_size,m.anchor,pair.reach,pair.angle);if(rows.some(r=>!r.pass))throw Error(id+' geometry/occlusion');evidence.push({id,rows});
 for(const label of ['before','after']){
  const folder=label==='before'?'out/P12-fx-before/'+id:dir;if(!existsSync(`${folder}/${id}_sheet.png`))continue;
  const manifest=JSON.parse(readFileSync(`${folder}/${id}_manifest.json`)),im=decodePng(readFileSync(`${folder}/${id}_sheet.png`));const [w,h]=manifest.frame_size;
  const rgba=new Uint8Array(w*8*h*4);
  for(let row=0;row<8;row++)for(let y=0;y<h;y++)rgba.set(im.rgba.subarray(((row*h+y)*im.w+w)*4,((row*h+y)*im.w+w*2)*4),(y*w*8+row*w)*4);
  const file=`${out}/${id}_${label}_f1.png`;writeFileSync(file,encodePng({w:w*8,h,rgba}));items.push(file);
 }
}
writeFileSync(out+'/geometry-occlusion.json',JSON.stringify(evidence,null,2));
writeFileSync(out+'/geometry-occlusion.md',['# P12 검기9쌍·8방향·3프레임','', '|id|행|프레임|바깥호/reach|각도오차|가림비율|판정|','|---|---:|---:|---:|---:|---:|---|',...evidence.flatMap(e=>e.rows.map(r=>`|${e.id}|${r.row}|${r.frame}|${r.ratio.toFixed(4)}|${r.angleError.toFixed(3)}|${(r.occlusion*100).toFixed(2)}%|PASS|`)),'','before/after는기존6쌍f1·8방향,새직업3쌍은after만. 기존호90~100%·각도±5°·안쪽투명/가림≤35%·3×60ms불변.'].join('\n'));
lineupCommand(out+'/slash-before-after-8dirs.png',items,process.cwd(),1);
console.log('P12-FX cells='+evidence.flatMap(e=>e.rows).length+' maxOcclusion='+Math.max(...evidence.flatMap(e=>e.rows.map(r=>r.occlusion))).toFixed(4)+' PASS');
