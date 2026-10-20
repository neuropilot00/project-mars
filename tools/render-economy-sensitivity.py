#!/usr/bin/env python3
"""Render compact offline business charts from the bounded simulation artifacts.
Standard library only. Money plotted as decimal GP; ledger source retains integers.
"""
import csv, html, json, statistics as st, sys
from pathlib import Path
from collections import defaultdict
out=Path(sys.argv[1]); raw=json.loads((out/'summary.json').read_text()); runs=raw['runs']
groups=defaultdict(list)
for r in runs:groups[r['summary']['profile']].append(r['summary'])
daily=list(csv.DictReader((out/'daily.csv').open())); dates=defaultdict(lambda:defaultdict(list))
for r in daily:dates[r['profile']][int(r['day'])].append(r)
labels={'mixed_low':'Low activity','mixed_medium':'Medium activity','high_consumption':'High optional spending','zero_entrants_no_purchases':'No entrants / no purchases','player_decline':'Player decline','bots_matched_capital':'8 bots, matched capital','whale_hoard':'Whale hoarding','whale_dump':'Whale dumping','long_peace':'Long peace','war_resource_blockade':'War + supply blockade','buyer_shortage':'Buyer shortage','withdrawal_run_unknown':'Withdrawals + unknown'}
ko={'mixed_low':'낮은 활동','mixed_medium':'보통 활동','high_consumption':'선택 소비 높음','zero_entrants_no_purchases':'신규·결제 없음','player_decline':'활동 인원 감소','bots_matched_capital':'같은 자본의 봇 8개','whale_hoard':'고래 매점','whale_dump':'고래 덤핑','long_peace':'장기 평화','war_resource_blockade':'전쟁·자원 차단','buyer_shortage':'매수 부족','withdrawal_run_unknown':'출금 집중·미확정'}
labels.update(miner_heavy='More miners',fighter_builder_heavy='More fighters / builders')
ko.update(miner_heavy='채굴자 비중 높음',fighter_builder_heavy='전투·건조 비중 높음')
def values(p,k):return [float(r[k]) for r in groups[p] if r[k] is not None]
def med(p,k):
 vals=values(p,k);return st.median(vals) if vals else None
def rangev(p,k):
 vals=values(p,k);return [min(vals),max(vals)] if vals else [None,None]
def price_label(p):
 val=med(p,'iron_vwap_gp');return f'{val:.3f}' if val is not None else '미체결'
