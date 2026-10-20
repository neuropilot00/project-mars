#!/usr/bin/env python3
"""Standalone charts of the stored nine source-market comparisons; no model rerun."""
import html,json,statistics as st,sys
from pathlib import Path
old,out=map(Path,sys.argv[1:3]);before=json.loads((old/'summary.json').read_text())['runs'];after=json.loads((out/'summary.json').read_text())['runs']
profiles=['mixed_medium','buyer_shortage','bots_matched_capital']
names={'mixed_medium':'Medium activity','buyer_shortage':'Buyer shortage','bots_matched_capital':'8 bots, matched capital'}
ko={'mixed_medium':'보통 활동','buyer_shortage':'매수 부족','bots_matched_capital':'동일 자본 봇 8계정'}
def vals(rows,p,k):return [float(r['summary'][k]) for r in rows if r['summary']['profile']==p]
def summary(rows,p,k):
 v=vals(rows,p,k);return {'median':st.median(v),'minimum':min(v),'maximum':max(v)}
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="850" viewBox="0 0 1280 850"><rect width="1280" height="850" fill="#100e15"/>']
def text(x,y,s,size=13,color='#d4cbc4',anchor='start'):
 svg.append(f'<text x="{x}" y="{y}" font-family="Arial, sans-serif" font-size="{size}" fill="{color}" text-anchor="{anchor}">{html.escape(str(s))}</text>')
text(28,40,'OCCUPY MARS | Fixed listings / whole-lot immediate purchases',25,'#f0e7df')
text(28,66,'9 stored runs | 3 seeds x 3 profiles | 112 virtual days | ranges are observed seeds, not confidence intervals',14)
metrics=[('net_gp_issuance_ex_opening','Net GP issued, excluding opening','GP'),('iron_traded','Iron quantity actually traded','units'),('iron_final_global_inventory','Ending global iron inventory','units'),('top_controller_pct','Largest controller share of player GP','%')]
aggregate=[]
for n,(key,title,unit) in enumerate(metrics):
 x=24+(n%2)*632;y=92+(n//2)*352
 svg.append(f'<rect x="{x}" y="{y}" width="608" height="332" rx="14" fill="#191822" stroke="#4b403b"/>');text(x+18,y+29,title,18,'#f0e7df')
 maximum=max(max(vals(rows,p,key)) for rows in [before,after] for p in profiles)*1.05
 for i,p in enumerate(profiles):
  yy=y+65+i*75;text(x+18,yy,names[p],13)
  for j,(rows,color,label) in enumerate([(before,'#f6ad63','Old proxy'),(after,'#65c6ba','Source market')]):
   stats=summary(rows,p,key);ybar=yy+9+j*17;bx=x+18;scale=400/maximum
   svg.append(f'<rect x="{bx}" y="{ybar}" width="{stats["median"]*scale:.2f}" height="10" fill="{color}"/>')
   lo=bx+stats['minimum']*scale;hi=bx+stats['maximum']*scale
   svg.append(f'<path d="M{lo:.2f},{ybar+5}H{hi:.2f} M{lo:.2f},{ybar+1}V{ybar+9} M{hi:.2f},{ybar+1}V{ybar+9}" stroke="#eee2d7" stroke-width="1"/>')
   labelval=f'{stats["median"]:.2f}%' if unit=='%' else f'{stats["median"]:,.0f}'
   text(x+585,ybar+10,labelval,12,color,anchor='end');aggregate.append({'profile':p,'metric':key,'mode':label,**stats})
 text(x+18,y+309,'Orange: prior proxy. Teal: source-market mode. Bars: medians.',11)
text(28,818,'Source-mode changes also include expiry120→168h, cap3→20 and excluding unsupported stack-item sales.',13)
text(28,839,'Synthetic demand and shared RNG paths remain. Not a full service replay, actual demand estimate or single-variable effect.',12)
svg.append('</svg>');(out/'comparison.svg').write_text(''.join(svg));(out/'profile-ranges.json').write_text(json.dumps(aggregate,indent=2)+'\n')
def display_range(p,key,decimals=0):
 s=summary(after,p,key);return f'{s["minimum"]:,.{decimals}f}~{s["maximum"]:,.{decimals}f}'
rows=''.join('<tr><th>'+ko[p]+'</th>'+''.join('<td>'+display_range(p,k,d)+'</td>' for k,d in [('net_gp_issuance_ex_opening',0),('iron_traded',0),('listingSold',0),('sold_over_created_pct',2),('listingExpired',0),('horizonOpenReturned',0)])+'</tr>' for p in profiles)
page='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Occupy Mars 실제 매도 계약 비교</title><style>:root{color-scheme:dark}body{margin:24px auto;padding:0 18px;max-width:1280px;background:#100e15;color:#eee2d7;font:16px/1.7 system-ui}a{color:#f6ad63}h1{font-size:28px}.note{background:#201721;border-left:3px solid #f6ad63;padding:12px 18px}img{width:100%;height:auto}table{border-collapse:collapse;min-width:920px;width:100%}td,th{padding:12px;border-bottom:1px solid #55463e;text-align:right}th:first-child{text-align:left}.scroll{overflow:auto}select{font:inherit;min-height:44px;max-width:100%;background:#201721;color:inherit;border:1px solid #785e49;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 system-ui;background:#201721;padding:18px}</style><h1>실제 매도·즉시 구매 계약을 적용한 9회 비교</h1><p class="note">기존 42회 결과를 보존했습니다. 실제 서비스의 시장 계약을 좁게 적용한 합성 행동 실험이며, 운영 DB·실제 수요·전체 게임 경제를 재현한 결과는 아닙니다. 소스 모드 판매율과 기존 양쪽 주문 완료율은 정의가 달라 직접 비교하지 않습니다.</p><p><a href="../../../work/occupy-upgrade/docs/ECONOMY_SOURCE_MARKET_COMPARISON_FINDINGS_2026-10-21.md">결과 해석</a> · <a href="comparison.csv">seed별 비교 CSV</a> · <a href="summary.csv">새 결과 CSV</a> · <a href="daily.csv">일별 CSV</a> · <a href="parameters.json">정책·가정</a> · <a href="run-receipt.json">실행 receipt</a></p><img src="comparison.svg" alt="기존 합성 주문서와 실제 매도 계약 비교"><h2>새 소스 모드의 3개 seed 범위</h2><div class="scroll"><table><tr><th>조건</th><th>순발행 GP</th><th>철 거래 수량</th><th>판매 매물</th><th>등록 대비 판매 %</th><th>실제 만료</th><th>종료 시 미만료 반환</th></tr>'''+rows+'''</table></div><h2>seed별 지표</h2><label>조건 <select id="pick"></select></label><pre id="detail"></pre><script>const runs='''+json.dumps([r['summary'] for r in after],ensure_ascii=False).replace('<','\\u003c')+''';const pick=document.getElementById('pick');for(let i=0;i<runs.length;i++){const o=document.createElement('option');o.value=i;o.textContent=runs[i].profile+' / '+runs[i].seed;pick.append(o)}function show(){document.getElementById('detail').textContent=JSON.stringify(runs[+pick.value],null,2)}pick.onchange=show;show();</script></html>'''
(out/'index.html').write_text(page)
print('Rendered comparison from stored 9 runs; no simulation executed')
