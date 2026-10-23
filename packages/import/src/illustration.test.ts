import {expect,it} from 'vitest';
import {fitIllustration,imageBounds} from './illustration.js';
it('illustration normalization preserves the source and fits full geometry without cropping into 16:9',()=>{
 const source={w:100,h:100,rgba:new Uint8Array(40000)};
 for(let i=0;i<10000;i++)source.rgba.set(i%100>=30&&i%100<70&&Math.floor(i/100)>=10&&Math.floor(i/100)<90?[180,90,40,255]:[0,255,0,255],i*4);
 const before=new Uint8Array(source.rgba),out=fitIllustration(source,1280,720),b=imageBounds(out);
 expect(out).toMatchObject({w:1280,h:720});expect(b).toMatchObject({w:40,h:80});expect(source.rgba).toEqual(before);
 expect(out.rgba[(360*1280+640)*4]).toBe(180);
});
