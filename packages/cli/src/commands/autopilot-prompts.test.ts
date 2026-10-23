import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {autopilotPrompts} from './autopilot-prompts.js';
import {intakeCommand} from './intake.js';
import {encodePng} from '../io/png.js';
import { promptsCommand } from './prompts.js';
it('Q0 prompts are deterministic, data assembled and canon-preserving, with a frozen golden', () => {
 const work=mkdtempSync(join(tmpdir(),'autopilot-prompt-'));
 try {
  cpSync(join(import.meta.dirname,'../../../../data/projects'),join(work,'data/projects'),{recursive:true});
  const a=promptsCommand('hero_sera',work,{kind:'reference-master'}), b=promptsCommand('hero_sera',work,{kind:'reference-master'});
  expect(a).toEqual(b);
  const text=readFileSync(join(work,'out/prompts/autopilot/hero_sera/reference-master/A.txt'),'utf8');
  expect(text).toContain('brown eyes');expect(text).toContain('NO cape');expect(text).toContain('not a redesign');expect(text).toContain('1536x1024');
  expect(createHash('sha256').update(text).digest('hex')).toBe('089072b6c82b1259834995a7cae96d63b8bd506c13b1828aa3ddfc2bcdb91acf');
 } finally {rmSync(work,{recursive:true,force:true});}
});

it('all approved kind templates have a versioned golden source', () => {
 const raw=readFileSync(join(import.meta.dirname,'../../../../data/projects/seonggeom/prompts/autopilot.json'));
 expect(createHash('sha256').update(raw).digest('hex')).toBe('c039cc14327a36c4facdc3e81417f05bafce0a204a31663c4f7149a280a40d1b');
});

it('proposal intake does not require an animation kit or promote a design into action/reference state',()=>{
 const work=mkdtempSync(join(tmpdir(),'autopilot-proposal-'));
 try{
  cpSync(join(import.meta.dirname,'../../../../data/projects'),join(work,'data/projects'),{recursive:true});
  writeFileSync(join(work,'proposal.png'),encodePng({w:2,h:2,rgba:new Uint8Array(16).fill(255)}));
  const r=intakeCommand('proposal.png',work,{kind:'reference',as:'leona/proposal_a'});
  expect(r).toMatchObject({actor:'leona',turnaround:false});
  expect(existsSync(join(work,'data/import/leona/state.json'))).toBe(false);
  expect(()=>intakeCommand('proposal.png',work,{kind:'reference',as:'unknown/proposal_a'})).toThrow();
  const retake=autopilotPrompts('hero_sera','cutin',work,'','upperbody,clipped');
  expect(retake.next[0]).toContain('__fix_upperbody_clipped.txt');
  expect(readFileSync(join(work,retake.next[0]??''),'utf8')).toContain('STRICT UPPER-BODY');
 }finally{rmSync(work,{recursive:true,force:true});}
});
