// [v7.215] iOS phantom-click 가드 — backdrop close 함수 wrapper.
//   모달 open 직후 (modal.dataset.openedAt 기록) 350ms 안의 backdrop click 은 무시.
//   iOS Safari 의 touchstart→touchend→click 합성 이벤트로 인한 false close 차단.
//   사용법: <div onclick="if(event.target===this)_safeBackdropClose(this, closeXxx)">
// [v7.222 upgrade #4] 생산 modifier 배열의 +% 들을 곱연산해 총 배수 반환. '+50%' → ×1.5.
//   음수(-%)/단순 숫자도 안전 파싱. 빈 배열이면 1.
function _calcTotalMult(mods){
  var m = 1;
  (mods||[]).forEach(function(x){
    var v = String(x && x.value || '').replace(/[^0-9.\-]/g,'');
    var pct = parseFloat(v);
    if (isFinite(pct)) m *= (1 + pct/100);
  });
  return Math.max(0, m);
}
window._calcTotalMult = _calcTotalMult;
window._safeBackdropClose = function(modalEl, closeFn) {
  try {
    var openedAt = parseInt(modalEl.dataset.openedAt || '0', 10);
    if (openedAt && (Date.now() - openedAt) < 350) return; // iOS phantom click
  } catch(_) {}
  if (typeof closeFn === 'function') closeFn();
};
// [v7.190] 서버 에러 코드 4언어 매핑 공통 헬퍼. 사용: showToast(srvErr(d.error || 'FAIL'), 'error')
function srvErr(code){
  if (!code) return tl('Failed','실패','失敗','失败');
  var c = String(code).toUpperCase();
  var M = {
    INSUFFICIENT_GP: ['Not enough GP','GP 부족','GP不足','GP不足'],
    INSUFFICIENT_PP: ['Not enough PP','PP 부족','PP不足','PP不足'],
    INSUFFICIENT_USDT: ['Not enough USDT','USDT 부족','USDT不足','USDT不足'],
    INSUFFICIENT_BALANCE: ['Insufficient balance','잔액 부족','残高不足','余额不足'],
    INSUFFICIENT_RESOURCES: ['Not enough materials','재료 부족','材料不足','材料不足'],
    NO_WALLET: ['Login required','로그인 필요','ログインが必要','请先登录'],
    NOT_AUTHENTICATED: ['Login required','로그인 필요','ログインが必要','请先登录'],
    FORBIDDEN: ['Forbidden','권한 없음','権限なし','无权限'],
    NOT_PARTICIPANT: ['Not a participant','참여자 아님','参加者ではない','非参与者'],
    DEFENDER_CANNOT_FORFEIT: ['Defender cannot forfeit','방어자는 후퇴 불가','防御者は撤退不可','防御方无法撤退'],
    SHIP_LISTED_FOR_SALE: ['Ship is listed for sale','함선이 마켓 등록 중','艦船は出品中','舰船已上架'],
    SHIP_IN_BATTLE: ['Ship is in battle','함선 전투 중','艦船は戦闘中','舰船作战中'],
    SHIP_NOT_FOUND: ['Ship not found','함선 없음','艦船が見つかりません','未找到舰船'],
    SHIP_DEAD: ['Ship destroyed','함선 파괴됨','艦船は撃沈済','舰船已被击毁'],
    SHIP_PLAYER_TYPE_LIMIT: ['Ship type limit reached','함급 보유 한도 도달','艦種保有上限','舰种持有上限'],
    SHIP_CROSS_FACTION_BLOCKED: ['Cross-faction ship cannot deploy','다른 진영 함선 편성 불가','他陣営艦船は編入不可','跨阵营舰船无法编入'],
    FLEET_IN_BATTLE: ['Fleet in battle','함대 전투 중','艦隊戦闘中','舰队作战中'],
    FLEET_NOT_FOUND: ['Fleet not found','함대 없음','艦隊が見つかりません','未找到舰队'],
    CANNOT_BUY_OWN_LISTING: ['Cannot buy your own listing','본인 매물 구매 불가','自分の出品は購入不可','无法购买自己的上架'],
    LISTING_NOT_FOUND: ['Listing no longer available','매물 없음','出品が見つかりません','物品已售出'],
    INVALID_PRICE: ['Invalid price','잘못된 가격','価格が不正','价格无效'],
    PRICE_TOO_LOW: ['Price too low','가격이 너무 낮음','価格が低すぎる','价格过低'],
    PRICE_TOO_HIGH: ['Price too high','가격이 너무 높음','価格が高すぎる','价格过高'],
    RATE_LIMITED: ['Too many requests','요청이 너무 잦음','リクエストが多すぎる','请求过于频繁'],
    SERVER_ERROR: ['Server error','서버 오류','サーバーエラー','服务器错误'],
    NETWORK_ERROR: ['Network error','네트워크 오류','ネットワークエラー','网络错误'],
    BATTLE_NOT_FOUND: ['Battle not found','전투 없음','戦闘が見つかりません','未找到战斗'],
    OBJECTIVE_REQUIREMENTS_NOT_MET: ['Objective incomplete','목표 미달성','目標未達成','目标未完成'],
    MISSION_IN_PROGRESS: ['Mission still in progress','미션 진행 중','ミッション進行中','任务进行中'],
    CSRF_REQUIRED: ['Session expired — please refresh','세션 만료 — 새로고침 필요','セッション切れ — 更新してください','会话已过期'],
    MARKET_DISABLED: ['Market is disabled','마켓 비활성화됨','マーケット無効','市场已禁用'],
    AUCTION_EXPIRED: ['Auction has expired','경매가 만료됨','オークション終了','拍卖已过期'],
    AUCTION_ENDED: ['Auction has ended','경매가 종료됨','オークション終了','拍卖已结束'],
    AUCTION_NOT_FOUND: ['Auction not found','경매 없음','オークションが見つかりません','未找到拍卖'],
    NOT_OWNER: ['Not the owner','소유자 아님','所有者ではない','非所有者'],
    HAS_BIDS: ['Cannot cancel — bids exist','입찰이 있어 취소 불가','入札があり取消不可','已有出价，无法取消'],
    BID_TOO_LOW: ['Bid too low','입찰가가 너무 낮음','入札額が低すぎる','出价过低'],
    ALREADY_HIGHEST_BIDDER: ['You are already the highest bidder','이미 최고 입찰자','既に最高入札者','您已是最高出价者'],
    PP_NOT_REDEEMABLE: ['This PP is not redeemable (deposited PP only)','상환 불가 PP (입금 PP만 가능)','償還不可のPP','不可赎回的PP'],
    SELF_BID: ['Cannot bid on your own auction','본인 경매 입찰 불가','自分のオークションに入札不可','无法对自己的拍卖出价'],
    CANNOT_BID_OWN: ['Cannot bid on your own auction','본인 경매 입찰 불가','自分のオークションに入札不可','无法对自己的拍卖出价'],
    INSUFFICIENT_QUANTITY: ['Not enough quantity','수량 부족','数量不足','数量不足'],
    UPGRADE_DISABLED: ['Upgrades are disabled','업그레이드 비활성화','アップグレード無効','升级已禁用'],
    UNKNOWN_UPGRADE_TYPE: ['Unknown upgrade type','알 수 없는 업그레이드','不明なアップグレード','未知升级类型'],
    P5_DISABLED: ['Territory upgrades are disabled','영토 업그레이드 비활성화','領土アップグレード無効','领地升级已禁用'],
    TERRITORY_NOT_FOUND: ['Territory not found','영토를 찾을 수 없음','領土が見つかりません','未找到领地'],
    MAX_LEVEL: ['Already at max level','이미 최대 레벨','既に最大レベル','已达最高等级'],
    NO_COST_CONFIGURED: ['Cost not configured','비용 미설정','コスト未設定','未配置费用'],
    USER_NOT_FOUND: ['User not found','유저를 찾을 수 없음','ユーザーが見つかりません','未找到用户'],
    MAX_UPGRADES_PER_CLAIM: ['Max upgrades reached for this territory','이 영토 업그레이드 한도 도달','この領土のアップグレード上限','该领地升级已达上限'],
  };
  return (M[c] && (LANG==='ko'?M[c][1]:LANG==='ja'?M[c][2]:LANG==='zh'?M[c][3]:M[c][0])) || String(code);
}
window.srvErr = srvErr;

