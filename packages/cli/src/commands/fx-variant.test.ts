import {expect,it} from 'vitest';
import {parseFxVariant,variantRows} from './fx-variant.js';
it('class variants preserve all geometry, alpha and timing, use approved colors only and never mutate pxl frames',()=>{
 const palette={c:'#7ff0e6',C:'#2fb8b0',n:'#1d6f78',y:'#ffe27a',j:'#e0a83a',J:'#9a6420'};
 const rgba=new Uint8Array([127,240,230,255,255,226,122,255,0,0,0,0]);
 const rows=[{name:'e',frames:[{w:3,h:1,rgba}],ms:[60]}];
 const guard=variantRows(rows,palette,'GUARD'),swift=variantRows(rows,palette,'SWIFT');
 expect(guard[0]?.frames[0]?.rgba).toEqual(new Uint8Array([255,226,122,255,255,226,122,255,0,0,0,0]));
 expect(swift[0]?.frames[0]?.rgba).toEqual(new Uint8Array([127,240,230,255,127,240,230,255,0,0,0,0]));
 expect(guard[0]?.ms).toEqual([60]);expect([...rgba]).toEqual([127,240,230,255,255,226,122,255,0,0,0,0]);
 expect(variantRows(rows,palette)).toBe(rows);
 expect(()=>parseFxVariant('RUNE')).toThrow(expect.objectContaining({code:'fx.variant-approval'}));
 expect(()=>parseFxVariant('UNKNOWN')).toThrow();
});
