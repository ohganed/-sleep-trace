#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
@dataclass
class Check: level:str; name:str; detail:str
REQ_CFG=("schemaVersion","appId","name","shortName","version","startUrl","scope","display","themeColor","backgroundColor","serviceWorker","deployment")
REQ_MAN=("name","short_name","start_url","scope","display","background_color","theme_color")
def j(p):
    with p.open(encoding="utf-8") as f:d=json.load(f)
    if not isinstance(d,dict):raise ValueError
    return d
def safe(v):
    if not isinstance(v,str) or not v.strip():return False
    u=urlparse(v.strip());return not(u.scheme or u.netloc or v.startswith('/'))
def has(text,pat):return bool(re.search(pat,text,re.I))
def swreg(t):return 'serviceWorker' in t and has(t,r'\.register\s*\(')
def scripts(h):return re.findall(r'<script\b[^>]*src=["\']([^"\']+)["\'][^>]*>',h,re.I)
def main():
    root=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve(); out=[]
    idx=root/'index.html'; manp=root/'manifest.webmanifest'; cfgp=root/'deployment.config.json'
    html=idx.read_text(encoding='utf-8',errors='replace') if idx.exists() else ''
    out.append(Check('PASS' if idx.exists() else 'FAIL','index.html','exists' if idx.exists() else 'missing'))
    try: cfg=j(cfgp); out.append(Check('PASS','deployment.config.json','parses'))
    except Exception: cfg={}; out.append(Check('FAIL','deployment.config.json','missing/invalid'))
    if cfg:
        miss=[k for k in REQ_CFG if k not in cfg]; out.append(Check('FAIL' if miss else 'PASS','deployment contract',','.join(miss) if miss else 'required fields present'))
        for k in ('startUrl','scope'):out.append(Check('PASS' if safe(cfg.get(k)) else 'FAIL',f'config {k}',str(cfg.get(k))))
        dep=cfg.get('deployment',{});out.append(Check('PASS' if dep.get('target')=='github-pages' else 'WARNING','deployment target',str(dep.get('target'))));out.append(Check('PASS' if dep.get('basePathPolicy')=='relative' else 'FAIL','base path policy',str(dep.get('basePathPolicy'))))
        icons=cfg.get('icons',[]); missing=[i for i in icons if not (root/str(i).removeprefix('./')).exists()]; out.append(Check('WARNING' if not icons else ('FAIL' if missing else 'PASS'),'icons','none declared' if not icons else ('missing '+','.join(missing) if missing else 'all declared icons exist')))
    try: man=j(manp); out.append(Check('PASS','manifest.webmanifest','parses'))
    except Exception: man={}; out.append(Check('FAIL','manifest.webmanifest','missing/invalid'))
    if man:
        miss=[k for k in REQ_MAN if k not in man];out.append(Check('FAIL' if miss else 'PASS','manifest baseline',','.join(miss) if miss else 'required fields present'))
        for k in ('start_url','scope'):out.append(Check('PASS' if safe(man.get(k)) else 'FAIL',f'manifest {k}',str(man.get(k))))
        sizes={str(x.get('sizes','')) for x in man.get('icons',[]) if isinstance(x,dict)};out.append(Check('PASS' if '192x192' in sizes else 'WARNING','manifest 192 icon','declared' if '192x192' in sizes else 'not declared'));out.append(Check('PASS' if '512x512' in sizes else 'WARNING','manifest 512 icon','declared' if '512x512' in sizes else 'not declared'))
    out.append(Check('PASS' if has(html,r'<link\b[^>]*rel=["\'][^"\']*manifest') else 'FAIL','manifest reference','present' if 'manifest' in html else 'missing'));out.append(Check('PASS' if 'apple-touch-icon' in html else 'WARNING','Apple touch icon','present' if 'apple-touch-icon' in html else 'not referenced'))
    swc=cfg.get('serviceWorker',{}) if cfg else {}; swp=root/str(swc.get('path','./sw.js')).removeprefix('./')
    if swc.get('enabled'):
        out.append(Check('PASS' if swp.exists() else 'FAIL','service worker',str(swc.get('path'))));out.append(Check('PASS' if swc.get('cacheVersion') else 'FAIL','cache version',str(swc.get('cacheVersion'))))
        if swp.exists():
            t=swp.read_text(encoding='utf-8',errors='replace');out.append(Check('PASS' if all(x in t for x in ('caches.open','activate','fetch')) else 'WARNING','service worker lifecycle','detected'))
        reg=swreg(html);src='index.html'
        if not reg:
            for s in scripts(html):
                p=root/s.removeprefix('./')
                if p.exists() and swreg(p.read_text(encoding='utf-8',errors='replace')):reg=True;src=s;break
        out.append(Check('PASS' if reg else 'FAIL','service worker registration',src if reg else 'not detected'))
    hazards=re.findall(r'(?:src|href)=["\'](/(?!/)[^"\']*)["\']',html);out.append(Check('FAIL' if hazards else 'PASS','root-absolute paths',','.join(hazards) if hazards else 'none'))
    for c in out:print(f'[{c.level:<7}] {c.name}: {c.detail}')
    f=sum(c.level=='FAIL' for c in out);w=sum(c.level=='WARNING' for c in out);p=sum(c.level=='PASS' for c in out);print(f'RESULT: {"FAIL" if f else ("WARNING" if w else "PASS")} | PASS {p} WARNING {w} FAIL {f}');return 1 if f else 0
if __name__=='__main__':raise SystemExit(main())