// ── Item i18n mapping (shop items come from DB with English names) ──
var _itemI18n = {
  shield_basic:    { en:'Energy Shield',  ko:'에너지 실드',      ja:'エネルギーシールド', zh:'能量护盾',
                     desc_en:'Protects territory for 12h. Absorbs 50% damage.',
                     desc_ko:'12시간 동안 영토를 보호합니다. 피해의 50%를 흡수합니다.',
                     desc_ja:'12時間領土を保護。ダメージの50%を吸収。',
                     desc_zh:'保护领土12小时。吸收50%伤害。' },
  shield_advanced: { en:'Plasma Shield',  ko:'플라즈마 실드',    ja:'プラズマシールド',   zh:'等离子护盾',
                     desc_en:'Protects territory for 24h. Absorbs 80% damage.',
                     desc_ko:'24시간 동안 영토를 보호합니다. 피해의 80%를 흡수합니다.',
                     desc_ja:'24時間領土を保護。ダメージの80%を吸収。',
                     desc_zh:'保护领土24小时。吸收80%伤害。' },
  emp_strike:      { en:'EMP Strike',     ko:'EMP 공격',         ja:'EMP攻撃',           zh:'EMP打击',
                     desc_en:'Disables target shields for 6h.',
                     desc_ko:'대상 실드를 6시간 동안 비활성화합니다.',
                     desc_ja:'ターゲットのシールドを6時間無効化。',
                     desc_zh:'使目标护盾失效6小时。' },
  stealth_cloak:   { en:'Stealth Cloak',  ko:'스텔스 망토',      ja:'ステルスクローク',   zh:'隐身斗篷',
                     desc_en:'Hides your territories for 1h.',
                     desc_ko:'1시간 동안 영토를 숨깁니다.',
                     desc_ja:'1時間領土を非表示にする。',
                     desc_zh:'隐藏领土1小时。' },
  radar_scan:      { en:'Radar Scan',     ko:'레이더 스캔',      ja:'レーダースキャン',   zh:'雷达扫描',
                     desc_en:'Reveals hidden territories nearby.',
                     desc_ko:'근처 숨겨진 영토를 표시합니다.',
                     desc_ja:'近くの隠された領土を表示。',
                     desc_zh:'显示附近隐藏的领土。' },
  attack_boost:    { en:'Mars Rage',      ko:'화성의 분노',      ja:'マーズレイジ',       zh:'火星之怒',
                     desc_en:'Boosts attack power for next claim.',
                     desc_ko:'다음 점령 시 공격력을 강화합니다.',
                     desc_ja:'次の占領で攻撃力アップ。',
                     desc_zh:'下次占领时增强攻击力。' },
  pixel_doubler:   { en:'Pixel Doubler',  ko:'픽셀 더블러',      ja:'ピクセルダブラー',   zh:'像素翻倍器',
                     desc_en:'Doubles pixel output for next claim.',
                     desc_ko:'다음 점령 시 픽셀 수가 2배가 됩니다.',
                     desc_ja:'次の占領でピクセル数が2倍。',
                     desc_zh:'下次占领像素翻倍。' },
  mining_boost:    { en:'Mining Boost',   ko:'채굴 부스트',      ja:'採掘ブースト',       zh:'采矿加速',
                     desc_en:'Doubles mining rate for 2h.',
                     desc_ko:'2시간 동안 채굴 속도가 2배가 됩니다.',
                     desc_ja:'2時間採掘速度2倍。',
                     desc_zh:'2小时内采矿速度翻倍。' },
  shield_regen:    { en:'Regenerating Shield', ko:'재생 실드',       ja:'再生シールド',       zh:'再生护盾',
                     desc_en:'Auto-repairs 25% HP every 4h. Lasts 18h.',
                     desc_ko:'4시간마다 HP 25% 자동 회복. 18시간 지속.',
                     desc_ja:'4時間ごとにHP25%自動回復。18時間持続。',
                     desc_zh:'每4小时自动恢复25%HP。持续18小时。' },
  decoy_beacon:    { en:'Decoy Beacon',  ko:'미끼 비콘',        ja:'デコイビーコン',     zh:'诱饵信标',
                     desc_en:'Creates a fake territory marker for 12h.',
                     desc_ko:'12시간 동안 가짜 영토 표시를 생성합니다.',
                     desc_ja:'12時間偽の領土マーカーを生成。',
                     desc_zh:'生成虚假领土标记12小时。' },
  orbital_strike:  { en:'Orbital Strike', ko:'궤도 타격',        ja:'軌道攻撃',           zh:'轨道打击',
                     desc_en:'Guaranteed shield break on target territory.',
                     desc_ko:'대상 영토의 실드를 확실하게 파괴합니다.',
                     desc_ja:'ターゲット領土のシールドを確実に破壊。',
                     desc_zh:'确保摧毁目标领土护盾。' },
  virus_payload:   { en:'Virus Payload', ko:'바이러스 페이로드', ja:'ウイルスペイロード',   zh:'病毒载荷',
                     desc_en:'Halves target mining rate for 6h.',
                     desc_ko:'대상의 채굴 속도를 6시간 동안 50% 감소.',
                     desc_ja:'ターゲットの採掘速度を6時間50%低下。',
                     desc_zh:'目标采矿速度降低50%持续6小时。' },
  siege_ram:       { en:'Siege Ram',     ko:'공성추',            ja:'シージラム',          zh:'攻城锤',
                     desc_en:'+40% attack power for next claim (1 use).',
                     desc_ko:'다음 점령 시 공격력 40% 증가 (1회).',
                     desc_ja:'次の占領で攻撃力40%アップ（1回）。',
                     desc_zh:'下次占领攻击力+40%（1次）。' },
  supply_crate:    { en:'Supply Crate',  ko:'보급 상자',         ja:'補給クレート',        zh:'补给箱',
                     desc_en:'Instantly grants random 0.1~0.5 PP.',
                     desc_ko:'즉시 0.1~0.5 PP를 랜덤 지급합니다.',
                     desc_ja:'即座にランダムで0.1～0.5 PPを獲得。',
                     desc_zh:'立即随机获得0.1~0.5 PP。' },
  recall_beacon:   { en:'Recall Beacon', ko:'귀환 비콘',         ja:'リコールビーコン',    zh:'召回信标',
                     desc_en:'Instantly completes one active OPS mission.',
                     desc_ko:'진행 중인 OPS 미션 1개를 즉시 완료합니다.',
                     desc_ja:'進行中のOPSミッション1つを即完了。',
                     desc_zh:'立即完成一个进行中的OPS任务。' },
  territory_scan:  { en:'Territory Scanner', ko:'영토 스캐너',    ja:'テリトリースキャナー', zh:'领土扫描仪',
                     desc_en:'Shows all player territory sizes in your sector.',
                     desc_ko:'내 섹터의 모든 플레이어 영토 크기를 표시합니다.',
                     desc_ja:'セクター内の全プレイヤー領土サイズを表示。',
                     desc_zh:'显示你所在区域所有玩家的领土大小。' },
  harvest_surge:   { en:'Harvest Surge', ko:'수확 폭증',         ja:'ハーベストサージ',    zh:'收获激增',
                     desc_en:'Next harvest gives 3x PP (1 use).',
                     desc_ko:'다음 수확 시 PP 3배 (1회).',
                     desc_ja:'次のハーベストでPP3倍（1回）。',
                     desc_zh:'下次收获PP三倍（1次）。' },
  xp_amplifier:    { en:'XP Amplifier',  ko:'XP 증폭기',         ja:'XPアンプリファイア',  zh:'XP放大器',
                     desc_en:'Doubles XP from all sources for 4h.',
                     desc_ko:'4시간 동안 모든 XP 2배.',
                     desc_ja:'4時間全ソースからXP2倍。',
                     desc_zh:'4小时内所有XP翻倍。' },
  gp_generator:    { en:'GP Generator',  ko:'GP 생성기',         ja:'GPジェネレーター',    zh:'GP生成器',
                     desc_en:'Generates 5 GP per hour for 12h.',
                     desc_ko:'12시간 동안 매시간 5 GP를 생성합니다.',
                     desc_ja:'12時間毎時5 GPを生成。',
                     desc_zh:'12小时内每小时生成5 GP。' },
  lucky_charm:     { en:'Lucky Charm',   ko:'행운의 부적',       ja:'ラッキーチャーム',    zh:'幸运符',
                     desc_en:'+15% cantina winnings for 3h.',
                     desc_ko:'3시간 동안 칸티나 승리 보상 15% 증가.',
                     desc_ja:'3時間カンティーナ勝利報酬15%アップ。',
                     desc_zh:'3小时内酒吧胜利奖励+15%。' },
  starship_border: { en:'Starship Border',   ko:'스타쉽 테두리',     ja:'スターシップボーダー', zh:'星舰边框',
                     desc_en:'Rare animated border from rocket supply drops.',
                     desc_ko:'로켓 보급 드롭에서 얻는 희귀 애니메이션 테두리.',
                     desc_ja:'ロケット補給ドロップから得るレアなアニメーションボーダー。',
                     desc_zh:'火箭补给掉落的稀有动画边框。' },
  neon_border:     { en:'Neon Border',       ko:'네온 테두리',       ja:'ネオンボーダー',     zh:'霓虹边框',
                     desc_en:'Glowing cyan neon outline.',
                     desc_ko:'빛나는 시안색 네온 외곽선.',
                     desc_ja:'光るシアンのネオンアウトライン。',
                     desc_zh:'发光的青色霓虹轮廓。' },
  flame_border:    { en:'Flame Border',      ko:'화염 테두리',       ja:'フレイムボーダー',   zh:'火焰边框',
                     desc_en:'Fiery orange border effect.',
                     desc_ko:'불타는 오렌지색 테두리 효과.',
                     desc_ja:'燃えるオレンジの境界効果。',
                     desc_zh:'炽热的橙色边框效果。' },
  ice_border:      { en:'Ice Border',        ko:'얼음 테두리',       ja:'アイスボーダー',     zh:'冰霜边框',
                     desc_en:'Frozen crystalline border.',
                     desc_ko:'얼어붙은 결정 테두리.',
                     desc_ja:'凍りついた結晶の境界。',
                     desc_zh:'冰冻的水晶边框。' },
  gold_border:     { en:'Gold Border',       ko:'황금 테두리',       ja:'ゴールドボーダー',   zh:'黄金边框',
                     desc_en:'Prestigious gold trim.',
                     desc_ko:'고급스러운 금색 장식.',
                     desc_ja:'高貴なゴールドトリム。',
                     desc_zh:'尊贵的金色装饰。' },
  pulse_glow:      { en:'Pulse Glow',        ko:'펄스 글로우',       ja:'パルスグロウ',       zh:'脉冲光芒',
                     desc_en:'Rhythmic pulsing aura.',
                     desc_ko:'리드미컬한 맥동 오라.',
                     desc_ja:'リズミカルに脈動するオーラ。',
                     desc_zh:'有节奏的脉动光环。' },
  rainbow_glow:    { en:'Rainbow Glow',      ko:'무지개 글로우',     ja:'レインボーグロウ',   zh:'彩虹光芒',
                     desc_en:'Shifting spectrum glow.',
                     desc_ko:'변화하는 스펙트럼 빛.',
                     desc_ja:'移り変わるスペクトラムの光。',
                     desc_zh:'变幻的光谱辉光。' },
  dark_aura:       { en:'Dark Aura',         ko:'어둠의 오라',       ja:'ダークオーラ',       zh:'暗黑光环',
                     desc_en:'Ominous dark energy.',
                     desc_ko:'불길한 어둠의 에너지.',
                     desc_ja:'不吉なダークエネルギー。',
                     desc_zh:'不祥的黑暗能量。' },
  volcanic_terrain:{ en:'Volcanic Terrain',   ko:'화산 지형',         ja:'火山地形',           zh:'火山地形',
                     desc_en:'Lava-tinted territory fill.',
                     desc_ko:'용암 색조의 영토 채움.',
                     desc_ja:'溶岩色の領土フィル。',
                     desc_zh:'熔岩色调的领土填充。' },
  frozen_terrain:  { en:'Frozen Terrain',     ko:'빙결 지형',         ja:'凍結地形',           zh:'冰封地形',
                     desc_en:'Ice-blue territory fill.',
                     desc_ko:'얼음빛 파란색 영토 채움.',
                     desc_ja:'氷の青い領土フィル。',
                     desc_zh:'冰蓝色领土填充。' },
  crystal_terrain: { en:'Crystal Terrain',    ko:'크리스탈 지형',     ja:'クリスタル地形',     zh:'水晶地形',
                     desc_en:'Purple crystal tint.',
                     desc_ko:'보라색 크리스탈 색조.',
                     desc_ja:'紫のクリスタルティント。',
                     desc_zh:'紫色水晶色调。' },
  toxic_terrain:   { en:'Toxic Terrain',      ko:'독성 지형',         ja:'トキシック地形',     zh:'毒性地形',
                     desc_en:'Green toxic haze overlay.',
                     desc_ko:'녹색 독성 안개 오버레이.',
                     desc_ja:'緑の有毒ヘイズオーバーレイ。',
                     desc_zh:'绿色毒雾覆盖。' }
};
function _itemName(code){ var m=_itemI18n[code]; return m ? (m[LANG]||m.en) : ''; }
function _itemDesc(code){ var m=_itemI18n[code]; var k='desc_'+LANG; return m ? (m[k]||m.desc_en||'') : ''; }

