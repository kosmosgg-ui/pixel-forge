from pathlib import Path
import sys,subprocess,shutil,json,hashlib,os
root=Path(__file__).resolve().parents[1];archive=root/'out/seonggeom-art-source';item,variant,imagepath,actor,kind,as_key,prompt=sys.argv[1:8];attempt=int(sys.argv[8]) if len(sys.argv)>8 else 1
fixed=json.loads((archive/'FIXED_REFERENCES.json').read_text())['hero_sera']
for value in fixed.values():assert hashlib.sha256((archive/value['path']).read_bytes()).hexdigest()==value['sha256'],'STOP: reference hash mismatch'
source=Path(imagepath);dest=root/f'out/autopilot/generated/{item}_{variant}{'' if attempt==1 else '_'+str(attempt)}.png';dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
env=os.environ.copy();env['PATH']='/workspace/.onboarding/pixel-forge-tools/node_modules/.bin:'+env['PATH']
args=['node','packages/cli/dist/main.js','intake',str(dest.relative_to(root)),'--kind',kind,'--as',as_key,'--archive','out/seonggeom-art-source/art-source']
if kind=='cutin':args+=['--from','autopilot','--out','out/autopilot/staging']
result=json.loads(subprocess.check_output(args,cwd=root,env=env,text=True));state=json.loads((archive/f'art-source/{actor}/state.json').read_text());raw=root/result['out'] if 'out' in result else None
if raw is None:
 matches=list((root/f'data/import/{actor}').rglob(result['stamp']+'.png'));assert len(matches)==1;raw=matches[0]
meta_path=raw.with_suffix('.intake.json');meta=json.loads(meta_path.read_text());fixed=json.loads((archive/'FIXED_REFERENCES.json').read_text())['hero_sera'];refs=[] if actor not in ['hero_sera','sera'] else [{'path':v['path'],'sha256':v['sha256']} for v in fixed.values()]
template_bytes=(root/prompt).read_bytes();prompt_bytes=template_bytes.strip();request_file=f'out/prompts/autopilot/requests/{item}_{variant}_{attempt}.txt';(root/request_file).parent.mkdir(parents=True,exist_ok=True);(root/request_file).write_bytes(prompt_bytes)
for ref in refs:assert hashlib.sha256((archive/ref['path']).read_bytes()).hexdigest()==ref['sha256'],'STOP: reference hash mismatch'
record={'origin':'codex-imagegen','model':'gpt-image (Codex 내장, 모델명 미확인)','promptFile':request_file,'templatePromptFile':prompt,'templatePromptSha256':hashlib.sha256(template_bytes).hexdigest(),'promptSha256':hashlib.sha256(prompt_bytes).hexdigest(),'references':refs,'createdAt':meta['createdAt'],'attempt':attempt,'item':item,'variant':variant,'sourceSha256':meta['sha256'],'approval':'BLOCKED-APPROVAL' if item in ['Q0','Q4','Q6','Q9','Q14'] else 'QA-PENDING'}
meta.pop('receivedFrom',None);meta.update(record);meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
if kind in ['portrait','cutin','prop','ground','keyart']:
 folders=set(result.get('destinations',[]))
 if kind=='cutin':folders.update(['out/cutin/cutin_'+actor,result['dest']])
 for directory in result.get('outputDirs',[]):folders.add(str(Path(directory).relative_to(root)))
 for rel in list(folders):folders.add('out/portraits/'+Path(rel).name)
 for folder in folders:
  for p in (root/folder).glob('*_manifest.json'):
   value=json.loads(p.read_text())
   if value.get('sourceSha256')==record['sourceSha256'] or value.get('provenance',{}).get('sourceFile')==str(raw.relative_to(root)):
    value['provenance'].update(record);value['provenance']['promptRecord']=request_file;value['provenance']['creator']='Codex built-in imagegen';p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
for file in state['$archive']['files']:
 if file['to']==str(meta_path.relative_to(root)):
  target=archive/f'art-source/{actor}'/file['path'];shutil.copy2(meta_path,target);file['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
(archive/f'art-source/{actor}/state.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
record_dir=archive/f'generation-records/{item}';record_dir.mkdir(parents=True,exist_ok=True);(record_dir/(variant+('' if attempt==1 else '_attempt'+str(attempt))+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');(record_dir/(variant+('' if attempt==1 else '_attempt'+str(attempt))+'.prompt.txt')).write_bytes(prompt_bytes)
for repo in [Path('/workspace/seonggeom'),root]:
 p=repo/'docs/DEMO_DEV/AUTOPILOT_LEDGER.md';s=p.read_text();line=f"|{meta['createdAt']}|{item}/{variant}|{attempt}|GENERATED; {record['approval']}|{meta['sha256']} / {record['promptSha256']}|\n";rows=s.splitlines(True);match=[i for i,row in enumerate(rows) if f'|{item}/{variant}|{attempt}|' in row]
 if match:rows[match[0]]=line;rows=[row for i,row in enumerate(rows) if i not in match[1:]];p.write_text(''.join(rows))
 else:p.write_text(s+line)
print(json.dumps({'source':str(raw.relative_to(root)),'archive':result['archive'],'record':str((record_dir/(variant+('' if attempt==1 else '_attempt'+str(attempt))+'.json')).relative_to(archive)),'item':item,'variant':variant,'attempt':attempt,'status':record['approval']},ensure_ascii=False))
