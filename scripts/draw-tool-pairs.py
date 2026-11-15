from pathlib import Path
out=Path(__file__).resolve().parents[1] / 'assets/previews/tool-pairs-v4'
out.mkdir(parents=True, exist_ok=True)
hammer='M-54-101 H-34 Q-29-101-25-105 C-3-120 31-118 57-103 L53-94 C32-101 19-96 13-84 V-67 H-13 V-82 H-30 V-77 H-54 Q-57-77-57-80 V-98 Q-57-101-54-101 Z M-13-60 H13 V-29 Q13-21 16-13 L16 88 A16 16 0 0 1-16 88 V-13 Q-13-21-13-29 Z'
wrench='M-18-106 C-49-92-47-52-20-40 V85 A20 20 0 0 0 20 85 V-40 C47-52 49-92 18-106 V-78 Q18-72 13-69 L3-63 Q0-61-3-63 L-13-69 Q-18-72-18-78 Z M-7 85 A7 7 0 1 0 7 85 A7 7 0 1 0-7 85 Z'
screw='M-7-109 H7 L9-87 L5-77 V-14 H15 Q21-14 21-8 V-1 Q25 2 25 9 V80 A25 25 0 0 1-25 80 V9 Q-25 2-21-1 V-8 Q-21-14-15-14 H-5 V-77 L-9-87 Z'
pliers='M-2-108 H-15 Q-19-108-20-103 L-25-73 Q-28-58-16-43 L-11-35 L-27 13 C-34 35-37 64-34 89 A12 12 0 0 0-10 87 C-13 62-10 40-3 20 L0 11 L3 20 C10 40 13 62 10 87 A12 12 0 0 0 34 89 C37 64 34 35 27 13 L11-35 L16-43 Q28-58 25-73 L20-103 Q19-108 15-108 H2 V-70 H-2 Z M-6-39 A6 6 0 1 0 6-39 A6 6 0 1 0-6-39 Z'
brush='M-30-109 H30 Q34-109 34-105 V-42 H-34 V-105 Q-34-109-30-109 Z M-34-35 H34 V-20 C34-6 21 1 15 8 Q13 11 13 18 V85 A13 13 0 0 1-13 85 V18 Q-13 11-15 8 C-21 1-34-6-34-20 Z'
spatula='M-36-109 H36 Q42-109 41-103 L28-44 Q26-34 16-34 H7 V-5 H12 Q18-5 18 1 V84 A18 18 0 0 1-18 84 V1 Q-18-5-12-5 H-7 V-34 H-16 Q-26-34-28-44 L-41-103 Q-42-109-36-109 Z'
pairs=[('hammer-wrench','Молоток + гаечный ключ',hammer,wrench),('screwdriver-pliers','Отвёртка + пассатижи',screw,pliers),('brush-spatula','Кисть + шпатель',brush,spatula)]
def pair(a,b,x,y,scale,fg,bg):
 return f'<g transform="translate({x} {y}) scale({scale})" fill="{fg}" fill-rule="evenodd"><path d="{a}" transform="rotate(-45)"/><path d="{b}" transform="rotate(45)" stroke="{bg}" stroke-width="7" stroke-linejoin="round" paint-order="stroke"/></g>'
for slug,label,a,b in pairs:
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><title>{label}</title><rect width="320" height="320" fill="white"/>'+pair(a,b,160,164,1.18,'#2c2421','#ffffff')+'</svg>'
 (out/f'{slug}.svg').write_text(svg)
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1020" viewBox="0 0 1440 1020"><rect width="1440" height="1020" fill="#faf8f5"/><text x="64" y="74" font-family="DejaVu Sans" font-size="32" font-weight="bold" fill="#2c2421">Центр-Строй · инструменты</text><text x="64" y="111" font-family="DejaVu Sans" font-size="17" fill="#77716b">Три пары · цельные силуэты · единый характер скруглений</text>']
for i,(slug,label,a,b) in enumerate(pairs):
 x=64+i*448
 s.append(f'<rect x="{x}" y="150" width="416" height="364" rx="12" fill="#fff"/>')
 s.append(pair(a,b,x+208,330,1.3,'#2c2421','#fff'))
 s.append(f'<text x="{x+208}" y="552" text-anchor="middle" font-family="DejaVu Sans" font-size="20" font-weight="bold" fill="#2c2421">{label}</text>')
s.append('<rect x="0" y="602" width="1440" height="418" fill="#202329"/><text x="64" y="650" font-family="DejaVu Sans" font-size="17" fill="#a1a2a5">Те же силуэты на тёмном фоне</text>')
for i,(_,label,a,b) in enumerate(pairs):
 s.append(pair(a,b,272+i*448,830,1.12,'#727478','#202329'))
s.append('</svg>')
(out/'board.svg').write_text(''.join(s))

# Transparent production tile: masking leaves a real gap at each crossing.
# Keep opacity on the complete motif so overlapping tools never become brighter.
definitions=[]
motifs=[]
for i, (slug, label, back, front) in enumerate(pairs):
    definitions.append(
        f'<mask id="crossing-{i}" maskUnits="userSpaceOnUse" x="-180" y="-180" width="360" height="360">'
        '<rect x="-180" y="-180" width="360" height="360" fill="white"/>'
        f'<path d="{front}" transform="rotate(45)" fill="black" stroke="black" stroke-width="7" stroke-linejoin="round" fill-rule="evenodd"/>'
        '</mask>'
    )
    motifs.append(
        f'<g transform="translate({120+i*240} 120) scale(.70)" fill="#fff" fill-rule="evenodd">'
        f'<g mask="url(#crossing-{i})"><path d="{back}" transform="rotate(-45)"/></g>'
        f'<path d="{front}" transform="rotate(45)"/></g>'
    )
pattern=(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 720" aria-hidden="true">'
    '<defs>'+''.join(definitions)+
    '<pattern id="tools" width="720" height="240" patternUnits="userSpaceOnUse">'
    '<g opacity=".05">'+''.join(motifs)+'</g></pattern></defs>'
    '<path fill="url(#tools)" d="M0 0H1920V720H0Z"/></svg>\n'
)
(out.parents[1] / 'brand' / 'tools-pattern.svg').write_text(pattern)