// ── Quest i18n mapping (keyed by title_template from DB) ──
var _questI18n = {
  'Daily Check-In':        { ko:'일일 체크인',       ja:'デイリーチェックイン', zh:'每日签到',
                             desc_ko:'콜로니 터미널에 로그인하세요.',         desc_ja:'コロニー端末にログイン。',           desc_zh:'登录殖民地终端。' },
  'Morning Patrol':        { ko:'아침 순찰',         ja:'朝のパトロール',       zh:'晨间巡逻',
                             desc_ko:'출근 신고 — 오늘 로그인하세요.',       desc_ja:'任務報告 — 今日ログイン。',         desc_zh:'出勤报到 — 今天登录。' },
  'Colony Roll Call':      { ko:'콜로니 점호',       ja:'コロニー点呼',         zh:'殖民地点名',
                             desc_ko:'기지에서 출석을 확인하세요.',           desc_ja:'基地で出席を確認。',               desc_zh:'在基地确认出席。' },
  'Steady Colonist':       { ko:'꾸준한 이주민',     ja:'堅実な入植者',         zh:'稳定的殖民者',
                             desc_ko:'{n}일 연속 로그인하세요.',             desc_ja:'{n}日連続ログイン。',              desc_zh:'连续登录{n}天。' },
  'Dedicated Settler':     { ko:'헌신적인 정착민',   ja:'献身的な開拓者',       zh:'专注的定居者',
                             desc_ko:'{n}일 연속 로그인을 유지하세요.',      desc_ja:'{n}日間のログイン記録を維持。',    desc_zh:'保持{n}天连续登录。' },
  'Week-Long Vigil':       { ko:'일주일 연속 출석',  ja:'1週間連続ログイン',    zh:'一周连续登录',
                             desc_ko:'{n}일 연속 로그인하세요.',             desc_ja:'{n}日連続ログイン。',              desc_zh:'连续登录{n}天。' },
  'First Footprint':       { ko:'첫 발자국',         ja:'最初の足跡',           zh:'第一个脚印',
                             desc_ko:'화성 영토 {n}픽셀을 점령하세요.',      desc_ja:'火星の領土{n}ピクセルを占領。',    desc_zh:'占领{n}像素火星领土。' },
  'Small Claim':           { ko:'소규모 점령',       ja:'小規模占領',           zh:'小规模占领',
                             desc_ko:'오늘 {n}픽셀을 점령하세요.',           desc_ja:'今日{n}ピクセルを占領。',          desc_zh:'今天占领{n}像素。' },
  'Land Grab':             { ko:'영토 확보',         ja:'領土確保',             zh:'抢占领地',
                             desc_ko:'영토 {n}픽셀을 점령하세요.',           desc_ja:'領土{n}ピクセルを占領。',          desc_zh:'占领{n}像素领土。' },
  'Territory Scout':       { ko:'영토 정찰병',       ja:'領土偵察兵',           zh:'领土侦察兵',
                             desc_ko:'맵 전체에서 {n}픽셀을 점령하세요.',    desc_ja:'マップ全体で{n}ピクセルを占領。',  desc_zh:'在地图上占领{n}像素。' },
  'Expansion Order':       { ko:'확장 명령',         ja:'拡張命令',             zh:'扩张命令',
                             desc_ko:'이번 주 {n}픽셀을 점령하세요.',        desc_ja:'今週{n}ピクセルを占領。',          desc_zh:'本周占领{n}像素。' },
  'Dust Harvest':          { ko:'먼지 수확',         ja:'ダスト収穫',           zh:'尘埃收获',
                             desc_ko:'영토에서 PP를 수확하세요.',             desc_ja:'領土からPPを収穫。',               desc_zh:'从领土收获PP。' },
  'Resource Sweep':        { ko:'자원 수집',         ja:'資源スイープ',         zh:'资源扫荡',
                             desc_ko:'오늘 {n}번 수확하세요.',               desc_ja:'今日{n}回収穫。',                  desc_zh:'今天收获{n}次。' },
  'Diligent Farmer':       { ko:'근면한 농부',       ja:'勤勉な農夫',           zh:'勤劳的农夫',
                             desc_ko:'이번 주 {n}번 수확하세요.',             desc_ja:'今週{n}回収穫。',                  desc_zh:'本周收获{n}次。' },
  'Recon Scan':            { ko:'정찰 스캔',         ja:'偵察スキャン',         zh:'侦察扫描',
                             desc_ko:'섹터 맵을 여세요.',                     desc_ja:'セクターマップを開く。',           desc_zh:'打开扇区地图。' },
  'Map Review':            { ko:'지도 검토',         ja:'マップ確認',           zh:'地图查看',
                             desc_ko:'섹터 상태를 {n}번 확인하세요.',         desc_ja:'セクター状態を{n}回確認。',        desc_zh:'查看扇区状态{n}次。' },
  'Tactical Overview':     { ko:'전술 개요',         ja:'戦術概観',             zh:'战术概览',
                             desc_ko:'섹터를 {n}번 검토하세요.',              desc_ja:'セクターを{n}回確認。',            desc_zh:'查看扇区{n}次。' },
  'Rank Check':            { ko:'순위 확인',         ja:'ランク確認',           zh:'排名查看',
                             desc_ko:'리더보드를 확인하세요.',                desc_ja:'リーダーボードを確認。',           desc_zh:'查看排行榜。' },
  'Know Your Rivals':      { ko:'라이벌 파악',       ja:'ライバルを知る',       zh:'了解对手',
                             desc_ko:'순위를 {n}번 확인하세요.',              desc_ja:'ランキングを{n}回確認。',          desc_zh:'查看排名{n}次。' },
  'Intel Report':          { ko:'정보 보고서',       ja:'情報レポート',         zh:'情报报告',
                             desc_ko:'리더보드를 {n}번 확인하세요.',          desc_ja:'リーダーボードを{n}回確認。',      desc_zh:'查看排行榜{n}次。' },
  'Base Inspection':       { ko:'기지 점검',         ja:'基地点検',             zh:'基地检查',
                             desc_ko:'기지 대시보드를 여세요.',               desc_ja:'基地ダッシュボードを開く。',       desc_zh:'打开基地仪表盘。' },
  'HQ Briefing':           { ko:'사령부 브리핑',     ja:'司令部ブリーフィング', zh:'总部简报',
                             desc_ko:'오늘 기지를 {n}번 방문하세요.',         desc_ja:'今日基地を{n}回訪問。',            desc_zh:'今天访问基地{n}次。' },
  'Ops Center Run':        { ko:'작전실 순회',       ja:'作戦室巡回',           zh:'作战室巡查',
                             desc_ko:'기지를 {n}번 확인하세요.',              desc_ja:'基地を{n}回確認。',                desc_zh:'检查基地{n}次。' },
  'Cantina Break':         { ko:'캔티나 휴식',       ja:'カンティーナ休憩',     zh:'酒馆休息',
                             desc_ko:'캔티나 미니게임을 플레이하세요.',       desc_ja:'カンティーナミニゲームをプレイ。', desc_zh:'玩酒馆小游戏。' },
  'Game Night':            { ko:'게임의 밤',         ja:'ゲームナイト',         zh:'游戏之夜',
                             desc_ko:'캔티나 게임을 {n}번 플레이하세요.',     desc_ja:'カンティーナゲームを{n}回プレイ。',desc_zh:'玩{n}次酒馆游戏。' },
  'Lucky Round':           { ko:'행운의 라운드',     ja:'ラッキーラウンド',     zh:'幸运回合',
                             desc_ko:'캔티나 게임에서 승리하세요.',           desc_ja:'カンティーナゲームで勝利。',       desc_zh:'赢得酒馆游戏。' },
  'Cantina Regular':       { ko:'캔티나 단골',       ja:'カンティーナ常連',     zh:'酒馆常客',
                             desc_ko:'캔티나 게임을 {n}번 플레이하세요.',     desc_ja:'カンティーナゲームを{n}回プレイ。',desc_zh:'玩{n}次酒馆游戏。' },
  'Comms Check':           { ko:'통신 확인',         ja:'通信チェック',         zh:'通讯检查',
                             desc_ko:'길드 채팅 메시지를 보내세요.',          desc_ja:'ギルドチャットメッセージを送信。', desc_zh:'发送公会聊天消息。' },
  'Squad Talk':            { ko:'분대 대화',         ja:'分隊トーク',           zh:'小队对话',
                             desc_ko:'길드 메시지를 {n}개 보내세요.',         desc_ja:'ギルドメッセージを{n}件送信。',    desc_zh:'发送{n}条公会消息。' },
  'Active Comms':          { ko:'활발한 통신',       ja:'活発な通信',           zh:'活跃通讯',
                             desc_ko:'오늘 길드 메시지를 {n}개 보내세요.',    desc_ja:'今日ギルドメッセージを{n}件送信。',desc_zh:'今天发送{n}条公会消息。' },
  'Chatterbox':            { ko:'수다쟁이',          ja:'おしゃべり',           zh:'话痨',
                             desc_ko:'길드 메시지를 {n}개 보내세요.',         desc_ja:'ギルドメッセージを{n}件送信。',    desc_zh:'发送{n}条公会消息。' },
  'Border Skirmish':       { ko:'국경 교전',         ja:'国境小競り合い',       zh:'边境冲突',
                             desc_ko:'적 픽셀 {n}개를 탈취하세요.',           desc_ja:'敵のピクセルを{n}個奪取。',        desc_zh:'夺取{n}个敌方像素。' },
  'Raider Instinct':       { ko:'약탈자의 본능',     ja:'襲撃者の本能',         zh:'掠夺者直觉',
                             desc_ko:'적 픽셀 {n}개를 탈취하세요.',           desc_ja:'敵のピクセルを{n}個奪取。',        desc_zh:'夺取{n}个敌方像素。' },
  'Scout Launch':          { ko:'정찰 출격',         ja:'偵察出撃',             zh:'侦察出击',
                             desc_ko:'탐사 미션을 시작하세요.',               desc_ja:'探査ミッションを開始。',           desc_zh:'启动探索任务。' },
  'Sortie Order':          { ko:'출격 명령',         ja:'出撃命令',             zh:'出击命令',
                             desc_ko:'침공 미션을 시작하세요.',               desc_ja:'侵攻ミッションを開始。',           desc_zh:'启动入侵任务。' },
  'Explorer Badge':        { ko:'탐험가 뱃지',       ja:'探検家バッジ',         zh:'探险家徽章',
                             desc_ko:'탐사 미션을 완료하세요.',               desc_ja:'探査ミッションを完了。',           desc_zh:'完成探索任务。' },
  'Combat Veteran':        { ko:'전투 베테랑',       ja:'戦闘ベテラン',         zh:'战斗老兵',
                             desc_ko:'침공 미션을 완료하세요.',               desc_ja:'侵攻ミッションを完了。',           desc_zh:'完成入侵任务。' },
  'Field Kit':             { ko:'야전 장비',         ja:'フィールドキット',     zh:'野战装备',
                             desc_ko:'인벤토리에서 아이템을 사용하세요.',     desc_ja:'インベントリからアイテムを使用。', desc_zh:'使用库存中的物品。' },
  'Gear Up':               { ko:'장비 착용',         ja:'装備装着',             zh:'装备就绪',
                             desc_ko:'오늘 아이템 {n}개를 사용하세요.',       desc_ja:'今日アイテムを{n}個使用。',        desc_zh:'今天使用{n}个物品。' },
  'Sector Claim':          { ko:'섹터 점령',         ja:'セクター占領',         zh:'扇区占领',
                             desc_ko:'특정 섹터에서 픽셀을 점령하세요.',      desc_ja:'特定セクターでピクセルを占領。',   desc_zh:'在特定扇区占领像素。' },
  'Core Probe':            { ko:'코어 탐사',         ja:'コアプローブ',         zh:'核心探测',
                             desc_ko:'코어 구역에서 {n}픽셀을 점령하세요.',   desc_ja:'コアゾーンで{n}ピクセルを占領。',  desc_zh:'在核心区域占领{n}像素。' },
  'Routine Ops':           { ko:'일상 작전',         ja:'日常オペレーション',   zh:'日常行动',
                             desc_ko:'로그인하고 섹터 맵을 확인하세요.',      desc_ja:'ログインしてセクターマップを確認。',desc_zh:'登录并查看扇区地图。' },
  'Patrol Sweep':          { ko:'순찰 정리',         ja:'パトロールスイープ',   zh:'巡逻清扫',
                             desc_ko:'기지 확인 후 수확하세요.',              desc_ja:'基地確認後に収穫。',               desc_zh:'检查基地后收获。' },
  'Signal Ping':           { ko:'신호 핑',           ja:'シグナルピング',       zh:'信号脉冲',
                             desc_ko:'길드 채팅에서 메시지를 보내세요.',      desc_ja:'ギルドチャットでメッセージを送信。',desc_zh:'在公会聊天中发送消息。' },
  'Daily Recon':           { ko:'일일 정찰',         ja:'日次偵察',             zh:'每日侦察',
                             desc_ko:'섹터와 리더보드를 확인하세요.',         desc_ja:'セクターとリーダーボードを確認。', desc_zh:'查看扇区和排行榜。' },
  'Terrain Walk':          { ko:'지형 탐사',         ja:'地形ウォーク',         zh:'地形行走',
                             desc_ko:'오늘 {n}픽셀을 점령하세요.',            desc_ja:'今日{n}ピクセルを占領。',          desc_zh:'今天占领{n}像素。' },
  'Quick Harvest':         { ko:'빠른 수확',         ja:'クイック収穫',         zh:'快速收获',
                             desc_ko:'영토에서 한 번 수확하세요.',            desc_ja:'領土から一度収穫。',               desc_zh:'从领土收获一次。' },
  'Weekly Settler':        { ko:'주간 정착민',       ja:'週間開拓者',           zh:'每周定居者',
                             desc_ko:'이번 주 {n}일 로그인하세요.',           desc_ja:'今週{n}日ログイン。',              desc_zh:'本周登录{n}天。' },
  'Map Analyst':           { ko:'지도 분석가',       ja:'マップアナリスト',     zh:'地图分析师',
                             desc_ko:'섹터를 {n}번 확인하세요.',              desc_ja:'セクターを{n}回確認。',            desc_zh:'查看扇区{n}次。' },
  'Base Commander':        { ko:'기지 사령관',       ja:'基地司令官',           zh:'基地指挥官',
                             desc_ko:'기지를 {n}번 방문하세요.',              desc_ja:'基地を{n}回訪問。',                desc_zh:'访问基地{n}次。' },
  // ACTIVITY TIER
  'Land Rush':             { ko:'영토 러시',         ja:'ランドラッシュ',       zh:'土地争夺',
                             desc_ko:'하루에 {n}픽셀을 점령하세요.',          desc_ja:'1日に{n}ピクセルを占領。',         desc_zh:'一天内占领{n}像素。' },
  'Territory Push':        { ko:'영토 진격',         ja:'領土プッシュ',         zh:'领土推进',
                             desc_ko:'오늘 {n}픽셀을 점령하세요.',            desc_ja:'今日{n}ピクセルを占領。',          desc_zh:'今天占领{n}像素。' },
  'Expansion Campaign':    { ko:'확장 캠페인',       ja:'拡張キャンペーン',     zh:'扩张战役',
                             desc_ko:'이번 주 {n}픽셀을 점령하세요.',         desc_ja:'今週{n}ピクセルを占領。',          desc_zh:'本周占领{n}像素。' },
  'Colony Growth':         { ko:'콜로니 성장',       ja:'コロニー成長',         zh:'殖民地增长',
                             desc_ko:'이번 주 {n}픽셀을 점령하세요.',         desc_ja:'今週{n}ピクセルを占領。',          desc_zh:'本周占领{n}像素。' },
  'Sector Assault':        { ko:'섹터 공격',         ja:'セクター攻撃',         zh:'扇区突击',
                             desc_ko:'한 섹터에서 {n}픽셀을 점령하세요.',     desc_ja:'1セクターで{n}ピクセルを占領。',   desc_zh:'在一个扇区占领{n}像素。' },
  'Core Incursion':        { ko:'코어 침입',         ja:'コア侵入',             zh:'核心入侵',
                             desc_ko:'코어 구역 픽셀 {n}개를 점령하세요.',    desc_ja:'コアゾーンピクセルを{n}個占領。',  desc_zh:'占领{n}个核心区像素。' },
  'Sector Domination':     { ko:'섹터 지배',         ja:'セクター支配',         zh:'扇区统治',
                             desc_ko:'섹터 픽셀 {n}개를 점령하세요.',         desc_ja:'セクターピクセルを{n}個占領。',    desc_zh:'占领{n}个扇区像素。' },
  'Core Lockdown':         { ko:'코어 봉쇄',         ja:'コアロックダウン',     zh:'核心封锁',
                             desc_ko:'코어 구역 픽셀 {n}개를 점령하세요.',    desc_ja:'コアゾーンピクセルを{n}個占領。',  desc_zh:'占领{n}个核心区像素。' },
  'Harvest Cycle':         { ko:'수확 주기',         ja:'収穫サイクル',         zh:'收获周期',
                             desc_ko:'오늘 {n}번 수확하세요.',                desc_ja:'今日{n}回収穫。',                  desc_zh:'今天收获{n}次。' },
  'Full Harvest':          { ko:'완전 수확',         ja:'フル収穫',             zh:'全面收获',
                             desc_ko:'하루에 {n}번 수확하세요.',              desc_ja:'1日に{n}回収穫。',                 desc_zh:'一天内收获{n}次。' },
  'Harvest Marathon':      { ko:'수확 마라톤',       ja:'収穫マラソン',         zh:'收获马拉松',
                             desc_ko:'이번 주 {n}번 수확하세요.',             desc_ja:'今週{n}回収穫。',                  desc_zh:'本周收获{n}次。' },
  'Raid Party':            { ko:'습격 파티',         ja:'レイドパーティー',     zh:'突袭小队',
                             desc_ko:'적 픽셀 {n}개를 탈취하세요.',           desc_ja:'敵のピクセルを{n}個奪取。',        desc_zh:'夺取{n}个敌方像素。' },
  'Hostile Takeover':      { ko:'적대적 인수',       ja:'敵対的買収',           zh:'敌意收购',
                             desc_ko:'적 픽셀 {n}개를 탈취하세요.',           desc_ja:'敵のピクセルを{n}個奪取。',        desc_zh:'夺取{n}个敌方像素。' },
  "Warlord's March":       { ko:'군벌의 행군',       ja:'ウォーロードの行軍',   zh:'军阀行军',
                             desc_ko:'이번 주 픽셀 {n}개를 탈취하세요.',      desc_ja:'今週ピクセルを{n}個奪取。',        desc_zh:'本周夺取{n}个像素。' },
  'Double Sortie':         { ko:'이중 출격',         ja:'ダブルソーティー',     zh:'双重出击',
                             desc_ko:'침공 미션을 {n}개 시작하세요.',         desc_ja:'侵攻ミッションを{n}個開始。',      desc_zh:'启动{n}个入侵任务。' },
  'Recon Fleet':           { ko:'정찰 함대',         ja:'偵察艦隊',             zh:'侦察舰队',
                             desc_ko:'탐사 미션을 {n}개 시작하세요.',         desc_ja:'探査ミッションを{n}個開始。',      desc_zh:'启动{n}个探索任务。' },
  'Blitz Command':         { ko:'전격 지휘',         ja:'電撃司令',             zh:'闪击指挥',
                             desc_ko:'오늘 침공을 {n}개 시작하세요.',         desc_ja:'今日侵攻を{n}個開始。',            desc_zh:'今天启动{n}个入侵。' },
  'Invasion Spree':        { ko:'침공 연속',         ja:'侵攻ラッシュ',         zh:'入侵狂潮',
                             desc_ko:'침공 미션 {n}개를 완료하세요.',         desc_ja:'侵攻ミッションを{n}個完了。',      desc_zh:'完成{n}个入侵任务。' },
  'Expedition Corps':      { ko:'탐험 군단',         ja:'探検軍団',             zh:'远征军团',
                             desc_ko:'탐사 {n}개를 완료하세요.',              desc_ja:'探査を{n}個完了。',                desc_zh:'完成{n}次探索。' },
  'War Council':           { ko:'전쟁 평의회',       ja:'戦争評議会',           zh:'战争议会',
                             desc_ko:'총 {n}개 미션을 시작하세요.',           desc_ja:'合計{n}個のミッションを開始。',    desc_zh:'共启动{n}个任务。' },
  'Deep Space Survey':     { ko:'심우주 조사',       ja:'深宇宙調査',           zh:'深空调查',
                             desc_ko:'탐사 {n}개를 완료하세요.',              desc_ja:'探査を{n}個完了。',                desc_zh:'完成{n}次探索。' },
  'Cantina Champion':      { ko:'캔티나 챔피언',     ja:'カンティーナチャンピオン', zh:'酒馆冠军',
                             desc_ko:'캔티나 게임에서 {n}번 승리하세요.',     desc_ja:'カンティーナゲームで{n}回勝利。',  desc_zh:'赢得{n}次酒馆游戏。' },
  'High Roller':           { ko:'하이 롤러',         ja:'ハイローラー',         zh:'豪赌客',
                             desc_ko:'캔티나 게임을 {n}번 플레이하세요.',     desc_ja:'カンティーナゲームを{n}回プレイ。',desc_zh:'玩{n}次酒馆游戏。' },
  'Cantina Legend':        { ko:'캔티나 전설',       ja:'カンティーナ伝説',     zh:'酒馆传奇',
                             desc_ko:'캔티나 게임에서 {n}번 승리하세요.',     desc_ja:'カンティーナゲームで{n}回勝利。',  desc_zh:'赢得{n}次酒馆游戏。' },
  'Arcade Addict':         { ko:'아케이드 중독',     ja:'アーケード中毒',       zh:'街机迷',
                             desc_ko:'캔티나 게임을 {n}번 플레이하세요.',     desc_ja:'カンティーナゲームを{n}回プレイ。',desc_zh:'玩{n}次酒馆游戏。' },
  'Rally The Troops':      { ko:'군대 집결',         ja:'軍隊集結',             zh:'集结部队',
                             desc_ko:'길드 메시지를 {n}개 보내세요.',         desc_ja:'ギルドメッセージを{n}件送信。',    desc_zh:'发送{n}条公会消息。' },
  'Comms Officer':         { ko:'통신 장교',         ja:'通信士官',             zh:'通讯官',
                             desc_ko:'길드 메시지를 {n}개 보내세요.',         desc_ja:'ギルドメッセージを{n}件送信。',    desc_zh:'发送{n}条公会消息。' },
  'Supply Run':            { ko:'보급 작전',         ja:'補給作戦',             zh:'补给行动',
                             desc_ko:'오늘 아이템 {n}개를 사용하세요.',       desc_ja:'今日アイテムを{n}個使用。',        desc_zh:'今天使用{n}个物品。' },
  'Loadout Swap':          { ko:'장비 교체',         ja:'ロードアウト変更',     zh:'装备更换',
                             desc_ko:'하루에 아이템 {n}개를 사용하세요.',     desc_ja:'1日にアイテムを{n}個使用。',       desc_zh:'一天内使用{n}个物品。' },
  'Quartermaster':         { ko:'보급관',            ja:'兵站係',               zh:'军需官',
                             desc_ko:'이번 주 아이템 {n}개를 사용하세요.',    desc_ja:'今週アイテムを{n}個使用。',        desc_zh:'本周使用{n}个物品。' },
  'Iron Discipline':       { ko:'철의 규율',         ja:'鉄の規律',             zh:'铁的纪律',
                             desc_ko:'{n}일 연속 로그인하세요.',              desc_ja:'{n}日連続ログイン。',              desc_zh:'连续登录{n}天。' },
  'Fortnight Watch':       { ko:'2주 감시',          ja:'2週間の監視',          zh:'两周值守',
                             desc_ko:'{n}일 연속 로그인하세요.',              desc_ja:'{n}日連続ログイン。',              desc_zh:'连续登录{n}天。' },
  'Monthly Devotion':      { ko:'한 달의 헌신',      ja:'1ヶ月の献身',          zh:'一月忠诚',
                             desc_ko:'{n}일 연속 로그인하세요.',              desc_ja:'{n}日連続ログイン。',              desc_zh:'连续登录{n}天。' },
  'Frontline Ops':         { ko:'전선 작전',         ja:'前線オペレーション',   zh:'前线行动',
                             desc_ko:'픽셀 탈취와 미션을 시작하세요.',        desc_ja:'ピクセル奪取とミッションを開始。', desc_zh:'夺取像素并启动任务。' },
  'Combat Patrol':         { ko:'전투 순찰',         ja:'戦闘パトロール',       zh:'战斗巡逻',
                             desc_ko:'침공을 완료하고 수확하세요.',           desc_ja:'侵攻を完了して収穫。',             desc_zh:'完成入侵并收获。' },
  'Colony Builder':        { ko:'콜로니 건설자',     ja:'コロニービルダー',     zh:'殖民地建设者',
                             desc_ko:'{n}픽셀을 점령하고 수확하세요.',        desc_ja:'{n}ピクセルを占領して収穫。',      desc_zh:'占领{n}像素并收获。' },
  'Sector Scout':          { ko:'섹터 정찰',         ja:'セクター偵察',         zh:'扇区侦察',
                             desc_ko:'섹터를 {n}번 확인하세요.',              desc_ja:'セクターを{n}回確認。',            desc_zh:'查看扇区{n}次。' },
  'Rank Climber':          { ko:'순위 상승',         ja:'ランクアップ',         zh:'排名攀升',
                             desc_ko:'리더보드를 {n}번 확인하세요.',          desc_ja:'リーダーボードを{n}回確認。',      desc_zh:'查看排行榜{n}次。' },
  'Mission Ready':         { ko:'미션 준비 완료',    ja:'ミッション準備完了',   zh:'任务就绪',
                             desc_ko:'아무 미션이나 {n}개 시작하세요.',       desc_ja:'任意のミッションを{n}個開始。',    desc_zh:'启动任意{n}个任务。' },
  'Full Spectrum Ops':     { ko:'전방위 작전',       ja:'全方位オペレーション', zh:'全谱行动',
                             desc_ko:'아무 유형 미션 {n}개를 완료하세요.',    desc_ja:'任意のミッションを{n}個完了。',    desc_zh:'完成任意类型{n}个任务。' },
  // SPENDING TIER
  'Supply Drop':           { ko:'보급 투하',         ja:'補給投下',             zh:'补给投放',
                             desc_ko:'계정에 {n} USDT를 입금하세요.',         desc_ja:'アカウントに{n} USDTを入金。',     desc_zh:'向账户存入{n} USDT。' },
  'War Chest':             { ko:'전쟁 자금',         ja:'軍資金',               zh:'战争基金',
                             desc_ko:'오늘 {n} USDT를 입금하세요.',           desc_ja:'今日{n} USDTを入金。',             desc_zh:'今天存入{n} USDT。' },
  'Treasury Fill':         { ko:'금고 충전',         ja:'金庫充填',             zh:'金库充值',
                             desc_ko:'하루에 {n} USDT를 입금하세요.',         desc_ja:'1日に{n} USDTを入金。',            desc_zh:'一天内存入{n} USDT。' },
  'Big Investor':          { ko:'대형 투자자',       ja:'大口投資家',           zh:'大投资者',
                             desc_ko:'이번 주 {n} USDT를 입금하세요.',        desc_ja:'今週{n} USDTを入金。',             desc_zh:'本周存入{n} USDT。' },
  "Whale's Bounty":        { ko:'고래의 보상',       ja:'クジラの報奨',         zh:'鲸鱼赏金',
                             desc_ko:'이번 주 {n} USDT를 입금하세요.',        desc_ja:'今週{n} USDTを入金。',             desc_zh:'本周存入{n} USDT。' },
  'Token Exchange':        { ko:'토큰 교환',         ja:'トークン交換',         zh:'代币交换',
                             desc_ko:'{n} USDT 상당의 토큰을 스왑하세요.',    desc_ja:'{n} USDT分のトークンをスワップ。', desc_zh:'兑换价值{n} USDT的代币。' },
  'Market Maker':          { ko:'마켓 메이커',       ja:'マーケットメイカー',   zh:'做市商',
                             desc_ko:'{n} USDT의 토큰을 스왑하세요.',         desc_ja:'{n} USDTのトークンをスワップ。',   desc_zh:'兑换{n} USDT的代币。' },
  'Liquidity Provider':    { ko:'유동성 공급자',     ja:'流動性プロバイダー',   zh:'流动性提供者',
                             desc_ko:'오늘 {n} USDT를 스왑하세요.',           desc_ja:'今日{n} USDTをスワップ。',         desc_zh:'今天兑换{n} USDT。' },
  'Trading Mogul':         { ko:'트레이딩 거물',     ja:'トレーディング王',     zh:'交易大亨',
                             desc_ko:'이번 주 {n} USDT를 스왑하세요.',        desc_ja:'今週{n} USDTをスワップ。',         desc_zh:'本周兑换{n} USDT。' },
  'Exchange Baron':        { ko:'거래소 남작',       ja:'取引所男爵',           zh:'交易所男爵',
                             desc_ko:'이번 주 {n} USDT를 스왑하세요.',        desc_ja:'今週{n} USDTをスワップ。',         desc_zh:'本周兑换{n} USDT。' },
  'Quick Purchase':        { ko:'빠른 구매',         ja:'クイック購入',         zh:'快速购买',
                             desc_ko:'상점에서 아이템 {n}개를 구매하세요.',   desc_ja:'ショップからアイテムを{n}個購入。',desc_zh:'从商店购买{n}个物品。' },
  'Shopping Spree':        { ko:'쇼핑 스프리',       ja:'ショッピングスプリー', zh:'疯狂购物',
                             desc_ko:'상점에서 아이템 {n}개를 구매하세요.',   desc_ja:'ショップからアイテムを{n}個購入。',desc_zh:'从商店购买{n}个物品。' },
  'Bulk Order':            { ko:'대량 주문',         ja:'大量注文',             zh:'批量订购',
                             desc_ko:'오늘 상점 아이템 {n}개를 구매하세요.',  desc_ja:'今日ショップアイテムを{n}個購入。',desc_zh:'今天购买{n}个商店物品。' },
  'Supply Contract':       { ko:'보급 계약',         ja:'補給契約',             zh:'补给合同',
                             desc_ko:'이번 주 아이템 {n}개를 구매하세요.',    desc_ja:'今週アイテムを{n}個購入。',        desc_zh:'本周购买{n}个物品。' },
  'Arsenal Stockpile':     { ko:'무기고 비축',       ja:'武器庫備蓄',           zh:'军火库储备',
                             desc_ko:'이번 주 아이템 {n}개를 구매하세요.',    desc_ja:'今週アイテムを{n}個購入。',        desc_zh:'本周购买{n}个物品。' },
  'Blitz Expansion':       { ko:'전격 확장',         ja:'電撃拡張',             zh:'闪电扩张',
                             desc_ko:'하루에 {n}픽셀을 점령하세요.',          desc_ja:'1日に{n}ピクセルを占領。',         desc_zh:'一天内占领{n}像素。' },
  'Mass Colonization':     { ko:'대규모 식민',       ja:'大規模植民',           zh:'大规模殖民',
                             desc_ko:'오늘 {n}픽셀을 점령하세요.',            desc_ja:'今日{n}ピクセルを占領。',          desc_zh:'今天占领{n}像素。' },
  'Terraform Initiative':  { ko:'테라포밍 계획',     ja:'テラフォーミング計画', zh:'改造计划',
                             desc_ko:'이번 주 {n}픽셀을 점령하세요.',         desc_ja:'今週{n}ピクセルを占領。',          desc_zh:'本周占领{n}像素。' },
  'Continental Claim':     { ko:'대륙 점령',         ja:'大陸占領',             zh:'大陆占领',
                             desc_ko:'이번 주 {n}픽셀을 점령하세요.',         desc_ja:'今週{n}ピクセルを占領。',          desc_zh:'本周占领{n}像素。' },
  'Core Strike':           { ko:'코어 타격',         ja:'コアストライク',       zh:'核心打击',
                             desc_ko:'코어 구역 픽셀 {n}개를 점령하세요.',    desc_ja:'コアゾーンピクセルを{n}個占領。',  desc_zh:'占领{n}个核心区像素。' },
  'Core Supremacy':        { ko:'코어 패권',         ja:'コア覇権',             zh:'核心霸权',
                             desc_ko:'코어 구역 픽셀 {n}개를 점령하세요.',    desc_ja:'コアゾーンピクセルを{n}個占領。',  desc_zh:'占领{n}个核心区像素。' },
  'Invasion Fleet':        { ko:'침공 함대',         ja:'侵攻艦隊',             zh:'入侵舰队',
                             desc_ko:'오늘 침공을 {n}개 시작하세요.',         desc_ja:'今日侵攻を{n}個開始。',            desc_zh:'今天启动{n}个入侵。' },
  'Grand Offensive':       { ko:'대공세',            ja:'大攻勢',               zh:'大攻势',
                             desc_ko:'침공을 {n}개 시작하세요.',              desc_ja:'侵攻を{n}個開始。',                desc_zh:'启动{n}个入侵。' },
  "Conqueror's Path":      { ko:'정복자의 길',       ja:'征服者の道',           zh:'征服者之路',
                             desc_ko:'침공을 {n}개 완료하세요.',              desc_ja:'侵攻を{n}個完了。',                desc_zh:'完成{n}个入侵。' },
  'Survey Armada':         { ko:'조사 함대',         ja:'調査艦隊',             zh:'调查舰队',
                             desc_ko:'탐사를 {n}개 시작하세요.',              desc_ja:'探査を{n}個開始。',                desc_zh:'启动{n}个探索。' },
  'Charted Frontier':      { ko:'탐사된 변경',       ja:'踏査済みフロンティア', zh:'已探索边疆',
                             desc_ko:'탐사 {n}개를 완료하세요.',              desc_ja:'探査を{n}個完了。',                desc_zh:'完成{n}次探索。' },
  'Siege Operations':      { ko:'포위 작전',         ja:'包囲作戦',             zh:'围攻行动',
                             desc_ko:'적 픽셀 {n}개를 탈취하세요.',           desc_ja:'敵のピクセルを{n}個奪取。',        desc_zh:'夺取{n}个敌方像素。' },
  'Total War':             { ko:'전면전',            ja:'全面戦争',             zh:'全面战争',
                             desc_ko:'이번 주 픽셀 {n}개를 탈취하세요.',      desc_ja:'今週ピクセルを{n}個奪取。',        desc_zh:'本周夺取{n}个像素。' },
  'Arsenal Deploy':        { ko:'무기 배치',         ja:'兵器配備',             zh:'军火部署',
                             desc_ko:'오늘 아이템 {n}개를 사용하세요.',       desc_ja:'今日アイテムを{n}個使用。',        desc_zh:'今天使用{n}个物品。' },
  'Armory Burn':           { ko:'무기고 소진',       ja:'武器庫消費',           zh:'军火库消耗',
                             desc_ko:'이번 주 아이템 {n}개를 사용하세요.',    desc_ja:'今週アイテムを{n}個使用。',        desc_zh:'本周使用{n}个物品。' }
};
function _questTitle(q){ var m=_questI18n[q.title]; if(!m||LANG==='en') return q.title; return m[LANG]||q.title; }
function _questDesc(q){
  var m=_questI18n[q.title];
  var raw=(m&&LANG!=='en')?(m['desc_'+LANG]||q.description):q.description;
  var n=q.requirement_value||q.target||'';
  return String(raw||'').replace(/\{n\}/g,n);
}

