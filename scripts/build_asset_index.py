"""Build the local asset review document and verify its image inventory."""
from pathlib import Path
from PIL import Image, ImageOps
import csv, hashlib, html, json
ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'assets'
escape=html.escape

def main():
 manifest_path=A/'catalog/manifest.json'
 manifest=json.loads(manifest_path.read_text())
 rows=manifest['items']
 assert len(rows)==100 and len(manifest['categories'])==8
 hashes=set()
 for row in rows:
  for field,expected in [('local',(960,960)),('thumbnail',(360,360))]:
   path=ROOT/row[field]
   with Image.open(path) as im:
    im.load();assert im.size==expected,(path,im.size)
   row[field+'Bytes']=path.stat().st_size
  row['sha256']=hashlib.sha256((ROOT/row['local']).read_bytes()).hexdigest()
  assert row['sha256'] not in hashes, 'Duplicate image: '+row['id']
  hashes.add(row['sha256'])
  row['review']='visually-reviewed-packshot'
  row['catalogBinding']='Match this exact manufacturer model and depicted kit/colour. Related kit sizes and dimensions may belong to one product family, not separate arbitrary products. No real store availability or price is asserted.'
  raw=A/'catalog/cache'/f'{row["id"]}.img'
  if raw.exists():
   with Image.open(raw) as im:row['sourceDimensions']=list(im.size)
 manifest['reviewSummary']='100 locally stored product photographs inspected on four contact sheets. Rights are recorded separately from visual suitability.'
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 with (A/'catalog/manifest.csv').open('w',newline='') as f:
  fields=['id','category','brand','sku','title','sourcePage','image','local','thumbnail','rights']
  w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
 original=A/'Pop-Art Handyman with Power Drill.png'
 with Image.open(original) as im:
  im=ImageOps.exif_transpose(im);im.thumbnail((480,480));im.save(A/'brand/menu-mascot.webp','WEBP',quality=90,method=6)
 sections=[]
 for category in manifest['categories']:
  cards=[]
  for row in rows:
   if row['category']!=category['id']:continue
   local=row['local'].removeprefix('assets/');thumb=row['thumbnail'].removeprefix('assets/')
   cards.append(f'<article><a href="{escape(local)}"><img loading="lazy" width="360" height="360" src="{escape(thumb)}" alt="{escape(row["title"])}"></a><p class="brand">{escape(row["brand"])} · {escape(row["sku"])}</p><h3>{escape(row["title"])}</h3><a class="source" href="{escape(row["sourcePage"])}" target="_blank" rel="noopener noreferrer">Источник фотографии ↗</a></article>')
  sections.append(f'<section id="{category["id"]}"><h2>{escape(category["label"])} <small>{len(cards)}</small></h2><div class="grid">{"".join(cards)}</div></section>')
 icons=[]
 for path in sorted((A/'icons').glob('*.svg')):
  if path.name=='sprite.svg':continue
  svg=path.read_text().replace('currentColor','#202329')
  icons.append(f'<div class="icon">{svg}<span>{escape(path.stem)}</span></div>')
 nav=''.join(f'<a href="#{c["id"]}">{escape(c["label"])}</a>' for c in manifest['categories'])
 page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Центр-Строй — подготовленные ассеты</title>
<style>@font-face{font-family:Golos;src:url(fonts/GolosText-Variable.ttf) format('truetype');font-weight:400 900;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#f3f4f5;color:#202329;font:16px/1.55 Golos,Arial,sans-serif}main{max-width:1440px;margin:auto;padding:40px 28px 80px}h1{font-size:clamp(28px,4vw,48px);line-height:1.12;margin:12px 0 20px}h2{font-size:28px;margin:48px 0 20px}h3{font-size:15px;line-height:1.45;font-weight:500;margin:8px 0 16px}p{max-width:80ch}.eyebrow{font-size:14px;color:#626873}a{color:#a94300;text-underline-offset:4px}a:focus-visible{outline:3px solid #a94300;outline-offset:5px}.sheet{width:100%;display:block;border-radius:16px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}article{background:white;padding:16px;border-radius:16px;display:flex;flex-direction:column}article img{width:100%;height:auto;object-fit:contain;display:block}.brand{font-size:12px;color:#626873;margin:12px 0 0;overflow-wrap:anywhere}.source{font-size:13px;margin-top:auto}small{font-size:16px;color:#626873}nav{display:flex;flex-wrap:wrap;gap:10px 22px;margin:30px 0}.icons{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.icon{background:#fff;padding:20px 10px;display:flex;align-items:center;gap:12px;font-size:12px;overflow-wrap:anywhere}.icon svg{width:24px;height:24px;flex-shrink:0}.note{padding:18px 22px;background:#fff;border-left:4px solid #ff7a1a}.links{display:flex;gap:24px;flex-wrap:wrap;margin:20px 0 40px}@media(max-width:1000px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.icons{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:600px){main{padding:24px 16px 48px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}article{padding:10px}h2{font-size:23px}.icons{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:340px){.grid{grid-template-columns:1fr}}</style>
<main><p class="eyebrow">Этап 2 · Локальный просмотр · Это комплект ассетов, не макет сайта</p><h1>Центр-Строй.<br>Материалы для будущего магазина</h1><p>Авторская SVG-надпись по вывеске, тихий узор из инструментов, кириллический шрифт, 30 иконок и 100 предметных фотографий в восьми категориях. Все файлы открываются локально.</p><h2>Надпись и орнамент</h2><img class="sheet" src="previews/brand-board.png" alt="Оранжевая надпись Центр-Строй на графитовом фоне с орнаментом инструментов"><div class="links"><a href="brand/wordmark-orange.svg">Надпись SVG</a><a href="brand/tools-pattern.svg">Прозрачный орнамент SVG</a><a href="brand/shopfront-reference.png">Исходная вывеска</a><a href="brand/menu-mascot.webp">Исходный персонаж для меню</a></div><h2>Шрифт и цвет</h2><img class="sheet" src="previews/type-and-colors.png" alt="Golos Text, кириллица, цветовая палитра и скругление 16 пикселей"><p>Яркий оранжевый на графитовом: контраст 6,04:1. Для мелкого оранжевого текста на белом подготовлен более тёмный оттенок #b94c00.</p><h2>Иконки Lucide</h2><div class="icons">ICONS</div><h2>Фотографии товаров</h2><p>Квадраты 960×960 и миниатюры 360×360, без изменения цвета или комплектации товара. Нажатие на фото открывает большой файл.</p><p class="note">Фотографии взяты из официальных каталогов производителей. Они не выдаются за свободный фотосток; разрешение на публичное коммерческое использование не установлено. Источники и артикулы сохранены. Наличие этих моделей в самом магазине не подтверждено.</p><div class="links"><a href="catalog/manifest.csv">Реестр CSV</a><a href="catalog/manifest.json">Реестр JSON</a><a href="README.md">Состав комплекта и условия использования</a></div><nav>NAV</nav>SECTIONS</main></html>'''
 page=page.replace('<h2>Шрифт и цвет</h2>','<p><a href="previews/tools-detail.png">Новые силуэты инструментов крупным планом</a></p><h2>Шрифт и цвет</h2>')
 page=page.replace('<title>','<link rel="icon" href="data:,"><title>',1)
 page=page.replace('ICONS',''.join(icons)).replace('NAV',nav).replace('SECTIONS',''.join(sections))
 (A/'index.html').write_text(page)
 print('Verified: 100 unique photos, 100 thumbnails, eight categories. Local asset index built.')

if __name__=='__main__':main()