colors=['#f6ad63','#65c6ba','#99a9ff','#ef8292']; svg=[]
def text(x,y,s,size=12,color='#c9c6c3',anchor='start'):
 svg.append(f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" text-anchor="{anchor}" font-family="Arial, sans-serif">{html.escape(str(s))}</text>')
def box(x,y,w,h,title):
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="#191822" stroke="#4b403b"/>');text(x+18,y+30,title,17,'#f0e7df')
def linechart(x,y,w,h,series,unit='',legend=True):
 values=[v for _,d,_ in series for _,v in d if v is not None];lo=min([0]+values);hi=max([1]+values);span=hi-lo or 1
 def xy(day,v):return x+(day-1)/111*w,y+h-(v-lo)/span*h
 for i in range(5):
  v=lo+span*i/4;yy=y+h-i*h/4;svg.append(f'<path d="M{x},{yy}h{w}" stroke="#34313b"/>');text(x-7,yy+4,f'{v:,.0f}{unit}',10,anchor='end')
 for d in [1,28,56,84,112]:text(x+(d-1)/111*w,y+h+17,str(d),10,anchor='middle')
 for j,(name,data,col) in enumerate(series):
  pts=' '.join(f'{xy(day,v)[0]:.2f},{xy(day,v)[1]:.2f}' for day,v in data if v is not None)
  svg.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="2.2"/>')
  if legend:text(x+(j%2)*w/2,y+h+40+(j//2)*19,name,11,col)
profiles=list(groups)
svg.append('<svg xmlns="http://www.w3.org/2000/svg" width="1480" height="1320" viewBox="0 0 1480 1320"><rect width="1480" height="1320" fill="#100e15"/>')
text(28,38,f'OCCUPY MARS | {len(runs)} bounded economic behavior runs',26,'#f0e7df');text(28,62,f'3 seeds x {len(profiles)} profiles | 112 virtual days | 48 synthetic accounts | not live demand or a full-game forecast',14)
box(24,82,708,435,'GP issued vs true burn (median, excluding opening balances)')
maxflow=max(med(p,k) for p in profiles for k in ['gp_issuance_ex_opening','gp_true_burn'])
for i,p in enumerate(profiles):
 yy=140+i*24;text(40,yy+4,labels[p],12);a=med(p,'gp_issuance_ex_opening');b=med(p,'gp_true_burn')
 for j,(v,c) in enumerate([(a,colors[0]),(b,colors[1])]):svg.append(f'<rect x="252" y="{yy-9+j*9}" width="{v/maxflow*350:.2f}" height="7" fill="{c}"/>')
 text(711,yy+4,f'{a/1000:.0f}k / {b/1000:.0f}k',11,anchor='end')
text(40,500,'Orange: new GP issuance. Teal: true burn. Pool allocations are transfers.',11)
box(748,82,708,435,'Cumulative net GP issuance over time (median of 3 seeds)')
selected=['mixed_medium','high_consumption','long_peace','war_resource_blockade'];series=[]
for p,c in zip(selected,colors):series.append((labels[p],[(d,st.median(float(r['gp_issued_ex_opening'])-float(r['gp_true_burned']) for r in rs)/1000) for d,rs in sorted(dates[p].items())],c))
linechart(814,139,602,270,series,'k')
box(24,536,708,360,'Order completion and controller concentration (median %)')
for i,p in enumerate(profiles):
 yy=591+i*20;g=groups[p];fill=st.median(100*r['filledOrders']/max(1,r['fundedBidOrders']+r['fundedAskOrders']) for r in g);conc=med(p,'top_controller_pct');text(40,yy+4,labels[p],11)
 for j,(v,c) in enumerate([(fill,colors[1]),(conc,colors[2])]):svg.append(f'<rect x="253" y="{yy-7+j*8}" width="{v/100*350:.2f}" height="6" fill="{c}"/>')
 text(711,yy+4,f'{fill:.1f}% / {conc:.1f}%',11,anchor='end')
text(40,881,'Teal: fully completed funded orders. Purple: largest controller GP share.',11)
box(748,536,708,360,'Iron ask inventory: availability can differ from total inventory')
series=[]
for p,c in zip(['mixed_medium','whale_hoard','war_resource_blockade'],colors):series.append((labels[p],[(d,st.median(float(r['iron_ask_quantity']) for r in rs)) for d,rs in sorted(dates[p].items())],c))
linechart(814,590,602,208,series)
box(24,915,708,357,'112-day cash flow by role: faucets and market net, per account')
role_group=defaultdict(list)
for r in runs:
 if r['summary']['profile']=='mixed_medium':
  for role,s in r['roles'].items():role_group[role].append(s)
role_max=max(st.median(s['faucetsGP']/s['accounts'] for s in vals) for vals in role_group.values())
for i,(role,vals) in enumerate(role_group.items()):
 yy=977+i*39;income=st.median(s['faucetsGP']/s['accounts'] for s in vals);market=st.median(s['marketNetGP']/s['accounts'] for s in vals)
 text(42,yy+4,role.title(),13);svg.append(f'<rect x="142" y="{yy-8}" width="{income/role_max*370:.2f}" height="14" fill="{colors[0]}"/>');text(706,yy+4,f'faucets {income:,.0f} / market {market:+,.0f}',12,anchor='end')
text(42,1244,'GP cash flow is not fiat profit. Acquisition, consumption and opening stock are separate.',11)
box(748,915,708,357,'Funded USDT claims during concentrated withdrawals')
series=[]
for key,name,col in [('reserve_USDT','Reserves',colors[1]),('claims_USDT','Customer claims',colors[0])]:series.append((name,[(d,st.median(float(r[key]) for r in rs)) for d,rs in sorted(dates['withdrawal_run_unknown'].items())],col))
linechart(814,969,602,195,series)
text(780,1244,'Overlapping lines mean reserve = claims; unknown amounts remain owed, not paid.',11)
text(28,1302,'Price, role frequency, war losses and willingness to pay are synthetic assumptions. See policy sources and run parameters.',12)
svg.append('</svg>');(out/'economy-sensitivity.svg').write_text(''.join(svg))
# Compact per-profile ranges, useful without opening the full run data.
agg=[]
for p in profiles:
 entry={'profile':p,'label_ko':ko[p]}
 for key in ['gp_issuance_ex_opening','gp_true_burn','net_gp_issuance_ex_opening','top_controller_pct','bot_gp_share_pct','iron_vwap_gp','iron_final_inventory','longest_iron_ask_stockout_hours','longest_account_repair_material_stockout_hours']:
  entry[key]={'median':med(p,key),'range':rangev(p,key)}
 entry['order_completion_pct']={'median':st.median(100*r['filledOrders']/max(1,r['fundedBidOrders']+r['fundedAskOrders']) for r in groups[p])}
 agg.append(entry)
(out/'profile-ranges.json').write_text(json.dumps(agg,ensure_ascii=False,indent=2)+'\n')
rows=''.join('<tr><th>'+html.escape(ko[p])+'</th>'+''.join('<td>'+v+'</td>' for v in [f"{med(p,'gp_issuance_ex_opening'):,.0f}",f"{med(p,'gp_true_burn'):,.0f}",f"{med(p,'net_gp_issuance_ex_opening'):,.0f}",f"{med(p,'top_controller_pct'):.1f}%",price_label(p),f"{med(p,'longest_account_repair_material_stockout_hours'):.0f}시간"] )+'</tr>' for p in profiles)
page='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Occupy Mars 경제 민감도</title><style>:root{color-scheme:dark}body{margin:24px auto;padding:0 18px;max-width:1480px;background:#100e15;color:#eee2d7;font:16px/1.7 system-ui}a{color:#f6ad63}h1{font-size:28px}.note{border-left:3px solid #f6ad63;padding:12px 18px;background:#201721}img{width:100%;height:auto}table{border-collapse:collapse;min-width:900px;width:100%}td,th{padding:12px;border-bottom:1px solid #55463e;text-align:right}th:first-child{text-align:left}.scroll{overflow:auto}select{font:inherit;min-height:44px;background:#201721;color:inherit;border:1px solid #785e49;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 system-ui;background:#201721;padding:18px}</style><h1>112일 · 36회 경제 민감도</h1><p class="note">보존식 통과는 경제가 잘 돌아간다는 증거가 아닙니다. 이 결과는 실제 코드에서 추적한 값과 합성 유저 행동을 결합한 일부 경제 경로의 비교입니다. 운영 설정·실제 수요·수익 예측이 아닙니다.</p><p><a href="summary.csv">요약 CSV</a> · <a href="daily.csv">일별 CSV</a> · <a href="parameters.json">설정·가정</a> · <a href="run-receipt.json">실행 자원</a> · <a href="../../../work/occupy-upgrade/docs/ECONOMY_SENSITIVITY_FINDINGS_2026-10-21.md">한국어 해석</a></p><img src="economy-sensitivity.svg" alt="경제 지표 비교 그래프"><h2>3개 seed의 중앙값</h2><div class="scroll"><table><tr><th>가정</th><th>신규 GP</th><th>실소각 GP</th><th>순발행 GP</th><th>최대 운영자 비중</th><th>철 체결단가 GP</th><th>최장 수리재 부족</th></tr>'''+rows+'''</table></div><h2>seed별 원문 지표</h2><label>조건 <select id="pick"></select></label><pre id="detail"></pre><script>const runs='''+json.dumps([r['summary'] for r in runs],ensure_ascii=False).replace('<','\\u003c')+''';const pick=document.getElementById('pick');for(let i=0;i<runs.length;i++){const o=document.createElement('option');o.value=i;o.textContent=runs[i].profile+' / '+runs[i].seed;pick.append(o)}function show(){document.getElementById('detail').textContent=JSON.stringify(runs[+pick.value],null,2)}pick.onchange=show;show();</script></html>'''
page=page.replace('112일 · 36회 경제 민감도',f'112일 · {len(runs)}회 경제 민감도')
(out/'index.html').write_text(page)
print('Rendered SVG, HTML and compact profile-ranges.json from '+str(len(runs))+' runs')
