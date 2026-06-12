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
