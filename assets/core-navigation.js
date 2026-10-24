/* Core mission entry uses server progress; optional legacy systems load on request. */
(function () {
  'use strict';
  var request = 0, lastState = null, lastIdentity = '';
  var missions = {
    first_sortie: ['Landing defense', '착륙 방어'],
    secure_node: ['Secure the mine', '광산 확보'],
    move_yield: ['Escort the yield', '화물 호위'],
    restore_fleet: ['Restore the fleet', '전력 복구'],
    hold_front: ['Hold the front', '전선 개방']
  };
  var objectives = {
    battle_won: ['Win a fleet battle', '실제 함대전 승리'],
    node_captured: ['Capture the resource node', '자원 거점 점령'],
    production_collected: ['Collect node production', '거점 생산 인수'],
    cargo_arrived: ['Deliver the cargo', '화물 도착'],
    fleet_ready: ['Repair or inspect the fleet', '전력 정비 또는 점검'],
    node_defended: ['Save the defense formation', '방어 편성 저장']
  };
  function label(en, ko) { return typeof gameUiText === 'function' ? gameUiText(en, ko) : typeof tl === 'function' ? tl(en, ko) : en; }
  function identity() {
    var wallet = window.walletState && window.walletState.address || '';
    return String(wallet).toLowerCase() + '|' + (localStorage.getItem('pw_token') || '');
  }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  function operationButton(en, ko, route) { return routeButton(label(en, ko), route || 'operations', 'core-primary'); }
  function routeButton(text, route, cls) {
    return '<button type="button" class="'+(cls || '')+'" data-core-route="'+escape(route)+'">'+escape(text)+'</button>';
  }
  var copy = {
    journal:['Operation journal','작전일지','作戦日誌','行动日志','Jurnal operasi','Nhật ký chiến dịch','บันทึกปฏิบัติการ'],
    journey:['Your route to command','지휘관 성장 경로','指揮官への道','指挥官成长路线','Jalur menjadi komandan','Con đường chỉ huy','เส้นทางผู้บัญชาการ'],
    purpose:['Why this matters','이 작전의 목적','作戦の目的','行动目的','Tujuan operasi','Mục đích chiến dịch','เป้าหมายปฏิบัติการ'],
    reward:['Operation reward','작전 보상','作戦報酬','行动奖励','Hadiah operasi','Thưởng chiến dịch','รางวัลปฏิบัติการ'],
    next:['What follows','다음 연결','次につながるもの','后续用途','Langkah berikutnya','Bước tiếp theo','ขั้นต่อไป'],
    depotReward:['5 iron dust → repair depot, once per operation. Not GP or personal ore.','작전당 철 분말 5개 → 정비 창고, 1회. GP·개인 광물이 아닙니다.','作戦ごとに鉄粉5を修理倉庫へ1回。GP・個人鉱石ではありません。','每项行动一次性发放5铁尘至维修仓库，并非GP或个人矿石。','5 debu besi ke depot perbaikan, sekali per operasi. Bukan GP atau bijih pribadi.','5 bụi sắt vào kho sửa chữa, một lần mỗi chiến dịch. Không phải GP hay quặng cá nhân.','ฝุ่นเหล็ก 5 หน่วยเข้าคลังซ่อมครั้งเดียวต่อปฏิบัติการ ไม่ใช่ GP หรือแร่ส่วนตัว'],
    prerequisite:['Claim the previous operation reward first.','앞선 작전의 보상을 수령하면 열립니다.','前の作戦報酬を受領すると開きます。','领取上一项行动奖励后解锁。','Ambil hadiah operasi sebelumnya dahulu.','Nhận thưởng chiến dịch trước để mở.','รับรางวัลปฏิบัติการก่อนหน้าเพื่อปลดล็อก'],
    ready:['Ready','시작 가능','開始可能','可开始','Siap','Sẵn sàng','พร้อมเริ่ม'],
    active:['In progress','진행 중','進行中','进行中','Berlangsung','Đang tiến hành','กำลังดำเนินการ'],
    completed:['Reward ready','보상 수령 가능','報酬受領可能','可领奖','Hadiah tersedia','Có thể nhận thưởng','รับรางวัลได้'],
    claimed:['Complete · reward claimed','완료 · 보상 수령','完了・報酬受領済み','完成·已领奖','Selesai · hadiah diambil','Hoàn thành · đã nhận thưởng','เสร็จแล้ว · รับรางวัลแล้ว'],
    locked:['Locked','잠김','未解放','未解锁','Terkunci','Chưa mở','ยังไม่ปลดล็อก'],
    activities:['Choose your next activity','목적별 활동 길잡이','目的別の活動案内','按目的选择活动','Pilih kegiatan berikutnya','Chọn hoạt động tiếp theo','เลือกกิจกรรมถัดไป'],
    optional:['Optional routes. Your operation progress stays saved.','선택 활동입니다. 진행 중인 작전은 저장됩니다.','任意の活動です。作戦の進行状況は保存されます。','可选活动，行动进度会保留。','Jalur opsional. Progres operasi tetap tersimpan.','Hoạt động tùy chọn. Tiến độ chiến dịch được lưu.','กิจกรรมเสริม ความคืบหน้าปฏิบัติการยังคงบันทึกไว้'],
    story:['Story and rewards','이야기·완료 보상','物語と報酬','故事与奖励','Cerita dan hadiah','Cốt truyện và phần thưởng','เรื่องราวและรางวัล'],
    industry:['Production and materials','생산·재료 확보','生産と素材','生产与材料','Produksi dan bahan','Sản xuất và nguyên liệu','การผลิตและวัสดุ'],
    growth:['Fleet and equipment','함대·장비 성장','艦隊と装備','舰队与装备','Armada dan perlengkapan','Hạm đội và trang bị','กองยานและอุปกรณ์'],
    shared:['Cooperation and competition','협력·경쟁','協力と競争','合作与竞争','Kerja sama dan persaingan','Hợp tác và cạnh tranh','ความร่วมมือและการแข่งขัน'],
    storyHint:['Optional faction story. Chapter requirements and rewards are shown there.','선택형 진영 이야기. 챕터 조건과 보상은 캠페인에서 확인하세요.','任意の勢力物語。章の条件と報酬はキャンペーンで確認。','可选阵营故事，在战役中查看章节条件和奖励。','Cerita faksi opsional. Lihat syarat bab dan hadiah di kampanye.','Cốt truyện phe tùy chọn. Xem điều kiện chương và thưởng trong chiến dịch.','เรื่องราวฝ่ายแบบเสริม ดูเงื่อนไขบทและรางวัลในแคมเปญ'],
    recordsHint:['Daily, weekly, achievements and existing rewards. Claim only completed goals.','일일·주간·업적·기존 보상. 완료한 항목만 수령합니다.','日次・週次・実績・既存報酬。達成した目標のみ受領。','每日、每周、成就及已有奖励，仅领取已完成目标。','Harian, mingguan, pencapaian dan hadiah lama. Ambil tujuan yang selesai saja.','Hằng ngày, hằng tuần, thành tựu và thưởng cũ. Chỉ nhận mục đã hoàn thành.','รายวัน รายสัปดาห์ ความสำเร็จและรางวัลเดิม รับเฉพาะเป้าหมายที่สำเร็จ'],
    industryHint:['Land harvest and front production use different stores. Cargo delivers front stock to repair.','영토 수확과 전선 생산은 저장소가 다릅니다. 전선 재고는 운송 후 정비에 씁니다.','領地収穫と前線生産は別在庫。前線在庫は輸送後に修理に使用。','领地收获与前线生产库存不同，前线物资运输后用于维修。','Panen lahan dan produksi garis depan memakai gudang berbeda. Kargo memasok perbaikan.','Thu hoạch đất và sản xuất tiền tuyến dùng kho khác nhau. Vận chuyển hàng để sửa chữa.','การเก็บเกี่ยวที่ดินและการผลิตแนวหน้าใช้คนละคลัง ขนส่งเสบียงเพื่อซ่อม'],
    growthHint:['Check owned materials, costs and failure chances before building or crafting.','보유 재료·비용·실패 확률을 확인하고 건조·제작하세요.','所持素材・費用・失敗率を確認して建造・製作。','建造或制作前确认已有材料、费用及失败概率。','Periksa bahan, biaya dan peluang gagal sebelum membangun atau membuat.','Kiểm tra nguyên liệu, chi phí và tỉ lệ thất bại trước khi đóng tàu hoặc chế tạo.','ตรวจวัสดุ ค่าใช้จ่ายและโอกาสล้มเหลวก่อนสร้างหรือคราฟต์'],
    sharedHint:['Guild membership and fleet requirements apply. Read loss risks before joining a battle.','길드 가입·함대 조건이 필요합니다. 전투 전 손실 위험을 확인하세요.','ギルド参加・艦隊条件が必要。戦闘前に損失リスクを確認。','需要公会及舰队条件，参战前查看损失风险。','Syarat guild dan armada berlaku. Baca risiko kehilangan sebelum bertempur.','Cần điều kiện bang hội và hạm đội. Đọc rủi ro tổn thất trước khi tham chiến.','มีเงื่อนไขสมาคมและกองยาน อ่านความเสี่ยงก่อนเข้ารบ'],
    materials:['Where your materials go','재료의 흐름과 사용처','素材の流れと用途','材料流向与用途','Alur dan kegunaan bahan','Luồng và công dụng nguyên liệu','เส้นทางและการใช้วัสดุ'],
    materialHint:['Front: mine → cargo → repair depot. Personal inventory: ingredients → crafting or shipyard. Different resource codes are not interchangeable.','전선: 광산 → 운송 → 정비 창고. 개인 인벤토리: 재료 → 제작·조선소. 이름이 비슷해도 자원 코드가 다르면 대체되지 않습니다.','前線：鉱山→輸送→修理倉庫。個人在庫：素材→製作・造船所。異なる資源は代用できません。','前线：矿山→运输→维修仓库。个人背包：材料→制作或船厂。不同资源不能互换。','Garis depan: tambang → kargo → depot perbaikan. Inventaris pribadi: bahan → pembuatan atau galangan. Kode sumber daya berbeda tidak dapat ditukar.','Tiền tuyến: mỏ → vận chuyển → kho sửa chữa. Túi cá nhân: nguyên liệu → chế tạo hoặc xưởng tàu. Mã tài nguyên khác nhau không thay thế nhau.','แนวหน้า: เหมือง → ขนส่ง → คลังซ่อม กระเป๋าส่วนตัว: วัสดุ → คราฟต์หรืออู่เรือ ทรัพยากรต่างรหัสใช้แทนกันไม่ได้'],
    craftHint:['Crafting is optional. Compare direct shop prices, GP, materials and success chance; a failed roll can consume them.','제작은 선택입니다. 상점 가격·GP·재료·성공률을 비교하세요. 실패해도 비용이 소모될 수 있습니다.','製作は任意。店の価格・GP・素材・成功率を比較。失敗しても費用を消費する場合があります。','制作可选，请比较商店价格、GP、材料与成功率，失败也可能消耗费用。','Membuat itu opsional. Bandingkan harga toko, GP, bahan dan peluang sukses; kegagalan bisa menghabiskannya.','Chế tạo là tùy chọn. So sánh giá cửa hàng, GP, nguyên liệu và tỉ lệ thành công; thất bại vẫn có thể tiêu hao.','การคราฟต์เป็นทางเลือก เปรียบเทียบราคาร้าน GP วัสดุและโอกาสสำเร็จ แม้ล้มเหลวก็อาจเสียค่าใช้จ่าย'],
    routeNext:['Open the operation journal to return to your current goal.','작전일지에서 현재 목표로 돌아갈 수 있습니다.','作戦日誌から現在の目標に戻れます。','可从行动日志返回当前目标。','Kembali ke tujuan saat ini lewat jurnal operasi.','Trở về mục tiêu hiện tại từ nhật ký chiến dịch.','กลับสู่เป้าหมายปัจจุบันจากบันทึกปฏิบัติการ']
  };
  var reasons = {
    first_sortie:[['Keep your landing zone safe with the free starting fleet.','무료 시작 함대로 착륙 지점을 지키고 지휘를 익힙니다.','無料の初期艦隊で着陸地点を守り指揮を学びます。','用免费初始舰队守住着陆点并学习指挥。','Jaga zona pendaratan dengan armada awal gratis.','Giữ bãi đáp bằng hạm đội khởi đầu miễn phí.','ป้องกันจุดลงจอดด้วยกองยานเริ่มต้นฟรี'],['A surviving fleet can secure your first production node.','생존 함대로 생산 거점을 확보할 수 있습니다.','生存艦隊で最初の生産拠点を確保。','幸存舰队可夺取首个生产据点。','Armada yang selamat dapat merebut node produksi.','Hạm đội sống sót có thể chiếm điểm sản xuất.','กองยานที่รอดยึดจุดผลิตแรกได้']],
    secure_node:[['Turn a combat victory into a mine that produces supplies.','전투 승리를 보급품을 만드는 광산으로 연결합니다.','戦闘の勝利を補給品の鉱山につなげます。','将战斗胜利转化为供应物资的矿山。','Ubah kemenangan menjadi tambang pemasok.','Biến chiến thắng thành mỏ cung ứng.','เปลี่ยนชัยชนะเป็นเหมืองผลิตเสบียง'],['Collect stored production, then escort it to the repair depot.','저장된 생산품을 수령하고 정비 창고로 운송합니다.','貯蔵生産物を回収して修理倉庫へ輸送。','收取储存产出并运往维修仓库。','Ambil produksi tersimpan, lalu kirim ke depot perbaikan.','Thu sản lượng đã lưu và hộ tống tới kho sửa chữa.','รับผลผลิตแล้วคุ้มกันไปยังคลังซ่อม']],
    move_yield:[['Supplies at the mine cannot repair ships until cargo arrives.','광산 재고는 운송이 도착해야 정비에 쓸 수 있습니다.','鉱山在庫は輸送到着後に修理に使えます。','矿山库存须运输到达后才能用于维修。','Stok tambang baru bisa dipakai setelah kargo tiba.','Chỉ dùng kho mỏ để sửa tàu sau khi hàng đến.','วัสดุเหมืองใช้ซ่อมได้หลังสินค้าถึงปลายทาง'],['Use delivered iron dust and the repair quote to restore your fleet.','도착한 철 분말과 정비 견적으로 함대를 복구합니다.','届いた鉄粉と修理見積もりで艦隊を復旧。','使用送达铁尘并确认报价以恢复舰队。','Gunakan debu besi terkirim dan kutipan perbaikan untuk memulihkan armada.','Dùng bụi sắt đã giao và báo giá để phục hồi hạm đội.','ใช้ฝุ่นเหล็กที่ส่งถึงและใบเสนอซ่อมฟื้นฟูกองยาน']],
    restore_fleet:[['Repair surviving ships; inspect the fleet if every ship is already at full HP.','생존 함선을 수리합니다. 전 함선이 최대 HP면 점검으로 확인합니다.','生存艦を修理。全艦HP最大なら点検します。','维修幸存舰船，全部满HP时进行检查。','Perbaiki kapal selamat; periksa jika semua HP penuh.','Sửa tàu sống sót; kiểm tra nếu tất cả đã đầy HP.','ซ่อมเรือที่รอด หาก HP เต็มทุกลำให้ตรวจสภาพ'],['A ready fleet can defend the mine and keep the supply line open.','정비된 함대로 광산과 생산선을 지킵니다.','整備済み艦隊で鉱山と補給線を防衛。','用整备舰队守住矿山与补给线。','Armada siap menjaga tambang dan jalur pasokan.','Hạm đội sẵn sàng bảo vệ mỏ và đường tiếp tế.','กองยานพร้อมรบป้องกันเหมืองและสายส่งเสบียง']],
    hold_front:[['Save a defense formation so your production has a purpose and a protector.','방어 편성을 저장해 생산 거점을 지킬 준비를 마칩니다.','防衛編成を保存して生産拠点を守る準備。','保存防御编队，准备保卫生产据点。','Simpan formasi pertahanan untuk menjaga produksi.','Lưu đội hình phòng thủ để bảo vệ sản xuất.','บันทึกแนวป้องกันเพื่อคุ้มครองการผลิต'],['Continue the production loop, grow a fleet, explore the story or cooperate with a guild.','생산선을 유지하며 함대 성장·이야기·길드 협력으로 확장하세요.','生産線を維持し艦隊育成・物語・ギルド協力へ。','维持生产线，发展舰队、探索故事或参与公会合作。','Jaga produksi, kembangkan armada, jelajahi cerita atau bekerja sama dengan guild.','Duy trì sản xuất, phát triển hạm đội, khám phá truyện hoặc hợp tác bang hội.','รักษาสายผลิต พัฒนากองยาน สำรวจเรื่องราวหรือร่วมมือกับสมาคม']]
  };
  function translated(values) { return typeof tl==='function' ? tl.apply(null,values) : label(values[0],values[1]); }
  function text(key) { return translated(copy[key]); }
  function stateLabel(status) { return text(status==='available'?'ready':status); }
  function missionName(m) { var title=missions[m.id]||[m.title,m.title];return label(title[0],title[1]); }
  function objectiveList(m) {
    return '<ul class="core-objectives">'+(m.objectives||[]).map(function(o){
      var names=objectives[o.key]||[o.label||o.key,o.label||o.key];
      var target=Math.max(1,Number(o.target)||1),count=Math.min(target,Math.max(0,Number(o.current)||0));
      return '<li'+(count>=target?' class="is-done"':'')+'><span>'+escape(label(names[0],names[1]))+'</span><b>'+count+' / '+target+'</b></li>';
    }).join('')+'</ul>';
  }
  function renderJourney(rows,current) {
    var journal=document.getElementById('coreMissionJournal');if(!journal)return;
    journal.innerHTML='<h2>'+escape(text('journey'))+'</h2><ol class="core-journey">'+rows.map(function(m,i){
      var isCurrent=current&&current.id===m.id,known=missions[m.id],reason=reasons[m.id];
      if(!known||!copy[m.status==='available'?'ready':m.status])throw Error('INVALID_MISSION_STATE');
      return '<li><details data-mission="'+escape(m.id)+'"'+(isCurrent?' data-current="true"':'')+'><summary><span class="core-step-number">'+(m.status==='claimed'?'✓':i+1)+'</span><span><strong>'+escape(missionName(m))+'</strong><small>'+escape(stateLabel(m.status))+'</small></span></summary><div class="core-step-body"><p><b>'+escape(text('purpose'))+'</b><br>'+escape(translated(reason[0]))+'</p>'+objectiveList(m)+'<p class="core-reward"><b>'+escape(text('reward'))+'</b><br>'+escape(text('depotReward'))+'</p><p><b>'+escape(text('next'))+'</b><br>'+escape(translated(reason[1]))+'</p>'+(m.status==='locked'?'<p class="core-prerequisite">'+escape(text('prerequisite'))+'</p>':m.status==='claimed'?'':operationButton(m.status==='completed'?'Claim in operations':m.status==='active'?'Continue operation':'Start operation',m.status==='completed'?'작전 보상 수령':m.status==='active'?'작전 이어가기':'작전 시작',m.status==='active'?'front':'operations'))+'</div></details></li>';
    }).join('')+'</ol>';
  }
  function render(state) {
    var body=document.getElementById('coreMissionState');if(!body)return;
    var rows=state&&state.missions||[];
    if(rows.length!==5||rows.some(function(m){return !missions[m.id];})||new Set(rows.map(function(m){return m.id;})).size!==5)throw Error('INVALID_MISSION_STATE');
    // Unclaimed completion blocks the following operation and must stay prominent.
    var current=rows.find(function(m){return m.status==='completed';})||rows.find(function(m){return m.status==='active';})||rows.find(function(m){return m.id===state.currentMissionId&&m.status==='available';});
    var claimed=rows.filter(function(m){return m.status==='claimed';}).length;
    renderJourney(rows,current);
    if(!current&&claimed===rows.length){
      body.innerHTML='<div class="core-mission-meta">5 / 5 · '+escape(text('claimed'))+'</div><h2>'+label('Your front is open','전선이 열렸습니다')+'</h2><p>'+escape(translated(reasons.hold_front[1]))+'</p>'+operationButton('Go to front','전선으로','front');return;
    }
    if(!current)throw Error('INVALID_MISSION_STATE');
    var reason=reasons[current.id];
    body.innerHTML='<div class="core-mission-meta">'+claimed+' / 5 · '+escape(stateLabel(current.status))+'</div><progress max="5" value="'+claimed+'" aria-label="'+escape(text('journey'))+'"></progress><h2>'+escape(missionName(current))+'</h2><p>'+escape(translated(reason[0]))+'</p>'+objectiveList(current)+operationButton(current.status==='completed'?'Claim in operations':current.status==='active'?'Continue operation':'Start operation',current.status==='completed'?'작전 보상 수령':current.status==='active'?'작전 이어가기':'작전 시작',current.status==='active'?'front':'operations')+'<p class="core-next-link">'+escape(text('next'))+' · '+escape(translated(reason[1]))+'</p>';
  }
  function renderGuides() {
    var guide=document.getElementById('coreActivityGuide');
    var groups=[
      ['story','storyHint', [['Story campaign','이야기 캠페인','campaign'],['Records and rewards','기록·보상','records'],['Season','시즌','season']]],
      ['industry','industryHint',[['My territory and harvest','내 영토·수확','territory'],['Front production and cargo','전선 생산·운송','front'],['Resource run','자원 출항','mining'],['Sectors','섹터','sectors']]],
      ['growth','growthHint',[['Fleet formation','함대 편성','fleet'],['Shipyard','조선소','shipyard'],['Inventory','인벤토리','items'],['Crafting','제작','crafting'],['Market','시장','market']]],
      ['shared','sharedHint',[['Guild','길드','guild'],['Governance','거버넌스','govern'],['Objective operations','목표형 전투','objectives'],['Competition','경쟁','pvp'],['Tactical practice','전술 연습','practice']]]
    ];
    if(guide)guide.innerHTML='<h2>'+escape(text('activities'))+'</h2><p>'+escape(text('optional'))+'</p>'+groups.map(function(g){return '<details class="core-guide-group"><summary>'+escape(text(g[0]))+'</summary><p>'+escape(text(g[1]))+'</p>'+(g[0]==='story'?'<p>'+escape(text('recordsHint'))+'</p>':'')+'<div class="core-route-grid">'+g[2].map(function(r){return routeButton(label(r[0],r[1]),r[2]);}).join('')+'</div></details>';}).join('');
    document.querySelectorAll('[data-core-material-guide]').forEach(function(el){
      el.innerHTML='<details class="core-guide-group"><summary>'+escape(text('materials'))+'</summary><p>'+escape(text('materialHint'))+'</p><p>'+escape(text('craftHint'))+'</p><div class="core-route-grid">'+routeButton(label('Front production · cargo','전선 생산·운송'),'front')+routeButton(label('Crafting','제작'),'crafting')+routeButton(label('Shipyard','조선소'),'shipyard')+routeButton(text('journal'),'journal')+'</div></details>';
    });
  }
  function navigate(route) {
    var commands={front:'front',operations:'missions'};
    if(commands[route]){openCommandCenter(commands[route]);return;}
    var external={shipyard:'openShipyard',objectives:'openObjectiveOperations',practice:'openTacticalLab'};
    if(external[route]){closeBaseModal();if(typeof window[external[route]]==='function')window[external[route]]();return;}
    var tabs={journal:'mission',campaign:'quests',records:'records',season:'rank',sectors:'sectors',govern:'govern',territory:'territory',mining:'mining',fleet:'fleet',items:'items',crafting:'shop',market:'market',guild:'guild',pvp:'pvp'};
    if(!tabs[route])return;
    switchBaseTab(tabs[route]);
    if(route==='items'&&typeof loadBaseInventory==='function')loadBaseInventory();
    if(route==='market'&&typeof loadMarketTab==='function')loadMarketTab();
    if(route==='crafting'){
      if(typeof loadBaseShopItems==='function')loadBaseShopItems();
      var button=document.querySelector('.base-shop-view[data-view="crafting"]');
      switchBaseShopView('crafting',button);
    }
  }
  window.refreshCoreLabels = function () {
    document.querySelectorAll('[data-core-en]').forEach(function (el) { el.textContent = label(el.dataset.coreEn, el.dataset.coreKo); });
    renderGuides();
    document.querySelectorAll('[data-core-journal-label]').forEach(function(el){el.textContent=text('journal');});
    if (lastState && lastIdentity === identity()) { try { render(lastState); } catch (_) {} }
  };
  window.loadCoreMission = async function () {
    var body = document.getElementById('coreMissionState');
    if (!body) return;
    var at = ++request, owner = identity(); lastState = null;
    var journal=document.getElementById('coreMissionJournal');if(journal)journal.innerHTML='';
    window.refreshCoreLabels();
    if (!localStorage.getItem('pw_token')) {
      body.innerHTML = '<h2>' + label('Your first fleet awaits', '첫 함대가 기다립니다') + '</h2><p>' + label('Sign in to start five operations with a free starting fleet.', '로그인하고 무료 시작 함대로 5개 작전을 진행하세요.') + '</p>' + operationButton('Sign in · first operation', '로그인·첫 작전');
      return;
    }
    body.innerHTML = '<p role="status">' + label('Loading your next objective…', '다음 목표를 불러오는 중…') + '</p>';
    try {
      var response = await fetch('/api/starter-ops/state', {headers: getAuthHeaders(), cache: 'no-store'});
      var data = await response.json();
      if (at !== request || owner !== identity()) return;
      var pane = document.getElementById('basePane_mission');
      if (!pane || !pane.classList.contains('active')) return;
      if (!response.ok || data.error || data.success === false) throw Error(data.error || 'REQUEST_FAILED');
      render(data); lastState = data; lastIdentity = owner;
    } catch (error) {
      if (at !== request || owner !== identity()) return;
      if(journal)journal.innerHTML='';
      body.innerHTML = '<p role="alert">' + label('Could not load your operation. Retry or open operations.', '작전 정보를 불러오지 못했습니다. 다시 조회하거나 작전 화면을 여세요.') + '</p><div class="core-record-links"><button type="button" data-core-route="retry">' + label('Retry', '다시 조회') + '</button>' + operationButton('Open operations', '작전 열기') + '</div>';
    }
  };
  function loadRewards() {
    var wallet = window.walletState && window.walletState.address;
    if (wallet && typeof loadQuests === 'function') loadQuests(wallet);
    ['checkDailyLogin', 'renderInlineCheckin', 'loadDailyMissions', 'loadAchievements', 'loadWeeklyChallenges'].forEach(function (name) {
      if (typeof window[name] === 'function') { try { window[name](); } catch (_) {} }
    });
  }
  window.loadCoreRecords = function () {
    var rewards = document.getElementById('coreRewardRecords'), social = document.getElementById('coreLegacyCommunity');
    if (rewards && rewards.open) loadRewards();
    if (social && social.open && typeof _scheduleQuestAuxLoads === 'function') _scheduleQuestAuxLoads();
  };
  window.openGuildLounge = function () {
    if (typeof closeCommandCenter === 'function') closeCommandCenter();
    openBaseModal(); switchBaseTab('guild');
  };
  function init() {
    window._lastBaseCat = 'mission';
    var base=document.getElementById('baseModal');
    if(base)base.addEventListener('click',function(event){
      var control=event.target.closest('[data-core-route]');
      if(!control||!base.contains(control))return;
      if(control.dataset.coreRoute==='retry'){window.loadCoreMission();return;}
      navigate(control.dataset.coreRoute);
    });
    window.refreshCoreLabels();
    var rewards = document.getElementById('coreRewardRecords'), social = document.getElementById('coreLegacyCommunity');
    if (rewards) rewards.addEventListener('toggle', function () { if (rewards.open) loadRewards(); });
    if (social) social.addEventListener('toggle', function () { if (social.open) _scheduleQuestAuxLoads(); else _cancelQuestAuxLoads(); });
    // Existing locale changes update document.lang; avoid wrapping shared setLang.
    if (typeof MutationObserver !== 'undefined') new MutationObserver(window.refreshCoreLabels).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
