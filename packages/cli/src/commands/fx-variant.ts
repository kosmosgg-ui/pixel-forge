import {ForgeError,parseHex} from '@pixel-forge/core';
import {z} from 'zod';
import type {FxRow} from './fx-frames.js';
export function parseFxVariant(value?:string):'GUARD'|'SWIFT'|undefined{
 if(value==='RUNE')throw new ForgeError('fx.variant-approval','RUNE purple is absent from the approved fxPalette; approval required');
 return z.enum(['GUARD','SWIFT']).optional().parse(value);
}
/** Q8 replaces only approved palette entries; frame geometry/timing/alpha stay identical. */
export function variantRows(rows:FxRow[],palette:Record<string,string>,variant?:'GUARD'|'SWIFT'):FxRow[]{
 if(!variant)return rows;
 const keys=variant==='GUARD'?{c:'y',C:'j',n:'J'}:{y:'c',j:'C',J:'n'};
 const changes=new Map<number,number>();
 for(const [from,to] of Object.entries(keys)){
  const a=palette[from],b=palette[to];if(!a||!b)throw new ForgeError('fx.palette','Missing variant palette keys');
  changes.set(parseInt(a.slice(1),16),parseInt(b.slice(1),16));
 }
 return rows.map(row=>({...row,frames:row.frames.map(frame=>{
  const rgba=new Uint8Array(frame.rgba);
  for(let i=0;i<rgba.length;i+=4){if(!rgba[i+3])continue;
   const color=((rgba[i]??0)<<16)|((rgba[i+1]??0)<<8)|(rgba[i+2]??0),next=changes.get(color);
   if(next!==undefined){const [r,g,b]=parseHex('#'+next.toString(16).padStart(6,'0'));rgba.set([r,g,b],i);}
  }
  return{...frame,rgba};
 })}));
}
