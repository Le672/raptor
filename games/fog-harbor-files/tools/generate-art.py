from pathlib import Path
from math import sin, cos

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'art'

DEFS = '''<defs>
<linearGradient id="wall" x2="0" y2="1"><stop stop-color="#334047"/><stop offset="1" stop-color="#17282e"/></linearGradient>
<linearGradient id="floor" x2=".2" y2="1"><stop stop-color="#314045"/><stop offset="1" stop-color="#101d24"/></linearGradient>
<linearGradient id="wood" x2="0" y2="1"><stop stop-color="#705744"/><stop offset=".45" stop-color="#45392f"/><stop offset="1" stop-color="#201f1e"/></linearGradient>
<linearGradient id="desk" x2=".15" y2="1"><stop stop-color="#856b4e"/><stop offset=".5" stop-color="#514132"/><stop offset="1" stop-color="#2b2926"/></linearGradient>
<linearGradient id="glass" x2=".1" y2="1"><stop stop-color="#233f4a"/><stop offset=".6" stop-color="#142f3d"/><stop offset="1" stop-color="#50616a"/></linearGradient>
<linearGradient id="metal" x2=".8" y2="1"><stop stop-color="#687875"/><stop offset=".16" stop-color="#293e43"/><stop offset=".5" stop-color="#152a31"/><stop offset=".8" stop-color="#455955"/><stop offset="1" stop-color="#1a3037"/></linearGradient>
<linearGradient id="paper" x2=".8" y2="1"><stop stop-color="#cfbd93"/><stop offset="1" stop-color="#8c8c76"/></linearGradient>
<linearGradient id="leftshade"><stop stop-color="#06131c" stop-opacity=".9"/><stop offset=".6" stop-color="#09151d" stop-opacity=".15"/><stop offset="1" stop-color="#09151d" stop-opacity="0"/></linearGradient>
<radialGradient id="lampglow"><stop stop-color="#f1c47a" stop-opacity=".3"/><stop offset=".5" stop-color="#d7a55f" stop-opacity=".13"/><stop offset="1" stop-color="#d7a55f" stop-opacity="0"/></radialGradient>
<radialGradient id="vignette"><stop offset=".42" stop-color="#06121b" stop-opacity="0"/><stop offset="1" stop-color="#020a11" stop-opacity=".68"/></radialGradient>
<pattern id="grain" width="120" height="100" patternUnits="userSpaceOnUse"><path d="M3 8h12m27 11h7m32-8h11M9 45h8m39 21h13m38-20h5M17 83h12m54 1h9M49 92h5" stroke="#d8ceaf" stroke-opacity=".045" stroke-width="1"/><path d="M23 22v9m69 1v4M70 64v8M4 78v8" stroke="#050c12" stroke-opacity=".15"/></pattern>
<pattern id="wallwear" width="207" height="139" patternUnits="userSpaceOnUse"><path d="M15 0v20l7 8-3 10m118 15 4 17-6 14m52 30-15 3-3 12" stroke="#a8b4ad" opacity=".055" fill="none"/><path d="M22 74q28-6 30 2m51-55h25" stroke="#0c2028" opacity=".2"/></pattern>
<filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>'''

