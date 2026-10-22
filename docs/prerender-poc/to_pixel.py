import sys, os, glob, json, colorsys, math
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
L=np.array([-0.55,-0.55,0.63]); L/=np.linalg.norm(L)   # light in camera-ish world: from left, front, above
# world: camera looks along +Y tilted; light from upper-left-front in world = (-x, -y(toward cam), +z)
def lum(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
# 1) collect albedo colors across all frames → global palette clusters (k-means lite)
albs=sorted(glob.glob(os.path.join(src,'*_alb.png')))
allc=[]
for f in albs:
    a=np.asarray(Image.open(f).convert('RGBA')).reshape(-1,4); allc.append(a[a[:,3]>200][:,:3])
allc=np.concatenate(allc).astype(float)
K=int(sys.argv[3]) if len(sys.argv)>3 else 5
allc=allc[::max(1,len(allc)//20000)]
rng=np.random.default_rng(1); cent=allc[rng.choice(len(allc),K,replace=False)]
for _ in range(15):
    d=((allc[:,None,:]-cent[None])**2).sum(-1); lab=d.argmin(1)
    cent=np.array([allc[lab==k].mean(0) if (lab==k).any() else cent[k] for k in range(K)])
def ramp(c):  # 3-step hue-shifted ramp (dark, base, light)
    r,g,b=[v/255 for v in c]; h,l,s=colorsys.rgb_to_hls(r,g,b)
    out=[]
    for dl,dh in [(-0.16,0.04),(0,0),(0.13,-0.03)]:
        hh=(h+dh)%1; ll=min(0.92,max(0.06,l+dl)); ss=min(1,s*(1.1 if dl<0 else 0.95))
        out.append(np.array(colorsys.hls_to_rgb(hh,ll,ss))*255)
    return out
ramps=[ramp(c) for c in cent]
OUT=np.array([26,16,32])
for f in albs:
    a=np.asarray(Image.open(f).convert('RGBA')).astype(float)
    n=np.asarray(Image.open(f.replace('_alb','_nrm')).convert('RGB')).astype(float)/255*2-1
    alpha=a[...,3]>200
    d=((a[...,None,:3]-cent[None,None])**2).sum(-1); lab=d.argmin(-1)
    lam=(n*L).sum(-1)
    lvl=np.where(lam>0.45,2,np.where(lam>-0.1,1,0))
    H2,W2=alpha.shape; h,w=H2//2,W2//2
    out=np.zeros((h,w,4),np.uint8); a2=np.zeros((h,w),bool)
    for y in range(h):
        for x in range(w):
            blk=[(lab[2*y+j,2*x+i],lvl[2*y+j,2*x+i]) for j in (0,1) for i in (0,1) if alpha[2*y+j,2*x+i]]
            if len(blk)>=2:
                k,l=max(set(blk),key=blk.count); out[y,x,:3]=ramps[k][l]; out[y,x,3]=255; a2[y,x]=True
    alpha=a2
    # cleanup orphans (pixel differing from all 4 neighbours of same alpha → majority)
    o2=out.copy()
    for y in range(1,h-1):
        for x in range(1,w-1):
            if not alpha[y,x]: continue
            nb=[tuple(out[y+dy,x+dx]) for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if alpha[y+dy,x+dx]]
            if len(nb)>=3 and tuple(out[y,x]) not in nb:
                o2[y,x]=max(set(nb),key=nb.count)
    out=o2
    # outline 1px dark
    sil=alpha.copy(); o3=out.copy()
    for y in range(h):
        for x in range(w):
            if sil[y,x]: continue
            if any(0<=y+dy<h and 0<=x+dx<w and sil[y+dy,x+dx] for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                o3[y,x,:3]=OUT; o3[y,x,3]=255
    Image.fromarray(o3).save(os.path.join(dst,os.path.basename(f).replace('_alb','')))
print('palette', [[int(v) for v in c] for c in cent])