function setLang(lang){
  lang = normalizeLang(lang);
  LANG=lang;
  localStorage.setItem('pw_lang',lang);
  document.documentElement.lang=lang;
  // Update desktop buttons
  document.querySelectorAll('.lang-btn').forEach(function(btn){
    btn.classList.toggle('active',btn.textContent.trim()===lang.toUpperCase());
  });
  // Update mobile dropdown
  var cur=document.getElementById('langCurrent');
  if(cur) cur.textContent=lang.toUpperCase();
  document.querySelectorAll('.lang-menu-item').forEach(function(item){
    item.classList.toggle('active',item.textContent.trim().startsWith(lang.toUpperCase()));
  });
  _syncProfileLangBtns();
  applyI18n();
  // Re-render JS-driven tab content so dynamically-built text updates
  try{ if(typeof loadGuildTab==='function' && _myGuildData) loadGuildTab(); }catch(_e){}
  try{ if(typeof showSeasonGuide==='function' && _seasonData) showSeasonGuide(_seasonData); }catch(_e){}
  try{ if(typeof loadSeasonLeaderboard==='function') loadSeasonLeaderboard(); }catch(_e){}
  try{ if(typeof renderInlineCheckin==='function') renderInlineCheckin(); }catch(_e){}
  try{ if(typeof loadOpsCommandBoard==='function') loadOpsCommandBoard(); }catch(_e){}
  try{ if(typeof renderDailyMissions==='function' && _dailyState && _dailyState.missions.length) renderDailyMissions(); }catch(_e){}
  try{ if(typeof loadQuests==='function' && walletState && walletState.address) loadQuests(walletState.address); }catch(_e){}
  // Re-render locale-sensitive dynamic content
  try{ if(typeof _buildWxEffectMap==='function') _wxEffectMap=_buildWxEffectMap(); }catch(_e){}
  try{ if(typeof updateWeatherBanner==='function') updateWeatherBanner(); }catch(_e){}
  try{ if(typeof _baseUserData!=='undefined' && _baseUserData && typeof renderBaseUser==='function') renderBaseUser(_baseUserData); }catch(_e){}
  try{ if(typeof _sectorsData!=='undefined' && _sectorsData && typeof renderSectorList==='function') renderSectorList(_sectorsData); }catch(_e){}
  try{ if(typeof renderOpsPadList==='function' && window._opsPads) renderOpsPadList(); }catch(_e){}
  try{ if(typeof renderOpsMissionList==='function' && typeof _opsMissions!=='undefined') renderOpsMissionList(); }catch(_e){}
  // Re-render shipyard if open
  try{ if(typeof renderBlueprintsGrid==='function' && document.getElementById('shipyardModal') && document.getElementById('shipyardModal').classList.contains('active')) { renderBlueprintsGrid(); renderShipList(); renderQueue(); } }catch(_e){}
}
// Highlight the active language button in the profile menu
function _syncProfileLangBtns(){
  try{
    document.querySelectorAll('.prof-lang-btn').forEach(function(b){
      var act = b.getAttribute('data-plang')===LANG;
      b.style.background = act ? 'rgba(91,184,232,.2)' : '';
      b.style.borderColor = act ? 'var(--cyan)' : '';
      b.style.color = act ? 'var(--cyan)' : '';
    });
  }catch(_e){}
}

