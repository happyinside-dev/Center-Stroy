"""Fetch manufacturer packshots for a private demo, retaining provenance.

These are manufacturer copyrighted materials, NOT claimed to be free stock.
Public/commercial reuse permission is not established by downloading them.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
import concurrent.futures as cf
import html, json, re, subprocess, time
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'assets'/'catalog'
BASE.mkdir(exist_ok=True)
(BASE/'cache').mkdir(exist_ok=True)
(BASE/'photos').mkdir(exist_ok=True)
(BASE/'thumbs').mkdir(exist_ok=True)
CATEGORIES=[
 ('power-tools','Электроинструмент',16,[('dewalt','power-tools/drills/drill-drivers'),('dewalt','power-tools/grinders/angle-grinders'),('dewalt','power-tools/saws/jig-saws'),('dewalt','power-tools/sanders/orbital-sanders')]),
 ('hand-tools','Ручной инструмент',20,[('stanley','hand-tools/hammers'),('stanley','hand-tools/pliers'),('stanley','hand-tools/screwdrivers-nut-drivers-keys'),('stanley','hand-tools/wrenches'),('stanley','hand-tools/hand-saws'),('stanley','hand-tools/scraping-prying/scrapers')]),
 ('measuring','Измерение и разметка',12,[('stanley','hand-tools/measuring-marking-tools')]),
 ('accessories','Оснастка',12,[('dewalt','power-tools/drills/drill-impact-bits'),('dewalt','power-tools/power-tool-accessories/saw-blades')]),
 ('fasteners','Крепёж',12,[('dewalt','power-tools/power-tool-accessories/nails-staples'),('stanley','hand-tools/fastening-tools/fastening-tool-accessories')]),
 ('coatings','Краски и грунтовки',10,[('v33','renovation-cupboard-worktop'),('soudal','coatings'),('soudal','cleaners-sprays-and-primers')]),
 ('chemistry','Герметики, пены и клеи',10,[('soudal','sealants'),('soudal','expanding-foam'),('soudal','adhesives')]),
 ('storage','Хранение инструмента',8,[('stanley','storage-organization')]),
]

def fetch(url,dest):
 dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
 p=subprocess.run(['curl','-fLsS','--max-time','22','--connect-timeout','8',url,'-o',str(dest)],capture_output=True)
 if p.returncode: raise RuntimeError(p.stderr.decode()[-160:])

def next_hits(s):
 parts=[]
 for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)',s):
  try:parts.append(json.loads(m.group(1)))
  except ValueError:pass
 joined='\n'.join(parts)
 result=[];seen=set();decoder=json.JSONDecoder()
 for m in re.finditer(r'"hits":',joined):
  try: hits=decoder.raw_decode(joined[m.end():])[0]
  except ValueError:continue
  for h in hits:
   if h.get('sku') and h['sku'] not in seen and h.get('primaryImage') and not h.get('isDiscontinued'):
    seen.add(h['sku']);result.append(h)
 return result

class SoudalParser(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.items=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='a':self.links.append(a.get('href',''))
  if t=='img' and 'soudal_api/image/' in a.get('src',''):
   src=a['src'].split('?')[0]
   src=re.sub(r'/styles/[^/]+/public/','/',src)
   if src.endswith('.webp'):src=src[:-5]
   self.items.append(dict(title=a.get('alt',''),image=urljoin('https://www.soudal.co.uk',src),url=urljoin('https://www.soudal.co.uk',self.links[-1] if self.links else '')))
 def handle_endtag(self,t):
  if t=='a' and self.links:self.links.pop()

class V33Parser(HTMLParser):
 def __init__(self):super().__init__();self.items=[]
 def handle_starttag(self,t,a):
  a=dict(a);src=a.get('src','');name=a.get('alt','')
  if t=='img' and re.search(r'/315389\d+',src):
   source=re.sub(r'-\d+x\d+(?=\.)','',src)
   code=re.search(r'(315389\d+)',src).group(1)
   names={'3153895181624':'V33 Renovation Worktop Protection','3153895181334':'V33 Wall Tile & Panelling Paint','3153895181556':'V33 Floor & Stairs Paint'}
   self.items.append(dict(title=names.get(code,name),image=source,brand='V33',sku=code,alt=name,sourcePage='https://www.v33.co.uk/renovation-cupboard-worktop/'))

def get_items(brand,category):
 domains={'stanley':'https://www.stanleytools.com','dewalt':'https://www.dewalt.com','soudal':'https://www.soudal.co.uk','v33':'https://www.v33.co.uk'}
 domain=domains[brand]
 url=domain+('/' if brand=='v33' else '/pro/products/' if brand=='soudal' else '/en-us/products/')+category
 path=BASE/'cache'/f'{brand}-{category.replace("/","-")}.html'
 if not path.exists():fetch(url,path)
 if brand=='v33':
  parser=V33Parser();parser.feed(path.read_text());return parser.items
 if brand=='soudal':
  parser=SoudalParser();parser.feed(path.read_text());items=parser.items
  for item in items:item.update(brand='Soudal',sourcePage=url,sku=item['image'].split('/')[-1].split('-')[0])
  return items
 rows=next_hits(path.read_text());items=[]
 for h in rows:
  img=h['primaryImage'];presets={p['k']:p['v'] for p in img.get('presets',[])}
  relative=presets.get('dat1280',img.get('relativePath'))
  if not relative:continue
  cdn='https://assets.stanleytools.com' if brand=='stanley' else 'https://assets.dewalt.com'
  items.append(dict(brand='STANLEY' if brand=='stanley' else 'DeWALT',sku=h['sku'],title=h['title'],image=urljoin(cdn,relative),alt=img.get('altText',''),sourcePage=domain+h['url'],manufacturerSpecs=h.get('specs',{}),manufacturerCategory=h.get('category','')))
 return items

def download(item):
 ident=item['id'];out=BASE/'photos'/f'{ident}.webp';thumb=BASE/'thumbs'/f'{ident}.webp'
 try:
  if not out.exists():
   raw=BASE/'cache'/f'{ident}.img';fetch(item['image'],raw)
   with Image.open(raw) as im:
    im=ImageOps.exif_transpose(im)
    if max(im.size)<800 or min(im.size)<80:raise RuntimeError(f'Source too small: {im.size}')
    if im.mode=='RGBA':
     bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);im=bg.convert('RGB')
    else:im=im.convert('RGB')
    item['sourceDimensions']=list(im.size)
    # Trim only uniform near-white border. Never remove backgrounds or alter a product.
    im=ImageOps.contain(im,(864,864),Image.Resampling.LANCZOS)
    square=Image.new('RGB',(960,960),'white');square.paste(im,((960-im.width)//2,(960-im.height)//2))
    square.save(out,'WEBP',quality=88,method=6)
    square.resize((360,360),Image.Resampling.LANCZOS).save(thumb,'WEBP',quality=84,method=6)
  item.update(local=f'assets/catalog/photos/{ident}.webp',thumbnail=f'assets/catalog/thumbs/{ident}.webp',review='pending',rights='Manufacturer copyrighted product imagery; no open-stock license found. Private demo reference. Public/commercial reuse permission not established.',transform='Proportionally fitted on a white 960px square; no product recolouring, retouching or invented branding.')
  print('OK',ident,item['title'],flush=True)
 except Exception as e:item.update(review='missing',error=str(e));print('MISSING',ident,str(e),flush=True)
 return item

def contact_sheets(rows):
 font=ImageFont.truetype(str(ROOT/'assets/fonts/GolosText-Variable.ttf'),14)
 for b in range((len(rows)+24)//25):
  sheet=Image.new('RGB',(1500,1500),'#e8e9eb');d=ImageDraw.Draw(sheet)
  for i,row in enumerate(rows[b*25:(b+1)*25]):
   x=(i%5)*300;y=(i//5)*300;d.rectangle((x+6,y+6,x+294,y+294),fill='white')
   p=ROOT/row.get('local','missing')
   if p.is_file():
    im=Image.open(p).convert('RGB');im.thumbnail((264,246));sheet.paste(im,(x+18+(264-im.width)//2,y+10))
   d.text((x+12,y+258),row['id'],fill='#202329',font=font)
   d.text((x+12,y+278),row['brand']+' '+row['sku'][:28],fill='#202329',font=font)
  sheet.save(ROOT/'assets/previews'/f'catalog-{b+1:02}.jpg',quality=92)

def main():
 rows=[];seen=set()
 for cat,label,count,sources in CATEGORIES:
  pool=[];groups=[]
  for brand,category in sources:
   try:groups.append(get_items(brand,category))
   except Exception as e:print('SOURCE FAILED',brand,category,str(e),flush=True)
  for i in range(max([len(g) for g in groups] or [0])):
   for group in groups:
    if i<len(group):pool.append(group[i])
  if cat=='coatings':
   pool=[i for i in pool if not any(w in i['title'].lower() for w in ['underbody','gravel','incoat','silicone spray'])]
  selected=[]
  for item in pool:
   key=item['brand']+':'+item['sku']
   if key in seen:continue
   seen.add(key);item.update(category=cat,id=cat+'-'+re.sub('[^a-z0-9-]','',item['sku'].lower()));selected.append(item)
   if len(selected)>=count:break
  print('CATEGORY',cat,len(selected),'/',count,flush=True);rows+=selected
 (BASE/'source-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 with cf.ThreadPoolExecutor(max_workers=4) as executor: rows=list(executor.map(download,rows))
 manifest=dict(categories=[dict(id=c,label=l,target=n) for c,l,n,_ in CATEGORIES],items=rows)
 (BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 contact_sheets(rows)
 print('DONE',sum('local' in i for i in rows),'/',len(rows),flush=True)

if __name__=='__main__':main()
