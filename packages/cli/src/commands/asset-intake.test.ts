import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {intakeAsset} from './asset-intake.js';
import {decodePng,encodePng} from '../io/png.js';
it('prop key removal preserves the floor anchor, binary alpha and a <=24 color palette',()=>{
 const work=mkdtempSync(join(tmpdir(),'auto-prop-'));
 try{
  const w=128,h=128,rgba=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++)rgba.set([0,255,0,255],i*4);
  for(let y=24;y<120;y++)for(let x=24;x<104;x++)rgba.set([100+y,70,40,255],(y*w+x)*4);
  writeFileSync(join(work,'input.png'),encodePng({w,h,rgba}));
  const r=intakeAsset('input.png',work,{kind:'prop',as:'gate/intact'});
  const m=JSON.parse(readFileSync(join(work,r.dest,'prop_gate_intact_manifest.json'),'utf8'));
  const img=decodePng(readFileSync(join(work,r.dest,'asset.png')));
  expect(m).toMatchObject({quality:'candidate',anchor:[40,95],size:[80,96]});
  expect(m.qa.palette).toBeLessThanOrEqual(24);
  expect([...img.rgba].filter((_,i)=>i%4===3).every(a=>a===0||a===255)).toBe(true);
  expect(()=>intakeAsset('../outside.png',work,{kind:'prop',as:'gate/intact'})).toThrow();
 }finally{rmSync(work,{recursive:true,force:true});}
});
it('ground enforces square cells and reports failing seams without marking the proposal accepted',()=>{
 const work=mkdtempSync(join(tmpdir(),'auto-ground-'));
 try{
  const rgba=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++)rgba.set([x<16?0:255,40,40,255],(y*32+x)*4);
  writeFileSync(join(work,'input.png'),encodePng({w:32,h:32,rgba}));
  const r=intakeAsset('input.png',work,{kind:'ground',as:'gate/floor',size:16});
  expect(r.qa.pass).toBe(false);
  const m=JSON.parse(readFileSync(join(work,r.dest,'ground_gate_floor_manifest.json'),'utf8'));
  expect(m.quality).toBe('proposal');expect(m.size).toEqual([16,16]);
  writeFileSync(join(work,'bad.png'),encodePng({w:32,h:16,rgba:rgba.slice(0,32*16*4)}));
  expect(()=>intakeAsset('bad.png',work,{kind:'ground',as:'gate/floor'})).toThrow(expect.objectContaining({code:'ground.square'}));
 }finally{rmSync(work,{recursive:true,force:true});}
});

it('keyart stays a continuous-color 16:9 proposal and preserves the original bytes',()=>{
 const work=mkdtempSync(join(tmpdir(),'auto-keyart-'));
 try{
  const w=48,h=27,rgba=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++)rgba.set([i%256,Math.floor(i/7)%256,90,255],i*4);
  const original=encodePng({w,h,rgba});writeFileSync(join(work,'key.png'),original);
  const r=intakeAsset('key.png',work,{kind:'keyart',as:'title/proposal_a'});
  expect(readFileSync(join(work,r.out))).toEqual(original);
  const m=JSON.parse(readFileSync(join(work,r.dest,'keyart_title_proposal_a_manifest.json'),'utf8'));
  expect(m).toMatchObject({quality:'proposal',size:[1280,720],qa:{palette:null}});
 }finally{rmSync(work,{recursive:true,force:true});}
});