function toggleLangDropdown(e){
  e.stopPropagation();
  document.getElementById('langDropdown').classList.toggle('open');
}
function closeLangDropdown(){
  document.getElementById('langDropdown').classList.remove('open');
}
// 바깥 클릭시 닫기
document.addEventListener('click',function(){closeLangDropdown()});

function applyI18n(){
  LANG = normalizeLang(LANG);
  document.documentElement.lang=LANG;
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key=el.getAttribute('data-i18n');
    var val=t(key);
    if(val.indexOf('<')>=0) el.innerHTML=val; else el.textContent=val;
  });
  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
    el.placeholder=t(el.getAttribute('data-i18n-placeholder'));
  });
  // Mode badge
  var badge=document.getElementById('modeBadge');
  if(badge&&!stampMode) badge.textContent='🔴 '+t('click_mars');
  // Mobile toggles
  var mobL=document.querySelector('.mob-toggle:not(.right)');
  var mobR=document.querySelector('.mob-toggle.right');
  if(mobL) mobL.innerHTML='◀ '+t('stats_label');
  if(mobR) mobR.innerHTML=t('live_label')+' ▶';
}

/* ══════════════════════════════════════════════════
   Tutorial / Onboarding System
   ══════════════════════════════════════════════════ */
var _tutStep = 0;
var _tutActive = false;
var _tutSteps = [
  { key: 'tut_step1', target: function(){ return document.getElementById('loginBtn'); } },
  { key: 'tut_step2', target: function(){
      var mob = document.getElementById('mobNavClaim');
      if(mob && mob.offsetParent !== null) return mob;
      var fab = document.querySelector('.col-fab-wrap .col-fab');
      if(fab && fab.offsetParent !== null) return fab;
      return document.getElementById('landSelectBtn');
    }
  },
  { key: 'tut_step3', target: function(){
      var mobBase = document.querySelector('.mob-nav-item[onclick*="openBaseModal"]');
      if(mobBase && mobBase.offsetParent !== null) return mobBase;
      var fabBase = document.querySelector('.col-fab.base');
      if(fabBase && fabBase.offsetParent !== null) return fabBase;
      return document.querySelector('button[onclick*="openBaseModal"]');
    }
  },
  { key: 'tut_step4', target: function(){
      var mobCantina = document.querySelector('.mob-nav-item[onclick*="openArena"]');
      if(mobCantina && mobCantina.offsetParent !== null) return mobCantina;
      var fabCantina = document.querySelector('.col-fab.arena');
      if(fabCantina && fabCantina.offsetParent !== null) return fabCantina;
      return document.querySelector('button[onclick*="openArena"]');
    }
  },
  { key: 'tut_step5', target: null }
];

function startTutorial(){
  _tutStep = 0;
  _tutActive = true;
  var ov = document.getElementById('tutOverlay');
  ov.style.display = 'block';
  requestAnimationFrame(function(){ ov.classList.add('active'); });
  showTutStep();
}

function showTutStep(){
  var step = _tutSteps[_tutStep];
  var total = _tutSteps.length;
  var isLast = (_tutStep === total - 1);

  document.getElementById('tutStepCounter').textContent = (_tutStep+1) + ' / ' + total;
  document.getElementById('tutText').textContent = t(step.key);
  document.getElementById('tutNextBtn').textContent = isLast ? t('tut_done') : t('tut_next');
  document.getElementById('tutSkipBtn').textContent = t('tut_skip');
  document.getElementById('tutSkipBtn').style.display = isLast ? 'none' : '';

  var targetEl = step.target ? step.target() : null;
  var spotlight = document.getElementById('tutSpotlight');
  var backdrop = document.getElementById('tutBackdrop');
  var tooltip = document.getElementById('tutTooltip');

  tooltip.classList.remove('show');
  tooltip.style.transform = '';

  if(targetEl && targetEl.offsetParent !== null){
    var rect = targetEl.getBoundingClientRect();
    var pad = 6;
    var sx = rect.left - pad, sy = rect.top - pad;
    var sw = rect.width + pad*2, sh = rect.height + pad*2;

    spotlight.style.display = 'block';
    spotlight.style.left = sx + 'px';
    spotlight.style.top = sy + 'px';
    spotlight.style.width = sw + 'px';
    spotlight.style.height = sh + 'px';

    var cx = sx + sw/2, cy = sy + sh/2;
    var rx = sw/2 + 4, ry = sh/2 + 4;
    backdrop.style.clipPath = 'polygon(0% 0%,0% 100%,100% 100%,100% 0%,0% 0%,' +
      (cx - rx) + 'px ' + cy + 'px,' +
      cx + 'px ' + (cy + ry) + 'px,' +
      (cx + rx) + 'px ' + cy + 'px,' +
      cx + 'px ' + (cy - ry) + 'px,' +
      (cx - rx) + 'px ' + cy + 'px,' +
      '0% 0%)';

    var ttW = Math.min(300, window.innerWidth - 24);
    var spaceBelow = window.innerHeight - (sy + sh);

    if(spaceBelow > 160){
      tooltip.style.top = (sy + sh + 12) + 'px';
      tooltip.style.bottom = 'auto';
    } else {
      tooltip.style.top = Math.max(12, sy - 160) + 'px';
      tooltip.style.bottom = 'auto';
    }
    var ttLeft = sx + sw/2 - ttW/2;
    ttLeft = Math.max(12, Math.min(ttLeft, window.innerWidth - ttW - 12));
    tooltip.style.left = ttLeft + 'px';
    tooltip.style.maxWidth = ttW + 'px';
  } else {
    spotlight.style.display = 'none';
    backdrop.style.clipPath = 'none';
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%,-50%)';
  }

  setTimeout(function(){ tooltip.classList.add('show'); }, 80);
}

function nextTutStep(){
  _tutStep++;
  if(_tutStep >= _tutSteps.length){
    endTutorial();
  } else {
    document.getElementById('tutTooltip').classList.remove('show');
    setTimeout(showTutStep, 200);
  }
}

function endTutorial(){
  _tutActive = false;
  localStorage.setItem('pw_tutorial_done','1');
  var ov = document.getElementById('tutOverlay');
  ov.classList.remove('active');
  ov.classList.add('hiding');
  setTimeout(function(){
    ov.classList.remove('hiding');
    ov.style.display = 'none';
    document.getElementById('tutSpotlight').style.display = 'none';
    document.getElementById('tutBackdrop').style.clipPath = 'none';
    var tt = document.getElementById('tutTooltip');
    tt.classList.remove('show');
    tt.style.transform = '';
  }, 400);
}

(function(){
  var _origDismissLoader = dismissLoader;
  dismissLoader = function(){
    _origDismissLoader();
    // Legacy spotlight tutorial disabled.
    // First-run guidance now comes from the server-backed onboarding flow.
  };
})();

/* ══════════════════════════════════════════════════
   Section Help Tooltips
   ══════════════════════════════════════════════════ */
function showHelpTip(key, ev){
  if(ev) ev.stopPropagation();
  document.getElementById('helpPopupTitle').textContent = t('help_' + key);
  document.getElementById('helpPopupBody').textContent = t('help_' + key + '_body');
  document.getElementById('helpPopupBg').classList.add('open');
  document.getElementById('helpPopupBg').style.display = 'flex';
}
function closeHelpTip(){
  document.getElementById('helpPopupBg').classList.remove('open');
  document.getElementById('helpPopupBg').style.display = 'none';
}

/* ══════════════════════════════════════════════════
   Lore / Story Popup
   ══════════════════════════════════════════════════ */
