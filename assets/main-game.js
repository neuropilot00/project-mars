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
                     desc_en:'+15% cantina win rate for 3h.',
                     desc_ko:'3시간 동안 칸티나 승률 15% 증가.',
                     desc_ja:'3時間カンティーナ勝率15%アップ。',
                     desc_zh:'3小时内酒吧胜率+15%。' },
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

// ── Guild System ──────────────────────────────────
var _myGuildData=null;

function loadGuildTab(){
  var w=walletState.address;
  if(!w) return;
  // Load my guild + leaderboard in parallel
  Promise.all([
    fetch('/api/guild/my', { headers: getAuthHeaders() }).then(function(r){return r.json()}),
    fetch('/api/guild/leaderboard').then(function(r){return r.json()}),
    fetch('/api/guild/invites', { headers: getAuthHeaders() }).then(function(r){return r.json()})
  ]).then(function(results){
    var myGuild=results[0].guild;
    var lb=results[1].guilds||[];
    var invites=results[2].invites||[];
    _myGuildData=myGuild;
    renderGuildState(myGuild, w);
    renderGuildLeaderboard(lb);
    renderGuildInvites(invites);
    _syncGuildChatPoll();
    try{ _checkBetrayerMark(w); }catch(_){}
    try{ _checkAwayBriefing(); }catch(_){}
  }).catch(function(e){console.warn('[GUILD] load error:',e)});
}

// Start/stop chat poll based on whether user is in a guild
function _syncGuildChatPoll(){
  if(_myGuildData) startGuildChatPoll();
  else stopGuildChatPoll();
}

function renderGuildState(guild, wallet){
  var noGuild=document.getElementById('guildNoGuild');
  var myGuild=document.getElementById('guildMyGuild');
  if(!guild){
    noGuild.style.display='';
    myGuild.style.display='none';
    // Also hide the leave/disband sections (they live outside guildMyGuild)
    var _ls=document.getElementById('guildLeaderSection'); if(_ls) _ls.style.display='none';
    var _lv=document.getElementById('guildLeaveSection'); if(_lv) _lv.style.display='none';
    return;
  }
  noGuild.style.display='none';
  myGuild.style.display='';
  // Emblem: prefer custom pixel-art image over emoji
  var emblemSpan=document.getElementById('guildEmblem');
  var emblemImg=document.getElementById('guildEmblemImg');
  if(guild.emblemImage){
    emblemSpan.style.display='none';
    emblemImg.style.display='';
    emblemImg.src=guild.emblemImage;
  } else {
    emblemSpan.style.display='';
    emblemImg.style.display='none';
    emblemSpan.textContent=guild.emblem||'🔴';
  }
  document.getElementById('guildName').textContent=guild.name;
  document.getElementById('guildTag').textContent='['+guild.tag+']';
  document.getElementById('guildDesc').textContent=guild.description||'';
  document.getElementById('guildMemberCount').textContent=guild.memberCount;
  document.getElementById('guildTotalPx').textContent=(guild.totalPixels||0).toLocaleString();
  document.getElementById('guildTreasury').textContent=Math.floor(guild.gpTreasury||0);

  // 전쟁 승리 버프 표시
  var buffEl = document.getElementById('guildWarBuff');
  if(buffEl){
    var buffExp = guild.war_buff_expires_at ? new Date(guild.war_buff_expires_at) : null;
    var buffActive = buffExp && buffExp > Date.now();
    if(buffActive && guild.war_buff_pct > 0){
      var mins = Math.round((buffExp - Date.now())/60000);
      var buffLabel = mins >= 60 ? (Math.floor(mins/60)+'h '+mins%60+'m') : mins+'m';
      buffEl.style.display='';
      buffEl.innerHTML='<div style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,rgba(255,209,102,.12),rgba(255,209,102,.04));border:1px solid rgba(255,209,102,.3);border-radius:6px;padding:6px 10px">'
        +'<span style="font-size:14px">🏆</span>'
        +'<div style="flex:1"><div style="font-size:10px;font-weight:700;color:var(--gold)">'+(LANG==='ko'?'전쟁 승리 버프 활성!':LANG==='ja'?'戦争勝利バフ発動中!':LANG==='zh'?'战争胜利增益激活!':'War Victory Buff Active!')+'</div>'
        +'<div style="font-size:9px;color:var(--tx3)">GP +'+(LANG==='ko'?'수익':LANG==='ja'?'収益':LANG==='zh'?'收益':'income')+' +'+guild.war_buff_pct+'% · '+(LANG==='ko'?'남은 시간: ':LANG==='ja'?'残り時間: ':LANG==='zh'?'剩余时间: ':'Time left: ')+buffLabel+'</div></div>'
        +'</div>';
    }else{
      buffEl.style.display='none';
      buffEl.innerHTML='';
    }
  }

  // Render members
  var ml=document.getElementById('guildMembersList');
  var myRole='member';
  ml.innerHTML=(guild.members||[]).map(function(m){
    if(m.wallet===wallet) myRole=m.role;
    var roleIcon=m.role==='leader'?'👑':m.role==='officer'?'⚔️':'';
    var roleLabel=m.role==='leader'?t('guild_leader_role'):m.role==='officer'?t('guild_officer_role'):t('guild_member_role');
    var actions='';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">'+
      '<span style="font-size:12px">'+roleIcon+'</span>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:11px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(m.nickname||m.wallet.slice(0,10)+'...')+'</div>'+
        '<div style="font-size:8px;color:var(--tx3)">'+m.pixelCount+' '+t('guild_pixels_short')+' · '+roleLabel+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:4px" data-wallet="'+m.wallet+'" data-role="'+m.role+'"></div>'+
    '</div>';
  }).join('');

  // Show/hide management sections based on role
  document.getElementById('guildInviteSection').style.display=(myRole==='leader'||myRole==='officer')?'':'none';
  var reqSec=document.getElementById('guildRequestsSection');
  if(reqSec) reqSec.style.display=(myRole==='leader'||myRole==='officer')?'':'none';
  if(myRole==='leader'||myRole==='officer') loadGuildJoinRequests(guild.id);
  document.getElementById('guildLeaderSection').style.display=(myRole==='leader')?'':'none';
  document.getElementById('guildLeaveSection').style.display=(myRole!=='leader')?'':'none';
  // Edit button: leader only
  var editBtn=document.getElementById('guildEditBtn');
  if(editBtn) editBtn.style.display=(myRole==='leader')?'':'none';

  // Add action buttons for leader
  if(myRole==='leader'){
    ml.querySelectorAll('[data-wallet]').forEach(function(el){
      var mw=el.dataset.wallet;
      var mr=el.dataset.role;
      if(mw===wallet) return;
      var btns='';
      if(mr==='member') btns+='<button onclick="guildPromote(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(91,184,232,.1);border:1px solid rgba(91,184,232,.2);color:var(--cyan);cursor:pointer">'+t('guild_promote_btn')+'</button>';
      if(mr==='officer') btns+='<button onclick="guildDemote(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,.05);border:1px solid var(--bdr);color:var(--tx3);cursor:pointer">'+t('guild_demote_btn')+'</button>';
      btns+='<button onclick="guildKick(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);color:var(--red);cursor:pointer">'+t('guild_kick_btn')+'</button>';
      btns+='<button onclick="guildTransfer(\''+mw+'\')" style="font-size:7px;padding:2px 6px;border-radius:3px;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.2);color:var(--gold);cursor:pointer">'+t('guild_transfer_btn')+'</button>';
      el.innerHTML=btns;
    });
  }

  // ── Guild upgrade panel (migration 058) ──
  try{ renderGuildUpgrades(guild, myRole); }catch(_e){}
  // ── Guild wars ──
  try{ renderGuildWars(guild.id); }catch(_e){}
  // ── Guild alliance (M-157) ──
  try{ renderGuildAlliance(guild, myRole); }catch(_e){}
}

// ═══════════════════════════════════════
//  GUILD ALLIANCE (M-157, 3-guild cap)
// ═══════════════════════════════════════
function _esc(s){ return (typeof escapeHTML==='function')?escapeHTML(s):String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }

function _phaseDAuthHeaders(){
  var h = {'Content-Type':'application/json'};
  try {
    var tok = localStorage.getItem('pw_token');
    if(tok) h['Authorization'] = 'Bearer '+tok;
  } catch(_){}
  return h;
}

// Lightweight inline modal — uses an existing #gameConfirm-style overlay div if present,
// else falls back to the section itself for picker rendering.
function _phdShowPicker(title, bodyHtml){
  var ov = document.getElementById('_phdPickerOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = '_phdPickerOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px';
    ov.onclick = function(e){ if(e.target===ov) _phdClosePicker(); };
    var inner = document.createElement('div');
    inner.style.cssText = 'width:100%;max-width:420px;background:linear-gradient(160deg,#0f1419,#191f26);border:1px solid rgba(128,203,196,.35);border-radius:14px;padding:14px 16px;box-shadow:0 24px 80px rgba(0,0,0,.7)';
    inner.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div id="_phdPickerTitle" style="flex:1;font-size:12px;color:#80cbc4;font-family:var(--fn);font-weight:800;letter-spacing:1px"></div><button onclick="_phdClosePicker()" style="background:none;border:1px solid rgba(255,255,255,.15);color:var(--tx2);font-size:14px;width:26px;height:26px;border-radius:6px;cursor:pointer">✕</button></div><div id="_phdPickerBody"></div>';
    ov.appendChild(inner);
    document.body.appendChild(ov);
  }
  document.getElementById('_phdPickerTitle').textContent = title || '';
  document.getElementById('_phdPickerBody').innerHTML = bodyHtml || '';
  ov.style.display = 'flex';
}
function _phdClosePicker(){ var ov = document.getElementById('_phdPickerOverlay'); if(ov) ov.style.display='none'; }

function renderGuildAlliance(guild, myRole){
  var box = document.getElementById('guildAllianceSection');
  if(!box || !guild) return;
  var isLeader = myRole === 'leader';
  fetch('/api/guilds/'+guild.id+'/alliance').then(function(r){return r.json()}).then(function(d){
    var a = d && d.alliance;
    if(!a){
      // Not in any alliance
      var html = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:6px">'+
        (LANG==='ko'?'동맹 미가입':LANG==='ja'?'同盟未加入':LANG==='zh'?'未加入联盟':'Not in any alliance')+
      '</div>';
      if(isLeader){
        html += '<div style="display:flex;gap:4px;margin-top:6px">'+
          '<button onclick="openJoinAllianceModal('+guild.id+')" style="flex:1;padding:6px;border-radius:6px;background:rgba(128,203,196,.1);border:1px solid rgba(128,203,196,.3);color:#80cbc4;font-size:9px;cursor:pointer;font-family:var(--fn)">🤝 JOIN ALLIANCE</button>'+
        '</div>';
      }
      box.innerHTML = html;
      return;
    }
    // In an alliance: list member guilds
    fetch('/api/alliances/'+a.id+'/guilds').then(function(r){return r.json()}).then(function(g){
      var guilds = g.guilds || [];
      var html = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+
        '<div style="font-size:11px;font-weight:700;color:#80cbc4">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
        '<div style="font-size:8px;color:var(--tx3);margin-left:auto">'+guilds.length+'/3</div>'+
      '</div>';
      html += guilds.map(function(mg){
        var emblem = mg.emblem_emoji || '🔴';
        var name = '['+mg.guild_tag+'] '+mg.guild_name;
        var leaderName = mg.leader_nickname || (mg.leader_wallet ? mg.leader_wallet.slice(0,8)+'...' : '');
        var marker = mg.guild_id === guild.id ? '<span style="font-size:8px;color:var(--cyan)">• YOU</span>' : '';
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed rgba(128,203,196,.1)">'+
          '<span style="font-size:13px">'+_esc(emblem)+'</span>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:10px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_esc(name)+'</div>'+
            '<div style="font-size:8px;color:var(--tx3)">Lv.'+(mg.level||1)+' · '+(mg.member_count||0)+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+_esc(leaderName)+'</div>'+
          '</div>'+
          marker+
        '</div>';
      }).join('');
      // Leader actions
      if(isLeader){
        html += '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">';
        if(guilds.length < 3){
          html += '<button onclick="openInviteGuildToAllianceModal('+a.id+','+guild.id+')" style="flex:1;min-width:100px;padding:6px;border-radius:6px;background:rgba(128,203,196,.1);border:1px solid rgba(128,203,196,.3);color:#80cbc4;font-size:9px;cursor:pointer;font-family:var(--fn)">+ INVITE GUILD</button>';
        }
        html += '<button onclick="leaveAllianceAsGuild('+a.id+','+guild.id+')" style="flex:1;min-width:80px;padding:6px;border-radius:6px;background:rgba(255,140,66,.08);border:1px solid rgba(255,140,66,.25);color:#ff8c42;font-size:9px;cursor:pointer;font-family:var(--fn)">⚡ LEAVE</button>';
        html += '<button onclick="openBetrayAllianceModal('+guild.id+','+a.id+')" style="flex:1;min-width:80px;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);color:var(--red);font-size:9px;cursor:pointer;font-family:var(--fn)" title="Switch to another alliance immediately">⚔️ BETRAY</button>';
        html += '</div>';
      }
      box.innerHTML = html;
    }).catch(function(){
      box.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load alliance guilds</div>';
    });
  }).catch(function(){
    box.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load alliance</div>';
  });
}

function openJoinAllianceModal(guildId){
  fetch('/api/alliances').then(function(r){return r.json()}).then(function(d){
    var alliances = (d.alliances||[]).filter(function(a){ return !a.disbanded_at; });
    if(!alliances.length){ showAlert('No alliances exist. Create one in the QUESTS tab → Alliance panel.'); return; }
    var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Pick an alliance to join. (Leader cooldown applies after leaving.)</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">';
    alliances.forEach(function(a){
      html += '<button onclick="addGuildToAlliance('+a.id+','+guildId+');_phdClosePicker();" style="padding:8px 10px;background:rgba(128,203,196,.08);border:1px solid rgba(128,203,196,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">'+
        '<div style="font-weight:700;color:#80cbc4">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
        '<div style="font-size:8px;color:var(--tx3)">members: '+(a.member_count||0)+'/'+(a.max_members||0)+'</div>'+
      '</button>';
    });
    html += '</div>';
    _phdShowPicker('JOIN ALLIANCE', html);
  });
}

function addGuildToAlliance(allianceId, guildId){
  fetch('/api/alliances/'+allianceId+'/guilds/add',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error + (d.meta ? ' ('+JSON.stringify(d.meta)+')' : '')); return; }
    showToast('🤝 Joined alliance');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

function openInviteGuildToAllianceModal(allianceId, myGuildId){
  var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Enter target guild ID or name to invite:</div>'+
    '<input type="text" id="_invGuildInput" placeholder="guild name or ID" style="width:100%;padding:8px 10px;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:11px;border-radius:6px;font-family:var(--fn);box-sizing:border-box">'+
    '<button onclick="_doInviteGuildToAlliance('+allianceId+')" style="margin-top:8px;width:100%;padding:8px;background:linear-gradient(135deg,rgba(128,203,196,.3),rgba(128,203,196,.1));border:1px solid rgba(128,203,196,.5);color:#80cbc4;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;font-family:var(--fn)">INVITE</button>';
  _phdShowPicker('INVITE GUILD TO ALLIANCE', html);
}

function _doInviteGuildToAlliance(allianceId){
  var input = document.getElementById('_invGuildInput');
  if(!input || !input.value.trim()) return;
  var v = input.value.trim();
  if(/^\d+$/.test(v)) { addGuildToAlliance(allianceId, parseInt(v)); _phdClosePicker(); return; }
  fetch('/api/guild/search?q='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(d){
    var matches = d.guilds || [];
    if(!matches.length){ showAlert('No guild found with that name'); return; }
    if(matches.length === 1){ addGuildToAlliance(allianceId, matches[0].id); _phdClosePicker(); return; }
    var html = '<div style="font-size:10px;color:var(--tx2);margin-bottom:8px">Multiple guilds match — pick one:</div>';
    matches.forEach(function(g){
      html += '<button onclick="addGuildToAlliance('+allianceId+','+g.id+');_phdClosePicker();" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;background:rgba(128,203,196,.08);border:1px solid rgba(128,203,196,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">['+_esc(g.tag)+'] '+_esc(g.name)+'</button>';
    });
    _phdShowPicker('PICK GUILD', html);
  });
}

async function leaveAllianceAsGuild(allianceId, guildId){
  var ok=await gameConfirm({icon:'🤝',title:LANG==='ko'?'동맹 탈퇴':LANG==='ja'?'同盟脱退':LANG==='zh'?'退出联盟':'Leave Alliance',body:LANG==='ko'?'탈퇴 후 쿨다운 기간 동안 재가입이 제한됩니다.':LANG==='ja'?'脱退後のクールダウン期間中は再加入が制限されます。':LANG==='zh'?'退出后冷却期间内将限制重新加入。':'A cooldown period will restrict rejoining after leaving.',confirmText:LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'});
  if(!ok) return;
  fetch('/api/alliances/'+allianceId+'/guilds/remove',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showToast('Left alliance');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

function openBetrayAllianceModal(guildId, fromAllianceId){
  fetch('/api/alliances').then(function(r){return r.json()}).then(function(d){
    var alliances = (d.alliances||[]).filter(function(a){
      return !a.disbanded_at && parseInt(a.id) !== parseInt(fromAllianceId);
    });
    if(!alliances.length){ showAlert('No other alliance available to defect to.'); return; }
    var html = '<div style="font-size:10px;color:var(--red);margin-bottom:8px">⚠️ BETRAYAL is permanent and recorded in the Chronicle. Pick the new alliance:</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">';
    alliances.forEach(function(a){
      html += '<button onclick="confirmBetrayAlliance('+guildId+','+fromAllianceId+','+a.id+');_phdClosePicker();" style="padding:8px 10px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);border-radius:6px;color:var(--tx);font-size:11px;text-align:left;cursor:pointer;font-family:var(--fn)">'+
        '<div style="font-weight:700;color:var(--red)">['+_esc(a.tag||'')+'] '+_esc(a.name)+'</div>'+
      '</button>';
    });
    html += '</div>';
    _phdShowPicker('⚔️ BETRAY ALLIANCE', html);
  });
}

function confirmBetrayAlliance(guildId, fromAllianceId, toAllianceId){
  fetch('/api/alliances/betray',{
    method:'POST', headers:_phaseDAuthHeaders(),
    body: JSON.stringify({ guildId: guildId, fromAllianceId: fromAllianceId, toAllianceId: toAllianceId })
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error + (d.meta ? ' ('+JSON.stringify(d.meta)+')' : '')); return; }
    showToast('⚔️ BETRAYED — defected to new alliance!');
    loadGuildTab();
  }).catch(function(e){ showAlert(e.message||'Failed'); });
}

// ── Guild upgrade panel ──
var _guildLevelCosts = {2:200, 3:500, 4:1500, 5:5000, 6:15000};
var _guildResearchCatalog = [
  {key:'mining_eff_1',  labelKey:'research_mining_eff_1',  cost:500,  desc:{ko:'채굴 PP +3%',ja:'採掘 PP +3%',zh:'采矿 PP +3%',en:'Mining PP +3%'}, icon:'⛏️'},
  {key:'shield_disc',   labelKey:'research_shield_disc',   cost:500,  desc:{ko:'침공 방어 +15%',ja:'侵攻防御 +15%',zh:'入侵防御 +15%',en:'Invasion Defense +15%'}, icon:'🛡️'},
  {key:'diplomatic',    labelKey:'research_diplomatic',    cost:500,  desc:{ko:'침공 성공률 -10%',ja:'侵攻成功率 -10%',zh:'入侵成功率 -10%',en:'Invasion Success Rate -10%'}, icon:'🕊️'},
  {key:'orbital_scan',  labelKey:'research_orbital_scan',  cost:2000, desc:{ko:'탐험 보상 +15%',ja:'探索報酬 +15%',zh:'探索奖励 +15%',en:'Exploration Reward +15%'}, icon:'🔭'},
  {key:'rapid_deploy',  labelKey:'research_rapid_deploy',  cost:2000, desc:{ko:'미션 시간 -20%',ja:'ミッション時間 -20%',zh:'任务时间 -20%',en:'Mission Time -20%'}, icon:'⚡'},
  {key:'logistics',     labelKey:'research_logistics',     cost:2000, desc:{ko:'비용 -10%',ja:'コスト -10%',zh:'费用 -10%',en:'Cost -10%'}, icon:'📦'},
  {key:'mars_dominion', labelKey:'research_mars_dominion', cost:5000,  desc:{ko:'전체 +5% 중첩',ja:'全体 +5% スタック',zh:'全体 +5% 叠加',en:'All +5% stack'}, icon:'👑'}
];
function renderGuildUpgrades(guild, myRole){
  var lvl = parseInt(guild.level||1);
  var treasury = parseFloat(guild.gpTreasury||guild.gp_treasury||0);
  var maxMembers = guild.maxMembers || 20;
  var memberCount = (guild.members||[]).length;
  var researchSlots = guild.researchSlots || (1 + lvl); // fallback: 2 base + 1 per level
  document.getElementById('guildLevelBadge').textContent = 'LV.'+lvl;
  document.getElementById('guildPpTreasury').textContent = Math.floor(treasury)+' GP';
  var nextCost = _guildLevelCosts[lvl+1];
  var btn = document.getElementById('guildLevelupBtn');
  var costEl = document.getElementById('guildNextLevelCost');
  if(!nextCost){
    costEl.textContent = t('guild_max_level');
    btn.style.display='none';
  } else {
    var nextSlots = Math.min(7, researchSlots + 1);
    var memberDefaults = {2:5,3:5,4:10,5:10,6:10};
    var nextMembers = maxMembers + (memberDefaults[lvl+1]||0);
    costEl.innerHTML = t('guild_next_prefix')+' '+nextCost+' GP (→ Lv.'+(lvl+1)+')'+
      '<br><span style="color:var(--gn);font-size:7px">🔬 '+(LANG==='ko'?'연구 '+nextSlots+'슬롯':LANG==='ja'?'研究 '+nextSlots+'スロット':LANG==='zh'?'研究 '+nextSlots+'槽':'Research '+nextSlots+' slots')+' · 👥 '+(LANG==='ko'?'최대 '+nextMembers+'명':LANG==='ja'?'最大 '+nextMembers+'人':LANG==='zh'?'最多 '+nextMembers+'人':'Max '+nextMembers)+'</span>';
    btn.style.display = '';
    btn.disabled = treasury < nextCost;
    btn.style.opacity = (treasury < nextCost) ? 0.5 : 1;
  }
  // Member count / cap display
  var treasuryEl = document.getElementById('guildPpTreasury');
  if(treasuryEl) treasuryEl.innerHTML = Math.floor(treasury)+' GP<br><span style="font-size:7px;color:var(--tx3)">👥 '+memberCount+'/'+maxMembers+' · 🔬 '+researchSlots+'/7</span>';
  // Contribution slider — populate with my current %
  var me = (guild.members||[]).find(function(m){return m.wallet===walletState.address});
  var myPct = (me && me.contributionPct!=null) ? me.contributionPct : 5;
  var slider = document.getElementById('guildContribSlider');
  if(slider){
    slider.value = myPct;
    document.getElementById('guildContribPctLabel').textContent = myPct+'%';
  }
  // Show my GP balance in donate section
  var donateGPEl = document.getElementById('guildDonateMyGP');
  var myGP = walletState.gameGP || (_dailyState&&_dailyState.gpBalance) || 0;
  if(donateGPEl) donateGPEl.textContent = (LANG==='ko'?'내 GP: ':LANG==='ja'?'自分のGP: ':LANG==='zh'?'我的GP: ':'My GP: ')+Math.floor(myGP);
  // Research grid — slot-locked based on guild level
  var flags = guild.researchFlags || guild.research_flags || {};
  var canSpend = (myRole==='leader'||myRole==='officer');
  var grid = document.getElementById('guildResearchGrid');
  grid.innerHTML = _guildResearchCatalog.map(function(r, idx){
    var unlocked = !!flags[r.key];
    var slotLocked = idx >= researchSlots;
    var affordable = treasury >= r.cost;
    if(slotLocked){
      // Locked slot — greyed out with lock icon
      var neededLvl = Math.max(2, idx); // approximate level needed
      return '<div style="padding:5px 6px;border-radius:6px;background:rgba(255,255,255,.01);border:1px solid rgba(255,255,255,.06);cursor:default;min-height:0;opacity:.4">'+
        '<div style="color:var(--tx3);font-weight:700;font-size:11px">🔒 '+t(r.labelKey)+'</div>'+
        '<div style="color:var(--tx3);font-size:8px;margin-top:1px">'+(typeof r.desc==='object'?r.desc[LANG]||r.desc.en:r.desc)+'</div>'+
        '<div style="color:var(--tx3);font-size:8px;margin-top:2px">Lv.'+(idx)+(LANG==='ko'?' 필요':LANG==='ja'?' 必要':LANG==='zh'?' 需要':' req.')+'</div>'+
      '</div>';
    }
    var bg = unlocked ? 'rgba(76,216,154,.1)' : 'rgba(255,255,255,.03)';
    var bdr = unlocked ? 'rgba(76,216,154,.35)' : 'rgba(184,136,224,.2)';
    var col = unlocked ? 'var(--gn)' : (affordable ? 'var(--pp)' : 'var(--tx3)');
    var status = unlocked ? t('guild_research_unlocked') : (r.cost+' GP');
    var click = (unlocked||!canSpend||!affordable) ? '' : ' onclick="guildUnlockResearch(\''+r.key+'\')"';
    return '<div'+click+' style="padding:5px 6px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';cursor:'+(click?'pointer':'default')+';min-height:0">'+
      '<div style="color:'+col+';font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+t(r.labelKey)+'</div>'+
      '<div style="color:var(--tx3);font-size:8px;margin-top:1px">'+(typeof r.desc==='object'?r.desc[LANG]||r.desc.en:r.desc)+'</div>'+
      '<div style="color:'+(unlocked?'var(--gn)':'var(--tx3)')+';font-size:9px;margin-top:2px;font-weight:600">'+status+'</div>'+
    '</div>';
  }).join('');
}

function guildDonateGP(){
  if(!_myGuildData) return;
  var amt = parseInt(document.getElementById('guildDonateAmt').value);
  if(!amt||amt<=0){ showToast(LANG==='ko'?'금액을 입력하세요':LANG==='ja'?'金額を入力してください':LANG==='zh'?'请输入金额':'Enter an amount'); return; }
  fetch('/api/guild/donate',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address, guildId:_myGuildData.id, amount:amt})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    walletState.gameGP = d.gpBalance!=null ? d.gpBalance : (walletState.gameGP - amt);
    refreshEmailBalances();
    document.getElementById('guildDonateAmt').value = '';
    showToast('💰 '+amt+' GP '+(LANG==='ko'?'기부 완료!':LANG==='ja'?'寄付完了!':LANG==='zh'?'捐赠完成!':'donated!'),'success');
    loadGuildTab();
  }).catch(function(e){ showToast((LANG==='ko'?'기부 실패: ':LANG==='ja'?'寄付失敗: ':LANG==='zh'?'捐赠失败: ':'Donate failed: ')+e.message,'error'); });
}
function guildLevelUp(){
  if(!_myGuildData) return;
  fetch('/api/guild/levelup',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,guildId:_myGuildData.id})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert(t('guild_toast_leveled_up').replace('{n}', d.level),'success');
    loadGuildTab();
  }).catch(function(e){ showAlert(t('guild_toast_levelup_failed')+': '+e.message); });
}
function guildSetContribution(pct){
  fetch('/api/guild/contribution',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,pct:parseInt(pct)})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); }
  }).catch(function(){});
}
function guildUnlockResearch(key){
  if(!_myGuildData) return;
  fetch('/api/guild/research',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,guildId:_myGuildData.id,key:key})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert(t('guild_toast_research_unlocked'),'success');
    loadGuildTab();
  }).catch(function(e){ showAlert(t('guild_toast_research_failed')+': '+e.message); });
}

// ═══════════════════════════════════════
//  GUILD WARS UI
// ═══════════════════════════════════════

function renderGuildWars(guildId){
  var warBox = document.getElementById('guildWarSection');
  if(!warBox) return;
  fetch('/api/guild/war/active?guildId='+guildId).then(function(r){return r.json()}).then(function(d){
    var wars = d.wars||[];
    if(!wars.length){
      warBox.innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+
        (LANG==='ko'?'⚔️ 전쟁 없음':LANG==='ja'?'⚔️ 戦争なし':LANG==='zh'?'⚔️ 暂无战争':'⚔️ No active wars')+
        '<br><button onclick="showDeclareWarModal()" style="margin-top:8px;padding:6px 16px;border-radius:6px;background:linear-gradient(135deg,#E84855,#C62828);border:none;color:#fff;font-size:10px;font-weight:700;cursor:pointer">⚔️ '+(LANG==='ko'?'전쟁 선포':LANG==='ja'?'宣戦布告':LANG==='zh'?'宣战':'Declare War')+'</button>'+
      '</div>';
      return;
    }
    warBox.innerHTML=wars.map(function(w){
      var isAtk = w.attacker_guild_id === guildId;
      var enemy = isAtk ? w.defender_name : w.attacker_name;
      var enemyTag = isAtk ? w.defender_tag : w.attacker_tag;
      var myScore = isAtk ? w.attacker_score : w.defender_score;
      var theirScore = isAtk ? w.defender_score : w.attacker_score;
      var total = Math.max(1, myScore+theirScore);
      var pct = Math.round(myScore/total*100);
      var endMs = new Date(w.war_end).getTime()-Date.now();
      var hrs = Math.max(0,Math.floor(endMs/3600000));
      var mins = Math.max(0,Math.floor((endMs%3600000)/60000));
      return '<div style="background:rgba(232,72,85,.06);border:1px solid rgba(232,72,85,.2);border-radius:8px;padding:10px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<span style="font-size:11px;font-weight:700;color:var(--red)">⚔️ vs ['+enemyTag+'] '+enemy+'</span>'+
          '<span style="font-size:8px;color:var(--tx3)">'+hrs+'h '+mins+'m</span>'+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
          '<span style="font-size:12px;font-weight:700;color:var(--cyan)">'+myScore+'</span>'+
          '<div style="flex:1;height:8px;background:rgba(255,255,255,.05);border-radius:4px;overflow:hidden">'+
            '<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,var(--cyan),var(--pp));border-radius:4px"></div>'+
          '</div>'+
          '<span style="font-size:12px;font-weight:700;color:var(--red)">'+theirScore+'</span>'+
        '</div>'+
        '<div style="font-size:8px;color:var(--tx3);margin:4px 0 5px;line-height:1.5">'+(LANG==='ko'?'⚔️ 적 길드 멤버에게 <b style="color:#ff8a80">함대전</b>을 선포하여 길드전 포인트를 획득하세요! (승리 시 <b style="color:var(--gold)">+10 pts</b>)':LANG==='ja'?'⚔️ 敵ギルドメンバーに<b style="color:#ff8a80">艦隊戦</b>を宣戦してギルド戦ポイントを獲得！(勝利で<b style="color:var(--gold)">+10 pts</b>)':LANG==='zh'?'⚔️ 向敌方公会成员宣战<b style="color:#ff8a80">舰队战</b>获取公会战积分！(胜利<b style="color:var(--gold)">+10 pts</b>)':'⚔️ Declare fleet battle vs enemy guild members to earn points! (Win: <b style="color:var(--gold)">+10 pts</b>)')+'</div>'+
        '<div style="display:flex;gap:4px;margin-top:2px">'+
          '<button onclick="openGuildWarFight('+w.id+','+guildId+')" style="flex:2;padding:6px;border-radius:6px;background:linear-gradient(135deg,rgba(232,72,85,.28),rgba(200,40,40,.12));border:1px solid rgba(232,72,85,.5);color:#ff8a80;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.5px">⚔️ '+(LANG==='ko'?'함대전 선포':LANG==='ja'?'艦隊戦宣戦':LANG==='zh'?'宣战舰队战':'Declare Battle')+'</button>'+
          '<button onclick="viewWarScoreboard('+w.id+')" style="flex:1;padding:6px;border-radius:6px;background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);color:var(--gn);font-size:9px;cursor:pointer">📊 SCORES</button>'+
        '</div>'+
      '</div>';
    }).join('')+
    '<button onclick="showDeclareWarModal()" style="margin-top:6px;width:100%;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);color:var(--red);font-size:9px;cursor:pointer">+ '+(LANG==='ko'?'전쟁 선포':LANG==='ja'?'宣戦布告':LANG==='zh'?'宣战':'Declare War')+'</button>';
  }).catch(function(){ warBox.innerHTML=''; });
}

var _warDeclareTarget = null;
var _warAllGuilds = [];
function showDeclareWarModal(){
  if(!_myGuildData) return;
  _warDeclareTarget = null;
  var treasury = parseFloat(_myGuildData.gpTreasury||_myGuildData.gp_treasury||0);
  var balEl = document.getElementById('warTreasuryBal');
  balEl.textContent = Math.floor(treasury)+' GP';
  // Parse cost from the already-displayed warDeclareCost label (set from guild data or default 200)
  var costLabel = document.getElementById('warDeclareCost');
  var declareCost = costLabel ? (parseInt(costLabel.textContent) || 200) : 200;
  balEl.style.color = treasury < declareCost ? 'var(--red)' : 'var(--gn)';
  document.getElementById('warConfirmSection').style.display = 'none';
  document.getElementById('warTargetList').innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'로딩중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...')+'</div>';
  var inp = document.getElementById('warSearchInput');
  if(inp) inp.value = '';
  document.getElementById('declareWarModal').style.display='flex';
  // Auto-load all guilds
  fetch('/api/guild/leaderboard?limit=50').then(function(r){return r.json()}).then(function(d){
    _warAllGuilds = (d.guilds||[]).filter(function(g){return g.id!==_myGuildData.id});
    _renderWarGuildList(_warAllGuilds);
  }).catch(function(){ document.getElementById('warTargetList').innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'길드 목록을 불러올 수 없습니다':LANG==='ja'?'ギルドリストを読み込めません':LANG==='zh'?'无法加载公会列表':'Failed to load guild list')+'</div>'; });
}
function closeDeclareWarModal(){
  document.getElementById('declareWarModal').style.display='none';
}
function searchWarTargetModal(q){
  var filtered = _warAllGuilds;
  if(q && q.length>=1){
    var lq = q.toLowerCase();
    filtered = _warAllGuilds.filter(function(g){
      return (g.name||'').toLowerCase().indexOf(lq)>=0 || (g.tag||'').toLowerCase().indexOf(lq)>=0;
    });
  }
  _renderWarGuildList(filtered);
}
function _renderWarGuildList(guilds){
  var box=document.getElementById('warTargetList');
  if(!box) return;
  if(!guilds.length){ box.innerHTML='<div style="text-align:center;color:var(--tx3);font-size:10px;padding:20px">'+(LANG==='ko'?'선포 가능한 길드가 없습니다':LANG==='ja'?'宣戦可能なギルドがありません':LANG==='zh'?'没有可宣战的公会':'No guilds available to declare war')+'</div>'; return; }
  box.innerHTML=guilds.map(function(g){
    var emblem = g.emblem||g.emblem_emoji||'🔴';
    var name = g.name||'';
    var tag = g.tag||'';
    var lvl = g.level||1;
    var cnt = g.memberCount||g.member_count||0;
    var px = g.totalPixels||g.total_pixels||0;
    return '<div onclick="selectWarTarget('+g.id+')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid var(--bdr);margin-bottom:6px;cursor:pointer;transition:all .12s" '+
      'onmouseenter="this.style.background=\'rgba(232,72,85,.1)\';this.style.borderColor=\'rgba(232,72,85,.35)\'" '+
      'onmouseleave="this.style.background=\'rgba(255,255,255,.03)\';this.style.borderColor=\'var(--bdr)\'" '+
      'data-gid="'+g.id+'">'+
      '<span style="font-size:22px">'+emblem+'</span>'+
      '<div style="flex:1"><div style="font-size:12px;color:var(--tx);font-weight:700">['+tag+'] '+name+'</div>'+
      '<div style="font-size:9px;color:var(--tx3);margin-top:2px">Lv.'+lvl+' · '+cnt+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+px+' PX</div></div>'+
      '<span style="font-size:16px;color:var(--red)">⚔️</span>'+
    '</div>';
  }).join('');
}
function selectWarTarget(id){
  _warDeclareTarget = id;
  var g = _warAllGuilds.find(function(x){return x.id===id});
  if(!g) return;
  document.getElementById('warTargetEmblem').textContent = g.emblem||g.emblem_emoji||'🔴';
  document.getElementById('warTargetName').textContent = '['+g.tag+'] '+g.name;
  document.getElementById('warTargetInfo').textContent = 'Lv.'+(g.level||1)+' · '+(g.memberCount||g.member_count||0)+(LANG==='ko'?'명':LANG==='ja'?'人':LANG==='zh'?'人':'p')+' · '+(g.totalPixels||g.total_pixels||0)+' PX';
  document.getElementById('warConfirmSection').style.display = 'block';
  // Highlight selected
  var items = document.querySelectorAll('#warTargetList > div[data-gid]');
  items.forEach(function(el){
    if(parseInt(el.getAttribute('data-gid'))===id){
      el.style.background='rgba(232,72,85,.15)';
      el.style.borderColor='rgba(232,72,85,.5)';
    } else {
      el.style.background='rgba(255,255,255,.03)';
      el.style.borderColor='var(--bdr)';
    }
  });
}
function confirmDeclareWar(){
  if(!_warDeclareTarget||!_myGuildData) return;
  var btn = document.getElementById('warConfirmBtn');
  btn.disabled=true; btn.textContent=t('war_declaring_btn');
  var stakeInput = document.getElementById('warStakeInput');
  var durInput = document.getElementById('warDurationInput');
  var stake = stakeInput ? parseInt(stakeInput.value) : 0;
  var dur = durInput ? parseInt(durInput.value) : 0;
  var body = {
    wallet: walletState.address,
    guildId: _myGuildData.id,
    targetGuildId: _warDeclareTarget,
  };
  if (stake && stake > 0) body.stakeGp = stake;
  if (dur && dur > 0) body.durationHours = dur;
  fetch('/api/guild/war/declare',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify(body)
  }).then(function(r){return r.json()}).then(function(d){
    btn.disabled=false; btn.textContent=t('war_declare_btn');
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    closeDeclareWarModal();
    var msg = '⚔️ '+(LANG==='ko'?'전쟁 선포 완료!':LANG==='ja'?'宣戦布告完了!':LANG==='zh'?'宣战完成!':'War declared!');
    if (stake > 0) msg += ' (+'+stake+' GP stake)';
    showToast(msg,'success');
    loadGuildTab();
  }).catch(function(e){ btn.disabled=false; btn.textContent=t('war_declare_btn'); showToast(e.message,'error'); });
}

async function viewWarScoreboard(warId){
  try{
    var resp = await fetch('/api/guild/war/'+warId+'/scores');
    var d = await resp.json();
    if(d.error){ showToast(srvErr(d.error),'error'); return; }
    var gs = d.guildScores||{};
    var atkName = gs.attacker?gs.attacker.name:'Attacker';
    var defName = gs.defender?gs.defender.name:'Defender';
    var atkPts  = gs.attacker?gs.attacker.total:0;
    var defPts  = gs.defender?gs.defender.total:0;
    var topHtml = '';
    if(d.topPlayers&&d.topPlayers.length){
      topHtml += '<div style="font-size:9px;color:var(--tx3);margin:8px 0 4px;letter-spacing:1px">TOP PLAYERS</div>';
      d.topPlayers.slice(0,10).forEach(function(p,i){
        topHtml += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;border-bottom:1px solid rgba(255,255,255,.06)">'
          +'<span style="color:var(--tx)">'+(i+1)+'. '+(p.nickname||shortAddr(p.wallet))+'</span>'
          +'<span style="color:var(--gn)">'+p.total_points+' pts</span>'
          +'</div>';
      });
    }
    if(d.gameBreakdown&&d.gameBreakdown.length){
      topHtml += '<div style="font-size:9px;color:var(--tx3);margin:8px 0 4px;letter-spacing:1px">BY GAME</div>';
      d.gameBreakdown.forEach(function(g){
        topHtml += '<div style="font-size:10px;color:var(--tx);padding:2px 0">'+g.game_type+': <b style="color:var(--gn)">'+g.total_points+' pts</b> ('+g.play_count+' plays)</div>';
      });
    }
    gameConfirm({
      title:'WAR SCOREBOARD', icon:'📊',
      body:'<div style="font-family:var(--fn)">'
        +'<div style="display:flex;justify-content:space-between;background:rgba(255,255,255,.04);border-radius:8px;padding:10px;margin-bottom:8px">'
          +'<div style="text-align:center"><div style="font-size:10px;color:var(--cyan);font-weight:700">'+atkName+'</div><div style="font-size:22px;font-weight:900;color:var(--cyan)">'+atkPts+'</div></div>'
          +'<div style="font-size:11px;color:var(--tx3);align-self:center">VS</div>'
          +'<div style="text-align:center"><div style="font-size:10px;color:var(--red);font-weight:700">'+defName+'</div><div style="font-size:22px;font-weight:900;color:var(--red)">'+defPts+'</div></div>'
        +'</div>'
        +topHtml
      +'</div>',
      confirmText:LANG==='ko'?'닫기':LANG==='ja'?'閉じる':LANG==='zh'?'关闭':'Close'
    });
  }catch(e){ showToast('Failed to load scoreboard','error'); }
}

// ── 길드전 함대전 선포 ──────────────────────────────────────────
async function openGuildWarFight(warId, guildId){
  if(!walletState||!walletState.address){ showToast(LANG==='ko'?'로그인이 필요합니다':LANG==='ja'?'ログインが必要です':LANG==='zh'?'请先登录':'Login required','error'); return; }
  showToast(LANG==='ko'?'적 길드 정보 불러오는 중...':LANG==='ja'?'敵ギルド情報を読込中...':LANG==='zh'?'正在加载敌方公会信息...':'Loading enemy guild data...','info');
  try{
    var [myRes, enemyRes] = await Promise.all([
      fetch('/api/fleets', {headers:getAuthHeaders()}),
      fetch('/api/guild/war/enemies?guildId='+guildId+'&warId='+warId, {headers:getAuthHeaders()})
    ]);
    var myData = await myRes.json();
    var enemyData = await enemyRes.json();
    if(enemyData.error){ showToast(enemyData.error,'error'); return; }

    var myFleets = (myData.fleets||[]).filter(function(f){ return f.ships_alive>0 && !f.is_in_battle; });
    var enemies  = enemyData.enemies||[];
    var enemiesWithFleet = enemies.filter(function(e){ return parseInt(e.ready_fleets||0)>0; });

    // 둘 다 함대 없음
    if(myFleets.length===0 && enemiesWithFleet.length===0){
      showToast(t('fleet_both_no_fleet'),'error'); return;
    }
    // 내 함대 없음
    if(myFleets.length===0){
      showToast(t('fleet_no_combat_fleet'),'error'); return;
    }
    // 적 함대 없음 → 자동 승리
    if(enemiesWithFleet.length===0){
      var ok = await gameConfirm({
        title:t('gw_auto_win_title'),icon:'🏆',
        body:'<div style="text-align:center;padding:8px 0">'
          +'<div style="font-size:13px;color:var(--tx);margin-bottom:8px">'+t('gw_auto_win_body')+'</div>'
          +'<div style="font-size:11px;color:var(--gold)">'+t('gw_auto_win_pts')+'</div>'
          +'<div style="font-size:10px;color:var(--tx3);margin-top:4px">'+t('gw_auto_win_limit')+'</div>'
          +'</div>',
        confirmText:t('gw_auto_win_btn')
      });
      if(!ok) return;
      var r = await fetch('/api/guild/war/auto-win',{
        method:'POST',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({war_id:warId,guild_id:guildId,wallet:walletState.address})
      });
      var rd = await r.json();
      if(!r.ok){
        var errMap={'AUTO_WIN_COOLDOWN':t('gw_auto_win_cooldown'),'ENEMY_HAS_FLEETS':t('gw_enemy_has_fleets')};
        showToast(errMap[rd.error]||('Error: '+rd.error),'error'); return;
      }
      showToast(t('gw_auto_win_toast').replace('{pts}',rd.points),'success');
      try{ renderGuildWars(guildId); }catch(_){}
      return;
    }

    // 양측 함대 있음 → 적 선택 피커
    window._gwfWarId  = warId;
    window._gwfGuildId= guildId;
    window._gwfTarget = null;

    var rowsHtml = enemies.map(function(e){
      var has = parseInt(e.ready_fleets||0)>0;
      var wallet = e.wallet||'';
      var nick   = escapeHtml(e.nickname || (wallet.slice(0,8)+'…'+wallet.slice(-4)));
      var lv     = e.rank_level||1;
      if(has){
        return '<div class="gwf-row" onclick="window._gwfTarget=\''+wallet+'\';'
          +'this.parentNode.querySelectorAll(\'.gwf-row.sel\').forEach(function(el){el.classList.remove(\'sel\')});'
          +'this.classList.add(\'sel\');'
          +'document.getElementById(\'gcConfirmBtn\').disabled=false;" '
          +'style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;'
          +'border-radius:6px;margin-bottom:4px;cursor:pointer;'
          +'background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25)">'
          +'<div><div style="font-size:11px;font-weight:700;color:var(--tx)">'+nick+'</div>'
          +'<div style="font-size:9px;color:var(--tx3)">Lv '+lv+'</div></div>'
          +'<div style="font-size:10px;color:var(--cyan)">⚔ '+e.ready_fleets+(LANG==='ko'?'함대':LANG==='ja'?'艦隊':LANG==='zh'?'舰队':' fleet(s)')+'</div>'
          +'</div>';
      }else{
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;'
          +'border-radius:6px;margin-bottom:4px;opacity:.35;'
          +'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">'
          +'<div><div style="font-size:11px;color:var(--tx2)">'+nick+'</div>'
          +'<div style="font-size:9px;color:var(--tx3)">Lv '+lv+'</div></div>'
          +'<div style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'함대 없음':LANG==='ja'?'艦隊なし':LANG==='zh'?'无舰队':'No fleet')+'</div>'
          +'</div>';
      }
    }).join('');

    var ok2 = await gameConfirm({
      title:LANG==='ko'?'함대전 선포':LANG==='ja'?'艦隊戦宣戦':LANG==='zh'?'宣战舰队战':'Declare Fleet Battle',icon:'⚔️',
      body:'<div style="font-family:var(--fn)">'
        +'<div style="font-size:10px;color:var(--tx3);margin-bottom:8px">'+(LANG==='ko'?'공격할 적 길드원을 선택하세요 — 이기면 <b style="color:var(--gold)">+10 pts</b>':LANG==='ja'?'攻撃する敵ギルドメンバーを選択 — 勝利で <b style="color:var(--gold)">+10 pts</b>':LANG==='zh'?'选择要攻击的敌方公会成员 — 胜利可获得 <b style="color:var(--gold)">+10 pts</b>':'Select enemy member to attack — Win: <b style="color:var(--gold)">+10 pts</b>')+'</div>'
        +rowsHtml
        +'</div>',
      confirmText:LANG==='ko'?'선포하기':LANG==='ja'?'宣戦する':LANG==='zh'?'宣战':'Declare',
      disabled:true
    });
    if(!ok2||!window._gwfTarget) return;
    // 선택한 적 월렛으로 declare 모달 열기
    _openDeclareBattleVsWallet(window._gwfTarget);
  }catch(e){
    console.error('openGuildWarFight:',e);
    showToast(LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error','error');
  }
}

// declare battle 모달을 열고 대상 월렛으로 함대 검색 자동 수행
async function _openDeclareBattleVsWallet(targetWallet){
  // 1. 일반 declare 모달 열기
  await openDeclareBattle();
  // 2. 검색창에 대상 월렛 입력 후 자동 검색
  setTimeout(async function(){
    var inp = document.getElementById('declareTargetSearch');
    if(inp){
      inp.value = targetWallet;
      await doSearchTargets();
    }
  }, 150);
}

// declareWar replaced by confirmDeclareWar (modal-based)

// Quick-launch: open BASE → OPS with a mission type pre-selected.
function openOpsLauncher(type){
  try{
    if(!walletState||!walletState.address){ showToast('Sign in first','error'); return; }
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabOps');
      if(tab){ switchBaseTab('ops', tab); try{clearBaseTabDot('ops')}catch(_e){} loadOpsTab(); }
      setTimeout(function(){ if(typeof setOpsType==='function') setOpsType(type||'invasion'); }, 80);
    }, 120);
  }catch(e){ console.warn('openOpsLauncher failed', e); }
}

// ══════════════════════════════════════════════════════════
//  OPS (Missions) — launch / list / claim / canvas routes
// ══════════════════════════════════════════════════════════
window._opsType = 'invasion';
window._opsMissions = [];
window._opsSlotCap = 0;
var _opsTimer = window._opsTimer = null;

function setOpsType(t){
  window._opsType = t;
  var inv = document.getElementById('opsTypeInvasion');
  var exp = document.getElementById('opsTypeExplore');
  var targetW = document.getElementById('opsTargetWallet');
  var browseBtn = document.getElementById('opsBrowseTargetsBtn');
  if(inv) inv.classList.toggle('active', t==='invasion');
  if(exp) exp.classList.toggle('active', t==='exploration');
  if(targetW) targetW.style.display = (t==='invasion') ? '' : 'none';
  if(browseBtn) browseBtn.style.display = (t==='invasion') ? '' : 'none';
  updateOpsLaunchPreview();
}
function opsPickRandom(){
  // Invasion → random ENEMY territory (someone else's claim).
  // Exploration → random Mars coordinate.
  if(window._opsType === 'invasion'){
    var me = (walletState&&walletState.address||'').toLowerCase();
    var enemies = (window.claims||[]).filter(function(c){
      return c && c.owner && (c.owner||'').toLowerCase() !== me
        && typeof c.lat==='number' && typeof c.lng==='number';
    });
    if(!enemies.length){
      showToast('No enemy territories found on the map yet','error');
      return;
    }
    var pick = enemies[Math.floor(Math.random()*enemies.length)];
    document.getElementById('opsTargetLat').value = pick.lat.toFixed(2);
    document.getElementById('opsTargetLng').value = pick.lng.toFixed(2);
    document.getElementById('opsTargetWallet').value = pick.owner;
    document.getElementById('opsTargetWallet').dataset.display = pick.nickname || pick.owner.slice(0,10);
    updateOpsLaunchPreview();
    var who = pick.nickname || (pick.owner.slice(0,6)+'…'+pick.owner.slice(-4));
    showToast('Target locked: '+who+' @ '+pick.lat.toFixed(1)+'°, '+pick.lng.toFixed(1)+'°','success');
    return;
  }
  // Exploration: free-form Mars coord
  var lat = (Math.random()*140 - 70).toFixed(2);
  var lng = (Math.random()*360 - 180).toFixed(2);
  document.getElementById('opsTargetLat').value = lat;
  document.getElementById('opsTargetLng').value = lng;
  updateOpsLaunchPreview();
}

// Browse all enemy territories in a picker modal — pick by click.
function opsBrowseTargets(){
  var me = (walletState&&walletState.address||'').toLowerCase();
  var enemies = (window.claims||[]).filter(function(c){
    return c && c.owner && (c.owner||'').toLowerCase() !== me
      && typeof c.lat==='number' && typeof c.lng==='number';
  });
  if(!enemies.length){
    showToast('No enemy territories on the map yet','error');
    return;
  }
  // Sort by hijack count (juiciest first), then pixel-area
  enemies.sort(function(a,b){
    var ha=a.hijackCount||0, hb=b.hijackCount||0;
    if(ha!==hb) return hb-ha;
    return ((b.w||0)*(b.h||0)) - ((a.w||0)*(a.h||0));
  });
  var items = enemies.slice(0,80).map(function(c){
    var label = c.nickname || (c.owner.slice(0,6)+'…'+c.owner.slice(-4));
    var sub = c.lat.toFixed(1)+'°, '+c.lng.toFixed(1)+'°';
    if(c.guildTag) sub += ' · ['+c.guildTag+']';
    if(c.hijackCount) sub += ' · '+c.hijackCount+'⚔';
    return { value:String(c.id), label:label+'  —  '+sub };
  });
  gamePicker({ title:'SELECT INVASION TARGET', items:items }).then(function(id){
    if(!id) return;
    var pick = enemies.find(function(c){return String(c.id)===id});
    if(!pick) return;
    document.getElementById('opsTargetLat').value = pick.lat.toFixed(2);
    document.getElementById('opsTargetLng').value = pick.lng.toFixed(2);
    document.getElementById('opsTargetWallet').value = pick.owner;
    updateOpsLaunchPreview();
  });
}
// ── Launch pad picker state ────────────────────────────────────
window._opsPads = [];
window._opsSelectedPad = null;       // { id, lat, lng, ... }
window._opsPreviewData = null;        // last successful preview { tier, durationSec, costPP, multiplier }
window._opsPreviewTarget = null;      // { lat, lng } pair the preview is for

function loadOpsPads(){
  var w=walletState&&walletState.address; if(!w) return Promise.resolve();
  return fetch('/api/missions/pads', { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(d){
      window._opsPads = d.pads || [];
      // Drop selection if the pad is now busy or gone
      if(window._opsSelectedPad){
        var still = window._opsPads.find(function(p){return p.id===window._opsSelectedPad.id});
        if(!still || still.activeMission) window._opsSelectedPad = null;
      }
      // Auto-select the first ready pad if nothing is selected
      if(!window._opsSelectedPad){
        var ready = window._opsPads.find(function(p){return !p.activeMission});
        if(ready) window._opsSelectedPad = ready;
      }
      renderOpsPadList();
      var slotEl=document.getElementById('opsSlotInfo');
      if(slotEl){
        var freeCnt = window._opsPads.filter(function(p){return !p.activeMission}).length;
        slotEl.textContent = freeCnt+'/'+window._opsPads.length;
      }
      updateOpsLaunchPreview();
    })
    .catch(function(){});
}

function renderOpsPadList(){
  var el=document.getElementById('opsPadList'); if(!el) return;
  if(!window._opsPads.length){
    el.innerHTML='<div class="ops-pad-empty">'+t('ops_no_pads')+'</div>';
    return;
  }
  // Sort: READY pads first, LAUNCHED pads last
  var sorted = window._opsPads.slice().sort(function(a,b){
    var aB = a.activeMission ? 1 : 0;
    var bB = b.activeMission ? 1 : 0;
    return aB - bB;
  });
  var html = sorted.map(function(p){
    var busy = p.activeMission;
    var sel = (window._opsSelectedPad && window._opsSelectedPad.id===p.id);
    var classes='ops-pad-card';
    if(busy){
      classes += ' busy '+(busy.type==='invasion'?'invade':'explore');
    } else if(sel){
      classes += ' selected';
    }
    // Reward multiplier preview from pad pixel count (matches backend padRewardMultiplier)
    var px=p.pixelCount||0;
    var mult = px>0 ? Math.max(0.5, Math.min(3.0, Math.sqrt(px/25))) : 0.5;
    var multLabel = '×'+mult.toFixed(1);
    var statusLine;
    if(busy){
      var typIcon = busy.type==='invasion'?'⚔':'🛰';
      statusLine='<div class="pad-status">'+typIcon+' '+t('ops_launched')+'</div>';
    } else {
      statusLine='<div class="pad-status ready">'+t('ops_ready_status')+'</div>';
    }
    var memberLbl = (p.claimCount && p.claimCount>1) ? (' · '+p.claimCount+' '+t('ops_merged')) : '';
    return '<div class="'+classes+'" '+(busy?'':'onclick="selectOpsPad('+p.id+')"')+'">'
      + '<div class="pad-mult">'+multLabel+'</div>'
      + '<div>'
      +   '<div class="pad-id">'+t('ops_territory')+memberLbl+'</div>'
      +   '<div class="pad-coord">'+p.lat.toFixed(1)+'°, '+p.lng.toFixed(1)+'°</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-end">'
      +   statusLine
      +   '<div class="pad-px">'+px+' px</div>'
      + '</div>'
    + '</div>';
  }).join('');
  el.innerHTML = html;
}

function selectOpsPad(padId){
  var pad = window._opsPads.find(function(p){return p.id===padId});
  if(!pad || pad.activeMission) return;
  window._opsSelectedPad = pad;
  renderOpsPadList();
  updateOpsLaunchPreview();
}

var _opsPreviewTimer=null;
var _opsPreviewSeq=0;
function updateOpsLaunchPreview(){
  var latRaw=document.getElementById('opsTargetLat').value;
  var lngRaw=document.getElementById('opsTargetLng').value;
  var lat=parseFloat(latRaw);
  var lng=parseFloat(lngRaw);
  var el=document.getElementById('opsLaunchPreview');
  if(!el) return;
  // Update the live route preview on the map regardless of API state
  window._opsPreviewTarget = (isFinite(lat)&&isFinite(lng)) ? {lat:lat,lng:lng} : null;
  if(typeof requestRedraw==='function') requestRedraw();
  if(!window._opsSelectedPad){
    el.classList.remove('locked');
    el.innerHTML='<span class="ops-prev-hint">⌖ Pick a launch pad above</span>';
    window._opsPreviewData = null;
    return;
  }
  if(isNaN(lat)||isNaN(lng)){
    el.classList.remove('locked');
    el.innerHTML='<span class="ops-prev-hint">⌖ Awaiting target lock…</span>';
    window._opsPreviewData = null;
    return;
  }
  el.classList.add('locked');
  el.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+window._opsSelectedPad.id+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
    +'<span class="ops-prev-eta scanning">…computing trajectory</span>';
  if(_opsPreviewTimer) _clearActiveTimeout(_opsPreviewTimer);
  var seq=++_opsPreviewSeq;
  var padId = window._opsSelectedPad.id;
  // For invasion, pass the target wallet so the preview can include the
  // defender-size factor in the multiplier + duration
  var tgtParam = '';
  if((window._opsType||'invasion')==='invasion'){
    var twEl = document.getElementById('opsTargetWallet');
    var tw = twEl ? (twEl.value||'').trim() : '';
    if(/^0x[a-fA-F0-9]{40}$/.test(tw)) tgtParam = '&targetWallet='+encodeURIComponent(tw.toLowerCase());
  }
  _opsPreviewTimer=_setActiveTimeout(function(){
    _opsPreviewTimer=null;
    var w=walletState&&walletState.address; if(!w) return;
    fetch('/api/missions/preview?type='+encodeURIComponent(window._opsType||'invasion')
      +'&originClaimId='+encodeURIComponent(padId)
      +'&lat='+encodeURIComponent(lat)+'&lng='+encodeURIComponent(lng)+tgtParam, { headers: getAuthHeaders() })
      .then(function(r){return r.json()})
      .then(function(d){
        if(seq!==_opsPreviewSeq) return;
        var el2=document.getElementById('opsLaunchPreview');
        if(!el2) return;
        if(d.error){
          window._opsPreviewData = null;
          el2.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+padId+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
            +'<span class="ops-prev-eta error">⚠ '+escapeHTML(d.error)+'</span>';
          if(typeof requestRedraw==='function') requestRedraw();
          return;
        }
        window._opsPreviewData = d;
        var tierCol={near:'var(--gn)',mid:'var(--gold)',far:'var(--mars)'}[d.tier]||'var(--cyan)';
        var tierLabel=(d.tier||'').toUpperCase();
        var travel=_opsFormatTime(d.durationSec*1000);
        var multStr='×'+(d.multiplier||1).toFixed(2);
        el2.innerHTML='<span class="ops-prev-coord">⌖ PAD #'+padId+' → '+lat.toFixed(1)+'°, '+lng.toFixed(1)+'°</span>'
          +'<span class="ops-prev-eta">'
          +'<span class="ops-prev-tier" style="color:'+tierCol+';border-color:'+tierCol+'">'+tierLabel+'</span>'
          +'<span class="ops-prev-dist">'+d.distanceDeg.toFixed(1)+'°</span>'
          +'<span class="ops-prev-time">⌛ '+travel+'</span>'
          +'<span class="ops-prev-cost">⛽ '+d.costPP.toFixed(2)+' PP</span>'
          +'<span class="ops-prev-cost" style="color:var(--gold);font-weight:800">🏆 '+multStr+'</span>'
          +'</span>';
        if(typeof requestRedraw==='function') requestRedraw();
      })
      .catch(function(){});
  },150);
}
document.addEventListener('input', function(e){
  if(e.target && (e.target.id==='opsTargetLat'||e.target.id==='opsTargetLng'||e.target.id==='opsTargetWallet')) updateOpsLaunchPreview();
});

function loadOpsTab(){
  var w = walletState.address; if(!w) return;
  loadOpsPads();
  fetch('/api/missions/active', { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(d){
      window._opsMissions = d.missions || [];
      renderOpsMissionList();
      // Set OPS dot if any mission is claimable
      var hasClaimableOps = (d.missions||[]).some(function(m){ return m.status==='complete' || m.readyToClaim; });
      if(hasClaimableOps){ setBaseTabDot('ops', true); }
      if(typeof requestRedraw==='function') requestRedraw();
    })
    .catch(function(){ document.getElementById('opsMissionList').innerHTML='Failed to load missions.'; });
  if(!_opsTimer) _opsTimer = _setActiveInterval(renderOpsMissionList, 1000);
}

function renderOpsMissionList(){
  var el = document.getElementById('opsMissionList');
  if(!el) return;
  if(!_opsMissions.length){ el.innerHTML='<div style="color:var(--tx3);padding:12px;text-align:center">'+t('ops_no_missions')+'</div>'; return; }
  var now = Date.now();
  el.innerHTML = _opsMissions.map(function(m){
    var start = new Date(m.startTime).getTime();
    var end = start + m.durationSec*1000;
    var remaining = Math.max(0, end - now);
    var pct = Math.min(100, 100*(1 - remaining/(m.durationSec*1000)));
    var typIcon = m.type==='invasion' ? '⚔' : '🛰';
    var typCol = m.type==='invasion' ? 'var(--mars)' : 'var(--gn)';
    var ready = m.readyToClaim;
    var barCol = ready ? 'var(--gold)' : typCol;
    var label = ready
      ? (m.status==='failed' ? t('ops_failed') : t('ops_ready_claim'))
      : _opsFormatTime(remaining);
    var tgt = m.type==='invasion'
      ? ('VS '+(m.targetWallet||'').slice(0,8)+'...')
      : (t('ops_explore_label')+' '+m.targetLat.toFixed(1)+'°, '+m.targetLng.toFixed(1)+'°');
    var btn;
    if(ready && m.status!=='failed'){
      btn = '<button onclick="playMissionMinigame('+m.id+',\''+m.type+'\')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,#00E676,#00C853);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer;margin-right:4px">🎮 PLAY</button>'+
        '<button onclick="claimOpsMission('+m.id+')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,var(--gold),#FFA040);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+t('ops_claim')+' (1x)</button>';
    } else if(ready){
      btn = '<button onclick="claimOpsMission('+m.id+')" style="padding:6px 10px;border-radius:5px;background:linear-gradient(135deg,var(--gold),#FFA040);border:none;color:#000;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+t('ops_claim')+'</button>';
    } else {
      btn = '<button onclick="cancelOpsMission('+m.id+')" style="padding:4px 8px;border-radius:5px;background:rgba(255,255,255,.05);border:1px solid var(--bdr);color:var(--tx3);font-family:var(--fn);font-size:8px;cursor:pointer">'+t('ops_abort')+'</button>';
    }
    return '<div style="padding:8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid var(--bdr);margin-bottom:6px">'+
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
        '<span style="font-size:14px">'+typIcon+'</span>'+
        '<span style="font-size:10px;color:'+typCol+';font-weight:700">'+m.type.toUpperCase()+'</span>'+
        '<span style="font-size:8px;color:var(--tx3);margin-left:auto">'+label+'</span>'+
      '</div>'+
      '<div style="font-size:9px;color:var(--tx2);font-family:var(--fn);margin-bottom:4px">'+tgt+' · '+m.distanceDeg.toFixed(1)+'°</div>'+
      '<div class="ops-mission-bar" style="margin-bottom:6px"><div class="ops-mission-bar-fill'+(ready?' ready':'')+'" style="width:'+pct+'%;background-color:'+barCol+';transition:width .5s"></div></div>'+
      '<div style="display:flex;justify-content:flex-end">'+btn+'</div>'+
    '</div>';
  }).join('');
}
function _opsFormatTime(ms){
  var s = Math.floor(ms/1000);
  var h = Math.floor(s/3600); s -= h*3600;
  var m = Math.floor(s/60); s -= m*60;
  if(h>0) return h+'h '+m+'m';
  if(m>0) return m+'m '+s+'s';
  return s+'s';
}
function launchOpsMission(){
  var w = walletState.address; if(!w){ showAlert(t('ops_connect_first')); return; }
  if(!window._opsSelectedPad){ showAlert(t('ops_pick_pad')); return; }
  var lat = parseFloat(document.getElementById('opsTargetLat').value);
  var lng = parseFloat(document.getElementById('opsTargetLng').value);
  if(isNaN(lat)||isNaN(lng)){ showAlert(t('ops_enter_coords')); return; }
  var body = { wallet:w, type:_opsType, originClaimId:window._opsSelectedPad.id, targetLat:lat, targetLng:lng };
  if(_opsType==='invasion'){
    var tgt = (document.getElementById('opsTargetWallet').value||'').trim();
    if(!tgt){ showAlert(t('ops_target_required')); return; }
    body.targetWallet = tgt;
  }
  fetch('/api/missions/launch',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){ showAlert(srvErr?srvErr(d.error):d.error); return; }
      showAlert(t('ops_mission_launched'),'success');
      try{ if(typeof refreshBalance==='function') refreshBalance(); }catch(_){} // [v7.275] PP 연료 차감 후 잔액 갱신
      // Reset input fields
      document.getElementById('opsTargetLat').value = '';
      document.getElementById('opsTargetLng').value = '';
      document.getElementById('opsTargetWallet').value = '';
      window._opsPreviewData = null;
      window._opsPreviewTarget = null;
      var prevEl = document.getElementById('opsPreviewInfo');
      if(prevEl) prevEl.innerHTML = '';
      if(_opsType==='invasion'){try{trackQuestAction('launch_invasion',1)}catch(e){}}
      if(_opsType==='exploration'){try{trackQuestAction('launch_exploration',1)}catch(e){}}
      loadOpsTab();
    })
    .catch(function(e){ showAlert(t('ops_launch_failed')+' '+e.message); });
}
function claimOpsMission(id){
  fetch('/api/missions/'+id+'/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    var r = d.mission.reward || {};
    var parts = [];
    if(r.pp>0) parts.push(r.pp.toFixed(3)+' PP');
    if(r.gp>0) parts.push(r.gp+' GP');
    if(r.xp>0) parts.push(r.xp+' XP');
    if(r.item) parts.push(r.item.name);
    if(!parts.length) parts.push('No reward');
    showAlert('✓ '+parts.join(' · '),'success');
    if(d.mission.type==='invasion'){try{trackQuestAction('complete_invasion',1)}catch(e){}}
    if(d.mission.type==='exploration'){try{trackQuestAction('complete_exploration',1)}catch(e){}}
    // [v7.192 fix] 동일한 stale UI 문제 — claimOpsMission 도 모든 관련 UI 즉시 갱신.
    try { loadOpsTab(); } catch(_){}
    try { if(typeof loadUserData==='function') loadUserData(); } catch(_){}
    try { if(typeof updateDailyHint==='function') updateDailyHint(); } catch(_){}
    try { if(typeof loadDailyMissions==='function') loadDailyMissions(); } catch(_){}
    try { if(typeof refreshGP==='function') refreshGP(); } catch(_){}
    try { if(typeof _pollBaseTabDots==='function') _pollBaseTabDots(); } catch(_){}
  }).catch(function(e){ showAlert(t('ops_claim_failed')+' '+e.message); });
}
function cancelOpsMission(id){
  gameConfirm({
    title:t('ops_abort_title'),
    icon:'⚠',
    body:t('ops_abort_body'),
    confirmText:t('ops_abort_btn')
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/missions/'+id+'/cancel',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){ showToast(srvErr(d.error),'error'); return; }
      showToast('Mission aborted · '+(d.refund||0).toFixed(2)+' PP refunded','success');
      loadOpsTab();
    }).catch(function(e){ showToast('Cancel failed: '+e.message,'error'); });
  });
}

// ══ DAILY OPS BOARD ═══════════════════════════════════════════

// ─ OPS COMMAND BOARD ─────────────────────────────────────────
var _opsBoardCountdownTimer = null;

function _startOpsBoardCountdown() {
  if (_opsBoardCountdownTimer) _clearActiveInterval(_opsBoardCountdownTimer);
  function _tick() {
    var now = new Date();
    var msUntilReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) - now;
    var s = Math.floor(msUntilReset / 1000);
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var str = (LANG==='ko'?'리셋까지 ':LANG==='ja'?'リセットまで ':LANG==='zh'?'重置倒计时 ':'Reset in ') + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    var el = document.getElementById('opsBoardCountdown');
    if (el) el.textContent = str;
  }
  _tick();
  _opsBoardCountdownTimer = _setActiveInterval(_tick, 1000);
}

function _fmtDuration(sec) {
  if (sec <= 0) return (LANG==='ko'?'만료':LANG==='ja'?'期限切れ':LANG==='zh'?'已过期':'Expired');
  var h = Math.floor(sec / 3600); var m = Math.floor((sec % 3600) / 60);
  if (h > 0) return h + (LANG==='ko'?'시간 ':LANG==='ja'?'時間 ':LANG==='zh'?'小时 ':' hr ') + m + (LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分':'m');
  return m + (LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分':'m');
}

// GO 버튼 네비게이션 헬퍼 (onclick 직접 호출용 — 이벤트리스너 대신)
// 작전보드 GO 버튼 — 미션 타입별로 실제 동작 화면으로 이동시킨다.
// 탭 이동은 tab 버튼 .click() 으로 처리해 해당 탭의 onclick 로더(loadMarketTab 등)도 함께 발동시킨다.
function _opsClickTab(tabId) {
  var btn = document.getElementById(tabId);
  if (btn) { btn.click(); return true; }
  return false;
}
function _opsOpenBaseTab(tabId, afterOpen) {
  try { openBaseModal(); } catch(_) {}
  setTimeout(function(){
    var clicked = _opsClickTab(tabId);
    if (clicked && typeof afterOpen === 'function') {
      try { afterOpen(); } catch(_) {}
    }
  }, 120);
}
window.opsMissionGo = function(type) {
  try {
    // ─ 영토 채굴/업그레이드/이미지: 실제 동작은 화성 지도(글로브)에서 한다.
    //   작전보드는 BASE 모달 > 내 영토 탭 안에 있으므로, 같은 탭으로 "이동"해도
    //   화면 변화가 없어 GO가 안 먹는 것처럼 보였다. 모달을 닫고 MY LAND 모드로 보낸다. ─
    if (['harvest_pp','harvest_3','harvest_5','territory_art','territory_upgrade','territory_upgrade_3'].includes(type)) {
      try { closeBaseModal(); } catch(_) {}
      setTimeout(function(){
        try { if (typeof toggleMyLand === 'function' && !window._myLandMode) toggleMyLand(); } catch(_) {}
        var msg = (type.indexOf('harvest') === 0)
          ? tl('Tap your territory on Mars to harvest PP','화성 지도에서 내 영토를 눌러 채굴하세요','火星マップで自分の領土をタップして採掘','在火星地图上点击你的领地进行采集')
          : (type === 'territory_art'
              ? tl('Open one of your territories to register its image','내 영토를 열어 이미지를 등록하세요','自分の領土を開いて画像を登録','打开你的领地注册图片')
              : tl('Open one of your territories to upgrade it','내 영토를 열어 업그레이드하세요','自分の領土を開いてアップグレード','打开你的领地进行升级'));
        try { showToast(msg); } catch(_) {}
      }, 280);
    // ─ 영토 클레임: 모달 닫고 지도 클레임 모드 진입 ─
    } else if (type === 'territory_claim') {
      try { closeBaseModal(); } catch(_) {}
      setTimeout(function(){
        try {
          if (typeof activateLandSelect === 'function') activateLandSelect();
          else showToast(tl('Pick an empty spot on Mars to claim','화성의 빈 곳을 골라 클레임하세요','火星の空き地を選んでクレーム','在火星上选择空地进行占领'));
        } catch(_) {}
      }, 280);
    // ─ 전투 계열 → PvP 탭 (.click 으로 로더 포함 발동) ─
    } else if (['battle_participate','battle_win','battle_participate_3','battle_win_3','battle_forfeit'].includes(type)) {
      _opsOpenBaseTab('baseTabPvp');
    } else if (['ai_battle','ai_battle_3'].includes(type)) {
      _opsOpenBaseTab('baseTabPvp');
      try { setTimeout(function(){ if (typeof openAiFight === 'function') openAiFight(); }, 450); } catch(_) {}
    // ─ 함선/함대 계열 → 조선소 / 함대지휘 ─
    } else if (['upgrade_ship','upgrade_ship_3','upgrade_ship_5','build_ship','repair_ship','repair_ship_3'].includes(type)) {
      try { openShipyard(); } catch(_) { _opsClickTab('baseTabPvp'); }
    } else if (type === 'fleet_formation') {
      try { openFleetCmd(); } catch(_) {}
    // ─ 경제 계열 → 마켓 탭 ─
    } else if (['craft_resource','craft_resource_3','craft_resource_5'].includes(type)) {
      _opsOpenBaseTab('baseTabItems', function(){
        try { if (typeof loadBaseInventory === 'function') loadBaseInventory(); } catch(_) {}
        try { showToast(tl('Check your resource inventory here','보유 재료는 여기서 확인하세요','所持素材はここで確認できます','在这里查看你的资源库存'), 'info'); } catch(_) {}
      });
    } else if (['market_list','market_buy','market_activity'].includes(type)) {
      _opsOpenBaseTab('baseTabMarket', function(){ try { if (typeof loadMarketTab === 'function') loadMarketTab(); } catch(_) {} });
    // ─ 캠페인 계열 → CAMPAIGN/QUESTS 탭. (이전엔 존재하지 않는 'quests' 카테고리를
    //   switchBaseCat 에 넘겨 모든 탭이 숨겨지며 이동이 깨졌다. 실제 탭 data-cat 은 'mission'.) ─
    } else if (['campaign_progress','campaign_complete'].includes(type)) {
      _opsOpenBaseTab('baseTabQuests');
    // ─ 자동 완료 (로그인 확인 등) ─
    } else if (type === 'daily_login') {
      showToast(LANG==='ko'?'오늘 로그인 확인! 자동 완료됩니다.':LANG==='ja'?'今日のログイン確認！自動完了します。':LANG==='zh'?'今日登录确认！自动完成。':'Daily login confirmed! Auto-completing.');
      // daily login OPS 진행도는 /api/daily/login 성공 시 서버가 처리한다.
      try { loadOpsCommandBoard(); } catch(_) {}
    } else {
      // 알 수 없는 타입 — 최소한 사용자에게 피드백
      try { showToast(tl('No destination for this mission','이 작전은 이동할 화면이 없습니다','この作戦に移動先はありません','该任务无可跳转页面')); } catch(_) {}
    }
  } catch(_) {}
};

async function loadOpsCommandBoard() {
  var wallet = walletState.address;
  _startOpsBoardCountdown();
  var el = document.getElementById('opsBoardContent');
  var weeklyEl = document.getElementById('opsBoardWeekly');
  if (!wallet || !el) return;

  el.innerHTML = '<span style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読み込み中…':LANG==='zh'?'加载中…':'Loading…')+'</span>';

  try {
    var res = await fetch('/api/daily-ops/' + encodeURIComponent(wallet));
    var data = await res.json();
    if (!data.success) throw new Error('failed');

    var missions = data.missions || [];
    var we = data.weekly_event;
    var weeklyDone = data.weekly_done || 0;
    var weeklyTotal = data.weekly_total || 7;
    var weeklyReward = data.weekly_reward_label || '';
    var urgentEvents = data.urgent_events || [];
    var expectedPP = data.expected_pp || 0;

    // (이동 액션은 opsMissionGo() 가 onclick 으로 직접 처리한다. 과거의 missionNav 매핑은
    //  미사용 죽은 코드라 제거됨 — v7.96.)

    var html = '';

    // 🔴 긴급 이벤트 먼저
    urgentEvents.forEach(function(ev, idx) {
      html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,82,82,.12)">'
        + '<span style="font-size:11px;line-height:1.4;flex-shrink:0">🔴</span>'
        + '<div style="flex:1">'
        + '<div style="font-size:10px;color:#ff5252;font-weight:700">' + (LANG==='ko' ? ev.label_ko : ev.label_en) + '</div>'
        + '<div style="font-size:9px;color:var(--tx3)">(' + _fmtDuration(ev.time_remaining_sec) + ' '+(LANG==='ko'?'남음':LANG==='ja'?'残り':LANG==='zh'?'剩余':'left')+')</div>'
        + '</div>'
        + '<button type="button" id="opsUrgentBtn' + idx + '" style="flex-shrink:0;font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(255,82,82,.15);border:1px solid rgba(255,82,82,.4);color:#ff5252;cursor:pointer;font-family:var(--fn);font-weight:700">'+(LANG==='ko'?'지금 참여 →':LANG==='ja'?'今すぐ参加 →':LANG==='zh'?'立即参与 →':'Join Now →')+'</button>'
        + '</div>';
    });

    // ⚪/🟢 미션 행
    var localOpsState = null;
    try { localOpsState = _loadDailyOpsState(); } catch(_) {}
    missions.forEach(function(m, idx) {
      var label = LANG==='ko' ? m.label_ko : m.label_en;
      var dest = LANG==='ko' ? (m.dest_ko || '') : (m.dest_en || '');
      var target = Math.max(1, parseInt(m.target, 10) || 1);
      var current = parseInt(m.current, 10) || 0;
      var localTask = localOpsState && localOpsState.tasks ? localOpsState.tasks[m.type] : null;
      if (localTask) current = Math.min(target, Math.max(current, parseInt(localTask.current, 10) || 0));
      var done = !!(m.completed || m.reward_claimed || current >= target || Number(m.progress_pct) >= 100);
      var dot = done ? '🟢' : '⚪';
      var labelColor = m.reward_claimed ? 'var(--gn)' : (done ? 'var(--gold)' : 'var(--tx)');

      var rewardStr;
      if (m.type === 'harvest_pp' && expectedPP > 0) {
        rewardStr = '→ +' + expectedPP + ' PP '+(LANG==='ko'?'예상':LANG==='ja'?'予想':LANG==='zh'?'预计':'est.');
      } else if (dest) {
        rewardStr = '→ ' + dest;
      } else {
        rewardStr = '+' + m.reward_gp + ' GP';
      }

      var rightBtn;
      if (m.reward_claimed) {
        rightBtn = '<span style="font-size:9px;color:var(--gn)">✓ '+(LANG==='ko'?'수령완료':LANG==='ja'?'受取済':LANG==='zh'?'已领取':'Claimed')+'</span>';
      } else if (done) {
        rightBtn = '<button type="button" onclick="claimDailyOps(' + m.id + ')" style="font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(76,216,154,.15);border:1px solid rgba(76,216,154,.45);color:var(--gn);cursor:pointer;font-family:var(--fn)">+' + m.reward_gp + ' GP '+(LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim')+'</button>';
      } else {
        rightBtn = '<button type="button" onclick="opsMissionGo(\'' + m.type + '\')" style="font-size:9px;padding:3px 9px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--tx2);cursor:pointer;font-family:var(--fn)">GO →</button>';
      }

      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<span style="font-size:11px;flex-shrink:0">' + dot + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:10px;color:' + labelColor + ';font-weight:600">' + label + '</div>'
        + '<div style="font-size:9px;color:var(--tx3)">' + rewardStr + '</div>'
        + '</div>'
        + '<div style="flex-shrink:0">' + rightBtn + '</div>'
        + '</div>';
    });

    if (!html) {
      html = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+(LANG==='ko'?'미션 없음':LANG==='ja'?'ミッションなし':LANG==='zh'?'没有任务':'No missions')+'</div>';
    }

    el.innerHTML = html;

    // 긴급 이벤트 버튼만 이벤트 등록 (GO/CLAIM은 onclick 직접 사용)
    urgentEvents.forEach(function(ev, idx) {
      var btn = document.getElementById('opsUrgentBtn' + idx);
      if (btn) btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        try { eval(ev.action); } catch(_) {}
      });
    });

    // 주간 이벤트 + 주간 진척도
    var weeklyHtml = '';
    if (we) {
      weeklyHtml += '<div style="font-size:9px;color:var(--gold);margin-bottom:6px">'
        + (we.icon || '') + ' ' + (LANG==='ko'?'오늘의 이벤트':LANG==='ja'?'今日のイベント':LANG==='zh'?'今日活动':'Today\'s Event') + ': ' + (LANG==='ko' ? we.label_ko : we.label_en) + '</div>';
    }
    // 주간 진척도 — 요일 라벨 포함 7칸 표시
    var dayLabels = LANG==='ja'?['日','月','火','水','木','金','土']:LANG==='zh'?['日','一','二','三','四','五','六']:LANG==='ko'?['일','월','화','수','목','금','토']:['S','M','T','W','T','F','S'];
    var todayDow = new Date().getUTCDay();
    // [v7.211] 주간 진척도 시인성 — 빈 칸 rgba(.15)는 모바일 다크 배경에서 검정으로 보임.
    //   bg 살짝 밝게 + border 더 진하게 + height 8→10px + label 추가.
    var blocks = '<div style="display:flex;gap:3px;width:100%">';
    for (var i = 0; i < weeklyTotal; i++) {
      var dayIdx = (1 + i) % 7;
      var isToday = dayIdx === todayDow;
      var isDone = i < weeklyDone;
      var bg = isDone ? 'var(--cyan)' : 'rgba(255,255,255,.06)';
      var border = isToday ? '1px solid rgba(255,215,0,.85)' : '1px solid rgba(255,255,255,.25)';
      var labelColor = isDone ? '#fff' : (isToday ? '#ffd700' : 'rgba(255,255,255,.45)');
      blocks += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<div style="font-size:8px;color:'+labelColor+';font-family:var(--fn);font-weight:'+(isToday?'800':'600')+'">'+dayLabels[dayIdx]+'</div>'
        + '<div style="width:100%;height:10px;border-radius:3px;background:' + bg + ';border:' + border + (isDone?';box-shadow:0 0 6px rgba(91,184,232,.5)':'')+'"></div>'
        + '</div>';
    }
    blocks += '</div>';
    weeklyHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      + '<span style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'이번 주 완료일':LANG==='ja'?'今週の完了日':LANG==='zh'?'本周完成天数':'Days completed')+'</span>'
      + '<span style="font-size:9px;color:var(--cyan);font-weight:700">' + weeklyDone + ' / ' + weeklyTotal + (LANG==='ko'?'일':LANG==='ja'?'日':LANG==='zh'?'天':' day(s)')+'</span>'
      + '</div>'
      + blocks
      + (weeklyReward ? '<div style="font-size:9px;color:var(--gold);margin-top:5px">🎁 '+(LANG==='ko'?'이번 주 보상: ':LANG==='ja'?'今週の報酬: ':LANG==='zh'?'本周奖励: ':'Weekly reward: ') + weeklyReward + '</div>' : '');

    if (weeklyEl) weeklyEl.innerHTML = weeklyHtml;

    // Daily OPS board is single-source in BASE > 내 영토.
    // Put claimable status on the territory tab, not the separate OPS mission console.
    var hasClaimable = missions.some(function(m){
      var target = Math.max(1, parseInt(m.target, 10) || 1);
      var current = parseInt(m.current, 10) || 0;
      return (m.completed || current >= target || Number(m.progress_pct) >= 100) && !m.reward_claimed;
    });
    if (hasClaimable) { try { setBaseTabDot('territory', true); } catch(_){} }

  } catch(err) {
    if (el) el.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'OPS Board 로딩 실패':LANG==='ja'?'OPS Boardの読み込み失敗':LANG==='zh'?'OPS Board加载失败':'OPS Board failed to load')+'</div>';
  }
}

async function loadDailyOpsBoard() {
  return loadOpsCommandBoard();
}

async function claimDailyOps(missionId) {
  var wallet = walletState.address;
  if (!wallet) return;
  try {
    var body = { wallet: wallet };
    if (missionId) body.mission_id = missionId;
    var res = await fetch('/api/daily-ops/claim', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!data.success) { showToast(srvErr(data.error || 'Claim failed'), 'error'); return; }
    showToast('+' + data.total_gp + ' GP', 'success');
    // [v7.192 fix] dailyOps claim 직후 모든 관련 UI 즉시 갱신 — 이전엔 이 함수가
    //   loadDailyOpsBoard + loadUserData 만 호출 → 메인 화면 "오늘의 추천" 카드,
    //   BASE 임무 dot, CAMPAIGN/QUESTS 탭의 미션 리스트가 페이지 리로드 전까지 stale.
    try { loadDailyOpsBoard(); } catch(_){}
    try { if (typeof loadUserData === 'function') loadUserData(); } catch(_){}
    try { if (typeof updateDailyHint === 'function') updateDailyHint(); } catch(_){}        // 오늘의 추천 카드 갱신
    try { if (typeof loadDailyMissions === 'function') loadDailyMissions(); } catch(_){}    // QUESTS 탭 미션 리스트
    try { if (typeof refreshGP === 'function') refreshGP(); } catch(_){}                    // GP HUD
    try { if (typeof _pollBaseTabDots === 'function') _pollBaseTabDots(); } catch(_){}      // BASE 카테고리 dot 재평가
  } catch(e) { showToast(srvErr('NETWORK_ERROR'), 'error'); }
}

async function claimAllDailyOps() {
  await claimDailyOps(null);
}

function renderGuildInvites(invites){
  var sec=document.getElementById('guildInvitesSection');
  var list=document.getElementById('guildInvitesList');
  if(!invites||!invites.length){sec.style.display='none';return;}
  sec.style.display='';
  list.innerHTML=invites.map(function(inv){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,209,102,.04);border:1px solid rgba(255,209,102,.15);border-radius:6px;margin-bottom:4px">'+
      '<span style="font-size:16px">'+(inv.emblem_emoji||'🔴')+'</span>'+
      '<div style="flex:1"><div style="font-size:11px;color:var(--tx);font-weight:700">'+(inv.guild_name||'Guild')+'</div>'+
      '<div style="font-size:8px;color:var(--tx3)">'+t('guild_invited_by')+' '+(inv.invited_by_nickname||inv.invited_by.slice(0,8)+'...')+'</div></div>'+
      '<button onclick="guildAcceptInvite('+inv.id+')" style="padding:4px 10px;border-radius:4px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.3);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn)">'+t('guild_accept_btn')+'</button>'+
      '<button onclick="guildDeclineInvite('+inv.id+')" style="padding:4px 8px;border-radius:4px;background:rgba(255,255,255,.04);border:1px solid var(--bdr);color:var(--tx3);font-size:9px;cursor:pointer;font-family:var(--fn)">✕</button>'+
    '</div>';
  }).join('');
}

function renderGuildLeaderboard(guilds){
  var el=document.getElementById('guildLeaderboard');
  if(!guilds||!guilds.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px;font-size:10px">'+t('guild_lb_empty')+'</div>';return;}
  el.innerHTML=guilds.map(function(g,i){
    var myGuild=_myGuildData&&_myGuildData.id===g.id;
    var emblemHtml=g.emblemImage
      ? '<img src="'+g.emblemImage+'" style="width:20px;height:20px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:3px;border:1px solid rgba(255,255,255,.1);flex-shrink:0">'
      : '<span style="font-size:14px">'+(g.emblem||'🔴')+'</span>';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;'+(myGuild?'background:rgba(255,120,60,.06);border:1px solid rgba(255,120,60,.15)':'border-bottom:1px solid var(--bdr)')+'">'+
      '<span style="font-size:11px;color:'+(i<3?'var(--gold)':'var(--tx3)')+';font-weight:700;min-width:20px">#'+(i+1)+'</span>'+
      emblemHtml+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:11px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+g.name+' <span style="color:var(--mars);font-size:9px">['+g.tag+']</span></div>'+
        '<div style="font-size:8px;color:var(--tx3)">'+g.memberCount+' '+t('guild_lb_members_suffix')+' · '+t('guild_lb_leader_prefix')+' '+(g.leaderNickname||t('guild_lb_unknown'))+'</div>'+
      '</div>'+
      '<div style="text-align:right"><div style="font-size:12px;color:var(--gold);font-weight:700">'+(g.totalPixels||0).toLocaleString()+'</div><div style="font-size:7px;color:var(--tx3)">'+t('guild_lb_pixels')+'</div></div>'+
    '</div>';
  }).join('');
}

// ── Guild Chat (polling) ──
var _lastGuildMsgId=0;
var _guildChatPoll=null;
function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]}); }
function appendGuildChatMsgs(msgs){
  var box=document.getElementById('guildChatBox');
  if(!box||!msgs||!msgs.length) return;
  // Remove placeholder
  var ph=box.querySelector('[data-placeholder]');
  if(ph) ph.remove();
  // Also strip the default empty-state div if still present
  if(box.children.length===1 && box.children[0].textContent && box.children[0].textContent.indexOf('No messages')>=0) box.innerHTML='';
  var w=walletState.address||'';
  msgs.forEach(function(m){
    if(m.id<=_lastGuildMsgId) return;
    _lastGuildMsgId=m.id;
    var mine=(m.wallet||'').toLowerCase()===w.toLowerCase();
    var ts=new Date(m.at||m.createdAt||m.created_at||Date.now());
    var hh=String(ts.getHours()).padStart(2,'0'), mm=String(ts.getMinutes()).padStart(2,'0');
    var name=escapeHTML(m.nickname||(m.wallet||'').slice(0,8)+'...');
    var div=document.createElement('div');
    div.style.cssText='display:flex;gap:6px;align-items:flex-start';
    div.innerHTML='<span style="color:'+(mine?'var(--mars)':'var(--cyan)')+';font-weight:700;flex-shrink:0">'+name+'</span>'+
      '<span style="flex:1;color:var(--tx);word-break:break-word">'+escapeHTML(m.message)+'</span>'+
      '<span style="color:var(--tx3);font-size:8px;flex-shrink:0">'+hh+':'+mm+'</span>';
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}
function refreshGuildChat(){
  var w=walletState.address;
  if(!w||!_myGuildData) return;
  var url='/api/guild/chat/'+_myGuildData.id+(_lastGuildMsgId?('?sinceId='+_lastGuildMsgId):'');
  fetch(url, { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(data){
    if(data.error) return;
    appendGuildChatMsgs(data.messages||[]);
  }).catch(function(){});
}
function sendGuildChat(){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_login_first'),'error');return;}
  if(!_myGuildData){showToast(t('guild_toast_no_guild'),'error');return;}
  var input=document.getElementById('guildChatInput');
  var msg=(input.value||'').trim();
  if(!msg) return;
  input.disabled=true;
  fetch('/api/guild/chat',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:_myGuildData.id,message:msg})})
    .then(function(r){return r.json()}).then(function(data){
      input.disabled=false;
      if(data.error){showToast(data.error,'error');return;}
      try{trackQuestAction('guild_chat',1)}catch(e){}
      input.value='';
      input.focus();
      refreshGuildChat();
    }).catch(function(){input.disabled=false;showToast(t('guild_toast_send_failed'),'error')});
}
function startGuildChatPoll(){
  if(_guildChatPoll) return;
  _lastGuildMsgId=0;
  // Reset chat box
  var box=document.getElementById('guildChatBox');
  if(box) box.innerHTML='<div data-placeholder style="color:var(--tx3);text-align:center;font-size:9px;margin:auto">'+t('guild_chat_loading')+'</div>';
  refreshGuildChat();
  _guildChatPoll=_setActiveInterval(refreshGuildChat, 5000);
}
function stopGuildChatPoll(){
  if(_guildChatPoll){ _clearActiveInterval(_guildChatPoll); _guildChatPoll=null; }
}

function createGuild(){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_login_first'),'error');return;}
  var name=document.getElementById('guildNameInput').value.trim();
  var tag=document.getElementById('guildTagInput').value.trim();
  var emoji=document.getElementById('guildEmojiSelect').value;
  var desc=document.getElementById('guildDescInput').value.trim();
  if(!name||!tag){showToast(t('guild_toast_need_name_tag'),'error');return;}
  fetch('/api/guild/create',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,name:name,tag:tag,emoji:emoji,description:desc})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_created').replace('{tag}',data.tag),'success');
    loadGuildTab();
    // Refresh GP display
    try{ refreshEmailBalances(); }catch(_re){}
  }).catch(function(){showToast(t('guild_toast_create_failed'),'error')});
}

function guildInviteMember(targetOverride){
  var w=walletState.address;
  if(!w||!_myGuildData){showToast(t('guild_toast_no_guild'),'error');return;}
  // Preserve original case — server resolves nickname→wallet case-insensitively.
  var target=targetOverride||document.getElementById('guildInviteInput').value.trim();
  if(!target){showToast(t('guild_toast_enter_target'),'error');return;}
  fetch('/api/guild/invite',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:target,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_invite_sent'),'success');
    var inp=document.getElementById('guildInviteInput'); if(inp) inp.value='';
    var box=document.getElementById('guildInviteSearchResults'); if(box) box.innerHTML='';
  }).catch(function(){showToast(t('guild_toast_invite_failed'),'error')});
}

// ── Live search for invite candidates (debounced) ──
var _guildInviteSearchTimer=null;
function onGuildInviteSearchInput(){
  if(_guildInviteSearchTimer) _clearActiveTimeout(_guildInviteSearchTimer);
  _guildInviteSearchTimer=_setActiveTimeout(function(){
    _guildInviteSearchTimer=null;
    runGuildInviteSearch();
  },200);
}
function runGuildInviteSearch(){
  var inp=document.getElementById('guildInviteInput');
  var box=document.getElementById('guildInviteSearchResults');
  if(!inp||!box||!_myGuildData) return;
  var q=(inp.value||'').trim();
  if(!q){ box.innerHTML=''; return; }
  var w=walletState&&walletState.address; if(!w) return;
  fetch('/api/guild/'+_myGuildData.id+'/search-users?q='+encodeURIComponent(q), { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(d){
      var users=(d&&d.users)||[];
      if(!users.length){ box.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px 6px">'+t('guild_invite_no_matches')+'</div>'; return; }
      box.innerHTML=users.map(function(u){
        var label=u.nickname?escapeHTML(u.nickname):shortAddr(u.wallet);
        var sub=u.nickname?('<span style="font-size:8px;color:var(--tx3);margin-left:6px">'+shortAddr(u.wallet)+'</span>'):'';
        var pix='<span style="font-size:8px;color:var(--tx3);margin-left:6px">'+(u.pixelCount||0)+t('guild_pixels_short')+'</span>';
        var btn=u.hasPendingInvite
          ? '<span style="font-size:8px;color:var(--tx3);padding:3px 8px">'+t('guild_invite_pending')+'</span>'
          : '<button onclick="guildInviteMember(\''+u.wallet+'\')" style="padding:3px 8px;border-radius:3px;background:rgba(91,184,232,.14);border:1px solid rgba(91,184,232,.35);color:var(--cyan);font-size:8px;cursor:pointer;font-family:var(--fn)">'+t('guild_invite_btn')+'</button>';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:var(--surface1);border:1px solid var(--bdr);border-radius:4px"><div style="font-size:10px;color:var(--tx)">'+label+sub+pix+'</div>'+btn+'</div>';
      }).join('');
    })
    .catch(function(){ box.innerHTML='<div style="font-size:9px;color:var(--rd);padding:4px 6px">'+t('guild_invite_search_failed')+'</div>'; });
}

function guildAcceptInvite(inviteId){
  var w=walletState.address;
  fetch('/api/guild/invite/accept',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_joined'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_accept_failed'),'error')});
}

function guildDeclineInvite(inviteId){
  var w=walletState.address;
  fetch('/api/guild/invite/decline',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_declined'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// ── Search guilds by id/tag/name (join screen) ──
function searchGuildsQuery(){
  var inp=document.getElementById('guildSearchInput');
  var out=document.getElementById('guildSearchResults');
  if(!inp||!out) return;
  var q=(inp.value||'').trim();
  if(!q){out.innerHTML='';return;}
  out.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px">'+t('guild_search_searching')+'</div>';
  fetch('/api/guild/search?q='+encodeURIComponent(q)+'&limit=15')
    .then(function(r){return r.json()})
    .then(function(data){
      var gs=(data&&data.guilds)||[];
      if(!gs.length){out.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:6px 4px">'+t('guild_search_none').replace('{q}',escapeHTML(q))+'</div>';return;}
      out.innerHTML=gs.map(function(g){
        var emblem=g.emblemImage
          ? '<img src="'+g.emblemImage+'" style="width:22px;height:22px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:3px;border:1px solid rgba(255,255,255,.1);flex-shrink:0">'
          : '<span style="font-size:16px">'+(g.emblem||'🔴')+'</span>';
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid var(--bdr)">'+
          emblem+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-size:11px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHTML(g.name)+' <span style="color:var(--mars);font-size:9px">['+escapeHTML(g.tag)+']</span><span style="color:var(--tx3);font-size:8px;margin-left:4px">#'+g.id+'</span></div>'+
            '<div style="font-size:8px;color:var(--tx3)">'+t('guild_level_prefix')+(g.level||1)+' · '+g.memberCount+' '+t('guild_lb_members_suffix')+' · '+(g.totalPixels||0).toLocaleString()+' '+t('guild_pixels_short')+' · '+escapeHTML(g.leaderNickname||'—')+'</div>'+
          '</div>'+
          '<button onclick="requestJoinGuild('+g.id+',\''+escapeHTML(g.name).replace(/\'/g,'&#39;')+'\')" style="padding:6px 10px;border-radius:5px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.35);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn);font-weight:700;flex-shrink:0">'+t('guild_search_join_btn')+'</button>'+
        '</div>';
      }).join('');
    })
    .catch(function(){out.innerHTML='<div style="font-size:9px;color:var(--red);padding:4px">'+t('guild_search_failed')+'</div>'});
}

// ── Leader/officer: incoming join requests ──
function loadGuildJoinRequests(guildId){
  var w=walletState.address;
  if(!w||!guildId) return;
  fetch('/api/guild/'+guildId+'/requests', { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(data){
      var list=(data&&data.requests)||[];
      var el=document.getElementById('guildRequestsList');
      var cnt=document.getElementById('guildRequestsCount');
      var sec=document.getElementById('guildRequestsSection');
      if(cnt) cnt.textContent=list.length?('('+list.length+')'):'';
      if(!list.length){
        if(el) el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:4px 0">'+t('guild_no_requests')+'</div>';
        return;
      }
      if(el){
        el.innerHTML=list.map(function(r){
          var name=escapeHTML(r.nickname||r.wallet);
          return '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(76,216,154,.04);border:1px solid rgba(76,216,154,.18);border-radius:6px">'+
            '<div style="flex:1;min-width:0">'+
              '<div style="font-size:10px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+name+'</div>'+
              '<div style="font-size:8px;color:var(--tx3)">'+(r.pixel_count||0).toLocaleString()+' '+t('guild_pixels_owned')+'</div>'+
            '</div>'+
            '<button onclick="approveGuildRequest('+r.id+')" style="font-size:8px;padding:4px 8px;border-radius:4px;background:rgba(76,216,154,.15);border:1px solid rgba(76,216,154,.4);color:var(--gn);cursor:pointer;font-family:var(--fn);font-weight:700">'+t('guild_accept_btn')+'</button>'+
            '<button onclick="rejectGuildRequest('+r.id+')" style="font-size:8px;padding:4px 8px;border-radius:4px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);color:var(--red);cursor:pointer;font-family:var(--fn)">✕</button>'+
          '</div>';
        }).join('');
      }
    })
    .catch(function(){});
}
function approveGuildRequest(inviteId){
  var w=walletState.address;
  fetch('/api/guild/request/approve',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      showToast(t('guild_toast_player_added'),'success');
      loadGuildTab();
    }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}
function rejectGuildRequest(inviteId){
  var w=walletState.address;
  fetch('/api/guild/request/reject',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,inviteId:inviteId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      if(_myGuildData&&_myGuildData.id) loadGuildJoinRequests(_myGuildData.id);
    }).catch(function(){});
}

// Send a self-invite so a leader/officer can approve the join.  Uses the
// existing guild_invites table; the server marks invited_by = requester so
// leaders see the row as an incoming request instead of a normal invite.
async function requestJoinGuild(guildId, guildName){
  var w=walletState.address;
  if(!w){showToast(t('guild_toast_sign_in_first'),'error');return;}
  var ok=await gameConfirm({icon:'🏰',title:LANG==='ko'?'길드 가입 신청':LANG==='ja'?'ギルド加入申請':LANG==='zh'?'申请加入公会':'Guild Join Request',body:'<b>'+escapeHTML(guildName)+'</b>'+(LANG==='ko'?'에 가입 신청을 보냅니다.':LANG==='ja'?'に加入申請を送ります。':LANG==='zh'?'发送加入申请。':' — Send a join request?'),confirmText:LANG==='ko'?'신청':LANG==='ja'?'申請':LANG==='zh'?'申请':'Request'});
  if(!ok) return;
  fetch('/api/guild/join-request',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:guildId})})
    .then(function(r){return r.json()})
    .then(function(data){
      if(data.error){showToast(data.error,'error');return;}
      showToast(t('guild_toast_join_request_sent').replace('{name}',guildName),'success');
    })
    .catch(function(){showToast(t('guild_toast_join_request_failed'),'error')});
}

async function guildLeave(){
  var ok=await gameConfirm({icon:'🏰',title:LANG==='ko'?'길드 탈퇴':LANG==='ja'?'ギルド脱退':LANG==='zh'?'退出公会':'Leave Guild',body:LANG==='ko'?'길드에서 탈퇴합니다. 쿨다운 기간 동안 재가입이 제한됩니다.':LANG==='ja'?'ギルドを脱退します。クールダウン期間中は再加入が制限されます。':LANG==='zh'?'退出公会。冷却期间内限制重新加入。':'Leave this guild. Rejoining will be restricted during the cooldown.',confirmText:LANG==='ko'?'탈퇴':LANG==='ja'?'脱退':LANG==='zh'?'退出':'Leave'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/leave',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_left'),'info');
    _myGuildData=null;
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// [v7.357] 길드 변절(배신) — 금고 탈취 + 배신자 낙인 + 자동 현상금 + 쿨다운
async function guildDefect(){
  var body=LANG==='ko'?'길드 금고의 일부를 들고 변절합니다.<br><br>• 금고 일부를 탈취해 내 GP로<br>• <b style="color:#E84855">배신자 낙인</b>이 영구히 찍힘<br>• 남은 금고로 당신에게 <b style="color:#FFD166">현상금</b>이 걸림 (다른 플레이어가 사냥)<br>• 일정 시간 길드 재가입 불가<br><br>돌이킬 수 없습니다.'
    :LANG==='ja'?'ギルド金庫の一部を持って裏切ります。<br><br>• 金庫の一部を奪取して自分のGPに<br>• <b style="color:#E84855">裏切り者の烙印</b>が永久に付く<br>• 残った金庫からあなたに<b style="color:#FFD166">賞金</b>がかかる(他プレイヤーが狩る)<br>• 一定時間ギルド再加入不可<br><br>取り消せません。'
    :LANG==='zh'?'带走部分公会金库后叛变。<br><br>• 夺取部分金库为个人GP<br>• 永久打上<b style="color:#E84855">叛徒烙印</b><br>• 用剩余金库对你发布<b style="color:#FFD166">悬赏</b>(其他玩家追杀)<br>• 一段时间内无法重新加入公会<br><br>不可撤销。'
    :'Defect, taking a cut of the guild treasury.<br><br>• Steal part of the treasury as your GP<br>• Permanent <b style="color:#E84855">betrayer mark</b><br>• A <b style="color:#FFD166">bounty</b> is placed on you from the remaining treasury (others will hunt you)<br>• Cannot rejoin a guild during a cooldown<br><br>This cannot be undone.';
  var ok=await gameConfirm({
    icon:'⚔',
    title:LANG==='ko'?'길드 변절 (배신)':LANG==='ja'?'ギルド裏切り':LANG==='zh'?'公会叛变':'Defect (Betray Guild)',
    body:body,
    confirmText:LANG==='ko'?'변절한다':LANG==='ja'?'裏切る':LANG==='zh'?'叛变':'DEFECT'
  });
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/defect',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){
      var msg=data.error==='DEFECTION_COOLDOWN'?(LANG==='ko'?('재가입 쿨다운 중 ('+(data.cooldownHours||'')+'h)'):LANG==='ja'?'再加入クールダウン中':LANG==='zh'?'重新加入冷却中':'Rejoin cooldown active')
        :data.error==='LEADER_CANNOT_DEFECT'?(LANG==='ko'?'리더는 변절할 수 없습니다 (해산/위임 필요)':LANG==='ja'?'リーダーは裏切れません':LANG==='zh'?'会长无法叛变':'Leader cannot defect')
        :data.error==='NOT_IN_GUILD'?(LANG==='ko'?'길드에 속해있지 않습니다':'Not in a guild')
        :data.error;
      showToast(msg,'error');return;
    }
    var done=LANG==='ko'?('변절 완료 — '+Math.round(data.stolen||0).toLocaleString()+' GP 탈취, 당신에게 '+Math.round(data.bounty_gp||0).toLocaleString()+' GP 현상금')
      :LANG==='ja'?('裏切り完了 — '+Math.round(data.stolen||0).toLocaleString()+' GP奪取、賞金'+Math.round(data.bounty_gp||0).toLocaleString()+' GP')
      :LANG==='zh'?('叛变完成 — 夺取 '+Math.round(data.stolen||0).toLocaleString()+' GP，被悬赏 '+Math.round(data.bounty_gp||0).toLocaleString()+' GP')
      :('Defected — stole '+Math.round(data.stolen||0).toLocaleString()+' GP, '+Math.round(data.bounty_gp||0).toLocaleString()+' GP bounty on you');
    showToast(done,'info');
    _myGuildData=null;
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// [v7.360] 킬보드 & PvP 정찰 UI (배신 시스템) — 4개국어 로컬라이징
function _kbL(en,ko,ja,zh){return LANG==='ko'?ko:LANG==='ja'?ja:LANG==='zh'?zh:en;}
var _kbTab='board';
function kbSwitchTab(tab){
  _kbTab=tab;
  var b=document.getElementById('kbTab_board'), s=document.getElementById('kbTab_scout');
  if(b&&s){
    b.style.borderBottomColor=tab==='board'?'var(--red)':'transparent'; b.style.color=tab==='board'?'#ff8a80':'var(--tx3)'; b.style.background=tab==='board'?'rgba(232,72,85,.08)':'transparent';
    s.style.borderBottomColor=tab==='scout'?'#5cbbff':'transparent'; s.style.color=tab==='scout'?'#5cbbff':'var(--tx3)'; s.style.background=tab==='scout'?'rgba(92,187,255,.08)':'transparent';
  }
  if(tab==='board') loadKillboard(); else renderScoutPanel();
}
function kbRefresh(){ if(_kbTab==='board') loadKillboard(); else { renderScoutPanel(); } }
function _kbShort(w){ return w?(w.slice(0,6)+'…'+w.slice(-4)):'?'; }
function _kbName(nick,w){ return escapeHtmlSafe(String(nick||_kbShort(w))); } // (v7.396) 출력 이스케이프(방어선)

async function loadKillboard(){
  var el=document.getElementById('kbContent'); if(!el) return;
  el.innerHTML='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">'+_kbL('Loading…','로딩 중…','読み込み中…','加载中…')+'</div>';
  var my=(walletState.address||'').toLowerCase();
  try{
    var results = await Promise.all([
      fetch('/api/killboard?limit=15').then(function(r){return r.json()}),
      my?fetch('/api/killboard/'+my).then(function(r){return r.json()}):Promise.resolve(null)
    ]);
    var board=results[0], mine=results[1];
    var html='';
    var _kbGp=function(n){ n=parseInt(n)||0; return n>=1000?((n/1000).toFixed(n>=10000?0:1)+'K'):String(n); };
    if(mine){
      html+='<div style="display:flex;gap:8px;margin-bottom:8px">'+
        '<div style="flex:1;text-align:center;padding:6px;border-radius:6px;background:rgba(76,216,154,.08);border:1px solid rgba(76,216,154,.2)"><div style="font-size:14px;font-weight:800;color:#4cd89a">'+(mine.kills||0)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('KILLS','격침','撃沈','击沉')+'</div></div>'+
        '<div style="flex:1;text-align:center;padding:6px;border-radius:6px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2)"><div style="font-size:14px;font-weight:800;color:#ff8a80">'+(mine.losses||0)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('LOSSES','피격','被撃','被击')+'</div></div>'+
        '<div style="flex:1.5;text-align:center;padding:6px;border-radius:6px;background:rgba(255,209,102,.09);border:1px solid rgba(255,209,102,.28)"><div style="font-size:14px;font-weight:800;color:#ffd166">'+_kbGp(mine.destroyedValue)+'</div><div style="font-size:8px;color:var(--tx3)">'+_kbL('GP DESTROYED','격파 가치','撃破価値','击破价值')+'</div></div>'+
      '</div>'+
      ((mine.bestKillValue>0)?'<div style="text-align:center;font-size:8px;color:#ffd166;margin-bottom:8px">🏆 '+_kbL('Best kill','최고 격파','最高撃破','最佳击破')+': '+_kbGp(mine.bestKillValue)+' GP</div>':'');
    }
    var kills=(board&&board.kills)||[];
    if(!kills.length){
      html+='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:10px">'+_kbL('No recent kills.','최근 격침 없음.','撃沈なし。','暂无击沉。')+'</div>';
    } else {
      html+=kills.map(function(k){
        var betr=k.victim_is_betrayer?' <span style="color:#FFD166;font-size:8px">⚑'+_kbL('TRAITOR','배신자','裏切り','叛徒')+'</span>':'';
        var val=parseInt(k.ship_value_gp)||0;
        var big=val>=5000; // 고가치 격파 강조
        var modsBadge=(k.mods>0)?'<span style="color:#7ee787;font-size:7px;font-weight:800"> +'+k.mods+'M</span>':'';
        var valHtml=val>0?'<span style="color:'+(big?'#ffd166':'var(--tx3)')+';font-size:8px;font-weight:'+(big?'800':'400')+'">'+(big?'💥 ':'')+_kbGp(val)+' GP'+modsBadge+'</span>':'';
        return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:9px'+(big?';background:rgba(255,209,102,.04)':'')+'">'+
          '<span style="color:#4cd89a;font-weight:700">'+_kbName(k.killer_nick,k.killer_wallet)+'</span>'+
          '<span style="color:var(--tx3)">⚔</span>'+
          '<span style="color:#ff8a80">'+_kbName(k.victim_nick,k.victim_wallet)+'</span>'+betr+
          '<span style="color:var(--tx3);font-size:7px">'+escapeHtmlSafe(String(k.ship_name||k.ship_type||''))+'</span>'+
          '<span style="margin-left:auto">'+valHtml+'</span>'+
        '</div>';
      }).join('');
    }
    el.innerHTML=html;
  }catch(e){ el.innerHTML='<div style="color:var(--red);font-size:10px;text-align:center;padding:10px">'+_kbL('Failed to load.','불러오기 실패.','読込失敗。','加载失败。')+'</div>'; }
}

function renderScoutPanel(){
  var el=document.getElementById('kbContent'); if(!el) return;
  el.innerHTML=
    '<div style="font-size:9px;color:var(--tx3);line-height:1.6;margin-bottom:8px">'+_kbL(
      'Scout an enemy to reveal their hidden fleet composition before you attack. Costs GP. The target may detect you.',
      '공격 전 적 함대의 숨겨진 구성을 정찰로 노출합니다. GP가 들고, 표적이 탐지할 수 있습니다.',
      '攻撃前に敵艦隊の隠れた構成を偵察で暴きます。GPが必要で、標的に探知される場合があります。',
      '攻击前侦察敌方隐藏的舰队构成。消耗GP，可能被目标察觉。')+'</div>'+
    '<div style="display:flex;gap:6px;margin-bottom:8px">'+
      '<input id="kbScoutTarget" type="text" placeholder="'+_kbL('Target wallet','대상 지갑','対象ウォレット','目标钱包')+'" style="flex:1;font-size:10px;padding:7px 9px;border-radius:6px;background:rgba(0,0,0,.25);border:1px solid rgba(92,187,255,.25);color:var(--tx);font-family:var(--fn)">'+
      '<button onclick="kbScout()" style="font-size:10px;padding:7px 12px;border-radius:6px;background:rgba(92,187,255,.15);border:1px solid rgba(92,187,255,.45);color:#5cbbff;font-weight:700;cursor:pointer;font-family:var(--fn)">🛰 '+_kbL('SCOUT','정찰','偵察','侦察')+'</button>'+
    '</div>'+
    '<div id="kbScoutResult"></div>'+
    '<div id="kbScoutReports" style="margin-top:8px"></div>';
  loadScoutReports();
}

function _kbIntelCard(intel,meta){
  var c=intel.composition||{};
  var chip=function(label,val,color){ return val>0?('<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);font-size:8px;color:'+(color||'var(--tx2)')+'">'+label+' '+val+'</span>'):''; };
  return '<div style="border-radius:7px;background:rgba(92,187,255,.05);border:1px solid rgba(92,187,255,.22);padding:9px 11px;margin-bottom:6px">'+
    (meta?('<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">'+meta+'</div>'):'')+
    '<div style="font-size:10px;font-weight:700;color:#5cbbff;margin-bottom:5px">'+_kbL('Fleet Intel','함대 정보','艦隊情報','舰队情报')+' — '+(intel.ships_alive||0)+' '+_kbL('ships','척','隻','艘')+' / '+(intel.fleet_count||0)+' '+_kbL('fleets','함대','艦隊','舰队')+'</div>'+
    '<div>'+
      chip(_kbL('Frig','프리','フリ','护'),c.frigate)+chip(_kbL('Dest','구축','駆','驱'),c.destroyer)+chip(_kbL('Cru','순양','巡','巡'),c.cruiser)+
      chip('BS',c.battleship,'#ffd166')+chip('Titan',c.titan,'#ff8a80')+chip(_kbL('Unit','유닛','ユニ','单位'),c.assembled,'#bb86fc')+
    '</div>'+
    '<div style="display:flex;gap:10px;margin-top:5px;font-size:9px">'+
      '<span style="color:#ff8a80">⚔ '+(intel.total_atk||0).toLocaleString()+'</span>'+
      '<span style="color:#5cbbff">🛡 '+(intel.total_def||0).toLocaleString()+'</span>'+
      '<span style="color:#4cd89a">❤ '+Math.round((intel.total_current_hp||0)/1000)+'k/'+Math.round((intel.total_max_hp||0)/1000)+'k</span>'+
    '</div>'+
  '</div>';
}

async function kbScout(){
  var my=walletState.address; if(!my){ showToast(_kbL('Connect wallet','지갑 연결 필요','ウォレット接続','请连接钱包'),'error'); return; }
  var tgtEl=document.getElementById('kbScoutTarget'); var target=(tgtEl&&tgtEl.value||'').trim();
  if(!target){ showToast(_kbL('Enter a target','대상을 입력하세요','対象を入力','请输入目标'),'error'); return; }
  var resEl=document.getElementById('kbScoutResult'); if(resEl) resEl.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:6px">'+_kbL('Scouting…','정찰 중…','偵察中…','侦察中…')+'</div>';
  try{
    var r=await fetch('/api/spy/scout',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({target_wallet:target})}).then(function(x){return x.json()});
    if(r.error){
      var msg=r.error==='INSUFFICIENT_GP'?_kbL('Not enough GP','GP 부족','GP不足','GP不足')
        :r.error==='TARGET_NOT_FOUND'?_kbL('Target not found','대상 없음','対象なし','未找到目标')
        :r.error==='CANNOT_SCOUT_SELF'?_kbL('Cannot scout yourself','자신은 정찰 불가','自分は偵察不可','无法侦察自己')
        :r.error;
      if(resEl) resEl.innerHTML='<div style="color:var(--red);font-size:10px;padding:6px">'+msg+'</div>';
      return;
    }
    var meta=_kbL('Cost','비용','コスト','花费')+' '+(r.cost_gp||0)+' GP'+(r.double_agent?' · '+_kbL('double-agent discount','이중첩자 할인','二重スパイ割引','双面间谍折扣'):'')+(r.detected?' · ⚠ '+_kbL('DETECTED','탐지됨','探知された','已被察觉'):'');
    if(resEl) resEl.innerHTML=_kbIntelCard(r.intel||{},meta);
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
    loadScoutReports();
  }catch(e){ if(resEl) resEl.innerHTML='<div style="color:var(--red);font-size:10px;padding:6px">'+_kbL('Scout failed','정찰 실패','偵察失敗','侦察失败')+'</div>'; }
}

async function loadScoutReports(){
  var el=document.getElementById('kbScoutReports'); if(!el) return;
  try{
    var d=await fetch('/api/spy/reports?limit=5',{headers:getAuthHeaders()}).then(function(r){return r.json()});
    var reps=(d&&d.reports)||[];
    if(!reps.length){ el.innerHTML=''; return; }
    el.innerHTML='<div style="font-size:8px;color:var(--tx3);letter-spacing:1px;margin:4px 0">'+_kbL('RECENT INTEL','최근 정보','最近の情報','最近情报')+'</div>'+
      reps.map(function(rp){ return _kbIntelCard(rp.intel||{}, _kbShort(rp.target_wallet)+(rp.stale?' · '+_kbL('stale','만료','期限切れ','已过期'):'')); }).join('');
  }catch(e){ el.innerHTML=''; }
}

// (도파민 #6 v7.394) 부재 중 손실 브리핑 — 복귀 시 손실회피 훅(D7/D30 리텐션).
function _checkAwayBriefing(){
  try{
    fetch('/api/me/away-briefing', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }).then(function(d){
      if(!d || !d.hasNews) return;
      // 같은 손실을 매번 띄우지 않게 lastLoss 시점 기준 1회만
      var key='away_briefing_seen_'+(walletState.address||'');
      var seen=localStorage.getItem(key)||'';
      var stamp=String(d.lastLoss||'')+'|'+d.bounties;
      if(seen===stamp) return;
      localStorage.setItem(key, stamp);
      var parts=[];
      if(d.shipsLost>0) parts.push((LANG==='ko'?('함선 '+d.shipsLost+'척 격침'):LANG==='ja'?(d.shipsLost+'隻撃沈'):LANG==='zh'?('损失'+d.shipsLost+'舰'):(d.shipsLost+' ships lost'))+(d.lostValue>0?(' ('+(d.lostValue>=1000?(d.lostValue/1000).toFixed(0)+'K':d.lostValue)+' GP)'):''));
      if(d.bounties>0) parts.push((LANG==='ko'?('현상금 '+d.bounties+'건'):LANG==='ja'?('賞金'+d.bounties+'件'):LANG==='zh'?('悬赏'+d.bounties+'个'):(d.bounties+' bounties on you')));
      if(!parts.length) return;
      var title=(LANG==='ko'?'⚠ 부재 중 피해 보고':LANG==='ja'?'⚠ 不在中の被害':LANG==='zh'?'⚠ 离开期间损失':'⚠ While you were away');
      var cta=(LANG==='ko'?'복수하러 가기 ⚔':LANG==='ja'?'反撃へ ⚔':LANG==='zh'?'去复仇 ⚔':'Strike back ⚔');
      // 손실회피 배너 (토스트보다 강하게 — 클릭 시 킬보드/PVP로)
      var b=document.createElement('div');
      b.style.cssText='position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:99990;max-width:340px;width:calc(100% - 28px);background:linear-gradient(135deg,rgba(40,12,12,.97),rgba(20,8,10,.97));border:1px solid rgba(255,90,90,.5);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 18px rgba(255,70,70,.25);padding:13px 14px;font-family:var(--fn)';
      b.innerHTML='<div style="font-size:11px;font-weight:900;color:#ff8a80;letter-spacing:1px;margin-bottom:5px">'+title+'</div>'
        +'<div style="font-size:10px;color:rgba(255,255,255,.82);line-height:1.5;margin-bottom:9px">'+parts.join(' · ')+'</div>'
        +'<div style="display:flex;gap:7px">'
        +'<button type="button" id="_awayCta" style="flex:1;padding:8px;border-radius:8px;background:linear-gradient(135deg,#ff5a5a,#ff8a3d);border:none;color:#fff;font-weight:800;font-size:10px;cursor:pointer">'+cta+'</button>'
        +'<button type="button" id="_awayClose" style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--tx3);font-size:10px;cursor:pointer">✕</button>'
        +'</div>';
      document.body.appendChild(b);
      var _rm=function(){ try{ b.remove(); }catch(_){} };
      b.querySelector('#_awayClose').onclick=_rm;
      b.querySelector('#_awayCta').onclick=function(){ _rm(); try{ if(typeof openBaseModal==='function'){ openBaseModal(); setTimeout(function(){ try{ switchBaseTab('pvp', document.getElementById('baseTabPvp')); if(typeof clearBaseTabDot==='function') clearBaseTabDot('pvp'); }catch(_){} }, 250); } }catch(_){} };
      try{ if(window._sfx) _sfx.error(); }catch(_){}
      setTimeout(_rm, 15000);
    }).catch(function(){});
  }catch(_){}
}
// [v7.361] 배신자 낙인 속죄(유료 제거)
function _checkBetrayerMark(w){
  var banner=document.getElementById('betrayerRedeemBanner'); if(!banner||!w) return;
  fetch('/api/tags/'+encodeURIComponent(w), { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
    var tags=(d&&(d.tags||d))||[];
    var has=Array.isArray(tags)&&tags.some(function(tg){ return (tg.tag_id||tg.id||tg)==='guild_betrayer'; });
    banner.style.display = has ? '' : 'none';
  }).catch(function(){});
}
async function guildRedeemBetrayal(){
  var ok=await gameConfirm({
    icon:'⚖',
    title:LANG==='ko'?'배신자 낙인 제거':LANG==='ja'?'裏切り者の烙印を消す':LANG==='zh'?'清除叛徒烙印':'Clear Betrayer Mark',
    body:LANG==='ko'?'GP를 지불해 배신자 낙인을 영구히 제거합니다. 지불한 GP는 소각됩니다.':LANG==='ja'?'GPを支払い裏切り者の烙印を永久に消します。支払ったGPは焼却されます。':LANG==='zh'?'支付GP永久清除叛徒烙印。支付的GP将被销毁。':'Pay GP to permanently clear your betrayer mark. The GP is burned.',
    confirmText:LANG==='ko'?'속죄':LANG==='ja'?'贖罪':LANG==='zh'?'赎罪':'REDEEM'
  });
  if(!ok) return;
  fetch('/api/guild/redeem-betrayal',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){
      var msg=data.error==='INSUFFICIENT_GP'?(LANG==='ko'?('GP 부족 ('+(data.required||'')+' 필요)'):LANG==='ja'?'GP不足':LANG==='zh'?'GP不足':'Not enough GP')
        :data.error==='NO_BETRAYER_MARK'?(LANG==='ko'?'낙인이 없습니다':LANG==='ja'?'烙印なし':LANG==='zh'?'无烙印':'No mark'):data.error;
      showToast(msg,'error');return;
    }
    showToast(LANG==='ko'?('낙인 제거 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP 소각'):LANG==='ja'?('烙印を消去 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP'):LANG==='zh'?('烙印已清除 — '+Math.round(data.cost_gp||0).toLocaleString()+' GP'):('Mark cleared — '+Math.round(data.cost_gp||0).toLocaleString()+' GP burned'),'info');
    var banner=document.getElementById('betrayerRedeemBanner'); if(banner) banner.style.display='none';
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

async function guildKick(targetWallet){
  var ok=await gameConfirm({icon:'⚔',title:LANG==='ko'?'멤버 추방':LANG==='ja'?'メンバー追放':LANG==='zh'?'踢出成员':'Kick Member',body:LANG==='ko'?'해당 멤버를 길드에서 추방합니다.':LANG==='ja'?'このメンバーをギルドから追放します。':LANG==='zh'?'将该成员踢出公会。':'Remove this member from the guild.',confirmText:LANG==='ko'?'추방':LANG==='ja'?'追放':LANG==='zh'?'踢出':'Kick'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/kick',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_kicked'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

function guildPromote(targetWallet){
  var w=walletState.address;
  fetch('/api/guild/promote',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_promoted'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

function guildDemote(targetWallet){
  var w=walletState.address;
  fetch('/api/guild/demote',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_demoted'),'info');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

async function guildTransfer(targetWallet){
  var ok=await gameConfirm({icon:'👑',title:LANG==='ko'?'길드장 양도':LANG==='ja'?'ギルドマスター移譲':LANG==='zh'?'转让会长':'Transfer Leadership',body:LANG==='ko'?'길드장 권한을 해당 멤버에게 영구 양도합니다.':LANG==='ja'?'ギルドマスター権限を該当メンバーに永久移譲します。':LANG==='zh'?'将会长权限永久转让给该成员。':'Permanently transfer guild leadership to this member.',confirmText:LANG==='ko'?'양도':LANG==='ja'?'移譲':LANG==='zh'?'转让':'Transfer'});
  if(!ok) return;
  var w=walletState.address;
  fetch('/api/guild/transfer',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,targetWallet:targetWallet,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_transferred'),'success');
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// ── Guild Edit Modal (leader only) ─────────────────
// Lineage-style pixel-art emblem: any image is canvas-resized to 32×32.
var _guildEmblemDataUrl=null;      // staged image payload
var _guildEmblemMode='emoji';      // 'emoji' | 'image' | 'clear'

function openGuildEditModal(){
  if(!_myGuildData){ showToast('No guild','error'); return; }
  var g=_myGuildData;
  document.getElementById('geName').value=g.name||'';
  document.getElementById('geDesc').value=g.description||'';
  document.getElementById('geEmojiSelect').value=g.emblem||'🔴';
  _guildEmblemDataUrl=null;
  _guildEmblemMode='emoji';
  // Preview: show current emblem
  var prev=document.getElementById('gePreview');
  if(g.emblemImage){
    prev.innerHTML='<img src="'+g.emblemImage+'" style="width:64px;height:64px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px;border:1px solid var(--bdr)">';
    _guildEmblemMode='image';
    _guildEmblemDataUrl=g.emblemImage; // keep current until user changes
  } else {
    prev.innerHTML='<div style="font-size:48px">'+(g.emblem||'🔴')+'</div>';
  }
  document.getElementById('guildEditModal').style.display='flex';
  updateGuildEditCost();
}

function closeGuildEditModal(){
  document.getElementById('guildEditModal').style.display='none';
  _guildEmblemDataUrl=null;
}

// Calculate total GP cost based on which fields changed
function updateGuildEditCost(){
  if(!_myGuildData) return;
  var g=_myGuildData;
  var nm=document.getElementById('geName').value.trim();
  var ds=document.getElementById('geDesc').value;
  var em=document.getElementById('geEmojiSelect').value;
  var cost=0;
  var parts=[];
  // Cost constants mirror server settings (guild_rename_cost_gp etc.)
  if(nm && nm !== g.name)       { cost += 100; parts.push('Name 100'); }
  if(ds !== (g.description||'')){ cost += 20;  parts.push('Desc 20'); }
  if(_guildEmblemMode==='image' && _guildEmblemDataUrl && _guildEmblemDataUrl !== g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  else if(_guildEmblemMode==='clear' && g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  else if(_guildEmblemMode==='emoji' && em !== g.emblem && !g.emblemImage) { cost += 50; parts.push('Emblem 50'); }
  document.getElementById('geCost').textContent=cost;
  document.getElementById('geCostBreakdown').textContent=parts.length?('('+parts.join(' · ')+')'):'(no changes)';
  var btn=document.getElementById('geSaveBtn');
  btn.disabled=(cost===0);
  btn.style.opacity=(cost===0)?'0.4':'1';
}

// File picker: resize uploaded image to 32×32 with nearest-neighbor (pixelated)
function onGuildEmblemFile(input){
  var f=input.files && input.files[0];
  if(!f) return;
  if(f.size > 2*1024*1024){ showToast('Max 2MB image','error'); return; }
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      // Downscale to 32×32 on an offscreen canvas
      var SIZE=32;
      var c=document.createElement('canvas'); c.width=SIZE; c.height=SIZE;
      var ctx=c.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      // Contain the source into the square (letterbox transparent)
      var s=Math.max(img.width,img.height);
      var dx=(s-img.width)/2, dy=(s-img.height)/2;
      // Draw on a temp full-size canvas first so scaling is exact
      var tmp=document.createElement('canvas'); tmp.width=s; tmp.height=s;
      var tctx=tmp.getContext('2d');
      tctx.imageSmoothingEnabled=false;
      tctx.drawImage(img, dx, dy);
      ctx.drawImage(tmp, 0, 0, SIZE, SIZE);
      var dataUrl=c.toDataURL('image/png');
      if(dataUrl.length > 8192){
        showToast('Image too complex — try a simpler one','error');
        return;
      }
      _guildEmblemDataUrl=dataUrl;
      _guildEmblemMode='image';
      document.getElementById('gePreview').innerHTML=
        '<img src="'+dataUrl+'" style="width:64px;height:64px;image-rendering:pixelated;image-rendering:crisp-edges;border-radius:6px;border:1px solid var(--bdr);background:#000">';
      updateGuildEditCost();
    };
    img.onerror=function(){ showToast('Invalid image','error'); };
    img.src=e.target.result;
  };
  reader.readAsDataURL(f);
}

// Clear custom image, revert to emoji
function clearGuildEmblemImage(){
  _guildEmblemDataUrl=null;
  _guildEmblemMode='clear';
  var em=document.getElementById('geEmojiSelect').value;
  document.getElementById('gePreview').innerHTML='<div style="font-size:48px">'+em+'</div>';
  updateGuildEditCost();
}

function onGuildEmojiChange(){
  if(_guildEmblemMode==='image') return; // don't stomp image preview
  var em=document.getElementById('geEmojiSelect').value;
  document.getElementById('gePreview').innerHTML='<div style="font-size:48px">'+em+'</div>';
  _guildEmblemMode='emoji';
  updateGuildEditCost();
}

function saveGuildEdit(){
  if(!_myGuildData || !walletState.address){ showToast('Login first','error'); return; }
  var g=_myGuildData;
  var nm=document.getElementById('geName').value.trim();
  var ds=document.getElementById('geDesc').value;
  var em=document.getElementById('geEmojiSelect').value;
  var body={ wallet: walletState.address, guildId: g.id };
  if(nm && nm !== g.name) body.name = nm;
  if(ds !== (g.description||'')) body.description = ds;
  if(_guildEmblemMode==='image' && _guildEmblemDataUrl && _guildEmblemDataUrl !== g.emblemImage) body.emblemImage = _guildEmblemDataUrl;
  if(_guildEmblemMode==='clear' && g.emblemImage) body.emblemImage = null;
  if(_guildEmblemMode==='emoji' && em !== g.emblem && !g.emblemImage) body.emblemEmoji = em;

  if(Object.keys(body).length <= 2){ showToast('No changes','info'); return; }

  var btn=document.getElementById('geSaveBtn');
  btn.disabled=true; btn.textContent='SAVING…';
  fetch('/api/guild/update',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(data){
      btn.disabled=false; btn.textContent='SAVE CHANGES';
      if(data.error){ showToast(data.error,'error'); return; }
      showToast('Guild updated (-'+data.cost+' GP)','success');
      closeGuildEditModal();
      loadGuildTab();
      try{ refreshEmailBalances(); }catch(_re){}
    })
    .catch(function(){ btn.disabled=false; btn.textContent='SAVE CHANGES'; showToast('Failed to update','error'); });
}

async function guildDisband(){
  if(!_myGuildData || !_myGuildData.name){ showToast(t('guild_toast_no_guild_data'),'error'); return; }
  var name=_myGuildData.name;
  var ok=await gameConfirm({icon:'💀',title:LANG==='ko'?'길드 해산':LANG==='ja'?'ギルド解散':LANG==='zh'?'解散公会':'Disband Guild',body:'<b>'+escapeHTML(name)+'</b> '+(LANG==='ko'?'길드를 영구 해산합니다. 되돌릴 수 없습니다.':LANG==='ja'?'ギルドを永久解散します。元に戻せません。':LANG==='zh'?'公会将被永久解散，不可撤销。':'will be permanently disbanded. This cannot be undone.'),confirmText:LANG==='ko'?'해산':LANG==='ja'?'解散':LANG==='zh'?'解散':'Disband'});
  if(!ok) return;
  var typed=await gameInput({title:LANG==='ko'?'길드 해산 확인':LANG==='ja'?'ギルド解散確認':LANG==='zh'?'确认解散公会':'Confirm Disband',label:LANG==='ko'?'길드 이름을 정확히 입력하세요':LANG==='ja'?'ギルド名を正確に入力してください':LANG==='zh'?'请准确输入公会名称':'Type the guild name exactly to confirm',placeholder:name,maxLength:60});
  if(typed===null||typed===undefined) return;
  if(typed.trim()!==name){
    showToast(t('guild_toast_disband_mismatch'),'error');
    return;
  }
  var w=walletState.address;
  fetch('/api/guild/disband',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,guildId:_myGuildData.id})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('guild_toast_disbanded'),'info');
    _myGuildData=null;
    loadGuildTab();
  }).catch(function(){showToast(t('guild_toast_generic_failed'),'error')});
}

// ── Season System ──────────────────────────────────
var _seasonData=null;
var _seasonTimerInterval=null;

function loadSeasonData(){
  fetch('/api/season/active').then(function(r){return r.json()}).then(function(d){
    _seasonData=d.season;
    if(_seasonData){
      showSeasonBanner(_seasonData);
      showSeasonTint(_seasonData);
      showSeasonGuide(_seasonData);
      try{ loadSeasonPass(); }catch(_e){}
    }
  }).catch(function(){});
}

// ── Tap/Click tracking for "Most Active" season category ──
var _tapCount=0;
var _tapTimer=null;
document.addEventListener('click',function(){
  _tapCount++;
  if(!_tapTimer){
    _tapTimer=_setActiveTimeout(function(){
      if(_tapCount>0&&walletState.address){
        fetch('/api/season/taps',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
          body:JSON.stringify({wallet:walletState.address,count:_tapCount})}).catch(function(){});
      }
      _tapCount=0;_tapTimer=null;
    },30000); // batch every 30s
  }
});
// Flush taps on page unload
window.addEventListener('beforeunload',function(){
  if(_tapCount>0&&walletState.address){
    navigator.sendBeacon('/api/season/taps',JSON.stringify({wallet:walletState.address,count:_tapCount}));
  }
});

// [v7.264 CRITICAL fix] 네비/UI data-action 위임 디스패처 — 누락 회귀 복구.
//   v7.215(239cc5e)에서 col-fab/상단바/모바일 네비 버튼을 inline onclick → data-action 으로
//   마이그(§19)했으나, 이 무인자(no-arg) 액션들을 실제 함수로 잇는 위임 리스너가 추가되지 않아
//   MY LAND/CANTINA/CLAIM/ITEMS/BASE 등 거의 모든 진입 버튼이 "클릭 무반응" 상태였다(브라우저 재현 확인).
//   인자형 액션(syRepairShip/siegeJoin/selectTargetFleet 등)은 별도 디스패처가 인자와 함께 처리하므로
//   여기서는 화이트리스트의 무인자 글로벌 함수만 호출 → 이중 호출/충돌 없음.
(function(){
  var NAV_NOARG_ACTIONS = {
    toggleMyLand:1, openArena:1, openBaseModal:1, openMyItems:1, activateLandSelect:1,
    openAuthModal:1, openPortfolioModal:1, openTelegramGroup:1, toggleLangDropdown:1,
    toggleLeaderboard:1, toggleDynastyView:1, toggleLeft:1, toggleRight:1,
    closeLeft:1, closeRight:1, closeAnnounce:1, startTutorial:1, nextTutStep:1,
    endTutorial:1, showRocketInfo:1, showLorePopup:1, copyRefCode:1, registerReferral:1,
    copyDepositAddr:1
  };
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if(!el) return;
    var act = el.getAttribute('data-action');
    if(!act || NAV_NOARG_ACTIONS[act] !== 1) return;       // 화이트리스트 외(인자형/동적)은 손대지 않음
    var fn = window[act];
    if(typeof fn !== 'function') return;
    if(el.disabled) return;
    ev.preventDefault(); ev.stopPropagation();
    try { fn(); } catch(e){ console.error('[NAV] '+act+' error:', e); }
  }, false);
})();

function toggleRankTable(){
  var wrap=document.getElementById('rankTableWrap');
  var tog=document.getElementById('rankTableToggle');
  if(!wrap)return;
  if(wrap.style.display==='none'){wrap.style.display='';tog.textContent='▲ HIDE';}
  else{wrap.style.display='none';tog.textContent='▼ SHOW';}
}
function toggleMySectors(){
  var wrap=document.getElementById('baseMySectors');
  var tog=document.getElementById('mySectorsToggle');
  if(!wrap)return;
  if(wrap.style.display==='none'){wrap.style.display='';tog.textContent='▲ HIDE';}
  else{wrap.style.display='none';tog.textContent='▼ SHOW';}
}

function showSeasonGuide(season){
  var guide=document.getElementById('seasonGuide');
  if(!season){
    // No active season — show placeholder
    document.getElementById('seasonGuideName').textContent=t('season_no_active');
    document.getElementById('seasonGuideTimer').textContent=t('season_check_back');
    document.getElementById('seasonScoreRules').innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);font-size:9px;padding:8px">'+t('season_activities_placeholder')+'</div>';
    return;
  }
  guide.style.display='';
  var themeNames={volcanic:t('season_theme_volcanic'),ice_age:t('season_theme_ice_age'),solar_storm:t('season_theme_solar_storm'),dust_epoch:t('season_theme_dust_epoch')};
  var themeDescs={
    volcanic:t('season_theme_volcanic_desc'),
    ice_age:t('season_theme_ice_age_desc'),
    solar_storm:t('season_theme_solar_storm_desc'),
    dust_epoch:t('season_theme_dust_epoch_desc')
  };
  document.getElementById('seasonGuideName').textContent=season.name+' — '+(themeNames[season.theme]||season.theme);
  var remaining=new Date(season.endsAt).getTime()-Date.now();
  var days=Math.floor(remaining/86400000);
  var hours=Math.floor((remaining%86400000)/3600000);
  document.getElementById('seasonGuideTimer').textContent=days>0?t('season_days_remaining').replace('{d}',days).replace('{h}',hours):t('season_ending_soon');

  // Score rules — show season's active categories (6 per season)
  var rules=document.getElementById('seasonScoreRules');
  var cats=season.activeCategories||[];
  rules.innerHTML='<div style="grid-column:1/-1;font-size:9px;color:var(--tx2);margin-bottom:4px;line-height:1.5">'+(themeDescs[season.theme]||t('season_default_desc'))+'</div>'+
    '<div style="grid-column:1/-1;font-size:8px;color:var(--gold);margin-bottom:2px">'+t('season_categories_title')+' ('+cats.length+')</div>'+
    cats.map(function(c){
    var catLabel = t('season_cat_'+c.key) !== 'season_cat_'+c.key ? t('season_cat_'+c.key) : (c.label||c.key);
    var catDesc = t('season_cat_'+c.key+'_d') !== 'season_cat_'+c.key+'_d' ? t('season_cat_'+c.key+'_d') : (c.desc||'');
    return '<div style="padding:8px 8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05)">'+
      '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><span style="font-size:14px">'+(c.icon||'🏆')+'</span>'+
      '<span style="font-size:9px;color:var(--tx);font-weight:700">'+catLabel+'</span></div>'+
      (catDesc ? '<div style="font-size:8px;color:var(--tx3);line-height:1.3">'+catDesc+'</div>' : '')+
      '</div>';
  }).join('');
}

function showSeasonBanner(season){
  var banner=document.getElementById('seasonBanner');
  if(!season){banner.style.display='none';return;}
  banner.style.display='';
  var themeIcons={volcanic:'🌋',ice_age:'❄️',solar_storm:'☀️',dust_epoch:'🌪️'};
  document.getElementById('seasonBannerIcon').textContent=themeIcons[season.theme]||'🌋';
  document.getElementById('seasonBannerName').textContent=season.name;
  // Start countdown timer
  if(_seasonTimerInterval) _clearActiveInterval(_seasonTimerInterval);
  function updateTimer(){
    var remaining=new Date(season.endsAt).getTime()-Date.now();
    if(remaining<=0){document.getElementById('seasonBannerTimer').textContent=t('season_ended');_clearActiveInterval(_seasonTimerInterval);return;}
    var d=Math.floor(remaining/86400000);
    var h=Math.floor((remaining%86400000)/3600000);
    var m=Math.floor((remaining%3600000)/60000);
    document.getElementById('seasonBannerTimer').textContent=d+'d '+h+'h '+m+'m';
  }
  updateTimer();
  _seasonTimerInterval=_setActiveInterval(updateTimer,60000);
}

function showSeasonTint(season){
  var overlay=document.getElementById('seasonTintOverlay');
  if(!season||!season.visualTint){overlay.style.display='none';return;}
  overlay.style.display='';
  overlay.style.background=season.visualTint;
}

// ═══════════════════════════════════════
//  SEASON PASS
// ═══════════════════════════════════════

function loadSeasonPass(){
  if(!walletState.address) return;
  fetch('/api/season/pass', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
    if(d.error) return;
    if(d.premiumCost) window._seasonPassCost=d.premiumCost;
    renderSeasonPass(d);
  }).catch(function(){});
}

function renderSeasonPass(data){
  var xpLabel=document.getElementById('seasonPassXPLabel');
  var tierLabel=document.getElementById('seasonPassTierLabel');
  var fill=document.getElementById('seasonPassXPFill');
  var premBtn=document.getElementById('seasonPassPremiumBtn');
  if(!xpLabel) return;

  xpLabel.textContent=data.xp+' XP';
  tierLabel.textContent='Tier '+data.currentTier+(data.isPremium?' ⭐':'');
  premBtn.style.display=data.isPremium?'none':'';

  // Find next tier XP requirement
  var tiers=data.tiers||[];
  var nextTier=tiers.find(function(t){return !t.is_premium && t.xp_required>data.xp});
  if(nextTier){
    var prevXp=data.currentTier>0?tiers.filter(function(t){return !t.is_premium&&t.tier===data.currentTier})[0]:{xp_required:0};
    var pXp=prevXp?prevXp.xp_required:0;
    var pct=Math.min(100,Math.round((data.xp-pXp)/(nextTier.xp_required-pXp)*100));
    fill.style.width=pct+'%';
  } else {
    fill.style.width='100%';
  }

  // Render tier nodes
  var box=document.getElementById('seasonPassTiers');
  var uniqueTiers={};
  tiers.forEach(function(t){ if(!uniqueTiers[t.tier]) uniqueTiers[t.tier]={free:null,premium:null}; if(t.is_premium) uniqueTiers[t.tier].premium=t; else uniqueTiers[t.tier].free=t; });

  var html='';
  Object.keys(uniqueTiers).sort(function(a,b){return a-b}).forEach(function(tierNum){
    var tt=uniqueTiers[tierNum];
    var free=tt.free||{};
    var prem=tt.premium||{};
    var unlocked=data.xp>=free.xp_required;
    var freeClaimed=free.claimed;
    var premClaimed=prem.claimed;

    var rewardIcon=free.reward_type==='pp'?'💎':free.reward_type==='gp'?'🪙':'🎁';
    var premIcon=prem.reward_type==='pp'?'💎':prem.reward_type==='gp'?'🪙':prem.reward_type==='item'?'📦':'🎁';
    var fmtAmt=function(amt,type){ var n=parseFloat(amt||0); if(type==='gp') return Math.floor(n); return n%1===0?n:n.toFixed(2); };
    var freeAmt=fmtAmt(free.reward_amount,free.reward_type);
    var premAmt=fmtAmt(prem.reward_amount,prem.reward_type);

    var bg=unlocked?(freeClaimed?'rgba(76,216,154,.08)':'rgba(255,209,102,.1)'):'rgba(255,255,255,.02)';
    var bdr=unlocked?(freeClaimed?'rgba(76,216,154,.3)':'rgba(255,209,102,.3)'):'rgba(255,255,255,.06)';

    html+='<div style="min-width:60px;padding:6px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';text-align:center;flex-shrink:0">'+
      '<div style="font-size:7px;color:var(--tx3)">Tier '+tierNum+'</div>'+
      // Free track
      '<div style="margin:3px 0">';
    if(freeClaimed){
      html+='<span style="font-size:9px;color:var(--gn)">✓</span>';
    } else if(unlocked){
      html+='<button onclick="claimPassTier('+tierNum+',false)" style="font-size:7px;padding:2px 6px;border-radius:3px;background:var(--gold);border:none;color:#000;cursor:pointer;font-weight:700">'+rewardIcon+' '+freeAmt+'</button>';
    } else {
      html+='<span style="font-size:8px;color:var(--tx3)">'+rewardIcon+' '+freeAmt+'</span>';
    }
    html+='</div>';
    // Premium track
    if(data.isPremium){
      html+='<div style="border-top:1px solid rgba(184,136,224,.15);padding-top:2px;margin-top:2px">';
      if(premClaimed){
        html+='<span style="font-size:9px;color:var(--gn)">✓</span>';
      } else if(unlocked){
        html+='<button onclick="claimPassTier('+tierNum+',true)" style="font-size:7px;padding:2px 6px;border-radius:3px;background:var(--pp);border:none;color:#fff;cursor:pointer;font-weight:700">'+premIcon+' '+premAmt+'</button>';
      } else {
        html+='<span style="font-size:8px;color:var(--tx3)">'+premIcon+' '+premAmt+'</span>';
      }
      html+='</div>';
    }
    html+='</div>';
  });
  box.innerHTML=html;
}

function claimPassTier(tier,isPremium){
  fetch('/api/season/pass/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,tier:tier,isPremium:isPremium})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert('🎁 Tier '+tier+' 보상 수령: '+d.label,'success');
    loadSeasonPass();
  }).catch(function(e){ showAlert(e.message); });
}

function purchaseSeasonPass(){
  var cost=window._seasonPassCost||500;
  var myGP=walletState.gameGP||0;
  var insufficient=myGP<cost;
  gameConfirm({
    title:t('season_pass_buy_title'),
    icon:'⭐',
    body:t('season_pass_buy_body'),
    info:[
      {k:t('season_pass_cost_label'),v:cost+' GP'},
      {k:t('season_pass_balance_label'),v:Math.floor(myGP)+' GP',insufficient:insufficient}
    ],
    confirmText:t('season_pass_buy_confirm'),
    disabled:insufficient
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/season/pass/purchase',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){ showAlert(d.error); return; }
      showAlert('⭐ '+t('season_pass_buy_title')+' OK!','success');
      loadSeasonPass();
    }).catch(function(e){ showAlert(e.message); });
  });
}

// ── Category Leaderboard (Migration 098) ──
var _currentCatLb = 'overall';
function switchCatLb(key, el) {
  _currentCatLb = key;
  document.querySelectorAll('.cat-lb-pill').forEach(function(p) {
    var isActive = p.id === 'catPill_' + key;
    p.style.background = isActive ? 'rgba(255,120,60,.15)' : 'rgba(91,184,232,.08)';
    p.style.borderColor = isActive ? 'rgba(255,120,60,.4)' : 'rgba(91,184,232,.25)';
    p.style.color = isActive ? 'var(--mars)' : 'var(--tx3)';
  });
  loadSeasonLeaderboard();
}

// Career stats toggle
var _careerStatsLoaded = false;
function toggleCareerStats() {
  var panel = document.getElementById('careerStatsPanel');
  var toggle = document.getElementById('careerStatsToggle');
  if (panel.style.display === 'none') {
    panel.style.display = '';
    toggle.textContent = '▲';
    if (!_careerStatsLoaded) loadCareerStats();
  } else { panel.style.display = 'none'; toggle.textContent = '▼'; }
}

async function loadCareerStats() {
  var w = walletState.address;
  var el = document.getElementById('careerStatsList');
  if (!w) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px" data-i18n="gp_activity_login">Login to view.</div>'; applyI18n(el); return; }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">...</div>';
  try {
    var r = await fetch('/api/stats/career', { headers: getAuthHeaders() });
    var d = await r.json();
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    var rows = [
      ['⚓ ' + (t('cat_naval') || 'Naval Wins'), d.battles.wins + ' W / ' + d.battles.losses + ' L', d.battles.wins > 0 ? 'var(--cyan)' : 'var(--tx3)'],
      ['⚗️ ' + (t('cat_enhance') || 'Enhancements'), d.enhancements.total + ' ('+d.enhancements.successRate+'%)', 'var(--gold)'],
      ['🚢 ' + (t('cat_ships') || 'Ships Built'), d.ships.built + '', 'var(--gn)'],
      ['🛒 ' + (t('cat_trades') || 'Trades'), d.trades.total + '', 'var(--pp)'],
      ['💰 GP in Battles', '+' + Math.floor(d.battles.gpWon) + ' GP', d.battles.gpWon > 0 ? 'var(--gn)' : 'var(--tx3)'],
      ['⚗️ GP on Enhance', Math.floor(d.enhancements.totalGP) + ' GP', 'var(--mars)']
    ];
    rows.forEach(function(row) {
      html += '<div style="padding:6px;background:rgba(255,255,255,.02);border:1px solid var(--bdr);border-radius:6px">' +
        '<div style="font-size:8px;color:var(--tx3);margin-bottom:2px">'+row[0]+'</div>' +
        '<div style="font-size:11px;color:'+row[2]+';font-family:var(--fn);font-weight:700">'+row[1]+'</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
    _careerStatsLoaded = true;
  } catch(e) { el.innerHTML = '<div style="color:var(--mars);font-size:9px;text-align:center">Failed to load</div>'; }
}

function loadSeasonLeaderboard(){
  var w=walletState.address||'';
  var el=document.getElementById('seasonLeaderboard');
  var labelEl=document.getElementById('catLbLabel');

  if(_currentCatLb!=='overall'){
    // Category leaderboard
    fetch('/api/season/category/'+encodeURIComponent(_currentCatLb)+'?limit=10')
      .then(function(r){return r.json()}).then(function(d){
        if(labelEl && d.category) labelEl.textContent = d.category.icon + ' ' + d.category.desc;
        document.getElementById('mySeasonRank').style.display='none';
        var entries=d.entries||[];
        if(!entries.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:10px">'+t('season_no_scores')+'</div>';return;}
        var medals=['🥇','🥈','🥉'];
        el.innerHTML=entries.map(function(p,i){
          var isMe=p.wallet===w;
          var medal=i<3?medals[i]:'';
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:2px;'+(isMe?'background:rgba(255,120,60,.08);border:1px solid rgba(255,120,60,.15)':'background:rgba(255,255,255,.01)')+'">'+
            '<span style="font-size:'+(i<3?'14px':'10px')+';min-width:24px;text-align:center">'+(medal||'<span style="color:var(--tx3);font-weight:700">#'+p.rank+'</span>')+'</span>'+
            '<div style="flex:1;min-width:0"><div style="font-size:10px;color:'+(isMe?'var(--mars)':'var(--tx)')+';font-weight:'+(isMe?'700':'400')+'">'+p.nickname+'</div></div>'+
            '<div style="font-size:11px;color:var(--gold);font-weight:700">'+p.value.toLocaleString()+'</div>'+
          '</div>';
        }).join('');
      }).catch(function(){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">Failed</div>';});
    return;
  }

  if(labelEl) labelEl.textContent='';
  fetch('/api/season/leaderboard?limit=20').then(function(r){return r.json()}).then(function(d){
    var lb=d.leaderboard||[];
    if(!lb.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:10px">'+t('season_no_scores')+'</div>';document.getElementById('mySeasonRank').style.display='none';return;}

    // Find my rank
    var myRankEl=document.getElementById('mySeasonRank');
    var myEntry=lb.find(function(p){return p.wallet===w});
    if(myEntry){
      myRankEl.style.display='';
      document.getElementById('mySeasonRankNum').textContent='#'+myEntry.rank;
      document.getElementById('mySeasonScore').textContent=myEntry.score.toLocaleString()+' '+t('season_pts_suffix')+' · '+myEntry.pixelsClaimed+'px · '+myEntry.harvests+'h · '+myEntry.hijacksWon+'hj';
    } else { myRankEl.style.display='none'; }

    var medals=['🥇','🥈','🥉'];
    el.innerHTML=lb.map(function(p,i){
      var isMe=p.wallet===w;
      var medal=i<3?medals[i]:'';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:2px;'+(isMe?'background:rgba(255,120,60,.08);border:1px solid rgba(255,120,60,.15)':'background:rgba(255,255,255,.01)')+'">'+
        '<span style="font-size:'+(i<3?'14px':'10px')+';min-width:24px;text-align:center">'+(medal||'<span style="color:var(--tx3);font-weight:700">#'+p.rank+'</span>')+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:10px;color:'+(isMe?'var(--mars)':'var(--tx)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:'+(isMe?'700':'400')+'">'+p.nickname+'</div>'+
        '<div style="font-size:7px;color:var(--tx3)">'+p.pixelsClaimed+'px · '+p.harvests+'h · '+p.hijacksWon+'hj</div></div>'+
        '<div style="font-size:11px;color:var(--gold);font-weight:700">'+p.score.toLocaleString()+'</div>'+
      '</div>';
    }).join('');
  }).catch(function(){});

  // Load my rewards
  if(w){
    fetch('/api/season/rewards', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
      var rewards=d.rewards||[];
      var sec=document.getElementById('seasonRewardsSection');
      var list=document.getElementById('seasonRewardsList');
      var unclaimed=rewards.filter(function(r){return !r.claimed});
      if(!unclaimed.length){sec.style.display='none';return;}
      sec.style.display='';
      list.innerHTML=unclaimed.map(function(r){
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,209,102,.04);border:1px solid rgba(255,209,102,.15);border-radius:6px;margin-bottom:4px">'+
          '<div style="flex:1"><div style="font-size:10px;color:var(--tx)">'+r.seasonName+' — '+t('season_rank_suffix')+' #'+r.rank+'</div>'+
          '<div style="font-size:9px;color:var(--gold)">'+r.amount+' '+r.type.toUpperCase()+'</div></div>'+
          '<button onclick="claimSeasonReward('+r.id+')" style="padding:4px 10px;border-radius:4px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.3);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn)">'+t('season_claim_btn')+'</button>'+
        '</div>';
      }).join('');
    }).catch(function(){});
  }
}

function claimSeasonReward(rewardId){
  var w=walletState.address;
  if(!w) return;
  fetch('/api/season/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,rewardId:rewardId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('season_claim_success').replace('{amount}',data.amount).replace('{type}',data.type.toUpperCase()),'success');
    loadSeasonLeaderboard();
    try{ refreshEmailBalances(); }catch(_re){}
  }).catch(function(){showToast(t('season_claim_failed'),'error')});
}

function loadBaseData(){
  // Use walletState.address, fallback to JWT token wallet
  var w=walletState.address||null;
  if(!w&&emailAuth.token){
    try{
      var payload=JSON.parse(atob(emailAuth.token.split('.')[1]));
      if(payload.wallet){w=payload.wallet;walletState.address=w;walletState.connected=true;}
    }catch(e){}
  }

  // Load sectors (with wallet for "my pixels" count)
  fetch('/api/sectors', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(data){
    _sectorsData=data;
    renderSectorList(data);
    drawSectorBoundaries();
  }).catch(function(){});

  // Load ranks
  fetch('/api/ranks', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(data){
    _ranksData=data;
    renderRankTable(data);
  }).catch(function(){});

  // Load Fleet Command card (M-154 — MY TERRITORY 카드: 함대 요약 + Void Raider 이벤트)
  try { if (typeof loadFleetCommandCard === 'function') loadFleetCommandCard(); } catch(_){}

  // Load user data if logged in
  if(w){
    fetch('/api/user/'+encodeURIComponent(w)+'/base').then(function(r){return r.json()}).then(function(data){
      _baseUserData=data;
      renderBaseUser(data);
    }).catch(function(e){console.error('[BASE] Failed to load user data:', e)});

    // Load quests
    loadQuests(w);
  }
}

var _prevUserRank=0;
function renderBaseUser(data){
  if(!data||!data.user) return;
  var u=data.user;
  // Detect rank up
  if(_prevUserRank>0&&u.rank>_prevUserRank){
    try{_sfx.levelUp()}catch(e){}
    showNotification('system',t('rank_up_title'),t('rank_up_msg').replace('{n}',u.rank));
  }
  _prevUserRank=u.rank;
  document.getElementById('baseTotalPx').textContent=data.territory.totalPixels.toLocaleString();
  document.getElementById('baseUsdt').textContent=u.usdt.toFixed(2);
  document.getElementById('basePP').textContent=u.pp.toFixed(2);
  var gpEl=document.getElementById('baseGP');
  if(gpEl) gpEl.textContent=(u.gp||0).toLocaleString();

  // Rank info (Season tab compact + Profile card)
  var rank=_ranksData.find(function(r){return r.level===u.rank})||{name:'Dust Walker',requiredXp:0};
  var nextRank=_ranksData.find(function(r){return r.level===u.rank+1});
  var xpPct=0;
  if(nextRank){
    xpPct=Math.min(100,Math.max(0,((u.xp-rank.requiredXp)/(nextRank.requiredXp-rank.requiredXp))*100));
  }else{xpPct=100;}

  // Season tab level (compact)
  var rl=document.getElementById('baseRankLevel');if(rl)rl.textContent=u.rank;
  var rn=document.getElementById('baseRankName');if(rn)rn.textContent=rank.name;
  var xc=document.getElementById('baseXpCurrent');if(xc)xc.textContent=u.xp+' XP';
  var xn=document.getElementById('baseXpNext');if(xn)xn.textContent=nextRank?nextRank.requiredXp+' XP':t('max_level');
  var rb=document.getElementById('baseRankBar');if(rb)rb.style.width=xpPct+'%';

  // Profile level card (MY TERRITORY tab)
  var plb=document.getElementById('profileLevelBadge');if(plb)plb.textContent=u.rank;
  var pl=document.getElementById('profileLevel');if(pl)pl.textContent=u.rank;
  var pn=document.getElementById('profileNickname');if(pn)pn.textContent=u.nickname||u.wallet.slice(0,8)+'...';
  var prn=document.getElementById('profileRankName');if(prn)prn.textContent=rank.name;
  var pxc=document.getElementById('profileXpCurrent');if(pxc)pxc.textContent=u.xp+' XP';
  var pxn=document.getElementById('profileXpNext');if(pxn)pxn.textContent=nextRank?t('xp_next').replace('{n}',nextRank.requiredXp):t('max_level');
  var pxb=document.getElementById('profileXpBar');if(pxb)pxb.style.width=xpPct+'%';

  // ACCOUNT modal hero — level + xp + rank title
  var pxLv=document.getElementById('profileXpLv');if(pxLv)pxLv.textContent=u.rank;
  var pxFill=document.getElementById('profileXpFill');if(pxFill)pxFill.style.width=xpPct+'%';
  var pxVal=document.getElementById('profileXpVal');if(pxVal)pxVal.textContent=(nextRank?(u.xp+'/'+nextRank.requiredXp):(u.xp+' XP'));
  var pRankTitle=document.getElementById('profileRankTitle');if(pRankTitle)pRankTitle.textContent=rank.name;
  // Pixels owned + joined days
  try{
    var pxCnt=document.getElementById('profilePxCount');
    if(pxCnt && data.territory) pxCnt.textContent=(data.territory.totalPixels||0).toLocaleString();
    var jDays=document.getElementById('profileJoinedDays');
    if(jDays && u.joinedAt){
      var d=Math.floor((Date.now()-new Date(u.joinedAt).getTime())/(24*3600*1000));
      jDays.textContent=(isFinite(d)&&d>=0?d:0);
    }
  }catch(_ej){}
  // Guild chip (from _myGuildData if set)
  try{
    var gChip=document.getElementById('profileGuildChip');
    var gName=document.getElementById('profileGuildName');
    if(gChip && gName){
      if(typeof _myGuildData!=='undefined' && _myGuildData && _myGuildData.name){
        gName.textContent=(_myGuildData.tag?('['+_myGuildData.tag+'] '):'')+_myGuildData.name;
        gChip.style.display='';
      }else{
        gChip.style.display='none';
      }
    }
  }catch(_eg){}

  // Highlight current rank in table
  document.querySelectorAll('.rank-table tbody tr').forEach(function(tr){
    tr.classList.toggle('current',parseInt(tr.dataset.level)===u.rank);
  });

  // My sectors
  var mySec=document.getElementById('baseMySectors');
  if(data.territory.bySector.length===0){
    mySec.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px 0">'+t('no_sectors_yet')+'</div>';
  }else{
    var html='<div class="sector-list">';
    data.territory.bySector.forEach(function(s){
      html+='<div class="sector-item" onclick="focusSector('+s.sectorId+')">';
      html+='<span class="si-tier '+s.tier+'">'+s.tier.toUpperCase()+'</span>';
      html+='<span class="si-name">'+s.sectorName+'</span>';
      html+='<span class="si-price" style="color:var(--gold)">'+s.pixels+' px</span>';
      html+='</div>';
    });
    html+='</div>';
    mySec.innerHTML=html;
  }

  // Mining
  if(data.mining){
    document.getElementById('baseMineTotalMined').textContent=data.mining.totalMined.toFixed(2);

    // Show estimated harvest range on button
    var hBtn=document.getElementById('baseHarvestBtn');
    var iBtn=document.getElementById('baseInstantHarvestBtn');
    window._miningEstMin=data.mining.estimatedMin||0;
    window._miningEstMax=data.mining.estimatedMax||0;
    window._instantHarvestCost=data.mining.instantCost||0.5;
    var rangeStr='';
    if(window._miningEstMin>0){
      rangeStr=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
    }
    if(data.mining.harvestAvailable){
      document.getElementById('baseMineTimer').textContent=t('harvest_available');
      document.getElementById('baseMineAvail').textContent=t('harvest_ready');
      hBtn.disabled=false;
      hBtn.innerHTML='<span>'+t('harvest_pp')+rangeStr+'</span>';
      iBtn.style.display='none';
    }else if(data.mining.nextHarvestAt){
      startMineTimer(new Date(data.mining.nextHarvestAt));
      document.getElementById('baseMineAvail').textContent='0.00';
      hBtn.disabled=true;
      hBtn.innerHTML='<span>'+t('harvest_pp')+'</span>';
      // Show instant harvest with real cost
      iBtn.innerHTML='<span>'+t('harvest_now').replace('{cost}',window._instantHarvestCost)+'</span>';
    }else if(data.territory.totalPixels===0){
      document.getElementById('baseMineTimer').textContent=t('claim_to_mine');
      document.getElementById('baseMineAvail').textContent='--';
      hBtn.disabled=true;
      hBtn.innerHTML='<span>'+t('harvest_pp')+'</span>';
      iBtn.style.display='none';
    }
  }

  // Mining rates from server
  if(data.miningRates){
    var mr=data.miningRates;
    var bestInt=data.miningInterval.best||72;
    var ratesHtml='';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_reward_range')+'</span><span class="stat-val" style="font-size:10px">'+mr.rewardMin+' ~ '+mr.rewardMax+' PP</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_interval')+'</span><span class="stat-val" style="font-size:10px;color:var(--cyan)">'+bestInt+'h</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_core')+'</span><span class="stat-val" style="font-size:10px;color:var(--red)">×'+mr.coreMult+'</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_mid')+'</span><span class="stat-val" style="font-size:10px;color:var(--gold)">×'+mr.midMult+'</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_frontier')+'</span><span class="stat-val" style="font-size:10px;color:var(--gn)">×'+mr.frontierMult+'</span></div>';
    document.getElementById('baseMineRates').innerHTML=ratesHtml;
  }

  // ── Mineral Drop 정보 표시 ──
  (function renderMineralDrops(){
    var dropEl=document.getElementById('baseMineralDrops');
    if(!dropEl) return;
    // 유저가 보유한 구역 파악
    var tc=(data.territory&&data.territory.tierCounts)||{};
    var hasCore=tc.core>0, hasMid=tc.mid>0, hasFrontier=(tc.frontier||0)>0||(data.territory&&data.territory.totalPixels>0&&!hasCore&&!hasMid);

    // 구역별 광물 드롭 테이블 (migration 164 기준)
    var DROPS={
      frontier:[
        {code:'iron_ore',   icon:'🪨', name:{en:'Iron Ore',    ko:'철광석',    ja:'鉄鉱石',   zh:'铁矿石'},   rate:30},
        {code:'carbon_fiber',icon:'🖤',name:{en:'Carbon Fiber',ko:'탄소섬유', ja:'炭素繊維',  zh:'碳纤维'},   rate:20},
        {code:'silicon_chip',icon:'💎',name:{en:'Silicon Chip',ko:'실리콘칩', ja:'シリコンチップ',zh:'硅芯片'}, rate:10},
      ],
      mid:[
        {code:'titanium_alloy', icon:'⚙️', name:{en:'Titanium Alloy',  ko:'티타늄합금',  ja:'チタン合金',    zh:'钛合金'},    rate:20},
        {code:'plasma_crystal', icon:'🔷', name:{en:'Plasma Crystal',  ko:'플라즈마크리스탈', ja:'プラズマクリスタル',zh:'等离子晶体'}, rate:15},
        {code:'nano_polymer',   icon:'🧬', name:{en:'Nano Polymer',    ko:'나노폴리머',  ja:'ナノポリマー',   zh:'纳米聚合物'}, rate:15},
      ],
      core:[
        {code:'dark_matter',  icon:'🌑', name:{en:'Dark Matter',   ko:'암흑물질',   ja:'暗黒物質',    zh:'暗物质'},    rate:15},
        {code:'quantum_core', icon:'⚡', name:{en:'Quantum Core',  ko:'양자코어',   ja:'量子コア',    zh:'量子核心'},  rate:12},
        {code:'exotic_alloy', icon:'🌟', name:{en:'Exotic Alloy',  ko:'이국합금',   ja:'異国合金',    zh:'异星合金'},  rate:10},
      ]
    };
    var lang=(window.currentLang||'en').toLowerCase();
    var html='';

    function renderZoneDrops(zoneKey, zoneLabel, zoneColor, hasTiles){
      var drops=DROPS[zoneKey];
      var opacity=hasTiles?'1':'0.35';
      var noLand=hasTiles?'':' <span style="font-size:8px;color:var(--tx3)">(no land)</span>';
      html+='<div style="margin-top:6px;opacity:'+opacity+'">';
      html+='<div style="font-size:9px;font-weight:700;color:'+zoneColor+';letter-spacing:1px;margin-bottom:2px">'+zoneLabel+noLand+'</div>';
      drops.forEach(function(d){
        var name=d.name[lang]||d.name.en;
        html+='<div class="stat-row" style="padding:1px 0">';
        html+='<span class="stat-label" style="display:flex;align-items:center;gap:4px">'+d.icon+' '+name+'</span>';
        html+='<span class="stat-val" style="font-size:10px;color:var(--tx2)">'+d.rate+'%</span>';
        html+='</div>';
      });
      html+='</div>';
    }

    renderZoneDrops('frontier','FRONTIER','var(--gn)', hasFrontier);
    renderZoneDrops('mid',     'MID ZONE','var(--gold)',hasMid);
    renderZoneDrops('core',    'CORE',    'var(--red)', hasCore);

    html+='<div style="font-size:8px;color:var(--tx3);margin-top:8px;line-height:1.7;padding:6px 0;border-top:1px solid var(--bdr)">⛏ '+(lang==='ko'?'채굴 시 PP와 함께 광물이 확률적으로 드롭됩니다.<br>광물은 함선 건조와 마켓에 사용됩니다.':lang==='ja'?'採掘時にPPとともに鉱物がランダムでドロップされます。<br>鉱物は艦船建造とマーケットで使用されます。':lang==='zh'?'采矿时PP和矿物会随机掉落。<br>矿物用于舰船建造和市场交易。':'Mining yields PP and random mineral drops.<br>Minerals are used in ship construction and the marketplace.')+'</div>';
    dropEl.innerHTML=html;
  })();

  // ✅ [Job System] Load job card after base data renders
  var jw = walletState && walletState.address ? walletState.address : null;
  if(jw && u.rank >= 1) loadUserJob(jw, u.rank);
}

// ══════════════════════════════════════════════════════
// JOB SYSTEM — Phase 1 Frontend
// ══════════════════════════════════════════════════════
var _jobData = null; // current user's job data
var _allJobs = [];   // all available jobs
var _selectedJobCode = null; // selection in modal

// Server (getMyJob) returns a flat shape: { has_job, job_code, job_name_ko,
// job_name_en, icon_emoji, color_hex, description_ko, buffs:[{buff_key,buff_value}],
// weekly_changes, weekly_free_limit, can_change_free, on_cooldown,
// cooldown_remaining_hours, changed_at, change_cost_gp }.
// The UI (renderJobCard, job modal selection logic) expects a nested shape:
// { job:{code,name,icon_emoji,color_hex}, buffs:{key:mult}, changeStatus:{...} }.
// This adapter bridges the two so updates after job selection actually render.
function _transformJobData(raw, lang){
  if(!raw || raw.error) return { job:null, buffs:{}, changeStatus:{} };
  lang = (lang||'en').toLowerCase();
  var job = null;
  if(raw.has_job && raw.job_code){
    var nameLocalized = raw['job_name_'+lang] || raw.job_name_en || raw.job_name_ko || raw.job_code;
    job = {
      code: raw.job_code,
      name: nameLocalized,
      name_en: raw.job_name_en,
      name_ko: raw.job_name_ko,
      icon_emoji: raw.icon_emoji || '⚔️',
      color_hex: raw.color_hex || '#f0c840',
      description: raw['description_'+lang] || raw.description_ko || '',
    };
  }
  // buffs: array of {buff_key, buff_value} → object {key: multiplier}
  var buffs = {};
  if(Array.isArray(raw.buffs)){
    raw.buffs.forEach(function(b){
      if(b && b.buff_key) buffs[b.buff_key] = parseFloat(b.buff_value);
    });
  } else if(raw.buffs && typeof raw.buffs === 'object'){
    Object.keys(raw.buffs).forEach(function(k){ buffs[k] = parseFloat(raw.buffs[k]); });
  }
  // changeStatus: flat → nested
  var cooldownEndsAt = null;
  if(raw.on_cooldown && raw.changed_at){
    var base = new Date(raw.changed_at).getTime();
    cooldownEndsAt = new Date(base + (raw.cooldown_remaining_hours||0)*3600000).toISOString();
  }
  var freeLeft = Math.max(0, (raw.weekly_free_limit||0) - (raw.weekly_changes||0));
  var changeStatus = {
    canChangeFree: !!raw.can_change_free,
    freeChangesLeft: freeLeft,
    paidCostGp: raw.change_cost_gp || 0,
    cooldownEndsAt: cooldownEndsAt,
  };
  return { job: job, buffs: buffs, changeStatus: changeStatus, raw: raw };
}

function loadUserJob(wallet, rank){
  if(!wallet) return;
  var lang = (window.LANG || window._lang || 'en');
  fetch('/api/user/job?lang='+lang, { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(raw){
      var data = _transformJobData(raw, lang);
      _jobData = data;
      renderJobCard(data, rank);
      // If level >= required and no job: show modal (only once per session)
      if(rank >= 5 && !data.job && !sessionStorage.getItem('jobModalShown')){
        sessionStorage.setItem('jobModalShown','1');
        setTimeout(function(){ openJobSelectModal(); }, 1200);
      }
    }).catch(function(){});
}

function renderJobCard(data, rank){
  var card = document.getElementById('jobCardMini');
  if(!card) return;
  var requiredLevel = 5; // matches settings job_required_level default

  // Show card only if level >= 1 (always visible as a prompt or status)
  card.style.display = '';

  var icon = document.getElementById('jobCardIcon');
  var name = document.getElementById('jobCardName');
  var buffs = document.getElementById('jobCardBuffs');
  var btn = document.getElementById('jobCardBtn');
  var status = document.getElementById('jobCardChangeStatus');

  if(data && data.job){
    // Has a job
    card.classList.remove('no-job','job-choose-pulse');
    card.style.borderColor = data.job.color_hex ? data.job.color_hex+'55' : 'rgba(255,255,255,.15)';
    if(icon) icon.textContent = data.job.icon_emoji || '⚔️';
    if(name){ name.textContent = data.job.name; name.style.color = data.job.color_hex || 'var(--tx)'; }

    // Show top 3 positive buffs
    if(buffs && data.buffs){
      var pills = [];
      Object.entries(data.buffs).forEach(function(e){
        if(e[1] > 1.0) pills.push('<span class="job-buff-pill" style="background:rgba(100,220,100,.1);color:#6dc86d">+'+Math.round((e[1]-1)*100)+'% '+_buffLabelShort(e[0])+'</span>');
      });
      buffs.innerHTML = pills.slice(0,3).join('');
    }

    if(btn) btn.textContent = t('job_change_btn');

    // Change status
    if(status && data.changeStatus){
      var cs = data.changeStatus;
      status.style.display = '';
      if(cs.cooldownEndsAt){
        var d = new Date(cs.cooldownEndsAt);
        status.textContent = t('job_cooldown').replace('{t}', d.toLocaleDateString());
        status.style.color = 'var(--red)';
      } else if(cs.canChangeFree){
        status.textContent = t('job_free_change').replace('{n}', cs.freeChangesLeft);
        status.style.color = 'var(--gn)';
      } else {
        status.textContent = t('job_paid_change').replace('{n}', cs.paidCostGp);
        status.style.color = 'var(--gold)';
      }
    }
  } else {
    // No job
    card.classList.add('no-job');
    if(rank >= requiredLevel) card.classList.add('job-choose-pulse');
    else card.classList.remove('job-choose-pulse');
    if(icon) icon.textContent = '❓';
    if(name){ name.textContent = rank >= requiredLevel ? t('job_none') : t('job_locked').replace('{n}', requiredLevel); name.style.color = rank >= requiredLevel ? 'var(--gold)' : 'var(--tx3)'; }
    if(buffs) buffs.innerHTML = '';
    if(btn) btn.textContent = rank >= requiredLevel ? t('job_choose_btn') : '';
    if(status) status.style.display = 'none';
  }
}

function _buffLabelShort(key){
  var m = {
    miner_mining_rate:'MINE', miner_harvest_speed:'HARVEST', miner_poi_reward:'POI',
    warrior_combat_power:'COMBAT', warrior_hijack_success:'HIJACK', warrior_defense_item_effect:'DEF',
    crafter_enhancement_success:'ENHANCE', crafter_enhancement_cost:'COST', crafter_enhancement_break_protection:'BREAK',
    merchant_market_fee:'FEE', merchant_listing_limit:'LISTING', merchant_price_history_days:'HISTORY'
  };
  return m[key] || key.split('_').slice(-1)[0].toUpperCase();
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING TUTORIAL SYSTEM (Migration 083 — MASTER_PLAN Phase 3)
// ══════════════════════════════════════════════════════════════
var _obState = null; // cached onboarding state from server

async function initOnboarding(wallet) {
  if (!wallet) return;
  try {
    var _obTok = localStorage.getItem('pw_token');
    var _obHdrs = _obTok ? {'Authorization':'Bearer '+_obTok} : {};
    var r = await fetch('/api/onboarding', {headers: _obHdrs});
    if (!r.ok) return;
    var state = await r.json();
    _obState = state;
    if (!state.enabled || state.completed || state.skipped) return;
    // Show onboarding for incomplete users
    var step = state.currentStep || 0;
    if (step === 0) {
      // Brand new user — show step 1 intro
      setTimeout(function() { showOnboardingStep(1); }, 800);
    } else if (step < 5) {
      // Returning mid-onboarding user — show resume prompt
      setTimeout(function() { showOnboardingStep(step + 1); }, 800);
    }
  } catch (e) { /* non-critical */ }
}

function _obSetDots(activeStep) {
  for (var i = 1; i <= 5; i++) {
    var dot = document.getElementById('obDot' + i);
    if (!dot) continue;
    dot.className = 'ob-dot';
    if (i < activeStep) dot.classList.add('done');
    else if (i === activeStep) dot.classList.add('active');
  }
}

var _OB_STEPS = {
  1: {
    emoji: '🚀',
    title_en: 'CLAIM YOUR FIRST TERRITORY',
    title_ko: '첫 영토를 점령하세요',
    body_en: '<b>Mars starts with one small claim.</b><br>Tap any red zone on the map and plant your flag on your first territory.<br><br>⭐ Your first claim is <b>FREE</b> — no PP required.',
    body_ko: '<b>화성의 시작은 작은 영토 하나입니다.</b><br>지도의 빨간 영역을 탭해 첫 영토에 깃발을 세우세요.<br><br>⭐ 첫 번째 클레임은 <b>무료</b>입니다 — PP가 필요 없습니다.',
    next_en: 'GOT IT — SHOW ME THE MAP',
    next_ko: '알겠어요 — 지도 보기'
  },
  2: {
    emoji: '⛏️',
    title_en: 'HARVEST FROM YOUR TERRITORY',
    title_ko: '영토에서 수확하세요',
    body_en: 'Your territory generates <b>PP</b> over time.<br><br>→ Tap <b>[HARVEST]</b> to collect it.<br>→ PP is the fuel for expansion, ships, and growth.',
    body_ko: '영토에서는 시간이 지나면 <b>PP</b>가 생성됩니다.<br><br>→ <b>[수확하기]</b>를 눌러 회수하세요.<br>→ PP는 확장, 함선, 성장의 연료입니다.',
    next_en: 'UNDERSTOOD',
    next_ko: '이해했어요'
  },
  3: {
    emoji: '🚢',
    title_en: 'BUILD YOUR FIRST FLEET',
    title_ko: '첫 함대 준비하기',
    body_en: 'Territory growth leads to combat power.<br><br>Use your resources to prepare ships, organize a fleet, and get ready to defend what you own.',
    body_ko: '영토 성장은 전력으로 이어집니다.<br><br>자원을 모아 함선을 준비하고, 함대를 구성해 당신의 영토를 지킬 준비를 하세요.',
    next_en: 'NEXT',
    next_ko: '다음'
  },
  4: {
    emoji: '⚔️',
    title_en: 'FOLLOW YOUR FIRST MISSION',
    title_ko: '첫 임무를 따라가세요',
    body_en: 'Your next objective lives in <b>Campaign</b>.<br><br>Follow the mission steps to learn the core loop: claim territory, harvest, and push toward conflict.',
    body_ko: '다음 목표는 <b>캠페인</b>에 있습니다.<br><br>임무 순서를 따라가며 영토 확보, 수확, 그리고 첫 분쟁까지 핵심 루프를 익히세요.',
    next_en: 'NEXT',
    next_ko: '다음'
  },
  5: {
    emoji: '🎯',
    title_en: 'READY TO EXPAND',
    title_ko: '이제 확장할 시간입니다',
    body_en: 'You now know the core loop.<br><br><b>Claim territory → Harvest resources → Build your fleet → Follow missions</b><br><br>Take your starter reward and begin expanding on Mars.',
    body_ko: '이제 핵심 루프를 이해했습니다.<br><br><b>영토 확보 → 자원 수확 → 함대 준비 → 임무 진행</b><br><br>시작 보상을 받고 화성에서 세력을 확장하세요.',
    next_en: '🎉 CLAIM REWARD',
    next_ko: '🎉 보상 수령'
  }
};

function _obStepContent(step) {
  var lang = (typeof _lang !== 'undefined' ? _lang : 'en') || 'en';
  var s = _OB_STEPS[step];
  if (!s) return '';
  var title = s['title_' + lang] || s.title_en;
  var body  = s['body_'  + lang] || s.body_en;
  var next  = s['next_'  + lang] || s.next_en;
  var rewardHtml = '';
  if (step === 5 && _obState && _obState.rewards) {
    var r = _obState.rewards;
    rewardHtml = '<div class="ob-reward-row">'
      + (r.pp  ? '<div class="ob-reward-chip">🟣 ' + r.pp  + ' PP</div>'  : '')
      + (r.gp  ? '<div class="ob-reward-chip">🟡 ' + r.gp  + ' GP</div>'  : '')
      + (r.xp  ? '<div class="ob-reward-chip">⚡ ' + r.xp  + ' XP</div>'  : '')
      + '</div>';
  }
  var skipBtn = (_obState && _obState.skipAllowed && step < 5)
    ? '<button class="ob-btn-skip" onclick="obSkip()">SKIP</button>'
    : '';
  return '<div class="ob-emoji">' + s.emoji + '</div>'
    + '<div class="ob-title">' + title + '</div>'
    + '<div class="ob-sub">' + body + '</div>'
    + rewardHtml
    + '<div class="ob-actions">'
    + skipBtn
    + '<button class="ob-btn-next" onclick="obNextStep(' + step + ')">' + next + '</button>'
    + '</div>';
}

function showOnboardingStep(step) {
  var ov = document.getElementById('obOverlay');
  var ct = document.getElementById('obContent');
  if (!ov || !ct) return;
  _obSetDots(step);
  ct.innerHTML = _obStepContent(step);
  ov.style.display = 'flex';
}

async function obNextStep(currentStep) {
  var wallet = walletState && walletState.address;
  if (!wallet) return;

  // Step 5 = final step → claim reward
  if (currentStep === 5) {
    try {
      var _obTok2 = localStorage.getItem('pw_token');
      var r = await fetch('/api/onboarding/reward', {
        method: 'POST',
        headers: Object.assign({'Content-Type':'application/json'}, _obTok2 ? {'Authorization':'Bearer '+_obTok2} : {}),
        body: JSON.stringify({ wallet: wallet })
      });
      var d = await r.json();
      if (d.ok) {
        document.getElementById('obOverlay').style.display = 'none';
        showToast('🎉 ' + (d.rewards.pp || 0) + ' PP + ' + (d.rewards.gp || 0) + ' GP '+(LANG==='ko'?'보상 지급!':LANG==='ja'?'報酬付与！':LANG==='zh'?'奖励发放！':'reward granted!'));
        try { refreshEmailBalances(); } catch(e) {}
        return;
      }
      if (d.error === 'already_claimed') {
        document.getElementById('obOverlay').style.display = 'none'; return;
      }
    } catch(e) {}
    document.getElementById('obOverlay').style.display = 'none';
    return;
  }

  // Steps 1~4 → mark complete + advance
  var next = currentStep + 1;
  try {
    var _obTok3 = localStorage.getItem('pw_token');
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok3 ? {'Authorization':'Bearer '+_obTok3} : {}),
      body: JSON.stringify({ wallet: wallet, step: currentStep })
    });
  } catch(e) {}

  // Step 1 → hide overlay so user can interact with map
  if (currentStep === 1) {
    document.getElementById('obOverlay').style.display = 'none';
    showToast(LANG==='ko'?'👆 영토를 탭해서 첫 클레임을 시작하세요!':LANG==='ja'?'👆 領土をタップして最初のクレームを開始してください！':LANG==='zh'?'👆 点击领地开始您的第一次占领！':'👆 Tap territory to start your first claim!');
    return;
  }

  // Steps 2~4 → show next step
  if (_obState) _obState.currentStep = currentStep;
  showOnboardingStep(next);
}

async function obSkip() {
  var wallet = walletState && walletState.address;
  if (!wallet) return;
  try {
    var _obTok4 = localStorage.getItem('pw_token');
    await fetch('/api/onboarding/skip', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok4 ? {'Authorization':'Bearer '+_obTok4} : {}),
      body: JSON.stringify({ wallet: wallet })
    });
  } catch(e) {}
  document.getElementById('obOverlay').style.display = 'none';
  _obState = null;
}

// Called from claim success handler when tutorialFreeClaim = true
function onTutorialClaimSuccess() {
  // Mark step 1 done (backend already did it), show step 2
  try {
    var _obTok5 = localStorage.getItem('pw_token');
    fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok5 ? {'Authorization':'Bearer '+_obTok5} : {}),
      body: JSON.stringify({ wallet: walletState.address, step: 1 })
    });
  } catch(e) {}
  if (_obState) _obState.currentStep = 1;
  setTimeout(function() { showOnboardingStep(2); }, 400);
}
// ══════════════════════════════════════════════════════════════
// END ONBOARDING SYSTEM
// ══════════════════════════════════════════════════════════════

function openJobSelectModal(){
  if(!walletState||!walletState.address) return;
  var modal = document.getElementById('jobSelectModal');
  if(!modal) return;
  _selectedJobCode = null;
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.style.opacity='.5'; }

  var costInfo = document.getElementById('jobModalCostInfo');
  if(costInfo) costInfo.style.display='none';
  var selInfo = document.getElementById('jobModalSelectedInfo');
  if(selInfo) selInfo.style.display='none';

  // Close button always visible (was hidden for new users — UX friction)
  var cancelBtn = document.getElementById('jobModalCancelBtn');
  if(cancelBtn) cancelBtn.style.display = '';

  modal.style.display = 'flex';

  var lang = window.LANG || window._lang || 'en';
  fetch('/api/jobs?lang='+lang)
    .then(function(r){return r.json()})
    .then(function(d){
      _allJobs = d.jobs || [];
      renderJobChoiceGrid();
    }).catch(function(){});
}

// Normalize raw API job object (API returns name_ko/name_en/buff_key/buff_value) → UI shape
function _normalizeJob(job){
  if(!job) return null;
  var lang = (window.LANG || window._lang || window._currentLang || 'en').toLowerCase();
  var name = job['name_'+lang] || job.name_en || job.name_ko || job.code;
  var desc = job['description_'+lang] || job.description_en || job.description_ko || '';
  var rawBuffs = job.buffs || [];
  var buffs = rawBuffs.map(function(b){
    var key = b.buff_key || b.key;
    var val = (b.buff_value !== undefined) ? parseFloat(b.buff_value) : b.value;
    return { key:key, value:val, description:b.description||'' };
  });
  return Object.assign({}, job, { name:name, description:desc, buffs:buffs });
}

function renderJobChoiceGrid(){
  var grid = document.getElementById('jobChoiceGrid');
  if(!grid) return;
  var html = '';
  _allJobs.forEach(function(rawJob){
    var job = _normalizeJob(rawJob);
    var isCurrent = _jobData && _jobData.job && _jobData.job.code === job.code;
    var posBuffs = (job.buffs||[]).filter(function(b){return b.value>1.0;});
    var negBuffs = (job.buffs||[]).filter(function(b){return b.value<1.0;});
    html += '<div class="job-choice-card'+(isCurrent?' selected':'')+'"';
    html += ' style="--jc:'+job.color_hex+'"';
    html += ' onclick="selectJobCard(\''+job.code+'\',this)">';
    html += '<div class="job-choice-icon">'+job.icon_emoji+'</div>';
    html += '<div class="job-choice-name" style="color:'+job.color_hex+'">'+job.name+'</div>';
    if(isCurrent) html += '<div style="font-size:8px;color:var(--gn);margin-bottom:4px">✓ '+t('job_current')+'</div>';
    html += '<div class="job-choice-buff">';
    posBuffs.slice(0,2).forEach(function(b){
      html += '<span class="job-buff-pill" style="background:rgba(100,220,100,.12);color:#6dc86d">+'+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key)+'</span>';
    });
    negBuffs.slice(0,1).forEach(function(b){
      html += '<span class="job-buff-pill" style="background:rgba(232,72,85,.1);color:var(--red)">'+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key)+'</span>';
    });
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function selectJobCard(jobCode, el){
  _selectedJobCode = jobCode;
  document.querySelectorAll('.job-choice-card').forEach(function(c){ c.classList.remove('selected'); });
  el.classList.add('selected');

  var rawJob = _allJobs.find(function(j){return j.code===jobCode;});
  var job = _normalizeJob(rawJob);
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=false; confirmBtn.style.opacity='1'; }

  // Show cost info if changing (not first selection)
  var costInfo = document.getElementById('jobModalCostInfo');
  var selInfo = document.getElementById('jobModalSelectedInfo');
  if(_jobData && _jobData.job && _jobData.job.code !== jobCode){
    var cs = _jobData.changeStatus || {};
    if(costInfo){
      costInfo.style.display = '';
      if(cs.cooldownEndsAt){
        costInfo.textContent = t('job_modal_cooldown_warn');
        if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.style.opacity='.5'; }
      } else if(cs.canChangeFree){
        costInfo.textContent = t('job_modal_free').replace('{n}', cs.freeChangesLeft);
      } else {
        costInfo.textContent = t('job_modal_paid').replace('{n}', cs.paidCostGp);
      }
    }
  } else if(costInfo) {
    costInfo.style.display = 'none';
  }

  if(selInfo && job){
    selInfo.style.display = '';
    var allBuffs = (job.buffs||[]).map(function(b){
      var sign = b.value>=1?'+':'';
      return sign+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key);
    }).join(' · ');
    selInfo.textContent = job.name + ': ' + allBuffs;
  }
}

function closeJobSelectModal(){
  var modal = document.getElementById('jobSelectModal');
  if(modal) modal.style.display='none';
  _selectedJobCode = null;
}

function confirmJobSelect(){
  if(!_selectedJobCode || !walletState || !walletState.address) return;
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.textContent='...'; }

  fetch('/api/user/job', {
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: walletState.address, jobCode: _selectedJobCode })
  }).then(function(r){return r.json()})
  .then(function(d){
    if(d.error){
      // Map raw server error codes to friendly messages
      var lang = (window.LANG||'en');
      var msgMap = {
        'JOB_SYSTEM_DISABLED':{en:'Job system is currently disabled',ko:'직업 시스템이 비활성화 상태입니다',ja:'ジョブシステムは現在無効です',zh:'职业系统当前已禁用'},
        'USER_NOT_FOUND':{en:'Wallet not registered yet',ko:'지갑이 등록되지 않았습니다',ja:'ウォレットが未登録です',zh:'钱包尚未注册'},
        'JOB_NOT_FOUND':{en:'Unknown job code',ko:'알 수 없는 직업 코드',ja:'不明なジョブコード',zh:'未知职业代码'},
        'SAME_JOB':{en:'You already have this job',ko:'이미 이 직업입니다',ja:'既にこのジョブです',zh:'您已是此职业'},
        'JOB_CHANGE_COOLDOWN':{en:'Job change on cooldown',ko:'직업 변경 쿨다운 중입니다',ja:'ジョブ変更クールダウン中',zh:'职业变更冷却中'},
        'INSUFFICIENT_GP':{en:'Not enough GP',ko:'GP가 부족합니다',ja:'GP不足',zh:'GP不足'},
      };
      var msg = (msgMap[d.error] && msgMap[d.error][lang]) || (msgMap[d.error] && msgMap[d.error].en) || d.error;
      showAlert(msg,'error');
      if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent=t('job_modal_confirm');}
      return;
    }
    // Cache selected code & localized name BEFORE closing modal (closeJobSelectModal nulls _selectedJobCode)
    var chosenCode = _selectedJobCode;
    var chosenJob = _allJobs && _allJobs.find(function(j){return j.code===chosenCode;});
    var chosenName = chosenJob ? _normalizeJob(chosenJob).name : chosenCode;
    closeJobSelectModal();
    showToast(t('job_selected_toast').replace('{n}', chosenName));
    try{_sfx.success()}catch(e){}
    // Reload job card — parseInt's || fallback must wrap the entire parseInt arg, not just textContent
    if(walletState && walletState.address){
      var lvlEl = document.getElementById('profileLevel');
      var rank = parseInt((lvlEl && lvlEl.textContent) || '1') || 1;
      loadUserJob(walletState.address, rank);
    }
  }).catch(function(e){ showAlert(e.message,'error'); if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent=t('job_modal_confirm');} });
}

function renderSectorList(sectors){
  var html='';
  var myLevel = parseInt((document.getElementById('profileLevel')||{}).textContent || '1') || 1;
  sectors.forEach(function(s){
    var occ=s.stats.occupancyRate;
    var occPx=s.stats.occupiedPixels;
    var totPx=s.stats.totalPixels||1;
    // Entry requirement evaluation
    var entryActive = (s.entryCheckActive !== false);
    var entryMin = s.entryMinLevel || 0;
    var entryMidReq = s.entryRequiredMidOwns || 0;
    var entryBlocked = entryActive && (myLevel < entryMin);
    html+='<div class="sector-card" data-tier="'+s.tier+'" data-owned="'+(s.myPixels>0?'1':'0')+'" data-entry-blocked="'+(entryBlocked?'1':'0')+'">';
    // Header
    html+='<div class="sc-header">';
    html+='<span class="sc-tier '+s.tier+'">'+s.tier+'</span>';
    html+='<span class="sc-name">'+s.name+'</span>';
    // Entry badge: only show if active and has requirement
    if(entryActive && (entryMin > 0 || entryMidReq > 0)){
      var satisfied = !entryBlocked;
      var badgeCls = satisfied ? 'sc-entry satisfied' : 'sc-entry';
      var badgeText = '';
      if(entryMin > 0) badgeText += '🔒 Lv ' + entryMin;
      if(entryMidReq > 0) badgeText += (badgeText?' · ':'') + '+' + entryMidReq + ' MID';
      var tipText = satisfied ? ('Entry requirement met (Lv '+myLevel+')') : ('Requires Lv '+entryMin+' — you are Lv '+myLevel);
      html+='<span class="'+badgeCls+'" title="'+tipText+'">'+badgeText+'</span>';
    } else if(!entryActive && (entryMin > 0 || entryMidReq > 0)){
      // Requirement exists but globally disabled — show greyed
      html+='<span class="sc-entry inactive" title="Entry check disabled globally">🔓 Lv '+entryMin+'</span>';
    }
    html+='<span class="sc-mining">'+s.miningBonus+'x</span>';
    html+='<span class="sc-go" onclick="focusSector('+s.id+')">'+t('sector_go')+'</span>';
    html+='</div>';
    // Activity badge (inline, below header)
    if(s.stats.activity24h>0) html+='<div class="sc-activity"><span class="sc-activity-dot"></span>'+t('sector_claims_24h').replace('{n}',s.stats.activity24h)+'</div>';
    // Occupancy bar
    html+='<div class="sc-occ-wrap">';
    html+='<div class="sc-occ-labels"><span>'+t('sector_occupied')+'</span><span>'+occPx.toLocaleString()+' / '+totPx.toLocaleString()+' ('+occ+'%)</span></div>';
    html+='<div class="sc-occ-bar"><div class="sc-occ-fill '+s.tier+'" style="width:'+Math.min(occ,100)+'%"></div></div>';
    html+='</div>';
    // Stats grid
    html+='<div class="sc-stats">';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_avg_price')+'</span><span class="sc-stat-val" style="color:var(--gn)">$'+s.stats.avgPrice.toFixed(4)+'</span></div>';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_cur_price')+'</span><span class="sc-stat-val" style="color:var(--gn)">$'+s.currentPrice.toFixed(4)+'</span></div>';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_owners')+'</span><span class="sc-stat-val">'+s.stats.uniqueOwners+'</span></div>';
    html+='</div>';
    // Top holder / Governor / Tax — prefer nickname, fall back to short wallet
    if(s.topHolder){
      var thName = s.topHolder.nickname || s.topHolder.wallet;
      var govName = '';
      if(s.governor){
        govName = s.governor.nickname || s.governor.wallet;
      }
      html+='<div class="sc-stats" style="margin-top:2px">';
      html+='<div class="sc-stat" style="grid-column:span 2"><span class="sc-stat-label">'+t('sector_top_holder')+(govName?' / '+t('sector_gov'):'')+'</span><span class="sc-stat-val" style="font-size:10px;color:var(--gold)" title="'+(s.topHolder.fullWallet||'')+'">👑 '+thName+' ('+s.topHolder.pixels+'px)</span></div>';
      html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_tax')+'</span><span class="sc-stat-val" style="color:var(--cyan)">'+(s.taxRate||2)+'%</span></div>';
      if(govName && (!s.topHolder.fullWallet || (s.governor.fullWallet||'').toLowerCase()!==(s.topHolder.fullWallet||'').toLowerCase())){
        html+='<div class="sc-stat" style="grid-column:span 2"><span class="sc-stat-label">'+t('sector_gov')+'</span><span class="sc-stat-val" style="font-size:10px;color:var(--cyan)" title="'+(s.governor.fullWallet||'')+'">🏛️ '+govName+'</span></div>';
      }
      if(s.viceGovernor) html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_vice_gov')+'</span><span class="sc-stat-val" style="font-size:10px">'+(s.viceGovernor.nickname||s.viceGovernor.wallet||s.viceGovernor)+'</span></div>';
      html+='</div>';
    }
    // Active buffs
    if(s.activeBuffs&&s.activeBuffs.length>0){
      var buffIcons={mining_boost:'⛏️+20%',defense_bonus:'🛡️+10%',claim_discount:'💰-10%'};
      html+='<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">';
      s.activeBuffs.forEach(function(b){ html+='<span style="font-size:9px;padding:2px 6px;background:rgba(91,184,232,.1);border:1px solid rgba(91,184,232,.2);border-radius:4px;color:var(--cyan);font-family:var(--fn)">'+(buffIcons[b.buff_type]||b.buff_type)+'</span>'; });
      html+='</div>';
    }
    // Sector announcement from governor (visible to everyone in BASE tab) — governor 가 없으면 잔존 공지 무시
    if(s.announcement && s.governor){
      html+='<div style="font-size:9px;color:var(--gold);margin-top:4px;font-style:italic;font-family:var(--fn)">📢 "'+s.announcement+'"</div>';
    }
    // My holdings
    if(s.myPixels>0){
      html+='<div class="sc-my"><span class="sc-my-label">'+t('sector_my_px')+'</span><span class="sc-my-val">'+s.myPixels+'</span></div>';
    }
    html+='</div>';
  });
  document.getElementById('baseSectorList').innerHTML=html;
}

// ── PLANET NEWS (Migration 106) ─────────────────────────────────────────────
var _newsPanelOpen = false;
var _newsRefreshTimer = null;

var NEWS_ICON = {
  lottery_win:       '🎰',
  battle_won:        '⚔️',
  territory_claimed: '🌍',
  market_sale:       '🛒',
  achievement:       '🏅',
  big_trade:         '💸',
  guild_event:       '⚔️',
};

function toggleNewsPanel() {
  _newsPanelOpen = !_newsPanelOpen;
  document.getElementById('newsPanelWrap').style.display = _newsPanelOpen ? '' : 'none';
  document.getElementById('newsPanelToggle').textContent = _newsPanelOpen ? '▲' : '▼';
  if (_newsPanelOpen) {
    loadNewsFeed();
    // Auto-refresh every 30s while panel is open
    if (_newsRefreshTimer) _clearActiveInterval(_newsRefreshTimer);
    _newsRefreshTimer = _setActiveInterval(loadNewsFeed, 30000);
  } else {
    if (_newsRefreshTimer) { _clearActiveInterval(_newsRefreshTimer); _newsRefreshTimer = null; }
  }
}

function loadNewsFeed() {
  var el = document.getElementById('newsFeed');
  if (!el) return;
  fetch('/api/news?limit=30')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var items = data.news || [];
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:12px;font-size:9px">No events yet — play more to generate news!</div>';
        return;
      }
      el.innerHTML = items.map(function(n) {
        var icon = NEWS_ICON[n.event_type] || '📰';
        var timeStr = timeSinceShort(new Date(n.created_at));
        var headline = n.headline || '';
        return '<div style="display:flex;justify-content:space-between;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span>' + icon + ' ' + escHtml(headline) + '</span>'
          + '<span style="flex-shrink:0;color:var(--tx3);font-size:8px">' + timeStr + '</span>'
          + '</div>';
      }).join('');
    })
    .catch(function() {
      if (el) el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:9px;padding:8px">Failed to load</div>';
    });
}

function timeSinceShort(date) {
  var secs = Math.floor((new Date() - date) / 1000);
  if (secs < 60) return secs + 's';
  if (secs < 3600) return Math.floor(secs/60) + 'm';
  if (secs < 86400) return Math.floor(secs/3600) + 'h';
  return Math.floor(secs/86400) + 'd';
}


function filterSectors(tier,el){
  document.querySelectorAll('.base-filter-btn').forEach(function(b){b.classList.remove('active');b.style.opacity='.5'});
  el.classList.add('active');el.style.opacity='1';
  var cards=document.querySelectorAll('#baseSectorList .sector-card');
  var shown=0;
  cards.forEach(function(item){
    var match=false;
    if(tier==='all') match=true;
    else if(tier==='mine') match=item.dataset.owned==='1';
    else match=item.dataset.tier===tier;
    item.style.display=match?'':'none';
    if(match) shown++;
  });
  // Empty-state hint for MY SECTORS
  var list=document.getElementById('baseSectorList');
  var hint=document.getElementById('baseSectorEmptyHint');
  if(tier==='mine' && shown===0){
    if(!hint){
      hint=document.createElement('div');
      hint.id='baseSectorEmptyHint';
      hint.style.cssText='font-size:10px;color:var(--tx3);padding:20px;text-align:center';
      hint.textContent=t('sector_empty_hint');
      list.appendChild(hint);
    } else { hint.style.display=''; }
  } else if(hint){ hint.style.display='none'; }
}

function renderRankTable(ranks){
  var userRank=(_baseUserData&&_baseUserData.user)?_baseUserData.user.rank:0;
  var html='';
  ranks.forEach(function(r){
    var isCurrent=r.level===userRank;
    var cls=isCurrent?' class="current"':'';
    html+='<tr data-level="'+r.level+'"'+cls+'>';
    html+='<td>'+r.level+'</td>';
    if(r.breakthrough){
      html+='<td><span style="color:var(--gold)">🔒 </span>'+r.name+'</td>';
    }else{
      html+='<td>'+r.name+'</td>';
    }
    html+='<td>'+r.requiredXp.toLocaleString()+'</td>';
    html+='<td style="color:var(--pp)">'+r.rewardPp+' PP</td>';
    html+='</tr>';
    // Show breakthrough condition row
    if(r.breakthrough){
      html+='<tr class="bt-row"><td colspan="4">';
      html+='<div class="bt-info">';
      html+='<span class="bt-label">'+r.breakthroughLabel+'</span>';
      html+='<span class="bt-desc">'+r.breakthroughDesc+'</span>';
      html+='</div></td></tr>';
    }
  });
  document.getElementById('baseRankTable').innerHTML=html;

  // Show next breakthrough gate
  renderNextBreakthrough(ranks, userRank);
}

function renderNextBreakthrough(ranks, userRank){
  var w=walletState.address;
  if(!w){document.getElementById('breakthroughPanel').style.display='none';return}
  fetch('/api/breakthrough/'+encodeURIComponent(w)).then(function(r){return r.json()}).then(function(d){
    var panel=document.getElementById('breakthroughPanel');
    if(!d.nextGate){panel.style.display='none';return}
    panel.style.display='block';
    document.getElementById('btGateTitle').textContent=d.nextGate.title||'BREAKTHROUGH';
    document.getElementById('btGateLevel').textContent='Lv.'+d.nextGate.level+' '+d.nextGate.name;
    var html='';
    d.progress.forEach(function(p){
      var pct=Math.min(100,Math.round((p.current/p.target)*100));
      var isDone=p.done;
      html+='<div class="bt-prog-item">';
      html+='<span style="width:90px;color:'+(isDone?'var(--gn)':'var(--tx2)')+'">'+p.label+'</span>';
      html+='<div class="bt-prog-bar"><div class="bt-prog-fill '+(isDone?'done':'pending')+'" style="width:'+pct+'%"></div></div>';
      html+='<span style="width:70px;text-align:right;color:'+(isDone?'var(--gn)':'var(--tx3)')+'">'+p.current+'/'+p.target+(isDone?' ✓':'')+'</span>';
      html+='</div>';
    });
    document.getElementById('btProgressList').innerHTML=html;
  }).catch(function(){});
}

function focusSector(sectorId){
  var s=_sectorsData.find(function(x){return x.id===sectorId});
  if(!s) return;
  closeBaseModal();
  globe.pointOfView({lat:s.centerLat,lng:s.centerLng-180,altitude:1.2},1000);
}

// ═══ CAMPAIGN SYSTEM (MVP server simulation) ═══
var _campaignData=null;
var _campaignActive=null;
var _campaignShowLocked=false;
var _campaignScenes=null;
var _campaignSceneIndex=0;
var _campaignTypingTimer=null;
var _campaignEditorLayout=null; // 서버에서 로드한 에디터 레이아웃 캐시
var _campaignTypingDone=false;
var _campaignSceneLineIndex=0;
var _campaignTypingElement=null;
var _campaignTypingFullText='';
var _campaignBattleTimer=null;
var _campaignTypingFrame=null;
var _campaignSimTimer=null;
var _campaignImageCache={};
function loadCampaignStatus(){
  var el=document.getElementById('campaignList');
  var w=walletState.address;
  if(!el) return Promise.resolve();
  if(!w){el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:8px 0">Login to view campaign chapters.</div>';return Promise.resolve();}
  // 파벌 정보가 아직 로드되지 않았으면 먼저 로드한다 — 파벌별 필터링이 정확하게 동작해야 한다.
  var factionPromise=(typeof factionState!=='undefined'&&factionState&&factionState.current!==null)
    ? Promise.resolve()
    : (typeof loadFactions==='function' ? Promise.resolve(loadFactions()).catch(function(){}) : Promise.resolve());
  return factionPromise.then(function(){
    return fetch('/api/campaign/status/'+encodeURIComponent(w))
      .then(function(r){return r.json()})
      .then(function(d){
        _campaignData=d;
        renderCampaignReputation(d.reputation||{},d.tierLabels||{});
        renderCampaignRewardInbox(d.rewardInbox||[]);
        renderCampaignList(d.chapters||[]);
      })
      .catch(function(){
        renderCampaignRewardInbox([]);
        el.innerHTML='<div style="font-size:9px;color:var(--mars);padding:8px 0">Campaign unavailable.</div>';
      });
  });
}

// [v7.172 D-Crit-2/3 fix] 캠페인 프로필 모달 — 칭호 장착 + 평판 history.
//   백엔드 /api/tags/:wallet, /api/tags/set-active-title, /api/reputation/history/:wallet 완비됐는데 UI 0건이었음.
//   이 한 모달이 두 가지를 다 처리: TITLES 탭(보유 칭호 클릭→활성), HISTORY 탭(최근 30건 평판 변동).
function openCampaignProfileModal(){
  if (typeof isLoggedIn === 'function' && !isLoggedIn()){
    showFactionToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  var w = (walletState && walletState.address) || '';
  if (!w) { showToast('Wallet not ready', 'error'); return; }
  var old = document.getElementById('campaignProfileModal'); if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'campaignProfileModal';
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  // [v7.215] iOS phantom-click 가드 — backdrop close 가 모달 open 350ms 안엔 무시.
  el.dataset.openedAt = String(Date.now());
  el.onclick = function(e){
    if (e.target !== el) return; // inner 클릭은 무시
    if (Date.now() - parseInt(el.dataset.openedAt || '0', 10) < 350) return; // phantom-click
    el.remove();
  };
  el.innerHTML =
    // [v7.215] inner card 에 stopPropagation — 자식 클릭이 el.onclick 까지 버블되지 않게 명시.
    '<div onclick="event.stopPropagation()" style="position:relative;width:min(540px,94vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;border-radius:14px;background:radial-gradient(circle at 50% 0%,rgba(184,140,255,.18),rgba(10,12,22,.98) 65%);border:1.5px solid rgba(184,140,255,.55);box-shadow:0 0 30px rgba(184,140,255,.25),0 18px 60px rgba(0,0,0,.7);padding:18px;animation:crPop .3s cubic-bezier(.2,1.3,.5,1)">'
    +   '<div style="text-align:center;font-size:14px;font-weight:900;letter-spacing:1.5px;color:#caa8ff">🎖 '+tl('CAMPAIGN PROFILE','캠페인 프로필','キャンペーンプロフィール','战役档案')+'</div>'
    +   '<div style="display:flex;gap:6px;margin-top:12px">'
    +     '<button id="cpTabTitles" onclick="_cpSwitchTab(\'titles\')" style="flex:1;padding:9px;border-radius:7px;background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.5);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">🎖 '+tl('TITLES','칭호','称号','称号')+'</button>'
    +     '<button id="cpTabHistory" onclick="_cpSwitchTab(\'history\')" style="flex:1;padding:9px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">📜 '+tl('REP HISTORY','평판 이력','評判履歴','声誉历史')+'</button>'
    +   '</div>'
    +   '<div id="cpTitlesPane" style="margin-top:13px;overflow-y:auto;max-height:50vh"><div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px">'+tl('Loading...','로딩 중...','読み込み中...','加载中...')+'</div></div>'
    +   '<div id="cpHistoryPane" style="display:none;margin-top:13px;overflow-y:auto;max-height:50vh"></div>'
    +   '<button type="button" onclick="document.getElementById(\'campaignProfileModal\').remove()" style="margin-top:13px;width:100%;padding:11px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">'+tl('CLOSE','닫기','閉じる','关闭')+'</button>'
    + '</div>';
  document.body.appendChild(el);
  _cpLoadTitles(w);
}
function _cpSwitchTab(tab){
  var t = document.getElementById('cpTabTitles'), h = document.getElementById('cpTabHistory');
  var tp = document.getElementById('cpTitlesPane'), hp = document.getElementById('cpHistoryPane');
  if (!t||!h||!tp||!hp) return;
  var active = 'background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.5);color:#fff';
  var inactive = 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7)';
  if (tab==='titles'){
    t.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+active;
    h.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+inactive;
    tp.style.display=''; hp.style.display='none';
  } else {
    h.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+active;
    t.style.cssText = 'flex:1;padding:9px;border-radius:7px;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer;'+inactive;
    hp.style.display=''; tp.style.display='none';
    var w = (walletState && walletState.address) || '';
    if (w && !hp.dataset.loaded) _cpLoadHistory(w);
  }
}
function _cpLoadTitles(w){
  fetch('/api/tags/'+encodeURIComponent(w), { headers: getAuthHeaders() })
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      var pane = document.getElementById('cpTitlesPane'); if (!pane) return;
      if (!d) { pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; return; }
      var tags = (d.tags || d.list || []);
      var active = d.activeTitle || d.active_title || null;
      if (!tags.length) {
        pane.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px;line-height:1.6">'+tl('No titles yet.','아직 받은 칭호가 없습니다.','まだ称号がありません。','尚无称号。')+'<br><span style="color:rgba(255,255,255,.3);font-size:9px">'+tl('Complete campaign chapters to earn titles.','캠페인 챕터를 완료하면 칭호를 받습니다.','キャンペーンを完了すると獲得できます。','完成战役章节可获得称号。')+'</span></div>';
        return;
      }
      // [v7.211] inline onclick 깨짐 위험 차단 — data-* + delegated listener (영토 업그레이드와 동일 패턴).
      //   사용자 보고: '장착 눌러도 반응 없음'. 트랙 키 escape edge case 가능성.
      pane.innerHTML = tags.map(function(tag){
        var id = tag.tag_id || tag.id || tag.code || '';
        var label = tag.label || tag.name || tag.tag_label || id;
        var isActive = (active === id);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-radius:8px;background:'+(isActive?'rgba(184,140,255,.16)':'rgba(255,255,255,.04)')+';border:1px solid '+(isActive?'rgba(184,140,255,.55)':'rgba(255,255,255,.08)')+';margin-bottom:5px">'
          + '<div><div style="font-size:11px;font-weight:800;color:'+(isActive?'#caa8ff':'#fff')+'">🎖 '+escapeHtmlSafe(label)+(isActive?' <span style="font-size:9px;color:#69f0ae">'+tl('· ACTIVE','· 활성','· 装着中','· 已装备')+'</span>':'')+'</div>'
          + (tag.description?'<div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:2px">'+escapeHtmlSafe(tag.description)+'</div>':'')
          + '</div>'
          + (isActive
              ? '<button type="button" data-cp-action="unequip" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.6);font-family:var(--fn);cursor:pointer">'+tl('Unequip','해제','解除','卸下')+'</button>'
              : '<button type="button" data-cp-action="equip" data-cp-tag-id="'+escapeHtmlSafe(id)+'" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(184,140,255,.18);border:1px solid rgba(184,140,255,.45);color:#fff;font-family:var(--fn);cursor:pointer">'+tl('Equip','장착','装着','装备')+'</button>')
          + '</div>';
      }).join('');
      // [v7.211] delegated click listener — 모든 장착/해제 버튼 한 번에 처리.
      pane.onclick = function(ev){
        var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-cp-action]') : null;
        if (!btn || !pane.contains(btn)) return;
        ev.stopPropagation();
        var action = btn.getAttribute('data-cp-action');
        var tagId = btn.getAttribute('data-cp-tag-id') || '';
        console.log('[BTN] title action', action, tagId);
        if (action === 'unequip') _cpSetActiveTitle('');
        else if (action === 'equip' && tagId) _cpSetActiveTitle(tagId);
      };
    })
    .catch(function(){ var pane = document.getElementById('cpTitlesPane'); if (pane) pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; });
}
function _cpSetActiveTitle(tagId){
  fetch('/api/tags/set-active-title', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()), body: JSON.stringify({ tag_id: tagId || null }) })
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d || d.error) { showToast(d&&d.error || tl('Failed','실패','失敗','失败'), 'error'); return; }
      showToast(tagId?tl('Title equipped','칭호 장착됨','称号装着','称号已装备'):tl('Title removed','칭호 해제됨','称号解除','称号已卸下'),'success');
      var w = (walletState && walletState.address) || ''; if (w) _cpLoadTitles(w);
    })
    .catch(function(){ showToast(tl('Failed','실패','失敗','失败'),'error'); });
}
function _cpLoadHistory(w){
  fetch('/api/reputation/history/'+encodeURIComponent(w), { headers: getAuthHeaders() })
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      var pane = document.getElementById('cpHistoryPane'); if (!pane) return;
      pane.dataset.loaded = '1';
      var hist = (d && d.history) || [];
      if (!hist.length) {
        pane.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.4);font-size:10px;padding:30px">'+tl('No reputation changes yet.','아직 평판 변동이 없습니다.','評判の変動がありません。','尚无声誉变动。')+'</div>';
        return;
      }
      var facColor = { mcc:'#4fc3f7', fsp:'#81c784', cv:'#ef5350', pilgrim_arms:'#c08bff' };
      var facLabel = { mcc:'MCC', fsp:'FSP', cv:'CV', pilgrim_arms:'Pilgrim Arms' };
      pane.innerHTML = hist.map(function(h){
        var col = facColor[h.faction] || '#fff';
        var lbl = facLabel[h.faction] || h.faction;
        var sign = (h.delta > 0) ? '+' : '';
        var sCol = (h.delta > 0) ? '#69f0ae' : (h.delta < 0 ? '#ff5252' : '#fff');
        var src = h.source_type ? (h.source_type + (h.source_id ? (' · '+h.source_id) : '')) : '';
        var when = h.created_at ? new Date(h.created_at).toLocaleString() : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:4px">'
          + '<div><div style="font-size:10px;font-weight:800;color:'+col+'">'+lbl+'</div>'
          +   (src?'<div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:1px">'+escapeHtmlSafe(src)+'</div>':'')
          +   (when?'<div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:1px">'+when+'</div>':'')
          + '</div>'
          + '<div style="font-size:13px;font-weight:900;color:'+sCol+'">'+sign+h.delta+'</div>'
          + '</div>';
      }).join('');
    })
    .catch(function(){ var pane = document.getElementById('cpHistoryPane'); if (pane) pane.innerHTML = '<div style="text-align:center;color:#ff5252;font-size:10px;padding:20px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; });
}

function renderCampaignReputation(rep,tiers){
  // [v7.170 D-Crit-1 fix] Pilgrim Arms 평판 추가 — campaign.js FACTIONS=['mcc','fsp','cv','pilgrim_arms'] 4종.
  //   기존엔 3종만 순회해 보상으로 받은 pilgrim_arms 평판이 UI에서 안 보였음. Ending 4 분기 추적 가능해짐.
  var el=document.getElementById('campaignReputation');
  if(!el) return;
  var colors={mcc:'#4fc3f7',fsp:'#81c784',cv:'#ef5350',pilgrim_arms:'#c08bff'};
  var labels={mcc:'MCC',fsp:'FSP',cv:'CV',pilgrim_arms:'Pilgrim Arms'};
  var html='<div class="campaign-rep">';
  ['mcc','fsp','cv','pilgrim_arms'].forEach(function(f){
    if (rep[f] === undefined && f === 'pilgrim_arms') return; // 응답에 pilgrim_arms 없으면 행 자체 생략(legacy 호환)
    var v=parseInt(rep[f]||0,10);
    var pct=Math.max(0,Math.min(100,v+100)/2);
    html+='<div class="campaign-rep-item"><div class="campaign-rep-top"><span>'+labels[f]+'</span><span>'+v+' · '+escapeHtmlSafe(tiers[f]||'Neutral')+'</span></div><div class="campaign-rep-track"><div class="campaign-rep-fill" style="width:'+pct+'%;background:'+colors[f]+'"></div></div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function campaignRewardLabel(r){
  var p=(r&&r.payload&&typeof r.payload==='object')?r.payload:{};
  return p.label||p.labelKo||r.reward_code||'Campaign Reward';
}
function campaignRewardTypeLabel(type){
  var maps={
    ko:{ship:'함선',ship_fleet:'함대',ship_blueprint:'설계도',ship_choice:'함선 선택권',resource:'자원',resource_stream:'자원 계약',gp_stream:'GP 계약',data_artifact:'데이터',asset:'자산',permanent_buff:'영구 효과',title_position:'칭호',safe_house_access:'권한'},
    ja:{ship:'艦船',ship_fleet:'艦隊',ship_blueprint:'設計図',ship_choice:'艦船選択',resource:'資源',resource_stream:'資源契約',gp_stream:'GP契約',data_artifact:'データ',asset:'資産',permanent_buff:'永久効果',title_position:'称号',safe_house_access:'アクセス権'},
    zh:{ship:'舰船',ship_fleet:'舰队',ship_blueprint:'设计图',ship_choice:'舰船选择权',resource:'资源',resource_stream:'资源合约',gp_stream:'GP合约',data_artifact:'数据',asset:'资产',permanent_buff:'永久效果',title_position:'称号',safe_house_access:'访问权限'},
    en:{ship:'Ship',ship_fleet:'Fleet',ship_blueprint:'Blueprint',ship_choice:'Ship Choice',resource:'Resource',resource_stream:'Resource Contract',gp_stream:'GP Contract',data_artifact:'Data Artifact',asset:'Asset',permanent_buff:'Permanent Buff',title_position:'Title',safe_house_access:'Access'}
  };
  var lang=(typeof LANG!=='undefined'?LANG:'en');
  var map=maps[lang]||maps.en;
  return map[type]||String(type||(lang==='ko'?'보상':lang==='ja'?'報酬':lang==='zh'?'奖励':'Reward'));
}
function renderCampaignRewardInbox(inbox){
  var el=document.getElementById('campaignRewardInbox');
  if(!el) return;
  if(!Array.isArray(inbox)||!inbox.length){el.innerHTML='';return;}
  // [v7.168] inbox 표시 한도 4→12 (서버 LIMIT 20 — 5건 이상도 노출). 스크롤 가능 컨테이너.
  var html='<div class="campaign-reward-inbox" style="max-height:340px;overflow-y:auto">';
  inbox.slice(0,12).forEach(function(r){
    var id=parseInt(r.id,10)||0;
    var qty=parseInt(r.quantity,10)||1;
    var type=campaignRewardTypeLabel(r.reward_type);
    var label=campaignRewardLabel(r);
    html+='<div class="campaign-reward-card">';
    html+='<div><div class="campaign-reward-label">🎁 '+escapeHtmlSafe(label)+(qty>1?' ×'+qty:'')+'</div><div class="campaign-reward-meta">'+escapeHtmlSafe(type)+' · '+escapeHtmlSafe(r.quest_id||'campaign')+'</div></div>';
    html+='<button class="campaign-reward-claim" onclick="claimCampaignReward('+id+',this)">'+(LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim')+'</button>';
    html+='</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

async function claimCampaignReward(id,btn){
  if(!isLoggedIn()){showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');return;}
  if(!id){showToast(LANG==='ko'?'보상 정보가 없습니다':LANG==='ja'?'報酬情報がありません':LANG==='zh'?'没有奖励信息':'No reward info','error');return;}
  var _claimWallet=(walletState&&walletState.address)||getMyWallet();
  if(!_claimWallet){showFactionToast(LANG==='ko'?'지갑을 연결해주세요':LANG==='ja'?'ウォレットを接続してください':LANG==='zh'?'请先连接钱包':'Connect wallet first','error');return;}
  if(btn){btn.disabled=true;btn.textContent=LANG==='ko'?'수령중':LANG==='ja'?'受取中':LANG==='zh'?'领取中':'Claiming';}
  try{
    var r=await fetch('/api/campaign/reward/claim',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:_claimWallet,reward_id:id})
    });
    var d=await r.json().catch(function(){return {};});
    if(!r.ok||d.error) throw new Error(d.error||'claim failed');
    var _aLabels={ship:LANG==='ko'?'함선 ':LANG==='ja'?'艦船 ':LANG==='zh'?'舰船 ':'Ship ',resource:LANG==='ko'?'자원 ':LANG==='ja'?'資源 ':LANG==='zh'?'资源 ':'Resource ',item:LANG==='ko'?'아이템 ':LANG==='ja'?'アイテム ':LANG==='zh'?'道具 ':'Item '};
    var noteMsg=d.note||(d.applied&&d.applied.length?d.applied.map(function(a){return((_aLabels[a.kind]||'')+a.code+(a.quantity&&a.quantity>1?' ×'+a.quantity:''));}).join(', '):(LANG==='ko'?'캠페인 보상을 수령했습니다':LANG==='ja'?'キャンペーン報酬を受け取りました':LANG==='zh'?'已领取活动奖励':'Campaign reward claimed'));
    showToast(noteMsg,'success');
    await loadCampaignStatus();
    try{loadInventory&&loadInventory();}catch(_){}
    try{loadResourceInventory&&loadResourceInventory();}catch(_){}
  }catch(e){
    showToast((LANG==='ko'?'보상 수령 실패: ':LANG==='ja'?'報酬受取失敗: ':LANG==='zh'?'领取奖励失败: ':'Claim failed: ')+(e&&e.message?e.message:(LANG==='ko'?'오류':LANG==='ja'?'エラー':LANG==='zh'?'错误':'error')),'error');
    if(btn){btn.disabled=false;btn.textContent=LANG==='ko'?'수령':LANG==='ja'?'受取':LANG==='zh'?'领取':'Claim';}
  }
}

function campaignProgressStatus(progress){
  var p=progress||{};
  return String(p.status||p.state||'').trim().toLowerCase();
}
function isCampaignProgressDone(progress){
  var st=campaignProgressStatus(progress);
  return st==='completed'||st==='claimed'||!!(progress&&progress.completedAt);
}
function isCampaignProgressActive(progress){
  return campaignProgressStatus(progress)==='in_progress';
}
function campaignStatusLabel(progress,fallback){
  return campaignProgressStatus(progress)||fallback||'new';
}
function campaignBranchLabel(id){
  var map={
    mcc_route_a_active:'MCC Branch A',
    mcc_route_b_active:'MCC Branch B',
    mcc_route_c_active:'MCC Branch C',
    ending_1_pathway_aligned:'FSP Ending 1 path',
    ending_1_pathway_strengthened:'FSP Ending 1 path',
    ending_2_pathway_aligned:'FSP Ending 2 path',
    ending_2_pathway_strengthened:'FSP Ending 2 path',
    ending_2_alt_path_cv_alliance:'FSP-CV alliance path',
    gaia_captain_offer_unlocked:'Gaia Captain offer',
    ending_3_pathway_unlocked:'FSP Ending 3 path',
    ending_3_pathway_unavoidable:'FSP Ending 3 path',
    ending_3_pathway_strengthened:'FSP Ending 3 path',
    ending_4_pathway_unlocked:'FSP Ending 4 path',
    ending_4_pathway_unavoidable:'FSP Ending 4 path',
    ending_4_pathway_strengthened:'FSP Ending 4 path'
  };
  return map[id]||String(id||'route');
}
function campaignLockedReason(ch){
  if(ch&&ch.lockReason&&ch.lockReason.error) return campaignStartErrorMessage(ch,ch.lockReason);
  var data=_campaignData||{};
  var rep=data.reputation||{};
  var completed=data.completedChapters||[];
  var tags=data.tags||[];
  var branchRows=data.branchModifiers||[];
  var branchIds=[];
  branchRows.forEach(function(b){var id=b&&((b.modifier_id)||(b.modifier_key));if(id&&branchIds.indexOf(id)<0)branchIds.push(id);});
  var missingRep=Object.entries(ch.requiredReputation||{}).filter(function(pair){return (parseInt(rep[pair[0]]||0,10)||0)<pair[1];});
  if(missingRep.length){
    var mr=missingRep[0], f=String(mr[0]||'').toUpperCase();
    return LANG==='ko'?f+' 평판 '+mr[1]+' 필요':LANG==='ja'?f+' 評判 '+mr[1]+' が必要':LANG==='zh'?'需要 '+f+' 声望 '+mr[1]:'Requires '+f+' reputation '+mr[1];
  }
  if(ch.prerequisiteChapter&&completed.indexOf(ch.prerequisiteChapter)<0){
    return LANG==='ko'?'선행 챕터 완료 필요':LANG==='ja'?'前提チャプター完了が必要':LANG==='zh'?'需要先完成前置章节':'Complete the prerequisite chapter';
  }
  var blocking=(ch.blockingTags||[]).filter(function(t){return tags.indexOf(t)>=0;});
  if(blocking.length){
    return LANG==='ko'?'현재 태그로 차단됨: '+blocking[0]:LANG==='ja'?'現在のタグでブロック: '+blocking[0]:LANG==='zh'?'当前标签阻止: '+blocking[0]:'Blocked by current tag: '+blocking[0];
  }
  var requiredBranches=ch.requiredBranchAny||[];
  if(requiredBranches.length&&!requiredBranches.some(function(b){return branchIds.indexOf(b)>=0;})){
    var label=requiredBranches.slice(0,2).map(campaignBranchLabel).join(' / ');
    return LANG==='ko'?'필요 분기: '+label:LANG==='ja'?'必要ルート: '+label:LANG==='zh'?'需要路线: '+label:'Requires route: '+label;
  }
  return LANG==='ko'?'시작 조건 미충족':LANG==='ja'?'開始条件未達':LANG==='zh'?'未满足开始条件':'Start requirements not met';
}

function renderCampaignList(chapters){
  var el=document.getElementById('campaignList');
  if(!el) return;
  // 파벌 필터 — 유저가 속한 파벌의 시나리오만 노출한다.
  // 파벌 미선택 상태에서는 안내 카드만 보여 다른 루트가 노출되지 않도록 한다.
  var myFaction=(typeof factionState!=='undefined'&&factionState&&factionState.current&&factionState.current.code)?factionState.current.code:null;
  if(!myFaction){
    el.innerHTML='<div style="font-size:10px;color:var(--gold);padding:14px;border:1px dashed rgba(255,209,102,.35);border-radius:8px;line-height:1.7">'+t('campaign_no_faction')+'</div>';
    return;
  }
  var visible=chapters.filter(function(c){
    if(!c||!c.faction) return false;
    if(c.faction==='hidden') return false; // 히든 루트는 별도 조건으로만 공개
    return c.faction===myFaction;
  });
  if(!visible.length){el.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:8px 0">'+t('campaign_no_chapters')+'</div>';return;}
  var html='';
  var lockedHtml='';
  var lockedCount=0;
  visible.forEach(function(ch){
    var p=ch.progress||{};
    var pSt=campaignProgressStatus(p);
    var failed=pSt==='failed';
    var locked=((_campaignData&&_campaignData.lockedChapters)||[]).indexOf(ch.questId)>=0;
    var done=isCampaignProgressDone(p);
    var active=isCampaignProgressActive(p);
    var title=_campaignStoryText(ch.title)||ch.questId;
    var _lang=(typeof LANG!=='undefined'?LANG:'ko');
    var retryLabel=_lang==='ko'?'🔄 재도전':(_lang==='ja'?'🔄 再挑戦':(_lang==='zh'?'🔄 重试':'🔄 RETRY'));
    var btn=locked?t('campaign_btn_locked'):(done?t('campaign_btn_results'):(active?t('campaign_btn_continue'):(failed?retryLabel:t('campaign_btn_start'))));
    var route=((ch.campaignId||'').replace('_route','')||ch.faction||'').toUpperCase();
    var card='';
    if(locked){
      lockedCount++;
      var lockedReason=campaignLockedReason(ch);
      card+='<div class="campaign-card compact">';
      card+='<div class="campaign-icon">⚡</div><div class="campaign-top"><div style="flex:1;min-width:0"><div class="campaign-meta">'+route+' · '+t('campaign_label_ch')+' '+ch.chapterNumber+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
      card+='<button class="campaign-btn secondary" disabled style="opacity:.55;cursor:not-allowed">'+btn+'</button>';
      card+='<div class="campaign-lock-reason">🔒 '+escapeHtmlSafe(lockedReason)+'</div>';
      card+='</div>';
      lockedHtml+=card;
      return;
    }
    if(done){
      var doneChapterLabel=Number(ch.chapterNumber)===0?t('campaign_label_prologue'):t('campaign_label_ch')+' '+ch.chapterNumber;
      card+='<div class="campaign-card compact done">';
      card+='<div class="campaign-icon">✓</div><div class="campaign-top"><div style="flex:1;min-width:0"><div class="campaign-meta">'+route+' '+t('campaign_label_route')+' · '+doneChapterLabel+' · '+t('campaign_label_completed')+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
      card+='<button class="campaign-btn secondary" onclick="openCampaignChapter(\''+ch.questId+'\')">'+t('campaign_btn_results')+'</button>';
      card+='</div>';
      html+=card;
      return;
    }
    card+='<div class="campaign-card'+(failed?' failed':'')+'">';
    card+='<div class="campaign-top"><div class="campaign-icon">'+(failed?'✗':'⚡')+'</div><div style="flex:1"><div class="campaign-meta">'+route+' '+t('campaign_label_route')+' · '+t('campaign_label_ch')+' '+ch.chapterNumber+(failed?' · <span style="color:var(--mars);font-weight:800">'+(_lang==='ko'?'임무 실패':'FAILED')+'</span>':'')+'</div><div class="campaign-title">'+escapeHtmlSafe(title)+'</div></div></div>';
    var _locLang=(typeof LANG!=='undefined'?LANG:'ko');
    var _locDisplay=ch.location&&(_campaignStoryText(ch.location.displayName)||((_locLang!=='ko'&&ch.location.displayNameEn)||ch.location.displayNameKo));
    card+='<div class="campaign-desc">'+escapeHtmlSafe(_locDisplay||'Mars')+'</div>';
    card+=campaignObjectivesHtml(ch,3);
    if(done||active||failed){
      var m=p.metrics||{};
      card+=campaignStatsHtml(m,campaignStatusLabel(p,'NEW'));
    }
    card+='<button class="campaign-btn'+(failed?' secondary':'')+'" style="'+(failed?'background:rgba(255,80,30,.15);border-color:rgba(255,80,30,.4);color:var(--mars)':'')+'" onclick="openCampaignChapter(\''+ch.questId+'\')">'+btn+'</button>';
    card+='</div>';
    html+=card;
  });
  if(lockedCount){
    html+='<button class="campaign-locked-toggle" onclick="toggleCampaignLockedList()">'+(_campaignShowLocked?t('campaign_hide_locked'):t('campaign_show_locked'))+' · '+lockedCount+'</button>';
    if(_campaignShowLocked) html+=lockedHtml;
  }
  el.innerHTML=html;
}

function toggleCampaignLockedList(){
  _campaignShowLocked=!_campaignShowLocked;
  renderCampaignList((_campaignData&&_campaignData.chapters)||[]);
}

function openCampaignHub(){
  openBaseModal();
  setTimeout(function(){
    var tab=document.getElementById('baseTabQuests');
    switchBaseTab('quests',tab);
    try{clearBaseTabDot('quests')}catch(_){}
    loadCampaignStatus().then(function(){
      var panel=document.getElementById('campaignPanel');
      if(panel) panel.scrollIntoView({block:'start',behavior:'smooth'});
    });
  },0);
}

function _findCampaignChapter(questId){
  var arr=(_campaignData&&_campaignData.chapters)||[];
  for(var i=0;i<arr.length;i++) if(arr[i].questId===questId) return arr[i];
  return null;
}
function campaignStatsHtml(m,status){
  var a=m.oxygen_recovery_pct!=null?{v:m.oxygen_recovery_pct+'%',l:'OXYGEN'}:
    m.facility_hp_percent!=null?{v:m.facility_hp_percent+'%',l:'FACILITY'}:
    m.subsidiary_target?{v:String(m.subsidiary_target).toUpperCase(),l:'TARGET'}:
    m.helion_destroyed!=null?{v:m.helion_destroyed+'/14',l:'RAID'}:{v:'--',l:'METRIC'};
  var b=m.ships_destroyed!=null?{v:m.ships_destroyed+'/9',l:'SHIPS'}:
    m.militia_destroyed!=null?{v:m.militia_destroyed+'/4',l:'MILITIA'}:
    m.eclipse_kill_count!=null?{v:m.eclipse_kill_count,l:'ECLIPSE'}:
    m.helion_escapes!=null?{v:m.helion_escapes,l:'ESCAPED'}:{v:'--',l:'RESULT'};
  return '<div class="campaign-stats"><div class="campaign-stat"><b>'+escapeHtmlSafe(String(a.v))+'</b><span>'+a.l+'</span></div><div class="campaign-stat"><b>'+escapeHtmlSafe(String(b.v))+'</b><span>'+b.l+'</span></div><div class="campaign-stat"><b>'+escapeHtmlSafe(String(status).toUpperCase())+'</b><span>STATUS</span></div></div>';
}
function campaignObjectivesHtml(ch,limit){
  var objectives=(ch&&Array.isArray(ch.objectives))?ch.objectives:[];
  if(!objectives.length) return '';
  var list=objectives.slice(0,limit||3);
  // [v7.222 upgrade #5] objective 진행률 바 + 다음 목표 힌트 — 초반 이탈 방지, 완료율 가시화.
  var _doneN=objectives.filter(function(o){return o.state==='done';}).length;
  var _totN=objectives.length;
  var _pct=_totN?Math.round(_doneN/_totN*100):0;
  var _next=objectives.find(function(o){return o.state!=='done';});
  var _lang5=(typeof LANG!=='undefined'?LANG:'ko');
  var _nextLbl=_next?(_campaignStoryText(_next.label)||_next.labelKo||_next.label||''):'';
  var html='';
  html+='<div style="margin:6px 0 4px">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
  html+='<span style="font-size:8px;color:var(--tx3);letter-spacing:.5px">'+(_lang5==='ko'?'작전 진행도':_lang5==='ja'?'作戦進行度':_lang5==='zh'?'作战进度':'PROGRESS')+'</span>';
  html+='<span style="font-size:9px;font-weight:800;color:'+(_pct>=100?'#69f0ae':'#ffd166')+'">'+_doneN+'/'+_totN+' · '+_pct+'%</span>';
  html+='</div>';
  html+='<div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+_pct+'%;background:linear-gradient(90deg,#ffd166,#ff9030);border-radius:3px;transition:width .4s"></div></div>';
  if(_next&&_nextLbl){
    html+='<div style="font-size:8px;color:#ffab40;margin-top:3px">▶ '+(_lang5==='ko'?'다음: ':_lang5==='ja'?'次: ':_lang5==='zh'?'下一步: ':'Next: ')+escapeHtmlSafe(_nextLbl)+'</div>';
  }
  html+='</div>';
  html+='<div class="campaign-objectives">';
  list.forEach(function(o){
    var state=o.state||'pending';
    var icon=state==='done'?'✓':(state==='active'?'▶':'•');
    var count=(o.current!=null&&o.target!=null)?'<span class="co-count">'+escapeHtmlSafe(String(o.current))+'/'+escapeHtmlSafe(String(o.target))+'</span>':'';
    var action=campaignObjectiveActionTarget(o.action);
    var actionable=state!=='done'&&!!action;
    var attrs=actionable?' actionable" onclick="handleCampaignObjectiveAction(event,\''+action+'\')"':'"';
    var actionHtml=actionable?'<span class="co-action">'+campaignObjectiveActionLabel(action)+'</span>':'';
    var _oLabel=_campaignStoryText(o.label)||o.labelKo||o.label||o.id||'Objective';
    html+='<div class="campaign-objective '+state+attrs+'><span class="co-dot">'+icon+'</span><span class="co-label">'+escapeHtmlSafe(_oLabel)+'</span>'+count+actionHtml+'</div>';
  });
  html+='</div>';
  return html;
}
function campaignObjectiveActionTarget(action){
  var map={territory:'territory',territory_art:'territory',shipyard:'shipyard',fleet:'fleet',fleet_battle:'battle',market:'market'};
  return map[action]||'';
}
function campaignObjectiveActionLabel(action){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  if(lang==='ko'){
    var mapKo={territory:'영토 확인',territory_art:'영토 확인',shipyard:'함선 준비',fleet:'함대 편성',fleet_battle:'전투 진입',market:'마켓 확인'};
    return mapKo[action]||t('campaign_objective_go');
  }
  if(lang==='ja'){
    var mapJa={territory:'領地確認',territory_art:'領地確認',shipyard:'艦船準備',fleet:'艦隊編成',fleet_battle:'戦闘開始',market:'マーケット確認'};
    return mapJa[action]||t('campaign_objective_go');
  }
  if(lang==='zh'){
    var mapZh={territory:'查看领地',territory_art:'查看领地',shipyard:'准备舰船',fleet:'编成舰队',fleet_battle:'进入战斗',market:'查看市场'};
    return mapZh[action]||t('campaign_objective_go');
  }
  var map={territory:'CHECK TERRITORY',territory_art:'CHECK TERRITORY',shipyard:'PREP SHIPS',fleet:'FORM FLEET',fleet_battle:'ENTER BATTLE',market:'CHECK MARKET'};
  return map[action]||t('campaign_objective_go');
}
function handleCampaignObjectiveAction(ev,action){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(!isLoggedIn()){showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');return;}
  closeCampaignModal();
  if(action==='territory'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabTerritory');
      switchBaseTab('territory',tab);
      showToast(LANG==='ko'?'영토 화면에서 목표를 진행하세요':LANG==='ja'?'領地画面で目標を進めてください':LANG==='zh'?'请在领地界面推进目标':'Continue the objective from your territory','info');
    },0);
  }else if(action==='shipyard'){
    openShipyard();
    setTimeout(function(){try{switchSyTab('blueprints')}catch(_){}},0);
  }else if(action==='fleet'){
    openFleetCmd();
  }else if(action==='battle'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabPvp');
      switchBaseTab('pvp',tab);
      try{openBattleHub()}catch(_){showToast(LANG==='ko'?'함대전을 열고 전투 목표를 진행하세요':LANG==='ja'?'艦隊戦を開いて戦闘目標を進めてください':LANG==='zh'?'请打开舰队战并推进战斗目标':'Open fleet battle and continue the combat objective','info');}
    },0);
  }else if(action==='market'){
    openBaseModal();
    setTimeout(function(){
      var tab=document.getElementById('baseTabMarket');
      switchBaseTab('market',tab);
      try{loadMarketTab()}catch(_){}
    },0);
  }
}
function _campaignClearSimTimer(){
  if(_campaignSimTimer) _clearActiveTimeout(_campaignSimTimer);
  _campaignSimTimer=null;
}
function _campaignSimIsOpen(){
  var m=document.getElementById('campaignModal');
  return !!(m&&m.style.display==='flex');
}
function _scheduleCampaignProgress(ms){
  _campaignClearSimTimer();
  _campaignSimTimer=_setActiveTimeout(function(){
    _campaignSimTimer=null;
    if(_pageIsActive()) pollCampaignProgress(false);
  },ms);
}
function closeCampaignModal(){var m=document.getElementById('campaignModal');if(m)m.style.display='none';_campaignClearSimTimer();}
function _setCampaignModal(ch, html){
  _campaignClearSimTimer();
  document.getElementById('campaignModalTitle').textContent=_campaignStoryText(ch.title)||ch.questId;
  // 라우트 표시는 챕터의 실제 파벌(MCC/FSP/CV) 기반으로 동적으로 만든다 — 프롤로그/CV 챕터에서도 정확한 라우트가 보이도록 한다.
  var route=((ch.campaignId||'').replace('_route','')||ch.faction||'mcc').toUpperCase();
  document.getElementById('campaignModalMeta').textContent=route+' ROUTE · CHAPTER '+ch.chapterNumber;
  var _locName=ch.location&&(_campaignStoryText(ch.location.displayName)||(LANG==='ko'?ch.location.displayNameKo:ch.location.displayNameEn||ch.location.displayNameKo)||'Mars');
  document.getElementById('campaignModalSub').textContent=(_locName||'Mars')+' · '+((ch.environment&&ch.environment.type)||'simulation');
  document.getElementById('campaignModalBody').innerHTML=html;
  document.getElementById('campaignModal').style.display='flex';
}

function _campaignStoryText(value){
  // 스토리 JSON 다국어 필드에서 현재 LANG에 맞는 텍스트를 반환한다.
  if(value==null) return '';
  if(typeof value==='string') return value;
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  // 한국어 사용자: ko → en → ja → zh 순 폴백
  // 비한국어 사용자: lang → en → ko → ja → zh 순 폴백 (영어가 ko보다 우선)
  if(lang==='ko') return value.ko||value.en||value.ja||value.zh||'';
  return value[lang]||value.en||value.ko||value.ja||value.zh||'';
}

function _campaignStorySpeakerName(id){
  // 캐릭터 ID를 에셋 파일명과 분리하지 않도록 표시명만 로컬에서 보정한다.
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  var namesKo={player:'당신',lifang:'리팡',chen:'천 회장',mikhail:'미하일',butcher:'정육점',hale:'헤일 신부',lena:'레나',kara_vex:'Kara Vex',cinder:'신더',amara:'아마라',liang:'량 웨이',samuel:'사무엘',hagar:'하가르',mcc_operator:'MCC 오퍼레이터',helion_captain:'헬리온 선장',miner_elder:'광부 어르신',crow:'크로우',roth:'로스',sal_cruz:'살 크루즈',kenji:'켄지',wei:'웨이',grace:'그레이스',pilgrim:'필그림'};
  var namesEn={player:'You',lifang:'Li Fang',chen:'Chairman Chen',mikhail:'Mikhail',butcher:'The Butcher',hale:'Father Hale',lena:'Lena',kara_vex:'Kara Vex',cinder:'Cinder Grace',amara:'Amara',liang:'Liang Wei',samuel:'Samuel',hagar:'Hagar',mcc_operator:'MCC Operator',helion_captain:'Helion Captain',miner_elder:'Elder Miner',crow:'Crow',roth:'Roth',sal_cruz:'Sal Cruz',kenji:'Kenji',wei:'Wei',grace:'Grace',pilgrim:'Pilgrim'};
  var namesJa={player:'あなた',lifang:'リー・ファン',chen:'チェン会長',mikhail:'ミハイル',butcher:'ブッチャー',hale:'ヘイル神父',lena:'レナ',kara_vex:'カラ・ヴェックス',cinder:'シンダー',amara:'アマラ',liang:'リャン・ウェイ',samuel:'サミュエル',hagar:'ハガー',mcc_operator:'MCCオペレーター',helion_captain:'ヘリオン艦長',miner_elder:'鉱夫の長老',crow:'クロウ',roth:'ロス',sal_cruz:'サル・クルス',kenji:'ケンジ',wei:'ウェイ',grace:'グレース',pilgrim:'ピルグリム'};
  var namesZh={player:'你',lifang:'李芳',chen:'陈主席',mikhail:'米哈伊尔',butcher:'屠夫',hale:'黑尔神父',lena:'列娜',kara_vex:'卡拉·维克斯',cinder:'辛德',amara:'阿玛拉',liang:'梁伟',samuel:'塞缪尔',hagar:'哈加尔',mcc_operator:'MCC操作员',helion_captain:'赫利昂舰长',miner_elder:'矿工长老',crow:'克劳',roth:'罗斯',sal_cruz:'萨尔·克鲁兹',kenji:'健二',wei:'伟',grace:'格雷斯',pilgrim:'朝圣者'};
  var maps={ko:namesKo,en:namesEn,ja:namesJa,zh:namesZh};
  var names=maps[lang]||namesKo;
  return names[id]||String(id||'Narrator').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
}

function _campaignStorySceneById(id){
  // branch/options의 goto와 dialogue next가 문자열 ID를 쓰는 실제 씬 데이터를 지원한다.
  if(!_campaignScenes||!id) return -1;
  for(var i=0;i<_campaignScenes.length;i++) if(_campaignScenes[i]&&_campaignScenes[i].id===id) return i;
  return -1;
}

function _campaignHasServerChoice(choiceId){
  var choices=_campaignActive&&_campaignActive.chapter&&_campaignActive.chapter.choices;
  if(!choiceId||!Array.isArray(choices)) return false;
  return choices.some(function(c){return c&&c.id===choiceId;});
}

function _advanceCampaignSceneChoice(choiceId,target){
  // Scene-local narrative choices are part of the VN script, not the server
  // campaign choice whitelist. They should keep the story moving locally.
  var idx=-1;
  if(target!==undefined&&target!==null&&String(target)!==''){
    var next=String(target);
    idx=/^\d+$/.test(next)?parseInt(next,10):_campaignStorySceneById(next);
  }
  if(idx>=0&&_campaignScenes&&idx<_campaignScenes.length){
    _campaignSceneIndex=idx;
    _campaignSceneLineIndex=0;
    renderCampaignScene();
    return;
  }
  advanceCampaignScene();
}

function showCampaignStory(chapter){
  // 서버가 full story document 또는 scenes 배열을 줄 수 있어 둘 다 허용한다.
  closeCampaignStory();
  var story=chapter&&chapter.scenes;
  _campaignScenes=Array.isArray(story)?story:((story&&Array.isArray(story.scenes))?story.scenes:null);
  _campaignSceneIndex=0;
  _campaignSceneLineIndex=0;
  if(!_campaignScenes||!_campaignScenes.length){showCampaignBriefing(chapter,chapter&&chapter.progress);return;}
  var oldModal=document.getElementById('campaignModal');
  if(oldModal) oldModal.style.display='none';
  var overlay=document.createElement('div');
  overlay.className='story-overlay';
  // story-stage = 세로형 포트레이트 컨테이너 (모바일 기준, 데스크탑은 중앙 모달)
  overlay.innerHTML='<div class="story-stage">'
    +'<div class="story-background"></div>'
    +'<img class="story-character-left" alt="">'
    +'<img class="story-character-right" alt="">'
    +'<img class="story-detail-overlay" alt="">'
    +'<div class="story-controls">'
      +'<button type="button" class="story-ctrl-btn" id="storySkipBtn" title="'+t('story_skip_title')+'">▶ '+t('story_skip')+'</button>'
      +'<button type="button" class="story-ctrl-btn danger" id="storyAbandonBtn" title="'+t('story_abandon_title')+'">✕ '+t('story_abandon')+'</button>'
    +'</div>'
    +'<div class="story-dialog-box"></div>'
    +'<div class="story-tap-hint">▶ '+t('story_tap_hint')+'</div>'
    +'</div>';
  overlay.addEventListener('click',function(ev){
    // stage 밖(어두운 배경) 클릭은 무시 — 컨테이너 안만 반응
    if(ev.target&&ev.target.closest&&!ev.target.closest('.story-stage')) return;
    // 컨트롤(스킵/나가기) 버튼과 선택지 버튼은 자체 핸들러로만 진행한다.
    if(ev.target&&ev.target.closest){
      if(ev.target.closest('.story-controls')) return;
      if(ev.target.closest('.story-choice-btn')) return;
    }
    var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
    if(!scene) return;
    if(scene.type==='choice'||scene.type==='branch') return;
    if(!_campaignTypingDone){
      _campaignClearTypingTimer();
      if(_campaignTypingElement) _campaignTypingElement.textContent=_campaignTypingFullText;
      _campaignTypingDone=true;
      return;
    }
    advanceCampaignScene();
  });
  document.body.appendChild(overlay);
  // 스킵: 타이핑 중이면 즉시 완료, 끝났으면 다음 장면으로 이동
  document.getElementById('storySkipBtn').addEventListener('click',function(ev){
    ev.stopPropagation();
    if(!_campaignTypingDone){
      _campaignClearTypingTimer();
      if(_campaignTypingElement) _campaignTypingElement.textContent=_campaignTypingFullText;
      _campaignTypingDone=true;
      return;
    }
    advanceCampaignScene();
  });
  // 나가기: 챕터 진행 포기 후 오버레이 닫기
  document.getElementById('storyAbandonBtn').addEventListener('click',function(ev){
    ev.stopPropagation();
    abandonCampaignFromStory();
  });
  // 인게임은 서버에 저장된 에디터 레이아웃만 신뢰한다. 에디터 localStorage는
  // 같은 브라우저의 오래된 좌표를 되살릴 수 있어 게임 화면에서는 사용하지 않는다.
  var cachedServerLayout=_campaignCachedServerEditorLayout();
  if(cachedServerLayout) _campaignEditorLayout=_campaignComposeEditorLayout(cachedServerLayout,null);
  renderCampaignScene();
  fetch('/api/campaign/editor-layout?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
    if(d&&typeof d==='object'){
      var before=JSON.stringify(_campaignEditorLayout||{});
      _campaignStoreServerEditorLayout(d);
      _campaignEditorLayout=_campaignComposeEditorLayout(d,null);
      if(document.querySelector('.story-overlay')&&JSON.stringify(_campaignEditorLayout||{})!==before){
        renderCampaignScene();
      }
    }
  }).catch(function(){});
}

// 스토리 화면에서 "나가기" 클릭 시 호출. 진행 중인 세션을 서버에 abandon 요청한 뒤 화면을 닫는다.
async function abandonCampaignFromStory(){
  var ok=await gameConfirm({
    icon:'⚠',
    title:t('story_abandon_confirm_title'),
    body:t('story_abandon_confirm_body'),
    confirmText:t('story_abandon')
  });
  if(!ok) return;
  var w=walletState.address, a=_campaignActive;
  closeCampaignStory();
  closeCampaignModal();
  if(w&&a&&a.sessionId){
    try{
      await fetch('/api/campaign/abandon',{
        method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,session_id:a.sessionId})
      });
    }catch(e){/* 네트워크 실패는 무시한다 — 다음 진입에서 새 세션 생성 가능 */}
  }
  _campaignActive=null;
  try{ loadCampaignStatus(); }catch(_){}
}

var CAMPAIGN_ASSET_VERSION='20260502c';
function campaignAssetUrl(path){
  return path+(path.indexOf('?')>=0?'&':'?')+'v='+CAMPAIGN_ASSET_VERSION;
}

function _campaignPreloadImage(src){
  if(!src) return null;
  var cached=_campaignImageCache[src];
  if(cached) return cached;
  var img=new Image();
  img.decoding='async';
  img.src=src;
  _campaignImageCache[src]=img;
  if(img.decode) img.decode().catch(function(){});
  return img;
}

function _campaignClearTypingTimer(){
  if(_campaignTypingTimer) clearInterval(_campaignTypingTimer);
  if(_campaignTypingFrame) cancelAnimationFrame(_campaignTypingFrame);
  _campaignTypingTimer=null;
  _campaignTypingFrame=null;
}

function _campaignIsStoryMobile(){
  return !!(window.matchMedia&&window.matchMedia('(max-width:520px)').matches);
}

function _campaignMergeLayout(target,src){
  if(!src||typeof src!=='object') return target;
  Object.keys(src).forEach(function(k){
    var v=src[k];
    if(v&&typeof v==='object'&&!Array.isArray(v)&&target[k]&&typeof target[k]==='object'&&!Array.isArray(target[k])){
      _campaignMergeLayout(target[k],v);
    }else{
      target[k]=v;
    }
  });
  return target;
}

function _campaignStoryLayout(scene,line){
  var layout={};
  [_campaignEditorLayout,scene&&scene.layout,scene&&scene.editorLayout,scene&&scene.stageLayout,line&&line.layout,line&&line.editorLayout,line&&line.stageLayout].forEach(function(src){
    _campaignMergeLayout(layout,src);
  });
  var mode=_campaignIsStoryMobile()?'mobile':'desktop';
  if(layout[mode]) _campaignMergeLayout(layout,layout[mode]);
  return layout;
}

function _campaignComposeEditorLayout(serverLayout,localLayout){
  var serverAt=_campaignLayoutUpdatedAt(serverLayout);
  var localAt=_campaignLayoutUpdatedAt(localLayout);
  var localShouldWin=!!localLayout&&localAt>0&&localAt>=serverAt;
  var merged={};
  _campaignMergeLayout(merged,localShouldWin?{}:(serverLayout||{}));
  // The editor syncs on a short debounce. Local layout should only override
  // the server when it has a fresh timestamp; otherwise stale gameplay
  // localStorage can keep resurrecting old coordinates after server saves.
  if(localShouldWin) _campaignMergeLayout(merged,serverLayout||{});
  _campaignMergeLayout(merged,localShouldWin?(localLayout||{}):{});
  return Object.keys(merged).length?merged:null;
}

function _campaignLayoutUpdatedAt(layout){
  if(!layout||typeof layout!=='object') return 0;
  var raw=layout.updatedAt||layout.updated_at||layout.savedAt||layout.saved_at||0;
  if(typeof raw==='string'&&raw.indexOf('-')>=0){
    var t=Date.parse(raw);
    return isFinite(t)?t:0;
  }
  var n=Number(raw);
  return isFinite(n)?n:0;
}

function _campaignLocalEditorLayout(){
  try{
    var chars=JSON.parse(localStorage.getItem('editorCharacters')||'{}');
    var overlays=JSON.parse(localStorage.getItem('editorOverlays')||'{}');
    var dialog=JSON.parse(localStorage.getItem('editorDialog')||'null');
    var fontsize=parseFloat(localStorage.getItem('editorFontSize')||'');
    var payload={};
    if(chars&&Object.keys(chars).length) payload.characters=chars;
    if(overlays&&Object.keys(overlays).length) payload.overlays=overlays;
    if(dialog&&typeof dialog==='object') payload.dialog=dialog;
    if(isFinite(fontsize)) payload.fontsize=fontsize;
    var updatedAt=Number(localStorage.getItem('editorLayoutUpdatedAt')||'0')||0;
    if(updatedAt) payload.updatedAt=updatedAt;
    return Object.keys(payload).length?payload:null;
  }catch(_){return null;}
}

function _campaignCachedServerEditorLayout(){
  try{
    var raw=sessionStorage.getItem('campaignEditorServerLayout')||localStorage.getItem('campaignEditorServerLayout')||'';
    if(!raw) return null;
    var parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:null;
  }catch(_){return null;}
}

function _campaignStoreServerEditorLayout(layout){
  try{
    if(layout&&typeof layout==='object'){
      var raw=JSON.stringify(layout);
      sessionStorage.setItem('campaignEditorServerLayout',raw);
      localStorage.setItem('campaignEditorServerLayout',raw);
    }
  }catch(_){}
}

function _campaignLayoutPick(obj,names){
  if(!obj||typeof obj!=='object') return null;
  for(var i=0;i<names.length;i++){
    if(obj[names[i]]!==undefined&&obj[names[i]]!==null) return obj[names[i]];
  }
  return null;
}

function _campaignLayoutBox(layout,names){
  for(var i=0;i<names.length;i++){
    var v=_campaignLayoutPick(layout,[names[i]]);
    if(v&&typeof v==='object') return v;
  }
  return null;
}

function _campaignLayoutUnit(v,fallback){
  if(v===undefined||v===null||v==='') return fallback;
  if(typeof v==='number'&&isFinite(v)) return v+'%';
  if(typeof v==='string') return v;
  return fallback;
}

function _campaignLayoutNumber(v,fallback){
  if(v===undefined||v===null||v==='') return fallback;
  var n=Number(v);
  return isFinite(n)?n:fallback;
}

function _campaignLayoutHasValue(box){
  return !!(box&&typeof box==='object'&&Object.keys(box).some(function(k){return k!=='desktop'&&k!=='mobile';}));
}

function _campaignDefaultCharacterLayout(pos,count){
  if(count<=1||pos==='center') return {x:50,y:55,w:60};
  return pos==='right'?{x:72,y:55,w:50}:{x:28,y:55,w:50};
}

function _campaignResetStoryLayout(overlay){
  var bg=overlay.querySelector('.story-background');
  var left=overlay.querySelector('.story-character-left');
  var right=overlay.querySelector('.story-character-right');
  var detail=overlay.querySelector('.story-detail-overlay');
  var box=overlay.querySelector('.story-dialog-box');
  if(bg){
    // Keep the current background image visible until the next one has loaded.
    // Removing the whole style here briefly exposes the default purple/blue CSS
    // background during scene changes.
    bg.style.backgroundPosition='50% 50%';
    bg.style.backgroundSize='cover';
    bg.style.opacity='';
    bg.style.filter='';
    bg.style.transitionDuration='';
  }
  [left,right].forEach(function(el){
    if(!el) return;
    el.removeAttribute('style');
    el.className=el.classList.contains('story-character-right')?'story-character-right':'story-character-left';
    el.style.display='none';
  });
  if(detail){
    detail.removeAttribute('style');
    detail.classList.remove('visible');
  }
  if(box) box.removeAttribute('style');
}

function _campaignApplyRectLayout(el,box,opts){
  if(!el||!box) return;
  opts=opts||{};
  var x=_campaignLayoutPick(box,['x','left','cx','centerX']);
  var y=_campaignLayoutPick(box,['y','top','cy','centerY']);
  var w=_campaignLayoutPick(box,['w','width']);
  var h=_campaignLayoutPick(box,['h','height']);
  if(x!==null||y!==null){
    el.style.left=_campaignLayoutUnit(x,el.style.left||'50%');
    el.style.top=_campaignLayoutUnit(y,el.style.top||'50%');
    el.style.right='auto';
    el.style.bottom='auto';
    el.style.transform=opts.transform||'translate(-50%,-50%)';
  }
  if(box.right!==undefined){el.style.right=_campaignLayoutUnit(box.right,'auto');el.style.left='auto';}
  if(box.bottom!==undefined){el.style.bottom=_campaignLayoutUnit(box.bottom,'auto');el.style.top='auto';}
  if(w!==null) el.style.width=_campaignLayoutUnit(w,'auto');
  if(h!==null) el.style.height=_campaignLayoutUnit(h,'auto');
  if(box.z!==undefined||box.zIndex!==undefined) el.style.zIndex=String(_campaignLayoutPick(box,['z','zIndex']));
  if(box.opacity!==undefined) el.style.opacity=String(_campaignLayoutNumber(box.opacity,1));
}

function _campaignApplyCharacterLayout(el,box){
  if(!el||!box) return;
  var centerX=_campaignLayoutPick(box,['cx','centerX']);
  var centerY=_campaignLayoutPick(box,['cy','centerY']);
  var hasCenter=centerX!==null||centerY!==null;
  var hasY=_campaignLayoutPick(box,['y','top'])!==null||box.bottom!==undefined||hasCenter;
  var hasX=_campaignLayoutPick(box,['x','left'])!==null||hasCenter;
  if(hasCenter){
    _campaignApplyRectLayout(el,box,{transform:'translate(-50%,-50%)'});
    el.style.transformOrigin='50% 50%';
  }else if(hasX&&hasY){
    // Campaign editor stores character boxes as center-point percent + width.
    // Keep the game renderer on the same coordinate model so editor previews
    // and in-game scenes match exactly for every character.
    el.style.left=_campaignLayoutUnit(_campaignLayoutPick(box,['x','left']),'50%');
    el.style.top=_campaignLayoutUnit(_campaignLayoutPick(box,['y','top']),'50%');
    el.style.right='auto';
    el.style.bottom='auto';
    el.style.transform=(box.anchor==='top-left'||box.origin==='top-left')?'none':'translate(-50%,-50%)';
    el.style.transformOrigin=(box.anchor==='top-left'||box.origin==='top-left')?'0 0':'50% 50%';
  }else if(hasX&&!hasY){
    el.style.left=_campaignLayoutUnit(_campaignLayoutPick(box,['x','left','cx','centerX']),'50%');
    el.style.right='auto';
    el.style.top='auto';
    el.style.bottom='0';
    el.style.transform='translateX(-50%)';
    el.style.transformOrigin='50% 100%';
  }else{
    _campaignApplyRectLayout(el,box,{transform:'translate(-50%,-50%)'});
    el.style.transformOrigin='50% 50%';
  }
  var w=_campaignLayoutPick(box,['w','width']);
  var h=_campaignLayoutPick(box,['h','height']);
  if(w!==null) el.style.width=_campaignLayoutUnit(w,'auto');
  if(h!==null) el.style.height=_campaignLayoutUnit(h,'auto');
  el.style.maxWidth='none';
  el.style.maxHeight=hasY?'none':'92%';
  if(box.scale!==undefined){
    var scale=_campaignLayoutNumber(box.scale,1);
    var baseTransform=(!el.style.transform||el.style.transform==='none')?'':el.style.transform;
    el.style.transform=(baseTransform?baseTransform+' ':'')+'scale('+scale+')';
  }
  if(box.fit||box.objectFit) el.style.objectFit=box.fit||box.objectFit;
}

function _campaignCharacterLayout(layout,charId,pos){
  var chars=layout&&(layout.characters||layout.characterLayouts||layout.character);
  var found=null;
  if(Array.isArray(chars)){
    chars.forEach(function(c){
      if(found||!c) return;
      if(c.id===charId||c.characterId===charId||c.speaker===charId||c.position===pos) found=c;
    });
  }else if(chars&&typeof chars==='object'){
    found=chars[charId]||chars[pos]||chars[(pos==='right')?'right':'left'];
  }
  if(!found&&layout) found=layout['character_'+charId]||layout[pos+'Character'];
  return found;
}

function _campaignApplyBackgroundLayout(bg,layout){
  var box=_campaignLayoutBox(layout,['background','bg','image']);
  if(!bg||!box) return;
  var x=_campaignLayoutPick(box,['x','positionX','left']);
  var y=_campaignLayoutPick(box,['y','positionY','top']);
  if(x!==null||y!==null) bg.style.backgroundPosition=_campaignLayoutUnit(x,'50%')+' '+_campaignLayoutUnit(y,'50%');
  var size=_campaignLayoutPick(box,['size','backgroundSize','fit']);
  if(size) bg.style.backgroundSize=size;
  else if(box.scale!==undefined) bg.style.backgroundSize=_campaignLayoutNumber(box.scale,100)+'% auto';
  if(box.opacity!==undefined) bg.style.opacity=String(_campaignLayoutNumber(box.opacity,1));
}

function _campaignApplyDialogLayout(box,scene,line){
  var layout=_campaignStoryLayout(scene,line);
  var cfg=_campaignLayoutBox(layout,['dialog','dialogue','dialogBox','textbox','textBox','box']);
  if(!cfg) return;
  var centerMode=cfg.x!==undefined||cfg.cx!==undefined||cfg.centerX!==undefined||cfg.y!==undefined||cfg.cy!==undefined||cfg.centerY!==undefined;
  _campaignApplyRectLayout(box,cfg,{transform:centerMode?'translate(-50%,-50%)':'none'});
  box.style.boxSizing='border-box';
  // The editor preview uses a compact content box. The in-game default has a
  // large mobile safe-area bottom padding, so applying editor x/y/w without
  // replacing padding makes the textbox look far taller than the editor.
  box.style.padding=cfg.padding!==undefined?cfg.padding:'4% 5% 5%';
  box.style.paddingBottom=cfg.paddingBottom!==undefined?_campaignLayoutUnit(cfg.paddingBottom,'5%'):'5%';
  if(cfg.background!==undefined) box.style.background=cfg.background;
  if(cfg.border!==undefined) box.style.border=cfg.border;
  if(cfg.borderTop!==undefined) box.style.borderTop=cfg.borderTop;
}

function _campaignApplyStoryFontSize(box,scene,line){
  if(!box) return;
  var layout=_campaignStoryLayout(scene,line);
  var fs=_campaignLayoutPick(layout,['fontsize','fontSize','textSize']);
  var el=box.querySelector('.story-text');
  if(el&&fs!==null) el.style.fontSize=(typeof fs==='number'?fs+'rem':fs);
}

function _campaignStorySetBackground(scene,overlay,lineBg,line){
  // line.background 가 있으면 라인 전용 배경(전용 dedicated 씬 배경)으로 swap, 없으면 scene.background.
  // 에셋이 없거나 로드 실패하면 화성풍 그라디언트 폴백.
  var bg=overlay.querySelector('.story-background');
  if(!bg) return;
  var speed=scene.transition==='fade_slow'?'0.28s':(scene.transition==='fade_medium'?'0.18s':'0s');
  bg.style.transitionDuration=speed;
  var bgChoice=lineBg||scene.background;
  if(!bgChoice){
    bg.style.backgroundImage='linear-gradient(135deg, #1a0a2e, #2d1b4e)';
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
    return;
  }
  // 배경 ID → 파일명 매핑. 전용 에셋이 생긴 ID는 직접 참조,
  // 아직 파일이 없거나 별칭이 필요한 ID만 폴백을 유지한다.
  var _bgMap={
    // 전용 에셋 없는 ID만 폴백 유지 (184장 Codex 배치 이후 직접 파일 생긴 항목은 제거)
    'hellas_central_underground':'mcc_briefing_room',
    'hellas_outer_relay_interior':'hellas_outer_relay',
    'erebus_base_medical':'erebus_base_interior',
    'hellas_various_night':'hellas_labor_district_night',
    'mcc_25deg_lounge':'mcc_briefing_room',
    'new_athens_shipyard_launch':'new_athens_shipyard_dawn'
  };
  var bgId=_bgMap[bgChoice]||bgChoice;
  var src=campaignAssetUrl('/assets/campaign/backgrounds/'+bgId+'.png');
  if(bg.getAttribute('data-bg-src')===src){
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
    return;
  }
  var img=_campaignPreloadImage(src);
  var applyLoadedBg=function(){
    bg.style.backgroundImage='url("'+src+'")';
    bg.setAttribute('data-bg-src',src);
    _campaignApplyBackgroundLayout(bg,_campaignStoryLayout(scene,line));
  };
  if(img&&img.complete&&img.naturalWidth>0){
    applyLoadedBg();
    return;
  }
  img.onload=applyLoadedBg;
  img.onerror=function(){
    if(!bg.style.backgroundImage){
      bg.style.backgroundImage='linear-gradient(135deg, #1a0a2e, #2d1b4e)';
    }
  };
}

function _campaignStoryRenderCharacters(scene,line,overlay){
  // scene.characters가 있으면 우선 사용하고, 없으면 현재 씬 대사의 speaker에서 좌/우 초상화를 추론한다.
  var left=overlay.querySelector('.story-character-left');
  var right=overlay.querySelector('.story-character-right');
  if(!left||!right) return;
  left.style.display='none'; right.style.display='none';
  if(scene.type!=='dialogue') return;
  var chars=[];
  if(Array.isArray(scene.characters)){
    chars=scene.characters.map(function(c,i){return typeof c==='string'?{id:c,position:scene.characters.length===1?'center':(i===0?'left':'right')}:c;});
    if(chars.length===1&&!chars[0].position) chars[0].position='center';
  }else{
    var speakers=(scene.lines||[]).map(function(l){return l.speaker;}).filter(Boolean);
    speakers.forEach(function(s){if(chars.map(function(c){return c.id;}).indexOf(s)<0) chars.push({id:s,position:s==='player'?'right':'left'});});
    if(chars.length===1) chars[0].position='center';
  }
  chars.slice(0,2).forEach(function(c,i){
    var pos=c.position||(chars.length===1?'center':(i===0?'left':'right'));
    var el=pos==='right'?right:left;
    var id=c.id||c.characterId||c.speaker;
    if(!id) return;
    el.className=pos==='center'?'story-character-left story-character-center':(pos==='right'?'story-character-right':'story-character-left');
    if(line&&line.speaker&&line.speaker!==id) el.className+=' story-character-inactive';
    el.onerror=function(){el.style.display='none';};
    // 파일명이 다르거나 새 캐릭터를 기존 초상화로 임시 매핑한다
    var _portraitMap={
      'player':'player_silhouette','observer':'player_silhouette',
      'rev_hale':'hale','young_butcher':'butcher','crow':'crow',
      'liang':'liang_wei','kara_vex':'crow_reyes'
    };
    var charSrc=campaignAssetUrl('/assets/campaign/characters/'+(_portraitMap[id]||id)+'.png');
    _campaignPreloadImage(charSrc);
    el.src=charSrc;
    el.style.display='block';
    var charLayout=_campaignMergeLayout({},_campaignDefaultCharacterLayout(pos,chars.length));
    _campaignMergeLayout(charLayout,_campaignCharacterLayout(_campaignStoryLayout(scene,line),id,pos)||{});
    if(_portraitMap[id]) _campaignMergeLayout(charLayout,_campaignCharacterLayout(_campaignStoryLayout(scene,line),_portraitMap[id],pos)||{});
    _campaignMergeLayout(charLayout,c.layout||c.editorLayout||{});
    _campaignApplyCharacterLayout(el,charLayout);
  });
}

// 씬 디테일 오버레이 — line.overlay 필드 (e.g., "cv_ch10_from_flames_l00_00_fire_small")
// 가 명시된 line 에서만 중앙 closeup 표시. 한 location 의 base 배경은 그대로 두고
// overlay 만 한정적으로 점멸 → 화면 churn 없이 시각적 강조.
function _showStoryDetailOverlay(overlayName,layout){
  var el = document.querySelector('.story-detail-overlay');
  if(!el) return;
  el.classList.remove('visible');
  if(!overlayName) return;
  var src = campaignAssetUrl('/assets/campaign/backgrounds/' + overlayName + '.png');
  _campaignApplyRectLayout(el,_campaignLayoutBox(layout||{},['overlay','detailOverlay','closeup','cutin']),{transform:'translate(-50%,-50%)'});
  if(el.getAttribute('data-src') === src && el.complete && el.naturalWidth > 0){
    el.classList.add('visible');
    return;
  }
  el.setAttribute('data-src', src);
  el.onload = function(){ el.classList.add('visible'); };
  el.onerror = function(){ el.classList.remove('visible'); };
  el.src = src;
}

function _campaignPreloadSceneAssets(scene,line){
  if(!scene) return;
  var bgChoice=(line&&line.background)||scene.background;
  if(bgChoice){
    var _bgMap={
      'hellas_central_underground':'mcc_briefing_room',
      'hellas_outer_relay_interior':'hellas_outer_relay',
      'erebus_base_medical':'erebus_base_interior',
      'hellas_various_night':'hellas_labor_district_night',
      'mcc_25deg_lounge':'mcc_briefing_room',
      'new_athens_shipyard_launch':'new_athens_shipyard_dawn'
    };
    _campaignPreloadImage(campaignAssetUrl('/assets/campaign/backgrounds/'+(_bgMap[bgChoice]||bgChoice)+'.png'));
  }
  if(line&&line.overlay) _campaignPreloadImage(campaignAssetUrl('/assets/campaign/backgrounds/'+line.overlay+'.png'));
  var ids=[];
  if(Array.isArray(scene.characters)){
    scene.characters.forEach(function(c){ids.push(typeof c==='string'?c:(c&&(c.id||c.characterId||c.speaker)));});
  }else if(Array.isArray(scene.lines)){
    scene.lines.forEach(function(l){if(l&&l.speaker&&ids.indexOf(l.speaker)<0) ids.push(l.speaker);});
  }
  var map={'player':'player_silhouette','observer':'player_silhouette','rev_hale':'hale','young_butcher':'butcher','crow':'crow','liang':'liang_wei','kara_vex':'crow_reyes'};
  ids.filter(Boolean).forEach(function(id){
    _campaignPreloadImage(campaignAssetUrl('/assets/campaign/characters/'+(map[id]||id)+'.png'));
  });
}

function typeText(element,text,onComplete){
  // 클릭 즉시완료를 위해 타이머와 전체 텍스트를 전역에 보관한다.
  _campaignClearTypingTimer();
  _campaignTypingElement=element;
  _campaignTypingFullText=text||'';
  _campaignTypingDone=false;
  element.textContent='';
  var start=performance.now();
  var lastLen=0;
  var cps=48;
  function step(now){
    if(!_pageIsActive()){
      _campaignTypingFrame=null;
      _onPageVisibleOnce(function(){
        if(!_campaignTypingDone&&_campaignTypingElement===element) _campaignTypingFrame=requestAnimationFrame(step);
      });
      return;
    }
    var len=Math.min(_campaignTypingFullText.length,Math.floor((now-start)/1000*cps));
    if(len!==lastLen){
      element.textContent=_campaignTypingFullText.slice(0,len);
      lastLen=len;
    }
    if(len>=_campaignTypingFullText.length){
      _campaignClearTypingTimer();
      _campaignTypingDone=true;
      if(onComplete) onComplete();
      return;
    }
    _campaignTypingFrame=requestAnimationFrame(step);
  }
  _campaignTypingFrame=requestAnimationFrame(step);
}

function renderCampaignScene(){
  var overlay=document.querySelector('.story-overlay');
  var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
  if(!overlay||!scene){closeCampaignStory();return;}
  _campaignClearTypingTimer();
  if(_campaignBattleTimer) _clearActiveTimeout(_campaignBattleTimer);
  _campaignBattleTimer=null; _campaignTypingDone=true;
  var currentLine=null;
  if(scene.type==='dialogue'||scene.type==='narration'||scene.type==='ending'){
    currentLine=(scene.lines||[])[_campaignSceneLineIndex]||{};
  }
  _campaignResetStoryLayout(overlay);
  _campaignStorySetBackground(scene,overlay,currentLine&&currentLine.background,currentLine);
  var box=overlay.querySelector('.story-dialog-box');
  var hint=overlay.querySelector('.story-tap-hint');
  var title=overlay.querySelector('.story-title-card');
  if(title) title.remove();
  if(box){
    box.style.display='block';
    box.style.background='rgba(0,0,0,.75)';
    box.style.borderTop='1px solid rgba(255,255,255,.12)';
    box.style.backdropFilter='blur(4px)';
    try{
      var _edDlg=_campaignEditorLayout&&_campaignEditorLayout.dialog;
      if(_edDlg){
        // 에디터와 동일한 center-point 기준 transform 적용
        box.style.position='absolute';
        box.style.transform='translate(-50%,-50%)';
        box.style.left=_edDlg.x+'%';
        box.style.top=_edDlg.y+'%';
        box.style.width=_edDlg.w+'%';
        box.style.bottom='auto';
        box.style.right='auto';
      }
    }catch(_){}
  }
  if(hint) hint.style.display='block';

  if(scene.type==='narration'||scene.type==='ending'){
    var nLine=currentLine||{};
    _campaignStoryRenderCharacters(scene,nLine,overlay);
    box.style.background='transparent';
    box.style.borderTop='none';
    box.style.backdropFilter='none';
    box.innerHTML='<div class="story-text story-narration-text"></div>';
    var _nText=_campaignStoryText(nLine.text);
    _campaignApplyDialogLayout(box,scene,nLine);
    _showStoryDetailOverlay(nLine.overlay||null,_campaignStoryLayout(scene,nLine));
    _campaignApplyStoryFontSize(box,scene,nLine);
    _campaignPreloadSceneAssets(scene,nLine);
    var nNextScene=_campaignScenes[_campaignSceneIndex+1];
    var nNextLine=(scene.lines||[])[_campaignSceneLineIndex+1]||(nNextScene&&nNextScene.lines&&nNextScene.lines[0]);
    _campaignPreloadSceneAssets(nNextScene||scene,nNextLine);
    typeText(box.querySelector('.story-text'),_nText,null);
    return;
  }

  if(scene.type==='dialogue'){
    var dLine=currentLine||{};
    _campaignStoryRenderCharacters(scene,dLine,overlay);
    box.innerHTML='<div class="story-speaker-name">'+escapeHtmlSafe(_campaignStorySpeakerName(dLine.speaker||scene.speaker))+'</div><div class="story-text"></div>';
    var _dText=_campaignStoryText(dLine.text);
    _campaignApplyDialogLayout(box,scene,dLine);
    _showStoryDetailOverlay(dLine.overlay||null,_campaignStoryLayout(scene,dLine));
    _campaignApplyStoryFontSize(box,scene,dLine);
    _campaignPreloadSceneAssets(scene,dLine);
    var dNextScene=_campaignScenes[_campaignSceneIndex+1];
    var dNextLine=(scene.lines||[])[_campaignSceneLineIndex+1]||(dNextScene&&dNextScene.lines&&dNextScene.lines[0]);
    _campaignPreloadSceneAssets(dNextScene||scene,dNextLine);
    typeText(box.querySelector('.story-text'),_dText,null);
    return;
  }

  if(scene.type==='choice'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(hint) hint.style.display='none';
    var html='<div class="story-text">'+escapeHtmlSafe(_campaignStoryText(scene.prompt))+'</div><div class="story-choices">';
    (scene.choices||[]).forEach(function(choice){
      var label=_campaignStoryText(choice.text||choice.label);
      var hintText=_campaignStoryText(choice.preview_hint);
      html+='<button class="story-choice-btn" data-choice="'+escapeHtmlSafe(choice.value||choice.id||'')+'" data-next="'+escapeHtmlSafe(choice.next_scene||choice.goto||'')+'">'+escapeHtmlSafe(label+(hintText?'\n'+hintText:''))+'</button>';
    });
    html+='</div>';
    box.innerHTML=html;
    _campaignApplyDialogLayout(box,scene,null);
    Array.prototype.forEach.call(box.querySelectorAll('.story-choice-btn'),function(btn){
      btn.addEventListener('click',function(ev){
        ev.stopPropagation();
        var value=btn.getAttribute('data-choice');
        var target=btn.getAttribute('data-next');
        if(_campaignHasServerChoice(value)){
          closeCampaignStory();
          chooseCampaignOption(value);
          return;
        }
        _advanceCampaignSceneChoice(value,target);
      });
    });
    return;
  }

  if(scene.type==='branch'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(hint) hint.style.display='none';
    var opts=scene.choices||scene.options||[];
    var branchHtml='<div class="story-text">'+escapeHtmlSafe(_campaignStoryText(scene.prompt))+'</div><div class="story-choices">';
    opts.forEach(function(choice,i){
      branchHtml+='<button class="story-choice-btn" data-next="'+escapeHtmlSafe(choice.next_scene||choice.goto||i)+'">'+escapeHtmlSafe(_campaignStoryText(choice.text||choice.label))+'</button>';
    });
    branchHtml+='</div>';
    box.innerHTML=branchHtml;
    _campaignApplyDialogLayout(box,scene,null);
    Array.prototype.forEach.call(box.querySelectorAll('.story-choice-btn'),function(btn){
      btn.addEventListener('click',function(ev){
        ev.stopPropagation();
        var target=btn.getAttribute('data-next');
        var idx=/^\d+$/.test(target)?parseInt(target,10):_campaignStorySceneById(target);
        if(idx>=0&&idx<_campaignScenes.length){_campaignSceneIndex=idx;_campaignSceneLineIndex=0;renderCampaignScene();}
        else advanceCampaignScene();
      });
    });
    return;
  }

  if(scene.type==='battle_transition'){
    _campaignStoryRenderCharacters(scene,null,overlay);
    if(box) box.style.display='none';
    if(hint) hint.style.display='none';
    var card=document.createElement('div');
    card.className='story-title-card';
    card.innerHTML=escapeHtmlSafe(_campaignStoryText(scene.title))+'<small>'+escapeHtmlSafe(_campaignStoryText(scene.subtitle))+'</small>';
    overlay.appendChild(card);
    _campaignTypingDone=true;
    _campaignBattleTimer=_setActiveTimeout(function(){advanceCampaignScene();},3000);
    return;
  }

  // 아직 전투 결과 서버 응답 연동 전인 result 씬은 기존 시뮬레이션 흐름으로 넘긴다.
  if(scene.type==='result'){closeCampaignStory();if(_campaignActive)showCampaignSim(_campaignActive.chapter,_campaignActive.progress||{});return;}
  advanceCampaignScene();
}

function advanceCampaignScene(){
  var scene=_campaignScenes&&_campaignScenes[_campaignSceneIndex];
  if(!scene){_finishCampaignNoChoiceFlow();return;}
  var lines=scene.lines||[];
  if((scene.type==='dialogue'||scene.type==='narration'||scene.type==='ending')&&_campaignSceneLineIndex<lines.length-1){
    _campaignSceneLineIndex++;
    renderCampaignScene();
    return;
  }
  if(scene.type==='ending'){
    _finishCampaignNoChoiceFlow();
    return;
  }
  if(scene.next){
    var idx=_campaignStorySceneById(scene.next);
    if(idx>=0){_campaignSceneIndex=idx;_campaignSceneLineIndex=0;renderCampaignScene();return;}
  }
  _campaignSceneIndex++;
  _campaignSceneLineIndex=0;
  if(!_campaignScenes||_campaignSceneIndex>=_campaignScenes.length){_finishCampaignNoChoiceFlow();return;}
  renderCampaignScene();
}

function _campaignShouldAutoCompleteAfterStory(chapter){
  if(!chapter) return false;
  var resolution=chapter.battleResolution||'';
  return Number(chapter.chapterNumber)===0 || resolution==='none' || resolution==='cinematic_only' || resolution==='ending_evaluation_and_cinematic';
}

function _campaignFormatDuration(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  var m=Math.floor(sec/60), s=sec%60;
  return m>0?(m+'m '+String(s).padStart(2,'0')+'s'):(s+'s');
}

// 순수 스토리 챕터만 마지막 씬에서 자동 완료한다. 작전/퀘스트 챕터는 서버 진행률
// 폴링으로 넘겨야 "시작하자마자 클리어"가 되지 않는다.
function _finishCampaignNoChoiceFlow(){
  var a=_campaignActive;
  var hasChoices=a&&a.chapter&&Array.isArray(a.chapter.choices)&&a.chapter.choices.length>0;
  if(a&&a.sessionId&&!hasChoices){
    closeCampaignStory();
    if(_campaignShouldAutoCompleteAfterStory(a.chapter)) completeCampaignMission();
    else showCampaignSim(a.chapter,a.progress||{});
    return;
  }
  closeCampaignStory();
}

function closeCampaignStory(){
  // 오버레이와 타이머를 정리해 기존 캠페인 모달/시뮬레이션 흐름으로 안전하게 복귀한다.
  var overlay=document.querySelector('.story-overlay');
  if(overlay) overlay.remove();
  _campaignClearTypingTimer();
  if(_campaignBattleTimer) _clearActiveTimeout(_campaignBattleTimer);
  _campaignBattleTimer=null;
  _campaignTypingDone=false;
  _campaignTypingElement=null;
  _campaignTypingFullText='';
  _campaignScenes=null;
  _campaignSceneIndex=0;
  _campaignSceneLineIndex=0;
}

async function openCampaignChapter(questId){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return;}
  var ch=_findCampaignChapter(questId);
  if(!ch){await loadCampaignStatus();ch=_findCampaignChapter(questId);}
  if(!ch){showToast('Campaign not loaded');return;}
  var p=ch.progress||{};
  if(isCampaignProgressDone(p)) return showCampaignResult(ch,p);
  if(isCampaignProgressActive(p)&&p.sessionId){
    _campaignActive={chapter:ch,progress:p,sessionId:p.sessionId};
    if(Array.isArray(p.choices)&&p.choices.length>0) showCampaignSim(ch,p);
    else if(ch.scenes) showCampaignStory(ch);
    else showCampaignBriefing(ch,p);
    return;
  }
  try{
    var resp=await fetch('/api/campaign/start',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,quest_id:questId})});
    var d=await resp.json();
    if(!resp.ok){showCampaignStartBlocked(ch,d);return;}
    ch=d.chapter||ch; p=d.progress||{};
    _campaignActive={chapter:ch,progress:p,sessionId:d.sessionId||p.sessionId};
    if(ch.scenes) showCampaignStory(ch);
    else showCampaignBriefing(ch,p);
  }catch(e){showToast('Campaign start failed');}
}

function campaignStartErrorMessage(ch,payload){
  // [v7.170 D-M1 fix] lockReason 4언어 모두 매핑 — 기존엔 ko/en만 있어 ja/zh 사용자는 영어로 폴백됨.
  var err=(payload&&payload.error)||'Campaign start failed';
  if(err==='INSUFFICIENT_REPUTATION'){
    var faction=((payload&&payload.faction)||'').toUpperCase();
    var current=payload&&payload.current!=null?payload.current:0;
    var required=payload&&payload.required!=null?payload.required:0;
    return tl(
      'Insufficient reputation. Current '+current+', required '+required+'.',
      (faction||'평판')+' 평판이 부족합니다. 현재 '+current+', 필요 '+required+'.',
      (faction||'評判')+'評判が不足しています。現在 '+current+', 必要 '+required+'.',
      (faction||'声誉')+'声誉不足。当前 '+current+'，需要 '+required+'.'
    );
  }
  if(err==='PREREQUISITE_NOT_MET') return tl('Complete the prerequisite chapter first.','선행 챕터를 먼저 완료해야 합니다.','先行チャプターを先に完了してください。','请先完成前置章节。');
  if(err==='LEVEL_REQUIRED'){
    var requiredLevel=payload&&payload.requiredLevel!=null?payload.requiredLevel:0;
    return tl(
      requiredLevel?'Required level '+requiredLevel+' or higher.':'Required level not met.',
      requiredLevel?'레벨 '+requiredLevel+' 이상 필요합니다.':'레벨 조건이 부족합니다.',
      requiredLevel?'レベル '+requiredLevel+' 以上が必要です。':'レベル条件が不足しています。',
      requiredLevel?'需要 '+requiredLevel+' 级以上。':'等级条件不足。'
    );
  }
  if(err==='BLOCKED_BY_TAG') return tl('This chapter is blocked by your current state.','현재 상태에서는 이 챕터를 시작할 수 없습니다.','現在の状態ではこのチャプターを開始できません。','当前状态下无法开始本章节。');
  if(err==='BRANCH_REQUIRED') return tl('This chapter requires a prior route choice.','이 챕터에 필요한 이전 선택 분기가 없습니다.','このチャプターに必要な前の選択分岐がありません。','本章节缺少所需的前置选择分支。');
  if(err==='FSP_DELEGATION_ABSENT') return tl('The delegation state changed. Continue through the alternate FSP chapter.','대표단 조건이 바뀌어 대체 FSP 챕터로 진행해야 합니다.','代表団の状態が変わったため、代替FSPチャプターで進めてください。','代表团状态已变,请通过备用 FSP 章节继续。');
  if(err==='FSP_POLITICAL_COLLAPSE') return tl('The political state collapsed. Continue through the alternate FSP chapter.','정치 상황이 붕괴되어 대체 FSP 챕터로 진행해야 합니다.','政治状況が崩壊したため、代替FSPチャプターで進めてください。','政治局势已崩溃,请通过备用 FSP 章节继续。');
  return err;
}

function showCampaignStartBlocked(ch,payload){
  var npc=(ch&&ch.briefing&&ch.briefing.npcName)||'Mission Control';
  var reason=campaignStartErrorMessage(ch,payload);
  var lines=((ch&&ch.briefing||{}).lines||[]).map(function(l){return '<div class="campaign-dialog"><b>'+escapeHtmlSafe(npc)+'</b><br>'+escapeHtmlSafe(_campaignStoryText(l)||l.ko||'')+'</div>';}).join('');
  var meta='';
  if(ch&&ch.location){
    var loc=_campaignStoryText(ch.location.displayName)||ch.location.displayNameKo||ch.location.displayNameEn||'Mars';
    meta+='<div class="campaign-desc" style="margin-bottom:8px">'+escapeHtmlSafe(loc)+'</div>';
  }
  meta+='<div class="campaign-dialog" style="border-color:rgba(255,80,30,.35);color:var(--gold)">'+escapeHtmlSafe(reason)+'</div>';
  _setCampaignModal(ch, meta+lines+campaignObjectivesHtml(ch,4)+'<button class="campaign-btn" style="margin-top:12px" onclick="closeCampaignModal()">'+t('campaign_result_confirm')+'</button>');
}

function showCampaignBriefing(ch,p){
  var npc=(ch.briefing&&ch.briefing.npcName)||'Mission Control';
  var lines=((ch.briefing||{}).lines||[]).map(function(l){return '<div class="campaign-dialog"><b>'+escapeHtmlSafe(npc)+'</b><br>'+escapeHtmlSafe(_campaignStoryText(l)||l.ko||'')+'</div>';}).join('');
  var choices=(ch.choices||[]).map(function(c){
    return '<button class="campaign-choice" onclick="chooseCampaignOption(\''+escapeHtmlSafe(c.id)+'\')">'+escapeHtmlSafe(_campaignStoryText(c.label)||c.labelKo||c.id)+'</button>';
  }).join('');
  _setCampaignModal(ch, lines+campaignObjectivesHtml(ch,4)+'<div style="font-size:10px;color:var(--gold);margin:12px 0">⚠ '+escapeHtmlSafe((ch.environment&&ch.environment.type)||'operation')+' · '+t('campaign_meta_sim')+'</div>'+choices);
}

async function chooseCampaignOption(choiceId){
  var w=walletState.address, a=_campaignActive;
  if(!w||!a){showToast('Campaign session missing');return;}
  try{
    var r=await fetch('/api/campaign/choice',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId,choice_id:choiceId})});
    var d=await r.json();
    if(!r.ok){showToast(srvErr(d.error)||'Choice failed','error');return;}
    a.progress=d.progress||a.progress;
    try{loadCampaignStatus();}catch(_){}
    showCampaignSim(a.chapter,a.progress);
  }catch(e){showToast('Choice failed');}
}

function showCampaignSim(ch,p){
  _campaignClearSimTimer();
  var radio=((ch.briefing||{}).radio||[])[0];
  var _radioText=_campaignStoryText(radio)||(radio&&radio.ko)||t('campaign_sim_radio_default');
  var _npcName=escapeHtmlSafe((ch.briefing&&ch.briefing.npcName)||'Mission Control');
  _setCampaignModal(ch,
    '<div style="font-size:13px;color:var(--tx);margin-bottom:10px">'+t('campaign_sim_in_progress')+'</div>'
    +'<div class="campaign-dialog">'+_npcName+' '+t('campaign_sim_radio_prefix')+' '+escapeHtmlSafe(_radioText)+'</div>'
    +'<div class="qc-bar" style="height:10px;margin:16px 0"><div id="campaignSimFill" class="qc-fill activity" style="width:0%"></div></div>'
    +'<div id="campaignSimStatus" style="font-size:10px;color:var(--gold);text-align:center">'+t('campaign_sim_syncing')+'</div>'
    +'<div id="campaignSimDetail" style="font-size:8px;color:var(--tx3);text-align:center;margin-top:6px">'+t('campaign_sim_detail')+'</div>'
    +'<div id="campaignSimObjectives" style="margin-top:12px"></div>');
  pollCampaignProgress(true);
}

async function pollCampaignProgress(immediate){
  _campaignClearSimTimer();
  var w=walletState.address, a=_campaignActive;
  if(!w||!a||!a.sessionId) return;
  if(!_pageIsActive()||!_campaignSimIsOpen()) return;
  try{
    var r=await fetch('/api/campaign/progress',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId})});
    var d=await r.json();
    if(!r.ok){showToast(srvErr(d.error)||'Campaign progress failed','error');return;}
    a.progress=d.progress||a.progress;
    var preview=d.preview||{};
    var pct=Math.max(0,Math.min(100,Number(preview.progressPct||preview.oxygenRecoveryPct||0)));
    var fill=document.getElementById('campaignSimFill');
    var status=document.getElementById('campaignSimStatus');
    var detail=document.getElementById('campaignSimDetail');
    var objectivesEl=document.getElementById('campaignSimObjectives');
    var objectives=Array.isArray(d.objectives)?d.objectives:(Array.isArray(preview.objectives)?preview.objectives:[]);
    var missing=Array.isArray(d.missingObjectives)?d.missingObjectives:(Array.isArray(preview.missingObjectives)?preview.missingObjectives:[]);
    if(fill) fill.style.width=pct+'%';
    if(status) status.textContent=(LANG==='ko'?'작전 진행률 ':LANG==='ja'?'作戦進行率 ':LANG==='zh'?'作战进度 ':'Operation progress ')+Math.round(pct)+'%';
    var _remLbl=LANG==='ko'?'남은 시간':LANG==='ja'?'残り時間':LANG==='zh'?'剩余时间':'Time left';
    var _elLbl=LANG==='ko'?'경과':LANG==='ja'?'経過':LANG==='zh'?'已经过':'Elapsed';
    if(detail) detail.textContent=_remLbl+' '+_campaignFormatDuration(preview.remainingSec||0)+' · '+_elLbl+' '+_campaignFormatDuration(preview.elapsedSec||0);
    var _objWarnMsg=LANG==='ko'?'남은 목표를 완료해야 결과를 받을 수 있습니다.':LANG==='ja'?'残りの目標を完了してください。':LANG==='zh'?'请先完成剩余目标。':'Complete remaining objectives first.';
    if(objectivesEl&&objectives.length){
      objectivesEl.innerHTML=(pct>=100&&missing.length?'<div style="font-size:10px;color:var(--gold);margin-bottom:6px;text-align:center">'+_objWarnMsg+'</div>':'')
        +campaignObjectivesHtml({objectives:objectives},4);
    }
    if(preview.readyToComplete){
      completeCampaignMission();
      return;
    }
    if(pct>=100&&missing.length){
      if(status) status.textContent=t('campaign_objectives_gate');
      if(detail) detail.textContent=missing[0]?(_campaignStoryText(missing[0].label)||missing[0].labelKo||t('campaign_objectives_gate_sub')):t('campaign_objectives_gate_sub');
      _scheduleCampaignProgress(5000);
      return;
    }
    _scheduleCampaignProgress(immediate?1200:3000);
  }catch(e){
    _scheduleCampaignProgress(5000);
  }
}

_onPageVisible(function(){
  if(_campaignSimIsOpen()&&_campaignActive&&_campaignActive.sessionId&&!_campaignSimTimer){
    pollCampaignProgress(true);
  }
});

async function completeCampaignMission(){
  var w=walletState.address, a=_campaignActive;
  if(!w||!a) return;
  try{
    var r=await fetch('/api/campaign/complete',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,session_id:a.sessionId})});
    var d=await r.json();
    if(!r.ok){
      if(d.error==='MISSION_IN_PROGRESS'){
        showCampaignSim(a.chapter,a.progress||{});
        return;
      }
      if(d.error==='OBJECTIVE_REQUIREMENTS_NOT_MET'){
        var objectives=d.objectives||(d.chapter&&d.chapter.objectives)||d.missingObjectives||[];
        var html='<div style="font-size:13px;color:var(--gold);margin-bottom:8px">'+t('campaign_objectives_gate')+'</div>'
          +'<div class="campaign-dialog">'+t('campaign_objectives_gate_sub')+'</div>'
          +campaignObjectivesHtml({objectives:objectives},5)
          +'<button class="campaign-btn" style="margin-top:12px" onclick="showCampaignSim(_campaignActive.chapter,_campaignActive.progress||{})">'+t('campaign_result_recheck')+'</button>';
        _setCampaignModal(d.chapter||a.chapter,html);
        return;
      }
      showToast(srvErr(d.error)||'Campaign complete failed','error');return;
    }
    showCampaignResult(a.chapter,d.progress,d);
    loadCampaignStatus();
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast('Campaign complete failed');}
}

function showCampaignResult(ch,p,result){
  var m=(result&&result.metrics)||p.metrics||{};
  var rw=(result&&result.rewards)||p.rewards||{};
  var ok=(result&&result.success)!==false && campaignProgressStatus(p)!=='failed';
  var html='<div style="font-size:18px;color:'+(ok?'var(--gn)':'var(--mars)')+';font-weight:900;margin-bottom:10px">'+(ok?t('campaign_result_success'):t('campaign_result_failure'))+'</div>';
  html+=campaignStatsHtml(m,campaignStatusLabel(p,'RESULT')).replace('campaign-stats','campaign-result-grid');
  html+='<div class="campaign-dialog"><b>'+escapeHtmlSafe((ch.briefing&&ch.briefing.npcName)||'Mission Control')+'</b><br>'+(ok?t('campaign_result_npc_success'):t('campaign_result_npc_failure'))+'</div>';
  html+='<div style="font-size:11px;color:var(--gold);line-height:1.8">'+t('campaign_result_reward')+' +'+(rw.GP||0)+' GP · +'+(rw.XP||0)+' XP'+((rw.items&&rw.items.length)?' · Blueprint queued':'')+'</div>';
  html+='<button class="campaign-btn" style="margin-top:12px" onclick="closeCampaignModal()">'+t('campaign_result_confirm')+'</button>';
  _setCampaignModal(ch,html);
}

// ═══ QUEST SYSTEM ═══
var _questPoolData={active:true,multiplier:1};
function loadQuests(wallet){
  var container=document.getElementById('questsList');
  var loading=document.getElementById('questsLoading');
  var claimedDiv=document.getElementById('questsClaimed');
  if(!container) return;
  loading.style.display='block';
  fetch('/api/quests', { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(data){
      loading.style.display='none';
      if(data.pool) _questPoolData=data.pool;
      loadCampaignStatus();
      renderQuests(data.quests||[], container);
      renderClaimedQuests(data.recentlyClaimed||[], claimedDiv);
    })
    .catch(function(){
      loading.style.display='none';
      container.innerHTML='<div style="text-align:center;padding:16px;color:var(--tx3);font-size:var(--fs-xs)">'+t('quests_failed')+'</div>';
    });
}

function renderQuests(quests, container){
  if(quests.length===0){
    container.innerHTML='<div style="text-align:center;padding:24px;color:var(--tx3);font-size:var(--fs-xs)">'+t('quests_none_active')+'</div>';
    return;
  }
  var html='';
  // [v7.354] quest_reward_pool 폐지 — 풀 상태 경고 제거(보상은 항상 GP 전액 지급).
  var currentTier='';
  var tierNames={free:t('quests_tier_free'),activity:t('quests_tier_activity'),spending:t('quests_tier_spending')};
  quests.forEach(function(q){
    if(q.tier!==currentTier){
      currentTier=q.tier;
      html+='<div class="quest-section-title">'+tierNames[q.tier]+'</div>';
    }
    var isComplete=q.status==='completed';
    var timeLeft=getTimeLeft(q.expires_at);
    var displayReward=q.reward_gp!==undefined?q.reward_gp:(q.actual_reward!==undefined?q.actual_reward:q.reward_pp);
    html+='<div class="quest-card'+(isComplete?' completed':'')+'" data-qid="'+q.id+'">';
    html+='<div class="qc-header">';
    html+='<span class="quest-tier-label '+q.tier+'">'+q.tier.toUpperCase()+'</span>';
    html+='<span class="qc-title">'+_questTitle(q)+'</span>';
    if(displayReward>0){
      html+='<span class="qc-reward">+'+Math.round(displayReward).toLocaleString()+' GP</span>';
    }else{
      html+='<span class="qc-reward" style="color:var(--tx3)">—</span>';
    }
    html+='</div>';
    html+='<div class="qc-desc">'+_questDesc(q)+'</div>';
    html+='<div class="qc-progress">';
    html+='<div class="qc-bar"><div class="qc-fill '+q.tier+'" style="width:'+q.progress_pct+'%"></div></div>';
    html+='<span class="qc-pct">'+q.progress_pct+'%</span>';
    html+='</div>';
    if(isComplete&&displayReward>0){
      html+='<button class="qc-claim-btn" onclick="claimQuest('+q.id+')">'+t('quests_claim_prefix')+' +'+Math.round(displayReward).toLocaleString()+' GP</button>';
    }else if(isComplete){
      html+='<div style="text-align:center;padding:6px;font-size:10px;color:var(--tx3)">'+t('quests_pool_empty_unavailable')+'</div>';
    }
    html+='<div class="qc-expire">'+timeLeft+'</div>';
    html+='</div>';
  });
  container.innerHTML=html;
  // Update quest dot when any quest is claimable
  var hasClaimableQuest = quests.some(function(q){ return q.status==='completed'; });
  if(hasClaimableQuest) { setBaseTabDot('quests', true); _updateBaseBtnDot(); }
}

function renderClaimedQuests(claimed, container){
  if(!claimed||claimed.length===0){container.innerHTML='';return}
  var html='<div class="quest-section-title">'+t('quests_recently_completed')+'</div>';
  claimed.forEach(function(c){
    html+='<div class="quest-claimed-item">';
    html+='<span class="qci-check">✓</span>';
    html+='<span>'+_questTitle(c)+'</span>';
    html+='<span class="qci-reward">+'+Math.round(c.reward_gp!=null?c.reward_gp:c.reward_pp).toLocaleString()+' GP</span>';
    html+='</div>';
  });
  container.innerHTML=html;
}

function getTimeLeft(expiresAt){
  var diff=new Date(expiresAt)-Date.now();
  if(diff<=0) return t('quests_expired');
  var h=Math.floor(diff/3600000);
  var m=Math.floor((diff%3600000)/60000);
  if(h>0) return h+'h '+m+'m '+t('quests_remaining');
  return m+'m '+t('quests_remaining');
}

async function claimQuest(questId){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('quests_login_first'));return}
  var btn=document.querySelector('.quest-card[data-qid="'+questId+'"] .qc-claim-btn');
  if(btn){btn.disabled=true;btn.textContent=t('quests_claiming');}
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/quests/'+questId+'/claim',{
      method:'POST',headers:headers,
      body:JSON.stringify({wallet:w})
    });
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||t('quests_claim_failed'));try{_sfx.error()}catch(e){}return}
    showToast(t('quests_claim_success').replace('{gp}',Math.round(d.rewardGP!=null?d.rewardGP:d.rewardPP).toLocaleString()).replace('{title}',_questTitle(d)));
    try{_sfx.harvest()}catch(e){}
    loadQuests(w); // Refresh
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error'))}
  finally{if(btn){btn.disabled=false;btn.textContent=t('quests_claim_btn')}}
}

// Track quest progress on user actions
function trackQuestAction(action, amount){
  var w=walletState.address;
  if(!w) return;
  var headers={'Content-Type':'application/json'};
  if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
  fetch('/api/quests/track',{
    method:'POST',headers:headers,
    body:JSON.stringify({wallet:w,action:action,amount:amount||1})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.quests){
      var anyCompleted = false;
      d.quests.forEach(function(q){
        if(q.justCompleted){
          anyCompleted = true;
          showToast(t('quests_completed_toast').replace('{title}',_questTitle(q)));
          try{_sfx.notification()}catch(e){}
        }
      });
      if(anyCompleted){ setBaseTabDot('quests', true); _updateBaseBtnDot(); }
    }
  }).catch(function(){});
}

// ── GP Activity Log (Migration 097) ──
var _gpActivityLoaded = false;
function toggleGpActivityLog(){
  var panel=document.getElementById('gpActivityPanel');
  var toggle=document.getElementById('gpActivityToggle');
  if(panel.style.display==='none'){
    panel.style.display='';toggle.textContent='▲';
    if(!_gpActivityLoaded){loadGpActivity();}
  } else {panel.style.display='none';toggle.textContent='▼';}
}
async function loadGpActivity(){
  var w=walletState.address;
  var el=document.getElementById('gpActivityList');
  if(!w){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px" data-i18n="gp_activity_login">Login to view GP activity.</div>';applyI18n(el);return;}
  try{
    var r=await fetch('/api/gp/activity?limit=15',{headers:getAuthHeaders()});
    var d=await r.json();
    if(!d.entries||!d.entries.length){
      el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px" data-i18n="gp_activity_empty">No GP activity yet.</div>';applyI18n(el);
      _gpActivityLoaded=true;return;
    }
    var SOURCE_LABEL={'daily_login':'Daily Login','mission_reward':'Mission','enhance':'Enhancement','ship_build':'Ship Build','ship_upgrade':'Ship Upgrade','battle_stake':'Battle Stake','battle_win':'Battle Win','marketplace_buy':'Market Buy','marketplace_sell':'Market Sell','marketplace_list':'Listing Fee','auction_list':'Auction Fee','auction_bid':'Auction Bid','auction_buy':'Auction Buy','auction_sell':'Auction Sold','gp_transfer_out':'Sent GP','gp_transfer_in':'Received GP'};
    var html='';
    d.entries.forEach(function(e){
      var plus=e.delta>0;
      var amt=(plus?'+':'')+Math.floor(e.delta)+' GP';
      var clr=plus?'var(--gn)':'var(--mars)';
      var lbl=SOURCE_LABEL[e.source]||e.source;
      var note=e.note?(' · '+e.note):'';
      var dt=new Date(e.created_at);
      var dtStr=(dt.getMonth()+1)+'/'+(dt.getDate())+' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0');
      html+='<div class="stat-row" style="font-size:9px;opacity:.95"><span class="stat-label" style="color:var(--tx3);font-size:9px">'+lbl+note+'<br><span style="opacity:.6">'+dtStr+'</span></span><span class="stat-val" style="color:'+clr+';font-size:10px;font-weight:700">'+amt+'</span></div>';
    });
    el.innerHTML=html;
    _gpActivityLoaded=true;
  }catch(e){el.innerHTML='<div style="text-align:center;color:var(--mars);padding:8px;font-size:9px">Failed to load</div>';}
}

// ── GP Transfer (Migration 102) ──
var _gpTransferLoaded = false;

function toggleSendGP(){
  var panel  = document.getElementById('sendGPPanel');
  var toggle = document.getElementById('sendGPToggle');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = ''; toggle.textContent = '▲';
    if (!_gpTransferLoaded) loadGPTransfers();
  } else {
    panel.style.display = 'none'; toggle.textContent = '▼';
  }
}

async function loadGPTransfers() {
  var w = walletState.address;
  var el = document.getElementById('gpTransferList');
  if (!el) return;
  if (!w) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">Connect wallet to view.</div>'; return; }
  try {
    var r = await fetch('/api/gp/transfers', { headers: getAuthHeaders() });
    var d = await r.json();
    var transfers = d.transfers || [];
    if (!transfers.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">' + (t('gp_transfer_empty') || 'No transfers yet.') + '</div>';
      _gpTransferLoaded = true; return;
    }
    var html = '<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">' + (t('gp_transfer_history') || 'TRANSFER HISTORY') + '</div>';
    transfers.forEach(function(tr) {
      var isSent = (tr.from_wallet || '').toLowerCase() === w.toLowerCase();
      var counterNick = isSent ? (tr.to_nick || tr.to_wallet.slice(0,8)+'…') : (tr.from_nick || tr.from_wallet.slice(0,8)+'…');
      var sign = isSent ? '-' : '+';
      var clr  = isSent ? 'var(--mars)' : 'var(--gn)';
      var dir  = isSent ? '→ ' : '← ';
      var note = tr.note ? (' · <span style="opacity:.7">' + tr.note + '</span>') : '';
      var dt   = new Date(tr.created_at);
      var dtStr = (dt.getMonth()+1) + '/' + dt.getDate() + ' ' + dt.getHours().toString().padStart(2,'0') + ':' + dt.getMinutes().toString().padStart(2,'0');
      html += '<div class="stat-row" style="font-size:9px">'
        + '<span class="stat-label" style="color:var(--tx3);font-size:8px">' + dir + counterNick + note + '<br><span style="opacity:.6">' + dtStr + '</span></span>'
        + '<span class="stat-val" style="color:' + clr + ';font-size:10px;font-weight:700">' + sign + Math.floor(tr.amount) + ' GP</span>'
        + '</div>';
    });
    el.innerHTML = html;
    _gpTransferLoaded = true;
  } catch (err) {
    if (el) el.innerHTML = '<div style="color:var(--mars);font-size:9px;padding:4px">Failed to load.</div>';
  }
}

async function sendGP() {
  var w = walletState.address;
  if (!w) { showToast(t('connect_wallet') || 'Connect wallet first', 'error'); return; }
  var recipient = (document.getElementById('sendGPRecipient').value || '').trim();
  var amount    = parseFloat(document.getElementById('sendGPAmount').value);
  var note      = (document.getElementById('sendGPNote').value || '').trim();
  if (!recipient) { showToast(t('gp_send_no_recipient') || 'Enter recipient', 'error'); return; }
  if (!amount || amount <= 0) { showToast(t('gp_send_invalid_amount') || 'Enter a valid amount', 'error'); return; }

  gameConfirm({
    title: t('gp_send_title') || '💸 SEND GP', icon: '💸',
    body: '<div style="font-size:10px;color:#5cbbff;margin-bottom:8px">→ ' + recipient + '</div>'
      + (note ? '<div style="font-size:9px;color:var(--tx3);margin-bottom:4px">"' + note + '"</div>' : ''),
    info: [{ k: t('gp_send_amount_label') || 'Amount', v: amount + ' GP' }],
    confirmText: '💸 ' + (t('gp_send_btn') || 'SEND')
  }).then(async function(ok) {
    if (!ok) return;
    try {
      var r = await fetch('/api/gp/transfer', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, toWallet: recipient, amount: amount, note: note })
      });
      var d = await r.json();
      if (d.error) { showToast(d.error, 'error'); return; }
      showToast('💸 ' + amount + ' GP → ' + (d.toNick || recipient));
      // Clear form
      document.getElementById('sendGPRecipient').value = '';
      document.getElementById('sendGPAmount').value = '';
      document.getElementById('sendGPNote').value = '';
      refreshBalance();
      _gpTransferLoaded = false;
      loadGPTransfers();
    } catch (err) {
      showToast('Transfer failed', 'error');
    }
  });
}

// ── LOTTERY (Migration 105) ─────────────────────────────────────────────────
var _lotteryPanelOpen = true; // [v7.318] 기본 펼침 — 자동 운영 컨텐츠 노출
var _lotteryCountdownTimer = null;

function toggleLottery() {
  _lotteryPanelOpen = !_lotteryPanelOpen;
  document.getElementById('lotteryPanel').style.display = _lotteryPanelOpen ? '' : 'none';
  document.getElementById('lotteryToggle').textContent = _lotteryPanelOpen ? '▲' : '▼';
  if (_lotteryPanelOpen) loadLottery();
}

function loadLottery() {
  var el = document.getElementById('lotteryContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Loading...</div>';
  var wallet = walletState.address || '';

  fetch('/api/lottery/current', { headers: getAuthHeaders() })
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var round = data.round;
      if (!round) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px" data-i18n="lottery_disabled">Lottery is currently disabled</div>';
        return;
      }
      renderLotteryPanel(round);
    })
    .catch(function() {
      el.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:10px;padding:8px">Failed to load</div>';
    });
}

function renderLotteryPanel(round) {
  var el = document.getElementById('lotteryContent');
  if (!el) return;

  // Clear existing timer
  if (_lotteryCountdownTimer) { _clearActiveInterval(_lotteryCountdownTimer); _lotteryCountdownTimer = null; }

  var endsAt = new Date(round.ends_at);
  var prize = parseFloat(round.prize_pool_gp) || 0;
  var userTickets = parseInt(round.user_tickets) || 0;
  var maxTickets = parseInt(round.max_per_user) || 50;
  var ticketPrice = parseFloat(round.ticket_price || round.ticket_price_gp) || 10;

  var html = '<div style="background:linear-gradient(135deg,rgba(255,209,102,.08),rgba(160,100,220,.06));border:1px solid rgba(255,209,102,.2);border-radius:8px;padding:10px;margin-bottom:8px">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
    + '<div><div style="font-size:8px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px" data-i18n="lottery_round">Round #' + round.round_number + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:var(--gold);font-family:var(--fn)">' + Math.round(prize) + '<span style="font-size:10px;margin-left:2px">GP</span></div>'
    + '<div style="font-size:8px;color:var(--tx3)">' + round.ticket_count + ' tickets sold</div></div>'
    + '<div style="text-align:right"><div style="font-size:8px;color:var(--tx3)" data-i18n="lottery_ends">Ends in</div>'
    + '<div id="lotteryCountdown" style="font-size:11px;color:var(--cyan);font-family:var(--fn);font-weight:700">...</div>'
    + '<div style="font-size:8px;color:var(--tx3)">' + ticketPrice + ' GP / ticket</div></div></div>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<button onclick="quickBuyTickets(1)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+1</button>'
    + '<button onclick="quickBuyTickets(5)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+5</button>'
    + '<button onclick="quickBuyTickets(10)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+10</button>'
    + '<div style="text-align:center;font-size:8px;color:var(--tx3);padding:0 4px">My<br><span style="font-size:11px;color:var(--gold);font-weight:700">' + userTickets + '</span></div>'
    + '</div></div>';

  // Recent winners
  var winners = round.recent_winners || [];
  if (winners.length) {
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px" data-i18n="lottery_recent_winners">RECENT WINNERS</div>';
    html += '<div style="font-size:9px;color:var(--tx2);line-height:1.8">';
    winners.forEach(function(w) {
      var nick = w.winner_nick || (w.winner_wallet||'').slice(0,8)+'...';
      html += '<div style="display:flex;justify-content:space-between"><span>🏆 ' + nick + '</span><span style="color:var(--gold)">+' + Math.round(parseFloat(w.prize_pool_gp)) + ' GP</span></div>';
    });
    html += '</div>';
  }

  // 지난 회차 / 내 티켓 — 접힘 섹션
  html += '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px">'
    + '<div onclick="toggleLotteryHistory()" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:9px;color:var(--gold);font-weight:700;letter-spacing:0.5px">'
    + '<span>' + tl('PAST ROUNDS / MY TICKETS','지난 회차 / 내 티켓','過去のラウンド / マイチケット','往期 / 我的彩票') + '</span>'
    + '<span id="lotteryHistoryToggle">▼</span></div>'
    + '<div id="lotteryHistoryContent" style="display:none;margin-top:6px"></div>'
    + '</div>';

  el.innerHTML = html;

  // Countdown timer
  function updateCountdown() {
    var rem = Math.max(0, endsAt - new Date());
    var h = Math.floor(rem / 3600000);
    var m = Math.floor((rem % 3600000) / 60000);
    var s = Math.floor((rem % 60000) / 1000);
    var cdEl = document.getElementById('lotteryCountdown');
    if (cdEl) cdEl.textContent = (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
    if (rem <= 0) {
      _clearActiveInterval(_lotteryCountdownTimer);
      _lotteryCountdownTimer = null;
      // Auto-reload after draw
      _setActiveTimeout(loadLottery, 5000);
    }
  }
  updateCountdown();
  _lotteryCountdownTimer = _setActiveInterval(updateCountdown, 1000);
}

function quickBuyTickets(count) {
  if (!walletState.address) return showToast('Connect wallet first', 'error');
  var btn = event.target;
  btn.disabled = true;

  fetch('/api/lottery/buy', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: walletState.address, count: count })
  })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      if (d.error) return showToast(d.error, 'error');
      showToast('+' + count + ' ticket(s)! Spent ' + d.totalCost + ' GP 🎰', 'success');
      loadLottery();
      loadWalletData(); // refresh GP balance
    })
    .catch(function(e) {
      btn.disabled = false;
      showToast('Error: ' + e.message, 'error');
    });
}

var _lotteryHistoryOpen = false;
function toggleLotteryHistory() {
  _lotteryHistoryOpen = !_lotteryHistoryOpen;
  var c = document.getElementById('lotteryHistoryContent');
  var tg = document.getElementById('lotteryHistoryToggle');
  if (!c) return;
  c.style.display = _lotteryHistoryOpen ? '' : 'none';
  if (tg) tg.textContent = _lotteryHistoryOpen ? '▲' : '▼';
  if (_lotteryHistoryOpen) loadLotteryHistory();
}

function loadLotteryHistory() {
  var c = document.getElementById('lotteryHistoryContent');
  if (!c) return;
  c.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:9px;padding:8px">Loading...</div>';
  var wallet = walletState.address || '';
  var reqs = [fetch('/api/lottery/history?limit=10').then(function(r){ return r.json(); }).catch(function(){ return { history: [] }; })];
  reqs.push(wallet
    ? fetch('/api/lottery/my-tickets', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }).catch(function(){ return { tickets: [] }; })
    : Promise.resolve({ tickets: [] }));
  Promise.all(reqs).then(function(res) {
    var history = (res[0] && res[0].history) || [];
    var tickets = (res[1] && res[1].tickets) || [];
    var html = '';

    // 내 티켓
    html += '<div style="font-size:9px;color:var(--cyan);font-weight:700;margin-bottom:4px">' + tl('MY TICKETS','내 티켓','マイチケット','我的彩票') + '</div>';
    if (!wallet) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0 6px">' + tl('Connect wallet to view','지갑 연결 필요','ウォレット接続が必要','请连接钱包') + '</div>';
    } else if (!tickets.length) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0 6px">' + tl('No tickets yet','보유 티켓 없음','チケットなし','暂无彩票') + '</div>';
    } else {
      html += '<div style="font-size:9px;color:var(--tx2);line-height:1.7;margin-bottom:6px">';
      tickets.forEach(function(tk) {
        var rn = tk.round_number != null ? tk.round_number : '?';
        var stat = tk.round_status || '';
        var won = stat === 'completed' && wallet && tk.winner_wallet && tk.winner_wallet.toLowerCase() === wallet.toLowerCase();
        var tag = won ? '<span style="color:var(--gold)">🏆 ' + tl('WON','당첨','当選','中奖') + '</span>'
          : (stat === 'open' ? '<span style="color:var(--cyan)">' + tl('OPEN','진행중','進行中','进行中') + '</span>'
          : '<span style="color:var(--tx3)">' + (stat === 'cancelled' ? tl('CANCELLED','취소','キャンセル','已取消') : tl('CLOSED','종료','終了','已结束')) + '</span>');
        html += '<div style="display:flex;justify-content:space-between"><span>#' + rn + '</span>' + tag + '</div>';
      });
      html += '</div>';
    }

    // 지난 회차
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px">' + tl('PAST ROUNDS','지난 회차','過去のラウンド','往期') + '</div>';
    if (!history.length) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0">' + tl('No past rounds','지난 회차 없음','過去のラウンドなし','暂无往期') + '</div>';
    } else {
      html += '<div style="font-size:9px;color:var(--tx2);line-height:1.7">';
      history.forEach(function(h) {
        var rn = h.round_number != null ? h.round_number : '?';
        var prize = Math.round(parseFloat(h.prize_pool_gp) || 0);
        var nick = h.winner_nick || (h.winner_wallet ? (h.winner_wallet.slice(0,6) + '...') : (h.status === 'cancelled' ? tl('cancelled','취소됨','キャンセル','已取消') : '—'));
        html += '<div style="display:flex;justify-content:space-between"><span>#' + rn + ' · ' + nick + '</span><span style="color:var(--gold)">' + prize + ' GP</span></div>';
      });
      html += '</div>';
    }

    c.innerHTML = html;
  }).catch(function() {
    c.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:9px;padding:8px">Failed to load</div>';
  });
}


// ── GP STAKING (Migration 107) ──────────────────────────────────────────────
var _stakingPanelOpen = false;
var _stakingInfo = null;

function toggleStaking() {
  _stakingPanelOpen = !_stakingPanelOpen;
  document.getElementById('stakingPanel').style.display = _stakingPanelOpen ? '' : 'none';
  document.getElementById('stakingToggle').textContent = _stakingPanelOpen ? '▲' : '▼';
  if (_stakingPanelOpen) loadStakingPanel();
}

function loadStakingPanel() {
  var el = document.getElementById('stakingContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Loading...</div>';
  var wallet = walletState.address || '';

  Promise.all([
    fetch('/api/staking/info', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }),
    wallet ? fetch('/api/staking/my-stakes', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }) : Promise.resolve({ stakes: [] }),
    fetch('/api/dividends/info', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }).catch(function(){ return null; })
  ])
    .then(function(results) {
      _stakingInfo = results[0];
      var stakes = results[1].stakes || [];
      var divInfo = results[2];
      if (!_stakingInfo.enabled) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Staking currently disabled</div>';
        return;
      }
      renderStakingPanel(_stakingInfo, stakes, divInfo);
    })
    .catch(function() {
      el.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:10px;padding:8px">Failed to load</div>';
    });
}

function renderStakingPanel(info, stakes, divInfo) {
  var el = document.getElementById('stakingContent');
  if (!el) return;

  var opts = info.lock_days_options || [7, 14, 30];
  var bonuses = info.bonus_multipliers || {};
  var yields = info.yield_per_1000 || {};
  var apy = info.apy_pct || 15;

  // Build lock options
  var optsHtml = opts.map(function(d) {
    var mult = bonuses[d] || 1;
    var yld  = (yields[d] || 0).toFixed(2);
    var label = d === 30 ? '🔥' : d === 14 ? '⭐' : '';
    return '<div onclick="selectLockDays(this,' + d + ')" data-days="' + d + '" class="stake-day-opt" style="flex:1;text-align:center;padding:8px 4px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:all .2s">'
      + '<div style="font-size:11px;color:var(--gold);font-weight:700">' + label + d + 'd</div>'
      + '<div style="font-size:8px;color:var(--tx3)">×' + mult.toFixed(1) + '</div>'
      + '<div style="font-size:8px;color:var(--gn)">+' + yld + '/1k</div>'
      + '</div>';
  }).join('');

  var html = '<div style="background:linear-gradient(135deg,rgba(91,184,232,.08),rgba(76,216,154,.05));border:1px solid rgba(91,184,232,.2);border-radius:8px;padding:10px;margin-bottom:8px">'
    + '<div style="font-size:8px;color:var(--tx3);margin-bottom:6px;letter-spacing:1px">APY: <span style="color:var(--gn);font-weight:700">' + apy + '%</span> &nbsp;|&nbsp; Active: <span style="color:var(--cyan)">' + (info.active_stakes || 0) + '/' + (info.max_active || 5) + '</span></div>'
    + '<div style="display:flex;gap:4px;margin-bottom:10px">' + optsHtml + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
    + '<input type="number" id="stakeAmountInput" min="' + (info.min_amount||100) + '" max="' + (info.max_amount||10000) + '" placeholder="' + (info.min_amount||100) + '–' + (info.max_amount||10000) + ' GP" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:11px;padding:8px 10px;border-radius:6px;font-family:var(--fn)">'
    + '<div id="stakeYieldPreview" style="font-size:10px;color:var(--gn);min-width:60px;text-align:center"></div>'
    + '</div>'
    + '<button onclick="doStake()" style="width:100%;padding:10px;border-radius:6px;background:linear-gradient(135deg,rgba(91,184,232,.25),rgba(76,216,154,.2));border:1px solid rgba(91,184,232,.35);color:#fff;font-family:var(--fn);font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px" data-i18n="staking_stake_btn">💎 STAKE GP</button>'
    + '</div>';

  // Active stakes list
  var activeStakes = stakes.filter(function(s){ return s.status === 'active' || s.status === 'ready'; });
  var pastStakes   = stakes.filter(function(s){ return s.status === 'withdrawn'; }).slice(0, 3);

  if (activeStakes.length) {
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px;letter-spacing:1px">ACTIVE STAKES</div>';
    activeStakes.forEach(function(s) {
      var isReady = s.status === 'ready';
      var secsRem = parseFloat(s.seconds_remaining) || 0;
      var timeStr;
      if (isReady || secsRem <= 0) {
        timeStr = '<span style="color:var(--gn);font-weight:700">✅ READY</span>';
      } else {
        var h = Math.floor(secsRem / 3600);
        var d2 = Math.floor(secsRem / 86400);
        timeStr = d2 > 0 ? d2 + 'd ' + (h % 24) + 'h' : h + 'h ' + Math.floor((secsRem % 3600)/60) + 'm';
      }
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,.07)">'
        + '<div><div style="font-size:11px;color:var(--tx);font-weight:700">' + Math.round(s.amount) + ' GP <span style="font-size:9px;color:var(--tx3)">locked ' + s.lock_days + 'd</span></div>'
        + '<div style="font-size:9px;color:var(--gn)">+' + s.yield_earned.toFixed(2) + ' GP yield</div></div>'
        + '<div style="text-align:right">'
        + (isReady ? '<button onclick="doWithdraw(' + s.id + ')" style="font-size:9px;padding:5px 10px;background:rgba(76,216,154,.2);border:1px solid rgba(76,216,154,.35);color:var(--gn);border-radius:5px;cursor:pointer;font-weight:700">WITHDRAW</button>' : '<div style="font-size:9px">' + timeStr + '</div>')
        + '</div></div>';
    });
  }

  if (pastStakes.length) {
    html += '<div style="font-size:9px;color:var(--tx3);margin-top:6px;margin-bottom:4px;letter-spacing:1px">RECENT WITHDRAWALS</div>';
    pastStakes.forEach(function(s) {
      html += '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:9px;color:var(--tx3)">'
        + '<span>' + Math.round(s.amount) + ' GP × ' + s.lock_days + 'd</span>'
        + '<span style="color:var(--gn)">+' + s.yield_earned.toFixed(2) + ' GP</span>'
        + '</div>';
    });
  }

  // Dividend info
  if (divInfo && divInfo.enabled) {
    var pool = parseFloat(divInfo.current_pool || 0);
    html += '<div style="margin-top:8px;padding:8px;background:rgba(160,100,220,.06);border-radius:6px;border:1px solid rgba(160,100,220,.2)">'
      + '<div style="font-size:9px;color:#a064dc;font-weight:700;margin-bottom:4px;letter-spacing:1px">💰 WEEKLY DIVIDENDS</div>'
      + '<div style="font-size:9px;color:var(--tx3)">This week\'s pool: <span style="color:var(--gold);font-weight:700">' + Math.round(pool) + ' GP</span> · Distributed every Monday to active stakers</div>';
    if (divInfo.my_history && divInfo.my_history.length) {
      var lastDiv = divInfo.my_history[0];
      html += '<div style="font-size:9px;color:var(--gn);margin-top:2px">Last dividend: +' + parseFloat(lastDiv.dividend_gp).toFixed(2) + ' GP (week ' + lastDiv.week_start + ')</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;

  // Default select first lock option
  var firstOpt = el.querySelector('.stake-day-opt');
  if (firstOpt) selectLockDays(firstOpt, opts[0]);

  // Live yield preview
  var amtInput = document.getElementById('stakeAmountInput');
  if (amtInput) amtInput.addEventListener('input', updateStakePreview);
}

var _selectedLockDays = 7;

function selectLockDays(el, days) {
  _selectedLockDays = days;
  document.querySelectorAll('.stake-day-opt').forEach(function(b) {
    b.style.background = 'rgba(255,255,255,.04)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  el.style.background = 'rgba(91,184,232,.15)';
  el.style.borderColor = 'rgba(91,184,232,.4)';
  updateStakePreview();
}

function updateStakePreview() {
  var amtEl = document.getElementById('stakeAmountInput');
  var previewEl = document.getElementById('stakeYieldPreview');
  if (!amtEl || !previewEl || !_stakingInfo) return;
  var amt = parseFloat(amtEl.value) || 0;
  if (amt <= 0) { previewEl.textContent = ''; return; }
  var info = _stakingInfo;
  var apy = info.apy_pct || 15;
  var mult = (info.bonus_multipliers || {})[_selectedLockDays] || 1;
  var yld = +(amt * (apy / 100) * (_selectedLockDays / 365) * mult).toFixed(2);
  previewEl.textContent = '+' + yld + ' GP';
}

async function doStake() {
  if (!walletState.address) return showToast('Connect wallet first', 'error');
  var amt = parseFloat(document.getElementById('stakeAmountInput')?.value);
  if (!amt || amt <= 0) return showToast('Enter an amount', 'error');
  var info = _stakingInfo || {};
  if (amt < (info.min_amount || 100)) return showToast('Minimum ' + (info.min_amount||100) + ' GP', 'error');
  if (amt > (info.max_amount || 10000)) return showToast('Maximum ' + (info.max_amount||10000) + ' GP per stake', 'error');

  var yld = document.getElementById('stakeYieldPreview')?.textContent || '';
  var ok = await gameConfirm({
    icon: '💎',
    title: (window.i18n?.staking_confirm_title) || 'STAKE GP',
    body: 'Lock <b>' + Math.round(amt) + ' GP</b> for <b>' + _selectedLockDays + ' days</b><br>Expected yield: <b style="color:var(--gn)">' + yld + '</b>',
    confirmText: (window.i18n?.staking_confirm_btn) || 'STAKE',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/staking/stake', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, amount: amt, lockDays: _selectedLockDays })
    });
    var d = await r.json();
    if (d.error) return showToast(d.error, 'error');
    showToast('💎 Staked ' + Math.round(amt) + ' GP for ' + _selectedLockDays + 'd!', 'success');
    loadStakingPanel();
    loadWalletData();
  } catch(e) { showToast('Stake failed', 'error'); }
}

async function doWithdraw(stakeId) {
  if (!walletState.address) return showToast('Connect wallet first', 'error');
  var ok = await gameConfirm({
    icon: '✅',
    title: (window.i18n?.staking_withdraw_title) || 'WITHDRAW STAKE',
    body: 'Withdraw your matured stake and collect principal + yield?',
    confirmText: (window.i18n?.staking_withdraw_btn) || 'WITHDRAW',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/staking/withdraw', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, stakeId: stakeId })
    });
    var d = await r.json();
    if (d.error) return showToast(d.error, 'error');
    showToast('✅ Received ' + d.totalReturn.toFixed(2) + ' GP!', 'success');
    loadStakingPanel();
    loadWalletData();
  } catch(e) { showToast('Withdrawal failed', 'error'); }
}

// ── GP BURN (Migration 108) ──────────────────────────────────────────────────
var _burnPanelOpen = false;

function toggleBurn() {
  _burnPanelOpen = !_burnPanelOpen;
  document.getElementById('burnPanel').style.display = _burnPanelOpen ? '' : 'none';
  document.getElementById('burnToggle').textContent = _burnPanelOpen ? '▲' : '▼';
  if (_burnPanelOpen) loadBurnPanel();
}

function loadBurnPanel() {
  // GP Burn is deprecated (service removed). No-op.
  return;
}

function renderBurnPanel(types) {
  var el = document.getElementById('burnContent');
  if (!el) return;

  var html = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px;padding:0 2px">Permanently burn GP to activate exclusive time-limited buffs.</div>';

  types.forEach(function(t) {
    var isActive = t.active;
    var secsRem = t.seconds_remaining || 0;
    var timeStr = '';
    if (isActive && secsRem > 0) {
      var h = Math.floor(secsRem / 3600);
      var m = Math.floor((secsRem % 3600) / 60);
      timeStr = h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,.07)'
      + (isActive ? ';border-color:' + t.color + '40;background:rgba(255,255,255,.06)' : '') + '">'
      + '<div style="font-size:20px;min-width:28px;text-align:center">' + t.icon + '</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:10px;font-weight:700;color:' + t.color + '">' + t.name + '</div>'
      + '<div style="font-size:9px;color:var(--tx3)">' + t.desc + '</div>'
      + (isActive ? '<div style="font-size:9px;color:var(--gn);margin-top:2px">✅ Active — ' + timeStr + ' left</div>' : '')
      + '</div>'
      + '<div style="text-align:right">'
      + '<button onclick="doBurnGP(\'' + t.key + '\',' + t.cost + ')" '
      + 'style="font-size:9px;padding:5px 8px;border-radius:5px;cursor:pointer;font-weight:700;white-space:nowrap;'
      + (isActive
        ? 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);color:var(--tx3)'
        : 'background:rgba(255,80,30,.2);border:1px solid rgba(255,80,30,.35);color:var(--mars)')
      + '">'
      + (isActive ? '+' + t.hours + 'h ' : '') + '🔥 ' + Math.round(t.cost) + ' GP</button>'
      + '</div>'
      + '</div>';
  });

  el.innerHTML = html;
}

function doBurnGP(burnType, cost) {
  showToast('GP Burn is currently unavailable', 'warn');
}

async function harvestMining(){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var btn=document.getElementById('baseHarvestBtn');
  btn.disabled=true;btn.textContent='HARVESTING...';
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/harvest',{method:'POST',headers:headers,body:JSON.stringify({wallet:w})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Harvest failed','수확 실패','収穫失敗','收获失败'));try{_sfx.error()}catch(e){}return}
    showNotification('mining',tl('Harvest complete','수확 완료','収穫完了','收获完成'),tl('+'+d.harvestedPP.toFixed(4)+' PP collected from your territory','영토에서 +'+d.harvestedPP.toFixed(4)+' PP 수확','領土から +'+d.harvestedPP.toFixed(4)+' PP を採掘','已从你的领地收获 +'+d.harvestedPP.toFixed(4)+' PP'));
    // ✅ [Resource System] 자원 드롭 알림 (Phase 2)
    if(d.resources&&d.resources.length>0){
      var _RICONS={iron_ore:'🪨',carbon_fiber:'🖤',silicon_chip:'💎',titanium_alloy:'⚙️',plasma_crystal:'🔷',nano_polymer:'🧬',dark_matter:'🌑',quantum_core:'⚡',exotic_alloy:'🌟'};
      var _RNAMES_KO={iron_ore:'철광석',carbon_fiber:'탄소섬유',silicon_chip:'실리콘칩',titanium_alloy:'티타늄합금',plasma_crystal:'플라즈마크리스탈',nano_polymer:'나노폴리머',dark_matter:'암흑물질',quantum_core:'양자코어',exotic_alloy:'이국합금'};
      var _lang=(window.currentLang||'en').toLowerCase();
      var resMsg=d.resources.map(function(r){
        var icon=_RICONS[r.code]||'💠';
        var name=_lang==='ko'?(_RNAMES_KO[r.code]||r.code):r.code.replace(/_/g,' ');
        return icon+' +'+r.quantity+' '+name;
      }).join('  ');
      showToast('⛏ '+resMsg,'success');
      // (도파민 v7.387) 희귀 드롭 잭팟 연출 — 드롭률/수량은 그대로, 레어/에픽/전설만 시각 강조.
      var _maxTier=0, _topCode='';
      d.resources.forEach(function(r){ var tt=_resourceTier(r.code); if(tt>_maxTier){_maxTier=tt;_topCode=r.code;} });
      if(_maxTier>=2){
        var _tn=_lang==='ko'?(_RNAMES_KO[_topCode]||_topCode):_topCode.replace(/_/g,' ');
        var _msg=_maxTier>=3 ? (tl('MOTHERLODE!','대박 광맥!','大当たり鉱脈!','大矿脉!')+' '+(_RICONS[_topCode]||'🌟')+' '+_tn)
                             : ((_RICONS[_topCode]||'🔷')+' '+_tn+' '+tl('rare!','희귀!','レア!','稀有!'));
        rewardBurst({ text:_msg, tier:_maxTier, sound: window._sfx && (_maxTier>=3 ? _sfx.levelUp : _sfx.success) });
      }
    }
    try{_sfx.harvest()}catch(e){}
    try{trackQuestAction('harvest',1)}catch(e){}
    try{markDailyOpsAction('territory_harvest',1)}catch(_e){}
    // Update UI
    document.getElementById('baseMineAvail').textContent='0.00';
    var totalEl=document.getElementById('baseMineTotalMined');
    var prev=parseFloat(totalEl.textContent)||0;
    totalEl.textContent=(prev+d.harvestedPP).toFixed(2);
    // Update timer & hide mining dot
    if(d.nextHarvestAt) startMineTimer(new Date(d.nextHarvestAt));
    var md=document.getElementById('miningDot');if(md)md.style.display='none';
    // Refresh balances
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'))}
  finally{
    btn.disabled=false;
    var rng='';if(window._miningEstMin>0) rng=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
    btn.innerHTML='<span>'+t('harvest_pp')+rng+'</span>';
  }
}

// ── Instant Harvest (skip cooldown micro-transaction) ──
async function instantHarvest(){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var ihCost=window._instantHarvestCost||0.5;
  var ok=await shopConfirm('','Skip Cooldown',
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">INSTANT HARVEST</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">Skip the harvest cooldown and harvest immediately.</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">'+ihCost+' PP</div>','SKIP COOLDOWN');
  if(!ok)return;
  var btn=document.getElementById('baseInstantHarvestBtn');
  btn.disabled=true;btn.textContent='PROCESSING...';
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/harvest-instant',{method:'POST',headers:headers,body:JSON.stringify({wallet:w})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Failed','실패했습니다','失敗しました','失败了'),'error');return}
    showToast(tl('Cooldown skipped! Harvest now.','쿨다운을 건너뛰었습니다! 지금 수확하세요.','クールダウンをスキップしました！今すぐ採掘できます。','已跳过冷却！现在即可收获。'),'success');
    btn.style.display='none';
    document.getElementById('baseMineTimer').textContent='Harvest available now!';
    if(window._mineTimerInterval) _clearActiveInterval(window._mineTimerInterval);
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
  finally{btn.disabled=false;var ic=window._instantHarvestCost||0.5;btn.innerHTML='<span>HARVEST NOW ('+ic+' PP)</span>'}
}

// ── Territory Rename (micro-transaction) ──
async function renameTerritory(plot){
  if(!plot||!plot.id)return;
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var currentName=plot.customName||'';
  var name=await gameInput({title:LANG==='ko'?'영토 이름 변경':LANG==='ja'?'領土名変更':LANG==='zh'?'更改领土名称':'Rename Territory',label:LANG==='ko'?'이름 (최대 20자, 비용 0.3 PP)':LANG==='ja'?'名前（最大20文字、費用0.3PP）':LANG==='zh'?'名称（最多20字符，费用0.3PP）':'Name (max 20 chars, 0.3 PP)',placeholder:currentName,defaultValue:currentName,maxLength:20});
  if(name===null||name===undefined||name.trim()==='')return;
  name=name.trim().substring(0,20);
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/claims/'+plot.id+'/rename',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,name:name})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Rename failed','이름 변경 실패','名前変更失敗','重命名失败'),'error');return}
    showToast(tl('Territory renamed to "'+d.name+'"','영토 이름이 "'+d.name+'"(으)로 변경되었습니다','領土名を「'+d.name+'」に変更しました','领地名称已更改为“'+d.name+'”'),'success');
    // Update local data
    plot.customName=d.name;
    var nameRow=document.getElementById('infoNameRow');
    nameRow.style.display='';
    document.getElementById('infoCustomName').textContent=d.name;
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── POI Hint (micro-transaction) ──
async function getPOIHint(){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  // Use camera/globe center as user position
  var lat=0,lng=0;
  try{
    if(typeof camera!=='undefined'&&camera.position){
      // Convert camera to lat/lng approximation
      var pos=camera.position;
      lat=Math.asin(pos.y/pos.length())*180/Math.PI;
      lng=Math.atan2(pos.x,pos.z)*180/Math.PI;
    }
  }catch(e){}
  var ok=await shopConfirm('','POI Hint',
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">POI DIRECTION HINT</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">Get the approximate direction to the nearest undiscovered POI.</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">0.2 PP</div>','GET HINT');
  if(!ok)return;
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/exploration/hint',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,lat:lat,lng:lng})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Hint failed','힌트 요청 실패','ヒント取得失敗','提示获取失败'),'error');return}
    var icon=d.hint.poiType?({'ancient_ruins':'','ore_deposit':'','crashed_probe':'','water_ice':'','alien_artifact':''}[d.hint.poiType]||''):'';
    showNotification('exploration',tl('POI hint','POI 힌트','POIヒント','POI 提示'),icon+' '+d.hint.direction+' — '+d.hint.distance);
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── Rocket Loot Priority (micro-transaction) ──
async function buyLootPriority(rocketEventId){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var ok=await shopConfirm('','Priority Queue',
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">LOOT PRIORITY</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">Get a 5-second head start notification when rocket loot drops.</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">0.3 PP</div>','GET PRIORITY');
  if(!ok)return;
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/rockets/priority',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,rocketEventId:rocketEventId})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Priority failed','우선권 구매 실패','優先権の購入に失敗しました','优先权购买失败'),'error');return}
    showToast(tl('Priority notification activated!','우선 알림이 활성화되었습니다!','優先通知を有効化しました！','优先通知已启用！'),'success');
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── Auto-Renew Toggle ──
async function toggleAutoRenew(type,id,currentState){
  var w=walletState.address;
  if(!w)return;
  var newState=!currentState;
  try{
    var body={wallet:w,enabled:newState};
    if(type==='shield') body.shieldId=id;
    else body.effectId=id;
    var resp=await fetch('/api/shop/auto-renew',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Toggle failed','토글 변경 실패','切り替え失敗','切换失败'),'error');return}
    showToast(tl('Auto-renew '+(newState?'ON':'OFF'),newState?'자동 갱신 ON':'자동 갱신 OFF',newState?'自動更新 ON':'自動更新 OFF',newState?'自动续订 ON':'自动续订 OFF'),'success');
    // Refresh inventory view if open
    if(typeof renderShopInventory==='function') renderShopInventory();
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

function startMineTimer(nextAt){
  var el=document.getElementById('baseMineTimer');
  var instantBtn=document.getElementById('baseInstantHarvestBtn');
  if(window._mineTimerInterval) _clearActiveInterval(window._mineTimerInterval);
  // Show instant harvest button if on cooldown
  if(nextAt&&nextAt>Date.now()){
    instantBtn.style.display='';
  }else{
    instantBtn.style.display='none';
  }
  window._mineTimerInterval=_setActiveInterval(function(){
    var diff=nextAt-Date.now();
    if(diff<=0){
      el.textContent=t('harvest_available');
      instantBtn.style.display='none';
      var md=document.getElementById('miningDot');if(md)md.style.display='block';
      // Enable harvest button with range
      var hBtn=document.getElementById('baseHarvestBtn');
      if(hBtn){
        hBtn.disabled=false;
        var rng='';if(window._miningEstMin>0) rng=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
        hBtn.innerHTML='<span>'+t('harvest_pp')+rng+'</span>';
      }
      _clearActiveInterval(window._mineTimerInterval);
      window._mineTimerInterval=null;
      return;
    }
    var h=Math.floor(diff/3600000);var m=Math.floor((diff%3600000)/60000);var s=Math.floor((diff%60000)/1000);
    el.textContent=t('mine_timer_prefix')+' '+h+'h '+m+'m '+s+'s';
  },1000);
}

function openBaseTab(tab){
  openBaseModal();
  // Switch to specified tab
  document.querySelectorAll('.base-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.base-pane').forEach(function(p){p.classList.remove('active')});
  var pane=document.getElementById('basePane_'+tab);
  if(pane) pane.classList.add('active');
  // Find and activate matching tab button
  document.querySelectorAll('.base-tab').forEach(function(t){
    if(t.textContent.trim().toLowerCase().replace(/\s/g,'')===tab.toLowerCase()) t.classList.add('active');
  });
}

/* ── Sector Boundaries on Globe Texture ── */
var _showSectorBounds=false;

function drawSectorBoundaries(){
  if(!_sectorsData.length) return;
  compositeClaimsOnTexture();
}

function _drawSectorOverlay(ctx,w,h){
  if(!_showSectorBounds||!_sectorsData.length) return;
  ctx.save();

  function toXY(v){return[((v[0]+180)/360)*w,((90-v[1])/180)*h]}
  function centroid(pts){
    var cx=0,cy=0;
    for(var i=0;i<pts.length;i++){var p=toXY(pts[i]);cx+=p[0];cy+=p[1]}
    return[cx/pts.length,cy/pts.length];
  }

  // 1) Fill polygons (차단된 섹터는 붉고 어둡게)
  var _myLvl=parseInt((document.getElementById('profileLevel')||{}).textContent||'1')||1;
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    var _entryBlocked=(s.entryCheckActive!==false)&&(s.entryMinLevel||0)>0&&_myLvl<(s.entryMinLevel||0);
    if(_entryBlocked){
      // 어두운 붉은 반투명 오버레이
      ctx.globalAlpha=0.38;
      ctx.fillStyle='rgba(80,0,0,1)';
    }else{
      ctx.globalAlpha=0.12;
      ctx.fillStyle=_sectorColor(s.tier);
    }
    ctx.beginPath();
    var p0=toXY(poly[0]);
    ctx.moveTo(p0[0],p0[1]);
    for(var i=1;i<poly.length;i++){var p=toXY(poly[i]);ctx.lineTo(p[0],p[1])}
    ctx.closePath();
    ctx.fill();
    // 차단된 섹터: 큰 X 표시
    if(_entryBlocked){
      var c=centroid(poly);
      var xs=poly.map(function(v){return toXY(v)[0]});
      var ys=poly.map(function(v){return toXY(v)[1]});
      var polyW2=Math.max.apply(null,xs)-Math.min.apply(null,xs);
      var polyH2=Math.max.apply(null,ys)-Math.min.apply(null,ys);
      var half=Math.min(polyW2,polyH2)*0.3;
      ctx.globalAlpha=0.55;
      ctx.strokeStyle='rgba(255,60,60,1)';
      ctx.lineWidth=Math.max(3,half*0.08);
      ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(c[0]-half,c[1]-half);ctx.lineTo(c[0]+half,c[1]+half);ctx.stroke();
      ctx.beginPath();ctx.moveTo(c[0]+half,c[1]-half);ctx.lineTo(c[0]-half,c[1]+half);ctx.stroke();
      ctx.globalAlpha=1;
      // 레벨 요구사항 텍스트
      var lvFont=Math.max(12,Math.min(28,polyW2*0.06));
      ctx.font='bold '+lvFont+'px monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,0.9)';ctx.shadowBlur=6;
      ctx.fillStyle='rgba(255,120,120,1)';
      ctx.globalAlpha=0.9;
      ctx.fillText('🔒 Lv '+s.entryMinLevel,c[0],c[1]+half*0.6);
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
  });

  // 2) Unique edges — no double-drawing
  var edgeSet={};
  var edges=[];
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    for(var i=0;i<poly.length;i++){
      var a=poly[i], b=poly[(i+1)%poly.length];
      var ka=a[0]+','+a[1], kb=b[0]+','+b[1];
      var key=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(!edgeSet[key]){
        edgeSet[key]=true;
        edges.push({a:a,b:b,tier:s.tier});
      }
    }
  });
  ctx.globalAlpha=0.7;
  ctx.lineWidth=2;
  ctx.setLineDash([]);
  edges.forEach(function(e){
    var pa=toXY(e.a), pb=toXY(e.b);
    ctx.strokeStyle=_sectorColor(e.tier);
    ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
  });

  // 3) Labels — no bg box, text with shadow only
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    var c=centroid(poly);
    var cx=c[0],cy=c[1];
    var xs=poly.map(function(v){return toXY(v)[0]});
    var polyW=Math.max.apply(null,xs)-Math.min.apply(null,xs);

    // Responsive font size — smaller on mobile canvas to avoid overlap
    var _isMobTex=(w<=2560);
    var _maxF=_isMobTex?36:56;
    var _minF=_isMobTex?14:22;
    // Tighter multiplier so long names don't blow up + clamp to polyW (never wider than sector box)
    var fontSize=Math.max(_minF,Math.min(_maxF,polyW/s.name.length*1.6));
    // Also cap so single-line label fits within 80% of polyW
    if(s.name.length*fontSize*0.55>polyW*0.85) fontSize=Math.max(_minF,Math.floor(polyW*0.85/(s.name.length*0.55)));
    ctx.font='bold '+fontSize+'px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';

    // Truncate name if still too wide
    var nameText=s.name;
    while(ctx.measureText(nameText).width>polyW*0.9 && nameText.length>4){
      nameText=nameText.slice(0,-2);
    }
    if(nameText!==s.name) nameText=nameText+'…';

    // Text shadow for readability
    ctx.globalAlpha=0.95;
    ctx.shadowColor='rgba(0,0,0,0.9)';
    ctx.shadowBlur=6;
    ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
    ctx.fillStyle=_sectorColor(s.tier);
    ctx.fillText(nameText,cx,cy);

    // Tier label below (smaller)
    var tierSize=Math.max(_isMobTex?10:14,fontSize*0.38);
    ctx.font='bold '+tierSize+'px monospace';
    ctx.globalAlpha=0.75;
    ctx.fillText(s.tier.toUpperCase(),cx,cy+fontSize*0.55+tierSize*0.2);

    // Governor name below tier
    var govName=s.governor?s.governor.nickname:null;
    if(govName){
      var govSize=Math.max(_isMobTex?9:12,tierSize*0.8);
      var govY=cy+fontSize*0.55+tierSize*0.2+tierSize*0.8+4;
      ctx.font='bold '+govSize+'px monospace';
      ctx.globalAlpha=0.9;
      var isCommander=_cmdInfo&&_cmdInfo.commander&&s.governor&&s.governor.fullWallet&&_cmdInfo.commander.toLowerCase()===s.governor.fullWallet.toLowerCase();
      ctx.fillStyle=isCommander?'#FFD166':'#FFD166';
      var govText=(isCommander?'⭐ ':'👑 ')+govName;
      while(ctx.measureText(govText).width>polyW*0.9 && govText.length>6){ govText=govText.slice(0,-2); }
      ctx.fillText(govText,cx,govY);
    }

    // Sector announcement below governor name (only for sector members) — governor 없으면 잔존 공지 무시
    if(s.announcement && s.governor && s.myPixels > 0){
      var annSize=Math.max(_isMobTex?8:11,tierSize*0.55);
      var annY=govName?(govY+annSize+4):(cy+fontSize*0.55+tierSize*0.2+tierSize*0.8+4);
      ctx.font='italic '+annSize+'px monospace';
      ctx.globalAlpha=0.6;
      ctx.fillStyle='#FFD166';
      var annText=s.announcement.length>24?s.announcement.slice(0,24)+'…':s.announcement;
      ctx.fillText('📢 '+annText,cx,annY);
    }

    ctx.shadowColor='transparent';ctx.shadowBlur=0;
    ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  });

  ctx.restore();
}

// ═══════ WEATHER OVERLAY ═══════
var _weatherData = [];
var _weatherT = 0;

function _drawWeatherOverlay(ctx, w, h) {
  if (!_weatherData.length || !_sectorsData.length) return;
  ctx.save();
  _weatherT = Date.now();

  function toXY(v) { return [((v[0] + 180) / 360) * w, ((90 - v[1]) / 180) * h]; }
  // Pseudo-random from seed (deterministic per particle index)
  function prand(seed) { var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  // Build sector lookup
  var sectorMap = {};
  _sectorsData.forEach(function(s) { sectorMap[s.id] = s; });

  _weatherData.forEach(function(wx) {
    var sector = sectorMap[wx.sectorId];
    if (!sector || !sector.polygon || sector.polygon.length < 3) return;
    var poly = sector.polygon;

    // Compute bounding box + center
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var cx0 = 0, cy0 = 0;
    var pts = [];
    for (var i = 0; i < poly.length; i++) {
      var p = toXY(poly[i]);
      pts.push(p);
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      cx0 += p[0]; cy0 += p[1];
    }
    cx0 /= poly.length; cy0 /= poly.length;
    var bw = maxX - minX, bh = maxY - minY;

    // Draw polygon path helper
    function drawPoly() {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
    }

    var t = _weatherT;

    if (wx.weatherType === 'sandstorm') {
      // Base tint
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 1000) * 0.02;
      ctx.fillStyle = 'rgba(200,120,40,1)';
      ctx.fill();
      // Blowing sand particles
      ctx.save();
      drawPoly(); ctx.clip();
      var windAngle = t / 3000; // slow wind direction shift
      for (var d = 0; d < 80; d++) {
        var px = prand(d * 3.1) * bw + minX;
        var py = prand(d * 7.7) * bh + minY;
        // Wind drift: particles move right and slightly down
        var drift = ((t / 8 + d * 137) % (bw + 40)) - 20;
        var driftY = Math.sin(d * 2.3 + t / 600) * 8;
        px = minX + ((px - minX + drift) % bw);
        py = py + driftY;
        var size = 1 + prand(d * 1.3) * 2.5;
        var alpha = 0.3 + prand(d * 5.1) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = prand(d) > 0.5 ? '#D49030' : '#C87828';
        // Elongated horizontal streaks for wind effect
        ctx.fillRect(px, py, size * 3, size * 0.6);
      }
      // Larger dust clouds (semi-transparent blobs)
      for (var c = 0; c < 6; c++) {
        var cloudX = minX + ((prand(c * 11) * bw + t / 15 + c * 200) % bw);
        var cloudY = minY + prand(c * 17) * bh;
        var cloudR = 12 + prand(c * 23) * 20;
        var cg = ctx.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudR);
        cg.addColorStop(0, 'rgba(200,130,60,0.25)');
        cg.addColorStop(1, 'rgba(200,130,60,0)');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = cg;
        ctx.fillRect(cloudX - cloudR, cloudY - cloudR, cloudR * 2, cloudR * 2);
      }
      ctx.restore();

    } else if (wx.weatherType === 'solar_flare') {
      // Warm glow base
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 500) * 0.02;
      ctx.fillStyle = 'rgba(255,220,60,1)';
      ctx.fill();
      // Sparkle particles rising upward
      ctx.save();
      drawPoly(); ctx.clip();
      for (var s = 0; s < 50; s++) {
        var spx = prand(s * 4.1) * bw + minX;
        var spy = minY + bh - ((t / 12 + s * 97) % (bh + 20));
        var spSize = 1 + prand(s * 2.7) * 2;
        var spAlpha = 0.4 + Math.sin(t / 200 + s * 1.7) * 0.4;
        ctx.globalAlpha = Math.max(0, spAlpha);
        // Golden-white sparkle
        var spGrad = ctx.createRadialGradient(spx, spy, 0, spx, spy, spSize * 2);
        spGrad.addColorStop(0, 'rgba(255,255,200,0.9)');
        spGrad.addColorStop(0.5, 'rgba(255,200,50,0.4)');
        spGrad.addColorStop(1, 'rgba(255,180,30,0)');
        ctx.fillStyle = spGrad;
        ctx.fillRect(spx - spSize * 2, spy - spSize * 2, spSize * 4, spSize * 4);
      }
      // Central flare pulse
      var frad = 60 + Math.sin(t / 400) * 30;
      var fGrad = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, frad);
      fGrad.addColorStop(0, 'rgba(255,240,100,0.35)');
      fGrad.addColorStop(0.6, 'rgba(255,200,50,0.12)');
      fGrad.addColorStop(1, 'rgba(255,180,30,0)');
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = fGrad;
      ctx.fillRect(cx0 - frad, cy0 - frad, frad * 2, frad * 2);
      // Light rays
      ctx.globalAlpha = 0.15 + Math.sin(t / 300) * 0.08;
      ctx.strokeStyle = 'rgba(255,240,150,0.6)';
      ctx.lineWidth = 1;
      for (var r = 0; r < 8; r++) {
        var rayAng = (r * 45 + t / 80) * Math.PI / 180;
        var rayLen = 40 + Math.sin(t / 250 + r) * 20;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx0 + Math.cos(rayAng) * rayLen, cy0 + Math.sin(rayAng) * rayLen);
        ctx.stroke();
      }
      ctx.restore();

    } else if (wx.weatherType === 'meteor_shower') {
      // Faint blue tint
      drawPoly();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = 'rgba(80,150,255,1)';
      ctx.fill();
      // Falling meteor streaks
      ctx.save();
      drawPoly(); ctx.clip();
      for (var m = 0; m < 25; m++) {
        var mx = prand(m * 5.3) * bw + minX;
        var mPhase = ((t / 6 + m * 311) % (bh + 60)) - 30;
        var my = minY + mPhase;
        var mLen = 8 + prand(m * 3.1) * 18;
        var mAlpha = 0.5 + prand(m * 9.1) * 0.4;
        // Fade in/out based on position
        if (mPhase < 20) mAlpha *= mPhase / 20;
        if (mPhase > bh - 20) mAlpha *= (bh - mPhase + 30) / 50;
        ctx.globalAlpha = Math.max(0, mAlpha);
        // Diagonal streak (top-right to bottom-left)
        var mGrad = ctx.createLinearGradient(mx, my, mx - mLen * 0.4, my + mLen);
        mGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        mGrad.addColorStop(0.3, 'rgba(150,200,255,0.6)');
        mGrad.addColorStop(1, 'rgba(100,150,255,0)');
        ctx.strokeStyle = mGrad;
        ctx.lineWidth = 1 + prand(m * 2.1) * 1.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - mLen * 0.4, my + mLen);
        ctx.stroke();
        // Bright head
        ctx.globalAlpha = Math.max(0, mAlpha) * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Scattered twinkling stars
      for (var st = 0; st < 12; st++) {
        var stx = prand(st * 13.7) * bw + minX;
        var sty = prand(st * 19.3) * bh + minY;
        var stAlpha = 0.3 + Math.sin(t / 150 + st * 2.9) * 0.4;
        ctx.globalAlpha = Math.max(0, stAlpha);
        ctx.fillStyle = '#B0D4FF';
        ctx.beginPath();
        ctx.arc(stx, sty, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (wx.weatherType === 'dust_devil') {
      // Brown tint
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 800) * 0.02;
      ctx.fillStyle = 'rgba(160,100,50,1)';
      ctx.fill();
      // Swirling dust particles around center
      ctx.save();
      drawPoly(); ctx.clip();
      // Multiple vortex points
      var vortexCount = 2;
      for (var v = 0; v < vortexCount; v++) {
        var vx = cx0 + Math.cos(t / 2000 + v * 3.14) * bw * 0.2;
        var vy = cy0 + Math.sin(t / 2500 + v * 3.14) * bh * 0.2;
        // Spiral particles
        for (var sp = 0; sp < 35; sp++) {
          var spiralAng = (sp * 25 + t / (60 + v * 20)) * Math.PI / 180;
          var spiralR = 5 + sp * 2.5 + Math.sin(t / 400 + sp) * 3;
          var spx2 = vx + Math.cos(spiralAng) * spiralR;
          var spy2 = vy + Math.sin(spiralAng) * spiralR;
          var spAlpha2 = 0.5 - sp / 70;
          ctx.globalAlpha = Math.max(0.05, spAlpha2);
          ctx.fillStyle = sp % 3 === 0 ? '#B87840' : '#A06432';
          var psize = 1 + prand(sp + v * 100) * 1.8;
          ctx.beginPath();
          ctx.arc(spx2, spy2, psize, 0, Math.PI * 2);
          ctx.fill();
        }
        // Central vortex glow
        var vGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, 25);
        vGrad.addColorStop(0, 'rgba(180,120,60,0.3)');
        vGrad.addColorStop(1, 'rgba(160,100,50,0)');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = vGrad;
        ctx.fillRect(vx - 25, vy - 25, 50, 50);
      }
      // Loose flying debris
      for (var db = 0; db < 15; db++) {
        var dbx = minX + ((prand(db * 7.7) * bw + t / 20 + db * 80) % bw);
        var dby = minY + prand(db * 11.3) * bh + Math.sin(t / 300 + db * 2) * 10;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#C89060';
        ctx.fillRect(dbx, dby, 2 + prand(db) * 2, 1);
      }
      ctx.restore();
    }
  });

  ctx.restore();
}

// ═══════ EXPLORATION POI MARKERS ═══════
var _poiData = [];
// Mars-theme harmonized palette (aligned to --gold/--mars/--gn/--cyan/--pp)
var _poiDefs = {
  ancient_ruins:  { icon: '⚜', color: '#FFD166', glow: '#FFE4A3', label: 'ANCIENT RUINS',  illust: '🏛️' },
  ore_deposit:    { icon: '◆', color: '#FF7840', glow: '#FFB085', label: 'ORE DEPOSIT',    illust: '⛏️' },
  crashed_probe:  { icon: '▼', color: '#4CD89A', glow: '#9CF0C8', label: 'CRASHED PROBE',  illust: '🛸' },
  water_ice:      { icon: '◇', color: '#5BB8E8', glow: '#A8DCF5', label: 'WATER ICE',      illust: '🧊' },
  alien_artifact: { icon: '✦', color: '#B888E0', glow: '#DCBCF0', label: 'ALIEN ARTIFACT', illust: '🔮' }
};

// ══════════════════════════════════════
// FOR SALE / AUCTION MAP OVERLAY (Migration 091)
// ══════════════════════════════════════
var _forSaleMap={}; // {claimId: {price, currency, saleType, endsAt, sellerNick}}

function loadForSaleTerritories(){
  if (!_pageIsActive()) return;
  _guardedJsonFetch('for-sale-territories', '/api/for-sale-territories', {minGap:30000, backoffMs:120000}).then(function(rows){
    if (!rows) return;
    var map={};
    if(Array.isArray(rows)) rows.forEach(function(r){
      map[r.claim_id]={price:r.price,currency:r.currency,saleType:r.sale_type,endsAt:r.ends_at,sellerNick:r.seller_nick};
    });
    _forSaleMap=map;
    claimsSnapshot=null; compositeClaimsOnTexture();
  }).catch(function(){});
}

// Poll every 60s
_setActiveInterval(loadForSaleTerritories, 60000);
// Initial load after claims are ready
_setActiveTimeout(loadForSaleTerritories, 3000);

function _drawForSaleOverlay(ctx,w,h){
  if(!Object.keys(_forSaleMap).length) return;
  ctx.save();
  var _pxDeg=w/360;
  function _claimCx(c){return ((c.lng||c.center_lng||0)+180)/360*w;}
  function _claimCy(c){return (90-(c.lat||c.center_lat||0))/180*h;}
  claims.forEach(function(c){
    var info=_forSaleMap[c.id];
    if(!info) return;
    var cx=_claimCx(c), cy=_claimCy(c);
    var claimW=(c.w||c.width||20)*_pxDeg*0.5;
    var claimH=(c.h||c.height||20)*(_pxDeg)*0.5;
    var bx=cx-claimW/2, by=cy-claimH/2;
    var bw=claimW, bh=claimH;
    // Badge background
    var isAuction=info.saleType==='auction';
    var badgeColor=isAuction?'rgba(255,165,0,0.88)':'rgba(76,216,154,0.88)';
    var icon=isAuction?'🔨':'💰';
    var priceStr=Math.round(info.price||0)+' '+(info.currency||'GP');
    var lbl=icon+' '+priceStr;
    var fz=Math.max(6,Math.min(bw*0.22,bh*0.28,11));
    ctx.font='bold '+fz+'px sans-serif';
    var tw=ctx.measureText(lbl).width;
    var padX=4, padY=3;
    var rx=bx+bw/2-tw/2-padX, ry=by+2;
    var rw=tw+padX*2, rh=fz+padY*2;
    // Only draw if territory is big enough
    if(bw<10||bh<8) return;
    // Pill background
    ctx.globalAlpha=0.92;
    ctx.fillStyle=badgeColor;
    ctx.beginPath();
    var rad=rh/2;
    ctx.moveTo(rx+rad,ry);ctx.lineTo(rx+rw-rad,ry);
    ctx.arc(rx+rw-rad,ry+rad,rad,-Math.PI/2,Math.PI/2);
    ctx.lineTo(rx+rad,ry+rh);
    ctx.arc(rx+rad,ry+rad,rad,Math.PI/2,3*Math.PI/2);
    ctx.closePath();
    ctx.fill();
    // Text
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(0,0,0,0.85)';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(lbl,rx+rw/2,ry+rh/2);
  });
  ctx.restore();
}

function _drawPOIMarkers(ctx, w, h) {
  if (!_poiData.length) return;
  ctx.save();
  var t = Date.now();

  // Draw a single POI marker at the given x (allows wrap-around copies)
  // Style: tactical hex scanner — rotating dashed ring, hex diamond, crosshairs
  function _drawOnePOI(poi, x, y, def){
    var pulse = (Math.sin(t / 500 + poi.id) + 1) / 2; // 0..1

    ctx.save();
    ctx.translate(x, y);

    // ── Outer soft glow halo ──
    var haloR = 20 + pulse * 4;
    var haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    haloGrad.addColorStop(0, def.color + '55');
    haloGrad.addColorStop(0.55, def.color + '18');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();

    // ── Rotating dashed scan ring ──
    var ringR = 14 + pulse * 1.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -(t / 70) % 8;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Inner hex diamond ──
    var hexR = 7.5;
    ctx.beginPath();
    for (var hi = 0; hi < 6; hi++) {
      var ha = hi * Math.PI / 3 - Math.PI / 2;
      var hx = Math.cos(ha) * hexR;
      var hy = Math.sin(ha) * hexR;
      if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    // Dark backdrop
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#0A0604';
    ctx.fill();
    // Glowing rim
    ctx.globalAlpha = 1;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6 + pulse * 4;
    ctx.strokeStyle = def.glow || def.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Crosshair tick marks (N/S/E/W outside the hex) ──
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hexR - 5, 0); ctx.lineTo(-hexR - 1, 0);
    ctx.moveTo( hexR + 1, 0); ctx.lineTo( hexR + 5, 0);
    ctx.moveTo(0, -hexR - 5); ctx.lineTo(0, -hexR - 1);
    ctx.moveTo(0,  hexR + 1); ctx.lineTo(0,  hexR + 5);
    ctx.stroke();

    // ── Center icon (white on dark) ──
    ctx.globalAlpha = 1;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = def.glow || def.color;
    ctx.fillText(def.icon, 0, 0.5);

    ctx.restore();

    // ── Tactical label with brackets (dark outline for readability) ──
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var labelText = '\u2039 ' + (def.label || 'SIGNAL') + ' \u203A';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,2,1,0.85)';
    ctx.strokeText(labelText, x, y + 24);
    ctx.fillStyle = def.color;
    ctx.fillText(labelText, x, y + 24);
  }

  // Approximate extent the marker extends from its center (pin + beam + label)
  var MARKER_MARGIN = 80;

  _poiData.forEach(function(poi) {
    if (poi.discovered) return;
    var x = ((poi.lng + 180) / 360) * w;
    var y = ((90 - poi.lat) / 180) * h;
    var def = _poiDefs[poi.poiType] || { icon: '✦', color: '#FFFFFF', glow: '#FFFFFF' };
    // Primary draw
    _drawOnePOI(poi, x, y, def);
    // Longitude wrap-around: if the marker crosses the antimeridian, draw a
    // second copy on the opposite edge so half the pin isn't chopped off.
    if (x < MARKER_MARGIN)       _drawOnePOI(poi, x + w, y, def);
    else if (x > w - MARKER_MARGIN) _drawOnePOI(poi, x - w, y, def);
  });

  ctx.restore();
}

// ═══════ MISSION ROUTES (private — only my missions visible) ═══════
// Drawn into the 4096×2048 equirectangular Mars texture, which is then wrapped
// onto the 3D globe — straight lineTo's become great-circle curves on the sphere
// for free. Lines are deliberately thick (8–22 px) so they survive the
// texture→sphere downsampling and remain visible at any zoom.
// ── Great-circle path between two lat/lng points, sampled into N+1 points.
//    Returns an array of [lat,lng]. Used so mission lines follow the actual
//    shortest path on the sphere (more natural arc than a straight equirectangular
//    line, which would just be linear in lat/lng space). ──
function _greatCirclePath(lat1, lng1, lat2, lng2, segments){
  var d = Math.PI/180;
  var f1 = lat1*d, l1 = lng1*d, f2 = lat2*d, l2 = lng2*d;
  var x1 = Math.cos(f1)*Math.cos(l1), y1 = Math.cos(f1)*Math.sin(l1), z1 = Math.sin(f1);
  var x2 = Math.cos(f2)*Math.cos(l2), y2 = Math.cos(f2)*Math.sin(l2), z2 = Math.sin(f2);
  var dot = Math.max(-1, Math.min(1, x1*x2 + y1*y2 + z1*z2));
  var omega = Math.acos(dot);
  var sinO = Math.sin(omega);
  var pts = [];
  if(sinO < 1e-9){ pts.push([lat1,lng1]); pts.push([lat2,lng2]); return pts; }
  for(var i=0;i<=segments;i++){
    var t = i/segments;
    var a = Math.sin((1-t)*omega)/sinO;
    var b = Math.sin(t*omega)/sinO;
    var px = a*x1 + b*x2, py = a*y1 + b*y2, pz = a*z1 + b*z2;
    var lat = Math.atan2(pz, Math.sqrt(px*px + py*py))/d;
    var lng = Math.atan2(py, px)/d;
    pts.push([lat,lng]);
  }
  return pts;
}

// Convert a great-circle [lat,lng] list to canvas (x,y) points, keeping each
// successive x within ±w/2 of the previous so the polyline doesn't jump across
// the antimeridian (±180° longitude wrap).
function _projectGreatCirclePts(pts, w, h){
  var out = [];
  var lastX = null;
  for(var i=0;i<pts.length;i++){
    var x = ((pts[i][1] + 180) / 360) * w;
    var y = ((90 - pts[i][0]) / 180) * h;
    if(lastX !== null){
      while(x - lastX >  w/2) x -= w;
      while(lastX - x >  w/2) x += w;
    }
    out.push([x,y]);
    lastX = x;
  }
  return out;
}

function _drawMissionRoutes(ctx, w, h){
  var missions = window._opsMissions || [];
  if(!missions.length) return;
  var myW = (walletState && walletState.address) || null;
  if(!myW) return;
  var t = Date.now();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  missions.forEach(function(m){
    if(m.status === 'claimed' || m.status === 'cancelled') return;
    // Sample the great-circle path between origin and target so the line
    // follows the actual shortest path on the sphere. Then project each
    // sample to canvas (x,y) with antimeridian-safe continuity.
    var gcPts = _greatCirclePath(m.originLat, m.originLng, m.targetLat, m.targetLng, 32);
    var screen = _projectGreatCirclePts(gcPts, w, h);
    var ox = screen[0][0], oy = screen[0][1];
    var tx = screen[screen.length-1][0], ty = screen[screen.length-1][1];
    // Lines are yellow regardless of type — much more visible against
    // the textured globe than the previous orange/green which blended
    // into mars/foliage colors and got lost when overlapping.
    var col = '255,210,40';
    var ready = m.readyToClaim;
    var isInvade = m.type === 'invasion';

    // Width scales with the texture so the line stays visible on the globe.
    // Invasion tapers thin (origin) → thick (target). Exploration is uniform.
    var baseW = Math.max(2, w/1400);    // ~3 px on a 4096-wide canvas
    var thickW = Math.max(4, w/650);    // ~6 px

    // Compute screen-x range so we know whether to draw a wrapped copy
    var minX = screen[0][0], maxX = screen[0][0];
    for(var k=1;k<screen.length;k++){
      if(screen[k][0] < minX) minX = screen[k][0];
      if(screen[k][0] > maxX) maxX = screen[k][0];
    }

    for(var pass = 0; pass < 2; pass++){
      var off = 0;
      if(pass === 1){
        if(maxX > w) off = -w;
        else if(minX < 0) off = w;
        else break;
      }
      var ox2 = ox + off, tx2 = tx + off;

      // ── Uniform thin dashed great-circle polyline ──
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba('+col+',1)';
      ctx.lineWidth = baseW;
      ctx.setLineDash([16, 10]);
      ctx.lineDashOffset = -(t / 25) % 26;
      ctx.shadowColor = 'rgba('+col+',0.6)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for(var k2=0;k2<screen.length;k2++){
        var sx = screen[k2][0] + off;
        var sy = screen[k2][1];
        if(k2===0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // ── Origin marker ──
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba('+col+',1)';
      ctx.beginPath();
      ctx.arc(ox2, oy, baseW * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // ── Target pulse ring ──
      var pulseR = (ready ? thickW * 1.6 : thickW * 1.1) + Math.sin(t/220) * (thickW*0.15);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba('+col+',1)';
      ctx.lineWidth = Math.max(3, w/700);
      ctx.beginPath();
      ctx.arc(tx2, ty, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      if(ready){
        var r2 = thickW * 1.3 + ((t / 20) % (thickW*2));
        ctx.globalAlpha = Math.max(0, 0.6 - r2 / (thickW*4));
        ctx.beginPath();
        ctx.arc(tx2, ty, r2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Type label at target ──
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba('+col+',1)';
      ctx.font = 'bold ' + Math.max(12, Math.floor(w/280)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var lbl = isInvade ? '⚔ INVADE' : '🛰 SCAN';
      ctx.fillText(lbl, tx2, ty + thickW);
    }
  });
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ═══════ MISSION PREVIEW (route shown WHILE picking target, before launch) ═══════
function _drawMissionPreview(ctx, w, h){
  var pad = window._opsSelectedPad;
  var tgt = window._opsPreviewTarget;
  if(!pad || !tgt) return;
  if(!isFinite(pad.lat) || !isFinite(pad.lng)) return;
  if(!isFinite(tgt.lat) || !isFinite(tgt.lng)) return;
  var type = window._opsType || 'invasion';
  // Great-circle polyline so the preview matches the in-flight render.
  var gcPts = _greatCirclePath(pad.lat, pad.lng, tgt.lat, tgt.lng, 32);
  var screen = _projectGreatCirclePts(gcPts, w, h);
  var ox = screen[0][0], oy = screen[0][1];
  var tx = screen[screen.length-1][0], ty = screen[screen.length-1][1];
  var minX = ox, maxX = ox;
  for(var k=1;k<screen.length;k++){
    if(screen[k][0] < minX) minX = screen[k][0];
    if(screen[k][0] > maxX) maxX = screen[k][0];
  }
  // Yellow preview line — stays visible against any terrain
  var col = '255,210,40';
  var isInvade = type === 'invasion';
  var t = Date.now();
  var baseW = Math.max(2, w/1400);
  var thickW = Math.max(4, w/650);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for(var pass = 0; pass < 2; pass++){
    var off = 0;
    if(pass === 1){
      if(maxX > w) off = -w;
      else if(minX < 0) off = w;
      else break;
    }
    var ox2 = ox + off, tx2 = tx + off;

    // ── Uniform thin dashed great-circle polyline ──
    var pulse = 0.7 + 0.25 * Math.sin(t / 250);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = 'rgba('+col+',1)';
    ctx.lineWidth = baseW;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -(t / 22) % 30;
    ctx.shadowColor = 'rgba('+col+',0.6)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for(var k2=0;k2<screen.length;k2++){
      var sx = screen[k2][0] + off;
      var sy = screen[k2][1];
      if(k2===0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // ── Origin pad marker ──
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba('+col+',1)';
    var padR = baseW * 0.6;
    ctx.fillRect(ox2 - padR, oy - padR, padR*2, padR*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(2, w/900);
    ctx.strokeRect(ox2 - padR, oy - padR, padR*2, padR*2);

    // ── Target reticle ──
    var rR = thickW * 1.2 + Math.sin(t / 200) * (thickW*0.18);
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = 'rgba('+col+',1)';
    ctx.lineWidth = Math.max(3, w/650);
    ctx.beginPath();
    ctx.arc(tx2, ty, rR, 0, Math.PI * 2);
    ctx.stroke();
    // crosshair ticks
    ctx.beginPath();
    ctx.moveTo(tx2 - rR - 6, ty); ctx.lineTo(tx2 - rR + 4, ty);
    ctx.moveTo(tx2 + rR - 4, ty); ctx.lineTo(tx2 + rR + 6, ty);
    ctx.moveTo(tx2, ty - rR - 6); ctx.lineTo(tx2, ty - rR + 4);
    ctx.moveTo(tx2, ty + rR - 4); ctx.lineTo(tx2, ty + rR + 6);
    ctx.stroke();

    // ── PREVIEW tag ──
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba('+col+',1)';
    ctx.font = 'bold ' + Math.max(20, Math.floor(w/180)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('▸ PREVIEW', tx2, ty + thickW);
  }

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ═══════ STARLINK SATELLITES (3D orbit via screen coords) ═══════
var _starlinkMeshes = [];
var _starlinkData = { satellites: [], passes: [] };

// 6 orbits at evenly distributed inclinations — electron shell around atom
var _satOrbits = [
  { id: 1, speed: 0.00025, phase: 0,    inclination: 25,  tiltAxis: 0 },
  { id: 2, speed: 0.00028, phase: 1.05, inclination: 50,  tiltAxis: 60 },
  { id: 3, speed: 0.00030, phase: 2.09, inclination: 75,  tiltAxis: 120 },
  { id: 4, speed: 0.00027, phase: 3.14, inclination: 40,  tiltAxis: 180 },
  { id: 5, speed: 0.00032, phase: 4.19, inclination: 65,  tiltAxis: 240 },
  { id: 6, speed: 0.00026, phase: 5.24, inclination: 85,  tiltAxis: 300 }
];
var _slDots = []; // DOM elements
var _slAlt = 0.35; // orbit altitude above globe surface
var _slRafId = null;

function _initStarlinkOrbit() {
  if (_slDots.length || !globe) return;
  var container;
  try { container = globe.renderer().domElement.parentElement; } catch(_e) { return; }
  if (!container) return;
  _satOrbits.forEach(function(orb) {
    var dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;z-index:50;pointer-events:none;transition:opacity 0.15s;';
    dot.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff 25%,rgba(0,255,136,0.8) 60%,transparent 100%);box-shadow:0 0 8px rgba(0,255,136,0.6),0 0 16px rgba(0,255,136,0.2)"></div>' +
      '<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font:bold 7px monospace;color:#00FF88;white-space:nowrap;text-shadow:0 0 4px rgba(0,0,0,0.9)">SL-' + orb.id + '</div>';
    container.appendChild(dot);
    _slDots.push({ el: dot, orb: orb });
  });
  if (!_slRafId) _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
}

var _slLastFrame=0;
var _slFrameInterval=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?100:33;
function _animateStarlinkOrbit() {
  if (!_pageIsActive()) {
    _slRafId = null;
    return;
  }
  if (!globe || !_slDots.length) { _slRafId = requestAnimationFrame(_animateStarlinkOrbit); return; }
  var t = Date.now();
  if(t-_slLastFrame<_slFrameInterval){_slRafId = requestAnimationFrame(_animateStarlinkOrbit);return;}
  _slLastFrame=t;
  _slDots.forEach(function(sd) {
    var orb = sd.orb;
    var angle = t * orb.speed + orb.phase; // orbital angle
    // Compute lat/lng on a tilted great circle
    var incRad = orb.inclination * Math.PI / 180;
    var tiltRad = orb.tiltAxis * Math.PI / 180;
    // Position on unit circle in orbital plane, then rotate by inclination and tilt
    var x0 = Math.cos(angle);
    var y0 = Math.sin(angle);
    // Rotate around Y-axis by tiltAxis, then around X-axis by inclination
    var x1 = x0 * Math.cos(tiltRad) - y0 * Math.sin(tiltRad) * Math.cos(incRad);
    var y1 = x0 * Math.sin(tiltRad) + y0 * Math.cos(tiltRad) * Math.cos(incRad);
    var z1 = y0 * Math.sin(incRad);
    // Convert to lat/lng
    var lat = Math.asin(Math.max(-1, Math.min(1, z1))) * 180 / Math.PI;
    var lng = Math.atan2(y1, x1) * 180 / Math.PI;
    // Get screen position
    var sc = globe.getScreenCoords(lat, lng, _slAlt);
    if (sc && sc.x > -50 && sc.y > -50) {
      sd.el.style.left = (sc.x - 4) + 'px';
      sd.el.style.top = (sc.y - 4) + 'px';
      // Occlusion: dot product of surface normal with camera direction
      var cam = globe.camera().position;
      var latR = lat * Math.PI / 180, lngR = lng * Math.PI / 180;
      var px = Math.cos(latR) * Math.cos(lngR);
      var py = Math.sin(latR);
      var pz = Math.cos(latR) * Math.sin(lngR);
      var dot = px * cam.x + py * cam.y + pz * cam.z;
      // dot>0 = facing camera (visible), dot<=0 = behind globe
      // Smooth fade near the edge (dot 0~0.15)
      if (dot < 0) {
        sd.el.style.opacity = '0';
      } else if (dot < 0.15 * Math.sqrt(cam.x*cam.x+cam.y*cam.y+cam.z*cam.z)) {
        sd.el.style.opacity = '0.3';
      } else {
        sd.el.style.opacity = '1';
      }
    } else {
      sd.el.style.opacity = '0';
    }
  });
  _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
}

_onPageVisible(function(){
  if (_slDots.length && !_slRafId) _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
});
_onPageHidden(function(){
  if (_slRafId) {
    cancelAnimationFrame(_slRafId);
    _slRafId = null;
  }
});

// Texture trail stub (no longer used)
function _drawStarlinkTrails() {}
function _updateStarlinkPositions() {}
function _initStarlinkSatellites() {}

// ═══════ ROCKET EVENTS ═══════
var _rocketData = { events: [] };
var _rocketMesh = null;
var _rocketParticles = [];
// Preload starship pixel art
var _starshipImg = new Image();
_starshipImg.src = '/assets/textures/rocket_drop.svg';
_starshipImg.onerror = function(){ _starshipImg.src = '/assets/textures/starship.png'; };

function _drawRocketOverlay(ctx, w, h) {
  // [v7.265 fix] API 502/미로드 시 _rocketData.events 가 undefined 일 수 있음 → undefined.length 크래시 방어.
  //   이 함수는 compositeClaimsOnTexture(globe 텍스처 합성) 중 호출되므로, 여기서 throw 하면 globe 초기화가
  //   깨져 로딩/렌더가 꼬인다(서버 다운 시 화면 전체 영향). 안전 가드로 조용히 skip.
  if (!_rocketData || !_rocketData.events || !_rocketData.events.length) return;
  ctx.save();
  var t = Date.now();

  _rocketData.events.forEach(function(ev) {
    var x = ((ev.lng + 180) / 360) * w;
    var y = ((90 - ev.lat) / 180) * h;

    if (ev.status === 'incoming') {
      // Target reticle (red horizontal ellipse)
      var pulse = 0.5 + Math.sin(t / 300) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      // Horizontal ellipse
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 22, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 2); ctx.lineTo(x - 22, y - 2);
      ctx.moveTo(x + 22, y - 2); ctx.lineTo(x + 30, y - 2);
      ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 12);
      ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 14);
      ctx.stroke();
      // Label
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4422';
      ctx.fillText('INCOMING', x, y + 22);
      if (_starshipImg.complete && _starshipImg.naturalWidth) {
        var sz = 42;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(_starshipImg, x - sz/2, y - sz, sz, sz);
      } else {
        ctx.font = '14px sans-serif';
        ctx.fillText('\u{1F680}', x, y + 42);
      }
    } else if (ev.status === 'looting') {
      // Glow circle with loot dots
      var glowR = 30 + Math.sin(t / 500) * 5;
      ctx.globalAlpha = 0.15;
      var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      if (ev.eventType === 'rud_explosion') {
        grad.addColorStop(0, 'rgba(255,100,20,0.6)');
        grad.addColorStop(1, 'rgba(255,60,10,0)');
      } else {
        grad.addColorStop(0, 'rgba(0,255,136,0.5)');
        grad.addColorStop(1, 'rgba(0,200,100,0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
      // Center icon
      ctx.globalAlpha = 0.9;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}', x, y + 6);
      // LOOT label
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = ev.eventType === 'rud_explosion' ? '#FF6644' : '#00FF88';
      var remaining = ev.totalRewards - ev.claimedRewards;
      ctx.fillText(remaining + ' LOOT', x, y - 24);
    }
  });

  ctx.restore();
}

function _initRocketMesh() {
  if (!globe || !globe.scene || typeof THREE === 'undefined') return;
  var scene = globe.scene();
  var group = new THREE.Group();
  // Rocket body (cylinder + cone)
  var bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
  var bodyMat = new THREE.MeshBasicMaterial({ color: 0xDDDDDD, transparent: true, opacity: 0.95 });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));
  var noseGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
  var noseMat = new THREE.MeshBasicMaterial({ color: 0xFF4422 });
  var nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.y = 0.8;
  group.add(nose);
  // Engine glow
  var engGeo = new THREE.SphereGeometry(0.12, 8, 8);
  var engMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.8 });
  var eng = new THREE.Mesh(engGeo, engMat);
  eng.position.y = -0.7;
  group.add(eng);
  group.visible = false;
  scene.add(group);
  _rocketMesh = group;
}

function _updateRocketMesh() {
  if (!_rocketMesh) return;
  var ev = _rocketData.events.find(function(e) { return e.status === 'incoming' || e.status === 'looting'; });
  if (!ev) { _rocketMesh.visible = false; return; }

  var GLOBE_RADIUS = 100;
  var phi = (90 - ev.lat) * Math.PI / 180;
  var theta = (ev.lng + 180) * Math.PI / 180;

  if (ev.status === 'incoming') {
    // Descending animation
    var now = Date.now();
    var landTime = new Date(ev.landingAt).getTime();
    var progress = Math.max(0, Math.min(1, 1 - (landTime - now) / (2 * 60 * 60 * 1000))); // 0→1 over 2h
    var alt = GLOBE_RADIUS + 30 - progress * 25; // 130 → 105
    _rocketMesh.position.set(
      -alt * Math.sin(phi) * Math.cos(theta),
       alt * Math.cos(phi),
       alt * Math.sin(phi) * Math.sin(theta)
    );
    _rocketMesh.lookAt(0, 0, 0);
    _rocketMesh.rotateX(Math.PI); // Nose pointing down toward planet
    _rocketMesh.visible = true;
  } else if (ev.status === 'looting') {
    // Landed on surface
    var alt2 = GLOBE_RADIUS + 1;
    _rocketMesh.position.set(
      -alt2 * Math.sin(phi) * Math.cos(theta),
       alt2 * Math.cos(phi),
       alt2 * Math.sin(phi) * Math.sin(theta)
    );
    _rocketMesh.lookAt(0, 0, 0);
    _rocketMesh.rotateX(Math.PI);
    _rocketMesh.visible = ev.eventType !== 'rud_explosion'; // Hide if RUD
  }
}

function _sectorColor(tier){
  switch(tier){
    case 'core': return '#E84855';
    case 'mid': return '#FFD166';
    case 'frontier': return '#4CD89A';
    default: return '#FF7840';
  }
}
function zoomIn(){globe.pointOfView({altitude:Math.max(.08,globe.pointOfView().altitude*.7)},300);isZoomedIn=true}
function zoomOut(){
  var newAlt=Math.min(4,globe.pointOfView().altitude*1.4);
  globe.pointOfView({altitude:newAlt},300);
  if(newAlt>2)isZoomedIn=false;
}
function showToast(msg){var el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show')},3500)}
// ── 슬로대 스타일 파벌 플레이버 다이얼로그 ────────────────────────────────
// 클레임/하이잭 등 결정적 액션 직전 1-2초 캐릭터 대사로 몰입도 ↑
// (Super Robot Wars / 시뮬레이션 게임 류 사전 컷)
var FACTION_FLAVOR = {
  // ── 새 영토 클레임 (빈 땅) ─────────────────────────────────────────
  claim_new: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'이 구역은 아직 등록되지 않았다. 절차대로 진행한다.', line_en:'Sector unregistered. Proceeding by the book.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'좌표 확인 완료. MCC 표준 절차 개시.', line_en:'Coordinates confirmed. Initiating MCC standard procedure.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'미등록 영역. 회사가 가장 먼저 깃발 꽂으면 그게 회사 자산이다.', line_en:'Unregistered zone. First flag planted is company property.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚪', line:'이사회 승인 떨어졌다. 등록 진행하라.', line_en:'Board approved. Proceed with registration.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'이 땅은 아직 아무도 깃발 꽂지 않은 거 같군. 우리 차례다.', line_en:'Looks like no one\'s planted a flag here yet. Our turn.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'사람이 살 수 있는 곳이라면 어디든 우리 땅이 될 수 있어.', line_en:'Anywhere people can live, we can call home.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🟢', line:'아직 이름 없는 땅. 누군가 이 자리에 새겨질 거다.', line_en:'Unnamed land. Someone will be written into this place.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🟢', line:'젊은이, 이 땅을 잘 봐둬라. 곧 너희 집이 될 거다.', line_en:'Look at this land, youngster. It\'ll be your home soon.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🟢', line:'설계도 다시 그릴 시간이군. 새 정착지가 또 하나.', line_en:'Time to redraw the blueprints. Another new settlement.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'주인 없는 땅이야. 그럼 우리 거지.', line_en:'Unclaimed land. That makes it ours.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'무주공산. 의외로 화성에는 흔하지.', line_en:'No man\'s land. Surprisingly common on Mars.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🔴', line:'이 자리에 시추공 박으면 뭐가 나올까. 일단 등록부터.', line_en:'What would we find if we drilled here. Register first, ask later.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🔴', line:'먼저 발 디딘 놈이 임자다. 그게 화성의 룰이야.', line_en:'First one to plant their feet owns it. That\'s the Mars rule.' },
    { faction:null,  speaker:'Mission Control', emoji:'📡', line:'좌표 확인. 빈 영역. 깃발 박을 준비.', line_en:'Coordinates confirmed. Empty sector. Ready to plant the flag.' },
    { faction:null,  speaker:'AI Scout',    emoji:'🛰', line:'스캔 완료 — 미등록 좌표. 점유 가능.', line_en:'Scan complete — unregistered coordinates. Occupation possible.' },
    { faction:null,  speaker:'Surveyor',    emoji:'📐', line:'이 영역 측량 끝났다. 등록 신청 가능 상태.', line_en:'Survey of this sector complete. Registration can proceed.' },
  ],
  // ── 클레임 작전 시작 (등록 진행 중) ────────────────────────────────
  claim_executing: [
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'사령부, 깃발 박는다. 등록 절차 시작.', line_en:'Command, planting the flag. Starting registration.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'서류 정리. 영수증 보관. 회사 자산 추가.', line_en:'Paperwork done. Receipt filed. Company assets updated.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚪', line:'좋아. 이사회에 보고할 자산 한 줄 추가됐다.', line_en:'Good. One more line added to the board report.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'시간 맞춰 등록 완료. 다음 임무로 이동.', line_en:'Registration complete on schedule. Moving to next objective.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🟢', line:'이름 하나 더 새기자. 우리가 여기 있었다고.', line_en:'Let\'s carve one more name. We were here.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'한 평이라도 더. 사람들 살 자리.', line_en:'One more patch of land. Space for people to live.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🟢', line:'땅이 늘었다. 차 한 잔 더 끓일 만한 자리.', line_en:'Land expanded. Enough room for another cup of tea.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🟢', line:'이 땅에 무엇을 지을지부터 정해라. 설계가 먼저다.', line_en:'Decide what to build on this land first. Design before everything.' },
    { faction:'fsp', speaker:'Yuna',        emoji:'🟢', line:'벽에 분필로 좌표 적어둘게. 다음 세대도 알 수 있게.', line_en:'I\'ll write the coordinates in chalk. So future generations know.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🔴', line:'이 땅은 이제 우리 거다. 누구도 못 뺏는다.', line_en:'This land is ours now. No one takes it back.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'표시 박았다. 누가 뭐라 하면 의수로 답할 거다.', line_en:'Marked it. Anyone argues, my arm has the answer.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🔴', line:'경계선 그어둘게. 넘으면 그쪽 책임이야.', line_en:'Drawing the boundary. Cross it, that\'s on you.' },
    { faction:'cv',  speaker:'Crow',        emoji:'🔴', line:'이 자리 경비 배치. 다음 작전 거점으로 쓴다.', line_en:'Security deployed here. Next operation base.' },
    { faction:null,  speaker:'Mission Control', emoji:'📡', line:'영토 등록 송신 중... 잠시 기다리세요.', line_en:'Transmitting territory registration... please wait.' },
    { faction:null,  speaker:'AI Scout',    emoji:'🛰', line:'좌표 잠그는 중. 곧 영구 기록됨.', line_en:'Locking coordinates. Permanent record incoming.' },
  ],
  // ── 하이잭 선언 직전 (전투 진입) ───────────────────────────────────
  hijack_start: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚔', line:'적성 영토 확인. 자, 다들 꽉 잡으라고. 전투 들어간다.', line_en:'Hostile territory confirmed. Hold on tight. Entering combat.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚔', line:'분쟁 영역. 회사 자산 확보를 위해 무력 사용 승인.', line_en:'Disputed zone. Force authorized to secure company assets.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚔', line:'적 함대 좌표 잡혔다. 교전 규칙 1단계 발동.', line_en:'Enemy fleet coordinates locked. Rules of engagement Level 1 activated.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚔', line:'이건 비즈니스다. 감정 빼고 처리해.', line_en:'This is business. Process it without emotion.' },
    { faction:'mcc', speaker:'MCC 사령부',  emoji:'⚔', line:'전 함대 사격 통제. 표적 락온 후 발사.', line_en:'All fleet weapons hot. Lock targets then fire.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'⚔', line:'이번엔 봐주지 마라. 우리 사람들 위한 싸움이다.', line_en:'No mercy this time. We\'re fighting for our people.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'⚔', line:'적이 먼저 시작했다. 우리는 끝낼 뿐이다.', line_en:'They started this. We just finish it.' },
    { faction:'fsp', speaker:'Lena',        emoji:'⚔', line:'팔에 새겨진 이름들이 보고 있다. 살아 돌아온다.', line_en:'The names on my arm are watching. I\'m coming back alive.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'⚔', line:'늙은이가 마지막으로 한 마디 — 살아 돌아와라.', line_en:'One last word from an old man — come back alive.' },
    { faction:'fsp', speaker:'Yuna',        emoji:'⚔', line:'우리가 지키는 건 깃발이 아니라 이름들이다. 가자.', line_en:'What we protect isn\'t flags — it\'s names. Let\'s go.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'⚔', line:'전투 개시. 의수 풀어라. 일하러 간다.', line_en:'Engaging. Arm\'s off. Going to work.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'⚔', line:'30년 전이나 지금이나, 광부의 답은 하나다 — 전투.', line_en:'Thirty years ago or today — a miner\'s answer is the same. Fight.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'⚔', line:'코드 활성. CV 전 인원 전투 모드.', line_en:'Code active. CV all hands, combat mode.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'⚔', line:'장비 점검 끝났다. 가자. 살아 돌아와라.', line_en:'Equipment check done. Go. Come back alive.' },
    { faction:'cv',  speaker:'Crow',        emoji:'⚔', line:'마스크 내려라. 본격적으로 시작이다.', line_en:'Mask down. This is where it gets real.' },
    { faction:null,  speaker:'Fleet Command', emoji:'⚔', line:'전 함대 전투 배치. 카운트다운 — 5... 4... 3...', line_en:'All fleet combat positions. Countdown — 5... 4... 3...' },
    { faction:null,  speaker:'Tactical AI', emoji:'⚔', line:'표적 락온. 사격 통제 권한 위임. 행운을 빈다.', line_en:'Target locked. Weapons authority delegated. Good luck.' },
    { faction:null,  speaker:'Mission Control', emoji:'⚔', line:'교전 규칙 발동. 전 채널 전투 주파수 전환.', line_en:'ROE activated. All channels switching to combat frequency.' },
  ],
  // ── 함대전 진입 (배틀 뷰어 오픈 직전) ──────────────────────────────
  fleet_battle_engage: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'🚀', line:'전 함선 라일거 충전. 미사일 록온 완료. 발사 대기.', line_en:'All ships railgun charged. Missiles locked. Ready to fire.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'🚀', line:'적 함대 진형 확인. 좌측 약점, 우측 보강. 패턴 분석 중.', line_en:'Enemy fleet formation confirmed. Left flank weak, right reinforced. Pattern analysis running.' },
    { faction:'mcc', speaker:'MCC 사령부',  emoji:'🚀', line:'전 함대, 표준 교전 규약. 손해는 최소, 자산은 최대.', line_en:'All fleet, standard engagement doctrine. Minimize losses, maximize assets.' },
    { faction:'mcc', speaker:'함장',        emoji:'🚀', line:'주포 발사 — 풀 살보! 보고 좀 받자고.', line_en:'Main guns fire — full salvo! Give me a readout.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🚀', line:'팀, 우리 모두 무사히 돌아간다. 그게 1순위다.', line_en:'Team, we all go home. That is priority one.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🚀', line:'적도 사람이 타고 있다. 그래도 — 우리 사람이 먼저다.', line_en:'There are people on those ships too. Still — our people come first.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🚀', line:'어떤 적이든 결국 사람이지. 그 사실은 잊지 마라.', line_en:'Any enemy is still human. Never forget that.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🚀', line:'함선 설계 한계 안에서 싸워라. 무리하면 깨진다.', line_en:'Fight within the ship\'s limits. Push too hard and you break.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🚀', line:'좋아. 첫 살보 시작. 내가 신호 줄 때까지 다들 위치 사수.', line_en:'Alright. First salvo initiated. Everyone hold positions until my signal.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🚀', line:'코드 발동 — 누구도 뒤에 안 남는다. 가자.', line_en:'Code activated — no one gets left behind. Move.' },
    { faction:'cv',  speaker:'Crow',        emoji:'🚀', line:'시야 확보. 사격 자유. 알아서 살아남아라.', line_en:'Clear field of vision. Weapons free. Survive on your own.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🚀', line:'엔진 점검 끝. 무기 풀로드. 행운 빈다.', line_en:'Engine check done. Weapons fully loaded. Good luck.' },
    { faction:null,  speaker:'Tactical AI', emoji:'🎯', line:'함대전 시뮬레이션 시작. 실시간 결과 추적 중.', line_en:'Fleet battle simulation starting. Tracking results in real time.' },
    { faction:null,  speaker:'Fleet Command', emoji:'🎯', line:'주포 충전 100%. 살보 1발사. 살보 2 대기.', line_en:'Main guns at 100%. Salvo 1 fired. Salvo 2 on standby.' },
    { faction:null,  speaker:'Battle Bridge', emoji:'🎯', line:'적 진형 분석 중... 아군 손실 예측 모델 가동.', line_en:'Analyzing enemy formation... Running casualty prediction model.' },
    { faction:null,  speaker:'AI Tactical', emoji:'🎯', line:'EMP 회피 기동 권장. 자동 회피 ON.', line_en:'EMP evasion maneuver recommended. Auto-evade ON.' },
  ],
};

function _myFactionCode(){
  try{
    if(typeof factionState!=='undefined'&&factionState&&factionState.current&&factionState.current.code){
      return factionState.current.code;
    }
  }catch(_){}
  return null;
}

function showFactionFlavor(situation, opts){
  var pool = FACTION_FLAVOR[situation] || [];
  if(!pool.length) return Promise.resolve();
  var myFac = _myFactionCode();
  // 우선 내 파벌 매칭, 없으면 neutral, 없으면 random
  var candidates = pool.filter(function(p){return p.faction===myFac;});
  if(!candidates.length) candidates = pool.filter(function(p){return p.faction===null;});
  if(!candidates.length) candidates = pool;
  var pick = candidates[Math.floor(Math.random()*candidates.length)];
  var dur = (opts&&opts.duration)||1800;

  return new Promise(function(resolve){
    var prev = document.getElementById('factionFlavor'); if(prev) prev.remove();
    var box = document.createElement('div');
    box.id = 'factionFlavor';
    var color = pick.faction==='mcc'?'#5cbbff':pick.faction==='fsp'?'#7cd7a4':pick.faction==='cv'?'#ff6b6b':'#ffd166';
    box.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:10001;'
      + 'min-width:280px;max-width:90vw;padding:14px 18px;border:1px solid '+color+';'
      + 'border-radius:10px;background:linear-gradient(180deg,rgba(10,10,16,.96),rgba(20,16,28,.92));'
      + 'box-shadow:0 8px 40px '+color+'66;font-family:var(--fn);'
      + 'opacity:0;transition:opacity .35s ease,transform .35s ease;cursor:pointer';
    box.innerHTML = '<div style="font-size:9px;color:'+color+';font-weight:800;letter-spacing:1.5px;margin-bottom:5px">'
      + (pick.emoji||'') + ' ' + escapeHtmlSafe(pick.speaker)
      + '</div>'
      + '<div style="font-size:11px;color:#f0f0f0;line-height:1.55">' + escapeHtmlSafe((LANG!=='ko'&&pick.line_en)||pick.line) + '</div>';
    document.body.appendChild(box);
    requestAnimationFrame(function(){
      box.style.opacity = '1';
      box.style.transform = 'translateX(-50%) translateY(-6px)';
    });
    function close(){
      box.style.opacity='0';
      setTimeout(function(){ try{ box.remove(); }catch(_){ } resolve(); }, 250);
    }
    box.onclick = close;
    setTimeout(close, dur);
  });
}

// ── 보조 버튼 실제 구현 ─────────────────────────────────────────────────
// openMyMineralsPanel: 보유 광물 (resource_id, name, qty) 모달 표시
// openMyShipRegistry: 보유 함선 명부 모달 표시
// openWorldEventDetail: window.openWorldEventDetail (line 22814) 참조 — ENGAGE 모달로 연결

function _openInfoModal(title, bodyHtml, accentColor){
  var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
  var modal = document.createElement('div');
  modal.id = 'infoDetailModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);font-family:var(--fn)';
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
  var color = accentColor || '#5cbbff';
  modal.innerHTML = '<div style="background:linear-gradient(180deg,#181820,#0e0e16);border:1px solid '+color+';border-radius:12px;padding:18px;max-width:420px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 8px 50px '+color+'66">'
    + '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:12px;text-align:center;letter-spacing:1px">'+escapeHtmlSafe(title)+'</div>'
    + '<div style="font-size:10px;color:var(--tx2);line-height:1.6">'+bodyHtml+'</div>'
    + '<button onclick="document.getElementById(\'infoDetailModal\').remove()" style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-family:var(--fn);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(LANG==='ko'?'닫기':LANG==='ja'?'閉じる':LANG==='zh'?'关闭':'Close')+'</button>'
    + '</div>';
  document.body.appendChild(modal);
}

function openMyMineralsPanel(){
  var w = walletState.address;
  if(!w){ showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')); return; }
  _openInfoModal('💎 MY MINERALS', '<div style="text-align:center;color:var(--tx3)">Loading...</div>', '#81c784');
  fetch('/api/resources/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(d){
      var items = d.resources || d.inventory || d || [];
      if(!Array.isArray(items)) items = items.resources || [];
      var body = '';
      if(!items.length){
        body = '<div style="text-align:center;color:var(--tx3);padding:14px">'+(LANG==='ko'?'보유 광물 없음':LANG==='ja'?'保有鉱物なし':LANG==='zh'?'无持有矿石':'No minerals held')+'</div>';
      } else {
        body = '<div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px">';
        items.forEach(function(it){
          var name = it.name || it.resource_name || it.resource_id || it.id || '?';
          var qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 0);
          var tier = it.tier!=null?' T'+it.tier:'';
          body += '<div style="color:var(--tx2)">'+escapeHtmlSafe(String(name))+tier+'</div><div style="color:#ffd166;font-weight:600;text-align:right">'+qty+'</div>';
        });
        body += '</div>';
      }
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('💎 MY MINERALS', body, '#81c784');
    })
    .catch(function(){
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('💎 MY MINERALS', '<div style="text-align:center;color:var(--mars)">'+(LANG==='ko'?'로드 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>', '#81c784');
    });
}

function openMyShipRegistry(){
  var w = walletState.address;
  if(!w){ showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')); return; }
  _openInfoModal('🚀 SHIP REGISTRY', '<div style="text-align:center;color:var(--tx3)">Loading...</div>', '#5cbbff');
  fetch('/api/ships/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(d){
      var ships = (d && d.ships) || [];
      var summary = (d && d.summary) || null;
      var body = '';
      if(summary){
        body += '<div style="text-align:center;color:var(--tx3);font-size:9px;margin-bottom:10px">'+(LANG==='ko'?'총 ':LANG==='ja'?'計 ':LANG==='zh'?'共 ':'Total ')+(summary.total_ships||ships.length||0)+(LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships')+(summary.alive!=null?(LANG==='ko'?' · 가용 ':LANG==='ja'?' · 可 ':LANG==='zh'?' · 可用 ':' · Available ')+summary.alive+(LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships'):'')+'</div>';
      }
      if(!ships.length){
        body += '<div style="text-align:center;color:var(--tx3);padding:14px">'+t('fleet_no_ships_hint')+'</div>';
      } else {
        body += '<div style="display:grid;grid-template-columns:1fr auto auto;gap:5px 10px;font-size:9px">';
        body += '<div style="color:var(--tx3);font-weight:700">SHIP</div><div style="color:var(--tx3);font-weight:700;text-align:center">HP</div><div style="color:var(--tx3);font-weight:700;text-align:right">STATUS</div>';
        ships.forEach(function(s){
          var name = s.name || s.ship_type_name || s.ship_type_code || 'Ship#'+s.id;
          var hp = (s.current_hp!=null && s.max_hp!=null) ? (s.current_hp+'/'+s.max_hp) : (s.hp||'?');
          var status = s.is_alive===false || s.status==='destroyed' ? '💥' : (s.in_battle ? '⚔' : '✅');
          body += '<div style="color:var(--tx2)">'+escapeHtmlSafe(String(name))+'</div><div style="color:#7cd7a4;text-align:center">'+escapeHtmlSafe(String(hp))+'</div><div style="text-align:right">'+status+'</div>';
        });
        body += '</div>';
      }
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('🚀 SHIP REGISTRY', body, '#5cbbff');
    })
    .catch(function(){
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('🚀 SHIP REGISTRY', '<div style="text-align:center;color:var(--mars)">'+(LANG==='ko'?'로드 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>', '#5cbbff');
    });
}

// openWorldEventDetail: window.openWorldEventDetail (ENGAGE 모달) 로 위임
// 중복 function 선언 제거 — 호이스팅으로 window 할당을 덮어쓰는 문제 수정됨
// Alias: legacy callers (OPS, guild upgrades) use showAlert(msg[,type]).
// Route them through the toast so they don't ReferenceError.
window.showAlert=function(m){return showToast(m);};

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

/* ── Live Stats & Leaderboard from API ───────────── */
function fmtNum(n){return Number(n).toLocaleString();}

function loadPublicStats(){
  if (!_pageIsActive()) return;
  _guardedJsonFetch('public-stats', '/api/stats', {minGap:25000, backoffMs:90000}).then(function(d){
    if (!d) return;
    var setT=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val;};
    if(d.totalPixels!=null){ setT('statTotalPx',fmtNum(d.totalPixels)); setT('bsStatTotalPx',fmtNum(d.totalPixels)); }
    if(d.totalPixelsSold!=null){ setT('statPlots',fmtNum(d.totalPixelsSold)); setT('bsStatPlots',fmtNum(d.totalPixelsSold)); }
    if(d.totalVolume!=null){ setT('statTVL','$'+fmtNum(d.totalVolume)); setT('bsStatTVL','$'+fmtNum(d.totalVolume)); }
    if(d.hijacksPerHour!=null){ setT('statHijacks',fmtNum(d.hijacksPerHour)); setT('bsStatHijacks',fmtNum(d.hijacksPerHour)); }
    if(d.activeUsers24h!=null){ setT('statActiveUsers',fmtNum(d.activeUsers24h)); setT('bsStatActiveUsers',fmtNum(d.activeUsers24h)); }
  }).catch(function(e){console.warn('[Stats] fetch failed:',e);});
}

function loadLeaderboard(){
  if (!_pageIsActive()) return;
  _guardedJsonFetch('leaderboard-pixels', '/api/leaderboard?sort=pixels&limit=10', {minGap:30000, backoffMs:90000}).then(function(arr){
    if (!arr) return;
    var container=document.getElementById('leaderboardList');
    var bsContainer=document.getElementById('bsLeaderboardList');
    if(!Array.isArray(arr)||arr.length===0){
      var empty='<div style="font-size:var(--fs-xs);color:var(--tx3);padding:8px 0;text-align:center">No claims yet</div>';
      if(container){ container.innerHTML=empty; var tg=document.getElementById('lbToggle'); if(tg) tg.style.display='none'; }
      if(bsContainer) bsContainer.innerHTML=empty;
      return;
    }
    var rankClasses=['gold','silver','bronze'];
    var html='';
    var bsHtml='';
    arr.forEach(function(entry,i){
      var rank=i+1;
      var rankCls=rankClasses[i]||'';
      var rankStyle=rankCls?'':' style="color:var(--tx3)"';
      var name=entry.nickname||entry.wallet;
      if(!entry.nickname&&name&&name.length>10) name=name.slice(0,6)+'..'+name.slice(-4);
      var px=entry.pixelCount||0;
      var hide=i>=3?' style="display:none" class="lb-row lb-extra"':' class="lb-row"';
      html+='<div'+hide+'><span class="lb-rank'+(rankCls?' '+rankCls:'')+'"'+rankStyle+'>'+rank+'</span>'
        +'<span class="lb-name">'+name+'</span>'
        +'<span class="lb-val">'+fmtNum(px)+' px</span></div>';
      // Base season mirror (no hide)
      var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+rank);
      bsHtml+='<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;background:rgba(255,255,255,.03);border-radius:4px;font-size:9px">'
        +'<span style="width:22px;color:'+(i<3?'var(--gold)':'var(--tx3)')+';font-weight:700">'+medal+'</span>'
        +'<span style="flex:1;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+name+'</span>'
        +'<span style="color:var(--gn);font-family:var(--fn)">'+fmtNum(px)+' px</span>'
        +'</div>';
    });
    if(container){
      container.innerHTML=html;
      var toggle=document.getElementById('lbToggle');
      if(toggle) toggle.style.display=arr.length>3?'block':'none';
    }
    if(bsContainer) bsContainer.innerHTML=bsHtml;
  }).catch(function(e){console.warn('[Leaderboard] fetch failed:',e);});
}
var _lbExpanded=false;
function toggleLeaderboard(){
  _lbExpanded=!_lbExpanded;
  var extras=document.querySelectorAll('#leaderboardList .lb-extra');
  extras.forEach(function(el){el.style.display=_lbExpanded?'flex':'none'});
  var toggle=document.getElementById('lbToggle');
  if(toggle) toggle.innerHTML=_lbExpanded?'▲ TOP 3':'▼ TOP 10';
}

setLoadProgress(95,'Loading stats...');
loadPublicStats();
loadLeaderboard();
_setActiveInterval(loadPublicStats,30000);
_setActiveInterval(loadLeaderboard,60000);
// Poll referral info periodically so commission toasts fire in real time
_setActiveInterval(function(){
  if(walletState.connected && walletState.address){
    try{ loadReferralInfo(); }catch(e){}
  }
}, 45000);

/* ── Init i18n ──────────────────────────────────── */
setLang(LANG);
// Modals added after this script block (lines 29000+) aren't in the DOM yet.
// Re-apply i18n once the full HTML is parsed so all [data-i18n] elements are translated.
document.addEventListener('DOMContentLoaded', function(){ applyI18n(); });

/* ── end main init ── */


// ═══════════════════════════════════════════════════════════
//  ARENA OVERLAY — Crash & Mines (embedded from arena.html)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';

const ARENA_API = '/api/arena';
var arenaWallet = null;
var arenaPpBal = 0, arenaUsdtBal = 0;
var arenaInited = false;

// ── Arena Auth Header (JWT) ──
function arenaAuthHeaders() {
  var t = localStorage.getItem('pw_token');
  return t ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }
           : { 'Content-Type': 'application/json' };
}

// ── Arena Toast ──
function arenaToast(msg, isErr) {
  var t = document.getElementById('arenaToast');
  t.textContent = msg;
  t.className = 'arena-toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className = 'arena-toast'; }, 2500);
}

// ── Wallet (bridges index.html's walletState) ──
function arenaSetWalletUI() {
  var short = arenaWallet.slice(0,6) + '...' + arenaWallet.slice(-4);
  document.getElementById('btnConnect').textContent = short;
  document.getElementById('btnConnect').style.color = 'var(--gn)';
}

window.arenaConnectWallet = function() {
  // No MetaMask — must be logged in via email
  if (window.walletState && walletState.connected && walletState.address) {
    arenaWallet = walletState.address.toLowerCase();
    arenaSetWalletUI();
    arenaLoadBalance();
    arenaCheckActiveMines();
  } else {
    arenaToast('Please login first', true);
    try { openAuthModal(); } catch(e) {}
  }
};

function arenaTryAutoConnect() {
  // Use index.html walletState if available
  if (window.walletState && walletState.connected && walletState.address) {
    arenaWallet = walletState.address.toLowerCase();
    arenaSetWalletUI();
    var nick = localStorage.getItem('pw_token');
    if (nick) {
      try {
        var payload = JSON.parse(atob(nick.split('.')[1]));
        if (payload.nickname) {
          document.getElementById('btnConnect').textContent = payload.nickname;
        }
      } catch(e){}
    }
    arenaLoadBalance();
    arenaCheckActiveMines();
    return;
  }
  // Fallback: try JWT token
  var token = localStorage.getItem('pw_token');
  if (token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.wallet) {
        arenaWallet = payload.wallet.toLowerCase();
        arenaSetWalletUI();
        if (payload.nickname) {
          document.getElementById('btnConnect').textContent = payload.nickname;
        }
        arenaLoadBalance();
        arenaCheckActiveMines();
        return;
      }
    } catch(e){}
  }
}

function arenaLoadBalance() {
  if (!arenaWallet) return;
  fetch('/api/user/' + arenaWallet + '/base').then(function(r){ return r.json(); }).then(function(d){
    var u = d.user || d;
    arenaPpBal = parseFloat(u.pp) || parseFloat(u.pp_balance) || 0;
    arenaUsdtBal = parseFloat(u.usdt) || parseFloat(u.usdt_balance) || 0;
    document.getElementById('dispPP').textContent = arenaPpBal.toFixed(2) + ' PP';
    document.getElementById('dispUSDT').textContent = arenaUsdtBal.toFixed(2) + ' USDT';
    // Also sync index.html balance display if available
    if (window.walletState) {
      walletState.gamePP = arenaPpBal;
      walletState.gameUsdt = arenaUsdtBal;
    }
  }).catch(function(){});
}

// ── Tab switching ──
window.switchGame = function(game) {
  document.querySelectorAll('#arenaOverlay .game-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.game === game); });
  document.querySelectorAll('#arenaOverlay .game-panel').forEach(function(p){ p.classList.remove('active'); });
  var panelMap = {crash:'panelCrash',mines:'panelMines',coinflip:'panelCoinflip',dice:'panelDice',hilo:'panelHilo'};
  var panel = document.getElementById(panelMap[game]);
  if (panel) panel.classList.add('active');
  if (game === 'crash') initCrashCanvas();
  if (game === 'coinflip') initCoinflip();
  if (game === 'dice') initDice();
  if (game === 'hilo') initHilo();
};

// ═══ CRASH GAME ═══
var crashState = 'waiting';
var crashRoundId = null;
var crashStartTime = null;
var crashMultiplier = 1.00;
var crashTargetCrash = null;
var myBet = null;
var crashCurrency = 'PP';
var crashBets = [];
var crashCtx = null;
var crashPoints = [];

function initCrashCanvas() {
  var c = document.getElementById('crashCanvas');
  if (!c) return;
  var wrap = c.parentElement;
  var dpr = window.devicePixelRatio || 1;
  c.width = wrap.clientWidth * dpr;
  c.height = wrap.clientHeight * dpr;
  c.style.width = wrap.clientWidth + 'px';
  c.style.height = wrap.clientHeight + 'px';
  crashCtx = c.getContext('2d');
  crashCtx.scale(dpr, dpr);
}

function drawCrashChart() {
  if (!crashCtx) return;
  var c = document.getElementById('crashCanvas');
  var w = c.clientWidth, h = c.clientHeight;
  var ctx = crashCtx;
  ctx.clearRect(0, 0, w, h);
  if (crashState !== 'running' && crashState !== 'crashed') return;
  ctx.strokeStyle = 'rgba(255,120,60,0.06)';
  ctx.lineWidth = 1;
  var maxMult = Math.max(crashMultiplier, 2);
  for (var m = 1; m <= maxMult + 1; m += 0.5) {
    var y = h - ((m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
    if (y < 0 || y > h) continue;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = 'rgba(106,88,72,0.6)';
    ctx.font = '8px "Orbitron"';
    ctx.fillText(m.toFixed(1) + 'x', 2, y + 3);
  }
  if (crashPoints.length < 2) return;
  var elapsed = crashPoints[crashPoints.length - 1].t;
  var tScale = (w - 60) / Math.max(elapsed, 3000);
  ctx.beginPath();
  ctx.strokeStyle = crashState === 'crashed' ? 'rgba(232,72,85,0.8)' : 'rgba(76,216,154,0.9)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = crashState === 'crashed' ? 'rgba(232,72,85,0.4)' : 'rgba(76,216,154,0.4)';
  ctx.shadowBlur = 12;
  for (var i = 0; i < crashPoints.length; i++) {
    var p = crashPoints[i];
    var x = 50 + p.t * tScale;
    var yy = h - ((p.m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke(); ctx.shadowBlur = 0;
  var last = crashPoints[crashPoints.length - 1];
  var lx = 50 + last.t * tScale;
  var ly = h - ((last.m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
  ctx.beginPath();
  ctx.fillStyle = crashState === 'crashed' ? '#E84855' : '#4CD89A';
  ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
}

function startCrashAnimation() {
  crashStartTime = Date.now();
  crashPoints = [];
  crashMultiplier = 1.00;
  crashState = 'running';
  updateCrashDisplay();
  updateCrashBtn();
}

function stopCrashAnimation(crashPoint) {
  crashState = 'crashed';
  crashMultiplier = crashPoint;
  _clearActiveTimeout(crashPollTimer);
  if (crashStartTime) crashPoints.push({ t: Date.now() - crashStartTime, m: crashPoint });
  updateCrashDisplay();
  drawCrashChart();
  if (myBet && !myBet.cashed) {
    myBet = null;
  }
  updateCrashBtn();
  setTimeout(function(){
    crashState = 'waiting';
    myBet = null;
    updateCrashDisplay();
    updateCrashBtn();
    pollCrashRound();
  }, 3000);
}

function updateCrashDisplay() {
  var el = document.getElementById('crashMultVal');
  var status = document.getElementById('crashStatusText');
  if (!el || !status) return;
  if (crashState === 'waiting') {
    el.className = 'crash-mult-val waiting';
    el.textContent = 'WAITING...';
    status.textContent = 'Place your bets!';
    status.style.color = 'var(--tx3)';
  } else if (crashState === 'running') {
    el.className = 'crash-mult-val running';
    el.textContent = crashMultiplier.toFixed(2) + 'x';
    status.textContent = '';
    status.style.color = 'var(--gn)';
  } else if (crashState === 'crashed') {
    el.className = 'crash-mult-val crashed';
    el.textContent = crashMultiplier.toFixed(2) + 'x';
    status.textContent = 'CRASHED!';
    status.style.color = 'var(--red)';
  }
}

function updateCrashBtn() {
  var btn = document.getElementById('crashBetBtn');
  if (!btn) return;
  if (crashState === 'running' && myBet && !myBet.cashed) {
    var payout = (myBet.amount * crashMultiplier).toFixed(2);
    btn.className = 'btn-bet cashout';
    btn.textContent = 'CASHOUT  ' + payout + ' ' + myBet.currency + '  (' + crashMultiplier.toFixed(2) + 'x)';
    btn.disabled = false;
    btn.onclick = doCrashCashout;
  } else if (crashState === 'running' && myBet && myBet.cashed) {
    var cashedMult = myBet.cashoutAt || crashMultiplier;
    var cashedPayout = myBet.payout || (myBet.amount * cashedMult);
    btn.className = 'btn-bet cashout';
    btn.textContent = 'CASHED OUT ✓  +' + Number(cashedPayout).toFixed(2) + ' ' + myBet.currency + '  (' + Number(cashedMult).toFixed(2) + 'x)';
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'running') {
    btn.className = 'btn-bet place';
    btn.textContent = 'ROUND IN PROGRESS';
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'crashed') {
    btn.className = 'btn-bet place';
    btn.textContent = 'NEXT ROUND...';
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'waiting' && myBet) {
    btn.className = 'btn-bet cashout';
    btn.textContent = 'BET PLACED (' + myBet.amount + ' ' + myBet.currency + ') -- WAITING...';
    btn.disabled = true; btn.onclick = null;
  } else {
    btn.className = 'btn-bet place';
    btn.textContent = 'PLACE BET';
    btn.disabled = !arenaWallet;
    btn.onclick = placeCrashBet;
  }
}

// Auto cashout toggle
var autoCashoutOn = false;
window.toggleAutoCashout = function() {
  autoCashoutOn = !autoCashoutOn;
  var toggle = document.getElementById('autoToggle');
  toggle.classList.toggle('on', autoCashoutOn);
  var v = parseFloat(document.getElementById('crashAutoInput').value);
  if (autoCashoutOn && (!v || v < 1.1)) {
    arenaToast('Set auto cashout multiplier first (min 1.1x)');
    autoCashoutOn = false;
    toggle.classList.remove('on');
  }
};

window.setCrashCur = function(cur) {
  crashCurrency = cur;
  document.querySelectorAll('#crashCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qCrash = function(v) { document.getElementById('crashBetInput').value = v; };

// ── Crash API calls ──
window.placeCrashBet = function() {
  if (!arenaWallet) return arenaToast('Connect wallet first', true);
  if (crashState !== 'waiting') return arenaToast('Wait for next round', true);
  var amount = parseFloat(document.getElementById('crashBetInput').value);
  if (!amount || amount <= 0) return arenaToast('Enter bet amount', true);
  fetch(ARENA_API + '/crash/bet', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: crashCurrency })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    myBet = { amount: d.bet, currency: d.currency, cashed: false };
    arenaLoadBalance();
    updateCrashBtn();
    pollCrashRound();
  }).catch(function(){ arenaToast('Bet failed', true); });
};

function doCrashCashout() {
  if (!myBet || myBet.cashed) return;
  fetch(ARENA_API + '/crash/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, multiplier: crashMultiplier })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    myBet.cashed = true;
    myBet.cashoutAt = d.cashoutAt;
    myBet.payout = d.payout;
    arenaLoadBalance();
    updateCrashBtn();
    pollCrashRound(); // refresh bets sidebar
  }).catch(function(){ arenaToast('Cashout failed', true); });
}

// ── Crash game loop (polling) ──
var crashPollTimer = null;
var crashCountdown = 0;
var countdownInterval = null;

function _arenaIsActive(){
  var overlay=document.getElementById('arenaOverlay');
  return !!(overlay&&overlay.classList.contains('active'));
}
function _scheduleCrash(fn, ms){
  _clearActiveTimeout(crashPollTimer);
  crashPollTimer = _setActiveTimeout(function(){
    crashPollTimer = null;
    if(_pageIsActive()) fn();
  }, ms);
}

function pollCrashRound() {
  if (!_pageIsActive() || !_arenaIsActive()) return; // stop if hidden/closed
  fetch(ARENA_API + '/crash/current').then(function(r){ return r.json(); }).then(function(d){
    crashRoundId = d.roundId;
    crashBets = d.bets || [];
    renderCrashBets();
    if (d.status === 'waiting') {
      crashState = 'waiting';
      updateCrashDisplay();
      updateCrashBtn();
      if (!crashCountdown) {
        crashCountdown = 8;
        if (countdownInterval) _clearActiveInterval(countdownInterval);
        countdownInterval = _setActiveInterval(function(){
          crashCountdown--;
          var st = document.getElementById('crashStatusText');
          if (st) st.textContent = 'Starting in ' + crashCountdown + 's...';
          if (crashCountdown <= 0) {
            _clearActiveInterval(countdownInterval);
            countdownInterval = null;
            startRoundOnServer();
          }
        }, 1000);
      }
    } else if (d.status === 'running') {
      if (crashState !== 'running') startCrashAnimation();
      _scheduleCrash(tickCrashRound, 500);
    } else if (d.status === 'crashed') {
      if (crashState !== 'crashed') {
        stopCrashAnimation(d.crashPoint);
        loadCrashHistory();
      }
    }
  }).catch(function(){
    if (_arenaIsActive()) {
      _scheduleCrash(pollCrashRound, 3000);
    }
  });
}

function startRoundOnServer() {
  fetch(ARENA_API + '/crash/start', { method: 'POST', headers: arenaAuthHeaders() }).then(function(){
    crashCountdown = 0;
    pollCrashRound();
  }).catch(function(){
    _scheduleCrash(pollCrashRound, 2000);
  });
}

function tickCrashRound() {
  if (crashState !== 'running') return;
  if (!_pageIsActive() || !_arenaIsActive()) return;
  fetch(ARENA_API + '/crash/tick').then(function(r){ return r.json(); }).then(function(d){
    if (d.status === 'crashed') {
      stopCrashAnimation(d.crashPoint);
      loadCrashHistory();
      return;
    }
    if (d.status === 'running') {
      crashMultiplier = d.multiplier;
      crashBets = d.bets || [];
      renderCrashBets();
      updateCrashDisplay();
      updateCrashBtn();
      crashPoints.push({ t: d.elapsed, m: d.multiplier });
      if (crashPoints.length > 600) crashPoints = crashPoints.filter(function(_, i){ return i % 2 === 0; });
      drawCrashChart();
      if (autoCashoutOn) {
        var autoVal = parseFloat(document.getElementById('crashAutoInput').value);
        if (autoVal && autoVal >= 1.1 && myBet && !myBet.cashed && d.multiplier >= autoVal) {
          doCrashCashout();
        }
      }
    }
    if (d.status === 'no_round') {
      crashState = 'waiting';
      pollCrashRound();
      return;
    }
  }).catch(function(){});
  if (crashState === 'running') {
    _scheduleCrash(tickCrashRound, 150);
  }
}

_onPageVisible(function(){
  if(_arenaIsActive()&&!crashPollTimer) pollCrashRound();
});
_onPageHidden(function(){
  if(crashPollTimer){ _clearActiveTimeout(crashPollTimer); crashPollTimer=null; }
  if(countdownInterval){ _clearActiveInterval(countdownInterval); countdownInterval=null; }
});

function renderCrashBets() {
  var el = document.getElementById('crashBetsList');
  if (!el) return;
  el.innerHTML = crashBets.map(function(b){
    return '<div class="cb-row"><span class="cb-user">' + b.wallet +
      '</span><span class="cb-amt">' + b.bet.toFixed(2) +
      '</span><span class="cb-status ' + b.status + '">' +
      (b.status === 'cashed' ? b.cashout.toFixed(2) + 'x' :
       b.status === 'busted' ? 'BUST' : 'LIVE') +
      '</span></div>';
  }).join('');
}

function loadCrashHistory() {
  fetch(ARENA_API + '/crash/history').then(function(r){ return r.json(); }).then(function(d){
    var el = document.getElementById('crashHistory');
    if (!el) return;
    if (!Array.isArray(d)) d = [];
    el.innerHTML = d.map(function(h){
      var cp = Number(h && h.crashPoint) || 1;
      var cls = cp < 1.5 ? 'low' : cp < 3 ? 'mid' : cp < 10 ? 'high' : 'mega';
      return '<div class="ch-pill ' + cls + '">' + cp.toFixed(2) + 'x</div>';
    }).join('');
    el.scrollLeft = 0;
  }).catch(function(){});
}


// ═══ MINES GAME ═══
var minesGameId = null;
var minesActive = false;
var minesCurrency = 'PP';
var mineCount = 5;
var minesRevealed = [];
var minesGrid = null;
var minesMultVal = 1.0;
var minesNextMultVal = null;
var minesBetAmount = 0;

function initMinesGrid() {
  var el = document.getElementById('minesGrid');
  if (!el) return;
  el.innerHTML = '';
  for (var i = 0; i < 25; i++) {
    var tile = document.createElement('div');
    tile.className = 'mine-tile' + (!minesActive ? ' idle' : '');
    tile.dataset.pos = i;
    tile.innerHTML = '<span class="tile-icon">?</span>';
    (function(idx){ tile.onclick = function(){ revealTile(idx); }; })(i);
    el.appendChild(tile);
  }
  updateMinesRevealed();
}

function updateMinesRevealed() {
  var tiles = document.querySelectorAll('#arenaOverlay .mine-tile');
  // Reset all tiles first
  tiles.forEach(function(tile, i){
    tile.className = 'mine-tile' + (!minesActive && !minesGrid ? ' idle' : '');
    tile.querySelector('.tile-icon').textContent = '?';
    tile.querySelector('.tile-icon').style.opacity = '';
  });
  // Mark revealed tiles (gems + the hit mine)
  minesRevealed.forEach(function(pos){
    if (pos >= tiles.length) return;
    var isMine = minesGrid && minesGrid[pos] === 'mine';
    tiles[pos].classList.add('revealed', isMine ? 'mine' : 'gem');
    tiles[pos].querySelector('.tile-icon').textContent = isMine ? '\uD83D\uDCA3' : '\uD83D\uDC8E';
    tiles[pos].querySelector('.tile-icon').style.opacity = '1';
  });
  // Game over: reveal the full grid
  if (minesGrid && !minesActive) {
    tiles.forEach(function(tile, i){
      var icon = tile.querySelector('.tile-icon');
      if (minesRevealed.includes(i)) return; // already shown above
      var isGem = minesGrid[i] === 'gem';
      tile.classList.add('revealed', isGem ? 'gem-hidden' : 'mine-hidden');
      icon.textContent = isGem ? '\uD83D\uDC8E' : '\uD83D\uDCA3';
      icon.style.opacity = '1';
    });
  }
}

window.setMineCount = function(n) {
  if (minesActive) return;
  mineCount = n;
  document.querySelectorAll('#arenaOverlay .mc-btn').forEach(function(b){
    b.classList.toggle('active', parseInt(b.dataset.mc) === n);
  });
};

window.setMinesCur = function(cur) {
  minesCurrency = cur;
  document.querySelectorAll('#minesCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qMines = function(v) { document.getElementById('minesBetInput').value = v; };

function updateMinesInfo() {
  var el;
  el = document.getElementById('minesGemsFound'); if (el) el.textContent = minesRevealed.length;
  el = document.getElementById('minesMultiplier'); if (el) el.textContent = minesMultVal.toFixed(2) + 'x';
  el = document.getElementById('minesNextMult'); if (el) el.textContent = minesNextMultVal ? minesNextMultVal.toFixed(2) + 'x' : '--';
  el = document.getElementById('minesPotentialWin'); if (el) el.textContent = (minesBetAmount * minesMultVal).toFixed(4);

  var btn = document.getElementById('minesActionBtn');
  if (!btn) return;
  if (minesActive) {
    btn.className = 'btn-mines cashout';
    btn.textContent = 'CASHOUT  ' + (minesBetAmount * minesMultVal).toFixed(4) + ' ' + minesCurrency;
    btn.disabled = minesRevealed.length === 0;
  } else {
    btn.className = 'btn-mines start';
    btn.textContent = 'START GAME';
    btn.disabled = !arenaWallet;
  }
}

window.minesAction = function() {
  if (minesActive) cashoutMines(); else startMines();
};

function startMines() {
  if (!arenaWallet) return arenaToast('Connect wallet first', true);
  var amount = parseFloat(document.getElementById('minesBetInput').value);
  if (!amount || amount <= 0) return arenaToast('Enter bet amount', true);
  fetch(ARENA_API + '/mines/start', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: minesCurrency, mines: mineCount })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    minesGameId = d.gameId;
    minesActive = true;
    minesRevealed = [];
    minesGrid = null;
    minesMultVal = 1.0;
    minesNextMultVal = d.nextMultiplier;
    minesBetAmount = d.bet;
    minesCurrency = d.currency;
    initMinesGrid();
    updateMinesInfo();
    arenaLoadBalance();
    arenaToast('Game started! Find the gems!');
  }).catch(function(){ arenaToast('Failed to start game', true); });
}

function revealTile(pos) {
  if (!minesActive || !minesGameId) return;
  if (minesRevealed.includes(pos)) return;
  var tiles = document.querySelectorAll('#arenaOverlay .mine-tile');
  var tile = tiles[pos];
  tile.style.pointerEvents = 'none';
  fetch(ARENA_API + '/mines/reveal', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, gameId: minesGameId, position: pos })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) { arenaToast(res.data.error, true); tile.style.pointerEvents = ''; return; }
    var d = res.data;
    if (d.result === 'mine') {
      minesActive = false;
      minesGrid = d.grid;
      minesRevealed.push(pos);
      tile.classList.add('revealed', 'mine');
      tile.querySelector('.tile-icon').textContent = '\uD83D\uDCA3';
      setTimeout(function(){ updateMinesRevealed(); updateMinesInfo(); }, 500);
      arenaToast('BOOM! You hit a mine!', true);
      arenaLoadBalance();
    } else {
      minesRevealed = d.revealed;
      minesMultVal = d.multiplier;
      minesNextMultVal = d.nextMultiplier;
      tile.classList.add('revealed', 'gem');
      tile.querySelector('.tile-icon').textContent = '\uD83D\uDC8E';
      updateMinesInfo();
      if (d.safeRemaining === 0) {
        minesActive = false;
        arenaToast('ALL GEMS FOUND! Auto cashout!');
        cashoutMines();
      }
    }
  }).catch(function(){ arenaToast('Error revealing tile', true); tile.style.pointerEvents = ''; });
}

function cashoutMines() {
  if (!minesActive || !minesGameId) return;
  if (minesRevealed.length === 0) return arenaToast('Reveal at least one tile', true);
  fetch(ARENA_API + '/mines/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, gameId: minesGameId })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    minesActive = false;
    minesGrid = d.grid;
    updateMinesRevealed();
    arenaToast('Cashed out! +' + d.payout.toFixed(4) + ' ' + d.currency + ' @ ' + d.multiplier.toFixed(2) + 'x');
    arenaLoadBalance();
    updateMinesInfo();
  }).catch(function(){ arenaToast('Cashout failed', true); });
}

function arenaCheckActiveMines() {
  if (!arenaWallet) return;
  fetch(ARENA_API + '/mines/active', { headers: getAuthHeaders() }).then(function(r){ return r.json(); })
  .then(function(d){
    if (d.active) {
      minesGameId = d.gameId;
      minesActive = true;
      minesRevealed = d.revealed;
      minesMultVal = d.multiplier;
      minesNextMultVal = d.nextMultiplier;
      minesBetAmount = d.bet;
      minesCurrency = d.currency;
      mineCount = d.mines;
      document.querySelectorAll('#arenaOverlay .mc-btn').forEach(function(b){
        b.classList.toggle('active', parseInt(b.dataset.mc) === mineCount);
      });
      initMinesGrid();
      updateMinesInfo();
    }
  }).catch(function(){});
}


// ═══ COINFLIP GAME ═══
var cfCurrency = 'PP';
var cfChoice = 'survive';
var cfPlaying = false;

window.setCfCur = function(cur) {
  cfCurrency = cur;
  document.querySelectorAll('#cfCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qCf = function(v) { document.getElementById('cfBetInput').value = v; };

window.setCfChoice = function(c) {
  cfChoice = c;
  document.getElementById('cfChoiceSurvive').classList.toggle('active', c === 'survive');
  document.getElementById('cfChoicePerish').classList.toggle('active', c === 'perish');
};

function initCoinflip() {
  loadCoinflipHistory();
}

function loadCoinflipHistory() {
  if (!arenaWallet) return;
  fetch(ARENA_API + '/coinflip/history', { headers: getAuthHeaders() }).then(function(r){ return r.json(); })
  .then(function(data){
    var el = document.getElementById('cfHistory');
    if (!el) return;
    el.innerHTML = '';
    var items = Array.isArray(data) ? data.slice(0, 10) : [];
    items.forEach(function(item){
      var dot = document.createElement('div');
      dot.className = 'cf-dot ' + (item.result || 'survive');
      dot.title = (item.result === 'survive' ? 'HEADS' : 'TAILS') + ' | Bet: ' + item.bet + ' | Payout: ' + (item.payout || 0);
      el.appendChild(dot);
    });
  }).catch(function(){});
}

window.playCoinflip = function() {
  if (cfPlaying) return;
  if (!arenaWallet) return arenaToast('Connect wallet first', true);
  var amount = parseFloat(document.getElementById('cfBetInput').value);
  if (!amount || amount <= 0) return arenaToast('Enter bet amount', true);

  cfPlaying = true;
  var btn = document.getElementById('cfPlayBtn');
  btn.disabled = true;
  btn.textContent = 'FLIPPING...';

  var coin = document.getElementById('cfCoin');
  var resultEl = document.getElementById('cfResult');
  resultEl.textContent = '';
  resultEl.style.color = '';
  coin.className = 'cf-coin spinning';

  fetch(ARENA_API + '/coinflip/play', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: cfCurrency, choice: cfChoice })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    setTimeout(function(){
      cfPlaying = false;
      btn.disabled = false;
      btn.textContent = 'FLIP COIN';
      if (!res.ok) {
        coin.className = 'cf-coin';
        arenaToast(res.data.error, true);
        return;
      }
      var d = res.data;
      try{trackQuestAction('cantina_play',1)}catch(e){}
      coin.className = 'cf-coin flip-' + d.result;
      if (d.won) {
        try{trackQuestAction('cantina_win',1)}catch(e){}
        resultEl.textContent = 'WIN! +' + (d.payout || 0).toFixed(4) + ' ' + cfCurrency;
        resultEl.style.color = 'var(--gn)';
        arenaToast('You survived! +' + (d.payout || 0).toFixed(4) + ' ' + cfCurrency);
      } else {
        resultEl.textContent = 'LOST! -' + amount.toFixed(4) + ' ' + cfCurrency;
        resultEl.style.color = 'var(--red)';
        arenaToast('You perished!', true);
      }
      arenaLoadBalance();
      loadCoinflipHistory();
    }, 900);
  }).catch(function(){
    setTimeout(function(){
      cfPlaying = false;
      btn.disabled = false;
      btn.textContent = 'FLIP COIN';
      coin.className = 'cf-coin';
      arenaToast('Coinflip failed', true);
    }, 900);
  });
};


// ═══ DICE GAME ═══
var diceCurrency = 'PP';
var diceDirection = 'over';
var dicePlaying = false;

window.setDiceCur = function(cur) {
  diceCurrency = cur;
  document.querySelectorAll('#diceCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qDice = function(v) { document.getElementById('diceBetInput').value = v; };

window.setDiceDir = function(dir) {
  diceDirection = dir;
  document.getElementById('diceDirOver').classList.toggle('active', dir === 'over');
  document.getElementById('diceDirUnder').classList.toggle('active', dir === 'under');
  updateDiceUI();
};

function initDice() {
  updateDiceUI();
}

window.updateDiceUI = function() {
  var slider = document.getElementById('diceSlider');
  if (!slider) return;
  var target = parseInt(slider.value);
  var fill = document.getElementById('diceSliderFill');
  var winChance, mult;

  if (diceDirection === 'over') {
    winChance = 99 - target;
    if (fill) fill.style.width = ((target / 99) * 100) + '%';
  } else {
    winChance = target - 1;
    if (fill) fill.style.width = ((1 - target / 99) * 100) + '%';
  }
  if (winChance <= 0) winChance = 1;
  if (winChance >= 99) winChance = 98;
  mult = (99 / winChance) * 0.99; // 1% house edge

  var betAmount = parseFloat(document.getElementById('diceBetInput').value) || 1;

  var el;
  el = document.getElementById('diceTarget'); if (el) el.textContent = target + '.00';
  el = document.getElementById('diceWinChance'); if (el) el.textContent = winChance.toFixed(2) + '%';
  el = document.getElementById('diceMult'); if (el) el.textContent = mult.toFixed(2) + 'x';
  el = document.getElementById('dicePotentialWin'); if (el) el.textContent = (betAmount * mult).toFixed(4);
};

window.playDice = function() {
  if (dicePlaying) return;
  if (!arenaWallet) return arenaToast('Connect wallet first', true);
  var amount = parseFloat(document.getElementById('diceBetInput').value);
  if (!amount || amount <= 0) return arenaToast('Enter bet amount', true);
  var target = parseInt(document.getElementById('diceSlider').value);

  dicePlaying = true;
  var btn = document.getElementById('dicePlayBtn');
  btn.disabled = true;
  btn.textContent = 'ROLLING...';

  var resultEl = document.getElementById('diceRollResult');
  var labelEl = document.getElementById('diceRollLabel');
  resultEl.className = 'dice-roll-result dice-rolling';
  resultEl.textContent = '??';
  labelEl.textContent = '';

  fetch(ARENA_API + '/dice/play', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: diceCurrency, target: target, direction: diceDirection })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    setTimeout(function(){
      dicePlaying = false;
      btn.disabled = false;
      btn.textContent = 'ROLL DICE';
      if (!res.ok) {
        resultEl.className = 'dice-roll-result';
        resultEl.textContent = '--';
        labelEl.textContent = 'ROLL TO PLAY';
        arenaToast(res.data.error, true);
        return;
      }
      var d = res.data;
      try{trackQuestAction('cantina_play',1)}catch(e){}
      resultEl.className = 'dice-roll-result ' + (d.won ? 'win' : 'lose');
      resultEl.textContent = d.roll.toFixed(2);
      if (d.won) {
        try{trackQuestAction('cantina_win',1)}catch(e){}
        labelEl.textContent = 'WIN! +' + (d.payout || 0).toFixed(4) + ' ' + diceCurrency + ' @ ' + (d.multiplier || 0).toFixed(2) + 'x';
        labelEl.style.color = 'var(--gn)';
        arenaToast('Roll ' + d.roll.toFixed(2) + ' — WIN! +' + (d.payout || 0).toFixed(4));
      } else {
        labelEl.textContent = 'LOST! -' + amount.toFixed(4) + ' ' + diceCurrency;
        labelEl.style.color = 'var(--red)';
        arenaToast('Roll ' + d.roll.toFixed(2) + ' — LOST!', true);
      }
      arenaLoadBalance();
    }, 600);
  }).catch(function(){
    setTimeout(function(){
      dicePlaying = false;
      btn.disabled = false;
      btn.textContent = 'ROLL DICE';
      resultEl.className = 'dice-roll-result';
      resultEl.textContent = '--';
      arenaToast('Dice roll failed', true);
    }, 600);
  });
};


// ═══ HI-LO GAME ═══
var hiloCurrency = 'PP';
var hiloGameId = null;
var hiloActive = false;
var hiloCards = [];
var hiloMultiplier = 1.0;
var hiloBetAmount = 0;

var HILO_SUITS = ['rock', 'dust', 'ice', 'iron'];
var HILO_SUIT_ICONS = {rock:'\u{1FAA8}', dust:'\u{1F32A}', ice:'\u{1F9CA}', iron:'\u{2699}'};

window.setHiloCur = function(cur) {
  hiloCurrency = cur;
  document.querySelectorAll('#hiloCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qHilo = function(v) { document.getElementById('hiloBetInput').value = v; };

function initHilo() {
  checkActiveHilo();
}

function renderHiloCards() {
  var area = document.getElementById('hiloCardsArea');
  if (!area) return;
  area.innerHTML = '';
  hiloCards.forEach(function(card){
    var el = document.createElement('div');
    el.className = 'hilo-card-sm';
    var suitIcon = HILO_SUIT_ICONS[card.suit] || card.suit;
    el.innerHTML = '<span class="hc-val">' + (card.display || card.name) + '</span><span class="hc-suit">' + suitIcon + '</span>';
    area.appendChild(el);
  });
}

function updateHiloDisplay() {
  var card = hiloCards.length ? hiloCards[hiloCards.length - 1] : null;
  var bigCard = document.getElementById('hiloCurrentCard');
  if (bigCard) {
    if (card) {
      var suitIcon = HILO_SUIT_ICONS[card.suit] || card.suit;
      bigCard.querySelector('.hilo-card-val').textContent = card.display || card.name;
      bigCard.querySelector('.hilo-card-suit').textContent = suitIcon + ' ' + (card.suit || '').toUpperCase();
      bigCard.classList.add('reveal');
      setTimeout(function(){ bigCard.classList.remove('reveal'); }, 500);
    } else {
      bigCard.querySelector('.hilo-card-val').textContent = '?';
      bigCard.querySelector('.hilo-card-suit').textContent = '';
    }
  }
  var multEl = document.getElementById('hiloMultVal');
  if (multEl) multEl.textContent = hiloMultiplier.toFixed(2) + 'x';

  var higherBtn = document.getElementById('hiloHigherBtn');
  var lowerBtn = document.getElementById('hiloLowerBtn');
  var cashBtn = document.getElementById('hiloCashoutBtn');
  var startBtn = document.getElementById('hiloStartBtn');

  if (hiloActive) {
    if (higherBtn) higherBtn.disabled = false;
    if (lowerBtn) lowerBtn.disabled = false;
    if (cashBtn) { cashBtn.disabled = hiloCards.length < 2; cashBtn.textContent = 'CASHOUT ' + (hiloBetAmount * hiloMultiplier).toFixed(4) + ' ' + hiloCurrency; }
    if (startBtn) { startBtn.textContent = 'GAME IN PROGRESS'; startBtn.disabled = true; }
  } else {
    if (higherBtn) higherBtn.disabled = true;
    if (lowerBtn) lowerBtn.disabled = true;
    if (cashBtn) { cashBtn.disabled = true; cashBtn.textContent = 'CASHOUT'; }
    if (startBtn) { startBtn.textContent = 'START GAME'; startBtn.disabled = !arenaWallet; }
  }
  renderHiloCards();
}

function checkActiveHilo() {
  if (!arenaWallet) return;
  fetch(ARENA_API + '/hilo/active', { headers: getAuthHeaders() }).then(function(r){ return r.json(); })
  .then(function(d){
    if (d.active || d.gameId) {
      hiloGameId = d.gameId;
      hiloActive = true;
      hiloCards = d.cards || [];
      hiloMultiplier = d.multiplier || 1.0;
      hiloBetAmount = d.bet || 0;
      hiloCurrency = d.currency || 'PP';
      updateHiloDisplay();
    }
  }).catch(function(){});
}

window.startHilo = function() {
  if (hiloActive) return;
  if (!arenaWallet) return arenaToast('Connect wallet first', true);
  var amount = parseFloat(document.getElementById('hiloBetInput').value);
  if (!amount || amount <= 0) return arenaToast('Enter bet amount', true);

  var btn = document.getElementById('hiloStartBtn');
  btn.disabled = true;
  btn.textContent = 'STARTING...';

  fetch(ARENA_API + '/hilo/start', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: hiloCurrency })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'START GAME';
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    hiloGameId = d.gameId;
    hiloActive = true;
    hiloCards = d.cards || [];
    hiloMultiplier = d.multiplier || 1.0;
    hiloBetAmount = amount;
    updateHiloDisplay();
    arenaLoadBalance();
    arenaToast('Game started! Higher or Lower?');
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = 'START GAME';
    arenaToast('Failed to start game', true);
  });
};

window.guessHilo = function(dir) {
  if (!hiloActive || !hiloGameId) return;
  var higherBtn = document.getElementById('hiloHigherBtn');
  var lowerBtn = document.getElementById('hiloLowerBtn');
  if (higherBtn) higherBtn.disabled = true;
  if (lowerBtn) lowerBtn.disabled = true;

  fetch(ARENA_API + '/hilo/guess', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ gameId: hiloGameId, guess: dir })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      if (hiloActive) { if (higherBtn) higherBtn.disabled = false; if (lowerBtn) lowerBtn.disabled = false; }
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    if (d.card) hiloCards.push(d.card);
    if (d.cards) hiloCards = d.cards;
    hiloMultiplier = d.multiplier || hiloMultiplier;

    if (d.correct === false || d.status === 'lost') {
      hiloActive = false;
      hiloGameId = null;
      updateHiloDisplay();
      arenaToast('Wrong guess! Game over!', true);
      arenaLoadBalance();
    } else {
      updateHiloDisplay();
      arenaToast('Correct! Multiplier: ' + hiloMultiplier.toFixed(2) + 'x');
    }
  }).catch(function(){
    if (hiloActive) { if (higherBtn) higherBtn.disabled = false; if (lowerBtn) lowerBtn.disabled = false; }
    arenaToast('Guess failed', true);
  });
};

window.cashoutHilo = function() {
  if (!hiloActive || !hiloGameId) return;
  if (hiloCards.length < 2) return arenaToast('Make at least one guess first', true);
  var cashBtn = document.getElementById('hiloCashoutBtn');
  if (cashBtn) { cashBtn.disabled = true; cashBtn.textContent = 'CASHING OUT...'; }

  fetch(ARENA_API + '/hilo/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ gameId: hiloGameId })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      if (cashBtn) { cashBtn.disabled = false; cashBtn.textContent = 'CASHOUT'; }
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    hiloActive = false;
    hiloGameId = null;
    updateHiloDisplay();
    arenaToast('Cashed out! +' + (d.payout || 0).toFixed(4) + ' ' + (d.currency || hiloCurrency));
    arenaLoadBalance();
  }).catch(function(){
    if (cashBtn) { cashBtn.disabled = false; cashBtn.textContent = 'CASHOUT'; }
    arenaToast('Cashout failed', true);
  });
};


// ═══ OPEN / CLOSE ARENA ═══
function stopAllArenaTimers() {
  _clearActiveTimeout(crashPollTimer); crashPollTimer = null;
  if(countdownInterval){ _clearActiveInterval(countdownInterval); countdownInterval = null; }
  crashCountdown = 0;
}

window.openArena = function() {
  var overlay = document.getElementById('arenaOverlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Initialize arena on first open
  arenaTryAutoConnect();
  initCrashCanvas();
  initMinesGrid();
  updateCrashDisplay();
  updateCrashBtn();
  updateMinesInfo();
  loadCrashHistory();
  pollCrashRound();
  updateDiceUI();
  updateHiloDisplay();
  arenaInited = true;
};

window.closeArena = function() {
  var overlay = document.getElementById('arenaOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  stopAllArenaTimers();
};

// Close on Escape key
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    // Land select cancel
    if(landSelectMode){ cancelLandSelect(); _showMobSizeControls(false); return; }
    // Claim modal
    if(document.getElementById('claimModal').classList.contains('open')){ closeClaimModal(); return; }
    // Base modal
    if(document.getElementById('baseModal').classList.contains('open')){ closeBaseModal(); return; }
    // Minigame overlay
    if(document.getElementById('minigameOverlay').classList.contains('active')){ closeMinigameOverlay(); return; }
    // Declare War modal
    if(document.getElementById('declareWarModal').style.display==='flex'){ closeDeclareWarModal(); return; }
    // Exchange modal
    if(document.getElementById('exchangeModal').classList.contains('open')){ closeExchangeModal(); return; }
    // Arena
    if(document.getElementById('arenaOverlay').classList.contains('active')){ closeArena(); return; }
  }
});

// Close on backdrop click
document.getElementById('arenaOverlay').addEventListener('click', function(e){
  if (e.target === this) closeArena();
});

// Resize handler (debounced — canvas reinit is expensive)
window.addEventListener('resize', _debounce(function(){
  if (document.getElementById('arenaOverlay').classList.contains('active')) {
    initCrashCanvas();
    drawCrashChart();
  }
}, 250));

})(); // end ARENA IIFE

/* ═══════════════════════════════════════════════
   ANNOUNCEMENT BANNER
   ═══════════════════════════════════════════════ */
(function(){
  var _announceDismissed = sessionStorage.getItem('announce_dismissed');
  var POLL_INTERVAL = 120000; // 2분마다 갱신

  function showAnnounce(text){
    if(!text || _announceDismissed === text) return;
    var banner = document.getElementById('announceBanner');
    var track  = document.getElementById('announceTrack');
    if(!banner||!track) return;

    // 텍스트 길이에 따라 속도 조절 (짧으면 빠르게, 길면 느리게)
    var dur = Math.max(15, Math.min(60, text.length * 0.4));
    banner.style.setProperty('--dur', dur + 's');

    // 2번 반복하여 끊김 없는 루프
    track.innerHTML = '';
    for(var i=0;i<2;i++){
      var span = document.createElement('span');
      span.className = 'announce-item';
      span.textContent = text;
      track.appendChild(span);
    }

    banner.classList.add('show');
  }

  window.closeAnnounce = function(){
    var banner = document.getElementById('announceBanner');
    if(banner) banner.classList.remove('show');
    // 이번 세션에서는 다시 안 보임
    var track = document.getElementById('announceTrack');
    if(track && track.firstChild) _announceDismissed = track.firstChild.textContent;
    sessionStorage.setItem('announce_dismissed', _announceDismissed||'');
  };

  // ═══════ GOVERNANCE VISIBILITY ═══════

  // Commander banner: poll + display (global for _drawSectorOverlay access)
  window._cmdInfo = null;
  window._cmdExpanded = localStorage.getItem('pw_cmd_expanded')==='1';
  window.toggleCmdExpand = function(){
    window._cmdExpanded = !window._cmdExpanded;
    localStorage.setItem('pw_cmd_expanded', window._cmdExpanded?'1':'0');
    if(typeof loadCommanderBanner==='function') loadCommanderBanner();
  };
  function _hideCommanderUI() {
    var el = document.getElementById('tbCommander');
    if (el) el.classList.remove('show');
    var box = document.getElementById('baseCmdAnnounceBox');
    if (box) box.style.display = 'none';
    var txt = document.getElementById('baseCmdAnnounceText');
    if (txt) txt.textContent = '';
    var nameEl = document.getElementById('baseCmdAnnounceName');
    if (nameEl) nameEl.textContent = '';
  }
  function loadCommanderBanner() {
    _guardedJsonFetch('commander-banner', '/api/governance/commander', {minGap:15000, backoffMs:120000}).then(function(info){
      if (!info) return;
      _cmdInfo = info;
      // commander 가 비어있으면 즉시 모든 UI 숨김 (orphan 방어)
      if (!info || !info.commander) { _hideCommanderUI(); return; }
      var el = document.getElementById('tbCommander');
      var nameEl = document.getElementById('tbCmdName');
      if (!el || !nameEl) return;
      // Respect user display toggle — hide banner + announcement if off
      var showBar = (typeof getDisplaySetting==='function') ? getDisplaySetting('commanderBar') : true;
      if (info.commander && showBar) {
        var name = info.commanderNickname || (info.commander.slice(0,6)+'...'+info.commander.slice(-4));
        nameEl.textContent = name;
        el.classList.add('show');
      } else {
        el.classList.remove('show');
      }
      // Commander announcement is now shown ONLY inside BASE > TERRITORY tab.
      // Never display on main screen — keep overlay hidden.
      var cmdAnnEl = document.getElementById('tbCmdAnnounce');
      if (cmdAnnEl) cmdAnnEl.style.display = 'none';
      // Also mirror into BASE > TERRITORY tab.
      // Commander 가 없거나(임기 종료) announcement 가 비면 박스 숨김 — 옛 메시지가 남지 않도록.
      var baseAnnBox = document.getElementById('baseCmdAnnounceBox');
      var baseAnnText = document.getElementById('baseCmdAnnounceText');
      var baseAnnName = document.getElementById('baseCmdAnnounceName');
      if (baseAnnBox && baseAnnText) {
        if (info && info.commander && info.announcement) {
          baseAnnText.textContent = info.announcement;
          if (baseAnnName) baseAnnName.textContent = info.commanderNickname ? ('— ' + info.commanderNickname) : '';
          baseAnnBox.style.display = '';
        } else {
          baseAnnText.textContent = '';
          if (baseAnnName) baseAnnName.textContent = '';
          baseAnnBox.style.display = 'none';
        }
      }
      updateGovRoles();
    }).catch(function(){ _hideCommanderUI(); });
  }
  // Load on boot + poll every 60s + refresh on tab visibility/focus.
  // 커맨더 임기 종료 / announcement 변경이 즉시 반영되도록 다층 트리거.
  _setActiveTimeout(loadCommanderBanner, 2000);
  _setActiveInterval(loadCommanderBanner, 60000);
  // 탭 복귀 / 창 포커스 시 즉시 fresh 데이터 (사용자가 admin 에서 변경하고 게임 탭 돌아왔을 때)
  _onPageVisible(loadCommanderBanner);
  _onPageFocus(loadCommanderBanner);
  // 외부에서 호출 가능 (예: admin 변경 직후)
  window.refreshCommander = loadCommanderBanner;

  // ── GP Colony Announcements polling ──
  var _gpAnnounceIdx = 0;
  function pollGPAnnouncements() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('gp-announcements', '/api/announce/active', {minGap:30000, backoffMs:120000}).then(function(items){
      if (!items || !items.length) return;
      // Cycle through active announcements round-robin
      var item = items[_gpAnnounceIdx % items.length];
      _gpAnnounceIdx++;
      var author = item.player_name || item.wallet.slice(0,10)+'…';
      if (typeof showAnnounce === 'function') {
        showAnnounce('📢 ' + author + ': ' + item.message);
      }
    }).catch(function(){});
  }
  _setActiveTimeout(pollGPAnnouncements, 5000);
  _setActiveInterval(pollGPAnnouncements, 120000);

  // ═══════ WEATHER POLLING + BANNER ═══════
  function loadWeatherData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('weather-data', '/api/weather', {minGap:30000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(data){
      if (!data) return;
      _weatherData = data.active || [];
      updateWeatherBanner();
      // Trigger texture refresh if weather changed
      if (_weatherData.length > 0) compositeClaimsOnTexture();
    }).catch(function(){});
  }
  // Collapsed state persists in localStorage
  window._toggleWeatherBar = function(){
    var collapsed = localStorage.getItem('pw_wx_collapsed')==='1';
    localStorage.setItem('pw_wx_collapsed', collapsed?'0':'1');
    updateWeatherBanner();
  };
  function updateWeatherBanner() {
    var el = document.getElementById('weatherBanner');
    if (!el) return;
    // Respect user display toggle
    var showBar = (typeof getDisplaySetting==='function') ? getDisplaySetting('weatherBar') : true;
    if (!showBar || !_weatherData.length) { el.classList.remove('show'); el.innerHTML = ''; return; }
    var now = Date.now();
    // Default to collapsed — expand only when user opts in. Keeps HUD clean.
    if (localStorage.getItem('pw_wx_collapsed') === null) {
      localStorage.setItem('pw_wx_collapsed', '1');
    }
    var collapsed = localStorage.getItem('pw_wx_collapsed')==='1';
    if (collapsed) {
      // Compact chip: just count + icon, click to expand
      var iconSet = _weatherData.slice(0,3).map(function(w){return w.icon||'🌡️'}).join('');
      // NOTE: stopPropagation is required. _toggleWeatherBar replaces the
      // banner's innerHTML, which detaches the click target. The document-level
      // "click outside banner" listener would then see wxBar.contains(target)
      // as false (detached) and auto-collapse the banner we just expanded.
      el.innerHTML = '<div class="wx-item" onclick="event.stopPropagation();_toggleWeatherBar()" title="Expand weather bar">'
        + '<span class="wx-icon">'+iconSet+'</span>'
        + '<span class="wx-sector">'+_weatherData.length+' '+t('wx_active')+'</span>'
        + '<span style="color:var(--tx3);font-size:8px;margin-left:4px">▸</span>'
        + '</div>';
      el.classList.add('show');
      el.classList.add('compact');
      return;
    }
    el.classList.remove('compact');
    var items = _weatherData.slice(0, 5).map(function(wx, idx) {
      var remaining = Math.max(0, new Date(wx.endsAt).getTime() - now);
      var mins = Math.floor(remaining / 60000);
      var timeStr = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
      return '<div class="wx-item" onclick="_showWeatherDetail('+idx+')">'
        + '<span class="wx-icon">' + (wx.icon || '🌡️') + '</span>'
        + '<span class="wx-sector">' + (wx.sectorName || t('wx_sector')+' ' + wx.sectorId) + '</span>'
        + '<span class="wx-time">' + timeStr + '</span>'
        + '</div>';
    }).join('');
    // Minimize button at the end
    items += '<div class="wx-item" onclick="event.stopPropagation();_toggleWeatherBar()" title="Minimize" style="padding:0 8px;color:var(--tx3);border-left:1px solid rgba(255,140,60,.25)">—</div>';
    el.innerHTML = items;
    el.classList.add('show');
  }

  function _buildWxEffectMap(){return {
    sandstorm:   { name: t('wx_sandstorm'), desc: t('wx_sandstorm_desc'),
      effects: [{label:t('wx_mining_yield'),val:'+50%',type:'buff'},{label:t('wx_movement_speed'),val:'-20%',type:'debuff'},{label:t('wx_visibility'),val:'Reduced',type:'debuff'}]},
    solar_flare: { name: t('wx_solar_flare'), desc: t('wx_solar_flare_desc'),
      effects: [{label:t('wx_mining_yield'),val:'+100%',type:'buff'},{label:t('wx_shield_strength'),val:'-50%',type:'debuff'},{label:t('wx_hijack_cost'),val:'+25%',type:'buff'}]},
    meteor_shower:{ name: t('wx_meteor_shower'), desc: t('wx_meteor_shower_desc'),
      effects: [{label:t('wx_rare_drop'),val:'+30%',type:'buff'},{label:t('wx_harvest_bonus'),val:'+20%',type:'buff'},{label:t('wx_structure_damage'),val:'Possible',type:'debuff'}]},
    dust_devil:  { name: t('wx_dust_devil'), desc: t('wx_dust_devil_desc'),
      effects: [{label:t('wx_claim_cost'),val:'-15%',type:'buff'},{label:t('wx_mining_yield'),val:'-10%',type:'debuff'},{label:t('wx_exploration_speed'),val:'+25%',type:'buff'}]}
  };}
  var _wxEffectMap = _buildWxEffectMap();

  window._showWeatherDetail = function(idx) {
    var wx = _weatherData[idx];
    if(!wx) return;
    var wxMap = _buildWxEffectMap();
    var info = wxMap[wx.weatherType] || {name:wx.weatherType,desc:'Unknown weather event',effects:[]};
    var remaining = Math.max(0, new Date(wx.endsAt).getTime() - Date.now());
    var mins = Math.floor(remaining / 60000);
    var timeStr = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';

    var html = '<div class="wx-d-title">' + (wx.icon||'🌡️') + ' ' + info.name + '</div>';
    html += '<div style="font-size:9px;color:var(--tx2);margin-bottom:8px;line-height:1.4">' + info.desc + '</div>';
    html += '<div class="wx-d-row"><div class="wx-d-label">'+t('wx_sector')+'</div><div class="wx-d-val neutral">' + (wx.sectorName||t('wx_sector')+' '+wx.sectorId) + '</div></div>';
    html += '<div class="wx-d-row"><div class="wx-d-label">'+t('wx_time_left')+'</div><div class="wx-d-val neutral">' + timeStr + '</div></div>';
    info.effects.forEach(function(e){
      html += '<div class="wx-d-row"><div class="wx-d-label">'+e.label+'</div><div class="wx-d-val '+e.type+'">'+e.val+'</div></div>';
    });

    var pop = document.getElementById('wxDetailPopup');
    document.getElementById('wxDetailContent').innerHTML = html;
    // Anchor the popover to the right of the weather chip — grows outward, not
    // a giant bottom sheet that eats the screen.
    var chip = document.getElementById('weatherBanner');
    if(chip){
      var r = chip.getBoundingClientRect();
      var isMobile = window.innerWidth <= 768;
      if(isMobile){
        // On mobile, center horizontally, above the chip so thumbs don't cover it
        pop.style.left = '50%';
        pop.style.right = 'auto';
        pop.style.top = 'auto';
        pop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
        pop.style.transform = 'translateX(-50%)';
      } else {
        // Desktop: to the right of the chip, aligned to its top
        pop.style.left = (r.right + 10) + 'px';
        pop.style.right = 'auto';
        pop.style.top = Math.max(80, r.top - 20) + 'px';
        pop.style.bottom = 'auto';
        pop.style.transform = '';
      }
    }
    pop.classList.add('open');
  };
  // Close on outside tap
  document.addEventListener('click', function(e){
    var popup = document.getElementById('wxDetailPopup');
    if(popup && popup.classList.contains('open') && !popup.contains(e.target) && !e.target.closest('.wx-item')){
      popup.classList.remove('open');
    }
    // Auto-collapse expanded weather bar when tapping outside
    // (mobile UX: don't force users to hunt for the tiny "—" button)
    var wxBar = document.getElementById('weatherBanner');
    if(wxBar && wxBar.classList.contains('show') && !wxBar.classList.contains('compact')
       && !wxBar.contains(e.target) && (!popup || !popup.contains(e.target))){
      var isCollapsed = localStorage.getItem('pw_wx_collapsed')==='1';
      if(!isCollapsed){
        localStorage.setItem('pw_wx_collapsed','1');
        try{ updateWeatherBanner(); }catch(_e){}
      }
    }
  });
  _setActiveTimeout(loadWeatherData, 4000);
  _setActiveInterval(loadWeatherData, 60000);
  _setActiveInterval(updateWeatherBanner, 30000);
  // Animate weather/POI/starlink overlay texture (throttled — mobile much slower)
  var _compositeInterval = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 30000 : 8000;
  _setActiveInterval(function() {
    var passes = (_starlinkData && Array.isArray(_starlinkData.passes)) ? _starlinkData.passes : [];
    if (_weatherData.length > 0 || _poiData.length > 0 || passes.length > 0) compositeClaimsOnTexture();
  }, _compositeInterval);

  // ═══════ EXPLORATION POLLING ═══════
  window._myOwnedSectors = window._myOwnedSectors || [];
  window._explorationFee = 0;
  window._userPP = 0;
  function loadExplorationData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('exploration-pois', '/api/exploration/pois', {minGap:30000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(data){
      if (!data) return;
      var now = new Date().getTime();
      // Filter out expired POIs client-side too
      _poiData = (data.pois || []).filter(function(p){
        if(p.expiresAt && new Date(p.expiresAt).getTime() < now) return false;
        return true;
      });
      if (Array.isArray(data.ownedSectorIds)) window._myOwnedSectors = data.ownedSectorIds;
      if (typeof data.explorationFee === 'number') window._explorationFee = data.explorationFee;
      if (typeof data.userPP === 'number') window._userPP = data.userPP;
      if (_poiData.length > 0) {
        console.log('[POI] Active:', _poiData.filter(function(p){return !p.discovered}).length, '/', _poiData.length, 'total, fee:', window._explorationFee, 'PP, userPP:', window._userPP);
        compositeClaimsOnTexture();
      }
    }).catch(function(){});
  }
  window.loadExplorationData = loadExplorationData;
  function loadStarlinkData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('exploration-starlink', '/api/exploration/starlink', {minGap:/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 60000 : 30000, backoffMs:120000}).then(function(data){
      if (!data) return;
      _starlinkData = {
        satellites: Array.isArray(data && data.satellites) ? data.satellites : [],
        passes: Array.isArray(data && data.passes) ? data.passes : [],
        serverTime: data && data.serverTime
      };
      _updateStarlinkPositions();
    }).catch(function(){});
  }
  _setActiveTimeout(loadExplorationData, 5000);
  _setActiveInterval(loadExplorationData, 60000);
  _setActiveTimeout(loadStarlinkData, 6000);
  // Starlink position updates: 30s desktop, 60s mobile (3D mesh update is heavy)
  _setActiveInterval(loadStarlinkData, /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 60000 : 30000);
  // Init Starlink 3D orbit around globe
  function _tryInitStarlinkOrbit() {
    if (_slDots.length) return;
    _initStarlinkOrbit();
    if (!_slDots.length) _setActiveTimeout(_tryInitStarlinkOrbit, 2000);
  }
  _setActiveTimeout(_tryInitStarlinkOrbit, 3000);
  // Starlink position updates handled by _animateStarlink RAF loop

  // ═══════ ROCKET EVENT POLLING ═══════
  function loadRocketData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('rockets-active', '/api/rockets', {minGap:25000, backoffMs:120000}).then(function(data){
      if (!data) return;
      _rocketData = data;
      updateRocketBanner();
      _updateRocketMesh();
      if (_rocketData.events && _rocketData.events.length > 0) compositeClaimsOnTexture();
    }).catch(function(){});
  }
  function updateRocketBanner() {
    var el = document.getElementById('rocketBanner');
    if (!el) return;
    var events = (_rocketData.events || []).filter(function(e){ return e.status !== 'completed'; });
    if (!events.length) { el.classList.remove('show'); el.innerHTML = ''; return; }
    var ev = events[0];
    var now = Date.now();
    var icon, typeLabel, timeStr;
    if (ev.status === 'incoming') {
      icon = '<img src="/assets/textures/rocket_drop.svg" onerror="this.src=&quot;/assets/textures/starship.png&quot;" style="width:16px;height:16px;vertical-align:middle;transform:rotate(-30deg)">';
      typeLabel = ev.eventType === 'rud_explosion' ? 'UNKNOWN OBJECT' : 'SUPPLY DROP';
      var remaining = Math.max(0, new Date(ev.landingAt).getTime() - now);
      var mins = Math.floor(remaining / 60000);
      timeStr = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'm' : mins + 'm';
    } else if (ev.status === 'looting') {
      icon = ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}';
      typeLabel = ev.eventType === 'rud_explosion' ? 'RUD — DEBRIS FIELD' : 'SUPPLY DROP LANDED';
      var remain2 = Math.max(0, new Date(ev.lootingEndsAt).getTime() - now);
      var mins2 = Math.floor(remain2 / 60000);
      timeStr = mins2 + 'm left';
    }
    var remaining2 = ev.totalRewards - ev.claimedRewards;
    var priorityBtn = '';
    if (ev.status === 'incoming' && walletState.address) {
      priorityBtn = '<button onclick="event.stopPropagation();buyLootPriority(' + ev.id + ')" style="font-size:8px;padding:2px 8px;background:rgba(255,209,102,.15);border:1px solid rgba(255,209,102,.3);border-radius:4px;color:var(--gold);cursor:pointer;font-family:var(--fn);white-space:nowrap">PRIORITY (0.3 PP)</button>';
    }
    var tooltipText = ev.status === 'incoming'
      ? 'A rocket is arriving! When it lands, click the drop zone on the map to claim loot (items, GP, PP). First come, first served!'
      : 'The supply drop has landed! Click the 📦 marker on the map to claim loot. ' + remaining2 + ' items remaining!';
    el.innerHTML = '<span class="rk-icon">' + icon + '</span>'
      + '<span class="rk-type">' + typeLabel + '</span>'
      + '<span class="rk-sector" style="margin:0 4px">' + (ev.sectorName || '') + '</span>'
      + '<span class="rk-time">' + timeStr + '</span>'
      + (ev.status === 'looting' ? '<span class="rk-loot">' + remaining2 + '/' + ev.totalRewards + ' loot</span>' : '')
      + priorityBtn;
    el.title = tooltipText;
    // Push event into announce banner so users see it in their normal scan path.
    // Hide the standalone rocket chip to avoid duplication — announce banner is
    // the single source of truth for active events.
    try{
      var sectorPart = ev.sectorName ? (' — ' + ev.sectorName) : '';
      var announceText;
      if (ev.status === 'incoming') {
        announceText = '🛸 ' + typeLabel + ' INCOMING' + sectorPart + ' · LANDS IN ' + timeStr;
      } else {
        announceText = '📦 SUPPLY DROP LANDED' + sectorPart + ' · ' + timeStr + ' · ' + remaining2 + '/' + ev.totalRewards + ' LOOT';
      }
      if (typeof showAnnounce === 'function') showAnnounce(announceText);
      // Hide the duplicate chip since the announce marquee carries the info
      el.classList.remove('show');
    }catch(_e){
      el.classList.add('show');
    }
  }
  _setActiveTimeout(loadRocketData, 7000);
  _setActiveInterval(loadRocketData, 30000);
  _setActiveInterval(updateRocketBanner, 15000);
  _setActiveTimeout(_initRocketMesh, 3500);
  // Rocket 3D mesh: 2s desktop, 5s mobile (reduces WebGL draw calls)
  _setActiveInterval(_updateRocketMesh, /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 5000 : 2000);

  // Keep mission routes visible on the map even when OPS tab isn't open.
  function _refreshOpsMissionsGlobal(){
    if (!_pageIsActive()) return;
    var w = walletState && walletState.address; if(!w) return;
    _guardedJsonFetch('ops-missions-global', '/api/missions/active', {minGap:25000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}})
      .then(function(d){
        if (!d) return;
        window._opsMissions = d.missions || [];
        if(typeof requestRedraw==='function') requestRedraw();
      }).catch(function(){});
  }
  _setActiveTimeout(_refreshOpsMissionsGlobal, 4000);
  _setActiveInterval(_refreshOpsMissionsGlobal, 30000);

  // ═══════ GENERIC MOBILE-FRIENDLY MODAL ═══════
  // Works on both mobile and desktop — uses the .mbg/.mdl pattern, z-index above HUD.
  window.showMobModal = function(title, html){
    // Remove any existing instance to prevent stacking
    var existing = document.getElementById('_mobModal');
    if(existing) existing.remove();
    var bg = document.createElement('div');
    bg.id = '_mobModal';
    bg.className = 'mbg open';
    bg.style.cssText = 'z-index:1300;display:flex';
    var mdl = document.createElement('div');
    mdl.className = 'mdl';
    mdl.style.cssText = 'max-width:420px;width:94vw;max-height:80vh;overflow-y:auto;padding:0';
    mdl.addEventListener('click', function(e){e.stopPropagation();});
    mdl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bdr)">' +
        '<div style="font-size:var(--fs-md);font-weight:700;color:var(--mars);letter-spacing:1px">' + title + '</div>' +
        '<button id="_mobModalX" style="background:none;border:none;color:var(--tx3);font-size:20px;cursor:pointer;padding:0;line-height:1">&times;</button>' +
      '</div>' +
      '<div style="padding:0">' + html + '</div>';
    bg.appendChild(mdl);
    bg.addEventListener('click', function(e){ if(e.target===bg) bg.remove(); });
    document.body.appendChild(bg);
    var x = document.getElementById('_mobModalX');
    if(x) x.addEventListener('click', function(){ bg.remove(); });
  };

  // ═══════ ROCKET LOOT CLAIM ═══════
  window._showRocketLootPopup = function(ev) {
    if (!ev || ev.status !== 'looting') { showToast('Rocket not available for looting'); return; }
    fetch('/api/rockets/' + ev.id + '/loot').then(function(r){return r.json()}).then(function(data){
      var loot = data.loot || [];
      if (!loot.length) { showToast('No loot remaining!'); return; }
      var html = '<div style="text-align:center;padding:16px">'
        + '<div style="font-size:28px;margin-bottom:8px">' + (ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}') + '</div>'
        + '<div style="font-size:13px;font-weight:700;color:#FF6644;margin-bottom:4px">'
        + (ev.eventType === 'rud_explosion' ? 'RUD DEBRIS FIELD' : 'SUPPLY DROP') + '</div>'
        + '<div style="font-size:9px;color:var(--tx3);margin-bottom:12px">' + loot.length + ' items remaining — first come first served!</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:6px;max-height:200px;overflow-y:auto">';
      loot.forEach(function(l) {
        var lIcon = l.hasItem ? '\u{2B50}' : '\u{1F4B0}';
        html += '<button onclick="_claimLoot(' + ev.id + ',' + l.index + ',this)" style="padding:8px 4px;background:rgba(255,100,60,0.15);border:1px solid rgba(255,100,60,0.3);border-radius:6px;color:#FF9944;font-family:var(--fn);font-size:10px;cursor:pointer;text-align:center">'
          + lIcon + '<br><span style="font-size:7px;color:var(--tx3)">#' + (l.index + 1) + '</span></button>';
      });
      html += '</div></div>';
      // infoPanel no longer exists — use the shared modal on both mobile and desktop
      showMobModal('ROCKET LOOT', html);
    }).catch(function(err){
      console.error('[ROCKET] loot load error:', err);
      showToast('Failed to load loot','error');
    });
  };

  window._claimLoot = function(eventId, lootIndex, btn) {
    if (!walletState.address) { showToast('Connect wallet first'); return; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    fetch('/api/rockets/claim-loot', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, rocketEventId: eventId, lootIndex: lootIndex })
    }).then(function(r){return r.json()}).then(function(data){
      if (data.error) { showToast(data.error); if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
      var r = data.reward;
      var msg;
      if (r.type === 'gp') msg = tl('+'+r.amount+' GP from supply drop','보급 투하에서 +'+r.amount+' GP 획득','補給投下から +'+r.amount+' GP 獲得','从补给投放获得 +'+r.amount+' GP');
      else if (r.type === 'xp') msg = tl('+'+r.amount+' XP from supply drop','보급 투하에서 +'+r.amount+' XP 획득','補給投下から +'+r.amount+' XP 獲得','从补给投放获得 +'+r.amount+' XP');
      else if (r.type === 'pp') msg = tl('+'+r.amount+' PP from supply drop','보급 투하에서 +'+r.amount+' PP 획득','補給投下から +'+r.amount+' PP 獲得','从补给投放获得 +'+r.amount+' PP');
      else if (r.type === 'cosmetic') msg = tl('Got '+(r.itemName||r.itemCode||'cosmetic')+' (rare cosmetic)!','희귀 코스메틱 획득: '+(r.itemName||r.itemCode||'cosmetic')+'!','レアコスメを獲得: '+(r.itemName||r.itemCode||'cosmetic')+'!','获得稀有外观：'+(r.itemName||r.itemCode||'cosmetic')+'！');
      else if (r.type === 'item') msg = tl('Got '+(r.itemName||r.itemCode||'item')+' x'+(r.amount||1),(r.itemName||r.itemCode||'item')+' x'+(r.amount||1)+' 획득',(r.itemName||r.itemCode||'item')+' x'+(r.amount||1)+' 獲得','获得 '+(r.itemName||r.itemCode||'item')+' x'+(r.amount||1));
      else msg = tl('Loot claimed!','보상을 획득했습니다!','戦利品を獲得しました！','已领取战利品！');
      showNotification('rocket',tl('Loot claimed','보상 획득','戦利品獲得','已领取战利品'),msg);
      try{_sfx.harvest()}catch(e){}
      if (btn) { btn.textContent = '\u2713'; btn.style.background = 'rgba(0,255,100,0.2)'; btn.style.borderColor = '#00FF88'; }
      try{ refreshEmailBalances(); }catch(_rb){}
    }).catch(function(){ showToast(tl('Claim failed','획득 실패','受取失敗','领取失败')); if(btn){btn.disabled=false;btn.style.opacity='1';} });
  };

  // ═══════ ROCKET INFO POPUP ═══════
  window.showRocketInfo = function() {
    var events = (_rocketData.events || []).filter(function(e){ return e.status !== 'completed'; });
    if (!events.length) return;
    var ev = events[0];
    var now = Date.now();
    var isIncoming = ev.status === 'incoming';
    var isLooting = ev.status === 'looting';
    var remaining = isLooting ? (ev.totalRewards - ev.claimedRewards) : ev.totalRewards;
    var icon = isLooting ? (ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}') : '\u{1F680}';
    var timeLeft = '';
    if (isIncoming) {
      var ms = Math.max(0, new Date(ev.landingAt).getTime() - now);
      timeLeft = Math.floor(ms / 60000) + ' min until landing';
    } else if (isLooting) {
      var ms2 = Math.max(0, new Date(ev.lootingEndsAt).getTime() - now);
      timeLeft = Math.floor(ms2 / 60000) + ' min remaining';
    }
    var html = '<div style="text-align:center;padding:16px">'
      + '<div style="font-size:36px;margin-bottom:8px">' + icon + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:#FF6644;margin-bottom:8px">'
      + (ev.eventType === 'rud_explosion' ? 'RUD EVENT' : 'SUPPLY DROP') + '</div>'
      + '<div style="font-size:10px;color:var(--tx2);margin-bottom:12px;line-height:1.5">'
      + (isIncoming
        ? 'A rocket is on its way to Mars! When it lands, a 📦 marker will appear on the map in <b>' + (ev.sectorName || 'a sector') + '</b>. Click it to claim loot!'
        : 'The supply drop has landed in <b>' + (ev.sectorName || 'a sector') + '</b>! Click the 📦 marker on the map to claim items.')
      + '</div>'
      + '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px">'
      + '<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gold)">' + remaining + '/' + ev.totalRewards + '</div><div style="font-size:8px;color:var(--tx3)">LOOT LEFT</div></div>'
      + '<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--mars)">' + timeLeft + '</div><div style="font-size:8px;color:var(--tx3)">TIME</div></div>'
      + '</div>'
      + '<div style="font-size:9px;color:var(--tx3);line-height:1.4;padding:8px;background:rgba(255,255,255,.03);border-radius:6px">'
      + '💡 <b>How it works:</b> Loot contains GP, items, or rare PP. Click the marker on the map to claim. Each player can claim one loot per drop. First come, first served!'
      + '</div></div>';
    showMobModal('SUPPLY DROP', html);
  };

  // Badge system: wallet → roles map
  var _govWalletRoles = {}; // { wallet: ['commander','governor',...] }
  function updateGovRoles() {
    // Build from sectors data + commander info
    _govWalletRoles = {};
    if (_cmdInfo) {
      if (_cmdInfo.commander) {
        if (!_govWalletRoles[_cmdInfo.commander]) _govWalletRoles[_cmdInfo.commander] = [];
        _govWalletRoles[_cmdInfo.commander].push('commander');
      }
      if (_cmdInfo.vice) {
        if (!_govWalletRoles[_cmdInfo.vice]) _govWalletRoles[_cmdInfo.vice] = [];
        _govWalletRoles[_cmdInfo.vice].push('vice_commander');
      }
    }
    (_sectorsData || []).forEach(function(s) {
      if (s.governor && s.governor.fullWallet) {
        var w = s.governor.fullWallet;
        if (!_govWalletRoles[w]) _govWalletRoles[w] = [];
        if (_govWalletRoles[w].indexOf('governor') < 0) _govWalletRoles[w].push('governor');
      }
    });
  }
  window.govBadgeHTML = function(wallet) {
    if (!wallet) return '';
    var roles = _govWalletRoles[wallet.toLowerCase()] || _govWalletRoles[wallet] || [];
    if (!roles.length) return '';
    if (roles.indexOf('commander') >= 0) return '<span class="title-badge commander" title="Commander">👑 CMDR</span>';
    if (roles.indexOf('governor') >= 0) return '<span class="title-badge governor" title="Governor">🏛 GOV</span>';
    if (roles.indexOf('vice_commander') >= 0) return '<span class="title-badge vice" title="Vice Commander">⭐ VICE</span>';
    return '';
  }

  // Governance leaderboard (sidebar + BASE > SEASON mirror)
  function loadGovLeaderboard() {
    if (!_pageIsActive()) return;
    fetch('/api/governance/leaderboard?sort=tax').then(function(r){return r.json()}).then(function(rows){
      var el = document.getElementById('govLeaderboardList');
      var bsEl = document.getElementById('bsGovLeaderboardList');
      if (!rows || !rows.length) {
        var empty = '<div style="font-size:9px;color:var(--tx3);padding:4px 0">No governors yet</div>';
        if (el) el.innerHTML = empty;
        if (bsEl) bsEl.innerHTML = empty;
        return;
      }
      var cmdWallet = _cmdInfo ? _cmdInfo.commander : null;
      var html = rows.slice(0, 8).map(function(r, i) {
        var isCmd = cmdWallet && r.wallet === cmdWallet;
        var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
        var tax = parseFloat(r.total_tax || 0);
        var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
        var rankColors = ['var(--gold)','#C0C0C0','#CD7F32'];
        var rankColor = i < 3 ? rankColors[i] : 'var(--tx3)';
        return '<div class="gov-lb-row'+(isCmd?' commander':'')+'">'
          + '<span class="glb-rank" style="color:'+rankColor+'">'+(i+1)+'</span>'
          + (isCmd ? '<span class="glb-badge">👑</span>' : '')
          + '<span class="glb-name">'+name+' '+govBadgeHTML(r.wallet)+'</span>'
          + '<span class="glb-val">'+taxStr+' GP</span>'
          + '</div>';
      }).join('');
      if (el) el.innerHTML = html;
      if (bsEl) {
        // Slightly different layout for BASE tab
        bsEl.innerHTML = rows.slice(0,8).map(function(r,i){
          var isCmd = cmdWallet && r.wallet === cmdWallet;
          var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
          var tax = parseFloat(r.total_tax || 0);
          var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
          var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
          return '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;background:rgba(255,209,102,.04);border-left:2px solid '+(isCmd?'var(--red)':'var(--gold)')+';border-radius:4px;font-size:9px">'
            +'<span style="width:22px;color:var(--gold);font-weight:700">'+medal+'</span>'
            +(isCmd?'<span title="Commander">👑</span>':'')
            +'<span style="flex:1;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+name+'</span>'
            +'<span style="color:var(--gold);font-family:var(--fn)">'+taxStr+' GP</span>'
            +'</div>';
        }).join('');
      }
    }).catch(function(){});
  }
  _setActiveTimeout(loadGovLeaderboard, 3000);
  _setActiveInterval(loadGovLeaderboard, 120000);

  // Sector announcements — hidden from main screen; visible inside BASE sector list.
  window.updateSectorAnnounces = function() {
    var el = document.getElementById('tbSectorAnnounce');
    if (el) el.style.display = 'none';
  };

  // Gov change feed alerts
  window.addGovFeed = function(changes) {
    if (!changes || !changes.length) return;
    changes.forEach(function(c) {
      var text;
      var name = c.nickname || (c.wallet ? c.wallet.slice(0,6)+'...'+c.wallet.slice(-4) : '???');
      if (c.type === 'commander') {
        text = '⭐ NEW COMMANDER: ' + name + ' commands all of Mars!';
      } else if (c.type === 'governor') {
        text = '👑 NEW GOVERNOR: ' + name + ' rules ' + (c.sectorName || 'sector') + '!';
      }
      if (text) {
        var feed = document.getElementById('liveFeed');
        if (!feed) return;
        var empty = document.getElementById('liveFeedEmpty');
        if (empty) empty.remove();
        var div = document.createElement('div');
        div.className = 'feed-item feed-gov';
        div.style.cssText = 'border-left:2px solid var(--gold);padding-left:6px;font-weight:bold;color:var(--gold)';
        div.textContent = text;
        feed.insertBefore(div, feed.firstChild);
        // Keep max 20
        while (feed.children.length > 20) feed.removeChild(feed.lastChild);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // SECTOR SIEGE UI
  // ─────────────────────────────────────────────────────────
  var _siegeSectorCode = null;
  var _siegeSectorDefs = null; // cached from /api/sector-defs

  function _loadSectorDefs(cb) {
    if (_siegeSectorDefs) { cb(_siegeSectorDefs); return; }
    fetch('/api/sector-defs').then(function(r){return r.json()}).then(function(d){
      _siegeSectorDefs = (d.sectors || []);
      cb(_siegeSectorDefs);
    }).catch(function(){ cb([]); });
  }

  window.toggleSiegeSection = function() {
    var el = document.getElementById('govSiegeSection');
    var tog = document.getElementById('siegeToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      // Auto-load sector list if not yet selected
      if (!_siegeSectorCode) {
        _loadSectorDefs(function(defs) {
          if (defs.length && !_siegeSectorCode) {
            _siegeSectorCode = defs[0].code;
            var lbl = document.getElementById('siegeSectorLabel');
            if (lbl) lbl.textContent = defs[0].name || defs[0].name_en || defs[0].code;
            loadSiegeInfoPanel(_siegeSectorCode);
          }
        });
      }
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  window.openSiegeSectorPicker = function() {
    _loadSectorDefs(function(defs) {
      var items = defs.map(function(s) {
        var typeTag = s.sector_type === 'core' ? ' [CORE]' : s.sector_type === 'mid' ? ' [MID]' : '';
        return { value: s.code, label: (s.name || s.name_en || s.code) + typeTag };
      });
      gamePicker({ title: 'SELECT SECTOR', items: items, selected: _siegeSectorCode || '' }).then(function(v) {
        if (v == null) return;
        _siegeSectorCode = v;
        var chosen = defs.find(function(s){ return s.code === v; });
        var lbl = document.getElementById('siegeSectorLabel');
        if (lbl) lbl.textContent = chosen ? (chosen.name || chosen.name_en || v) : v;
        loadSiegeInfoPanel(v);
      });
    });
  };

  window.loadSiegeInfoPanel = function(code) {
    var panel = document.getElementById('siegeInfoPanel');
    if (!panel) return;
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">Loading...</div>';

    Promise.all([
      fetch('/api/sector-defs/' + encodeURIComponent(code) + '/governance').then(function(r){return r.json()}).catch(function(){return null}),
      fetch('/api/siege/' + encodeURIComponent(code)).then(function(r){return r.json()}).catch(function(){return {active:false}})
    ]).then(function(results) {
      var gov = results[0];
      var siegeData = results[1];
      var w = walletState.address ? walletState.address.toLowerCase() : null;
      var html = '';

      // [v7.249] 섹터 정체성 헤더 — 지오 섹터명(현 언어) + 티어 배지 (어디를 두고 싸우는지 각인)
      if (gov) {
        var _szName = (LANG==='ko'?gov.sector_name_ko:LANG==='ja'?gov.sector_name_ja:LANG==='zh'?gov.sector_name_zh:gov.sector_name_en) || gov.sector_name_en || code;
        var _szTier = (gov.sector_type||'').toLowerCase();
        var _tierCol = _szTier==='core'?'var(--gold)':_szTier==='mid'?'var(--cyan)':'var(--tx3)';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
        html += '<span style="font-size:13px;font-weight:800;color:var(--tx)">🪐 '+escapeHtml(_szName)+'</span>';
        if (_szTier) html += '<span style="font-size:8px;font-weight:700;color:'+_tierCol+';border:1px solid '+_tierCol+';border-radius:8px;padding:1px 6px;text-transform:uppercase;font-family:var(--fn)">'+_szTier+'</span>';
        html += '</div>';
      }

      // Governor info
      html += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;padding:8px;background:rgba(91,184,232,.04);border-radius:6px;border:1px solid rgba(91,184,232,.12)">';
      if (gov && gov.governor) {
        // [v7.249] 길드 거버너면 길드명/태그 우선 표시 (혈맹이 섹터 소유)
        var govName = gov.governor_guild
          ? ('['+escapeHtml(gov.governor_guild.tag||'')+'] '+escapeHtml(gov.governor_guild.name||''))
          : (gov.governor.nickname || gov.governor.wallet.slice(0,8)+'...');
        var daysTxt = gov.governor.days != null ? ' · '+gov.governor.days+'d' : '';
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+(gov.governor_guild?'GOVERNOR GUILD':'GOVERNOR')+'</span><span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">👑 '+govName+daysTxt+'</span></div>';
        if (gov.governor_guild) {
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">섹터 세수 → 금고</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)">🏛 '+(Math.round(gov.governor_guild.sectorTaxCollected||0)).toLocaleString()+' GP</span></div>';
        }
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">TAX RATE</span><span style="font-size:10px;color:var(--gold)">'+parseFloat(gov.tax_rate||2).toFixed(1)+'%</span></div>';
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">POLICY</span><span style="font-size:10px;color:var(--tx2)">'+_siegePolicyLabel(gov.sector_policy)+'</span></div>';
        if (gov.declaration_text) {
          html += '<div style="margin-top:4px;padding:6px 8px;background:rgba(232,72,85,.04);border-radius:4px;font-size:9px;color:var(--tx2);font-style:italic">"'+escapeHtml(gov.declaration_text.slice(0,120))+(gov.declaration_text.length>120?'…':'')+'"</div>';
        }
      } else {
        html += '<div style="font-size:10px;color:var(--tx3)">No Governor — first to challenge wins!</div>';
      }
      html += '</div>';

      // Active siege
      if (siegeData && siegeData.active && siegeData.siege) {
        var s = siegeData.siege;
        var chalName = s.challenger_nickname || (s.challenger_wallet||'').slice(0,8)+'...';
        var defName  = s.defender_nickname  || (s.defender_wallet  ? s.defender_wallet.slice(0,8)+'...' : 'None');
        var endsAt   = s.siege_ends_at ? new Date(s.siege_ends_at) : null;
        var remaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / (1000*60))) : null;
        var timeStr  = remaining != null ? (remaining > 60 ? Math.floor(remaining/60)+'h '+remaining%60+'m' : remaining+'m') : '—';
        var statusColor = s.status === 'active' ? 'var(--red)' : 'var(--gold)';
        html += '<div style="padding:8px;background:rgba(232,72,85,.06);border-radius:6px;border:1px solid rgba(232,72,85,.25);margin-bottom:8px">';
        html += '<div style="font-size:9px;color:var(--red);font-family:var(--fn);font-weight:700;margin-bottom:4px">⚔️ ACTIVE SIEGE · '+s.status.toUpperCase()+'</div>';
        // [v7.248] resolution_mode 배지 — 이번 공성이 함대 결전(손실 위험)인지 무혈 판정인지 선언 시점부터 노출
        var _szMode = s.fleet_battle_id ? '⚔ 함대 결전 — 패배 시 함선 손실' : (s.resolution_mode === 'fleet_battle' ? '⚔ 함대전 대기' : '◌ 무혈 판정 (함대 미배치 시 점유율 비교)');
        html += '<div style="font-size:8px;color:'+(s.fleet_battle_id?'#ff6b6b':'var(--tx3)')+';margin-bottom:6px;font-family:var(--fn)">'+_szMode+'</div>';
        html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:9px;color:var(--tx3)">CHALLENGER</span><span style="font-size:10px;color:var(--red)">'+chalName+'</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:9px;color:var(--tx3)">DEFENDER</span><span style="font-size:10px;color:var(--cyan)">'+defName+'</span></div>';
        if (s.status === 'active') {
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">ENDS IN</span><span style="font-size:10px;color:'+statusColor+';font-family:var(--fn)">'+timeStr+'</span></div>';
        } else {
          var startsAt = s.siege_starts_at ? new Date(s.siege_starts_at) : null;
          var startsIn = startsAt ? Math.max(0, Math.ceil((startsAt - Date.now()) / (1000*60))) : null;
          var stStr = startsIn != null ? (startsIn > 60 ? Math.floor(startsIn/60)+'h '+startsIn%60+'m' : startsIn+'m') : '—';
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">STARTS IN</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)">'+stStr+'</span></div>';
        }
        html += '</div>';

        // [v7.244] 결전 함대 합류/로스터/관전 패널 (async 로드, siege 우주 자족)
        html += '<div id="siegeFleetPanel_'+s.id+'"></div>';

        // Betting panel placeholder (filled async below)
        if (s.betting_event_id) {
          html += '<div id="siegeBettingPanel_'+code+'" style="margin-bottom:8px"><div style="font-size:9px;color:var(--tx3);padding:4px 0">Loading betting...</div></div>';
        }
      } else {
        // Challenge button
        if (w) {
          html += '<button class="sz-btn" onclick="govDeclareSiege(\''+escapeHtml(code)+'\')" style="width:100%;color:var(--red);border-color:rgba(232,72,85,.4);font-size:9px;padding:8px 12px;margin-bottom:6px" data-i18n="gov_challenge_btn">⚔️ CHALLENGE FOR GOVERNOR</button>';
        } else {
          html += '<div style="font-size:10px;color:var(--tx3);padding:4px 0">Connect wallet to challenge.</div>';
        }
      }

      // Governor controls (if current user is governor of this sector)
      if (w && gov && gov.governor && gov.governor.wallet && gov.governor.wallet.toLowerCase() === w) {
        html += '<div style="padding:8px;background:rgba(91,184,232,.04);border-radius:6px;border:1px solid rgba(91,184,232,.15);margin-top:4px">';
        html += '<div style="font-size:9px;color:var(--cyan);font-family:var(--fn);font-weight:700;margin-bottom:6px">GOVERNOR CONTROLS</div>';
        // Tax rate
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:9px;color:var(--tx3);white-space:nowrap">TAX RATE</span>';
        html += '<input type="range" id="siegeTaxSlider_'+code+'" min="0" max="10" step="0.5" value="'+parseFloat(gov.tax_rate||2)+'" style="flex:1;accent-color:var(--cyan)" oninput="document.getElementById(\'siegeTaxVal_'+code+'\').textContent=this.value+\'%\'">';
        html += '<span id="siegeTaxVal_'+code+'" style="font-size:10px;color:var(--cyan);font-family:var(--fn);min-width:32px">'+parseFloat(gov.tax_rate||2)+'%</span>';
        html += '<button class="sz-btn" onclick="govSaveTaxRate(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--cyan);border-color:rgba(91,184,232,.3)">SET</button>';
        html += '</div>';
        // Policy
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:9px;color:var(--tx3);white-space:nowrap">POLICY</span>';
        html += '<select id="siegePolicy_'+code+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:4px 6px;border-radius:4px;font-family:var(--fn)">';
        ['open','ally_only','closed'].forEach(function(p){
          html += '<option value="'+p+'"'+(gov.sector_policy===p?' selected':'')+'>'+_siegePolicyLabel(p)+'</option>';
        });
        html += '</select>';
        html += '<button class="sz-btn" onclick="govSavePolicy(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--gold);border-color:rgba(255,209,102,.3)">SET</button>';
        html += '</div>';
        // Declaration
        html += '<div style="display:flex;flex-direction:column;gap:4px">';
        html += '<span style="font-size:9px;color:var(--tx3)">DECLARATION (5 GP)</span>';
        html += '<textarea id="siegeDecl_'+code+'" maxlength="1000" rows="2" style="width:100%;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:9px;padding:6px 8px;border-radius:4px;font-family:var(--fn);resize:none;box-sizing:border-box">'+escapeHtml(gov.declaration_text||'')+'</textarea>';
        html += '<button class="sz-btn" onclick="govSaveDeclarationByCode(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--red);border-color:rgba(232,72,85,.3);align-self:flex-end">DECLARE</button>';
        html += '</div>';
        html += '</div>';
      }

      panel.innerHTML = html;

      // [v7.244] 결전 함대 패널 async 로드 (활성 공성일 때만)
      if (siegeData && siegeData.active && siegeData.siege) {
        _loadSiegeFleetPanel(siegeData.siege, code, w);
      }

      // Load betting panel async if there's a betting_event_id
      if (siegeData && siegeData.siege && siegeData.siege.betting_event_id) {
        _loadSiegeBettingPanel(code, siegeData.siege.betting_event_id, w);
      }
    });
  };

  // ── [v7.244] 결전 함대 패널 — 로스터 + JOIN(공격/수비) + 관전 (siege 우주 자족) ──
  //   §19 규칙: inline onclick 금지 → data-action + delegated listener.
  function _siegeSeatRow(sideKey, label, fleetName, fleetId) {
    var col = sideKey === 'attack' ? 'var(--red)' : 'var(--cyan)';
    var val = fleetId
      ? '✓ ' + escapeHtml(fleetName || ('Fleet #' + fleetId))
      : '<span style="color:var(--tx3)">미배치</span>';
    return '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:9px;color:'+col+'">'+label+'</span><span style="font-size:9px">'+val+'</span></div>';
  }
  // [Phase 2] 한 진영의 합류 함대 목록 (혈맹원 여럿이 같은 전장에)
  function _siegeSideList(sideKey, label, commits) {
    var col = sideKey === 'attack' ? 'var(--red)' : 'var(--cyan)';
    var h = '<div style="margin-bottom:5px"><div style="font-size:9px;color:'+col+';font-weight:700">'+label+' · '+commits.length+'함대</div>';
    if (commits.length) {
      h += '<div style="padding-left:8px">';
      commits.slice(0, 12).forEach(function(c){
        var nm = escapeHtml(c.fleet_name || ('Fleet #' + c.fleet_id));
        h += '<div style="font-size:8px;color:var(--tx2);display:flex;justify-content:space-between"><span>· '+nm+'</span><span style="color:var(--tx3)">'+(c.ship_count||0)+'척</span></div>';
      });
      if (commits.length > 12) h += '<div style="font-size:8px;color:var(--tx3)">… 외 '+(commits.length-12)+'함대</div>';
      h += '</div>';
    } else {
      h += '<div style="font-size:8px;color:var(--tx3);padding-left:8px">미배치</div>';
    }
    return h + '</div>';
  }
  function _siegeJoinErr(code) {
    var m = { not_a_participant:'이 공성의 참가자가 아닙니다', fleet_in_battle:'해당 함대가 전투 중입니다',
      fleet_empty:'함대에 함선이 없습니다', battle_already_created:'이미 결전이 시작되었습니다',
      fleet_not_found:'함대를 찾을 수 없습니다', siege_resolved:'이미 종료된 공성입니다',
      side_full:'이 진영 합류 함대가 가득 찼습니다' };
    return m[code] || ('합류 실패' + (code ? (': ' + code) : ''));
  }
  async function _loadSiegeFleetPanel(siege, code, w) {
    var el = document.getElementById('siegeFleetPanel_' + siege.id);
    if (!el) return;
    if (!w) { el.innerHTML = ''; return; }
    try {
      var rosterResp = await fetch('/api/siege/' + siege.id + '/roster').then(function(r){return r.json()}).catch(function(){return null});
      var roster = rosterResp && rosterResp.roster ? rosterResp.roster : null;
      if (!roster) { el.innerHTML = ''; return; }
      var myFleets = [];
      try {
        var fr = await fetch('/api/fleets', { headers: getAuthHeaders() });
        if (fr.ok) { var fd = await fr.json(); myFleets = (fd.fleets || []).filter(function(f){ return (parseInt(f.ships_alive)||parseInt(f.ship_count)||0) > 0; }); }
      } catch(_) {}

      var battleMade = !!roster.fleet_battle_id;
      var modeBadge = roster.resolution_mode === 'fleet_battle' ? '⚔ 함대전' : '◌ 무혈판정';
      var h = '<div style="padding:8px;background:rgba(255,209,102,.05);border-radius:6px;border:1px solid rgba(255,209,102,.2);margin-bottom:8px">';
      // [Phase 2] 다함대 — 양 진영 합류 함대 목록/카운트
      var _commits = Array.isArray(roster.commits) ? roster.commits : [];
      var _atkN = roster.atk_count || _commits.filter(function(c){return c.side==='atk';}).length;
      var _defN = roster.def_count || _commits.filter(function(c){return c.side==='def';}).length;
      h += '<div style="font-size:9px;color:var(--gold);font-family:var(--fn);font-weight:700;margin-bottom:6px">⚔ 결전 함대 ('+_atkN+' vs '+_defN+')<span style="float:right;color:var(--tx3)">'+modeBadge+'</span></div>';
      h += _siegeSideList('attack', '⚔ 공격', _commits.filter(function(c){return c.side==='atk';}));
      h += _siegeSideList('defense', '🛡 수비', _commits.filter(function(c){return c.side==='def';}));

      if (!battleMade) {
        if (myFleets.length) {
          h += '<select data-siege-fleet-sel="'+siege.id+'" style="width:100%;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:4px 6px;border-radius:4px;font-family:var(--fn);margin:4px 0">';
          myFleets.forEach(function(f){ h += '<option value="'+f.id+'">'+escapeHtml(f.name||('Fleet #'+f.id))+' ('+(f.ships_alive||f.ship_count||0)+')</option>'; });
          h += '</select>';
          h += '<div style="display:flex;gap:6px">';
          h += '<button type="button" class="sz-btn" data-action="siegeJoin" data-side="attack" data-siege="'+siege.id+'" style="flex:1;font-size:9px;padding:6px;color:var(--red);border-color:rgba(232,72,85,.4)">⚔ 공격 합류</button>';
          h += '<button type="button" class="sz-btn" data-action="siegeJoin" data-side="defense" data-siege="'+siege.id+'" style="flex:1;font-size:9px;padding:6px;color:var(--cyan);border-color:rgba(91,184,232,.4)">🛡 수비 합류</button>';
          h += '</div>';
        } else {
          h += '<div style="font-size:9px;color:var(--tx3);padding:4px 0">함대가 없어도 <b>영토 점유율로 도전/방어</b> 가능 (◌ 무혈 판정, 함선 손실 없음). 함대전을 원하면 조선소에서 함선을 건조하세요.</div>';
        }
      }
      if (battleMade && siege.status === 'active') {
        h += '<button type="button" class="sz-btn" data-action="siegeSpectate" data-battle="'+roster.fleet_battle_id+'" style="width:100%;font-size:9px;padding:6px;margin-top:6px;color:var(--gold);border-color:rgba(255,209,102,.4)">👁 관전</button>';
      }
      h += '</div>';
      el.innerHTML = h;

      if (!el.dataset.delegated) {
        el.dataset.delegated = '1';
        el.addEventListener('click', function(ev) {
          var btn = ev.target.closest('button[data-action]');
          if (!btn) return;
          ev.stopPropagation();
          var act = btn.getAttribute('data-action');
          if (act === 'siegeSpectate') {
            var bid = parseInt(btn.getAttribute('data-battle'), 10);
            if (bid && typeof openBattleViewer === 'function') { try { openBattleViewer(bid); } catch(e){ console.error('openBattleViewer', e); } }
            return;
          }
          if (act === 'siegeJoin') {
            if (btn.disabled) return;
            var sid = parseInt(btn.getAttribute('data-siege'), 10);
            var side = btn.getAttribute('data-side');
            var sel = el.querySelector('select[data-siege-fleet-sel="'+sid+'"]');
            var fleetId = sel ? parseInt(sel.value, 10) : null;
            if (!fleetId) { if (typeof showToast==='function') showToast('함대를 선택하세요','warn'); return; }
            console.log('[BTN] siegeJoin', sid, side, fleetId);
            // [v7.248] full-loss 라이브 — 합류 = 패배 시 함선 영구 손실. 무손실 대안(점유율 판정) 안내 후 confirm.
            var doCommit = function() {
              btn.disabled = true; var prev = btn.textContent; btn.textContent = '...';
              fetch('/api/siege/'+sid+'/commit-fleet', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()),
                body: JSON.stringify({ fleetId: fleetId })
              }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
                .then(function(res){
                  if (!res.ok || !res.j || !res.j.success) {
                    if (typeof showToast==='function') showToast(_siegeJoinErr(res.j && res.j.error), 'warn');
                    btn.disabled = false; btn.textContent = prev; return;
                  }
                  if (typeof showToast==='function') showToast(side==='attack'?'⚔ 공격 함대 합류 완료':'🛡 수비 함대 합류 완료','success');
                  loadSiegeInfoPanel(code);
                }).catch(function(){ if (typeof showToast==='function') showToast('합류 실패','warn'); btn.disabled = false; btn.textContent = prev; });
            };
            if (typeof gameConfirm === 'function') {
              Promise.resolve(gameConfirm({
                icon: '⚠',
                title: side==='attack' ? '공격 함대 합류' : '수비 함대 합류',
                body: '결전에서 <b>패배하면 합류한 함대의 함선이 <span style="color:#ff6b6b">영구 손실(전사)</span></b>될 수 있습니다.<br><br>함대를 걸지 않으면 영토 점유율로만 판정되어 <b>함선 손실이 없습니다</b>.',
                confirmText: side==='attack' ? '⚔ 합류' : '🛡 합류'
              })).then(function(ok){ if (ok) doCommit(); });
            } else { doCommit(); }
          }
        });
      }
    } catch(e) { console.error('[siegeFleetPanel]', e); el.innerHTML = ''; }
  }

  // ── Betting panel loader ──
  function _loadSiegeBettingPanel(code, betEventId, w) {
    var container = document.getElementById('siegeBettingPanel_'+code);
    if (!container) return;

    Promise.all([
      fetch('/api/betting/events/'+betEventId+'/odds').then(function(r){return r.json()}).catch(function(){return null}),
      w ? fetch('/api/betting/mine', { headers: getAuthHeaders() }).then(function(r){return r.json()}).catch(function(){return {bets:[]}}) : Promise.resolve({bets:[]})
    ]).then(function(res) {
      var odds = res[0];
      var userBets = (res[1] && res[1].bets) || [];
      if (!odds || odds.status === 'resolved' || odds.status === 'cancelled') {
        container.innerHTML = '';
        return;
      }

      // Check if user already bet on this event
      var myBet = userBets.find(function(b){ return b.event_id === betEventId; });

      var html = '<div style="padding:8px;background:rgba(255,209,102,.04);border-radius:6px;border:1px solid rgba(255,209,102,.2)">';
      html += '<div style="font-size:9px;color:var(--gold);font-family:var(--fn);font-weight:700;margin-bottom:8px">🎰 SIEGE BETTING</div>';

      // Odds display
      var aGP  = odds.option_a.total_gp || 0;
      var bGP  = odds.option_b.total_gp || 0;
      var total = aGP + bGP;
      var aOdds = odds.option_a.odds ? odds.option_a.odds.toFixed(2)+'×' : '—';
      var bOdds = odds.option_b.odds ? odds.option_b.odds.toFixed(2)+'×' : '—';
      var aLabel = (odds.option_a.label || 'Challenger').slice(0,22);
      var bLabel = (odds.option_b.label || 'Governor').slice(0,22);

      // Pool bar
      var aFrac = total > 0 ? Math.round(aGP/total*100) : 50;
      var bFrac = 100 - aFrac;
      html += '<div style="margin-bottom:8px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:8px;color:var(--tx3);margin-bottom:3px">';
      html += '<span>'+escapeHtml(aLabel)+'</span><span>'+escapeHtml(bLabel)+'</span>';
      html += '</div>';
      html += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.06)">';
      html += '<div style="width:'+aFrac+'%;background:var(--red);transition:width .4s"></div>';
      html += '<div style="flex:1;background:var(--cyan)"></div>';
      html += '</div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px">';
      html += '<span style="color:var(--red)">'+aFrac+'% · '+aOdds+'</span>';
      html += '<span style="color:var(--tx3);font-size:8px">'+total+' GP pool</span>';
      html += '<span style="color:var(--cyan)">'+bFrac+'% · '+bOdds+'</span>';
      html += '</div>';
      html += '</div>';

      if (myBet) {
        // Show existing bet
        var optColor = myBet.option === 'a' ? 'var(--red)' : 'var(--cyan)';
        var optName  = myBet.option === 'a' ? aLabel : bLabel;
        var statusTxt = myBet.status === 'won' ? '✅ WON +'+myBet.payout_gp+' GP' : myBet.status === 'lost' ? '❌ LOST' : '⏳ PENDING';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px;font-size:9px">';
        html += '<span style="color:var(--tx3)">MY BET</span>';
        html += '<span style="color:'+optColor+'">'+escapeHtml(optName.slice(0,16))+'</span>';
        html += '<span style="color:var(--gold);font-family:var(--fn)">'+myBet.amount_gp+' GP</span>';
        html += '<span style="color:var(--tx2)">'+statusTxt+'</span>';
        html += '</div>';
      } else if (w && odds.status === 'open') {
        // Bet input
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        html += '<div style="display:flex;gap:4px">';
        html += '<button onclick="window._setSiegeBetOption(\''+code+'\',\'a\')" id="betOptA_'+code+'" class="sz-btn" style="flex:1;font-size:8px;padding:5px;color:var(--red);border-color:rgba(232,72,85,.4)">⚔️ '+escapeHtml(aLabel.slice(0,16))+'</button>';
        html += '<button onclick="window._setSiegeBetOption(\''+code+'\',\'b\')" id="betOptB_'+code+'" class="sz-btn" style="flex:1;font-size:8px;padding:5px;color:var(--cyan);border-color:rgba(91,184,232,.4)">🛡 '+escapeHtml(bLabel.slice(0,16))+'</button>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;align-items:center">';
        html += '<input type="number" id="betAmt_'+code+'" min="10" max="1000" placeholder="GP" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:5px 8px;border-radius:4px;font-family:var(--fn)">';
        html += '<button onclick="govPlaceBet(\''+code+'\','+betEventId+')" class="sz-btn" style="font-size:8px;padding:5px 10px;color:var(--gold);border-color:rgba(255,209,102,.4)">BET</button>';
        html += '</div>';
        html += '<div id="betOptSel_'+code+'" style="font-size:9px;color:var(--tx3);text-align:center">Select a side above</div>';
        html += '</div>';
      } else if (!w) {
        html += '<div style="font-size:9px;color:var(--tx3)">Connect wallet to bet</div>';
      }

      html += '</div>';
      container.innerHTML = html;
    });
  }

  // ── Bet option selector (toggle highlight) ──
  window._siegeBetOptions = {};
  window._setSiegeBetOption = function(code, opt) {
    window._siegeBetOptions[code] = opt;
    var aBtn = document.getElementById('betOptA_'+code);
    var bBtn = document.getElementById('betOptB_'+code);
    var info = document.getElementById('betOptSel_'+code);
    if (aBtn) aBtn.style.opacity = opt === 'a' ? '1' : '0.4';
    if (bBtn) bBtn.style.opacity = opt === 'b' ? '1' : '0.4';
    if (info) info.textContent = 'Betting on: ' + (opt === 'a' ? '⚔️ Challenger' : '🛡 Governor');
  };

  // ── Place bet ──
  window.govPlaceBet = function(code, betEventId) {
    var w = walletState.address;
    if (!w) { showToast('Connect wallet first'); return; }
    var opt = window._siegeBetOptions[code];
    if (!opt) { showToast('Select a side to bet on'); return; }
    var amtEl = document.getElementById('betAmt_'+code);
    var amt = amtEl ? parseInt(amtEl.value) : 0;
    if (!amt || amt < 10) { showToast('Minimum bet is 10 GP'); return; }

    fetch('/api/betting/bet', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ eventId: betEventId, option: opt, amount: amt })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) {
        var msg = {
          insufficient_gp: 'Not enough GP',
          already_bet: 'Already placed a bet on this siege',
          max_bets_reached: 'Max active bets reached',
          bet_too_small: 'Minimum bet is '+d.min+' GP',
          bet_too_large: 'Maximum bet is '+d.max+' GP',
          event_closed: 'Betting is closed',
          betting_disabled: 'Betting is currently disabled'
        }[d.error] || d.error;
        showToast('⚠️ '+msg);
        return;
      }
      showToast('🎰 Bet placed! '+amt+' GP on '+(opt==='a'?'Challenger':'Governor'));
      delete window._siegeBetOptions[code];
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast('Failed to place bet'); });
  };

  function _siegePolicyLabel(p) {
    if (p === 'open') return '🌐 Open';
    if (p === 'ally_only') return '🤝 Allies Only';
    if (p === 'closed') return '🔒 Closed';
    return p || 'Open';
  }

  window.govDeclareSiege = function(code) {
    var w = walletState.address;
    if (!w) { showToast('Connect wallet first'); return; }
    var gpBal = parseFloat(walletState.gameGP || 0);
    var cost = 100; // default, should match settings
    gameConfirm({
      title: 'CHALLENGE FOR GOVERNOR',
      icon: '⚔️',
      body: 'Challenge for control of <b style="color:var(--red)">'+code+'</b>?<br>You need 3+ territories in the sector.',
      info: [
        { k: 'SIEGE COST', v: cost+' GP' },
        { k: 'YOUR GP', v: gpBal.toFixed(0), ok: gpBal >= cost, insufficient: gpBal < cost },
        { k: 'WARNING PERIOD', v: '48h before battle starts' }
      ],
      confirmText: gpBal < cost ? 'INSUFFICIENT GP' : 'DECLARE SIEGE',
      disabled: gpBal < cost
    }).then(function(ok) {
      if (!ok) return;
      fetch('/api/siege/declare', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, sectorCode: code })
      }).then(function(r){return r.json()}).then(function(d) {
        if (d.error) {
          var msg = d.error === 'insufficient_territories' ? 'Need '+d.detail.required+' territories in this sector (you have '+d.detail.current+')' :
                    d.error === 'insufficient_gp' ? 'Not enough GP (need '+d.detail.required+')' :
                    d.error === 'siege_already_active' ? 'A siege is already active in this sector' :
                    d.error;
          showToast('⚠️ ' + msg);
          return;
        }
        showToast('⚔️ Siege declared! Battle starts in 48h');
        loadSiegeInfoPanel(code);
      }).catch(function(){ showToast('Failed to declare siege'); });
    });
  };

  window.govSaveTaxRate = function(code) {
    var w = walletState.address;
    if (!w) { showToast('Not connected'); return; }
    var slider = document.getElementById('siegeTaxSlider_'+code);
    if (!slider) return;
    var rate = parseFloat(slider.value);
    fetch('/api/governor/tax-rate', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, taxRate: rate })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast('Error: '+d.error); return; }
      showToast('Tax rate set to '+d.tax_rate+'%');
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast('Failed'); });
  };

  window.govSavePolicy = function(code) {
    var w = walletState.address;
    if (!w) { showToast('Not connected'); return; }
    var sel = document.getElementById('siegePolicy_'+code);
    if (!sel) return;
    fetch('/api/governor/policy', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, policy: sel.value })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast('Error: '+d.error); return; }
      showToast('Policy updated: '+_siegePolicyLabel(d.policy));
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast('Failed'); });
  };

  window.govSaveDeclarationByCode = function(code) {
    var w = walletState.address;
    if (!w) { showToast('Not connected'); return; }
    var ta = document.getElementById('siegeDecl_'+code);
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { showToast('Enter declaration text'); return; }
    fetch('/api/governor/declaration', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, text: text })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast('Error: '+d.error); return; }
      showToast('Declaration saved! (-5 GP)');
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast('Failed'); });
  };

  // Helper to escape HTML
  function escapeHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ──────────────────────────────────────────────────────
  // MY TITLES
  // ──────────────────────────────────────────────────────
  window.toggleTitlesSection = function() {
    var el = document.getElementById('govTitlesSection');
    var tog = document.getElementById('titlesToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      loadTitlesPanel();
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  function loadTitlesPanel() {
    var panel = document.getElementById('titlesPanel');
    if (!panel) return;
    var w = walletState.address;
    if (!w) {
      panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">Connect wallet to view titles.</div>';
      return;
    }
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">Loading...</div>';
    var lang = window._currentLang || 'en';

    fetch('/api/user/titles', { headers: getAuthHeaders() })
      .then(function(r){return r.json()}).then(function(d) {
        var titles = d.titles || [];
        if (!titles.length) {
          panel.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:6px 0">No titles yet. Complete achievements to earn them!</div>';
          return;
        }
        var gpCost = 20;
        var html = '<div style="display:flex;flex-direction:column;gap:6px">';
        titles.forEach(function(t) {
          var name = t['title_'+lang] || t.title_en || t.title_code;
          var equipped = t.is_equipped;
          var btnStyle = equipped
            ? 'color:var(--gold);border-color:rgba(255,209,102,.5);background:rgba(255,209,102,.08)'
            : 'color:var(--tx3);border-color:rgba(255,255,255,.1)';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;background:rgba(255,255,255,.03);border-radius:4px">';
          html += '<span style="font-size:10px;color:'+(equipped?'var(--gold)':'var(--tx)')+'">'+
            (equipped?'🎖 ':'')+ escapeHtml(name)+'</span>';
          html += '<button class="sz-btn" onclick="govEquipTitle(\''+escapeHtml(t.title_code)+'\')" style="font-size:8px;padding:3px 8px;'+btnStyle+'">'+
            (equipped ? 'UNEQUIP' : 'EQUIP ('+gpCost+' GP)')+'</button>';
          html += '</div>';
        });
        html += '</div>';
        html += '<div style="font-size:9px;color:var(--tx3);margin-top:6px">Equip cost: '+gpCost+' GP · Unequip is free</div>';
        panel.innerHTML = html;
      }).catch(function() {
        panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">Failed to load titles.</div>';
      });
  }

  window.govEquipTitle = function(titleCode) {
    var w = walletState.address;
    if (!w) { showToast('Connect wallet first'); return; }
    fetch('/api/user/titles/equip', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, titleCode: titleCode })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) {
        var msg = d.error === 'insufficient_gp' ? 'Not enough GP (need '+d.required+')' :
                  d.error === 'title_not_owned'  ? 'You don\'t own this title' : d.error;
        showToast('⚠️ '+msg); return;
      }
      if (d.equipped) {
        showToast('🎖 Title equipped! (-'+d.gp_spent+' GP)');
      } else {
        showToast('Title unequipped');
      }
      loadTitlesPanel();
      // Refresh badge
      try { updateWalletUI(); } catch(e) {}
    }).catch(function(){ showToast('Failed'); });
  };

  // ──────────────────────────────────────────────────────
  // MY FLEET (Migration 092)
  // ──────────────────────────────────────────────────────
  var _blueprints = null;

  window.toggleFleetSection = function() {
    var el = document.getElementById('govFleetSection');
    var tog = document.getElementById('fleetToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      loadFleetPanel();
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  var _upgradeCosts = null;

  function loadFleetPanel() {
    var panel = document.getElementById('fleetPanel');
    if (!panel) return;
    var w = walletState.address;
    if (!w) {
      panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+(t('gov_fleet_hint')||'Connect wallet to view your fleet.')+'</div>';
      return;
    }
    // 새 fleet 시스템 (/api/fleets) 사용 — 기존 /api/ships 직접 ship 목록 호출 제거.
    // 함선 관리는 SHIPYARD 모달, 함대 관리는 FLEET COMMAND 모달에서 진행.
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">Loading...</div>';
    fetch('/api/fleets', { headers: getAuthHeaders() })
      .then(function(r){ return r.json() })
      .catch(function(){ return { fleets: [] } })
      .then(function(data) {
        var fleets = data.fleets || data || [];
        if (!Array.isArray(fleets)) fleets = [];
        var totalShips = fleets.reduce(function(sum,f){ return sum + (parseInt(f.ships_alive)||parseInt(f.ship_count)||0); }, 0);
        var html = '';
        if (fleets.length) {
          html += '<div style="margin-bottom:8px"><div style="font-size:9px;color:#5cbbff;font-weight:700;margin-bottom:6px">'
            + (t('gov_fleet_my')||'MY FLEETS') + ' <span style="color:var(--tx3)">'+fleets.length+' fleets · '+totalShips+' ships</span></div>';
          fleets.slice(0,3).forEach(function(f){
            var nm = f.name || ('Fleet #'+f.id);
            html += '<div style="background:rgba(92,187,255,.04);border:1px solid rgba(92,187,255,.12);border-radius:6px;padding:6px 8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">'
              + '<span style="font-size:10px;font-weight:700;color:#5cbbff">⚓ '+nm+'</span>'
              + '<span style="font-size:9px;color:var(--tx3)">'+(parseInt(f.ships_alive)||parseInt(f.ship_count)||0)+' ships</span>'
              + '</div>';
          });
          if (fleets.length > 3) {
            html += '<div style="font-size:8px;color:var(--tx3);text-align:center">+'+(fleets.length-3)+' more...</div>';
          }
          html += '</div>';
        } else {
          html += '<div style="font-size:10px;color:var(--tx3);padding:6px 0;text-align:center">'
            + (t('gov_fleet_empty')||'No fleets yet — open Shipyard to start building.') + '</div>';
        }
        // Action buttons (open the proper modals)
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px">'
          + '<button onclick="(typeof openShipyard===\'function\')&&openShipyard()" style="font-size:9px;padding:6px;border-radius:5px;border:1px solid rgba(79,195,247,.4);background:rgba(79,195,247,.1);color:#4fc3f7;cursor:pointer;font-family:var(--fn);font-weight:700">⚓ '+(t('fcmd_open_shipyard')||'SHIPYARD')+'</button>'
          + '<button onclick="(typeof openFleetCmd===\'function\')&&openFleetCmd()" style="font-size:9px;padding:6px;border-radius:5px;border:1px solid rgba(167,139,250,.4);background:rgba(167,139,250,.1);color:#a78bfa;cursor:pointer;font-family:var(--fn);font-weight:700">⚔ '+(t('fcmd_my_fleets')||'MY FLEETS')+'</button>'
          + '</div>';
        panel.innerHTML = html;
      });
  }
  // Legacy wallet-query ships UI는 제거됨. loadFleetPanel은 신 /api/fleets API 사용.
  // govBuildShip/govRepairShip/govUpgradeShip은 openShipyard()/openFleetCmd() 모달로 redirect.
  window.govBuildShip = function(_shipType) {
    showToast('🔨 ' + (t('use_shipyard')||'Use Shipyard'), 'info');
    if (typeof openShipyard === 'function') openShipyard();
  };
  window.govRepairShip = function(_shipId) {
    showToast('🔧 ' + (t('use_fleet_cmd')||'Use Fleet Command'), 'info');
    if (typeof openFleetCmd === 'function') openFleetCmd();
  };
  window.govUpgradeShip = function(_shipId) {
    showToast('⬆ ' + (t('use_fleet_cmd')||'Use Fleet Command'), 'info');
    if (typeof openFleetCmd === 'function') openFleetCmd();
  };

  // (legacy govBuildShip/govRepairShip/govUpgradeShip 본문 제거됨 — stubs above redirect to openShipyard/openFleetCmd)

  // ──────────────────────────────────────────────────────
  // NAVAL BATTLES (legacy — 함대전은 fleet_battles + Hijack로 통합)
  // ──────────────────────────────────────────────────────
  window.toggleBattleSection = function() { /* replaced by pvpHubSwitchTab */ };

  // Legacy battle panel — replaced by Fleet Combat system (see fleet_battles).
  // Old /api/battle/* endpoints removed in cleanup commit (services/battle.js was
  // schema-mismatched and 500'ing). PVP now goes through Fleet system + Hijack.
  function loadBattlePanel() {
    var panel = document.getElementById('battlePanel');
    if (!panel) return;
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:6px 0;line-height:1.6">'
      + '⚔️ ' + (t('gov_battle_use_fleet')||'PVP는 Fleet 시스템 + Hijack에서 진행됩니다.')
      + '<br><span style="color:var(--tx4);font-size:9px">'
      + (t('gov_battle_use_fleet_hint')||(LANG==='ko'?'함대 탭에서 함선을 건조하고, 영토 탈취는 HIJACK 버튼을 사용하세요.':LANG==='ja'?'艦隊タブで艦船を建造し、領土奪取はHIJACKボタンを使用してください。':LANG==='zh'?'在舰队标签页建造舰船，使用HIJACK按钮夺取领地。':'Build ships in the Fleet tab and use the HIJACK button to capture territory.'))
      + '</span></div>';
  }
  window.loadBattlePanel = loadBattlePanel;

  // Hall of Fame toggle + loader (uses game picker instead of native select)
  var _hofSelectedSectorId = null;
  window.toggleHallOfFame = function() {
    var el = document.getElementById('govHallOfFame');
    var tog = document.getElementById('hofToggle');
    if (!el) return;
    var show = el.style.display === 'none';
    el.style.display = show ? 'block' : 'none';
    if (tog) tog.textContent = show ? '▲' : '▼';
  }
  window.openHofSectorPicker = function(){
    var items = (_sectorsData||[]).map(function(s){return {value:String(s.id),label:s.name}});
    gamePicker({title:'HALL OF FAME · SELECT SECTOR', items:items, selected:_hofSelectedSectorId}).then(function(v){
      if(!v) return;
      _hofSelectedSectorId = v;
      var lbl = document.getElementById('hofSectorLabel');
      var sec = (_sectorsData||[]).find(function(s){return String(s.id)===String(v)});
      if(lbl) lbl.textContent = sec ? sec.name : 'Sector '+v;
      loadHallOfFame();
    });
  };
  window.loadHallOfFame = function() {
    var list = document.getElementById('hofList');
    if (!list) return;
    var sectorId = _hofSelectedSectorId;
    if (!sectorId) { list.innerHTML = '<div style="padding:4px 0">Select a sector to view history.</div>'; return; }
    list.innerHTML = '<div style="padding:4px 0">Loading...</div>';
    fetch('/api/governance/history/' + sectorId).then(function(r){return r.json()}).then(function(rows){
      if (!rows || !rows.length) { list.innerHTML = '<div style="padding:4px 0">No governor history for this sector.</div>'; return; }
      list.innerHTML = rows.map(function(r) {
        var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
        var start = new Date(r.started_at).toLocaleDateString();
        var end = r.ended_at ? new Date(r.ended_at).toLocaleDateString() : 'Present';
        var tax = parseFloat(r.total_tax_earned || 0);
        var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
        var dur = r.tenure_seconds ? Math.floor(r.tenure_seconds/3600)+'h' : '-';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--bdr)">'
          + '<div><span style="color:var(--gold)">👑</span> <b>'+name+'</b></div>'
          + '<div style="text-align:right;color:var(--tx3);font-size:9px">'+start+' – '+end+'<br>'+taxStr+' GP · '+dur+'</div>'
          + '</div>';
      }).join('');
    }).catch(function(){ list.innerHTML = '<div style="padding:4px 0;color:var(--red)">Failed to load history.</div>'; });
  }

  // ══ PVP HUB — spec 4-2 ════════════════════════════════════════

  var _pvpHubTab = 'rec'; // current active tab

  window.pvpHubSwitchTab = function(tab) {
    _pvpHubTab = tab;
    var tabCfg = {
      rec:      { bg: 'rgba(255,215,0,.08)',  bdr: '#ffd700', col: '#ffd700' },
      bounty:   { bg: 'rgba(255,171,64,.08)', bdr: '#ffab40', col: '#ffab40' },
      conflict: { bg: 'rgba(232,72,85,.08)',  bdr: '#ff8a80', col: '#ff8a80' }
    };
    ['rec','bounty','conflict'].forEach(function(k) {
      var btn = document.getElementById('pvpHubTab_' + k);
      if (!btn) return;
      if (k === tab) {
        btn.style.background = tabCfg[k].bg;
        btn.style.borderBottomColor = tabCfg[k].bdr;
        btn.style.color = tabCfg[k].col;
      } else {
        btn.style.background = 'transparent';
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--tx3)';
      }
    });
    _renderPvpHubTab(tab);
  };

  async function _renderPvpHubTab(tab) {
    var content = document.getElementById('pvpHubContent');
    if (!content) return;
    if (tab === 'rec') {
      content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:10px">'+(LANG==='ko'?'탐색 중…':LANG==='ja'?'探索中…':LANG==='zh'?'搜索中…':'Searching…')+'</div>';
      await _loadPvpRecTab();
    } else if (tab === 'bounty') {
      content.innerHTML = _pvpHubBountyHtml();
      switchBountyTab('all');
    } else if (tab === 'conflict') {
      content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:10px">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
      await _loadPvpConflictTab();
    }
  }

  async function _loadPvpRecTab() {
    var content = document.getElementById('pvpHubContent');
    var wallet = walletState && walletState.address;
    if (!wallet) {
      if (content && _pvpHubTab === 'rec') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'지갑을 연결하세요':LANG==='ja'?'ウォレットを接続してください':LANG==='zh'?'请连接钱包':'Connect your wallet')+'</div>';
      return;
    }
    try {
      var res = await fetch('/api/battles/recommended-opponents/' + encodeURIComponent(wallet));
      var data = await res.json();
      var opponents = data.opponents || [];
      if (!content || _pvpHubTab !== 'rec') return;
      if (opponents.length === 0) {
        content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">' + t('pvp_rec_no_opponents') + '</div>';
        return;
      }
      var factionColors = { mcc: '#4fc3f7', fsp: '#66bb6a', cv: '#ff7043' };
      var factionNames  = { mcc: 'MCC',     fsp: 'FSP',     cv: 'CV' };
      content.innerHTML = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px">'+(LANG==='ko'?'추천 상대 (내 CPI 기준 ±20%)':LANG==='ja'?'推奨対戦相手（自分のCPI ±20%）':LANG==='zh'?'推荐对手（我的CPI ±20%）':'Recommended opponents (±20% of your CPI)')+'</div>'
        + opponents.map(function(o) {
          var col   = factionColors[o.faction_code] || '#aaa';
          var fName = factionNames[o.faction_code]  || (o.faction_code||'').toUpperCase();
          var onlineDot = o.is_online
            ? '<span style="color:#66bb6a;font-size:8px">●'+(LANG==='ko'?'온라인':LANG==='ja'?'オンライン':LANG==='zh'?'在线':'Online')+'</span>'
            : '<span style="color:var(--tx3);font-size:8px">●'+(LANG==='ko'?'오프라인':LANG==='ja'?'オフライン':LANG==='zh'?'离线':'Offline')+'</span>';
          var sectorStr = o.sector_code ? (o.sector_code.split('-')[0] + (LANG==='ko'?' 섹터':LANG==='ja'?' セクター':LANG==='zh'?' 区':' Sector')) : '';
          var agoStr = o.last_battle_ago || (o.wins > 0 ? (LANG==='ko'?'오늘 활동':LANG==='ja'?'本日活動':LANG==='zh'?'今日活动':'Active today') : '');
          var sub = [sectorStr, agoStr].filter(Boolean).join(' · ');
          var displayName = o.fleet_name || (o.wallet.slice(0,6) + '…' + o.wallet.slice(-4));
          return '<div style="padding:9px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;margin-bottom:6px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:700;font-family:var(--fn);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
            + displayName
            + ' <span style="font-size:8px;color:' + col + ';background:rgba(0,0,0,.3);padding:1px 5px;border-radius:3px;font-weight:400">' + fName + '</span>'
            + '\u00a0' + onlineDot
            + '</div>'
            + '<div style="font-size:9px;color:var(--tx3);margin-top:2px">CPI <b style="color:#ffd700">' + Math.round(o.cpi||0) + '</b>'
            + (sub ? '\u00a0\u00a0' + sub : '')
            + '</div>'
            + '</div>'
            + '<button type="button" onclick="openBattleHubWithFleet(\'' + o.fleet_id + '\',\'' + o.wallet + '\')" style="flex-shrink:0;font-size:9px;background:rgba(232,72,85,.15);border:1px solid rgba(232,72,85,.4);color:#ff8a80;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:700;font-family:var(--fn);white-space:nowrap">'+(LANG==='ko'?'도전장 보내기':LANG==='ja'?'対戦申込':LANG==='zh'?'发出挑战':'Challenge')+'</button>'
            + '</div>'
            + '</div>';
        }).join('');
    } catch(err) {
      if (content && _pvpHubTab === 'rec') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">' + t('pvp_rec_no_opponents') + '</div>';
    }
  }

  async function _loadPvpConflictTab() {
    var content = document.getElementById('pvpHubContent');
    if (!content) return;
    try {
      var res = await fetch('/api/sectors/conflict-map');
      var data = await res.json();
      var sectors = (data.sectors || []).filter(function(s){ return s.heat > 0; })
        .sort(function(a,b){ return b.heat - a.heat; }).slice(0,8);
      if (!content || _pvpHubTab !== 'conflict') return;
      if (sectors.length === 0) {
        content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'활성 분쟁 없음':LANG==='ja'?'活動中の紛争なし':LANG==='zh'?'无活跃争端':'No active conflicts')+'</div>';
        return;
      }
      content.innerHTML = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px">'+(LANG==='ko'?'섹터별 분쟁 현황 (Heat 기준)':LANG==='ja'?'セクター別紛争状況（Heat順）':LANG==='zh'?'各区争端状况（按Heat排序）':'Conflict by sector (by Heat)')+'</div>'
        + sectors.map(function(s) {
          var heat = Math.min(100, s.heat);
          var heatCol = heat >= 70 ? '#ff5252' : heat >= 40 ? '#ffd700' : '#66bb6a';
          return '<div style="padding:7px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;margin-bottom:5px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:700;font-family:var(--fn)">' + s.sector_code + '</div>'
            + '<div style="font-size:9px;color:' + heatCol + ';font-weight:700">🔥 Heat ' + heat + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:10px;font-size:9px;color:var(--tx3)">'
            + (s.active_battles  ? '<span style="color:#ff8a80">⚔ '+(LANG==='ko'?'전투 ':LANG==='ja'?'戦闘 ':LANG==='zh'?'战斗 ':'Battles ')  + s.active_battles  + '</span>' : '')
            + (s.active_bounties ? '<span style="color:#ffab40">💰 '+(LANG==='ko'?'현상금 ':LANG==='ja'?'賞金 ':LANG==='zh'?'悬赏 ':'Bounties ') + s.active_bounties + '</span>' : '')
            + '<span>'+(LANG==='ko'?'클레임 ':LANG==='ja'?'クレーム ':LANG==='zh'?'领地 ':'Claims ') + s.claim_count + '</span>'
            + '</div>'
            + '</div>';
        }).join('');
    } catch(err) {
      if (content && _pvpHubTab === 'conflict') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'로딩 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>';
    }
  }

  function _pvpHubBountyHtml() {
    return '<div style="padding:8px;border-radius:6px;background:rgba(255,171,64,.05);border:1px solid rgba(255,171,64,.15);margin-bottom:8px">'
      + '<div style="font-size:9px;color:#ffab40;font-weight:700;font-family:var(--fn);letter-spacing:1px;margin-bottom:6px">💰 '+(LANG==='ko'?'현상금 등록':LANG==='ja'?'賞金登録':LANG==='zh'?'悬赏登记':'Bounty Board')+'</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      + '<input type="text" id="bountyTargetWallet" placeholder="0x..." style="background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '<div style="display:flex;gap:5px">'
      + '<input type="number" id="bountyRewardGP" min="100" step="100" placeholder="'+(LANG==='ko'?'GP (최소 100)':LANG==='ja'?'GP (最低100)':LANG==='zh'?'GP（最少100）':'GP (min 100)')+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '<input type="text" id="bountyReason" placeholder="'+(LANG==='ko'?'사유':LANG==='ja'?'理由':LANG==='zh'?'原因':'Reason')+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '</div>'
      + '<button type="button" onclick="postBounty()" style="padding:6px;border-radius:5px;background:rgba(255,171,64,.2);border:1px solid rgba(255,171,64,.4);color:#ffab40;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+(LANG==='ko'?'등록':LANG==='ja'?'登録':LANG==='zh'?'登记':'Register')+'</button>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;margin-bottom:6px">'
      + '<button id="btyTabAll" type="button" onclick="switchBountyTab(\'all\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,171,64,.18);border:1px solid rgba(255,171,64,.4);color:#ffab40;cursor:pointer;font-weight:700">'+(LANG==='ko'?'전체':LANG==='ja'?'全体':LANG==='zh'?'全部':'All')+'</button>'
      + '<button id="btyTabMe" type="button" onclick="switchBountyTab(\'on-me\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer">'+(LANG==='ko'?'내 현상금':LANG==='ja'?'懸賞対象':LANG==='zh'?'针对我':'On Me')+'</button>'
      + '<button id="btyTabMine" type="button" onclick="switchBountyTab(\'mine\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer">'+(LANG==='ko'?'내가 등록':LANG==='ja'?'私の登録':LANG==='zh'?'我的悬赏':'Mine')+'</button>'
      + '</div>'
      + '<div id="bountyList" style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
  }

  // legacy compat
  window.toggleRecommendedSection = function() { pvpHubSwitchTab('rec'); };
  window.loadRecommendedOpponents = function() { _pvpHubTab = 'rec'; _loadPvpRecTab(); };
  window.openBattleHubWithFleet = function(targetFleetId, targetWallet) {
    openBattleHub();
    setTimeout(function() {
      var el = document.getElementById('bhTargetFleetId') || document.getElementById('bh-target-fleet');
      if (el) el.value = targetFleetId;
    }, 500);
  };

  // ══ BOUNTY BOARD ═══════════════════════════════════════════════

  window.toggleBountySection = function() {
    // bountyBoardSection may be inside pvpHubContent now — just switch the hub tab
    if (typeof pvpHubSwitchTab === 'function') { pvpHubSwitchTab('bounty'); return; }
    var el = document.getElementById('bountyBoardSection');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') loadBountyList('all');
  };

  var _currentBountyTab = 'all';

  window.switchBountyTab = function(tab) {
    _currentBountyTab = tab;
    ['all','on-me','mine'].forEach(function(t2) {
      var btn = document.getElementById('btyTab' + (t2==='all'?'All':t2==='on-me'?'Me':'Mine'));
      if (btn) {
        btn.style.background = t2===tab ? 'rgba(255,171,64,.18)' : 'rgba(255,255,255,.05)';
        btn.style.borderColor = t2===tab ? 'rgba(255,171,64,.4)' : 'rgba(255,255,255,.1)';
        btn.style.color = t2===tab ? '#ffab40' : 'var(--tx3)';
        btn.style.fontWeight = t2===tab ? '700' : '';
      }
    });
    loadBountyList(tab);
  };

  window.loadBountyList = async function(tab) {
    var wallet = walletState && walletState.address;
    var list = document.getElementById('bountyList');
    if (!list) return;
    list.innerHTML = '<span style="color:var(--tx3);font-size:10px">Loading…</span>';
    try {
      var url = tab === 'on-me' ? '/api/bounty/on-me'
              : tab === 'mine' ? '/api/bounty/my-bounties'
              : '/api/bounty/list';
      var res = await fetch(url, { headers: getAuthHeaders() });
      var data = await res.json();
      var bounties = data.bounties || [];
      if (bounties.length === 0) { list.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">' + t('bounty_no_bounties') + '</div>'; return; }

      list.innerHTML = bounties.map(function(b) {
        var expDate = b.expires_at ? new Date(b.expires_at).toLocaleDateString() : '';
        var isMine = tab === 'mine';
        return '<div style="padding:8px;background:rgba(255,171,64,.04);border:1px solid rgba(255,171,64,.15);border-radius:6px;margin-bottom:4px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
          + '<div>'
          + '<div style="font-size:10px;color:var(--tx)">🎯 ' + (b.target_wallet || '').slice(0,8) + '…</div>'
          + (b.reason ? '<div style="font-size:9px;color:var(--tx3)">' + _esc(b.reason) + '</div>' : '')
          + '</div>'
          + '<div style="text-align:right"><div style="font-size:12px;color:#ffab40;font-weight:700">+' + (b.reward_gp||0).toLocaleString() + ' GP</div>'
          + (expDate ? '<div style="font-size:8px;color:var(--tx3)">' + t('bounty_expires') + ': ' + expDate + '</div>' : '')
          + '</div></div>'
          + (isMine && b.status==='active' ? '<button onclick="cancelBounty(' + b.id + ')" style="font-size:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);padding:2px 8px;border-radius:4px;cursor:pointer">' + t('bounty_cancel') + '</button>' : '')
          + '</div>';
      }).join('');

      // On Me — show total
      if (tab === 'on-me' && data.total_on_me > 0) {
        list.innerHTML = '<div style="padding:6px 8px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);border-radius:6px;margin-bottom:8px;font-size:10px;color:#ff8a80">' + t('bounty_on_me') + ': <b>' + data.total_on_me.toLocaleString() + ' GP</b></div>' + list.innerHTML;
      }
    } catch(err) { list.innerHTML = '<div style="color:var(--tx3);font-size:10px">Failed to load bounties</div>'; }
  };

  window.postBounty = async function() {
    var wallet = walletState && walletState.address;
    if (!wallet) { showToast(t('connect_wallet_first')||'Connect wallet', 'error'); return; }
    var target = (document.getElementById('bountyTargetWallet') || {}).value || '';
    var gp = parseInt((document.getElementById('bountyRewardGP') || {}).value) || 0;
    var reason = (document.getElementById('bountyReason') || {}).value || '';
    if (!target) { showToast('Enter target wallet', 'error'); return; }
    if (gp < 100) { showToast('Minimum 100 GP', 'error'); return; }

    var ok = await gameConfirm({ icon:'💰', title:t('bounty_post'),
      body: '🎯 Target: ' + target.slice(0,10) + '…<br>💰 Reward: <b>' + gp + ' GP</b>',
      confirmText: t('bounty_post_submit') });
    if (!ok) return;

    try {
      var res = await fetch('/api/bounty/post', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: wallet, target_wallet: target, reward_gp: gp, reason: reason })
      });
      var data = await res.json();
      if (!data.success) { showToast(data.error || 'Failed', 'error'); return; }
      showToast('💰 Bounty posted!', 'success');
      document.getElementById('bountyTargetWallet').value = '';
      document.getElementById('bountyRewardGP').value = '';
      document.getElementById('bountyReason').value = '';
      loadBountyList('all');
      if (typeof loadUserData === 'function') loadUserData();
    } catch(e) { showToast('Failed', 'error'); }
  };

  window.cancelBounty = async function(id) {
    var wallet = walletState && walletState.address;
    if (!wallet) return;
    var ok = await gameConfirm({ icon:'💰', title:t('bounty_cancel'), confirmText:'Cancel & Refund' });
    if (!ok) return;
    try {
      var res = await fetch('/api/bounty/cancel/' + id, {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: wallet })
      });
      var data = await res.json();
      if (!data.success) { showToast(data.error || 'Failed', 'error'); return; }
      showToast('+' + data.refunded_gp + ' GP refunded', 'success');
      loadBountyList('mine');
      if (typeof loadUserData === 'function') loadUserData();
    } catch(e) { showToast('Failed', 'error'); }
  };

  // Governance UI state
  var _govState = null;
  var _govMyPositions = [];
  var _govMySectorId = null; // currently selected governed sector
  var _govMySectorIds = []; // all sectors I govern

  function _updateGovernanceUI(gov) {
    _govState = gov;
    // Show active event banner on map if any
    if(gov && gov.activeGovEvents && gov.activeGovEvents.length > 0) {
      var evNames = gov.activeGovEvents.map(function(e){
        var icons = {double_mining:'⛏ DOUBLE MINING',war_time:'⚔ WAR TIME',peace_treaty:'🕊 PEACE'};
        return icons[e.type]||e.type;
      });
      showAnnounce('EVENT ACTIVE: ' + evNames.join(' | '));
    }
  }

  // ── Load governance data for GOVERN tab ──
  // [Phase 3] 맹주 공성 선언 — 맹주(sov1위) vs 도전(sov2위) 결전 이벤트 시작
  window.declareCommanderSiegeUI = function(){
    if(!walletState.address){ if(typeof showToast==='function') showToast(tl("Connect wallet","지갑 연결 필요","ウォレット接続","需要连接钱包"),'warn'); return; }
    fetch('/api/siege/commander/declare', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j.success){
          var m={ commander_siege_disabled:tl("Commander siege disabled","맹주 공성 비활성","無効","已禁用"), commander_siege_active:tl("Already in progress","이미 진행 중","進行中","进行中"), no_challenger:tl("No challenger","도전자 없음","挑戦者なし","无挑战者"), challenger_below_min:tl("Challenger lacks sectors","도전자 섹터 부족","セクター不足","区域不足") };
          if(typeof showToast==='function') showToast(m[res.j.error]||('맹주 공성 실패: '+(res.j.error||'')),'warn'); return;
        }
        if(typeof showToast==='function') showToast(tl("⚔ Commander Siege declared!","⚔ 맹주 공성 선언! 양측 길드원 함대 합류","⚔ 攻城戦宣言","⚔ 攻城宣言"),'success');
        if(typeof openSovMap==='function') openSovMap();
      }).catch(function(){ if(typeof showToast==='function') showToast(tl("Network error","네트워크 오류","ネットワークエラー","网络错误"),'warn'); });
  };

  // [Phase 3] SOV MAP — 24섹터 길드 지배 현황 모달 (읽기 전용 표시)
  window.openSovMap = function(){
    var ex = document.getElementById('sovMapModal'); if(ex) ex.remove();
    var ov = document.createElement('div');
    ov.id = 'sovMapModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(4,6,12,.92);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:linear-gradient(180deg,#12131a,#0b0c12);border:1px solid rgba(255,109,0,.3);border-radius:14px;max-width:680px;width:100%;max-height:88vh;overflow:auto;padding:18px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:14px;font-weight:900;color:#ffb74d;font-family:var(--fn)">🗺 '+tl("SOV MAP — Mars Control","🗺 SOV MAP — 화성 지배 현황","SOV MAP — 火星支配","SOV MAP — 火星支配")+'</span><button type="button" id="sovMapClose" style="background:none;border:none;color:var(--tx3);font-size:18px;cursor:pointer">✕</button></div>'
      + '<div id="sovMapBody" style="font-size:11px;color:var(--tx3)">'+tl("Loading…","불러오는 중…","読み込み中…","加载中…")+'</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    var cb = document.getElementById('sovMapClose'); if(cb) cb.addEventListener('click', function(){ ov.remove(); });
    Promise.all([
      fetch('/api/sector-defs/sov-map').then(function(r){return r.json()}),
      fetch('/api/siege/schedule?count=3').then(function(r){return r.json()}).catch(function(){return null})
    ]).then(function(res){
      var d = res[0]; var sched = res[1];
      var body = document.getElementById('sovMapBody'); if(!body) return;
      var L = function(s){ return (LANG==='ko'?s.name_ko:LANG==='ja'?s.name_ja:LANG==='zh'?s.name_zh:s.name_en)||s.name_en||s.code; };
      var tierCol = { core:'var(--gold)', mid:'var(--cyan)', frontier:'var(--tx3)' };
      var h = '';
      // [Phase 3] 화성 맹주(Commander) — sov 지배 1위 길드
      if(d.commander){
        h += '<div style="text-align:center;padding:10px;margin-bottom:10px;border-radius:10px;background:linear-gradient(135deg,rgba(255,209,102,.18),rgba(255,109,0,.06));border:1px solid rgba(255,209,102,.5)">'
          + '<div style="font-size:9px;color:#ffb74d;letter-spacing:2px;font-weight:700">👑 '+tl("MARS COMMANDER","화성 맹주","火星総督","火星统帅")+'</div>'
          + '<div style="font-size:13px;color:var(--gold);font-weight:900;margin-top:3px">'+(d.commander.emblem||"🔴")+' ['+escapeHtml(d.commander.tag||"")+'] '+escapeHtml(d.commander.name||"")+'</div>'
          + '<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+d.commander.sectors+' '+tl("sectors","섹터","セクター","区域")+' · core '+d.commander.core+'</div></div>';
      }
      h += '<div style="margin-bottom:8px;color:var(--tx2)">'+tl("Held","점령","占領","占领")+' '+d.claimed+' / '+d.total+' · '+tl("Vacant","무주공산","空白","空白")+' '+d.vacant+'</div>';
      // [Phase 3] 맹주 공성 선언 (sov1위 vs sov2위 결전)
      h += '<button type="button" onclick="declareCommanderSiegeUI()" style="width:100%;padding:8px;margin-bottom:12px;border-radius:8px;background:linear-gradient(135deg,rgba(232,72,85,.16),rgba(255,109,0,.05));border:1px solid rgba(232,72,85,.4);color:#ff8a80;font-family:var(--fn);font-size:10px;font-weight:800;cursor:pointer">👑 '+tl("DECLARE COMMANDER SIEGE","맹주 공성 선언","攻城戦宣言","宣战统帅")+'</button>';
      // [Phase 3] 다가오는 공성 결전 일정
      if(sched && sched.enabled && sched.next_slots && sched.next_slots.length){
        h += '<div style="font-size:10px;color:#ff8a80;font-weight:700;margin-bottom:4px">⚔ '+tl("Next Siege Windows","다음 공성 결전","次の攻城戦","下次攻城")+'</div><div style="margin-bottom:10px">';
        sched.next_slots.forEach(function(iso){ try{ var dt=new Date(iso); h += '<span style="display:inline-block;font-size:9px;color:var(--tx2);background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);border-radius:10px;padding:2px 8px;margin:0 4px 4px 0">'+dt.toLocaleString(LANG==='ko'?'ko-KR':undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</span>'; }catch(_){} });
        h += '</div>';
      }
      if(d.leaderboard && d.leaderboard.length){
        h += '<div style="font-size:10px;color:#ffb74d;font-weight:700;margin-bottom:6px">🏛 '+tl("Ruling Guilds","지배 길드","支配ギルド","支配公会")+'</div>';
        d.leaderboard.slice(0,8).forEach(function(g,i){
          h += '<div style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(255,209,102,.05);border-radius:6px;margin-bottom:3px"><span style="font-size:10px;color:var(--tx)">'+(i+1)+'. '+(g.emblem||"🔴")+' ['+escapeHtml(g.tag||"")+'] '+escapeHtml(g.name||"")+'</span><span style="font-size:10px;color:var(--gold)">'+g.count+' · C'+(g.core||0)+'/M'+(g.mid||0)+'/F'+(g.frontier||0)+'</span></div>';
        });
      }
      ['core','mid','frontier'].forEach(function(tier){
        var secs = (d.sectors||[]).filter(function(s){ return s.tier===tier; });
        if(!secs.length) return;
        h += '<div style="font-size:10px;color:'+tierCol[tier]+';font-weight:700;margin:10px 0 5px;text-transform:uppercase">'+tier+' ('+secs.length+')</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
        secs.forEach(function(s){
          var gov = s.governorGuild ? ((s.governorGuild.emblem||"🔴")+' ['+escapeHtml(s.governorGuild.tag||"")+']')
            : (s.governor ? ('👤 '+escapeHtml(s.governor.nickname||"")) : ('<span style="color:var(--tx3)">'+tl("Vacant","무주공산","空白","空白")+'</span>'));
          h += '<div style="padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px;border-left:3px solid '+tierCol[tier]+'"><div style="font-size:10px;color:var(--tx);font-weight:600">'+escapeHtml(L(s))+'</div><div style="font-size:9px;color:var(--tx2);margin-top:2px">'+gov+'</div></div>';
        });
        h += '</div>';
      });
      body.innerHTML = h;
    }).catch(function(){ var b=document.getElementById('sovMapBody'); if(b) b.innerHTML='<div style="color:var(--red)">'+tl("Load failed","불러오기 실패","読み込み失敗","加载失败")+'</div>'; });
  };

  window.loadGovernanceData = function(){
    var w = walletState.address;
    if(!w) {
      document.getElementById('govMyPositions').innerHTML='<div style="font-size:10px;color:var(--tx3);padding:8px 0">Connect wallet to view governance.</div>';
      return;
    }

    // Fetch all in parallel
    Promise.all([
      fetch('/api/governance/my-positions/'+encodeURIComponent(w)).then(function(r){return r.json()}).catch(function(){return []}),
      fetch('/api/governance/commander', { headers: getAuthHeaders() }).then(function(r){return r.json()}).catch(function(){return {}}),
      fetch('/api/governance/events').then(function(r){return r.json()}).catch(function(){return []}),
      fetch('/api/governance/bounties').then(function(r){return r.json()}).catch(function(){return []})
    ]).then(function(results){
      var positions = results[0];
      var cmdInfo = results[1];
      var events = results[2];
      var bounties = results[3];

      _govMyPositions = Array.isArray(positions) ? positions : [];
      _govMySectorIds = [];
      _govMySectorId = null;

      // ── MY POSITIONS ──
      var posEl = document.getElementById('govMyPositions');
      if(_govMyPositions.length === 0){
        posEl.innerHTML='<div style="font-size:10px;color:var(--tx3);padding:8px 0">No governance positions. Claim more territory to become Governor!</div>';
      } else {
        var html = '';
        _govMyPositions.forEach(function(p){
          var roleColor = p.role==='commander'?'var(--gold)':p.role==='governor'?'var(--cyan)':'var(--tx2)';
          var label = p.role.toUpperCase() + (p.sector_id?' · Sector '+p.sector_id:'');
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(91,184,232,.04);border-radius:6px;margin-bottom:4px;border:1px solid '+roleColor+'22">';
          html += '<span style="font-size:10px;color:'+roleColor+';font-family:var(--fn);font-weight:700">'+label+' '+govBadgeHTML(p.wallet)+'</span>';
          html += '<span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">'+parseFloat(p.gp_balance||0).toFixed(0)+' GP</span>';
          html += '</div>';
          if(p.role==='governor' && p.sector_id) _govMySectorIds.push(p.sector_id);
        });
        posEl.innerHTML = html;

        // GP is now managed by updateGPDisplay() from /api/auth/me
      }

      // ── COMMANDER / GOVERNOR DASHBOARDS ──
      var isCommander = _govMyPositions.some(function(p){return p.role==='commander'});
      var isGovernor = _govMyPositions.some(function(p){return p.role==='governor'});
      document.getElementById('govCommanderDash').style.display = isCommander?'':'none';
      document.getElementById('govGovernorDash').style.display = isGovernor?'':'none';
      if(isGovernor && _govMySectorIds.length){
        // Set initial selected sector (keep previous if still valid)
        if(!_govMySectorId || _govMySectorIds.indexOf(_govMySectorId)===-1) _govMySectorId = _govMySectorIds[0];
        // Update picker button label (replaces native dropdown)
        var pickerBtn = document.getElementById('govSectorPickerBtn');
        if(pickerBtn){
          var curSec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
          pickerBtn.textContent = (curSec ? curSec.name : 'Sector '+_govMySectorId) + ' ▾';
        }
        // Pre-fill sector announcement & tax rate
        var mySector = _sectorsData && _sectorsData.find(function(s){return s.id===_govMySectorId});
        if(mySector){
          var saInput = document.getElementById('govSectorAnnounce');
          if(saInput && !saInput.value) saInput.value = mySector.announcement || '';
          var taxSlider = document.getElementById('govTaxSlider');
          var taxVal = document.getElementById('govTaxVal');
          if(taxSlider && mySector.taxRate){
            taxSlider.value = mySector.taxRate;
            if(taxVal) taxVal.textContent = mySector.taxRate+'%';
          }
        }
      }

      // Pre-fill commander announcement
      if(isCommander && cmdInfo && cmdInfo.announcement){
        var caInput = document.getElementById('govCmdAnnounce');
        if(caInput && !caInput.value) caInput.value = cmdInfo.announcement;
      }

      // ── COMMANDER INFO ──
      var cmdEl = document.getElementById('govCommanderInfo');
      if(cmdInfo && cmdInfo.commander){
        var chtml = '<div style="display:flex;flex-direction:column;gap:4px">';
        var cmdName = cmdInfo.commanderNickname || shortAddr(cmdInfo.commander);
        chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">COMMANDER</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)" title="'+(cmdInfo.commander||'')+'">'+cmdName+'</span></div>';
        if(cmdInfo.vice){
          var viceName = cmdInfo.viceNickname || shortAddr(cmdInfo.vice);
          chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">VICE</span><span style="font-size:10px;color:var(--tx2);font-family:var(--fn)" title="'+(cmdInfo.vice||'')+'">'+viceName+'</span></div>';
        }
        if(cmdInfo.commanderGP!=null) chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">GP BALANCE</span><span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">'+parseFloat(cmdInfo.commanderGP).toFixed(0)+'</span></div>';
        if(cmdInfo.poolGP!=null) chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">POOL</span><span style="font-size:10px;color:var(--gn);font-family:var(--fn)">'+parseFloat(cmdInfo.poolGP).toFixed(0)+' GP</span></div>';
        if(cmdInfo.announcement) chtml += '<div style="margin-top:4px;padding:6px 8px;background:rgba(255,209,102,.06);border-radius:4px;font-size:10px;color:var(--gold)">📢 '+cmdInfo.announcement+'</div>';
        chtml += '</div>';
        cmdEl.innerHTML = chtml;
      } else {
        cmdEl.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">No Commander elected yet.</div>';
      }

      // ── ACTIVE EVENTS ──
      var evSection = document.getElementById('govActiveEvents');
      var evList = document.getElementById('govEventsList');
      if(events && events.length > 0){
        evSection.style.display = '';
        var ehtml = '';
        events.forEach(function(ev){
          var icons = {double_mining:'⛏',war_time:'⚔',peace_treaty:'🕊'};
          var colors = {double_mining:'var(--gn)',war_time:'var(--red)',peace_treaty:'var(--cyan)'};
          var names = {double_mining:'DOUBLE MINING',war_time:'WAR TIME',peace_treaty:'PEACE TREATY'};
          var icon = icons[ev.event_type]||'📌';
          var color = colors[ev.event_type]||'var(--tx)';
          var name = names[ev.event_type]||ev.event_type;
          var endsAt = new Date(ev.ends_at);
          var remaining = Math.max(0, Math.ceil((endsAt - Date.now())/(60*1000)));
          var timeStr = remaining > 60 ? Math.floor(remaining/60)+'h '+remaining%60+'m' : remaining+'m';
          ehtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:'+color+'08;border-radius:6px;border:1px solid '+color+'22">';
          ehtml += '<span style="font-size:10px;color:'+color+';font-family:var(--fn)">'+icon+' '+name+'</span>';
          ehtml += '<span style="font-size:9px;color:var(--tx3)">'+timeStr+' left</span>';
          ehtml += '</div>';
        });
        evList.innerHTML = ehtml;
      } else {
        evSection.style.display = 'none';
      }

      // ── BOUNTY BOARD ──
      var bList = document.getElementById('govBountyList');
      if(bounties && bounties.length > 0){
        var bhtml = '';
        bounties.forEach(function(b){
          var exp = new Date(b.expires_at);
          var daysLeft = Math.max(0, Math.ceil((exp - Date.now())/(24*60*60*1000)));
          bhtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(232,72,85,.04);border-radius:6px;margin-bottom:4px;border:1px solid rgba(232,72,85,.15)">';
          bhtml += '<div style="display:flex;flex-direction:column;gap:2px">';
          var bName = b.target_nickname || shortAddr(b.target_wallet);
          bhtml += '<span style="font-size:10px;color:var(--red);font-family:var(--fn)" title="'+(b.target_wallet||'')+'">🎯 '+bName+'</span>';
          if(b.reason) bhtml += '<span style="font-size:8px;color:var(--tx3)">'+b.reason+'</span>';
          bhtml += '</div>';
          bhtml += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">';
          bhtml += '<span style="font-size:10px;color:var(--gold);font-family:var(--fn)">'+parseFloat(b.gp_reward||b.pp_reward||0).toFixed(0)+' GP</span>';
          bhtml += '<span style="font-size:8px;color:var(--tx3)">'+daysLeft+'d left</span>';
          bhtml += '</div>';
          bhtml += '</div>';
        });
        bList.innerHTML = bhtml;
      } else {
        bList.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">No active bounties.</div>';
      }

    }).catch(function(err){
      console.warn('[GOV] loadGovernanceData error:', err);
    });
  };

  // ── Governance Action Costs (defaults; server is authoritative) ──
  // Commander pays from commander position GP pool; governor pays from
  // governor position GP pool (per sector). User's personal GP is NOT used.
  var GOV_EVENT_COSTS = { double_mining: 300, war_time: 300, peace_treaty: 300 };
  var GOV_EVENT_HOURS = { double_mining: 1, war_time: 1, peace_treaty: 1 };
  var GOV_BUFF_COSTS  = { mining_boost: 100, defense_bonus: 100, claim_discount: 100 };
  var GOV_BUFF_HOURS  = { mining_boost: 24, defense_bonus: 24, claim_discount: 24 };
  var GOV_EVENT_LABELS = { double_mining: '⛏ DOUBLE MINING', war_time: '⚔ WAR TIME', peace_treaty: '🕊 PEACE TREATY' };
  var GOV_BUFF_LABELS  = { mining_boost: '⛏ MINING +20%', defense_bonus: '🛡 DEFENSE +10%', claim_discount: '💰 CLAIM -10%' };

  function _getCommanderGP(){
    // Look up commander position in _govMyPositions
    var p = (_govMyPositions||[]).find(function(pp){return pp.role==='commander'});
    return p ? parseFloat(p.gp_balance||0) : 0;
  }
  function _getGovernorGP(sectorId){
    var p = (_govMyPositions||[]).find(function(pp){return pp.role==='governor' && pp.sector_id===sectorId});
    return p ? parseFloat(p.gp_balance||0) : 0;
  }

  // ── Governance Actions ──
  window.govTriggerEvent = function(eventType){
    var w = walletState.address;
    if(!w){showToast('Connect wallet first');return}
    var cost = GOV_EVENT_COSTS[eventType] || 300;
    var hours = GOV_EVENT_HOURS[eventType] || 1;
    var label = GOV_EVENT_LABELS[eventType] || eventType;
    var cmdGP = _getCommanderGP();
    var insufficient = cmdGP < cost;
    gameConfirm({
      title: 'TRIGGER GLOBAL EVENT',
      icon: '📡',
      body: 'Activate <b style="color:var(--mars)">'+label+'</b> for the entire planet?<br>Duration: <b>'+hours+'h</b> · Daily limit: <b>1/day</b>',
      info: [
        { k:'COST', v: cost+' GP' },
        { k:'COMMANDER GP', v: cmdGP.toFixed(0), insufficient: insufficient, ok: !insufficient },
        { k:'AFTER', v: (cmdGP - cost).toFixed(0)+' GP', insufficient: insufficient }
      ],
      confirmText: insufficient ? 'INSUFFICIENT GP' : 'LAUNCH EVENT',
      disabled: insufficient
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/governance/commander/event',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,eventType:eventType})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast('Event triggered: '+label+' ('+d.hours+'h · -'+d.gpSpent+' GP)');
        loadGovernanceData();
      }).catch(function(){showToast('Failed to trigger event')});
    });
  };

  window.govTriggerRocket = function(){
    var w = walletState.address;
    if(!w){showToast('Connect wallet first');return}
    var cmdGP = _getCommanderGP();
    gameConfirm({
      title:'LAUNCH SUPPLY DROP',
      icon:'🚀',
      body:'Schedule a rocket supply drop across Mars? Players will receive rewards at the landing zone.',
      info:[
        { k:'COMMANDER GP', v: cmdGP.toFixed(0), ok:true }
      ],
      confirmText:'LAUNCH ROCKET'
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/rockets/trigger',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast('🚀 Rocket supply drop scheduled!');
      }).catch(function(){showToast('Failed to trigger rocket')});
    });
  };

  window.govSetCmdAnnouncement = function(){
    var w = walletState.address;
    if(!w){showToast('Connect wallet first');return}
    var text = document.getElementById('govCmdAnnounce').value.trim();
    fetch('/api/governance/commander/announcement',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast('Announcement updated');
      loadGovernanceData();
    }).catch(function(){showToast('Failed to set announcement')});
  };

  window.govPlaceBounty = function(){
    var w = walletState.address;
    if(!w){showToast('Connect wallet first');return}
    var target = document.getElementById('govBountyTarget').value.trim();
    var amount = parseFloat(document.getElementById('govBountyAmount').value);
    if(!target||!amount||amount<=0){showToast('Enter target nickname and GP amount');return}
    fetch('/api/governance/commander/bounty',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,targetNickname:target,gpAmount:amount})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr?srvErr(d.error):d.error,'error');return}
      showToast('Bounty placed: '+(d.gpReward!=null?d.gpReward:d.ppReward||0)+' GP reward');
      document.getElementById('govBountyTarget').value='';
      document.getElementById('govBountyAmount').value='';
      loadGovernanceData();
    }).catch(function(){showToast('Failed to place bounty')});
  };

  window.govSetTaxRate = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast('Not a governor');return}
    var rate = parseFloat(document.getElementById('govTaxSlider').value);
    fetch('/api/governance/sector/'+_govMySectorId+'/tax-rate',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,rate:rate})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast('Tax rate set to '+d.taxRate+'%');
    }).catch(function(){showToast('Failed to set tax rate')});
  };

  window.govBuyBuff = function(buffType){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast('Not a governor');return}
    var cost = GOV_BUFF_COSTS[buffType] || 100;
    var hours = GOV_BUFF_HOURS[buffType] || 24;
    var label = GOV_BUFF_LABELS[buffType] || buffType;
    var govGP = _getGovernorGP(_govMySectorId);
    var sec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
    var sectorName = sec ? sec.name : 'Sector '+_govMySectorId;
    var insufficient = govGP < cost;
    gameConfirm({
      title: 'ACTIVATE SECTOR BUFF',
      icon: '⚡',
      body: 'Apply <b style="color:var(--gn)">'+label+'</b> to <b style="color:var(--cyan)">'+sectorName+'</b>?<br>Duration: <b>'+hours+'h</b>',
      info: [
        { k:'COST', v: cost+' GP' },
        { k:'GOVERNOR GP', v: govGP.toFixed(0), insufficient: insufficient, ok: !insufficient },
        { k:'AFTER', v: (govGP - cost).toFixed(0)+' GP', insufficient: insufficient }
      ],
      confirmText: insufficient ? 'INSUFFICIENT GP' : 'ACTIVATE BUFF',
      disabled: insufficient
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/governance/sector/'+_govMySectorId+'/buff',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,buffType:buffType})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast('Buff activated: '+label+' ('+d.hours+'h · -'+d.gpSpent+' GP)');
        loadGovernanceData();
      }).catch(function(){showToast('Failed to buy buff')});
    });
  };

  window.govSwitchSector = function(sectorId) {
    _govMySectorId = parseInt(sectorId);
    var mySector = _sectorsData && _sectorsData.find(function(s){return s.id===_govMySectorId});
    if(mySector){
      var saInput = document.getElementById('govSectorAnnounce');
      if(saInput) saInput.value = mySector.announcement || '';
      var taxSlider = document.getElementById('govTaxSlider');
      var taxVal = document.getElementById('govTaxVal');
      if(taxSlider && mySector.taxRate){
        taxSlider.value = mySector.taxRate;
        if(taxVal) taxVal.textContent = mySector.taxRate+'%';
      }
    }
    // Update picker button label
    var pickerBtn = document.getElementById('govSectorPickerBtn');
    if(pickerBtn){
      pickerBtn.textContent = (mySector ? mySector.name : 'Sector '+_govMySectorId) + ' ▾';
    }
  };

  window.openGovSectorPicker = function(){
    if(!_govMySectorIds.length){ showToast('No sectors to manage'); return; }
    var items = _govMySectorIds.map(function(sid){
      var sn = (_sectorsData||[]).find(function(s){return s.id===sid});
      return { value: String(sid), label: sn ? sn.name : 'Sector '+sid };
    });
    gamePicker({title:'SELECT SECTOR TO MANAGE', items:items, selected:String(_govMySectorId||'')}).then(function(v){
      if(v==null) return;
      govSwitchSector(v);
    });
  };

  window.govSetSectorAnnouncement = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast('Not a governor');return}
    var text = document.getElementById('govSectorAnnounce').value.trim();
    fetch('/api/governance/sector/'+_govMySectorId+'/announcement',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast('Sector announcement updated');
      // Update local data and refresh overlay
      var sec = (_sectorsData || []).find(function(s){return s.id===_govMySectorId});
      if(sec) sec.announcement = text;
      if(typeof updateSectorAnnounces==='function') updateSectorAnnounces();
    }).catch(function(){showToast('Failed to set announcement')});
  };

  window.govSaveDeclaration = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast('Not a governor');return}
    var ta = document.getElementById('govDeclarationText');
    var text = ta ? ta.value.trim() : '';
    if(!text){showToast('Enter declaration text');return}
    var sec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
    var code = sec && (sec.code || sec.sector_code || sec.name);
    if(!code){showToast('Sector code not found');return}
    fetch('/api/governor/declaration',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,sectorCode:code,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast('Error: '+d.error);return}
      showToast('Declaration saved! (-5 GP)');
      try { loadGovernanceData(); } catch(_) {}
    }).catch(function(){showToast('Failed')});
  };

  // Tax slider live update
  (function(){
    var sl = document.getElementById('govTaxSlider');
    if(sl) sl.addEventListener('input',function(){
      document.getElementById('govTaxVal').textContent = this.value+'%';
    });
  })();

  function fetchAnnounce(){
    if (!_pageIsActive()) return;
    fetch('/api/config').then(function(r){return r.json()}).then(function(cfg){
      if(cfg && cfg.announcement) showAnnounce(cfg.announcement);
      else {
        var banner = document.getElementById('announceBanner');
        if(banner) banner.classList.remove('show');
      }
      // Update pricing from server config
      if(cfg.pixelBasePrice) PIXEL_PRICE=cfg.pixelBasePrice;
      if(cfg.hijackMultiplier) HIJACK_MULT=cfg.hijackMultiplier;
      if(cfg.sectorPrices) SECTOR_PRICES=cfg.sectorPrices;
      // Governance state
      if(cfg.governance) _updateGovernanceUI(cfg.governance);
    }).catch(function(){});
  }

  // 초기 로드 + 주기적 갱신
  _setActiveTimeout(fetchAnnounce, 1500);
  _setActiveInterval(fetchAnnounce, POLL_INTERVAL);
})();

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
  }).catch(function(){});
})();
