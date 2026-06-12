// ══ War Betting v2 JS ══

// ═════ War Betting State ═════

const wb = {
  currentTab: 'active',
  events: [],
  // 이벤트별 선택 상태
  selectedOptions: {},   // { eventId: 'a'|'b'|'c' }
  betAmounts: {},        // { eventId: number }
};

async function openWarBetting() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  document.getElementById('warBettingModal').classList.add('active');
  await wbLoad();
}

function closeWarBetting() {
  document.getElementById('warBettingModal').classList.remove('active');
}

function wbSwitchTab(tab) {
  wb.currentTab = tab;
  document.querySelectorAll('.wb-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  wbLoad();
}

async function wbLoad() {
  const body = document.getElementById('wbBody');
  body.innerHTML = `<div class="wb-empty">${LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...'}</div>`;

  try {
    let url = '';
    if (wb.currentTab === 'active')  url = '/api/betting/events';
    else if (wb.currentTab === 'recent') url = '/api/betting/events/recent?limit=20';
    else url = '/api/betting/mine';

    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    const items = data.events || data.bets || [];

    if (items.length === 0) {
      body.innerHTML = `<div class="wb-empty">
        ${wb.currentTab === 'active' ? (LANG==='ko'?'현재 진행 중인 베팅이 없습니다':LANG==='ja'?'現在進行中のベットはありません':LANG==='zh'?'暂无进行中的投注':'No active bets') :
          wb.currentTab === 'recent' ? (LANG==='ko'?'최근 결과가 없습니다':LANG==='ja'?'最近の結果がありません':LANG==='zh'?'暂无最近结果':'No recent results') :
          (LANG==='ko'?'베팅 기록이 없습니다':LANG==='ja'?'ベット履歴がありません':LANG==='zh'?'暂无投注记录':'No bet history')}
      </div>`;
      return;
    }

    if (wb.currentTab === 'mine') {
      body.innerHTML = items.map(renderMyBet).join('');
    } else {
      body.innerHTML = items.map(e => renderEventCard(e, wb.currentTab === 'recent')).join('');
    }
  } catch (err) {
    console.error('[warBetting] load error:', err);
    body.innerHTML = `<div class="wb-empty">${LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed'}</div>`;
  }
}

// ── 이벤트 카드 렌더 ──

function renderEventCard(event, readonly = false) {
  const typeMap = { siege: LANG==='ko'?'공성전':LANG==='ja'?'攻城戦':LANG==='zh'?'攻城战':'Siege', guild_war: LANG==='ko'?'길드전':LANG==='ja'?'ギルド戦':LANG==='zh'?'公会战':'Guild War', weekly_top: LANG==='ko'?'주간 TOP':LANG==='ja'?'週間TOP':LANG==='zh'?'周榜TOP':'Weekly Top' };
  const isThreeWay = !!event.option_c_label;
  const selectedOpt = wb.selectedOptions[event.id];
  const betAmount = wb.betAmounts[event.id] || '';

  const closesAt = new Date(event.closes_at);
  const minsLeft = Math.floor((closesAt - Date.now()) / 60000);
  const isSoon = minsLeft < 60;
  const closeText = minsLeft < 0
    ? (LANG==='ko'?'베팅 마감':LANG==='ja'?'受付終了':LANG==='zh'?'投注截止':'Betting Closed')
    : minsLeft < 60
    ? `${minsLeft}${LANG==='ko'?'분 후 마감':LANG==='ja'?'分後締切':LANG==='zh'?'分钟后截止':' min left'}`
    : `${Math.floor(minsLeft/60)}${LANG==='ko'?'시간 후 마감':LANG==='ja'?'時間後締切':LANG==='zh'?'小时后截止':' hr left'}`;

  const opts = [
    { key: 'a', label: event.option_a_label, total: event.total_bet_a, odds: event.odds?.a },
    { key: 'b', label: event.option_b_label, total: event.total_bet_b, odds: event.odds?.b },
    ...(isThreeWay ? [{ key: 'c', label: event.option_c_label, total: event.total_bet_c, odds: event.odds?.c }] : []),
  ];

  const wonOpt = event.winner_option;

  return `
    <div class="wb-event-card">
      <div class="wb-event-header">
        <div class="wb-event-title">${escapeHtml(event.title_ko || event.title_en || '')}</div>
        <div class="wb-event-type ${event.event_type}">${typeMap[event.event_type] || event.event_type}</div>
      </div>
      <div class="wb-closes-at ${isSoon && !readonly ? 'soon' : ''}">${closeText}</div>

      <div class="wb-options ${isThreeWay ? 'three-way' : ''}">
        ${opts.map(o => {
          const isWon  = wonOpt === o.key;
          const isLost = wonOpt && wonOpt !== o.key;
          const isSel  = selectedOpt === o.key;
          return `
            <div class="wb-option-btn ${isSel ? 'selected' : ''} ${isWon ? 'won' : ''} ${isLost ? 'lost' : ''}"
                 onclick="${readonly ? '' : `wbSelectOption(${event.id},'${o.key}')`}">
              <div class="wb-option-label">${escapeHtml(o.label || '')}</div>
              <div class="wb-option-odds">${o.odds ? o.odds.toFixed(2) + 'x' : '-'}</div>
              <div class="wb-option-total">${formatNum(o.total || 0)} GP ${LANG==='ko'?'베팅':LANG==='ja'?'ベット':LANG==='zh'?'下注':'bet'}</div>
              ${isWon ? `<div style="font-size:9px;color:#81c784;margin-top:2px">✅ ${LANG==='ko'?'당첨':LANG==='ja'?'当選':LANG==='zh'?'中奖':'Won'}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      ${!readonly ? `
        <div class="wb-bet-row">
          <div class="wb-bet-quick">
            <button class="wb-bet-quick-btn" onclick="wbSetAmount(${event.id},100)">100</button>
            <button class="wb-bet-quick-btn" onclick="wbSetAmount(${event.id},500)">500</button>
            <button class="wb-bet-quick-btn" onclick="wbSetAmount(${event.id},1000)">1K</button>
          </div>
          <input class="wb-bet-input" id="wbAmount${event.id}"
                 type="number" placeholder="GP 입력..." min="10" max="2000"
                 value="${betAmount}"
                 oninput="wb.betAmounts[${event.id}]=parseInt(this.value)||0">
          <button class="wb-bet-btn" onclick="wbPlaceBet(${event.id})"
                  ${selectedOpt ? '' : 'disabled'}>
            ${LANG==='ko'?'베팅':LANG==='ja'?'ベット':LANG==='zh'?'投注':'Bet'}
          </button>
        </div>
        ${selectedOpt ? `<div style="font-size:9px;color:rgba(255,255,255,.4);text-align:right;margin-top:4px">
          ${LANG==='ko'?'선택':LANG==='ja'?'選択':LANG==='zh'?'已选':'Selected'}: <b style="color:#ff9800">${opts.find(o=>o.key===selectedOpt)?.label || ''}</b>
        </div>` : ''}
        <div style="font-size:9px;color:rgba(255,255,255,.25);text-align:right;margin-top:2px">
          ${LANG==='ko'?'총 풀':LANG==='ja'?'総プール':LANG==='zh'?'总池':'Total pool'}: ${formatNum(event.odds?.total_pool || 0)} GP · ${LANG==='ko'?'하우스 엣지':LANG==='ja'?'ハウスエッジ':LANG==='zh'?'庄家抽水':'House edge'} 5%
        </div>
      ` : ''}
    </div>
  `;
}

function renderMyBet(bet) {
  const statusMap = { pending:LANG==='ko'?'대기중':LANG==='ja'?'待機中':LANG==='zh'?'待结算':'Pending', won:LANG==='ko'?'당첨':LANG==='ja'?'当選':LANG==='zh'?'中奖':'Won', lost:LANG==='ko'?'낙첨':LANG==='ja'?'落選':LANG==='zh'?'未中':'Lost', refunded:LANG==='ko'?'환불':LANG==='ja'?'払戻':LANG==='zh'?'已退款':'Refunded' };
  return `
    <div class="wb-my-bet-row">
      <div>
        <div class="wb-my-bet-event">${escapeHtml(bet.title_ko || '')}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px">
          ${LANG==='ko'?'선택':LANG==='ja'?'選択':LANG==='zh'?'已选':'Selected'}: <span class="wb-my-bet-option">${escapeHtml(bet.option_label || bet.option)}</span>
        </div>
      </div>
      <div class="wb-my-bet-amount">
        <div style="color:#ffd700;font-weight:700">${formatNum(bet.amount_gp)} GP</div>
        ${bet.payout_gp > 0
          ? `<div style="color:#81c784;font-size:9px">+${formatNum(bet.payout_gp)} GP</div>`
          : ''}
      </div>
      <div class="wb-my-bet-status ${bet.status}">${statusMap[bet.status] || bet.status}</div>
    </div>
  `;
}

// ── 인터랙션 ──

function wbSelectOption(eventId, option) {
  wb.selectedOptions[eventId] = option;
  wbLoad();
}

function wbSetAmount(eventId, amount) {
  wb.betAmounts[eventId] = amount;
  const input = document.getElementById(`wbAmount${eventId}`);
  if (input) input.value = amount;
}

async function wbPlaceBet(eventId) {
  const option = wb.selectedOptions[eventId];
  const amount = wb.betAmounts[eventId] || parseInt(
    document.getElementById(`wbAmount${eventId}`)?.value
  ) || 0;

  if (!option) { showFactionToast(LANG==='ko'?'옵션을 선택하세요':LANG==='ja'?'オプションを選択してください':LANG==='zh'?'请选择选项':'Select an option','error'); return; }
  if (amount < 10) { showFactionToast(LANG==='ko'?'최소 10 GP 이상 베팅':LANG==='ja'?'最低10GPベット':LANG==='zh'?'最低下注10GP':'Minimum bet 10 GP','error'); return; }

  try {
    const res = await fetch('/api/betting/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ event_id: eventId, option, amount_gp: amount })
    });
    const data = await res.json();

    if (!res.ok) {
      const msgMap = {
        'BETTING_CLOSED': LANG==='ko'?'베팅이 마감됐습니다':LANG==='ja'?'ベット受付終了':LANG==='zh'?'投注已截止':'Betting closed',
        'ALREADY_BET': LANG==='ko'?'이미 베팅했습니다':LANG==='ja'?'すでにベット済み':LANG==='zh'?'已下注':'Already bet',
        'INSUFFICIENT_GP': `${LANG==='ko'?'GP 부족: ':LANG==='ja'?'GP不足: ':LANG==='zh'?'GP不足: ':'Insufficient GP: '}${data.meta?.required} GP`,
        'BET_TOO_SMALL': `${LANG==='ko'?'최소':LANG==='ja'?'最小':LANG==='zh'?'最小':'Min'} ${data.meta?.min} GP`,
        'BET_TOO_LARGE': `${LANG==='ko'?'최대':LANG==='ja'?'最大':LANG==='zh'?'最大':'Max'} ${data.meta?.max} GP`,
      };
      showFactionToast(msgMap[data.error] || (LANG==='ko'?`오류: ${data.error}`:LANG==='ja'?`エラー: ${data.error}`:LANG==='zh'?`错误: ${data.error}`:`Error: ${data.error}`), 'error');
      return;
    }

    showFactionToast(`${LANG==='ko'?'베팅 완료!':LANG==='ja'?'ベット完了!':LANG==='zh'?'投注成功!':'Bet placed!'} ${LANG==='ko'?'현재 배당':LANG==='ja'?'現在の倍率':LANG==='zh'?'当前赔率':'Odds'}: ${data.current_odds?.a || '-'}x`, 'success');
    delete wb.selectedOptions[eventId];
    delete wb.betAmounts[eventId];
    await wbLoad();
  } catch (err) {
    console.error('[warBetting] placeBet error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}