var _loreTimer = null;
function showLorePopup(){
  var bg = document.getElementById('loreBg');
  // Generate stars
  var starsEl = document.getElementById('loreStars');
  starsEl.innerHTML = '';
  for(var i=0;i<120;i++){
    var s = document.createElement('span');
    s.style.left = Math.random()*100+'%';
    s.style.top = Math.random()*100+'%';
    s.style.width = (1+Math.random()*2)+'px';
    s.style.height = s.style.width;
    s.style.animationDelay = (Math.random()*3)+'s';
    s.style.animationDuration = (2+Math.random()*3)+'s';
    starsEl.appendChild(s);
  }
  // Use server crawl data if available, fallback to i18n
  var cd = (_loreCrawlData && _loreCrawlData[LANG]) || (_loreCrawlData && _loreCrawlData['en']) || null;
  document.getElementById('loreIntro').textContent = cd ? cd.era_text : t('lore_era');
  document.getElementById('loreBigTitle').textContent = cd ? cd.title_text : t('lore_title');
  var crawlHtml = '<div class="lore-chapter">' + (cd ? cd.tagline : t('lore_tagline')) + '</div>';
  crawlHtml += (cd && cd.body_html) ? cd.body_html : t('lore_body');
  document.getElementById('loreCrawl').innerHTML = crawlHtml;
  document.getElementById('loreSkipBtn').textContent = (cd ? cd.close_text : t('lore_close')) + ' ▸';
  // Reset animations
  bg.classList.remove('open');
  void bg.offsetWidth;
  bg.classList.add('open');
  bg.style.display = 'block';
  // Remove inline styles that might block animation restarts
  var intro = document.getElementById('loreIntro');
  var title = document.getElementById('loreBigTitle');
  var crawl = document.getElementById('loreCrawl');
  intro.style.animation = 'none'; void intro.offsetWidth; intro.style.animation = '';
  title.style.animation = 'none'; void title.offsetWidth; title.style.animation = '';
  crawl.style.animation = 'none'; void crawl.offsetWidth; crawl.style.animation = '';
  // Show ENTER MARS button after crawl finishes (~50s)
  if(_loreTimer) _clearActiveTimeout(_loreTimer);
  _loreTimer = _setActiveTimeout(function(){
    _loreTimer = null;
    _showLoreFinale();
  }, 55000);
}
function _showLoreFinale(){
  var crawl = document.getElementById('loreCrawl');
  crawl.style.animation = 'none';
  crawl.innerHTML = '';
  // Show centered ENTER MARS
  var finale = document.createElement('div');
  finale.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;animation:loreFadeInFinale 2s ease-out forwards';
  finale.innerHTML = '<div style="font-size:42px;font-weight:900;font-family:var(--fn);color:#FFD700;letter-spacing:8px;margin-bottom:32px;text-shadow:0 0 40px rgba(255,215,0,.4)">' + t('lore_title') + '</div>' +
    '<div style="font-size:12px;color:rgba(255,215,0,.6);letter-spacing:4px;font-family:var(--fn);margin-bottom:28px">' + t('lore_tagline') + '</div>' +
    '<button onclick="closeLorePopup()" style="background:linear-gradient(135deg,rgba(255,180,60,.2),rgba(255,120,60,.1));border:1px solid rgba(255,180,60,.5);color:#FFD700;font-size:13px;font-family:var(--fn);padding:12px 40px;border-radius:8px;cursor:pointer;letter-spacing:3px;transition:all .3s;animation:lorePulseBtn 2s ease-in-out infinite">' + t('lore_close') + '</button>';
  document.getElementById('loreBg').appendChild(finale);
  document.getElementById('loreSkipBtn').style.display = 'none';
}
function closeLorePopup(){
  if(_loreTimer) _clearActiveTimeout(_loreTimer);
  _loreTimer = null;
  var bg = document.getElementById('loreBg');
  bg.classList.remove('open');
  bg.style.display = 'none';
  // Clean up finale if exists
  var finale = bg.querySelector('div[style*="position:fixed"]');
  if(finale) finale.remove();
  document.getElementById('loreSkipBtn').style.display = '';
}

/* ══════════════════════════════════════════════════
   Email Auth System
   ══════════════════════════════════════════════════ */

// ═══════ NOTIFICATION SYSTEM ═══════
var _notifTypes={
  hijack:  {icon:'\u2694\uFE0F', color:'var(--red)'},
  mining:  {icon:'\u26CF\uFE0F', color:'var(--gn)'},
  weather: {icon:'\u{1F321}\uFE0F', color:'var(--gold)'},
  rocket:  {icon:'\u{1F680}', color:'var(--pp)'},
  claim:   {icon:'\u{1F4CD}', color:'var(--mars)'},
  system:  {icon:'\u{1F4E1}', color:'var(--cyan)'}
};
var _notifQueue=[];
var _NOTIF_MAX=3;
function showNotification(type,title,msg){
  var stack=document.getElementById('notifStack');
  if(!stack) return;
  // Play notification sound for important types (hijack already handled separately)
  if(type!=='hijack')try{_sfx.notification()}catch(e){}
  var cfg=_notifTypes[type]||_notifTypes.system;
  // Enforce max stack size — remove oldest
  while(_notifQueue.length>=_NOTIF_MAX){
    var oldest=_notifQueue.shift();
    if(oldest&&oldest.parentNode) _dismissNotif(oldest);
  }
  var card=document.createElement('div');
  card.className='notif-card';
  card.style.setProperty('--notif-color',cfg.color);
  card.innerHTML='<div class="notif-icon">'+cfg.icon+'</div>'
    +'<div class="notif-body"><div class="notif-title">'+title+'</div>'
    +'<div class="notif-msg">'+msg+'</div></div>';
  stack.appendChild(card);
  _notifQueue.push(card);
  // Trigger slide-in
  requestAnimationFrame(function(){requestAnimationFrame(function(){card.classList.add('show')})});
  // Auto-dismiss
  var timer=setTimeout(function(){_dismissNotif(card)},4000);
  card._notifTimer=timer;
  // Click to dismiss
  card.addEventListener('click',function(){clearTimeout(timer);_dismissNotif(card)});
}
function _dismissNotif(card){
  if(card._dismissed) return;
  card._dismissed=true;
  card.classList.remove('show');
  card.classList.add('hide');
  setTimeout(function(){
    if(card.parentNode) card.parentNode.removeChild(card);
    var idx=_notifQueue.indexOf(card);
    if(idx>-1) _notifQueue.splice(idx,1);
  },400);
}

// ═══════ POI POPUP ═══════
var _poiIllustrations = {
  ancient_ruins: {
    bg: 'linear-gradient(180deg, #1a0e00 0%, #3d2200 40%, #1a0e00 100%)',
    scene: '<div style="position:relative;height:240px;overflow:hidden;border-radius:14px 14px 0 0">'
      + '<img src="/assets/textures/poi/ancient_ruins.jpg" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,#1a0e00)"></div>'
      + '</div>'
  },
  ore_deposit: {
    bg: 'linear-gradient(180deg, #0d0500 0%, #2a1500 40%, #0d0500 100%)',
    scene: '<div style="position:relative;height:240px;overflow:hidden;border-radius:14px 14px 0 0">'
      + '<img src="/assets/textures/poi/ore_deposit.jpg" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,#0d0500)"></div>'
      + '</div>'
  },
  crashed_probe: {
    bg: 'linear-gradient(180deg, #000d06 0%, #002211 40%, #000d06 100%)',
    scene: '<div style="position:relative;height:240px;overflow:hidden;border-radius:14px 14px 0 0">'
      + '<img src="/assets/textures/poi/crashed_probe.jpg" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,#000d06)"></div>'
      + '</div>'
  },
  water_ice: {
    bg: 'linear-gradient(180deg, #000610 0%, #001830 40%, #000610 100%)',
    scene: '<div style="position:relative;height:240px;overflow:hidden;border-radius:14px 14px 0 0">'
      + '<img src="/assets/textures/poi/water_ice.jpg" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,#000610)"></div>'
      + '</div>'
  },
  alien_artifact: {
    bg: 'linear-gradient(180deg, #0d0010 0%, #220033 40%, #0d0010 100%)',
    scene: '<div style="position:relative;height:240px;overflow:hidden;border-radius:14px 14px 0 0">'
      + '<img src="/assets/textures/poi/alien_artifact.jpg" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,#0d0010)"></div>'
      + '</div>'
  }
};

function _showPOIPopup(poi) {
  var def = _poiDefs[poi.poiType] || { icon: '✦', color: '#FFFFFF', illust: '📍' };
  var illust = _poiIllustrations[poi.poiType] || _poiIllustrations.ancient_ruins;

  // Remove existing popup if any
  var existing = document.getElementById('poiPopupOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'poiPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);animation:poiFadeIn 0.25s ease';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var popup = document.createElement('div');
  popup.style.cssText = 'width:340px;max-width:92vw;max-height:90vh;overflow-y:auto;border-radius:14px;border:1px solid ' + def.color + '33;box-shadow:0 8px 40px rgba(0,0,0,0.6),0 0 30px ' + def.color + '22;animation:poiSlideUp 0.3s ease';

  popup.innerHTML = '<style>'
    + '@keyframes poiFadeIn{from{opacity:0}to{opacity:1}}'
    + '@keyframes poiSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'
    + '@keyframes poiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes poiBlink{0%,100%{opacity:1}50%{opacity:0.2}}'
    + '@keyframes poiPulseRing{0%{transform:translateX(-50%) scale(1);opacity:0.4}100%{transform:translateX(-50%) scale(1.3);opacity:0}}'
    + '@keyframes poiShine{0%{background-position:200% center}100%{background-position:-200% center}}'
    + '</style>'
    + '<div style="background:' + illust.bg + ';border-radius:14px;overflow:hidden;position:relative">'
    // Close button
    + '<button onclick="document.getElementById(\'poiPopupOverlay\').remove()" style="position:absolute;top:8px;right:10px;z-index:10;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);color:#fff;width:28px;height:28px;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>'
    // Illustration area
    + illust.scene
    // Content area
    + '<div style="padding:16px 20px 20px;text-align:center">'
    // Type badge
    + '<div style="display:inline-block;padding:3px 12px;background:' + def.color + '18;border:1px solid ' + def.color + '44;border-radius:20px;font-size:9px;color:' + def.color + ';letter-spacing:2px;margin-bottom:8px">' + (def.label || poi.poiType.toUpperCase()) + '</div>'
    // Title
    + '<div style="font-size:16px;font-weight:700;color:#FFF;margin-bottom:4px;text-shadow:0 0 12px ' + def.color + '66">' + (poi.label || def.label || 'Unknown POI') + '</div>'
    // Sector
    + '<div style="font-size:10px;color:var(--tx3);margin-bottom:6px">📍 ' + (poi.sectorName || 'Unknown Sector') + '</div>'
    // Territory bonus badge (territory is NOT required — just a bonus indicator)
    + (function(){
        var owned = (window._myOwnedSectors||[]).indexOf(poi.sectorId)>=0;
        if(owned){
          return '<div style="font-size:9px;color:#4CD89A;margin-bottom:10px">✓ Home turf — you own territory here</div>';
        }
        return '';
      })()
    // Reward hint
    + '<div style="display:flex;justify-content:center;gap:12px;margin:10px 0 14px">'
    + '<div style="text-align:center"><div style="font-size:16px">🪙</div><div style="font-size:8px;color:var(--tx3);margin-top:2px">GP</div></div>'
    + '<div style="text-align:center"><div style="font-size:16px">📦</div><div style="font-size:8px;color:var(--tx3);margin-top:2px">ITEMS</div></div>'
    + '<div style="text-align:center"><div style="font-size:16px">⭐</div><div style="font-size:8px;color:var(--tx3);margin-top:2px">RARE PP</div></div>'
    + '</div>'
    // Info + fee line
    + (function(){
        var fee = window._explorationFee||0;
        var feeLine = fee>0
          ? '<div style="font-size:10px;color:var(--gold);margin-bottom:10px">💠 Cost: '+fee+' PP <span style="color:var(--tx3)">(you have '+(window._userPP||0).toFixed(2)+' PP)</span></div>'
          : '';
        return feeLine + '<div style="font-size:9px;color:var(--tx3);margin-bottom:14px;line-height:1.5">Anyone can discover — no territory required. First come, first served!</div>';
      })()
    // Discover button — open to all wallets (no territory gate). Only blocked if PP fee unaffordable.
    + (function(){
        var fee = window._explorationFee||0;
        var hasPP = (window._userPP||0) >= fee;
        if(!hasPP){
          return '<button onclick="showToast(\'Need '+fee+' PP to discover — earn more by harvesting\')" style="width:100%;padding:12px;background:rgba(232,72,85,0.2);color:#E84855;border:1px solid rgba(232,72,85,0.4);border-radius:10px;font-family:var(--fn);font-size:13px;font-weight:700;cursor:not-allowed;letter-spacing:1.5px">💠 NEED '+fee+' PP</button>';
        }
        return '<button onclick="_discoverPOI(' + poi.id + ')" style="width:100%;padding:12px;background:linear-gradient(135deg,' + def.color + ',' + (def.glow || def.color) + ');background-size:200% auto;animation:poiShine 3s linear infinite;color:#000;border:none;border-radius:10px;font-family:var(--fn);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:1.5px;box-shadow:0 4px 20px ' + def.color + '44">🔍 DISCOVER'+(fee>0?' ('+fee+' PP)':'')+'</button>';
      })()
    // Hint button
    + '<button onclick="getPOIHint()" style="width:100%;margin-top:8px;padding:9px;background:transparent;color:var(--gold);border:1px solid rgba(255,209,102,.25);border-radius:10px;font-family:var(--fn);font-size:10px;cursor:pointer;letter-spacing:1px">'
    + '💡 POI HINT (0.2 PP)</button>'
    + '</div></div>';

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

function _discoverPOI(poiId) {
  if (!walletState.address) { showToast('Connect wallet first'); return; }
  var _btn = document.querySelector('#poiPopupOverlay button[onclick*="_discoverPOI"]');
  if(_btn){ _btn.disabled=true; _btn.style.opacity='0.6'; _btn.textContent='🔍 SEARCHING...'; }
  console.log('[POI] Discover request:', { wallet: walletState.address, poiId: poiId });
  fetch('/api/exploration/discover', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: walletState.address, poiId: poiId })
  }).then(function(r) {
    // Read as text first so we can show server body on parse failure
    return r.text().then(function(txt){
      var body = null;
      try { body = JSON.parse(txt); } catch(_pe){}
      return { status: r.status, ok: r.ok, text: txt, body: body };
    });
  }).then(function(resp) {
    console.log('[POI] Discover response:', resp.status, resp.body || resp.text);
    if(_btn){ _btn.disabled=false; _btn.style.opacity=''; _btn.innerHTML='🔍 DISCOVER'; }
    var data = resp.body;
    if (!data) {
      // Non-JSON response — show status + snippet
      var snippet = (resp.text||'').slice(0,120).replace(/\s+/g,' ');
      showToast('HTTP ' + resp.status + ' — ' + (snippet || 'no body'));
      return;
    }
    if (data.error) {
      console.warn('[POI] Discover rejected:', resp.status, data.error);
      showToast(data.error);
      return;
    }
    if (!data.success || !data.reward) {
      console.warn('[POI] Discover unexpected response:', resp.status, data);
      showToast('Discovery failed — bad response');
      return;
    }
    var rw = data.reward;
    var rwText = '';
    if ((rw.type === 'item' || rw.type === 'mineral') && rw.itemName) {
      rwText = (rw.itemIcon||'📦') + ' ' + rw.itemName + (rw.amount > 1 ? ' x' + rw.amount : '');
    } else if (rw.type === 'gp') {
      rwText = '+' + rw.amount + ' GP';
    } else if (rw.type === 'pp') {
      rwText = '+' + rw.amount + ' PP ★RARE★';
    } else {
      rwText = '+' + rw.amount + ' ' + (rw.type||'').toUpperCase();
    }
    var notifMsg = data.label + ' found! ' + rwText + ', +' + data.xp + ' XP';
    if (data.bonusCosmetic) {
      notifMsg += '\n🎁 BONUS: ' + (data.bonusCosmetic.icon||'✨') + ' ' + data.bonusCosmetic.name;
    }
    addFeed('\u{1F50D} ' + (walletState.nickname || walletState.address.slice(0,6)) + ' discovered ' + data.label + ' — ' + rwText);
    // Get POI type before removing
    var _poiType = '';
    for(var _pi=0;_pi<_poiData.length;_pi++){ if(_poiData[_pi].id===poiId){_poiType=_poiData[_pi].poiType;break;} }
    _poiData = _poiData.filter(function(p) { return p.id !== poiId; });
    // Optimistically deduct the fee from the cached balance so repeated discovers show correct state
    window._userPP = Math.max(0, (window._userPP||0) - (window._explorationFee||0));
    compositeClaimsOnTexture();
    try{ refreshEmailBalances(); }catch(_rb){}
    var poiOv = document.getElementById('poiPopupOverlay');
    if (poiOv) poiOv.remove();
    _showRewardSplash(data.label, rwText, data.xp, data.bonusCosmetic, _poiType || data.poiType || '');
  }).catch(function(err) {
    console.error('[POI] Discover network error:', err);
    if(_btn){ _btn.disabled=false; _btn.style.opacity=''; _btn.innerHTML='🔍 DISCOVER'; }
    showToast('Network error: ' + (err && err.message ? err.message : 'unknown'));
  });
}

