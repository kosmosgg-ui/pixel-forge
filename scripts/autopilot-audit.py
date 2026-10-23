"""Read-only verification of private orphan originals and exact generation request bytes."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
archive=root/'out/seonggeom-art-source'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
fixed=json.loads((archive/'FIXED_REFERENCES.json').read_text())
count=0
for actor in fixed.values():
 if not isinstance(actor,dict):continue
 for ref in actor.values():
  assert sha(archive/ref['path'])==ref['sha256'],'STOP: fixed reference hash mismatch'
  count+=1
originals={}
for path in (archive/'art-source').rglob('*.intake.json'):
 meta=json.loads(path.read_text());png=path.with_suffix('').with_suffix('.png')
 assert sha(png)==meta['sha256'],'STOP: original hash mismatch'
 originals[meta['sha256']]=png
records=list((archive/'generation-records').rglob('*.json'))
for path in records:
 record=json.loads(path.read_text())
 assert record['sourceSha256'] in originals,'STOP: missing original'
 assert sha(path.with_suffix('.prompt.txt'))==record['promptSha256'],'STOP: request hash mismatch'
 for ref in record['references']:
  assert sha(archive/ref['path'])==ref['sha256'],'STOP: generation reference hash mismatch'
for path in (archive/'art-source').glob('*/state.json'):
 for file in json.loads(path.read_text())['$archive']['files']:
  assert sha(path.parent/file['path'])==file['sha256'],'STOP: archived file hash mismatch'
print(json.dumps({'pass':True,'fixedReferences':count,'generatedRequests':len(records),'preservedOriginals':len(originals)},ensure_ascii=False))