def rect(x,y,w,h,fill,stroke=None,sw=1,rx=0,extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+f' {extra}/>'

def path(d,fill='none',stroke=None,sw=1,extra=''):
    return f'<path d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+f' {extra}/>'

def circle(x,y,r,fill,stroke=None,sw=1,extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+f' {extra}/>'

def window(x,y,w,h):
    a=rect(x-12,y-12,w+24,h+24,'#13262d','#54605c',4)+rect(x,y,w,h,'url(#glass)')
    for i in range(6):
        bx=x+15+i*w/5
        a+=path(f'M{bx} {y+h-45}v{-24-i%3*13}h{w/10}v{24+i%3*13}z','#1b3038')
    a+=path(f'M{x+20} {y+h-75}h{w-40}m{-w*.6} 0v-44l34-16 44 16m-44-16v60','none','#5c767d',2)
    for i in range(34):
        px=x+7+(i*41)%(w-14); py=y+8+(i*59)%(h-30)
        a+=path(f'M{px} {py}l-4 26','none','#a4b9b6',.7,extra='opacity=".26"')
    for i in range(9):
        a+=circle(x+18+(i*53)%(w-35),y+h-28-(i%3)*9,1.3,'#bba576',extra='opacity=".65"')
    a+=rect(x+w/2-4,y,8,h,'#152932')+rect(x,y+h*.55,w,9,'#1b3139')
    a+=rect(x-17,y+h+5,w+34,13,'#4c5147','#17262a',2)
    return a

def door(x,y,w=145,h=335):
    a=rect(x-12,y-12,w+24,h+18,'#111d24','#4b514a',4)+rect(x,y,w,h,'url(#wood)','#121d22',3)
    a+=rect(x+15,y+18,w-30,h*.42,'none','#84745c',2)+rect(x+15,y+h*.51,w-30,h*.42,'none','#71624d',2)
    for i in range(10):
        xx=x+8+i*(w-16)/10
        a+=path(f'M{xx} {y+7}q5 55 0 126t0 180','none','#182021',.7,extra='opacity=".4"')
    a+=circle(x+w-20,y+h*.56,6,'#a39467','#282e2c',2)+rect(x+w+21,y+h*.42,22,44,'#142930','#5b6865',1,3)+circle(x+w+32,y+h*.42+12,2,'#8fa083')
    a+=rect(x+w+24,y+h*.65,17,23,'#7e8980','#18292d',2,2)
    return a

def folder(x,y,w=110,h=65,angle=0):
    a=path(f'M{x} {y+7}h{w*.4}l9-7h{w*.5-9}v{h}H{x}z','url(#paper)','#5c5a4a',1)
    a+=rect(x+10,y+15,w-20,h-26,'#c2b48f',extra='opacity=".25"')
    a+=path(f'M{x+15} {y+24}h{w*.56}m{-w*.56} 8h{w*.43}m{-w*.43} 8h{w*.64}','none','#686c5d',1,extra='opacity=".6"')
    a+=rect(x+w-22,y+18,4,h-25,'#764b3f',extra='opacity=".7"')
    return f'<g transform="rotate({angle} {x+w/2} {y+h/2})">{a}</g>'

def sheet(x,y,w=100,h=80,angle=0):
    a=rect(x,y,w,h,'#c6bf9f','#888d78',.7)
    for i in range(6):a+=path(f'M{x+9} {y+14+i*8}h{w-21-(i%3)*9}','none','#66746c',.8,extra='opacity=".55"')
    return f'<g transform="rotate({angle} {x+w/2} {y+h/2})">{a}</g>'

def cabinet(x,y,w=370,h=330,cols=4,rows=4):
    a=rect(x-10,y-10,w+20,h+20,'#171f22','#564f42',3)+rect(x,y,w,h,'url(#wood)')
    cw=w/cols; rh=h/rows
    for r in range(rows):
        for c in range(cols):
            xx=x+c*cw+6; yy=y+r*rh+6
            a+=rect(xx,yy,cw-12,rh-13,'#33362f','#7a6b50',1)
            a+=rect(xx+6,yy+10,cw-24,rh-33,['#7c775e','#85816a','#646b5d','#999078'][(r+c)%4],'#282f2c',1)
            a+=rect(xx+cw*.25,yy+rh*.38,cw*.42,14,'#b5ad8d','#434b42',1)
            a+=path(f'M{xx+cw*.3} {yy+rh*.48}h{cw*.28}','none','#6b7567',1)
            a+=rect(xx+cw*.4,yy+rh*.71,cw*.15,5,'#a99a72','#373e35',1)
    for i in range(rows+1):a+=rect(x,y+i*rh-3,w,6,'#1f2926','#75634a',.5)
    return a

def desk(x=430,y=500,w=630):
    a=f'<ellipse cx="{x+w/2}" cy="{y+150}" rx="{w*.6}" ry="68" fill="#040d15" opacity=".7" filter="url(#shadow)"/>'
    a+=path(f'M{x+30} {y+34}l-15 170h34l25-170M{x+w-40} {y+32}l27 173h-37l-34-173','url(#wood)','#13232a',3)
    a+=path(f'M{x} {y}l{w-55} -38 95 61-{w+17} 41z','url(#desk)','#8b7556',2)
    a+=path(f'M{x-17} {y+64}l{w+17}-41v28l-{w+17} 45z','#3e352a','#1c282b',2)
    a+=path(f'M{x+12} {y+83}l{w*.37}-21v61l-{w*.37} 24z','#4b4031','#847052',2)
    a+=path(f'M{x+45} {y+105}l70-10','none','#ad9670',3)
    for i in range(8):a+=path(f'M{x+15} {y+12+i*5}l{w-45} -31','none','#b19a69',.5,extra='opacity=".14"')
    return a

def lamp(x,y,scale=1):
    a=f'<ellipse cx="{x-15}" cy="{y-5}" rx="230" ry="190" fill="url(#lampglow)"/>'
    a+=f'<g transform="translate({x} {y}) scale({scale})">'
    a+=path('M0 0q-32-38-12-96 12-29 6-52','none','#b1a16e',8)
    a+=path('M1 0q-32-38-12-96 12-29 6-52','none','#544c35',3)
    a+='<ellipse cx="0" cy="0" rx="37" ry="11" fill="#aa9660" stroke="#3c4236" stroke-width="3"/>'
    a+=path('M-66-154Q-42-198 4-192q52 4 69 46l-12 13q-68-30-128 0z','#264b3c','#0f292b',3)
    a+=path('M-61-142q66-21 122 3q-60 19-122-3','#d7ca88','#797e50',2)
    a+='</g>'
    return a

def reel(x,y,r=43):
    a=circle(x,y,r,'#7f8980','#182c31',4)+circle(x,y,r*.87,'#b3b4a2','#4d605e',2)
    for i in range(3):
        t=i*2.094
        a+=circle(round(x+cos(t)*r*.52,2),round(y+sin(t)*r*.52,2),r*.21,'#29414a','#6b7e78',2)
    return a+circle(x,y,r*.12,'#b8ac7b','#263c40',2)

def base(kind):
    a=rect(0,0,1280,800,'#142932')
    a+=path('M0 0H1280V510L0 550Z','url(#wall)')+path('M0 550L1280 510V800H0Z','url(#floor)')
    a+=path('M0 0H1280L1100 105 155 106Z','#22323a')
    a+=path('M0 113L1280 107M0 141L1280 135','none','#17282d',12)
    a+=rect(0,145,1280,365,'url(#wallwear)')
    a+=path('M0 528L1280 497M0 540L1280 509','none','#151f22',9)
    for xx in range(-600,1900,140):a+=path(f'M640 510L{xx} 800','none','#76908a',1,extra='opacity=".13"')
    for yy in [548,594,654,733]:a+=path(f'M0 {yy+20}L1280 {yy-20}','none','#a7a18b',.8,extra='opacity=".13"')
    return a

def archive():
    a=base('archive')+door(108,175,142,347)+cabinet(378,167,470,337,5,4)+window(958,163,228,310)
    a+=path('M930 495L1260 693 1210 785 785 535Z','#bac1a4',extra='opacity=".045"')
    a+=desk(484,541,616)+folder(603,523,153,71,-5)+sheet(772,502,97,75,8)+lamp(980,524,.87)
    a+=path('M835 551l55-4 13 12-58 6z','#ad8c55','#493f30',2)
    a+=path('M464 556q-30-51-45-48l-63 18 23 133 64 2z','url(#wood)','#17272c',4)
    a+=path('M373 579l53-14m-45 24 45-14','none','#9a805b',3)
    a+=rect(303,419,24,99,'#263a3e','#657060',2)+rect(307,429,16,40,'#192c30')
    return a

def lobby():
    a=base('lobby')+window(857,154,330,319)+door(88,178,147,354)
    a+=rect(319,186,409,217,'#1d3034','#756d54',8)
    for r in range(3):
        for c in range(3):a+=sheet(344+c*117,207+r*55,91,42,(c-r)*1.4)
    a+=desk(327,541,747)+path('M347 600l682-40v153l-682 44z','url(#wood)','#1a292c',3)
    for i in range(11):a+=path(f'M{365+i*58} 601v140','none','#756046',1)
    a+=folder(431,513,170,74,-3)+sheet(626,513,109,86,4)+lamp(976,527,.82)
    a+=path('M753 542l41-4 13 8-44 7z','#212f35','#84928c',2)+circle(766,543,4,'#739393')
    a+=path('M121 614q-5-60 14-91m0 0q16-18 30 0m-13-15-13 93','none','#354954',5)
    a+=path('M97 608h84l-12 75H108z','#202f36','#607074',2)
    a+=path('M60 689q90-34 152 8t-30 23q-91 10-122-31','#4b656b',extra='opacity=".35"')
    return a

def studio():
    a=base('studio')+window(1001,159,192,278)+cabinet(85,192,284,314,4,4)
    a+=rect(432,177,463,202,'#192c34','#53605a',5)
    for i in range(17):a+=rect(448+i*26,193,7,164,'#5e685c',extra=f'opacity="{.14+i%4*.04}"')
    a+=desk(424,551,735)+lamp(1065,526,.83)
    a+=rect(493,409,330,123,'url(#metal)','#94a092',3,7)+reel(567,454,43)+reel(746,454,43)
    a+=path('M604 456h97M608 459l21 43h50l22-43','none','#a49b77',3)+rect(624,507,54,8,'#172c31')
    a+=rect(511,517,21,7,'#71877d')+rect(544,517,21,7,'#71877d')+rect(577,517,21,7,'#987262')
    a+=path('M858 492h125l11 67-141-5z','#12232d','#70867f',2)+path('M869 501h103l7 41-113-3z','#30505a')
    for i in range(6):a+=path(f'M{875+i*16} 520l5 {-6-i%3*5} 4 18 5-12','none','#9cae8e',1)
    a+=path('M851 555l143 4 23 18-177-6z','#485653','#192c32',2)
    a+=path('M700 540q-44 57 45 65t115-24','none','#111d28',5)+path('M705 538q-46 55 44 62t111-20','none','#8c7855',1)
    a+=folder(463,560,113,62,-7)
    return a

def security():
    a=base('security')+window(1034,173,145,271)
    a+=rect(81,202,233,293,'url(#metal)','#6d7970',3)+rect(95,219,205,252,'#19323b','#718176',2)
    for r in range(3):
        for c in range(5):
            x=118+c*35; y=249+r*72
            a+=circle(x,y,4,'#b3a774')+path(f'M{x} {y+3}v18l8 7v10h-9v-8l-4-4','none','#b8b39a',3)
    for r in range(2):
        for c in range(3):
            x=383+c*186; y=205+r*139
            a+=rect(x,y,174,127,'#101e28','#4d6263',4,3)+rect(x+9,y+10,156,101,'#3a5a5d')
            a+=path(f'M{x+11} {y+97}l64-28 89 18v22H{x+11}Z','#203a42')
            a+=path(f'M{x+27} {y+19}v75m45-75v55m37-55v59','none','#829c90',2,extra='opacity=".35"')
            a+=circle(x+159,y+118,2,'#8ba77f')
    a+=desk(367,558,715)+sheet(502,524,156,91,-4)+folder(701,525,135,74,3)
    a+=rect(925,498,94,61,'#1c3035','#63746b',2,3)
    for i in range(3):a+=rect(935,509+i*14,73,5,'#586e62')+circle(1014,511+i*14,2,'#a99b69')
    a+=path('M881 533q-46-37-45-58l17-21 31 9 12 24-14 11 5 19z','#182b32','#637a77',3)
    a+=lamp(1035,535,.64)
    return a

def office():
    a=base('office')+window(932,142,259,315)+cabinet(82,211,278,295,3,3)
    a+=rect(424,175,380,207,'#1e2a2c','#81745a',9)+rect(437,188,354,181,'#5a6459')
    a+=path('M443 343l81-67 47 39 61-103 53 91 104-25v88H443Z','#263e45')
    a+=path('M442 339l92-52 47 33 63-98 48 87 96-21','none','#8c9a87',3)
    a+=desk(359,564,767)+folder(495,528,149,77,-6)+sheet(656,523,119,82,5)+lamp(1036,535,.91)
    a+=path('M791 484h148l7 81-159-2z','#142630','#83918a',3)+rect(803,497,123,54,'#3f6068')
    a+=path('M788 568l162-3 24 17-194 3z','#57635d','#20353a',2)
    a+=path('M474 587q-72-21-75-66l5-54q27-53 90-33l34 119z','#333a37','#897854',4)
    a+=rect(780,574,60,9,'#9a8860','#313d3a',2,2)
    return a

def pump():
    a=base('pump')+rect(0,0,1280,550,'#152d36')+rect(0,0,1280,550,'url(#wallwear)')
    for x in [113,311,871,1112]:
        a+=rect(x,0,39,555,'url(#metal)','#0c202b',3)
        for y in [83,303,484]:a+=rect(x-7,y,53,15,'#506461','#172b33',3)
    a+=path('M130 170h330q44 0 44 45v158h145q54 0 54 54v136','none','#0a1c28',70)
    a+=path('M130 170h330q44 0 44 45v158h145q54 0 54 54v136','none','url(#metal)',57)
    a+=path('M141 157h322q27 0 29 41v165','none','#7b8b7a',3,extra='opacity=".35"')
    a+=rect(403,426,375,166,'url(#metal)','#112735',4,9)
    a+=path('M405 453h368m-368 15h368m-368 16h368m-368 16h368m-368 16h368','none','#0f2834',5)
    a+=circle(596,493,78,'#23404c','#6a7c70',4)+circle(596,493,59,'#132e3b','#536e68',3)
    for i in range(8):
        t=i*.785
        a+=circle(596+cos(t)*68,493+sin(t)*68,4,'#879186','#18333d',1)
    a+=circle(596,493,16,'#677d72','#192f39',3)
    a+=rect(787,250,153,196,'#465e5b','#122b37',4,4)+circle(864,309,43,'#babaa0','#1d3b47',7)
    a+=path('M865 308l-17-19','none','#283d42',3)+circle(865,309,4,'#344d50')
    a+=rect(813,384,104,19,'#243b42','#809080',2)+circle(832,393,4,'#b09363')+circle(893,393,4,'#708d72')
    a+=path('M331 713l605-58 192 83-594 62z','#0d2633','#657d77',3)
    for i in range(15):a+=path(f'M{354+i*38} {710-i*3.5}l179 62','none','#5a716a',4)
    a+=path('M0 675q203-39 325 7t269 13 329-23 357 45v83H0z','#3c5e69',extra='opacity=".23"')
    a+=rect(428,111,283,17,'#dae0bd','#526e6c',4,4)+f'<ellipse cx="560" cy="160" rx="400" ry="180" fill="url(#lampglow)" opacity=".5"/>'
    a+=rect(1018,155,153,362,'#122b35','#62776f',5)+rect(1033,174,123,142,'#2a4751','#70817c',3)
    return a

def transfer():
    a=base('transfer')+window(973,152,213,301)+cabinet(103,189,294,311,3,3)
    a+=rect(466,192,382,183,'#243a3d','#7c7e65',5)
    for x,y in [(486,210),(620,207),(741,220)]:a+=sheet(x,y,92,125,(x%7)-3)
    a+=desk(339,562,814)+lamp(1038,531,.9)
    a+=path('M402 501l185-15 9 94-194 16z','#7b7f64','#323f38',2)+rect(418,515,151,47,'#a1a088','#3e4c43',1)
    a+=path('M425 529h116m-116 12h90m-90 12h104','none','#64766b',1)
    a+=folder(631,519,133,84,-4)+sheet(789,516,119,92,8)
    a+=rect(496,535,116,73,'#223a41','#8b9889',2,4)+reel(554,572,26)
    a+=path('M831 559l48-2 16 10-52 7z','#9e8b62','#465246',2)
    a+=path('M147 597l133-15 57 28-139 21z','#8a886e','#364841',2)+path('M147 597v115l51 33V631Z','#535e51','#253b35',2)+path('M198 631l139-21v108l-139 27z','#6c7560','#304438',2)
    a+=path('M264 599l-43 139','none','#a89d7b',8)
    return a

def finish(body, label=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" role="img" aria-label="{label}">{DEFS}{body}<rect width="1280" height="800" fill="url(#grain)"/><rect width="1280" height="800" fill="url(#vignette)"/></svg>'

scenes={'archive':archive,'lobby':lobby,'studio':studio,'security':security,'office':office,'pump':pump,'transfer':transfer}
for name,fn in scenes.items():
    (ROOT/f'{name}.svg').write_text(finish(fn(),name),encoding='utf-8')
(ROOT/'title.svg').write_text(finish(archive()+rect(0,0,1280,800,'url(#leftshade)'),'Fog Harbor Files'),encoding='utf-8')

def portrait(person,age,female,hair,coat,shirt,style):
    # One consistent painted-vector visual language; facial contours, hair and clothing are drawn per character.
    skin='#b99b82' if age<45 else '#aa927c'
    shadow='#826d60' if age<45 else '#75685e'
    defs=f'''<defs><linearGradient id="bg" x2=".7" y2="1"><stop stop-color="#344b50"/><stop offset="1" stop-color="#0b1b25"/></linearGradient><linearGradient id="face" x2=".8" y2=".4"><stop stop-color="{skin}"/><stop offset=".52" stop-color="{skin}"/><stop offset="1" stop-color="{shadow}"/></linearGradient><linearGradient id="cloth" x2=".8" y2="1"><stop stop-color="{coat}"/><stop offset="1" stop-color="#12232b"/></linearGradient><radialGradient id="light"><stop stop-color="#d9b477" stop-opacity=".18"/><stop offset="1" stop-color="#b28b60" stop-opacity="0"/></radialGradient><pattern id="grain" width="63" height="72" patternUnits="userSpaceOnUse"><path d="M3 8h9m21 18h4m8 26h7M8 61h10" stroke="#dac8a0" stroke-opacity=".04"/></pattern></defs>'''
    a=rect(0,0,400,520,'url(#bg)')+circle(120,200,210,'url(#light)')
    a+=path('M32 520l19-104q15-56 95-76h113q82 23 99 76l13 104z','url(#cloth)','#122b32',3)
    a+=path('M158 331v-55h86v62l-43 56z','url(#face)','#6e655a',1)
    a+=path('M144 346l55 47 56-46 22 173H123z',shirt)
    a+=path('M144 343l55 50-52 35-39-65z',coat,'#536059',1.5)+path('M255 344l-56 49 58 33 39-61z',coat,'#536059',1.5)
    a+=path('M121 370l20 150m144-150-21 150','none','#708078',1,extra='opacity=".45"')
    if style=='work':
        a+=path('M85 415h51v49H89m184-52h43v51h-40','none','#859183',2)+path('M94 425h30m158-1h26','none','#ac9f79',1)
    if style=='security':
        a+=path('M71 390l62-10 7 17-65 10zM270 380l60 13-4 16-62-12z','#69736d','#1c343e',2)+path('M280 439l24-4 14 18-26 21-21-16z','#8d8a68','#4e635c',2)
    if style=='director':a+=path('M196 390l15 0 10 23-12 89-18-1-7-86z','#6a6156','#2d3a3d',2)
    if style=='journalist':a+=path('M282 366l-98 154','none','#766b53',13)+path('M284 367l-99 153','none','#b0a17c',1)
    if female and style in ['journalist','restorer']:
        a+=path('M111 218q-15-102 36-146 80-58 144 20 34 61 1 205l-55 45 6-118-84-51-12 156-50-6z',hair,'#101f27',3)
    a+=path('M137 182q-19-18-17 11l10 47q3 14 16 8m115-65q20-16 17 14l-9 44q-3 15-15 8',skin,'#77685c',2)
    a+=path('M138 132q6-54 66-59 60 7 61 61l-5 109q-8 62-59 81-45-17-58-75z','url(#face)','#7e6d5f',1.5)
    a+=path('M147 155q31-28 55-23l-12 67-30 12-11 55-12-28z','#ceb08b',extra='opacity=".18"')
    a+=path('M243 144l-21 45 10 62-16 47q34-21 42-65l4-88z','#5c5b55',extra='opacity=".18"')
    # Hair is individually cut rather than a shared round icon.
    if person=='xu':
        a+=path('M126 183q-5-103 55-112 72-17 91 64l-12 70-13-61q-28 4-52-25-15 29-47 42l-5 52z',hair,'#18252a',3)
        a+=path('M166 102q-23 52-25 96m44-102q-9 40-34 57m53-53q4 26 42 40','none','#53524a',2)
    elif person=='zhou':
        a+=path('M127 190q-11-82 31-108 63-40 108 17 22 27 1 104l-19-68q-54 9-92-26l-16 90z',hair,'#16242b',3)
        a+=path('M145 119q30 27 98 19m-84-39q25 24 75 25','none','#626059',2)
        a+=path('M250 151q42 8 35 56l-24 79-5-76z',hair)
    elif person=='tang':
        a+=path('M128 187q-22-100 49-117 66-16 91 60l-4 60-15-43q-40-8-74-41-5 34-34 61l-3 34z',hair,'#18282e',3)
        a+=path('M139 144q13-43 49-53m4-2q36 15 53 47','none','#777265',2)
    elif person=='shen':
        a+=path('M129 174l-3-44q7-57 67-64 57-1 77 54l-9 55-18-43-91 5-14 46z',hair,'#192a30',3)
        for i in range(8):a+=path(f'M{145+i*12} 123l{7-i} -32','none','#575c57',2)
    elif person=='luo':
        a+=path('M129 184q-17-55 0-82 21-36 62-37 64 0 78 58l-7 59-16-44q-28-30-57-26-31-4-46 35l-3 47z',hair,'#1d2b2e',3)
        a+=path('M143 119q48-45 105 5m-99-16q34-30 77-10','none','#b0b0a0',3,extra='opacity=".55"')
    else:
        a+=path('M127 184q-19-75 27-101 66-38 113 37l-7 66-17-43q-40-20-89-1l-14 50z',hair,'#1c2e33',3)
        for i in range(7):a+=path(f'M{146+i*14} 131l4 -28','none','#b6b5a3',2)
    # Eyebrows and eyes.
    a+=path('M151 183q17-11 34-2m33 0q15-11 30 0','none',hair,4)
    a+=path('M151 199q16-10 32 0-15 8-31 0m67 0q15-10 29 1-15 8-28-1', '#c8bba2','#514e48',1.2)
    a+=circle(169,198,4,'#253239')+circle(231,199,4,'#26363a')+circle(168,197,1,'#d2cab3')+circle(230,198,1,'#d2cab3')
    a+=path('M202 192l-10 45q10 8 22 1m-24 3 4 2m17-1 4-2','none','#7c6c5e',2)
    a+=path('M177 267q24-8 46 0-22 11-46 0','#8d6e60','#665a52',1)+path('M183 266q17-3 34 1','none','#c2a58c',1)
    a+=path('M179 289q24 10 42-1','none','#9b836e',1.5)
    if age>40:
        a+=path('M148 215l30-4m42 2 29 4m-97 19 13 14m72-13-11 15m-61-85 21-3m28 0 19 4','none','#776f62',1,extra='opacity=".6"')
        a+=path('M166 252l-6 18m76-17 6 21','none','#7b6b5d',1.5)
    if person=='he':
        a+=path('M165 267q8-25 23-17l12 4 15-4q17-7 24 19l-24-5-15 5-13-5z','#7a7a6d')
        a+=path('M173 284q23 9 48 0l-7 24-15 9-17-10z','#8d8b7b',extra='opacity=".7"')
    if person=='tang':
        a+=rect(145,186,46,31,'none','#3f4b48',2,8)+rect(211,186,45,31,'none','#3f4b48',2,8)+path('M191 196q10-8 20 0m-66-2-12-4m123 4 9-5','none','#414c49',2)
    if person=='zhou':a+=circle(144,238,3,'#bdad7f')+circle(258,239,3,'#bdad7f')
    if person=='xu':a+=path('M133 226l5 59q-2 45-17 78m138-143 5 54q12 44 28 72','none',hair,18)
    a+=rect(0,0,400,520,'url(#grain)')+path('M0 0H400V520H0Z','none','#899077',2,extra='opacity=".3"')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" role="img" aria-label="{person}">{defs}{a}</svg>'

people=[('xu',27,True,'#252e31','#57594c','#9f9b83','journalist'),('shen',30,False,'#1e2a2f','#36494d','#8c9c95','security'),('luo',52,False,'#555d58','#4a4d45','#b1ad91','director'),('zhou',36,True,'#303633','#4f625e','#9b9d8b','restorer'),('tang',41,True,'#3c403a','#697166','#b7b39a','admin'),('he',59,False,'#85877a','#59665d','#8f937d','work')]
for args in people:(ROOT/f'{args[0]}.svg').write_text(portrait(*args),encoding='utf-8')
print('Created',len(scenes)+1+len(people),'SVG assets in',ROOT)