function _showRewardSplash(label, rwText, xp, bonusCosmetic, poiType) {
  var old = document.getElementById('rewardSplash');
  if (old) old.remove();

  var def = _poiDefs[poiType] || { color: '#FFD700', glow: '#FFE066' };
  var c = def.color;

  var overlay = document.createElement('div');
  overlay.id = 'rewardSplash';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);animation:poiFadeIn 0.25s ease';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var lines = [rwText, '+' + xp + ' XP'];
  if (bonusCosmetic) lines.push('🎁 ' + (bonusCosmetic.icon||'✨') + ' ' + bonusCosmetic.name);

  var popup = document.createElement('div');
  popup.style.cssText = 'width:240px;max-width:70vw;border-radius:12px;border:1px solid ' + c + '44;box-shadow:0 6px 24px rgba(0,0,0,0.5),0 0 16px ' + c + '15;overflow:hidden;animation:poiSlideUp 0.3s ease';

  popup.innerHTML = '<div style="background:rgba(12,10,8,.95);border-radius:12px;padding:12px 16px 12px;text-align:center;font-family:var(--fn)">'
    + '<div style="font-size:11px;color:' + c + ';font-weight:600;margin-bottom:8px">' + label + '</div>'
    + lines.map(function(l){ return '<div style="font-size:11px;color:#FFF;margin-bottom:3px">' + l + '</div>'; }).join('')
    + '<button onclick="document.getElementById(\'rewardSplash\').remove()" style="width:100%;margin-top:8px;padding:6px;background:' + c + '18;border:1px solid ' + c + '33;border-radius:8px;color:' + c + ';font-family:var(--fn);font-size:10px;font-weight:600;cursor:pointer">OK</button>'
    + '</div>';

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 6000);
}

function addFeed(text){
  var f=document.getElementById('liveFeed');
  if(f){
    var empty = document.getElementById('liveFeedEmpty');
    if (empty) empty.remove();
    var d=document.createElement('div');d.className='feed-item new';d.textContent=text;
    f.insertBefore(d,f.firstChild);
    if(f.children.length>15)f.removeChild(f.lastChild);
  }
  // Mirror to profile panel live feed
  var pf=document.getElementById('profileLiveFeed');
  if(pf){
    var pd=document.createElement('div');
    pd.style.cssText='padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.05)';
    pd.textContent='• '+text;
    pf.insertBefore(pd,pf.firstChild);
    if(pf.children.length>20) pf.removeChild(pf.lastChild);
  }
}
function toggleLeft(){
  var panel=document.getElementById('panelL');
  var wasOpen=panel.classList.contains('open');
  panel.classList.toggle('open');
  document.getElementById('panelR').classList.remove('open');
  updateMobToggles();
}
function toggleRight(){
  var panel=document.getElementById('panelR');
  panel.classList.toggle('open');
  document.getElementById('panelL').classList.remove('open');
  updateMobToggles();
}
function closeLeft(){document.getElementById('panelL').classList.remove('open');updateMobToggles()}
function closeRight(){document.getElementById('panelR').classList.remove('open');updateMobToggles()}
function forceCloseMobilePanels(){
  if(window.innerWidth > 1024) return;
  var pL=document.getElementById('panelL');
  var pR=document.getElementById('panelR');
  if(pL) pL.classList.remove('open');
  if(pR) pR.classList.remove('open');
  try{updateMobToggles()}catch(_){}
}
_onPageShow(forceCloseMobilePanels);
window.addEventListener('load', forceCloseMobilePanels);
window.addEventListener('orientationchange', function(){setTimeout(forceCloseMobilePanels, 80)});
// Mobile: tapping outside an open status/live panel auto-closes it
// (no need to hunt for the close button — respect mobile thumb ergonomics)
document.addEventListener('click', function(e){
  if(window.innerWidth > 768) return;
  var pL = document.getElementById('panelL');
  var pR = document.getElementById('panelR');
  if(!pL || !pR) return;
  var lOpen = pL.classList.contains('open');
  var rOpen = pR.classList.contains('open');
  if(!lOpen && !rOpen) return;
  // Ignore taps inside the panel itself, on the toggles, on the close buttons,
  // or on any modal/overlay that sits above the panel
  var t = e.target;
  if(t.closest('#panelL')||t.closest('#panelR')) return;
  if(t.closest('.mob-toggle')||t.closest('#closeBtnLeft')||t.closest('#closeBtnRight')) return;
  if(t.closest('.mbg')||t.closest('.mdl')) return;
  if(lOpen) closeLeft();
  if(rOpen) closeRight();
}, true);

/* Desktop/Tablet panel collapse */
function collapsePanel(side){
  var panel = document.getElementById(side==='left'?'panelL':'panelR');
  var tab = document.getElementById(side==='left'?'panelTabL':'panelTabR');
  var isCollapsed = panel.classList.toggle('collapsed');
  tab.classList.toggle('expanded', isCollapsed);
  tab.innerHTML = side==='left'
    ? (isCollapsed ? '▶' : '◀')
    : (isCollapsed ? '◀' : '▶');
  // Save state
  localStorage.setItem('panel_'+side+'_collapsed', isCollapsed?'1':'0');
  // Update announce bar position
  updateCollapsedUI();
}
function updateCollapsedUI(){
  var isMobile = window.innerWidth <= 768;
  var lCol = document.getElementById('panelL').classList.contains('collapsed');
  var rCol = document.getElementById('panelR').classList.contains('collapsed');
  // Announce bar position (desktop only — mobile uses its own CSS)
  var bar = document.getElementById('announceBanner');
  if(bar && !isMobile){
    bar.style.left = (lCol ? 30 : 280) + 'px';
    bar.style.right = (rCol ? 30 : 280) + 'px';
  } else if(bar && isMobile){
    bar.style.left = '';
    bar.style.right = '';
  }
  // Bottom nav: show whenever right panel is collapsed. It's always centered
  // via CSS transform — do NOT set inline left/right or centering breaks.
  // Mobile has its own nav — hide the desktop dock entirely.
  var fab = document.getElementById('colFabWrap');
  var navShown = false;
  if(fab){
    navShown = !isMobile && rCol;
    fab.classList.toggle('show', navShown);
  }
  // On mobile, clear any desktop-only inline overrides so the mobile @media
  // rules for weather/buffs/rocketBanner take effect cleanly.
  if(isMobile){
    ['weatherBanner','tbActiveBuffs','rocketBanner','modeBadge','campaignQuickBtn','cratesQuickBtn'].forEach(function(id){
      var e = document.getElementById(id);
      if(!e) return;
      e.style.left = '';
      e.style.right = '';
      e.style.top = '';
      e.style.bottom = '';
      e.style.transform = '';
    });
    var zcm = document.querySelector('.zc');
    if(zcm){ zcm.style.right=''; zcm.style.bottom=''; }
    var lfm = document.getElementById('legalFooter');
    if(lfm) lfm.style.display = '';
    return;
  }
  // Zoom controls: right panel collapsed → hug the right edge, lifted above nav
  var zc = document.querySelector('.zc');
  if(zc){
    zc.style.right = rCol ? '12px' : '';
    zc.style.bottom = navShown ? '66px' : '';
  }
  // Campaign quick button tracks the zoom column and sits just above Back.
  var cq = document.getElementById('campaignQuickBtn');
  if(cq){
    cq.style.right = rCol ? '12px' : '';
    cq.style.bottom = navShown ? '318px' : '';
  }
  // SHIP CRATES quick button sits directly ABOVE the CAMPAIGN button (tracks same column).
  var crq = document.getElementById('cratesQuickBtn');
  if(crq){
    crq.style.right = rCol ? '12px' : '';
    crq.style.bottom = navShown ? '364px' : '';
  }
  // Mode badge: left panel collapsed → hug left edge, lifted above nav
  var badge = document.getElementById('modeBadge');
  if(badge){
    badge.style.left = lCol ? '12px' : '';
    badge.style.bottom = navShown ? '66px' : '';
  }
  // Active buffs: anchored to top-left below topbar so they grow downward
  // as more buffs are added, never colliding with the bottom nav.
  var buffs = document.getElementById('tbActiveBuffs');
  if(buffs){
    buffs.style.left = lCol ? '12px' : '';
    buffs.style.top = navShown ? '121px' : '';
    buffs.style.bottom = 'auto';
  }
  // Weather chip: bottom-left corner, stacked above mode badge so they don't
  // overlap. Lowered 50% from previous position.
  var wx = document.getElementById('weatherBanner');
  if(wx){
    if(navShown){
      wx.style.left = (lCol ? '12px' : '260px');
      wx.style.right = 'auto';
      wx.style.transform = 'none';
      wx.style.bottom = '55px';
    } else {
      wx.style.left = '';
      wx.style.right = '';
      wx.style.transform = '';
      wx.style.bottom = '';
    }
  }
  // Rocket / supply drop banner: move to top-right under topbar when collapsed,
  // instead of covering the globe center
  var rk = document.getElementById('rocketBanner');
  if(rk){
    if(navShown){
      rk.style.top = '88px';
      rk.style.left = 'auto';
      rk.style.right = (rCol ? '12px' : '260px');
      rk.style.transform = 'none';
    } else {
      rk.style.top = '';
      rk.style.left = '';
      rk.style.right = '';
      rk.style.transform = '';
    }
  }
  // Hide legal footer when nav is showing (redundant with topbar links)
  var lf = document.getElementById('legalFooter');
  if(lf) lf.style.display = navShown ? 'none' : '';
}
// Restore collapsed state on load
// Left panel contains the claim image editor → must stay open by default on desktop.
// Right panel (LIVE feed) is safe to default-collapse on desktop.
(function(){
  var lSaved = localStorage.getItem('panel_left_collapsed');
  var rSaved = localStorage.getItem('panel_right_collapsed');
  var isDesktop = window.innerWidth > 768;
  if(lSaved==='1') collapsePanel('left');
  var wantR = (rSaved===null) ? isDesktop : (rSaved==='1');
  if(wantR) collapsePanel('right');
})();
// Re-apply zoom/announce positions on window resize (debounced)
window.addEventListener('resize', _debounce(function(){ try{updateCollapsedUI()}catch(_e){} }, 200));
function updateMobToggles(){
  var lOpen=document.getElementById('panelL').classList.contains('open');
  var rOpen=document.getElementById('panelR').classList.contains('open');
  var anyOpen=lOpen||rOpen;
  // 어느 패널이든 열리면 양쪽 토글 모두 숨김
  var toggles=document.querySelectorAll('.mob-toggle');
  toggles.forEach(function(btn){
    btn.classList.toggle('hidden',anyOpen);
  });
  // 사이드바 열리면 모바일 FAB 버튼들 숨김
  var mobFab=document.getElementById('mobFabWrap');
  if(mobFab) mobFab.style.display=anyOpen?'none':'';
  var mobArena=document.querySelector('.mob-arena-btn');
  var mobBase=document.getElementById('mobBaseBtn');
  if(mobArena) mobArena.style.display=anyOpen?'none':'';
  if(mobBase) mobBase.style.display=anyOpen?'none':'';
  // Close buttons (fixed, outside panels)
  var clLeft=document.getElementById('closeBtnLeft');
  var clRight=document.getElementById('closeBtnRight');
  if(clLeft)clLeft.classList.toggle('visible',lOpen);
  if(clRight)clRight.classList.toggle('visible',rOpen);
  // 패널 열리면 고정 배너들 숨기기
  var seasonB=document.getElementById('seasonBanner');
  var announceB=document.getElementById('announceBanner');
  var cmdB=document.getElementById('tbCommander');
  var buffsB=document.getElementById('tbActiveBuffs');
  var cmdAnn=document.getElementById('tbCmdAnnounce');
  var secAnn=document.getElementById('tbSectorAnnounce');
  [seasonB,announceB,cmdB,buffsB,cmdAnn,secAnn].forEach(function(el){
    if(el) el.style.visibility=anyOpen?'hidden':'';
  });
}
var feedExpanded=false;
function toggleFeed(){
  feedExpanded=!feedExpanded;
  document.getElementById('liveFeed').style.maxHeight=feedExpanded?'160px':'52px';
  document.getElementById('feedToggle').textContent=feedExpanded?'▲':'▼';
}

