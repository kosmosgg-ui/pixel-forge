import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {fxImportCommand} from './fx-import.js';
it.skipIf(!process.env['PXL_BIN']||!existsSync(process.env['PXL_BIN']??''))('Q8 code FX produce pinned golden sheets with no palette/alpha/direction warnings',()=>{
 const root=join(import.meta.dirname,'../../../..'),work=mkdtempSync(join(tmpdir(),'auto-class-fx-'));
 try{
  for(const p of ['data/bibles','data/rules','data/projects/seonggeom'])cpSync(join(root,p),join(work,p),{recursive:true});
  const r=fxImportCommand(work,{assets:'data/projects/seonggeom/fx/class_fx.json',out:'out/review'});
  expect(r).toMatchObject({count:2,warnings:[]});
  const goldens={fx_guard_shield:'f17bd70c8a9187648b3a1f33be79f80462ca30e90675573cfb06ff1a13438178',fx_swift_echo:'bf268eb316caed2f12b0191a42d8086eaa044685ccdbdbcf694287efc6d9e3e5'};
  for(const [id,sha] of Object.entries(goldens)){
   const dir=join(work,'out/review',id),m=JSON.parse(readFileSync(join(dir,id+'_manifest.json'),'utf8'));
   expect(m).toMatchObject({provenance:{aiUsed:false,pxlCommit:'2e72b9a'},qa:{pass:true}});
   expect(createHash('sha256').update(readFileSync(join(dir,id+'_sheet.png'))).digest('hex')).toBe(sha);
  }
 }finally{rmSync(work,{recursive:true,force:true});}
});
