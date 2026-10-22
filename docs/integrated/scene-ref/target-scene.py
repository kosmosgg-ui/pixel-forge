from PIL import Image, ImageDraw
import random
random.seed(3)
W,H=320,180
im=Image.new('RGBA',(W,H),(0,0,0,255)); px=im.load()
# floor: 16px stone tiles with variation + cracks + moss
base=[(0x3a,0x33,0x48),(0x34,0x2e,0x42),(0x40,0x38,0x4e)]
for ty in range(0,H,16):
    for tx in range(0,W,16):
        c=random.choice(base)
        for y in range(16):
            for x in range(16):
                X,Y=tx+x,ty+y
                if X>=W or Y>=H: continue
                col=c
                if x==15 or y==15: col=(0x22,0x1c,0x2c)
                elif x==0 or y==0: col=(0x4a,0x42,0x5c)
                px[X,Y]=col+(255,)
        if random.random()<0.25:
            x0,y0=tx+random.randint(3,10),ty+random.randint(3,10)
            for k in range(random.randint(3,6)):
                if x0<W and y0<H: px[x0,y0]=(0x26,0x20,0x30,255)
                x0+=random.choice([0,1]); y0+=1
        if random.random()<0.15:
            for k in range(5):
                X=tx+random.randint(1,14);Y=ty+random.randint(10,14)
                if X<W and Y<H: px[X,Y]=(0x3c,0x5a,0x3a,255)
# vignette
for y in range(H):
    for x in range(W):
        d=((x-W/2)/(W/2))**2+((y-H/2)/(H/2))**2
        if d>0.55:
            r,g,b,a=px[x,y]; f=max(0.45,1-(d-0.55)*0.9); px[x,y]=(int(r*f),int(g*f),int(b*f),255)
def shadow(cx,cy,rw):
    for y in range(cy-2,cy+3):
        for x in range(cx-rw,cx+rw+1):
            if ((x-cx)/rw)**2+((y-cy)/2.2)**2<=1 and 0<=x<W and 0<=y<H:
                r,g,b,a=px[x,y]; px[x,y]=(int(r*0.55),int(g*0.55),int(b*0.6),255)
def put(spr,x,y,flip=False,flash=False):
    s=spr.transpose(Image.FLIP_LEFT_RIGHT) if flip else spr
    if flash:
        s=s.copy(); sp=s.load()
        for yy in range(s.height):
            for xx in range(s.width):
                if sp[xx,yy][3]: sp[xx,yy]=(255,255,255,255)
    im.alpha_composite(s,(x,y))
def strip_bg(path):
    s=Image.open(path).convert('RGBA'); sp=s.load(); bgc=sp[0,0]
    for yy in range(s.height):
        for xx in range(s.width):
            if sp[xx,yy][:3]==bgc[:3]: sp[xx,yy]=(0,0,0,0)
    return s.crop(s.getbbox())
hero=Image.open('chibi_1x.png').convert('RGBA'); hero=hero.crop(hero.getbbox())
gob=strip_bg('/tmp/claude-0/atoms/sim_goblin.png').resize((23,23),Image.NEAREST) if False else None
def load1x(p,scale):
    s=Image.open(p).convert('RGBA'); s=s.resize((s.width//scale,s.height//scale),Image.NEAREST); sp=s.load(); bgc=sp[0,0]
    for yy in range(s.height):
        for xx in range(s.width):
            if sp[xx,yy][:3]==bgc[:3]: sp[xx,yy]=(0,0,0,0)
    return s.crop(s.getbbox())
gob=load1x('/tmp/claude-0/atoms/sim_goblin.png',8); skel=load1x('/tmp/claude-0/atoms/sim_skeleton.png',8)
# xp gems
gem=[ ".o.", "oGo", ".o."]
def gemdraw(x,y,col):
    pts={(1,0):'o',(0,1):'o',(2,1):'o',(1,2):'o',(1,1):'c'}
    for (dx,dy),t in pts.items():
        px[x+dx,y+dy]=((0x10,0x30,0x50,255) if t=='o' else col)
for i in range(14):
    gemdraw(random.randint(20,300),random.randint(30,165),random.choice([(0x6a,0xe0,0xff,255),(0x80,0xff,0x9a,255)]))
# enemies ring
hx,hy=150,78
enemies=[]
for i in range(16):
    ex=random.randint(10,290); ey=random.randint(20,150)
    if abs(ex-hx)<40 and abs(ey-hy)<40: continue
    enemies.append((ex,ey,random.choice([gob,skel]),ex>hx))
for ex,ey,s,f in sorted(enemies,key=lambda e:e[1]):
    shadow(ex+s.width//2,ey+s.height,6); put(s,ex,ey,flip=f)
# hit enemies near hero (flash)
s=gob; shadow(hx+48+s.width//2,hy+12+s.height,6); put(s,hx+48,hy+12,flip=True,flash=True)
s=skel; shadow(hx+52+s.width//2,hy-14+s.height,6); put(s,hx+52,hy-14,flip=True)
# hero
shadow(hx+hero.width//2,hy+hero.height,9); put(hero,hx,hy)
# slash arc effect
d=ImageDraw.Draw(im)
for r,c in [(30,(255,255,255,255)),(28,(255,224,138,255)),(26,(255,170,90,200))]:
    d.arc([hx+10-r,hy+18-r,hx+10+r,hy+18+r],-70,40,fill=c,width=2)
# damage numbers 3x5 font
F={'0':["111","101","101","101","111"],'1':["010","110","010","010","111"],'2':["111","001","111","100","111"],'3':["111","001","111","001","111"],'4':["101","101","111","001","001"],'5':["111","100","111","001","111"],'7':["111","001","010","010","010"],'8':["111","101","111","101","111"],'9':["111","101","111","001","111"]}
def num(s,x,y,col):
    for i,ch in enumerate(s):
        g=F[ch]
        for yy,row in enumerate(g):
            for xx,v in enumerate(row):
                if v=='1':
                    for ox,oy in [(-1,0),(1,0),(0,-1),(0,1)]:
                        X,Y=x+i*4+xx+ox,y+yy+oy
                        if px[X,Y]!=col: px[X,Y]=(0x1a,0x10,0x20,255)
        for yy,row in enumerate(g):
            for xx,v in enumerate(row):
                if v=='1': px[x+i*4+xx,y+yy]=col
num('24',hx+60,hy+4,(255,255,255,255)); num('57',hx+64,hy-22,(255,224,138,255)); num('9',hx+40,hy+38,(255,255,255,255))
# player hp bar
bx,by=hx+4,hy+hero.height+5
d.rectangle([bx-1,by-1,bx+26,by+3],fill=(0x1a,0x10,0x20,255)); d.rectangle([bx,by,bx+18,by+2],fill=(0xd8,0x40,0x50,255)); d.rectangle([bx+19,by,bx+25,by+2],fill=(0x50,0x20,0x30,255))
# top xp bar + timer
d.rectangle([0,0,W-1,5],fill=(0x1a,0x10,0x20,255)); d.rectangle([1,1,int(W*0.62),4],fill=(0x4a,0x90,0xff,255)); d.line([1,1,int(W*0.62),1],fill=(0xa0,0xd0,0xff,255))
num('1027',W//2-8,9,(255,255,255,255))
im.save('scene_1x.png'); im.resize((W*4,H*4),Image.NEAREST).save('scene.png')