/* ── Globe Hover → Stamp Preview (cursor follow via mousemove + toGlobeCoords) ── */
var _hoverDirty=false;
document.getElementById('globe-wrap').addEventListener('mousemove',function(e){
  var coords=globe.toGlobeCoords(e.offsetX, e.offsetY);
  if(!coords) return;
  var lat=Math.round(Math.max(-70,Math.min(70,coords.lat))/GRID_SIZE)*GRID_SIZE;
  var lng=Math.round(coords.lng/GRID_SIZE)*GRID_SIZE;

  // Land select mode: update drag end point in realtime
  if(landSelectMode&&landDragStart){
    landDragEnd={lat:lat,lng:lng};
    landDragRect=computeLandRect(landDragStart.lat,landDragStart.lng,lat,lng);
    if(!_hoverDirty){
      _hoverDirty=true;
      requestAnimationFrame(function(){
        _hoverDirty=false;
        // WebGL polygon overlay (zero encoding cost)
        _setDragPreviewPolygon(landDragRect);
        updateLandSelectUI();
      });
    }
    return;
  }

  // Stamp mode
  if(!stampMode||!stampImgUrl) return;
  if(!coords){
    if(stampPreviewLat!==null){stampPreviewLat=null;stampPreviewLng=null;compositeClaimsOnTexture(true)}
    return;
  }
  if(lat!==stampPreviewLat||lng!==stampPreviewLng){
    stampPreviewLat=lat; stampPreviewLng=lng;
    if(!_hoverDirty){
      _hoverDirty=true;
      requestAnimationFrame(function(){
        _hoverDirty=false;
        compositeClaimsOnTexture(true);
        updateStampCostDisplay(); // live cost with overlap detection
      });
    }
  }
});
document.getElementById('globe-wrap').addEventListener('mouseleave',function(){
  if(stampMode&&stampPreviewLat!==null){
    stampPreviewLat=null;stampPreviewLng=null;compositeClaimsOnTexture(true);
  }
});

/* ── Owner Search ───────────────────────────────── */
function searchOwner(){
  var q=document.getElementById('ownerSearchInput').value.trim().toLowerCase();
  var box=document.getElementById('searchResults');
  box.innerHTML='';
  if(!q){box.innerHTML='<div style="font-size:9px;color:var(--tx3)">Enter owner name or address</div>';return}
  var matches=claims.filter(function(c){
    var n=(c.nickname||'').toLowerCase();
    return c.owner.toLowerCase().indexOf(q)>=0||c.label.toLowerCase().indexOf(q)>=0||n.indexOf(q)>=0;
  });
  if(!matches.length){box.innerHTML='<div style="font-size:9px;color:var(--red)">No results</div>';return}
  matches.forEach(function(c){
    var d=document.createElement('div');
    d.className='search-result-item';
    var cw=c.w||c.size||10, ch=c.h||c.size||10;
    var ownerSpan=document.createElement('span');
    ownerSpan.style.cssText='color:var(--gold);font-size:9px';
    ownerSpan.textContent=c.nickname||c.label||shortAddr(c.owner);
    var detailSpan=document.createElement('span');
    detailSpan.style.cssText='font-size:8px;color:var(--tx3)';
    detailSpan.textContent='['+c.lat.toFixed(1)+'°,'+c.lng.toFixed(1)+'°] '+cw+'×'+ch+'px $'+c.price;
    d.appendChild(ownerSpan);
    d.appendChild(document.createElement('br'));
    d.appendChild(detailSpan);
    d.onclick=function(){
      globe.pointOfView({lat:c.lat,lng:c.lng,altitude:Math.max(0.08,Math.max(cw,ch)*GRID_SIZE/50)},800);
      isZoomedIn=true; selectedPlot=c;
      // [v7.206] 데스크탑/모바일 모두 모달로 통일 — 이전엔 데스크탑이 사이드바 슬라이드라 UX 분기.
      openMobTerritoryModalDirect(c);
      compositeClaimsOnTexture();
    };
    box.appendChild(d);
  });
}

/* ── My Stats (wallet panel) ────────────────────── */
function refreshMyStats(){
  var myAddr=walletState.address?shortAddr(walletState.address):'YOU';
  var mine=claims.filter(function(c){return c.owner===myAddr||c.label==='YOU'});
  var totalVal=mine.reduce(function(s,c){return s+c.price},0);
}

/* ── Alerts System ─────────────────────────────── */
var alerts=[];
function addAlert(type,msg,coords){
  var alert={type:type,msg:msg,coords:coords,time:new Date()};
  alerts.unshift(alert);
  if(alerts.length>20) alerts.pop();
  renderAlerts();
}
function renderAlerts(){
  var box=document.getElementById('alertsList');
  var pbox=document.getElementById('profileAlertsList');
  var badge=document.getElementById('alertBadge');
  var pbadge=document.getElementById('profileAlertBadge');
  if(!alerts.length){
    if(box) box.innerHTML='<div style="font-size:9px;color:var(--tx3)">No alerts yet</div>';
    if(pbox) pbox.innerHTML='<div style="color:var(--tx3)">No alerts yet</div>';
    if(badge) badge.style.display='none';
    if(pbadge) pbadge.style.display='none';
    return;
  }
  if(box) box.innerHTML='';
  if(pbox) pbox.innerHTML='';
  if(badge){ badge.style.display=''; badge.textContent=alerts.length; }
  if(pbadge){ pbadge.style.display='inline-block'; pbadge.textContent=alerts.length; }
  alerts.forEach(function(a){
    var icon=a.type==='hijack'?'🎯':a.type==='earn'?'💰':'🔔';
    var ago=Math.round((Date.now()-a.time.getTime())/1000);
    var timeStr=ago<60?ago+'s ago':Math.round(ago/60)+'m ago';
    if(box){
      var d=document.createElement('div');
      d.className='alert-item '+(a.type||'');
      d.appendChild(document.createTextNode(icon+' '+a.msg));
      var timeSpan=document.createElement('span');
      timeSpan.className='alert-time';
      timeSpan.textContent=timeStr;
      d.appendChild(timeSpan);
      if(a.coords){
        d.onclick=function(){
          globe.pointOfView({lat:a.coords.lat,lng:a.coords.lng,altitude:0.15},800);
          isZoomedIn=true;
        };
      }
      box.appendChild(d);
    }
    if(pbox){
      var pd=document.createElement('div');
      pd.style.cssText='padding:4px 6px;margin-bottom:3px;background:rgba(255,255,255,.03);border-left:2px solid '+(a.type==='hijack'?'var(--red)':a.type==='earn'?'var(--gold)':'var(--cyan)')+';border-radius:3px;display:flex;justify-content:space-between;gap:6px;cursor:'+(a.coords?'pointer':'default');
      var txt=document.createElement('span');
      txt.style.cssText='flex:1;color:var(--tx2)';
      txt.textContent=icon+' '+a.msg;
      pd.appendChild(txt);
      var ptime=document.createElement('span');
      ptime.style.cssText='color:var(--tx3);font-size:8px';
      ptime.textContent=timeStr;
      pd.appendChild(ptime);
      if(a.coords){
        pd.onclick=function(){
          try{ globe.pointOfView({lat:a.coords.lat,lng:a.coords.lng,altitude:0.15},800); isZoomedIn=true; }catch(e){}
        };
      }
      pbox.appendChild(pd);
    }
  });
}
function refreshProfileAlerts(){ renderAlerts(); }

/* ── Init i18n ──────────────────────────────────── */
setLang(LANG);
// Modals added after this script block (lines 29000+) aren't in the DOM yet.
// Re-apply i18n once the full HTML is parsed so all [data-i18n] elements are translated.
document.addEventListener('DOMContentLoaded', function(){ applyI18n(); });

/* ── end main init ── */

// ═══════ SHARE FUNCTIONALITY ═══════
function _captureGlobeScreenshot(){
  try{
    var globeEl=document.getElementById('globe-wrap');
    var canvas=globeEl?globeEl.querySelector('canvas'):null;
    if(!canvas) return null;
    // Force a render to get current frame
    if(globe&&globe.renderer){
      globe.renderer().render(globe.scene(),globe.camera());
    }
    return canvas;
  }catch(e){console.warn('[SHARE] capture error:',e);return null}
}

function _createShareImage(overlayText,callback){
  var srcCanvas=_captureGlobeScreenshot();
  if(!srcCanvas){showToast('Could not capture globe view');return}
  var shareCanvas=document.createElement('canvas');
  var w=1200,h=630;
  shareCanvas.width=w;shareCanvas.height=h;
  var ctx=shareCanvas.getContext('2d');
  // Draw globe screenshot scaled to fill
  try{ctx.drawImage(srcCanvas,0,0,w,h)}catch(e){
    ctx.fillStyle='#0D0B14';ctx.fillRect(0,0,w,h);
  }
  // Dark overlay for readability
  ctx.fillStyle='rgba(13,11,20,.55)';ctx.fillRect(0,0,w,h);
  // Top branding
  ctx.fillStyle='#FF7840';ctx.font='bold 36px Orbitron,monospace';ctx.textAlign='center';
  ctx.fillText('OCCUPY MARS',w/2,80);
  // Main text
  ctx.fillStyle='#FFFFFF';ctx.font='bold 28px Orbitron,monospace';
  ctx.fillText(overlayText,w/2,h/2);
  // Bottom CTA
  ctx.fillStyle='#C8A882';ctx.font='16px Orbitron,monospace';
  ctx.fillText(window.location.origin,w/2,h-40);
  shareCanvas.toBlob(function(blob){callback(blob)},'image/png');
}

function _doShare(text,blob){
  // Season tracking: share action
  if(walletState.address) fetch('/api/season/share',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:walletState.address})}).catch(function(){});
  var shareUrl=window.location.origin;
  var shareText=text||"I'm colonizing Mars! Check out my territory on OCCUPY MARS \uD83D\uDD34\uD83D\uDE80";
  if(navigator.share&&blob){
    var file=new File([blob],'occupy-mars-territory.png',{type:'image/png'});
    navigator.share({title:'OCCUPY MARS',text:shareText,url:shareUrl,files:[file]}).catch(function(){
      // Fallback: try without files
      navigator.share({title:'OCCUPY MARS',text:shareText,url:shareUrl}).catch(function(){});
    });
  }else if(navigator.share){
    navigator.share({title:'OCCUPY MARS',text:shareText,url:shareUrl}).catch(function(){});
  }else{
    // Fallback: copy link
    var copyText=shareText+' '+shareUrl;
    navigator.clipboard.writeText(copyText).then(function(){
      showToast('Share text copied to clipboard!');
    }).catch(function(){
      // Final fallback
      var ta=document.createElement('textarea');ta.value=copyText;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
      showToast('Share text copied to clipboard!');
    });
  }
}

function shareTerritory(plot){
  if(!plot)return;
  var ownerName=plot.nickname||plot.label||(plot.owner?plot.owner.slice(0,8)+'...':'Unknown');
  var pw=plot.w||plot.size||10,ph=plot.h||plot.size||10;
  var pxCount=plot._pixelCount||(pw*ph);
  var overlayText='I own '+pxCount.toLocaleString()+' pixels on Mars! \uD83D\uDD34 OCCUPY MARS';
  _createShareImage(overlayText,function(blob){
    _doShare("I'm colonizing Mars! Check out my territory on OCCUPY MARS \uD83D\uDD34\uD83D\uDE80",blob);
  });
}

function shareBaseStats(){
  var totalPx=document.getElementById('baseTotalPx')?document.getElementById('baseTotalPx').textContent:'0';
  var rankLvl=document.getElementById('profileLevel')?document.getElementById('profileLevel').textContent:'1';
  var rank='Lv.'+rankLvl;
  var tCount=document.getElementById('myTerritoryCount')?document.getElementById('myTerritoryCount').textContent:'0';
  var overlayText='I own '+tCount+' territories on Mars! \uD83D\uDD34 OCCUPY MARS';
  _createShareImage(overlayText,function(blob){
    var text="I'm colonizing Mars with "+totalPx+" pixels ("+rank+")! Check out my territory on OCCUPY MARS \uD83D\uDD34\uD83D\uDE80";
    _doShare(text,blob);
  });
}

// ═══════ TELEGRAM INTEGRATION ═══════
var _telegramGroupUrl='';
function openTelegramGroup(){
  if(_telegramGroupUrl){
    window.open(_telegramGroupUrl,'_blank','noopener');
  }else{
    showToast('Telegram group not configured yet');
  }
}
// Fetch telegram URL from config
(function(){
  fetch('/api/config').then(function(r){return r.json()}).then(function(cfg){
    if(cfg&&cfg.telegram_group_url){
      _telegramGroupUrl=cfg.telegram_group_url;
    }
    // [v7.439 scope reduction] 서버가 내려준 BASE 탭 레벨 게이팅을 적용(오너 라이브 튜닝).
    //   값 부재/형식 오류 시 base-navigation.js 의 하드코딩 기본값 유지(되돌림 안전).
    try {
      if (cfg && typeof cfg.levelGatingEnabled === 'boolean') {
        window.LEVEL_GATING_ENABLED = cfg.levelGatingEnabled;
      }
      if (cfg && cfg.baseTabMinLevels && typeof cfg.baseTabMinLevels === 'object'
          && typeof BASE_TAB_MIN_LEVEL !== 'undefined') {
        var src = cfg.baseTabMinLevels, clean = {};
        Object.keys(src).forEach(function(k){ var n = parseInt(src[k], 10); if (n > 0) clean[k] = n; });
        if (Object.keys(clean).length) {
          // 전역 BASE_TAB_MIN_LEVEL 객체 내용을 교체(참조 유지).
          Object.keys(BASE_TAB_MIN_LEVEL).forEach(function(k){ delete BASE_TAB_MIN_LEVEL[k]; });
          Object.keys(clean).forEach(function(k){ BASE_TAB_MIN_LEVEL[k] = clean[k]; });
        }
      }
      if (typeof applyBaseTabLocks === 'function') applyBaseTabLocks();
    } catch (_e) { /* 게이팅 적용 실패 — 기본값 유지 */ }
  }).catch(function(){});
})();
