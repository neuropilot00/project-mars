// ── CODEX / WHITEPAPER CONTENT (multilingual) ──
var CODEX_CONTENT = {
  en: {
    sections: [
      { id: 'siegewar', icon: '🏛', title: 'Guild Siege War',
        blocks: [
          { type:'p', text:'**Capture Mars sector by sector.** Guilds fight scheduled fleet battles to seize sectors, collect their tax, and crown the planet Commander. Inspired by EVE alliance wars and Lineage castle sieges.' },
          { type:'h2', text:'🗺 Sectors & Governors' },
          { type:'p', text:'• Mars is split into **24 sectors** (frontier / mid / core). The guild that wins a sector siege becomes its **Governor** and collects **sector tax** into the **guild treasury**.\n• See the whole map in **BASE → GOVERN → 🗺 SOV MAP**: who rules each sector, the ruling-guild leaderboard, and upcoming siege windows.' },
          { type:'h2', text:'⚔ Sector Siege (weekly)' },
          { type:'p', text:'1. A challenger declares a siege on a sector (needs territory there).\n2. The decisive battle snaps to a **fixed weekly slot** (Wed & Sat 12:00 UTC) so everyone can watch.\n3. **Guild members each commit one fleet** to attack or defend (1 fleet per person).\n4. At the slot, **all committed fleets fight on one battlefield in real time** — you steer your own fleet live.\n5. The winning guild becomes the new Governor.' },
          { type:'h2', text:'🎮 Real-time commands' },
          { type:'p', text:'During a live siege you command **your own fleet**: **formation**, **maneuver**, **focus target**, plus charged manual skills **☢ Beam** / **☄ Missile** (server-charged — fire at 100%). Everyone watches the same authoritative battle.' },
          { type:'callout', variant:'warn', title:'⚠ Ships can be permanently lost', text:'With siege full-loss ON, a losing fleet is **permanently destroyed**. Want zero risk? **Don\'t commit a fleet** — challenge or defend by territory occupancy instead (decided by pixel count, no ship loss).' },
          { type:'h2', text:'👑 Commander Siege (monthly)' },
          { type:'p', text:'• The guild controlling the most sectors is the **Mars Commander**. Once a month (1st, 12:00 UTC) a **Commander Siege** auto-opens: Commander (defender) vs the #2 guild (challenger). The winner rules Mars.\n• If nobody challenges for several cycles, the throne is **vacated** and falls back to the top sector-holding guild.' },
          { type:'h2', text:'💰 Tax → Guild Treasury' },
          { type:'p', text:'Sector tax flows into the **guild treasury**. Leaders/officers withdraw it from the guild panel. Disbanding a guild **refunds** the treasury to the leader (no GP is burned).' },
        ] },
      { id: 'whatsnew', icon: '🆕', title: "What's New",
        blocks: [
          { type:'p', text:'**v7.27x — 2026-05 Resource Run + GP-first economy.** Latest stable build.' },
          { type:'h2', text:'⛏ Resource Run — F2P mining without land' },
          { type:'p', text:'• Send a fleet on a **Resource Run** (MISSIONS → ⛏ Resource Run) to mine **GP + crafting materials with no land required** — the F2P ladder for landless players.\n• Pick a **destination by distance** (Near / Mid / Far): farther = higher yield & rarer materials, but more **hull wear** and **raid risk**. Worn ships must be **repaired at the Shipyard** (a GP sink).\n• Yield scales with your fleet\'s **cargo capacity** (ship class × tier); daily GP from runs is capped to keep the economy healthy.' },
          { type:'h2', text:'💱 GP ↔ PP auction & GP-denominated rewards' },
          { type:'p', text:'• **All free PP faucets now pay GP** — PP is a **deposit-minted, USDT-redeemable token only**. Quest and commander-bounty rewards now pay **GP** (the UI shows GP everywhere).\n• Need PP without depositing? **Buy it from other players in the Auction House** (GP↔PP currency trade) where you set the price — the operator never mints PP from GP.' },
          { type:'h2', text:'🏗 Territory condition, grade & TEND' },
          { type:'p', text:'• Every territory now has a **condition (0–100, an HP gauge)** and a **grade (F → S)**. Condition **decays a little every day**; if you neglect it, the grade slips.\n• **🔧 TEND** (in the territory **PRODUCTION** panel) spends GP to **restore condition** and push the grade back up.\n• **Higher grade = bigger payouts**: harvest PP and mineral-drop rates scale with grade (about **S ×1.5 down to F ×0.6**). Keeping your land well-tended directly raises your income.' },
          { type:'h2', text:'🔓 Level-gated tab unlocks' },
          { type:'p', text:'• Advanced features now unlock by account level: **Fleet Lv3, Transport Lv4, PVP Lv6, Guild Lv8, Governance Lv10**.\n• Core early-game tabs (territory, shop, market, campaign) are **open from the start**. Locked tabs show a **🔒 + required level** badge.' },
          { type:'h2', text:'🤖 NPC Arena — a living world' },
          { type:'p', text:'• NPC fleets now fight in the **arena around the clock**, so the world feels alive even at off-peak hours and there is always action to watch and learn from.' },
          { type:'h2', text:'⛏ Material supply rebalanced' },
          { type:'p', text:'• Frontier sectors now also drop **some tier-2 crafting materials**, so new players can build their first real ships without owning premium CORE land.' },
          { type:'h2', text:'🏪 Regional market sector filter' },
          { type:'p', text:'• The ship/item market can be **filtered by sector**, making it easy to spot cross-sector arbitrage and same-sector deals.' },
          { type:'callout', variant:'warn', title:'⚠ Ship full-loss is now LIVE',
            text:'Ships sunk (HP 0) in **hijack battles are now permanently destroyed** — they cannot be revived and must be rebuilt from scratch. Treat your fleet as real, losable capital. (`hijack_ship_loss_enabled = true`)' },
          { type:'h2', text:'💰 Currency model clarified' },
          { type:'p', text:'• **GP is the main spending currency** — earned from daily login, missions, battles, expeditions, **and by converting PP → GP**. Spent on the shop, ship build/upgrade/repair, ship crates, territory upgrades, market fees.\n• **PP is the territory-mining token.** It can be redeemed to USDT at the current operator rate (variable, within the collateral pool) — not a guaranteed peg. Earned from territory harvest (daily cap), signup/referral/deposit bonuses. Used to claim/upgrade territory, convert to GP, or **redeem to USDT** (within the operator collateral pool).\n• **USDT** is real deposit/withdraw on Base chain.' },
          { type:'h2', text:'🎰 Ship Crate (gacha)' },
          { type:'p', text:'• Open ship crates with **GP** — five tiers: a **free Recruit crate** (1/day), Standard 300, Premium 1,000, Elite 2,000, Legendary 3,000 GP.\n• **Published odds** on every crate + **pity ceiling** (Premium 10, Elite 7, Legendary 5 pulls) that guarantees a Cruiser-or-better ship.' },
          { type:'h2', text:'📈 Dynamic PP ↔ GP exchange rate' },
          { type:'p', text:'• The PP→GP rate is **no longer fixed**. It floats with 24h demand inside a hard band of **5–20 GP per PP**, moving at most **±2% per recompute**. High GP demand pushes the rate down; low demand lets it drift back up.' },
          { type:'h2', text:'🏪 Regional (sector) market' },
          { type:'p', text:'• Market listings are now bound to the **seller’s home sector**. Buying can incur a **tariff to that sector’s governor**, and operators may optionally require same-sector trades — turning sectors into trade hubs.' },
          { type:'h2', text:'🛡 Economy safety rails' },
          { type:'p', text:'• **Bank-run protection**: PP→USDT redemption is only allowed within the operator-funded **collateral room** (`room = collateral − liabilities`). No unbacked redemption.\n• **PP mining cap**: passive harvest is capped at **1 PP/day per user**, anti-whale by design.\n• **Sybil defense** on referral rewards (per-account and daily caps).' },
          { type:'h2', text:'⚙ Infrastructure' },
          { type:'p', text:'• **Multi-instance horizontal scaling** — scheduler/listener workers gated behind `RUN_SCHEDULERS`, Redis-backed cache and shared rate-limit store with in-memory fallback.\n• **WebSocket real-time push** — chat and activity feed stream over WebSocket instead of polling, with Redis Pub/Sub fan-out across instances.' },
          { type:'h2', text:'🚢 Real-time Fleet Battles' },
          { type:'p', text:'• Live battle viewer over WebSocket — fleet positions, HP, formations update in real time.\n• Tactical Lab v11 is the official battle viewer; 22 ship PNG sprites (top-down).\n• Manual skills: Beam Cannon ☢, Missile Barrage ☄, EMP, Focus Fire.\n• Per-territory harvest inside BASE → Territory (CORE 24h / MID 48h / FRONTIER 72h), with mineral drops.' },
          { type:'callout', variant:'tip', title:'For developers',
            text:'See `CHANGELOG.md` and `AUDIT_FINDINGS.md` in repo root for the full technical breakdown.' }
        ]
      },
      { id: 'overview', icon: '🌍', title: 'Overview',
        blocks: [
          { type:'p', text:'**Occupy Mars** is a **territorial conquest MMO** running on Base chain. Claim pixel territories on a 3D Mars globe, earn PP from mining, raid rivals, form guilds, and fight for the season leaderboard — in short, the **digital colonization of Mars**.' },
          { type:'toc', label:'In this section', items:[
            'Core game loop',
            'Currency structure (USDT / PP / GP / XP)',
            'Win conditions',
            'Progression & unlocks',
            'First 5 minutes checklist'
          ]},

          { type:'h2', text:'1. Core Game Loop' },
          { type:'p', text:'Every activity revolves around the **5-step loop** below. Each full cycle grows your territory, capital, and reputation.' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg">'+
              '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
              '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
              '<circle cx="60"  cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="60"  y="66">🏴</text><text x="60"  y="82" fill="#ff783c">CLAIM</text>'+
              '<circle cx="170" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="170" y="66">⛏</text><text x="170" y="82" fill="#ff783c">MINE</text>'+
              '<circle cx="280" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="280" y="66">🛡</text><text x="280" y="82" fill="#ff783c">DEFEND</text>'+
              '<circle cx="390" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="390" y="66">⚔</text><text x="390" y="82" fill="#ff783c">RAID</text>'+
              '<circle cx="480" cy="70" r="32" fill="rgba(255,120,60,.18)" stroke="#ffd166" stroke-width="2"/><text x="480" y="66">📈</text><text x="480" y="82" fill="#ffd166">GROW</text>'+
              '</g>'+
              '<line x1="94"  y1="70" x2="134" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="204" y1="70" x2="244" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="314" y1="70" x2="354" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="424" y1="70" x2="444" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<path d="M480,100 Q480,130 260,130 Q60,130 60,100" fill="none" stroke="#ff783c" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="4,4" marker-end="url(#ar)"/>'+
            '</svg>',
            caption:'CLAIM → MINE → DEFEND → RAID → GROW → (back to CLAIM)' },

          { type:'h2', text:'2. Currency Structure' },
          { type:'p', text:'There are **4 assets** in the game. Each plays a different role — don\'t mix them up.' },
          { type:'table',
            headers:['Asset','Role','Source','Use','Convertible?'],
            rows:[
              [{v:'💵 USDT',cls:'mars'},  'Real crypto',          'Deposit (Base chain)',                    'Premium claims, cosmetics, cantina',        {v:'Deposit / withdraw',cls:'num'}],
              [{v:'🥔 PP',cls:'mars'},    'Territory token (~$1)','Territory harvest, signup/referral/deposit','Territory claim/upgrade, → GP, → USDT redeem',{v:'→ GP / → USDT (capped)',cls:'num'}],
              [{v:'🏛 GP',cls:'mars'},    'Main spend currency',  'Login, missions, battles, PP→GP',          'Shop, ships (build/upgrade/repair/crate), upgrades',{v:'Bought via PP→GP',cls:'num'}],
              [{v:'⭐ XP',cls:'mars'},    'Account level',        'All activity',                            'Rank perks, fee boosts',                    {v:'✕',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'GP spends, PP stores value',
            text:'**GP is what you spend** on almost everything (shop, ships, upgrades) — you stock it from rewards and by converting PP. **PP is the value token**: you mine it, convert it to GP, or redeem it to USDT at the current operator rate (variable, within the collateral pool — not a guaranteed peg). **USDT is real money** — betting it in the casino loses real money. See [Token Economy](#tokens) §2.' },

          { type:'h2', text:'3. Win Conditions' },
          { type:'callout', variant:'pro', title:'There is no ending',
            text:'Occupy Mars is a **persistent world**. The goal isn\'t a score — it\'s to stack **territory + reputation + governance power** until you become a "Commander no one can ignore". Only rankings reset each season; territory and assets are permanent.' },

          { type:'h2', text:'4. Progression & Unlocks' },
          { type:'p', text:'The core early-game loop is **open from the start** — territory, shop, market, and campaign need no level. Advanced features unlock as your account level rises. Locked tabs show a **🔒 + required level** badge.' },
          { type:'table',
            headers:['Feature','Unlocks at'],
            rows:[
              ['Territory · Shop · Market · Campaign', {v:'Lv 1 (open)',cls:'num'}],
              ['🚢 Fleet & Shipyard',                  {v:'Lv 3',cls:'num'}],
              ['🚚 Transport',                          {v:'Lv 4',cls:'num'}],
              ['⚔ PVP',                                 {v:'Lv 6',cls:'num'}],
              ['🛡 Guild',                              {v:'Lv 8',cls:'num'}],
              ['🏛 Governance',                         {v:'Lv 10',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'Level up by playing',
            text:'Every claim, hijack, mission, and login grants XP. Just running the daily loop carries you past these gates quickly — see [Token Economy](#tokens) §4 for the XP table.' },

          { type:'h2', text:'5. First 5 Minutes Checklist' },
          { type:'p', text:'Do these in order right after launching the game for the fastest on-ramp:' },
          { type:'table',
            headers:['#','Task','Actual reward'],
            rows:[
              [{v:'1'}, 'Connect wallet & register nickname',              {v:'Free daily Ship Crate + daily login GP',cls:'num'}],
              [{v:'2'}, 'First pixel CLAIM',                                {v:'+2 XP / px',cls:'num'}],
              [{v:'3'}, 'First USDT deposit',                               {v:'+50 XP + 10% PP bonus',cls:'num'}],
              [{v:'4'}, 'Clear all free-tier daily missions',               {v:'≈ 0.1~0.3 PP + 15 XP',cls:'num'}],
              [{v:'5'}, 'Enter referral code → share your own code',       {v:'DYNASTY chain active',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'Lost? Start here',
            text:'Long-term income lives in the **daily mission routine + POI hunting + DYNASTY referrals**. Mining is just a small baseline. See [Mining & Income](#mining) §4 and [DYNASTY](#dynasty) §8 for details.' }
        ]
      },
      { id: 'tokens', icon: '🪙', title: 'Token Economy',
        blocks: [
          { type:'p', text:'Every number in the game is one of 4 assets. **Each has a distinct role and they are not fully interchangeable.** This section covers how you earn and spend each one.' },
          { type:'toc', label:'In this section', items:[
            'USDT — Real currency',
            'PP — In-game main currency',
            'GP — Governance points',
            'XP — Account level',
            'Asset flow chart (swaps & conversions)'
          ]},

          { type:'h2', text:'1. USDT — Real Currency' },
          { type:'p', text:'**Tether USD on Base chain**. Real money. Not minted by the game — only **deposited/withdrawn** from your wallet. Pixel claim **base prices** are denominated in USDT.' },
          { type:'table',
            headers:['Sector Tier','Base Price / px','After Multiplier'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× up to 3 (dynamic)',cls:'num'}],
              [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× up to 2',cls:'num'}],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Deposit bonus',
            text:'USDT deposits automatically grant a **+10% PP bonus** (`deposit_pp_bonus=10`). First deposit adds a one-time **+50 XP** bonus.' },
          { type:'callout', variant:'warn', title:'USDT is real money',
            text:'Any number with the `USDT` label is **your actual capital**. Betting USDT in the casino tab loses real money. Always play carefully.' },

          { type:'h2', text:'2. PP — Pixel Points (value token)' },
          { type:'p', text:'PP is the **territory-mining value token**, redeemable to USDT at the current operator rate (variable — not a fixed peg). New signups automatically receive a PP bonus, and deposits/referrals add more. PP is not the everyday spending currency — it is the asset you **store value in, convert to GP, or redeem to USDT**.' },
          { type:'formula', label:'PP Income Sources',
            eq:'PP = ~territory harvest~ + ~signup bonus~ + ~referral~ + ~deposit bonus~',
            note:'Passive harvest is capped at **1 PP/day per user** (`mining_daily_cap_per_user=1.0`). PP is meant to be scarce and valuable — not farmed in bulk.' },
          { type:'table',
            headers:['PP Use','Detail'],
            rows:[
              ['Claim / upgrade territory', {v:'pixel claims & territory upgrades',cls:'num'}],
              ['PP → GP convert',           {v:'dynamic rate 5–20 GP/PP',cls:'num'}],
              ['PP → USDT redeem',          {v:'within collateral room',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'PP ↔ USDT redemption',
            text:'The `SWAP` tab converts PP to USDT (and back). **Redemption is only allowed within the operator-funded collateral pool** — there is no unlimited cash-out. See [PP ⇄ USDT Swap](#exchange) for the bank-run protection rule.' },

          { type:'h2', text:'3. GP — Game Points (main spend currency)' },
          { type:'p', text:'GP is the **primary in-game spending currency**. It pays for the shop, ship build/upgrade/repair, ship crates, territory upgrades, market fees, governance actions, and more. You earn GP from gameplay **and by converting PP → GP**.' },
          { type:'table',
            headers:['Source','Details'],
            rows:[
              ['Daily login / missions',  {v:'login + 3 dailies',cls:'num'}],
              ['POI drop (70% weight)',   {v:'10 ~ 50 GP / POI',cls:'num'}],
              ['Rocket drop (50% weight)',{v:'10 ~ 40 GP / drop',cls:'num'}],
              ['Battles / expeditions',   {v:'reward per ship destroyed',cls:'num'}],
              ['PP → GP conversion',      {v:'5–20 GP per PP (dynamic)',cls:'num'}],
              ['Sector tax / governor',   {v:'recurring sector income',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'Top up GP by converting PP',
            text:'When you run short on GP for a build or upgrade, convert some PP → GP in the `SWAP`/exchange tab. The rate floats between 5 and 20 GP per PP depending on demand. See [PP → GP Exchange](#exchange) §1.' },

          { type:'h2', text:'4. XP & Rank' },
          { type:'p', text:'**Every activity** gains XP. Sample rank table (30 levels total — partial view):' },
          { type:'table',
            headers:['Lv','Name','Required XP','Rank-up Reward'],
            rows:[
              [{v:'1',cls:'num'},  'Dust Walker',    {v:'0',cls:'num'},       {v:'—',cls:'num'}],
              [{v:'5',cls:'num'},  'Storm Chaser',   {v:'1,600',cls:'num'},   {v:'+18 PP',cls:'num'}],
              [{v:'10',cls:'num'}, 'Lava Walker',    {v:'12,500',cls:'num'},  {v:'+85 PP',cls:'num'}],
              [{v:'15',cls:'num'}, 'Storm Commander',{v:'42,000',cls:'num'},  {v:'+260 PP',cls:'num'}],
              [{v:'20',cls:'num'}, 'God of Mars',    {v:'100,000',cls:'num'}, {v:'+700 PP',cls:'num'}],
              [{v:'25',cls:'num'}, 'Crimson Archon', {v:'260,000',cls:'num'}, {v:'+2,000 PP',cls:'num'}],
              [{v:'30',cls:'num'}, 'Architect of Worlds', {v:'1,000,000',cls:'num'}, {v:'+6,000 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'XP amounts',
            text:'`xp_per_claim=2/px`, `xp_per_hijack=3/px`, daily mission `5 XP`, weekly mission `30 XP`, daily login `5 XP`, first deposit `50 XP`, territory 1-week defense `1 XP/px`.' },
          { type:'callout', variant:'pro', title:'Rank-up gates',
            text:'Levels 5, 10, 15, 20, 25 have **activity requirements** beyond raw XP (pixels held, days played, hijacks, deposits, etc.). You can\'t brute-force them with XP alone.' },

          { type:'h2', text:'5. Asset Flow Chart' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" font-family="monospace">'+
              '<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
              '<rect x="30"  y="30" width="110" height="50" rx="6" fill="rgba(91,184,232,.1)" stroke="#5bb8e8" stroke-width="1.5"/>'+
              '<text x="85"  y="55" text-anchor="middle" font-size="12" fill="#5bb8e8" font-weight="700">USDT</text>'+
              '<text x="85"  y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"実通貨":typeof LANG!=="undefined"&&LANG==="zh"?"真实货币":typeof LANG!=="undefined"&&LANG==="ko"?"실제 화폐":"Real Money")+'</text>'+
              '<rect x="195" y="30" width="110" height="50" rx="6" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/>'+
              '<text x="250" y="55" text-anchor="middle" font-size="12" fill="#ff783c" font-weight="700">PP</text>'+
              '<text x="250" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"価値トークン~$1":typeof LANG!=="undefined"&&LANG==="zh"?"价值代币~$1":typeof LANG!=="undefined"&&LANG==="ko"?"가치 토큰 ~$1":"Value Token ~$1")+'</text>'+
              '<rect x="360" y="30" width="110" height="50" rx="6" fill="rgba(255,209,102,.1)" stroke="#ffd166" stroke-width="1.5"/>'+
              '<text x="415" y="55" text-anchor="middle" font-size="12" fill="#ffd166" font-weight="700">GP</text>'+
              '<text x="415" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"主要消費通貨":typeof LANG!=="undefined"&&LANG==="zh"?"主要消费货币":typeof LANG!=="undefined"&&LANG==="ko"?"주 소비 통화":"Main Spend Currency")+'</text>'+
              '<line x1="140" y1="55" x2="190" y2="55" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="165" y="48" text-anchor="middle" font-size="8" fill="#ff783c">'+( typeof LANG!=="undefined"&&LANG==="ja"?"換金":typeof LANG!=="undefined"&&LANG==="zh"?"兑换":typeof LANG!=="undefined"&&LANG==="ko"?"환금":"REDEEM")+'</text>'+
              '<line x1="190" y1="60" x2="140" y2="60" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)" stroke-dasharray="3,3"/>'+
              '<line x1="305" y1="55" x2="355" y2="55" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="330" y="48" text-anchor="middle" font-size="8" fill="#ffd166">'+( typeof LANG!=="undefined"&&LANG==="ja"?"PP→GP 5-20":typeof LANG!=="undefined"&&LANG==="zh"?"PP→GP 5-20":typeof LANG!=="undefined"&&LANG==="ko"?"PP→GP 5-20":"PP→GP 5-20")+'</text>'+
              '<text x="250" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"領土採掘・ボーナス ↓":typeof LANG!=="undefined"&&LANG==="zh"?"领地采矿·奖励 ↓":typeof LANG!=="undefined"&&LANG==="ko"?"영토 채굴·보너스 ↓":"Territory Harvest·Bonus ↓")+'</text>'+
              '<line x1="250" y1="125" x2="250" y2="80" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="415" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"ログイン・任務・戦闘 ↓":typeof LANG!=="undefined"&&LANG==="zh"?"登录·任务·战斗 ↓":typeof LANG!=="undefined"&&LANG==="ko"?"로그인·미션·전투 ↓":"Login·Mission·Battle ↓")+'</text>'+
              '<line x1="415" y1="125" x2="415" y2="80" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="85"  y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">'+( typeof LANG!=="undefined"&&LANG==="ja"?"入金 ↓":typeof LANG!=="undefined"&&LANG==="zh"?"入款 ↓":typeof LANG!=="undefined"&&LANG==="ko"?"입금 ↓":"Deposit ↓")+'</text>'+
              '<line x1="85"  y1="125" x2="85"  y2="80" stroke="#5bb8e8" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="250" y="160" text-anchor="middle" font-size="9" fill="#ff783c" letter-spacing="1">ASSET FLOW — USDT ⇄ PP → GP ('+( typeof LANG!=="undefined"&&LANG==="ja"?"PP→GPは動的レート":typeof LANG!=="undefined"&&LANG==="zh"?"PP→GP动态汇率":typeof LANG!=="undefined"&&LANG==="ko"?"PP→GP 동적 환율":"dynamic PP→GP rate")+')</text>'+
            '</svg>',
            caption:'USDT ⇄ PP (redeem within collateral) / PP → GP at a dynamic 5–20 rate' }
        ]
      },
      { id: 'wallet', icon: '🔐', title: 'Wallet & Custody',
        blocks: [
          { type:'p', text:'You do **not** need MetaMask or any external wallet to play. When you sign up with email, the game **automatically creates a real wallet (key pair)** for you. That wallet holds your on-chain assets and is what every game action is tied to.' },
          { type:'toc', label:'In this section', items:[
            'Auto-generated wallet',
            'Viewing & backing up your private key',
            'Your custody responsibility',
            'Deposits & withdrawals'
          ]},

          { type:'h2', text:'1. Auto-Generated Wallet' },
          { type:'p', text:'On email signup the game generates a genuine **key pair** for you behind the scenes — no browser extension, no separate wallet app, no seed-phrase setup required. You can start claiming territory and earning straight away.' },
          { type:'callout', variant:'info', title:'No MetaMask needed',
            text:'A real wallet is provisioned for you automatically. The address it produces is your in-game identity and the destination for deposits.' },

          { type:'h2', text:'2. View & Back Up Your Private Key' },
          { type:'p', text:'You can **view and back up your own private key** at any time. Open the **wallet panel in BASE**, press the **🔑 KEY** button, and re-enter your password to confirm — the key is then revealed for you to copy and store safely.' },
          { type:'callout', variant:'tip', title:'Back it up offline',
            text:'Copy the key into offline, secure storage (e.g. a written note in a safe, or an encrypted offline file). This is the only thing that can restore access to your assets.' },

          { type:'h2', text:'3. Your Custody Responsibility' },
          { type:'callout', variant:'warn', title:'⚠ You alone are responsible for your key',
            text:'Custody of your private key is **entirely your own responsibility**. If it is lost or stolen, **the operator cannot recover your key or your assets** — there is no reset and no backdoor. Keep the key offline, store it securely, and **never share it with anyone**, including anyone claiming to be support staff.' },

          { type:'h2', text:'4. Deposits & Withdrawals' },
          { type:'p', text:'Funding your account uses your auto-generated wallet:' },
          { type:'table',
            headers:['Action','How it works'],
            rows:[
              ['USDT deposit',  {v:'Auto-detected, credited to game balance',cls:'num'}],
              ['Withdrawal',    {v:'Goes through security checks (password / signature)',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Deposits are detected automatically',
            text:'USDT sent to your wallet on Base chain is **detected automatically** and reflected in your game balance. **Withdrawals pass through a security flow** (password / signature) before they are released.' }
        ]
      },
      { id: 'territory', icon: '🏴', title: 'Territory',
        blocks: [
          { type:'p', text:'Buying **pixels** on the Mars surface is where this game starts. A single claim picks a rectangular region, uploads your image, and plants your flag.' },
          { type:'toc', label:'In this section', items:[
            'Claim basics',
            'Per-tier pricing',
            'Hijack (territory theft)',
            'Shields (defense)',
            'Image upload limits',
            'Territory rename',
            'Condition, grade & TEND'
          ]},

          { type:'h2', text:'1. Claim Basics' },
          { type:'p', text:'Press `CLAIM`, drag a rectangle on the globe → upload an image → pay. One transaction holds up to **500×500 px** (`max_claim_width=500`, `max_claim_height=500`).' },
          { type:'callout', variant:'info', title:'Pixels are permanent',
            text:'Once purchased, a pixel **survives season resets**. It remains a permanent asset until you\'re hijacked or abandon it yourself.' },

          { type:'h2', text:'2. Per-Tier Pricing' },
          { type:'p', text:'The Mars surface is split into 3 tiers. More central = more expensive, but harvest cycles are faster.' },
          { type:'table',
            headers:['Tier','Base Price / px','Dynamic Multiplier','Traits'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× up to 3.0',cls:'num'}, 'Harvest 24h · hijack targets'],
              [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× up to 2.0',cls:'num'}, 'Harvest 48h · balanced'],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1.0',cls:'num'},       'Harvest 72h · outer rim']
            ]},
          { type:'callout', variant:'tip', title:'Prices move with demand',
            text:'Each tier uses a **dynamic multiplier**. The more pixels already sold in a sector, the higher the price — up to 3× base. To buy cheap, hunt inactive sectors.' },

          { type:'h2', text:'3. Hijack — Territory Theft' },
          { type:'p', text:'Claiming on top of someone else\'s pixels is a **hijack**. You pay **1.2×** the original price to take it over (`hijack_multiplier=1.2`).' },
          { type:'table',
            headers:['Item','Value','Note'],
            rows:[
              ['Base multiplier',     {v:'× 1.2',cls:'num'},    'Pay 1.2× the prior owner\'s cost'],
              ['Defender refund',     {v:'+50 %',cls:'num'},    '50% of hijack cost returned as bonus'],
              ['Shield absorption',   {v:'50 ~ 75 %',cls:'num'},'Active shields absorb damage']
            ]},
          { type:'callout', variant:'warn', title:'⚠ Ship full-loss in hijack battles',
            text:'Hijacks can escalate into **fleet battles**, and ships sunk there (HP 0) are **permanently destroyed** — they cannot be revived and must be rebuilt at the shipyard (`hijack_ship_loss_enabled=true`). Never bring ships you can\'t afford to lose. See [Fleet & Shipyard](#fleet) for build/repair.' },
          { type:'callout', variant:'warn', title:'Careless hijacks are expensive',
            text:'Hijacks in pricey CORE sectors quickly hit tens of USDT. The best targets are **large territories inactive for 1+ weeks**. Hijacking tiny plots just burns your fees.' },
          { type:'callout', variant:'pro', title:'Hijacks also score season points',
            text:'Every hijacked pixel = `xp_per_hijack=3 XP`. The top of the season leaderboard is full of hijack experts.' },

          { type:'h2', text:'4. Shields — Defense Items' },
          { type:'p', text:'Equipped shields **absorb** a % of hijack damage. Buy them in the shop with PP or USDT.' },
          { type:'table',
            headers:['Item','Cost','Duration','Absorption'],
            rows:[
              [{v:'⚡ Energy Shield',cls:'mars'},{v:'2.5 PP / 2.5 USDT',cls:'num'}, {v:'12 hours',cls:'num'}, {v:'50 %',cls:'num'}],
              [{v:'💠 Plasma Shield',cls:'mars'},{v:'5.0 PP / 5.0 USDT',cls:'num'}, {v:'24 hours',cls:'num'}, {v:'75 %',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Always run a 12h Energy Shield',
            text:'2.5 PP cuts hijack damage in half. One daily mission reward covers a shield — keeping one on 24/7 is the norm.' },

          { type:'h2', text:'5. Image Upload Limits' },
          { type:'table',
            headers:['Item','Limit','Note'],
            rows:[
              ['Max size', {v:'5 MB',cls:'num'},                 '`max_image_size_mb=5`'],
              ['Formats',  {v:'PNG · JPG · GIF · WEBP',cls:'num'},'Animated GIF supported'],
              ['Link URL', {v:'https:// only',cls:'num'},         'HTTP blocked for security']
            ]},
          { type:'callout', variant:'tip', title:'Animated GIFs play on hover',
            text:'Animated GIFs play back when your territory is hovered on the globe. For high-value plots, motion stands out.' },

          { type:'h2', text:'6. Territory Rename' },
          { type:'p', text:'Clicking a territory pops the info modal, where you can set a **custom name** cheaply.' },
          { type:'table',
            headers:['Item','Cost'],
            rows:[
              ['Territory rename', {v:'0.3 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'Names are guild & hijack psychology',
            text:'A name like "Do Not Hijack — Woo\'s HQ" actually reduces hijack attempts. Community-minded players usually leave named territories alone.' },

          { type:'h2', text:'7. Condition, Grade & TEND' },
          { type:'p', text:'Every territory carries a **condition (0–100, an HP gauge)** and a **grade (F → S)**. Condition **decays a little each day**, so a territory you never touch slowly slides down the grade ladder. Open the territory **PRODUCTION** panel to see the HP bar and grade badge.' },
          { type:'table',
            headers:['Grade','Harvest PP','Mineral drop'],
            rows:[
              [{v:'S',cls:'mars'}, {v:'× 1.50',cls:'num'}, {v:'× 1.50',cls:'num'}],
              [{v:'A',cls:'mars'}, {v:'× 1.25',cls:'num'}, {v:'× 1.30',cls:'num'}],
              [{v:'B',cls:'mars'}, {v:'× 1.10',cls:'num'}, {v:'× 1.15',cls:'num'}],
              [{v:'C',cls:'mars'}, {v:'× 1.00',cls:'num'}, {v:'× 1.00',cls:'num'}],
              [{v:'D',cls:'mars'}, {v:'× 0.85',cls:'num'}, {v:'× 0.90',cls:'num'}],
              [{v:'F',cls:'mars'}, {v:'× 0.60',cls:'num'}, {v:'× 0.75',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'🔧 TEND keeps the income flowing',
            text:'The **🔧 TEND** button in the PRODUCTION panel spends GP to restore condition and lift the grade back up. Because **higher grade means more harvest PP and more mineral drops**, regularly tending your best plots pays for itself. Let a territory rot to grade F and it earns barely over half of its potential.' }
        ]
      },
      { id: 'mining', icon: '⛏', title: 'Mining & Income',
        blocks: [
          { type:'p', text:'There are 5 ways to earn PP (Potato Points) on Mars. **Passive mining** is a stable baseline, but **the returns are small**. The real money comes from POIs, rockets, daily missions, and DYNASTY commission.' },
          { type:'toc', label:'In this section', items:[
            'Passive mining formula (real numbers)',
            'Yield per pixel count',
            'Per-tier harvest cycles',
            'POIs (resource points)',
            'Rocket events',
            'Daily missions',
            'Commission income (DYNASTY)'
          ]},

          { type:'h2', text:'0. How to Harvest' },
          { type:'p', text:'Go to BASE → **내 영토** tab. Tap any territory row to expand it, then press `⛏ 수확` to harvest **that territory individually**. Each territory has its own cooldown (CORE=24h, MID=48h, FRONTIER=72h).' },

          { type:'h2', text:'1. Passive Mining Formula' },
          { type:'p', text:'As long as you hold territory, **PP accumulates automatically** each cycle. Collect it via the territory list — each territory has its own harvest button and cooldown timer.' },
          { type:'formula', label:'HARVEST YIELD PER CYCLE',
            eq:'Yield = rand(~0.01~, ~0.5~) × min( ~√pixels~ ÷ 10, ~3.0~ )   →   max ~1.0 PP~ / harvest',
            note:'Key: **square-root scaling + 3× cap + 1 PP ceiling per harvest**. Buying 10,000× more pixels only triples your income. Anti-whale design.' },
          { type:'callout', variant:'warn', title:'Important — pixels don\'t scale infinitely',
            text:'`pixelFactor` is √pixels/10 — a **square root**. 1 px → 0.1, 100 → 1.0, 1,000 → 3.0 (cap). Beyond 1,000 pixels, **every extra pixel adds zero mining income**. Buying land just to mine is waste.' },
          { type:'callout', variant:'info', title:'Tier multipliers affect "cycle" only',
            text:'CORE/MID/FRONTIER differ in **harvest cycle** (24h / 48h / 72h), not the reward amount. Territories spanning multiple tiers adopt the best cycle (CORE > MID > FRONTIER).' },

          { type:'h2', text:'2. Yield per Pixel Count (average)' },
          { type:'table',
            headers:['Pixels','pixelFactor','Per cycle avg','CORE daily','FRONTIER daily'],
            rows:[
              [{v:'1 px'},      {v:'0.10',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.009 PP',cls:'num'}],
              [{v:'10 px'},     {v:'0.32',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.027 PP',cls:'num'}],
              [{v:'100 px'},    {v:'1.00',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.085 PP',cls:'num'}],
              [{v:'1,000 px'},  {v:'3.00 (cap)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}],
              [{v:'10,000 px'}, {v:'3.00 (cap)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Hard cap',
            text:'Governor +20%, sector buff +20%, Double Mining ×2, weather, Starlink, items — all stack multiplicatively, but the final value is capped at **1.0 PP per harvest**. Even top players earn at most **~1 PP/day** from passive mining.' },
          { type:'callout', variant:'pro', title:'Pro tip',
            text:'You can\'t reach the top by mining alone. Passive mining is "living expense" level. Real growth comes from **POI hunting + daily missions + DYNASTY commission**. Read on.' },

          { type:'h2', text:'3. Per-tier Harvest Cycles' },
          { type:'table',
            headers:['Tier','Harvest cycle','Harvests per day','Notes'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'24 h',cls:'num'}, {v:'1',cls:'num'},    'Center — high traffic, hijack target'],
              [{v:'🟡 MID',cls:'mars'},      {v:'48 h',cls:'num'}, {v:'0.5',cls:'num'},  'Middle — balanced'],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'72 h',cls:'num'}, {v:'0.33',cls:'num'}, 'Outer — cheap but slow']
            ]},
          { type:'callout', variant:'tip', title:'3× efficiency for the same area',
            text:'CORE 1 px + FRONTIER 999 px > FRONTIER 1,000 px. The 24h cycle triggers **3× more harvests for the same area**. Anchoring with a cheap CORE cell is standard practice.' },

          { type:'h2', text:'3. POI — Resource Points' },
          { type:'p', text:'**Resource points** spawn randomly on the Mars surface. Open the `EXPLORE` tab map, travel there, press `🔍 DISCOVER` to collect. **No territory required — anyone can grab them, first-come-first-served.**' },
          { type:'table',
            headers:['Item','Value','Source'],
            rows:[
              ['Spawn interval',         {v:'every 4 hours',cls:'num'},             '`poi_spawn_interval_hours=4`'],
              ['Count per cycle',         {v:'6 (max 12 active)',cls:'num'},         '`poi_count_per_cycle=6, poi_max_active=12`'],
              ['Expiry',                  {v:'12 hours',cls:'num'},                  '`poi_expire_hours=12`'],
              ['Exploration fee',         {v:'admin-set (default 0 PP)',cls:'num'},  '`exploration_fee_pp`'],
              ['Discovery XP bonus',      {v:'+5 XP',cls:'num'},                     '`poi_discovery_xp=5`']
            ]},
          { type:'h2', text:'POI Drop Table (actual weights)' },
          { type:'table',
            headers:['Drop Type','Weight','Range','Note'],
            rows:[
              [{v:'🏛 GP',cls:'mars'},        {v:'70 %',cls:'num'}, {v:'10 ~ 50 GP',cls:'num'},      'Most common'],
              [{v:'📦 Items',cls:'mars'},     {v:'20 %',cls:'num'}, {v:'random drop table',cls:'num'},'Shields, boosts, etc.'],
              [{v:'🥔 PP',cls:'mars'},        {v:'10 %',cls:'num'}, {v:'0.05 ~ 0.3 PP',cls:'num'},    'Rarest'],
              [{v:'✨ Cosmetic',cls:'mars'},  {v:'+5 %',cls:'num'}, {v:'extra roll on top',cls:'num'},'Bonus on every discovery']
            ]},
          { type:'callout', variant:'info', title:'Scale correction',
            text:'Rewards auto-scale with **active player count** — +10% per 10 players, up to ×3. More players = bigger rewards.' },
          { type:'callout', variant:'pro', title:'POIs are the most active income source',
            text:'Mining is barely 1 PP/day, but POIs drop **big GP** rewards. Grabbing a few out of the 6 POIs in 12 hours nets dozens of GP. GP converts into governor elections and sector taxes, so it\'s long-term income.' },

          { type:'h2', text:'4. Rocket Events' },
          { type:'p', text:'**Every 12 hours**, a rocket lands at a random location and scatters massive loot. 2-hour warning → 1-hour looting window. 5% chance of `RUD` (explosion) — 2× loot, 2× radius.' },
          { type:'table',
            headers:['Drop','Weight','Value','Note'],
            rows:[
              [{v:'🏛 GP',cls:'mars'},          {v:'50 %',cls:'num'}, {v:'10 ~ 40 GP',cls:'num'}, 'Most common'],
              [{v:'📦 Items',cls:'mars'},       {v:'25 %',cls:'num'}, 'drop table',               'Shields, boosts'],
              [{v:'⭐ XP',cls:'mars'},          {v:'17 %',cls:'num'}, {v:'5 ~ 25 XP',cls:'num'},  '—'],
              [{v:'🥔 PP',cls:'mars'},          {v:'6 %',cls:'num'},  {v:'0.02 ~ 0.1 PP',cls:'num'}, 'Rare'],
              [{v:'🚀 Starship Border',cls:'mars'}, {v:'2 %',cls:'num'},  {v:'1',cls:'num'},       'Limited cosmetic']
            ]},
          { type:'callout', variant:'warn', title:'RUD is a jackpot, but…',
            text:'The 5% **RUD (Rapid Unscheduled Disassembly)** = explosion. Normal 15 → RUD 30 drops. Radius 5km → 10km. Expect competitors to swarm — come prepared.' },

          { type:'h2', text:'5. Daily Missions' },
          { type:'p', text:'Quests reset daily. Split into free / activity / spend tiers; completing them grants PP + XP. Completion XP is a flat **5 XP/mission** (weekly quests pay 30 XP).' },
          { type:'table',
            headers:['Tier','Example','Reward Range'],
            rows:[
              ['💫 Free',     'Login / view sector / first pixel',          {v:'0.01 ~ 0.05 PP',cls:'num'}],
              ['⚡ Activity', 'Claim / harvest / explore / login streak',    {v:'0.05 ~ 0.50 PP',cls:'num'}],
              ['💎 Spend',    'Deposit / premium claim / swap / expansion', {v:'0.30 ~ 1.50 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'5 minutes a day, guaranteed income',
            text:'Daily missions are **guaranteed rewards**. Upper-tier missions pay more PP and XP than mining does. Your rank-up speed is decided by quests.' },

          { type:'h2', text:'6. Commission Income (DYNASTY)' },
          { type:'p', text:'Refer a player and you earn commission from **6 activities** they do (deposit · swap · shop · harvest · cantina · hijack) — automatically deposited to your wallet. 3-tier MLM structure, so friends-of-friends-of-friends also pay out.' },
          { type:'callout', variant:'pro', title:'This is the biggest income long-term',
            text:'Territory and mining are linear (you earn what you work), but **DYNASTY is a network effect**. Inviting 5 active users will eventually make your passive PP exceed your personal mining. See [DYNASTY / Referral](#dynasty) §8 for details.' }
        ]
      },
      { id: 'fleet', icon: '🚢', title: 'Fleet & Shipyard',
        blocks: [
          { type:'p', text:'Ships are **real, losable capital**. You build them at the shipyard, upgrade and repair them with GP and minerals, open ship crates for a chance at rare hulls, and trade them on the ship market. In hijack battles, ships can be **permanently destroyed**.' },
          { type:'toc', label:'In this section', items:[
            'Ship roster & factions',
            'Shipyard — build & repair',
            'Stat upgrades',
            'Ship Crate (gacha)',
            'Ship market (regional)',
            'Full-loss warning'
          ]},

          { type:'h2', text:'1. Ship Roster & Factions' },
          { type:'p', text:'There are **22 ship types** across 3 factions (MCC / FSP / CV), in 5 size classes. Bigger hulls hit harder and tank more, but cost rarer Core/Mid minerals. Titans are server-capped (max 3 alive per type).' },
          { type:'table',
            headers:['Class','Role','Build cost tier'],
            rows:[
              [{v:'Frigate',cls:'mars'},    'Fast tackle / EW',          {v:'low',cls:'num'}],
              [{v:'Destroyer',cls:'mars'},  'Skirmish damage',           {v:'low–mid',cls:'num'}],
              [{v:'Cruiser',cls:'mars'},    'Flexible mainline',         {v:'mid',cls:'num'}],
              [{v:'Battleship',cls:'mars'}, 'Heavy line — Core/Mid mats',{v:'high',cls:'num'}],
              [{v:'Titan',cls:'mars'},      'Capital — server-capped',   {v:'highest',cls:'num'}]
            ]},

          { type:'h2', text:'2. Shipyard — Build & Repair' },
          { type:'p', text:'Open `Shipyard` to see blueprints. Each card shows GP + mineral cost as **have / need**, and a ⛏ badge for which sector tier drops each required mineral. Building queues a `ship_build_job`; the ship lands in your default fleet.' },
          { type:'table',
            headers:['Action','Cost','Note'],
            rows:[
              ['Build', {v:'GP + minerals',cls:'num'}, 'BS/Titan need Core + Mid mats'],
              ['Repair',{v:'GP + minerals',cls:'num'}, 'Restores HP after battle'],
              ['Shield',{v:'GP',cls:'num'},            'Pre-battle damage absorption'],
              ['Scrap', {v:'—',cls:'num'},             'Dismantle for partial return']
            ]},
          { type:'callout', variant:'info', title:'Listed ships are locked',
            text:'A ship listed on the market (`is_market_listed`) cannot be upgraded, repaired, shielded, scrapped, or moved between fleets until you cancel the listing.' },
          { type:'callout', variant:'tip', title:'New players can build early',
            text:'After a balance pass, **frontier sectors now also drop some tier-2 crafting materials** — so you can build your first real ship from cheap outer-rim land without owning premium CORE territory.' },

          { type:'h2', text:'3. Stat Upgrades' },
          { type:'p', text:'Owned ships can be **permanently upgraded** in `atk / def / hp / speed`. Upgrades have a **success chance** and consume GP + materials on both success and failure. Cost scales with total investment count.' },
          { type:'callout', variant:'pro', title:'Upgrades are probabilistic',
            text:'A failed roll still burns GP and materials — only a success adds the stat bonus. The combat engine reads `bonus_atk/def/hp/speed` directly, so upgrades matter in real battles.' },

          { type:'h2', text:'4. Ship Crate (gacha)' },
          { type:'p', text:'Open ship crates with **GP** for a random ship by size class. Every crate has **published odds**, and Premium/Legendary crates carry a **pity ceiling** that guarantees a Cruiser-or-better once you hit the pull count.' },
          { type:'table',
            headers:['Crate','Price','Pity','Top hull'],
            rows:[
              [{v:'📦 Standard',cls:'mars'},  {v:'300 GP',cls:'num'},  {v:'—',cls:'num'},        'Cruiser'],
              [{v:'🎁 Premium',cls:'mars'},   {v:'1,000 GP',cls:'num'},{v:'10 pulls',cls:'num'}, 'Battleship'],
              [{v:'🌟 Legendary',cls:'mars'}, {v:'3,000 GP',cls:'num'},{v:'5 pulls',cls:'num'},  'Titan']
            ]},
          { type:'callout', variant:'info', title:'Server RNG + Titan cap',
            text:'Rolls use server-authoritative RNG. If the Titan server cap is full, a Titan roll is downgraded to a Battleship. Odds are shown on each crate card.' },

          { type:'h2', text:'5. Ship Market (regional)' },
          { type:'p', text:'List ships with `list → buy → cancel`. Each listing is bound to the **seller’s home sector**: buying can incur a **tariff to that sector’s governor**, and operators may optionally restrict purchases to the same sector — making sectors into trade hubs and creating arbitrage between them.' },
          { type:'callout', variant:'tip', title:'Watch the sector tariff',
            text:'A listing in a high-tax CORE sector costs the buyer extra. Cheaper deals often sit in low-tax frontier sectors — at the cost of logistics.' },

          { type:'h2', text:'6. ⚠ Full-Loss Warning' },
          { type:'callout', variant:'warn', title:'Sunk ships are gone for good',
            text:'With full-loss live (`hijack_ship_loss_enabled=true`), any ship reduced to **HP 0 in a hijack battle is permanently destroyed** — `is_alive=false`, no revival. You must rebuild it at the shipyard. Only commit a fleet you are willing to lose, and keep reserves + minerals for rebuilds.' }
        ]
      },
      { id: 'governance', icon: '🏛', title: 'Governance',
        blocks: [
          { type:'p', text:'Mars runs on a **two-layer power structure**. A single global **Commander** and one **Governor** per sector. Both can change real game rules — taxes, authorizations, event triggers. Governance is a real shipped feature — not decorative.' },
          { type:'toc', label:'In this section', items:[
            'Power structure (Commander / Governor)',
            'Sector tax and distribution',
            'Sector buffs (governor powers)',
            'Global events (commander powers)',
            'Bounty system',
            'GP for governance'
          ]},

          { type:'h2', text:'1. Power Structure' },
          { type:'table',
            headers:['Role','Scope','Count','Powers'],
            rows:[
              [{v:'👑 Commander',cls:'mars'},     'Global', {v:'1',cls:'num'}, 'Global events, announcements, bounties'],
              [{v:'⚔ Vice Commander',cls:'mars'}, 'Global', {v:'1',cls:'num'}, 'Acts when Commander is absent'],
              [{v:'🏛 Governor',cls:'mars'},      'Sector', {v:'1 per sector',cls:'num'}, 'Sector tax rate, buffs, tax revenue'],
              [{v:'⚖ Vice Governor',cls:'mars'}, 'Sector', {v:'1 per sector',cls:'num'}, 'Receives 20% of tax']
            ]},
          { type:'callout', variant:'info', title:'Election method',
            text:'Each role goes to the **highest GP holder**. Keep stacking GP and you can unseat any position at any time — it\'s a continuous election.' },

          { type:'h2', text:'2. Sector Tax and Distribution' },
          { type:'p', text:'The governor taxes **claim fees** in their sector. The tax rate can be adjusted by the governor within the admin-set range.' },
          { type:'table',
            headers:['Item','Value'],
            rows:[
              ['Tax range',          {v:'1 ~ 5 %',cls:'num'}],
              ['Default rate',       {v:'2 %',cls:'num'}],
              ['Governor share',     {v:'70 %',cls:'num'}],
              ['Vice Governor share',{v:'20 %',cls:'num'}],
              ['Sector pool',        {v:'10 %',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'High-traffic sector = income machine',
            text:'Govern a popular sector and tax revenue rolls in passively. Every claim auto-settles to you. Even 1% tax on a CORE sector can pile up hundreds of USDT.' },

          { type:'h2', text:'3. Sector Buffs — Governor Powers' },
          { type:'p', text:'Governors burn GP to apply sector-wide buffs. Not just for themselves — **every resident benefits**. Popular campaign promise.' },
          { type:'table',
            headers:['Buff','Effect','Cost (GP)'],
            rows:[
              ['⛏ Mining Boost',  'Sector mining yield +20%',      {v:'100 ~ 150',cls:'num'}],
              ['🛡 Defense Bonus', 'Shield absorption increased',   {v:'100 ~ 150',cls:'num'}],
              ['💰 Claim Discount','New claims discounted in sector',{v:'100 ~ 150',cls:'num'}]
            ]},

          { type:'h2', text:'4. Global Events — Commander Powers' },
          { type:'p', text:'The commander can trigger **1 global event per day**. Only one active at a time, expensive in GP, but affects all of Mars.' },
          { type:'table',
            headers:['Event','Effect','Cost (GP)'],
            rows:[
              ['⚡ Double Mining', 'Global harvest × 2',         {v:'300 ~ 500',cls:'num'}],
              ['⚔ War Time',       'Hijack XP and rewards up',    {v:'300 ~ 500',cls:'num'}],
              ['🕊 Peace Treaty',   'Hijacks frozen temporarily',  {v:'300 ~ 500',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'1-per-day cap',
            text:'`max_global_events_per_day=1`. No matter how much GP, commanders trigger only one event per day. Timing is strategy.' },

          { type:'h2', text:'5. Bounty System' },
          { type:'p', text:'Commanders and governors can post **bounties** on specific players. The first player to hijack the target claims the full reward.' },
          { type:'table',
            headers:['Item','Value'],
            rows:[
              ['Issuers',       'Commander · Governor'],
              ['Reward type',   'GP + optional PP'],
              ['States',        'active → claimed / expired / cancelled'],
              ['Expiry',        'set at posting']
            ]},
          { type:'callout', variant:'pro', title:'Bounties are a political tool',
            text:'Want to destabilize a rival governor? Post bounties on their core territories. Once players swarm in, that governor is too busy defending to collect taxes.' },

          { type:'h2', text:'6. GP for Governance' },
          { type:'p', text:'Governance runs on GP — the main spend currency. You stack it from gameplay rewards **and by converting PP → GP** (dynamic 5–20 rate), then spend it on elections, sector control, and buffs. GP cannot be redeemed back to PP or USDT.' },
          { type:'table',
            headers:['GP Source','Typical Reward'],
            rows:[
              ['Daily login (7-day cycle)',   {v:'5 ~ 100 GP',cls:'num'}],
              ['Daily missions (3/day)',      {v:'10 ~ 25 GP each',cls:'num'}],
              ['Complete all 3 dailies',      {v:'+50 GP',cls:'num'}],
              ['POI discovery',               {v:'10 ~ 50 GP',cls:'num'}],
              ['Season ranking rewards',      {v:'500 ~ 5000 GP',cls:'num'}],
              ['Rocket drops',                {v:'10 ~ 40 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'Fastest path to Governor',
            text:'Daily login + 3 missions + a few POIs easily nets ~100 GP a day. That\'s 3,000 GP a month — enough to unseat a low-traffic sector governor.' }
        ]
      },
      { id: 'ops', icon: '🚀', title: 'OPS Missions',
        blocks: [
          { type:'p', text:'OPS Missions are your military operations hub. Launch **Invasion (⚔)** or **Exploration (🛰)** sorties from your merged territory launch pads. Invasions raid another player\'s territory for PP, GP, and XP; Explorations fire probes at coordinates to discover PP, XP, and rare items.' },
          { type:'toc', label:'In this section', items:[
            'What are OPS Missions',
            'Launch Pads',
            'Mission Tiers',
            'Rewards',
            'Target Deduplication',
            'Tips'
          ]},

          { type:'h2', text:'1. What Are OPS Missions?' },
          { type:'p', text:'Your merged territories serve as launch pads. Each merged region = 1 launch pad, and from each pad you can deploy two types of military operations:' },
          { type:'table',
            headers:['Type','Icon','Target','Rewards'],
            rows:[
              [{v:'Invasion',cls:'mars'}, '⚔', 'Another player\'s territory', 'PP + GP + XP'],
              [{v:'Exploration',cls:'mars'}, '🛰', 'Coordinate probe', 'PP + XP + rare items']
            ]},
          { type:'callout', variant:'info', title:'Two sortie modes',
            text:'Invasion is direct PvP — strike an enemy territory and loot their resources. Exploration is PvE — launch a probe to specified coordinates and discover rewards. Each carries different risk-reward profiles.' },

          { type:'h2', text:'2. Launch Pads' },
          { type:'p', text:'Each merged territory automatically becomes a launch pad. Bigger pads = higher reward multiplier.' },
          { type:'table',
            headers:['Attribute','Details'],
            rows:[
              ['Pad source',        '1 merged territory = 1 launch pad'],
              ['Size multiplier',   {v:'×0.5 ~ ×3.0',cls:'num'}],
              ['Multiplier formula', '√(pixels / 25), clamped to min/max'],
              ['Concurrency limit',  '1 active mission per pad at a time']
            ]},
          { type:'callout', variant:'pro', title:'Bigger territory = bigger multiplier',
            text:'A sufficiently large merged territory hits ×3.0 — triple rewards on every sortie. Building massive merged territories is the core strategy for maximizing OPS income.' },

          { type:'h2', text:'3. Mission Tiers' },
          { type:'p', text:'Missions are tiered by distance to target. Farther = more expensive and slower, but with better rewards on success.' },
          { type:'table',
            headers:['Tier','Distance','Cost (PP)','Duration','Success Rate'],
            rows:[
              [{v:'NEAR',cls:'mars'}, '< 30°',   {v:'0.2 (inv) / 0.1 (exp)',cls:'num'}, {v:'~30 min',cls:'num'}, {v:'80%',cls:'num'}],
              [{v:'MID',cls:'mars'},  '30–90°',  {v:'0.8 / 0.4',cls:'num'},              {v:'~2 hr',cls:'num'},   {v:'65%',cls:'num'}],
              [{v:'FAR',cls:'mars'},  '> 90°',   {v:'1.5 / 1.0',cls:'num'},              {v:'~5 hr',cls:'num'},   {v:'50%',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'Failure = fuel lost',
            text:'Failed missions yield zero rewards, but the PP spent on launch is not refunded. FAR missions are high-risk, high-reward — pick your battles.' },

          { type:'h2', text:'4. Rewards' },
          { type:'table',
            headers:['Mission Type','Reward Contents','Multiplier'],
            rows:[
              ['⚔ Invasion', 'PP + GP + XP',              'All scaled by pad multiplier'],
              ['🛰 Exploration', 'PP + XP + rare item chance', 'All scaled by pad multiplier']
            ]},
          { type:'callout', variant:'info', title:'Multiplier is everything',
            text:'The same FAR invasion from a ×1.0 pad vs. a ×3.0 pad yields 3× the PP. Always prioritize launching from your largest pad.' },

          { type:'h2', text:'5. Target Deduplication' },
          { type:'p', text:'The system automatically prevents target collisions so missions never overlap:' },
          { type:'list', items:[
            'Same territory cannot be invaded by two missions simultaneously',
            'On overlap, the system auto-redirects to a different territory of the same target',
            'Exploration probes auto-offset if coordinates collide'
          ]},

          { type:'h2', text:'6. Tips' },
          { type:'list', items:[
            'Build large merged territories to chase the ×3.0 multiplier',
            'FAR missions carry the most risk but the best rewards — for when you want to gamble',
            'Cannot invade your own guild members',
            'READY pads are sorted to the top of the list for quick access'
          ]},
          { type:'callout', variant:'pro', title:'OPS is the core of active income',
            text:'Mining is passive; OPS is active. Combine OPS sorties with daily mining and you\'ll out-earn pure AFK play by a wide margin.' }
        ]
      },
      { id: 'quests', icon: '📋', title: 'Quests',
        blocks: [
          { type:'p', text:'The quest system auto-tracks progress as you play — no manual action needed. You always have 3 active quests (one per tier), claim PP rewards on completion, and new quests auto-refresh after claiming.' },
          { type:'toc', label:'In this section', items:[
            'Quest Tiers',
            'How Quests Work',
            'Quest Actions',
            'Tips'
          ]},

          { type:'h2', text:'1. Quest Tiers' },
          { type:'p', text:'Quests come in three tiers with escalating difficulty and rewards:' },
          { type:'table',
            headers:['Tier','Type','Rewards','Examples'],
            rows:[
              [{v:'FREE',cls:'mars'},     'Simple daily tasks', {v:'0.01 ~ 0.05 PP',cls:'num'}, 'Login, view sectors, visit base'],
              [{v:'ACTIVITY',cls:'mars'}, 'Gameplay actions',   {v:'0.05 ~ 0.25 PP',cls:'num'}, 'Claim pixels, harvest, launch missions, play cantina'],
              [{v:'SPENDING',cls:'mars'}, 'Spending USDT/PP',   {v:'0.30 ~ 1.50 PP',cls:'num'}, 'Deposit USDT, premium claims, big expansions']
            ]},
          { type:'callout', variant:'info', title:'Three tiers in parallel',
            text:'You always have 3 quests active (one per tier). FREE tier is pure profit; SPENDING tier has the biggest payouts but requires spending.' },

          { type:'h2', text:'2. How Quests Work' },
          { type:'list', items:[
            '3 active quests at a time (1 per tier)',
            'Quests auto-progress as you play — no manual tracking needed',
            'Completed quests can be claimed for PP rewards',
            'New quests refresh after claiming, with cooldowns (24h ~ 168h)'
          ]},

          { type:'h2', text:'3. Quest Actions' },
          { type:'p', text:'The system tracks a wide range of actions, covering nearly every in-game behavior:' },
          { type:'table',
            headers:['Category','Actions'],
            rows:[
              ['Territory',  'Claim pixels, harvest, hijack'],
              ['Missions',   'Launch/complete invasions and explorations'],
              ['Social',     'Guild chat, cantina games'],
              ['Economy',    'Buy items, use items, deposit USDT, swap tokens']
            ]},

          { type:'h2', text:'4. Tips' },
          { type:'list', items:[
            'Check the QUESTS tab in BASE regularly',
            'Free quests are pure profit — never skip them',
            'Stack quest goals with your normal gameplay (e.g., claim pixels while a claim quest is active)',
            'Consecutive login quests give the best free-tier rewards'
          ]},
          { type:'callout', variant:'pro', title:'Zero-cost PP',
            text:'FREE tier quests alone deliver steady PP rewards every day, at absolutely no cost. Layer them on top of your normal play and the returns compound.' }
        ]
      },
      { id: 'guilds', icon: '⚔', title: 'Guilds & Seasons',
        blocks: [
          { type:'p', text:'When solo growth stalls, **join a guild**. Pixel holdings aggregate, and guild chat, emblems, and season leaderboards are all wired up. Seasons rotate every **30 days** with new themes.' },
          { type:'toc', label:'In this section', items:[
            'Guild creation and roles',
            'Customization costs',
            'Guild chat',
            'Season system',
            'Season score calculation',
            'Season rewards'
          ]},

          { type:'h2', text:'1. Guild Creation and Roles' },
          { type:'table',
            headers:['Item','Value','Source'],
            rows:[
              ['Create cost',    {v:'50 GP',cls:'num'},  '`guild_create_cost_gp`'],
              ['Max members',    {v:'20',cls:'num'},     '`guild_max_members`'],
              ['Roles',          'Leader · Officer · Member', '`guild_members.role`'],
              ['Invite expiry',  {v:'72 hours',cls:'num'},'`guild_invite_expire_hours`'],
              ['1 wallet = 1 guild', 'Enforced (UNIQUE)',  '`guild_members`']
            ]},
          { type:'callout', variant:'info', title:'Leader · Officer · Member',
            text:'**Leader** — kick, promote, demote, disband, transfer leadership. **Officer** — invite, partial edit. **Member** — chat, view. When the leader is absent, officers can run the guild.' },

          { type:'h2', text:'2. Customization Costs' },
          { type:'p', text:'After creation you keep spending GP to reshape the guild. Leader-only.' },
          { type:'table',
            headers:['Item','Cost','Note'],
            rows:[
              ['Rename',             {v:'100 GP',cls:'num'}, '`guild_rename_cost_gp`'],
              ['Description',        {v:'20 GP',cls:'num'},  '`guild_desc_cost_gp`'],
              ['Emoji emblem',       {v:'50 GP',cls:'num'},  'Text emoji'],
              ['Pixel-art emblem',   {v:'50 GP',cls:'num'},  {v:'32×32 · max 8 KB',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'Pixel-art emblems are powerful branding',
            text:'Pixel-art emblems go up to **32×32**. Tiny but instantly recognizable when they pop up on a territory modal.' },

          { type:'h2', text:'3. Guild Chat' },
          { type:'table',
            headers:['Item','Value','Source'],
            rows:[
              ['Max length',  {v:'300 chars',cls:'num'},'`guild_chat_max_len`'],
              ['Cooldown',    {v:'3 seconds',cls:'num'},'`guild_chat_cooldown_sec`'],
              ['History',     {v:'latest 100',cls:'num'}, '`guild_chat_history_limit`']
            ]},
          { type:'callout', variant:'info', title:'Polling-based',
            text:'Not websockets — polling. Messages sync every few seconds rather than instantly. In live combat, reactions can feel slightly delayed.' },

          { type:'h2', text:'4. Season System' },
          { type:'p', text:'Seasons run on a **30-day cycle**. Each season picks a Mars-weather **theme** and **6 ranking categories** out of 26 — so the leaderboard you grind for changes every season.' },
          { type:'table',
            headers:['Season','Theme','Mars conditions'],
            rows:[
              [{v:'Season 1',cls:'mars'}, '🌋 Volcanic Dawn',    'Magma vents reactivate'],
              [{v:'Season 2',cls:'mars'}, '❄ Frozen Frontier',  'Polar ice creeps equatorward'],
              [{v:'Season 3',cls:'mars'}, '☀ Solar Inferno',    'Coronal mass ejections'],
              [{v:'Season 4',cls:'mars'}, '🌪 Dust Epoch',      'Planet-wide sandstorm']
            ]},
          { type:'callout', variant:'warn', title:'Seasons are 30 days — not decorative',
            text:'Season length is **hard-set to 30 days** (`seasons.ends_at`). Weather probabilities shift with the theme, and a colored tint paints the Mars surface.' },

          { type:'h2', text:'5. Season Score Calculation' },
          { type:'p', text:'There are **26 ranking categories** total — territory, mining, combat, defender, explorer, quester, gambler, recruiter, namer, etc. Each season **only 6** of them are active, picked from the pool, so a category that mattered last season may be dormant this one.' },
          { type:'table',
            headers:['Activity','Points','Source'],
            rows:[
              ['Claimed pixels',   {v:'+1 / px',cls:'num'},  '`season_mult_pixels`'],
              ['Harvest complete', {v:'+5',cls:'num'},       '`season_mult_harvest`'],
              ['Hijack win',       {v:'+10',cls:'num'},      '`season_mult_hijack`'],
              ['POI discovery',    {v:'+15',cls:'num'},      '`season_mult_poi`']
            ]},
          { type:'callout', variant:'tip', title:'Read the active 6 first',
            text:'Open the SEASON tab to see which 6 categories are live this season. Going for *combat* in a season where combat isn\'t active is a waste — chase only the active leaderboards.' },

          { type:'h2', text:'6. Season Rewards' },
          { type:'p', text:'At season end, top ranks by category auto-receive rewards. Claim them in the `RANK` tab.' },
          { type:'table',
            headers:['Rank','Season 1 reward','Season 3 reward'],
            rows:[
              [{v:'1st',cls:'mars'},    {v:'3000 GP + 0.5 PP + 500 XP',cls:'num'}, {v:'5000 GP + 1.0 PP + 800 XP',cls:'num'}],
              [{v:'2 ~ 3',cls:'mars'},  {v:'1500 GP',cls:'num'},                    {v:'2500 GP',cls:'num'}],
              [{v:'4 ~ 10',cls:'mars'}, {v:'500 GP',cls:'num'},                     {v:'800 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'Rewards grow season over season',
            text:'Early seasons pay less and rewards scale up later. The longer you play, the bigger the compounding payoff.' }
        ]
      },
      { id: 'guildwar', icon: '🎮', title: 'Guild Wars & Minigames',
        blocks: [
          { type:'p', text:'Guild wars pit two guilds against each other in a **24-hour arcade competition**. Members play Mars-themed minigames and combine scores. Highest total wins GP for the guild treasury.' },
          { type:'toc', label:'In this section', items:[
            'Declaring war', 'Minigames overview', 'Continue mechanic', 'Scoring & rewards'
          ]},
          { type:'h2', text:'1. Declaring War' },
          { type:'table',
            headers:['Item','Value','Source'],
            rows:[
              ['Declaration cost',  {v:'200 GP (from treasury)',cls:'num'}, '`guild_war_declare_cost_gp`'],
              ['Min members',       {v:'3',cls:'num'},                      '`guild_war_min_members`'],
              ['Duration',          {v:'24 hours',cls:'num'},               '`guild_war_duration_hours`'],
              ['Cooldown',          {v:'48 hours',cls:'num'},               '`guild_war_cooldown_hours`'],
              ['Max active wars',   {v:'1 per guild',cls:'num'},            '`guild_war_max_active`'],
              ['Winner reward',     {v:'500 GP → treasury',cls:'num'},      '`guild_war_winner_gp`']
            ]},
          { type:'callout', variant:'info', title:'Both sides are checked',
            text:'Neither attacker nor defender can have another active war. A guild already at war cannot be targeted.' },

          { type:'h2', text:'2. Minigames' },
          { type:'p', text:'Three Mars-themed arcade games. Each guild member gets a limited number of plays per day.' },
          { type:'table',
            headers:['Game','Theme','How to play'],
            rows:[
              [{v:'🚀 Mars Invaders',cls:'mars'}, 'Space Invaders', 'Shoot pixel-art alien waves. Boss every 5th wave. 240s timer, 3 lives, auto-fire.'],
              [{v:'👨‍🚀 Mars Runner',cls:'mars'},  'Pacman maze',    'Navigate pixel-art tunnels as an astronaut, collect minerals, avoid alien sprites. Power-ups let you eat enemies. 240s timer.'],
              [{v:'⛏️ Mars Digger',cls:'mars'},   'Dig Dug',        'Dig through pixel-art Mars soil, collect crystal minerals, pump Dune-style sandworms. Falling rocks crush enemies. 240s timer.']
            ]},
          { type:'callout', variant:'tip', title:'Daily play limit',
            text:'Default 3 plays/day per member (`guild_war_game_plays_per_day`). Coordinate with your guild — every member\'s plays count!' },

          { type:'h2', text:'3. Continue Mechanic' },
          { type:'p', text:'When you die, you can **pay to continue** — keeping your score and resuming. This is how competitive guilds push scores sky-high.' },
          { type:'table',
            headers:['Continue #','Cost','Type'],
            rows:[
              ['1st', {v:'5 GP',cls:'num'},    'GP'],
              ['2nd', {v:'15 GP',cls:'num'},   'GP'],
              ['3rd', {v:'30 GP',cls:'num'},   'GP'],
              ['4th', {v:'0.1 PP',cls:'num'},  'PP (real money!)'],
              ['5th', {v:'0.2 PP',cls:'num'},  'PP (doubles each time)'],
              ['6th', {v:'0.4 PP',cls:'num'},  'PP'],
              ['7th+', {v:'keeps doubling',cls:'num'}, 'PP']
            ]},
          { type:'callout', variant:'warn', title:'PP continues are real money',
            text:'After the 3rd continue, costs switch to PP which equals real money. Spend wisely — or go broke trying to win.' },

          { type:'h2', text:'4. Scoring & Rewards' },
          { type:'p', text:'All member scores in a war are summed per guild. When the 24h timer expires, the guild with the higher total wins 500 GP to their treasury. Score multiplier is admin-tunable (`guild_war_game_score_multiplier`).' }
        ]
      },
      { id: 'research', icon: '🔬', title: 'Guild Research',
        blocks: [
          { type:'p', text:'Guilds can unlock **7 research perks** using GP from the treasury. Each research gives a permanent bonus to all guild members.' },
          { type:'table',
            headers:['Research','Effect','Source'],
            rows:[
              ['⛏ Mining Efficiency I',     {v:'+3% harvest PP',cls:'num'},          '`mining_eff_1_bonus`'],
              ['🛡 Shield Discipline',       {v:'+15% defense',cls:'num'},            '`shield_disc_bonus`'],
              ['🕊 Diplomatic Immunity',     {v:'-10% invasion success vs members',cls:'num'}, '`diplomatic_bonus`'],
              ['🔭 Orbital Scanning',        {v:'+15% exploration rewards',cls:'num'},'`orbital_scan_bonus`'],
              ['🚀 Rapid Deployment',        {v:'-20% mission travel time',cls:'num'},'`rapid_deploy_bonus`'],
              ['📦 Logistics Network',       {v:'-10% claim costs',cls:'num'},        '`logistics_bonus`'],
              ['👑 Mars Dominion',           {v:'+5% to ALL bonuses',cls:'num'},      '`mars_dominion_bonus`']
            ]},
          { type:'callout', variant:'pro', title:'Mars Dominion stacks on everything',
            text:'Unlock Mars Dominion last — it adds +5% on top of every other research bonus. Mining becomes +3.15%, defense becomes +15.75%, etc.' }
        ]
      },
      { id: 'seasonpass', icon: '🎫', title: 'Season Pass',
        blocks: [
          { type:'p', text:'Each season has a **30-tier battle pass** with free and premium tracks. Earn XP from gameplay actions to unlock tier rewards.' },
          { type:'h2', text:'1. Earning XP' },
          { type:'table',
            headers:['Action','XP','Source'],
            rows:[
              ['Harvest',     {v:'+5 XP',cls:'num'},  '`season_pass_xp_harvest`'],
              ['Claim',       {v:'+10 XP',cls:'num'}, '`season_pass_xp_claim`'],
              ['Invasion',    {v:'+15 XP',cls:'num'}, '`season_pass_xp_invasion`'],
              ['Exploration', {v:'+10 XP',cls:'num'}, '`season_pass_xp_exploration`'],
              ['Quest',       {v:'+8 XP',cls:'num'},  '`season_pass_xp_quest`']
            ]},
          { type:'h2', text:'2. Tier Rewards' },
          { type:'p', text:'Free track gives GP every tier. Premium track gives more GP plus special items at milestone tiers. **All rewards are GP — no PP is given away.**' },
          { type:'table',
            headers:['Tier','Free reward','Premium reward'],
            rows:[
              ['Every tier',      {v:'10×tier GP',cls:'num'},   {v:'25×tier GP',cls:'num'}],
              ['Every 5th (free)',{v:'50×tier GP bonus',cls:'num'}, '—'],
              ['Every 10th (premium)', '—',                     'Special item'],
              ['Tier 30 (max)',   {v:'500 GP',cls:'num'},       {v:'1500 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Premium pass costs GP',
            text:'The premium pass upgrade currently costs **150 GP** by live default (admin-configurable). It unlocks the premium reward track for the current season only.' }
        ]
      },
      { id: 'exchange', icon: '💱', title: 'PP → GP Exchange',
        blocks: [
          { type:'p', text:'Need GP fast? Convert your PP (value token) into GP. The rate is **dynamic**, not fixed — it floats with demand. This is also a **PP sink**, since the fee portion is burned.' },
          { type:'h2', text:'1. Dynamic PP → GP Rate' },
          { type:'p', text:'The exchange rate is recomputed from 24h conversion demand and clamped to a hard band. High GP demand pushes the rate **down** (fewer GP per PP); low demand lets it drift back **up**.' },
          { type:'table',
            headers:['Setting','Value','Source'],
            rows:[
              ['Rate band',     {v:'5 ~ 20 GP / PP',cls:'num'}, '`pp_to_gp_rate_floor` / `_ceil`'],
              ['Base rate',     {v:'10 GP / PP',cls:'num'},     '`pp_to_gp_exchange_rate`'],
              ['Max move',      {v:'±2% per recompute',cls:'num'}, '`pp_to_gp_rate_max_step_pct`'],
              ['Fee',           {v:'5% (burned)',cls:'num'},    '`pp_to_gp_exchange_fee_pct`'],
              ['Dynamic',       {v:'enabled',cls:'num'},        '`pp_to_gp_dynamic_enabled=true`']
            ]},
          { type:'callout', variant:'warn', title:'PP → GP is one-way',
            text:'You convert **PP into GP**, not the reverse — GP cannot be turned back into PP. Convert PP when you need GP for ship builds, upgrades, crates, the shop, or governance. Day-to-day GP also comes from login, missions and battles.' },
          { type:'callout', variant:'tip', title:'Watch the rate before converting',
            text:'Because the rate floats between 5 and 20 GP/PP, converting when GP demand is low (rate near 20) gives you more GP per PP. The 5% fee is burned, reducing PP supply.' },

          { type:'h2', text:'2. PP → USDT Redemption (collateral-gated)' },
          { type:'p', text:'PP can also be redeemed to **USDT** in the `SWAP` tab — but only within the operator-funded **collateral pool**. This structurally prevents a bank run.' },
          { type:'formula', label:'REDEMPTION ROOM',
            eq:'room = ~collateral~ − ~total user USDT liabilities~',
            note:'PP → USDT redemption (and PP-sourced withdrawals) are only allowed up to `room`. If the pool is exhausted, redemption pauses until the operator tops up collateral.' },
          { type:'callout', variant:'warn', title:'Redemption is not unlimited',
            text:'PP redeems to USDT at the current operator rate (variable, not a fixed peg), and cashing out depends on available collateral room. Large simultaneous redemptions can hit the cap — this is the bank-run safety rail (`migration 230`).' }
        ]
      },
      { id: 'casino', icon: '🎰', title: 'Cantina Casino',
        blocks: [
          { type:'p', text:'**Cantina** is the in-game casino made of 5 mini-games. All games take PP or USDT. There\'s a real house edge — treat it as entertainment, not income.' },
          { type:'toc', label:'In this section', items:[
            '5-game summary',
            'Bet limits & house edge',
            'Coinflip',
            'Dice',
            'Hi-Lo',
            'Crash / Mines'
          ]},

          { type:'h2', text:'1. 5-Game Summary' },
          { type:'table',
            headers:['Game','Type','Currency'],
            rows:[
              [{v:'🚀 Crash',cls:'mars'},   'Live multiplier','PP · USDT'],
              [{v:'💣 Mines',cls:'mars'},   'Grid',           'PP · USDT'],
              [{v:'🪙 Coinflip',cls:'mars'},'50/50',          'PP · USDT'],
              [{v:'🎲 Dice',cls:'mars'},    'Range roll',     'PP · USDT'],
              [{v:'🃏 Hi-Lo',cls:'mars'},   'Card streak',    'PP · USDT']
            ]},

          { type:'h2', text:'2. Bet Limits & House Edge' },
          { type:'table',
            headers:['Game','Min Bet','Max Bet','House Edge'],
            rows:[
              [{v:'Crash',cls:'mars'},    {v:'0.1',cls:'num'},  {v:'50',cls:'num'},  {v:'4 %',cls:'num'}],
              [{v:'Mines',cls:'mars'},    {v:'0.1',cls:'num'},  {v:'20',cls:'num'},  {v:'3 %',cls:'num'}],
              [{v:'Coinflip',cls:'mars'}, {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 3 %',cls:'num'}],
              [{v:'Dice',cls:'mars'},     {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'variable',cls:'num'}],
              [{v:'Hi-Lo',cls:'mars'},    {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 4 %',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'House edge is real',
            text:'Long-term, the house always wins. A 3-4% edge means on average **3-4% of every bet disappears**. Bet 100 PP and you lose 3-4 PP on average.' },

          { type:'h2', text:'3. Coinflip' },
          { type:'p', text:'Pick **HEADS or TAILS**, place your bet, flip. Win = 1.96× your bet. Simple, fast 50/50.' },
          { type:'callout', variant:'info', title:'Simple but still has edge',
            text:'It looks like 50/50, but the payout is under 2.0× — that\'s where the edge lives. Upside: you can cycle many rounds fast.' },

          { type:'h2', text:'4. Dice' },
          { type:'p', text:'Roll the dice. Pick **over/under a range**; the narrower the range, the higher the multiplier.' },
          { type:'callout', variant:'tip', title:'Risk tuning via range',
            text:'Pick low-mult/high-prob or high-mult/low-prob yourself. Biggest dial in the cantina.' },

          { type:'h2', text:'5. Hi-Lo' },
          { type:'p', text:'A card is shown. Guess whether the next card is **higher or lower**. Streaks compound multiplicatively.' },
          { type:'callout', variant:'pro', title:'Streaks are everything',
            text:'Base payout is small, but **streaks** grow exponentially. Knowing when to cash out is the whole game.' },

          { type:'h2', text:'6. Crash / Mines' },
          { type:'p', text:'**Crash** — multiplier climbs then suddenly crashes. Cash out before it does. **Mines** — open tiles on a grid, avoid bombs. Every safe tile boosts your multiplier. These two are the most popular.' },
          { type:'callout', variant:'warn', title:'Play responsibly',
            text:'The casino is entertainment. Spend a fraction of what your mining pays daily. Don\'t treat it as income. Going all-in on one round = auto liquidation.' }
        ]
      },
      { id: 'dynasty', icon: '👑', title: 'DYNASTY / Referral',
        blocks: [
          { type:'p', text:'Invite a friend and commissions flow to you through a **3-tier MLM**. Not only your direct (Tier 1) friends — friends of friends (Tier 2) and the tier below (Tier 3) all feed your income line.' },
          { type:'toc', label:'In this section', items:[
            '3-tier structure',
            '6 activities that pay commission',
            'Leaderboard and tree view',
            'Long-term strategy'
          ]},

          { type:'h2', text:'1. 3-Tier Structure' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg">'+
              '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
              '<circle cx="260" cy="30" r="22" fill="rgba(255,209,102,.18)" stroke="#ffd166" stroke-width="2"/><text x="260" y="34" fill="#ffd166">YOU</text>'+
              '<circle cx="140" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="140" y="99">T1</text>'+
              '<circle cx="260" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="260" y="99">T1</text>'+
              '<circle cx="380" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="380" y="99">T1</text>'+
              '<circle cx="90"  cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="90"  y="159" font-size="9">T2</text>'+
              '<circle cx="180" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="180" y="159" font-size="9">T2</text>'+
              '<circle cx="260" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="260" y="159" font-size="9">T2</text>'+
              '<circle cx="340" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="340" y="159" font-size="9">T2</text>'+
              '<circle cx="430" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="430" y="159" font-size="9">T2</text>'+
              '</g>'+
              '<line x1="250" y1="48" x2="150" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="260" y1="52" x2="260" y2="75" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="270" y1="48" x2="370" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="132" y1="114" x2="94"  y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="148" y1="114" x2="176" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="260" y1="115" x2="260" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="372" y1="114" x2="336" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="388" y1="114" x2="425" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '</svg>',
            caption:'YOU → T1 (direct) → T2 (indirect) → T3 (3 levels deep)' },
          { type:'p', text:'The `referral_rewards` table has a **tier INT** column that tracks which level each payout came from. Tier percentages are admin-configurable — check the DYNASTY tab in-game for the current live rate.' },

          { type:'h2', text:'2. Commission-bearing activities (live defaults)' },
          { type:'p', text:'Live defaults currently pay commission from **5 activities**. Some sources can be turned on/off by operator settings, so always treat the DYNASTY tab as the source of truth.' },
          { type:'table',
            headers:['Activity','Description'],
            rows:[
              ['💰 Deposit',    'Bringing USDT into the game'],
              ['🔄 Swap',       'USDT ↔ PP conversion'],
              ['🛒 Shop',       'Item / cosmetic purchases'],
              ['🎰 Cantina',    'Casino bets'],
              ['🏪 Market fee', 'Marketplace listing / trading fees']
            ]},
          { type:'callout', variant:'info', title:'Real-time settlement',
            text:'Whenever the referee triggers a live commission source, PP arrives in your wallet instantly. Harvest / hijack / enhancement / auction sources may be operator-disabled in live ops.' },

          { type:'h2', text:'3. Leaderboard and Tree View' },
          { type:'p', text:'The `DYNASTY` tab shows your referral tree and the global leaderboard.' },
          { type:'table',
            headers:['Item','Content'],
            rows:[
              ['Referral code',     'Unique code tied to your wallet'],
              ['Direct invites',    'Number of Tier-1 members you hold'],
              ['Total downline',    'T1 + T2 + T3 combined'],
              ['Cumulative income', 'All-time PP received across all tiers']
            ]},

          { type:'h2', text:'4. Long-term Strategy' },
          { type:'callout', variant:'pro', title:'DYNASTY is the highest-EV action in the game',
            text:'Territory and mining pay only for the work you put in (linear). DYNASTY **compounds** as the network grows. Invite 5 active users and there\'s a tipping point where passive income exceeds your personal mining.' },
          { type:'callout', variant:'warn', title:'Bot invites are worthless',
            text:'Commission is tied to the referee\'s **actual spending**. 100 bots that don\'t play = 0 PP. One active user beats 1000 bots.' }
        ]
      },
      { id: 'cosmetics', icon: '✨', title: 'Cosmetics & Items',
        blocks: [
          { type:'p', text:'There are **visual cosmetics** to decorate territories and **consumable items** that change combat and efficiency. Both are available in the `SHOP` tab, priced in PP / USDT / GP.' },
          { type:'toc', label:'In this section', items:[
            '3 cosmetic categories',
            'Shields · boosts · utility items',
            'Payment options per currency',
            'Drop-only cosmetics'
          ]},

          { type:'h2', text:'1. 3 Cosmetic Categories' },
          { type:'p', text:'Each territory can equip **1 border + 1 glow + 1 terrain**. No stacking within a category.' },
          { type:'table',
            headers:['Category','Variants','Price Range'],
            rows:[
              [{v:'🟧 Border',cls:'mars'},  'Neon · Flame · Ice · Gold',             {v:'3 ~ 15 PP',cls:'num'}],
              [{v:'✨ Glow',cls:'mars'},    'Pulse · Rainbow · Dark Aura',           {v:'4 ~ 8 PP',cls:'num'}],
              [{v:'⛰ Terrain',cls:'mars'}, 'Volcanic · Frozen · Crystal · Toxic',   {v:'5 ~ 7 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'Survives season resets',
            text:'Once purchased, cosmetics are **permanent** and can be moved between territories across seasons.' },

          { type:'h2', text:'2. Shields · Boosts · Utility Items' },
          { type:'table',
            headers:['Item','Effect','Cost'],
            rows:[
              [{v:'⚡ Energy Shield',cls:'mars'},    'Absorb 50% hijack damage (12h)', {v:'2.5 PP',cls:'num'}],
              [{v:'💠 Plasma Shield',cls:'mars'},    'Absorb 75% hijack damage (24h)', {v:'5.0 PP',cls:'num'}],
              [{v:'🔥 Mars Rage',cls:'mars'},        '+20% attack × 3',                {v:'2.0 PP',cls:'num'}],
              [{v:'🫥 Stealth Cloak',cls:'mars'},    'Hide territory (8h)',            {v:'1.5 PP',cls:'num'}],
              [{v:'📡 Radar Scan',cls:'mars'},       'Reveal cloaked once',            {v:'1.0 PP',cls:'num'}],
              [{v:'⛏ Mining Accelerator',cls:'mars'},'Mining × 2 (6h)',                {v:'3.0 PP',cls:'num'}],
              [{v:'🟡 Pixel Doubler',cls:'mars'},    'Next claim counts ×2 pixels',    {v:'4.0 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'Best value No.1 — Energy Shield',
            text:'2.5 PP = 2-3 daily mission rewards. Run one daily for free 24h defense. For top season ranks, keep Plasma Shield up at all times.' },

          { type:'h2', text:'3. Payment Options per Currency' },
          { type:'p', text:'Every shop item accepts **PP / USDT / GP**. Conversion ratios:' },
          { type:'table',
            headers:['Currency','Conversion'],
            rows:[
              ['PP',   {v:'base price',cls:'num'}],
              ['USDT', {v:'same as PP (1:1)',cls:'num'}],
              ['GP',   {v:'PP price × 4',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'Don\'t hoard GP',
            text:'GP is mainly for governance, but you can buy cosmetics with it. Not planning to run in elections? Burn GP on cosmetics to pimp your territories.' },

          { type:'h2', text:'4. Drop-Only Cosmetics' },
          { type:'p', text:'Some cosmetics aren\'t sold in the shop. They drop **only from events** — rockets, season rewards, POIs.' },
          { type:'table',
            headers:['Item','Source','Rarity'],
            rows:[
              [{v:'🚀 Starship Border',cls:'mars'}, 'Rocket drop (2% weight)', {v:'Limited',cls:'num'}],
              [{v:'Season emblem',cls:'mars'},      'Season TOP 10',           {v:'Limited',cls:'num'}],
              [{v:'💎 Special POI cosmetic',cls:'mars'}, 'POI discovery +5% extra roll', {v:'Random',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'Miss once, gone forever',
            text:'Season reward cosmetics **cannot be obtained** after that season ends. If you don\'t trust your rank run, at least grab the rocket drops.' }
        ]
      },
      { id: 'strategy', icon: '🎯', title: 'Strategy Tips',
        blocks: [
          { type:'p', text:'The final section is **hands-on operations**. What to prioritize on Day 1, Week 1, and long-term — plus the common failure patterns.' },
          { type:'toc', label:'In this section', items:[
            'Day 1 checklist',
            'Week 1 operations',
            'Long-term builds',
            'Top 5 mistakes'
          ]},

          { type:'h2', text:'1. Day 1 Checklist' },
          { type:'p', text:'Finish these 5 on your signup day and **income rolls automatically from Day 2**.' },
          { type:'table',
            headers:['#','Task','Reward'],
            rows:[
              [{v:'1',cls:'num'}, 'Claim login bonus',                  {v:'5 GP',cls:'num'}],
              [{v:'2',cls:'num'}, 'Complete 3 daily missions',          {v:'+50 GP',cls:'num'}],
              [{v:'3',cls:'num'}, 'Small FRONTIER sector claim',        {v:'Harvest starts',cls:'num'}],
              [{v:'4',cls:'num'}, 'Discover 1 POI',                     {v:'10~50 GP',cls:'num'}],
              [{v:'5',cls:'num'}, 'Invite 1 friend via referral code',  {v:'Tier 1 active',cls:'num'}]
            ]},

          { type:'h2', text:'2. Week 1 Operations' },
          { type:'p', text:'**Goal: 100-300 px territory + always-on Energy Shield + join a guild.**' },
          { type:'callout', variant:'tip', title:'10-day routine',
            text:'Every day: ① login ② 3 missions ③ 2-3 POIs ④ 1-2 harvests ⑤ refresh shield. Just this nets ~100 GP + 1 PP a day. 7 days = 700 GP · 7 PP.' },
          { type:'callout', variant:'info', title:'When to join a guild?',
            text:'Look for one with 10+ active members and live chat. Creating your own too early wastes 50 GP — members may never show up.' },

          { type:'h2', text:'3. Long-term Builds' },
          { type:'table',
            headers:['Goal','Strategy'],
            rows:[
              ['🏛 Governor win',  'Target low-traffic sectors first. 1,000-3,000 GP is usually enough to dethrone the incumbent.'],
              ['⚔ Season Top 10', 'POI-centric play (1 POI = 15 pts). Rewards are mostly GP → reinvest into governance.'],
              ['👑 Commander run', 'Global #1 GP is in the tens of thousands. Only feasible with a guild + POI grind + referral network.'],
              ['💸 DYNASTY compounding', 'Refer 3-5 active whales. Every PP/USDT they spend feeds back to you.']
            ]},

          { type:'h2', text:'4. Top 5 Mistakes' },
          { type:'callout', variant:'warn', title:'① Casino without mining infrastructure',
            text:'USDT deposit → straight to cantina is the worst path. A 3-4% house edge is real. Stabilize territory and POIs first.' },
          { type:'callout', variant:'warn', title:'② Huge claims in remote coordinates',
            text:'Big plots on the frontier go unseen. One CORE-sector cell outshines 100 FRONTIER cells for visibility.' },
          { type:'callout', variant:'warn', title:'③ Skipping shields',
            text:'Saving 2.5 PP by going shieldless costs 20× more when you get hijacked. Always spend 2.5 PP/day on a shield.' },
          { type:'callout', variant:'warn', title:'④ Skipping daily missions',
            text:'Daily missions + login bonus = 50-150 GP free per day. That\'s 1,500-4,500 GP/month. Missing it is the same as surrendering governor seats.' },
          { type:'callout', variant:'warn', title:'⑤ Not inviting friends',
            text:'DYNASTY is the **highest-EV action** in the entire game. A single invited friend turns linear growth into compound growth. Sharing your referral code is not something to be shy about.' }
        ]
      }
    ]
  },
  ko: {
    sections: [
      { id: 'siegewar', icon: '🏛', title: '길드 공성전',
        blocks: [
          { type:'p', text:'**화성을 섹터 단위로 점령하라.** 길드(혈맹)가 정해진 시각에 함대전을 벌여 섹터를 차지하고 세금을 거두며, 최종적으로 화성 맹주 자리를 다툰다. EVE 동맹전 + 리니지 공성전에서 영감.' },
          { type:'h2', text:'🗺 섹터 & 거버너' },
          { type:'p', text:'• 화성은 **24개 섹터**(frontier/mid/core)로 나뉜다. 섹터 공성에서 이긴 길드가 **거버너**가 되어 **섹터 세금**을 **길드 금고**로 거둔다.\n• 전체 현황은 **BASE → GOVERN → 🗺 SOV MAP** 에서: 누가 어느 섹터를 지배하는지, 지배 길드 순위, 다가오는 공성 일정을 본다.' },
          { type:'h2', text:'⚔ 섹터 공성 (주간)' },
          { type:'p', text:'1. 도전자가 섹터에 공성을 선언(해당 섹터 영토 필요).\n2. 결전은 **고정 주간 슬롯**(수·토 12:00 UTC)으로 스냅돼 모두가 관전 가능.\n3. **길드원이 각자 함대 1개씩** 공격/수비에 합류(1인 1함대).\n4. 결전 시각에 **합류한 모든 함대가 한 전장에서 실시간 전투** — 내 함대를 직접 조종.\n5. 승리 길드가 새 거버너.' },
          { type:'h2', text:'🎮 실시간 명령' },
          { type:'p', text:'라이브 공성 중 **내 함대**를 지휘: **진형**, **기동**, **집중공격**, 충전형 수동 스킬 **☢ 빔포** / **☄ 미사일**(서버 충전 — 100%에서 발동). 모두 같은 권위 전투를 관전한다.' },
          { type:'callout', variant:'warn', title:'⚠ 함선 영구 손실 주의', text:'공성 full-loss가 켜져 있으면 패배한 함대는 **영구 파괴**된다. 손실 없이 하려면 **함대를 걸지 말 것** — 영토 점유율로 도전/방어하면(픽셀 수 판정) 함선 손실이 없다.' },
          { type:'h2', text:'👑 커맨더 공성 (월간)' },
          { type:'p', text:'• 가장 많은 섹터를 지배한 길드가 **화성 맹주**다. 매월 1회(1일 12:00 UTC) **커맨더 공성**이 자동 개최: 맹주(수비) vs 2위 길드(도전). 승자가 화성을 지배한다.\n• 여러 주기 동안 아무도 도전하지 않으면 맹주 자리가 **비워지고** 섹터 최다 지배 길드로 폴백된다.' },
          { type:'h2', text:'💰 세금 → 길드 금고' },
          { type:'p', text:'섹터 세금은 **길드 금고**로 들어간다. 리더/오피서가 길드 패널에서 인출한다. 길드 해체 시 금고는 리더에게 **환원**된다(GP 소각 없음).' },
        ] },
      { id: 'whatsnew', icon: '🆕', title: '최신 업데이트',
        blocks: [
          { type:'p', text:'**v7.27x — 2026-05 자원 출항 + GP 중심 경제.** 최신 안정 빌드.' },
          { type:'h2', text:'⛏ 자원 출항 — 땅 없이 하는 F2P 채굴' },
          { type:'p', text:'• **자원 출항**(임무 → ⛏ 자원 출항)으로 함대를 보내 **땅 없이 GP + 제작 재료**를 캡니다 — 땅 없는 플레이어의 F2P 사다리.\n• **거리별 목적지**(근/중/원거리)를 선택: 멀수록 수율↑·희귀 재료↑이지만 **내구도 마모**와 **약탈 위험**이 커집니다. 닳은 함선은 **조선소에서 수리**(GP 소모).\n• 수율은 함대의 **적재량**(함급 × 등급)에 비례하며, 출항 일일 GP에는 상한이 있습니다.' },
          { type:'h2', text:'💱 GP ↔ PP 경매 & 보상 GP화' },
          { type:'p', text:'• **무료 PP 지급이 전부 GP로 전환**됐습니다 — PP는 **입금으로만 발행되는 USDT 상환 전용 토큰**입니다. 퀘스트·커맨더 현상금 보상도 이제 **GP**로 지급됩니다(UI 전부 GP 표기).\n• 입금 없이 PP가 필요하면 **경매장에서 다른 플레이어에게 구매**(GP↔PP 거래)하세요. 가격은 직접 정하며, 운영자는 GP로 PP를 발행하지 않습니다.' },
          { type:'h2', text:'🏗 영토 컨디션·등급·정비(TEND)' },
          { type:'p', text:'• 모든 영토에 **컨디션(0~100, HP 개념)**과 **등급(F → S)**이 생겼어. 컨디션은 **매일 조금씩 감쇠**하고, 방치하면 등급이 떨어져.\n• **🔧 TEND(정비)**(영토 **PRODUCTION** 패널)는 GP를 소모해 **컨디션을 회복**하고 등급을 다시 올려줘.\n• **등급이 높을수록 보상이 커져**: 수확 PP와 재료 드롭량이 등급에 비례해 (대략 **S ×1.5 ~ F ×0.6**). 영토를 꾸준히 관리하는 게 수익에 직결돼.' },
          { type:'h2', text:'🔓 레벨별 탭 해금' },
          { type:'p', text:'• 고급 기능이 계정 레벨로 단계 해금돼: **함대 Lv3, 수송 Lv4, PVP Lv6, 길드 Lv8, 거버넌스 Lv10**.\n• 핵심 초반 탭(영토·상점·마켓·캠페인)은 **처음부터 열려 있어**. 잠긴 탭은 **🔒 + 필요 레벨** 뱃지로 표시돼.' },
          { type:'h2', text:'🤖 NPC 아레나 — 살아있는 세계' },
          { type:'p', text:'• NPC 함대가 이제 **아레나에서 24시간 전투**를 벌여서, 한산한 시간대에도 세계가 살아 있게 느껴지고 언제든 관전하며 배울 거리가 있어.' },
          { type:'h2', text:'⛏ 재료 수급 균형 보정' },
          { type:'p', text:'• 이제 frontier 섹터에서도 **일부 tier-2 제작 재료**가 채굴돼서, 신규 유저도 비싼 CORE 영토 없이 첫 함선을 만들 수 있어.' },
          { type:'h2', text:'🏪 지역 마켓 섹터 필터' },
          { type:'p', text:'• 함선/아이템 마켓을 **섹터별로 필터링**할 수 있어 — 섹터 간 차익 거래와 같은 섹터 매물을 쉽게 찾을 수 있어.' },
          { type:'callout', variant:'warn', title:'⚠ 함선 영구파괴(full-loss) 적용됨',
            text:'하이젝 전투에서 격침된(HP 0) 함선은 이제 **영구 손실**돼. 되살릴 수 없고 조선소에서 다시 건조해야 해. 함대를 잃어도 되는 자산으로만 운용해. (`hijack_ship_loss_enabled = true`)' },
          { type:'h2', text:'💰 통화 모델 명확화' },
          { type:'p', text:'• **GP가 주 소비 통화** — 일일 로그인·미션·전투·원정 보상으로 얻고, **PP를 GP로 환전**해서도 충당해. 상점, 함선 건조/강화/수리, 함선 가챠, 영토 업그레이드, 마켓 수수료 등에 소비.\n• **PP는 영토 채굴 토큰.** 운영 환율(변동 가능, 담보 풀 한도 내)로 USDT 환금 — 고정 페그가 아니야. 영토 수확(일일 채굴 캡)·가입/추천/입금 보너스로 획득. 영토 클레임/업그레이드, GP로 환전, **USDT 환금**(운영자 담보 풀 한도 내)에 사용.\n• **USDT**는 Base 체인 실입출금.' },
          { type:'h2', text:'🎰 함선 가챠(Ship Crate)' },
          { type:'p', text:'• **GP**로 함선 가챠 개봉. 3등급: 스탠다드 300 GP, 프리미엄 1,000 GP, 레전더리 3,000 GP.\n• 모든 상자에 **확률 공개** + **천장(pity)**(프리미엄 10회, 레전더리 5회)으로 순양함 이상을 보장.' },
          { type:'h2', text:'📈 동적 PP ↔ GP 환율' },
          { type:'p', text:'• PP→GP 환율은 더 이상 고정이 아니야. 24h 수요에 따라 **PP당 5~20 GP** 하드밴드 안에서 변동하고, 1회 재계산당 최대 **±2%** 움직여. GP 수요가 높으면 환율이 내려가고, 낮으면 다시 올라가.' },
          { type:'h2', text:'🏪 지역(섹터) 마켓' },
          { type:'p', text:'• 마켓 매물은 이제 **판매자 거점 섹터**에 귀속돼. 매수 시 해당 **섹터 거버너에게 관세**가 붙을 수 있고, 운영자는 같은 섹터 거래만 허용하도록 선택할 수 있어 — 섹터가 거래 허브가 돼.' },
          { type:'h2', text:'🛡 경제 안전장치' },
          { type:'p', text:'• **뱅크런 방어**: PP→USDT 환금은 운영자가 적립한 **담보 한도(room = 담보 − 부채)** 내에서만 가능. 담보 없는 환금은 불가.\n• **PP 채굴 캡**: 패시브 수확은 **유저당 1 PP/일** 상한(`mining_daily_cap_per_user=1.0`). 고래 방지.\n• 추천 보상에 **시빌 방어**(계정별·일일 캡).' },
          { type:'h2', text:'⚙ 인프라' },
          { type:'p', text:'• **멀티 인스턴스 수평확장** — 스케줄러/리스너 워커를 `RUN_SCHEDULERS` 플래그로 분리, Redis 캐시 + 공유 레이트리밋(인메모리 폴백).\n• **WebSocket 실시간 푸시** — 채팅·활동피드가 폴링 대신 WebSocket으로 스트리밍, Redis Pub/Sub로 인스턴스 간 팬아웃.' },
          { type:'p', text:'**v6.0 — 2026-04-26 실시간 함대전 완성 (Phase 2 4단계).** WebSocket + 사용자 요구 4가지 모두 ✅' },
          { type:'h2', text:'🔴 v6.0 실시간 함대전 (WebSocket)' },
          { type:'p', text:'• **Phase 2-A**: ws 인프라 — `/ws/battle/{id}` 채널 + frame/end broadcast + JWT 인증 cmd\n• **Phase 2-B**: 클라이언트 ws 연결 + ws_end 즉시 결과 카드 (timeline 끝 대기 X)\n• **Phase 2-C**: fleet 단위 동기화 — DB fleet_id 매칭으로 위치/HP/진형/기동 실시간 반영\n• **Phase 2-D**: 자체 시뮬 fire/damage 비활성화 + 자동 재시작 비활성화 (실제 hijack 결과 영구)\n\n**동작**: hijack → viewer → "🔌 실시간 연결됨" → 함대 위치/HP 가 진짜 시뮬 따라 움직임 → 종료 즉시 결과 카드' },
          { type:'p', text:'**v5.1 — 2026-04-26 AI 전략 자동 적용 + Phase 5 검증.** Phase 4 추가 + 모든 패널 실데이터 동작 확인.' },
          { type:'h2', text:'🤖 v5.1 AI 전략 (PvP/Siege 자동)' },
          { type:'p', text:'• services/aiStrategy.js 신규 — 파벌별 doctrine 적용:\n  - **MCC**: screen + advance (정밀/저격)\n  - **FSP**: sphere + rally (방어/회복)\n  - **CV**: wedge + flank (공격/측면)\n• hijack 외 battle 양쪽에 자동 commander_actions INSERT — battleEngine 이 시뮬에 반영\n• Migration 190: ai_strategy_enabled settings 토글 (admin 조정)\n• Phase 5: tactical-lab 의 FLEET STATUS / SHIP REGISTRY / MINERALS 패널이 이미 /api/tactical-lab/catalog 통해 우리 DB 데이터 (22 함선, 13 광물, 3 파벌) 사용 중 — 검증 완료' },
          { type:'p', text:'**v5.0 — 2026-04-26 함대전 = Tactical Lab 통합.** 사용자 강한 요청 (4번 반복) 단계적 구현.' },
          { type:'h2', text:'⚔ v5.0 함대전 viewer = Tactical Lab v11 그대로' },
          { type:'p', text:'• **4가지 요구사항 단계적 구현**:\n  1. ✅ tactical-lab 모든 항목 우리 게임에 그대로 이식 (iframe + 우리 ship_types/factions/minerals 자동 채움)\n  2. ✅ 모든 항목 실제 게임 데이터 연결 (?bid={battleId} → 진짜 attacker/defender 함대)\n  3. ✅ 함대전 유저 컨트롤 (진형 4종 / 기동 5종 / EMP / 집중공격 → postMessage → API)\n  4. 🟡 실시간 함대전 (WebSocket — 다음 사이클)\n• **데스크탑**: 1500×820 오버레이, 좌측 MY FLEET/RESOURCES + 우측 ENEMY FLEET/BATTLE STATS 사이드 패널\n• **모바일**: 풀스크린 유지\n• **결과 카드**: gradient + 별 점 + winner 글로우 + bvPulse 애니메이션\n• **함선 HP 차감 fix**: 살아남은 함선 부분 HP 손실 DB 반영 (이전엔 멀쩡함)\n• **재시작 버튼 제거** (실제 hijack 결과 영구)' },
          { type:'p', text:'**v4.1 — 2026-04-26 POI 광물 보상 + NPC 함선 일괄 부여.** 사용자 요청 즉각 처리.' },
          { type:'h2', text:'⛏ v4.1 POI 보상 다양화' },
          { type:'p', text:'• 신고: "POI 에도 GP/아이템/광물 섞여서 나오는게 맞지?"\n• Fix: 로켓드롭과 동일한 패턴으로 mineral 카테고리 추가.\n• 가중치: GP50 / Item20 / **Mineral25** / PP10 (admin 조정 가능, Migration 188).\n• claim 시 user_resource_inventory 자동 적립.\n• **NPC 함선 일괄 부여**: 21 NPC 모두 함대 보유 → hijack 함대전 정상 트리거.' },
          { type:'p', text:'**v4.0 — 2026-04-26 로켓드롭 광물 보상 + 새 SVG 로켓 + viewer 롤백.** 사용자 신고 즉각 fix.' },
          { type:'h2', text:'🚀 v4.0 로켓드롭 보상 다양화' },
          { type:'p', text:'• 신고: "자원드롭 15개인데 GP만 존나 나옴"\n• Fix: mineral 카테고리 신규 추가. 가중치 GP30 / Item25 / **Mineral25** / XP12 / PP6 / Cosmetic2 (admin 조정 가능).\n• 광물 풀: iron_ore / carbon_fiber / silicon_chip / titanium_alloy / plasma_crystal / nano_polymer (Migration 187).\n• claim 시 user_resource_inventory 자동 적립.\n• **새 SVG 로켓** (assets/textures/rocket_drop.svg): 화염 트레일 + 윈도우 + 핀.' },
          { type:'p', text:'**v3.9 — 2026-04-26 모바일 OPS 빈 화면 + Hijack 자동승리 viewer fix.** 사용자 신고 즉각 fix.' },
          { type:'h2', text:'📱 v3.9 모바일 OPS 탭 + Hijack viewer fix' },
          { type:'p', text:'• **모바일 OPS 탭 진입 시 빈 화면** → 1024 미디어쿼리가 BASE 모달 내부 발사 폼까지 숨겼음. CSS 룰 좁혀서 fix.\n• **하이젝 함대전 viewer 빈 화면** → 자동승리 (한 쪽 함대 0척) 케이스에 시뮬레이션 frame 거의 없어 캔버스 빈 화면. viewer 안 띄우고 명확한 토스트 표시 ("⚔ 자동 승리 — 즉시 점령" 등).' },
          { type:'p', text:'**v3.8 — 2026-04-26 리더보드 픽셀 수 정정.** 사용자 신고 즉각 fix.' },
          { type:'h2', text:'📊 v3.8 리더보드 픽셀 수 fix' },
          { type:'p', text:'• 리더보드 1위 Woo = 9,260 px / BASE 패널 = 7,173 px → 안 맞음.\n• 원인: 리더보드가 claims.width × height (이론값) 사용. hijack 당한 픽셀까지 포함돼 부풀려짐.\n• Fix: pixels 테이블의 실제 owner 카운트로 변경. BASE 패널과 동일 SSOT.' },
          { type:'p', text:'**v3.7 — 2026-04-26 레벨업 자동 갱신 시스템.** 사용자 신고 시스템 결함 fix.' },
          { type:'h2', text:'⭐ v3.7 레벨업 자동 갱신' },
          { type:'p', text:'• **이전 버그**: XP 는 누적되는데 rank_level 은 admin 수동 호출 때만 갱신 → 평생 멈춤.\n• **Fix**: services/rank.js 신규 + lazy trigger (BASE 진입 시 즉시 재계산) + 5분 batch 스케줄러.\n• Migration 186: rank_auto_recalc_* settings 4종 (admin 조정 가능).\n• **참고**: level 5+ 는 breakthrough condition 있음 (예: lv5 = pixels ≥ 10). XP 만 채워도 안 올라감 — 추가 조건 미충족 시 정상적으로 막힘.' },
          { type:'p', text:'**v3.6 — 2026-04-26 함대전 데이터 로딩 가드 + 파벌 스타터 검증.** 사용자 신고 즉각 fix.' },
          { type:'h2', text:'⚔ v3.6 함대전 "전투 데이터 로딩 실패" fix' },
          { type:'p', text:'• `openBattleViewer(undefined)` 호출 시 15초 폴링 후 실패 토스트 → 가드 추가로 즉시 안내.\n• 폴링 실패 시 lastErr 메시지 토스트에 포함 → 진단 가능.\n• Hijack/AI 챌린지 응답에 battle_id 없으면 console.warn (silent abort).' },
          { type:'h2', text:'🚀 v3.6 파벌 스타터 함선 자동 지급 (검증 완료)' },
          { type:'p', text:'• 파벌 선택 시 활성 함선 0척이면 자동으로 가장 싼 frigate 지급 + 함대 자동 편성 + 기함 지정.\n• 파벌별: MCC 프리즘 50GP / FSP 스프라이트 80GP / CV 슬래셔 45GP.' },
          { type:'p', text:'**v3.5 — 2026-04-26 토스트 3종 복원 + 거버너 잔존 표시 방어 + 함선 이미지 슬롯 + Hijack 함대 정보 fix.** 사용자 신고 즉각 fix.' },
          { type:'h2', text:'⚔ v3.5 Hijack 함대 정보 에러 fix' },
          { type:'p', text:'• NPC 지갑(0xnpc_...) 으로 하이잭 시 "상대 함대 정보 확인 실패" 표시 → 라우트 충돌이었음.\n• `phaseC.js /hijack/:id` 가 `defender-info` 문자열까지 가로챔 → `parseInt(\'defender-info\')`=NaN → 400. \n• Fix: `:id(\\d+)` regex로 숫자만 매치하도록 강제. NPC/일반 유저 모두 함대 미리보기 정상.' },
          { type:'h2', text:'🍞 v3.5 토스트 3종 복원' },
          { type:'p', text:'• **거슬리던 화면 정중앙 토스트** 옛 시스템으로 원복.\n  - **showToast** = 화면 중앙 그린 알약\n  - **showFactionToast** = 하단 블루 박스\n  - **showNotification** = 우상단 카드 스택\n• 통합 시스템(e764e75) + stretch fix(f424b6a) 모두 무효화.' },
          { type:'h2', text:'👻 v3.5 거버너/사령관 잔존 표시 방어' },
          { type:'p', text:'• **사령관 없는데 메인 배너/베이스 공지가 남던 버그** → 백엔드 응답 정규화 + 클라이언트 즉시 hide 안전망.\n• governance 서비스가 commander/governor 비어있으면 응답에서 `null` + announcement 강제 `\'\'` 로 변환.\n• `_drawSectorOverlay`/sector 카드: announcement 표시 조건에 `&& s.governor` 추가.' },
          { type:'h2', text:'🚀 v3.5 함선 이미지 슬롯' },
          { type:'p', text:'• 조선소 함선 카드 + 건조 모달에 PNG 이미지 슬롯 추가. PNG 없으면 자동으로 SVG 실루엣 fallback.\n• `assets/ships/{code}.png` 또는 `assets/ships/{faction}_{size}.png` 파일만 넣으면 자동 적용.\n• 22종 함선 모두 지원. README 에 nano-banana/Gemini 프롬프트 가이드 첨부.' },
          { type:'h2', text:'🛠 v3.4 거버넌스 cleanup 도구' },
          { type:'p', text:'• **자동 expire 로직 부재** → admin GOVERNANCE 탭 에 두 버튼 추가:\n  - 🧹 **사령관 초기화** — commander_wallet + announcement 모두 NULL\n  - 🗑 **전체 거버넌스 초기화** — 모든 거버너 + 사령관 + 공지 일괄 클리어 (claims/pixels 유지)\n• governor/commander 교체 시 announcement 도 함께 NULL 처리 (잔존 메시지 방지)\n• 모든 거버넌스 변경 후 sector cache 무효화 → 클라이언트 즉시 반영' },
          { type:'h2', text:'🛠 v3.4 거버넌스 cleanup 도구' },
          { type:'p', text:'• **자동 expire 로직 부재** → admin GOVERNANCE 탭 에 두 버튼 추가:\n  - 🧹 **사령관 초기화** — commander_wallet + announcement 모두 NULL\n  - 🗑 **전체 거버넌스 초기화** — 모든 거버너 + 사령관 + 공지 일괄 클리어 (claims/pixels 유지)\n• governor/commander 교체 시 announcement 도 함께 NULL 처리 (잔존 메시지 방지)\n• 모든 거버넌스 변경 후 sector cache 무효화 → 클라이언트 즉시 반영' },
          { type:'h2', text:'🔄 v3.3 boot 동기화' },
          { type:'p', text:'• **처음 로딩 시 섹터가 모두 잠금 표시 (BASE 한번 누르면 정상)** → auto-login 시점에 user level 을 미리 fetch 해서 `profileLevel` DOM 채움 + 섹터 텍스처 재합성. 이제 페이지 로드 직후 정확한 잠금 상태.\n• **commander 교체 시 옛 메시지 잔존** ("커맨더 표시는 왜 남김?") → governance 서비스가 commander 교체 시 announcement 도 NULL 로 자동 초기화.' },
          { type:'h2', text:'🔄 v3.2 캐시/리프레시 fix' },
          { type:'p', text:'• **거버너 변경 후 옛 라벨 globe 에 남음** → `marsCanvasTexture` 캐시 무효화 + 재합성. sector data 변경 감지 시 즉시 globe 라벨 재렌더링.\n• **사령관 임기 끝났는데 옛 공지 그대로** → commander 없거나 announcement 비면 박스 자동 숨김 + 텍스트 비우기.\n• **페이지 두 번 로딩** → SW auto-reload 제거. HTML network-first 로 자연 nav 시 새 콘텐츠 자동 적용.\n• **구매가능 섹터 admin 변경 후 즉시 반영 안 됨** → 서버 cache 무효화 + 클라 60s polling/visibility/focus/toggle/claim 모두에서 자동 refresh.' },
          { type:'h2', text:'📱 v3.1 모바일/태블릿 안정화' },
          { type:'p', text:'• **iPhone 사이드바 stale 상태** → Service Worker 캐시(`mars-v3` → `v4`) + HTML network-first 로 fix. 다음 방문 시 새 UI 자동 적용.\n• **태블릿 (iPad portrait 820px) 바텀 네비 두 줄** → `.col-fab-wrap.show !important` 무력화. 단일 mob-bottom-nav 만 표시.\n• 사이드바 z-index 250 + safe-area 패딩 110px 로 바텀 네비 위에 깔끔하게 표시, 닫기 X 버튼(z 260) 항상 보임.' },
          { type:'h2', text:'🐛 v3.0 버그 수정' },
          { type:'p', text:'• 일일 출석체크 "Daily login failed" 오류 → 수정 (settings array 파싱).\n• Admin JOBS 통계 0으로만 표시 → 수정 (응답 형식 정렬).\n• Admin EVENTS 탭 빈 화면 → 수정 (탭 카테고리 누락).\n• 하이젝 지불금액 0.00 PP → max(existing, sectorBase) × HIJACK_MULT.\n• NPC 자동승리 → defender lookup `HAVING alive_ships > 0` + 함대 미리보기 모달.\n• 15개 서비스의 `u.wallet` JOIN 오타 → `u.wallet_address`로 일괄 수정.' },
          { type:'h2', text:'🎯 콘텐츠 확장' },
          { type:'p', text:'• **업적 29개** + 자동 트리거 (클레임/전투/마켓/함선/길드/가입 6개 이벤트).\n• **907개 admin 조정 가능 설정** (하드코딩 0% 원칙 강화).\n• Fleet Combat 패널을 새 `/api/fleets` 시스템에 재배선.\n• PVP 통합: Fleet Battles + Hijack (legacy ship-battle 제거).\n• 신규 진단 API: `/api/hijack/defender-info`, `/admin/api/fleet/npc-status`.' },
          { type:'h2', text:'🧹 정리' },
          { type:'p', text:'• 죽은 서비스 제거: weeklyChallenges, gpBurn, bounty, luckyBox, legacy battle.\n• 죽은 라우트 제거: factionRoutes v2, onboarding v1, territoryRoutes, public, publicRoutes.\n• betting v1 → warBetting v2 통합.\n• phantom 테이블 39개 일괄 생성 (마이그레이션 176~184).' },
          { type:'callout', variant:'tip', title:'개발자 분들께',
            text:'전체 기술 세부사항은 repo 루트의 `CHANGELOG.md`와 `AUDIT_FINDINGS.md` 참조. 실제 브라우저 렌더링 감사 결과는 §"실제 페이지 렌더링 감사" 참조.' }
        ]
      },
      { id: 'overview', icon: '🌍', title: '게임 개요',
        blocks: [
          { type:'p', text:'**Occupy Mars**는 Base 체인에서 돌아가는 **영토 정복 MMO**야. 3D 화성 지구본 위에 픽셀 영토를 클레임하고, 채굴로 PP를 모으고, 적을 습격하고, 길드로 뭉치고, 시즌 순위를 겨루는 — 짧게 말해 **디지털 화성 식민지화 게임**이지.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '핵심 게임 루프',
            '통화 구조 (USDT / PP / GP / XP)',
            '승리 조건',
            '진행 & 해금',
            '첫 5분 체크리스트'
          ]},

          { type:'h2', text:'1. 핵심 게임 루프' },
          { type:'p', text:'모든 활동은 아래 **5단계 루프**를 중심으로 돌아가. 한 바퀴 돌 때마다 영토·자본·명성이 커져.' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg">'+
              '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
              '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
              '<circle cx="60"  cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="60"  y="66">🏴</text><text x="60"  y="82" fill="#ff783c">CLAIM</text>'+
              '<circle cx="170" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="170" y="66">⛏</text><text x="170" y="82" fill="#ff783c">MINE</text>'+
              '<circle cx="280" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="280" y="66">🛡</text><text x="280" y="82" fill="#ff783c">DEFEND</text>'+
              '<circle cx="390" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="390" y="66">⚔</text><text x="390" y="82" fill="#ff783c">RAID</text>'+
              '<circle cx="480" cy="70" r="32" fill="rgba(255,120,60,.18)" stroke="#ffd166" stroke-width="2"/><text x="480" y="66">📈</text><text x="480" y="82" fill="#ffd166">GROW</text>'+
              '</g>'+
              '<line x1="94"  y1="70" x2="134" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="204" y1="70" x2="244" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="314" y1="70" x2="354" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<line x1="424" y1="70" x2="444" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
              '<path d="M480,100 Q480,130 260,130 Q60,130 60,100" fill="none" stroke="#ff783c" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="4,4" marker-end="url(#ar)"/>'+
            '</svg>',
            caption:'CLAIM → MINE → DEFEND → RAID → GROW → (다시 CLAIM)' },

          { type:'h2', text:'2. 통화 구조' },
          { type:'p', text:'게임 안에는 **4가지 자산**이 돌아다녀. 각각 역할이 다르니 혼동하지 마.' },
          { type:'table',
            headers:['자산','역할','획득','용도','전환 가능?'],
            rows:[
              [{v:'💵 USDT',cls:'mars'},  '실제 암호화폐',     '입금 (Base 체인)',              '프리미엄 클레임·코스메틱·칸티나', {v:'입금 / 출금',cls:'num'}],
              [{v:'🥔 PP',cls:'mars'},    '영토 토큰 (~$1)',  '영토 수확·가입/추천/입금',       '영토 클레임/업그레이드, →GP, →USDT 환금', {v:'→GP / →USDT (한도)',cls:'num'}],
              [{v:'🏛 GP',cls:'mars'},    '주 소비 통화',     '로그인·미션·전투·PP→GP',         '상점, 함선(건조/강화/수리/가챠), 업그레이드', {v:'PP→GP로 구매',cls:'num'}],
              [{v:'⭐ XP',cls:'mars'},    '계정 레벨',        '모든 활동',                      '계급 특전·수수료 부스트',        {v:'✕',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'GP로 쓰고, PP로 가치를 저장한다',
            text:'**GP가 거의 모든 소비처(상점·함선·업그레이드)의 통화**야. 보상으로 모으고 PP를 환전해서도 채워. **PP는 가치 토큰**으로 채굴해서 GP로 바꾸거나 운영 환율(변동 가능)로 USDT 환금(담보 풀 한도 내)해 — 고정 페그는 아니야. **USDT는 실돈**이라 카지노에서 베팅하면 진짜 돈이 날아가. 자세한 건 [토큰 이코노미](#tokens) §2 참고.' },

          { type:'h2', text:'3. 승리 조건' },
          { type:'callout', variant:'pro', title:'엔딩은 없다',
            text:'Occupy Mars는 **영원히 돌아가는 세계**야. 목표는 점수가 아니라 **영토 + 명성 + 거버넌스 파워**를 쌓아서 "아무도 무시 못 하는 커맨더"가 되는 거지. 시즌마다 리셋되는 건 랭킹 뿐, 영토와 자산은 영구야.' },

          { type:'h2', text:'4. 진행 & 해금' },
          { type:'p', text:'핵심 초반 루프는 **처음부터 열려 있어** — 영토·상점·마켓·캠페인은 레벨 제한이 없어. 고급 기능은 계정 레벨이 오를수록 해금돼. 잠긴 탭은 **🔒 + 필요 레벨** 뱃지로 표시돼.' },
          { type:'table',
            headers:['기능','해금 레벨'],
            rows:[
              ['영토 · 상점 · 마켓 · 캠페인', {v:'Lv 1 (오픈)',cls:'num'}],
              ['🚢 함대 & 조선소',           {v:'Lv 3',cls:'num'}],
              ['🚚 수송',                    {v:'Lv 4',cls:'num'}],
              ['⚔ PVP',                     {v:'Lv 6',cls:'num'}],
              ['🛡 길드',                    {v:'Lv 8',cls:'num'}],
              ['🏛 거버넌스',                {v:'Lv 10',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'플레이하면 레벨이 오른다',
            text:'클레임·하이젝·미션·로그인마다 XP가 들어와. 그냥 일일 루프만 돌려도 이 게이트들을 금방 지나가 — XP 표는 [토큰 이코노미](#tokens) §4 참고.' },

          { type:'h2', text:'5. 첫 5분 체크리스트' },
          { type:'p', text:'게임 처음 켰을 때 이 순서대로 하면 빠르게 본게임 진입 가능:' },
          { type:'table',
            headers:['#','할 일','실제 보상'],
            rows:[
              [{v:'1'}, '지갑 연결 & 닉네임 등록',                  {v:'매일 무료 함선 가챠 + 일일 로그인 GP',cls:'num'}],
              [{v:'2'}, '첫 픽셀 CLAIM',                             {v:'+2 XP / px',cls:'num'}],
              [{v:'3'}, '첫 USDT 입금',                              {v:'+50 XP + 10% PP 보너스',cls:'num'}],
              [{v:'4'}, '일일 퀘스트 무료티어 전부 완료',            {v:'≈ 0.1~0.3 PP + 15 XP',cls:'num'}],
              [{v:'5'}, '추천 코드 입력 → 내 코드 공유',              {v:'DYNASTY 체인 활성',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'막막하면 여기부터',
            text:'장기 수익의 핵심은 **일일 퀘스트 루틴 + POI 사냥 + DYNASTY 추천**이야. 채굴은 소액 베이스라인일 뿐. 자세한 건 [채굴 & 수익](#mining) §4 와 [DYNASTY](#dynasty) §8 참고.' }
        ]
      },
      { id: 'tokens', icon: '🪙', title: '토큰 이코노미',
        blocks: [
          { type:'p', text:'게임 내 모든 숫자는 4개의 자산 중 하나야. **각자 역할이 다르고 서로 완전히 호환되지 않아.** 이 섹션은 어떻게 벌고 어떻게 쓰는지 전부 정리.' },
          { type:'toc', label:'이 섹션 내용', items:[
            'USDT — 실제 화폐',
            'PP — 인게임 메인 통화',
            'GP — 거버넌스 포인트',
            'XP — 계정 레벨',
            '자산 흐름도 (스왑·변환)'
          ]},

          { type:'h2', text:'1. USDT — 실제 화폐' },
          { type:'p', text:'**Base 체인의 Tether USD**. 진짜 돈이야. 게임에서 민팅되지 않고, 오직 네 지갑에서 **입금/출금**만 가능해. 픽셀 클레임의 **기본 가격 단위**도 USDT로 매겨져.' },
          { type:'table',
            headers:['섹터 티어','픽셀당 기본가','배수 적용 후'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 최대 3 (동적)',cls:'num'}],
              [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 최대 2',cls:'num'}],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'입금 보너스',
            text:'USDT 입금시 자동으로 **+10% PP 보너스** 지급 (`deposit_pp_bonus=10`). 첫 입금은 추가로 **+50 XP** 일회성 보너스.' },
          { type:'callout', variant:'warn', title:'USDT는 실돈이다',
            text:'게임 내에서 `USDT` 라벨이 붙은 모든 숫자는 **네 실제 자금**이야. 카지노 탭에서 USDT로 베팅하면 실제 돈이 날아가. 항상 신중하게.' },

          { type:'h2', text:'2. PP — Pixel Points (가치 토큰)' },
          { type:'p', text:'PP는 **영토 채굴 가치 토큰**으로 운영 환율(변동 가능)로 USDT 환금 가능한 자산이야 — 고정 페그는 아니야. 신규 가입 보너스 + 입금/추천으로 받아. 일상 소비 통화가 아니라 **가치를 저장하고, GP로 바꾸고, USDT로 환금**하는 자산이지.' },
          { type:'formula', label:'PP 획득 경로',
            eq:'PP = ~영토 수확~ + ~가입 보너스~ + ~추천~ + ~입금 보너스~',
            note:'패시브 수확은 **유저당 1 PP/일** 상한(`mining_daily_cap_per_user=1.0`). PP는 희소하고 가치 있게 설계됐어 — 대량 파밍 불가.' },
          { type:'table',
            headers:['PP 용도','상세'],
            rows:[
              ['영토 클레임/업그레이드', {v:'픽셀 클레임 & 영토 업그레이드',cls:'num'}],
              ['PP → GP 환전',           {v:'동적 환율 5~20 GP/PP',cls:'num'}],
              ['PP → USDT 환금',         {v:'담보 한도 내',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'PP ↔ USDT 환금',
            text:'`SWAP` 탭에서 PP를 USDT로(또는 반대로) 바꿔. **환금은 운영자가 적립한 담보 풀 한도 내에서만 허용**돼 — 무제한 환금은 없어. 뱅크런 방어 규칙은 [PP ⇄ USDT 환금](#exchange) 참고.' },

          { type:'h2', text:'3. GP — Game Points (주 소비 통화)' },
          { type:'p', text:'GP는 **인게임 주 소비 통화**야. 상점, 함선 건조/강화/수리, 함선 가챠, 영토 업그레이드, 마켓 수수료, 거버넌스 행동 등에 써. 게임 플레이 보상 **그리고 PP→GP 환전**으로 모아.' },
          { type:'table',
            headers:['획득 방법','상세'],
            rows:[
              ['일일 로그인/미션',        {v:'로그인 + 일일 3종',cls:'num'}],
              ['POI 드롭 (70% 비중)',     {v:'10 ~ 50 GP/POI',cls:'num'}],
              ['로켓 드롭 (50% 비중)',    {v:'10 ~ 40 GP/드롭',cls:'num'}],
              ['전투 / 원정',             {v:'격침당 보상',cls:'num'}],
              ['PP → GP 환전',           {v:'5~20 GP/PP (동적)',cls:'num'}],
              ['섹터 세수 / 거버너',      {v:'섹터 지속 수입',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'GP가 부족하면 PP를 환전',
            text:'건조나 강화에 GP가 모자라면 `SWAP`/환전 탭에서 PP를 GP로 바꿔. 환율은 수요에 따라 PP당 5~20 GP 사이에서 변동해. 자세한 건 [PP → GP 환전](#exchange) §1 참고.' },

          { type:'h2', text:'4. XP & 계급' },
          { type:'p', text:'**모든 활동**에서 XP가 쌓여. 실제 계급 테이블 (총 30단계 — 일부만 표시):' },
          { type:'table',
            headers:['Lv','이름','필요 XP','랭크업 보상'],
            rows:[
              [{v:'1',cls:'num'},  'Dust Walker',    {v:'0',cls:'num'},       {v:'—',cls:'num'}],
              [{v:'5',cls:'num'},  'Storm Chaser',   {v:'1,600',cls:'num'},   {v:'+18 PP',cls:'num'}],
              [{v:'10',cls:'num'}, 'Lava Walker',    {v:'12,500',cls:'num'},  {v:'+85 PP',cls:'num'}],
              [{v:'15',cls:'num'}, 'Storm Commander',{v:'42,000',cls:'num'},  {v:'+260 PP',cls:'num'}],
              [{v:'20',cls:'num'}, 'God of Mars',    {v:'100,000',cls:'num'}, {v:'+700 PP',cls:'num'}],
              [{v:'25',cls:'num'}, 'Crimson Archon', {v:'260,000',cls:'num'}, {v:'+2,000 PP',cls:'num'}],
              [{v:'30',cls:'num'}, 'Architect of Worlds', {v:'1,000,000',cls:'num'}, {v:'+6,000 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'XP 획득량',
            text:'`xp_per_claim=2/px`, `xp_per_hijack=3/px`, 일일 퀘스트 `5 XP`, 주간 퀘스트 `30 XP`, 일일 로그인 `5 XP`, 첫 입금 `50 XP`, 영토 방어 1주 생존 시 `1 XP/px`.' },
          { type:'callout', variant:'pro', title:'랭크업 게이트',
            text:'Lv 5 · 10 · 15 · 20 · 25 에서 단순 XP 외에 **활동 요건**이 있어 (보유 픽셀 수, 게임 플레이 일수, 하이잭 횟수, 입금액 등). XP만 쌓아선 못 뚫어.' },

          { type:'h2', text:'5. 자산 흐름도' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" font-family="monospace">'+
              '<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
              '<rect x="30"  y="30" width="110" height="50" rx="6" fill="rgba(91,184,232,.1)" stroke="#5bb8e8" stroke-width="1.5"/>'+
              '<text x="85"  y="55" text-anchor="middle" font-size="12" fill="#5bb8e8" font-weight="700">USDT</text>'+
              '<text x="85"  y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">실제 화폐</text>'+
              '<rect x="195" y="30" width="110" height="50" rx="6" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/>'+
              '<text x="250" y="55" text-anchor="middle" font-size="12" fill="#ff783c" font-weight="700">PP</text>'+
              '<text x="250" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">가치 토큰 ~$1</text>'+
              '<rect x="360" y="30" width="110" height="50" rx="6" fill="rgba(255,209,102,.1)" stroke="#ffd166" stroke-width="1.5"/>'+
              '<text x="415" y="55" text-anchor="middle" font-size="12" fill="#ffd166" font-weight="700">GP</text>'+
              '<text x="415" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">주 소비 통화</text>'+
              '<line x1="140" y1="55" x2="190" y2="55" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="165" y="48" text-anchor="middle" font-size="8" fill="#ff783c">환금</text>'+
              '<line x1="190" y1="60" x2="140" y2="60" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)" stroke-dasharray="3,3"/>'+
              '<line x1="305" y1="55" x2="355" y2="55" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="330" y="48" text-anchor="middle" font-size="8" fill="#ffd166">PP→GP 5-20</text>'+
              '<text x="250" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">영토 채굴·보너스 ↓</text>'+
              '<line x1="250" y1="125" x2="250" y2="80" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="415" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">로그인·미션·전투 ↓</text>'+
              '<line x1="415" y1="125" x2="415" y2="80" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="85"  y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">입금 ↓</text>'+
              '<line x1="85"  y1="125" x2="85"  y2="80" stroke="#5bb8e8" stroke-width="1.5" marker-end="url(#ar2)"/>'+
              '<text x="250" y="160" text-anchor="middle" font-size="9" fill="#ff783c" letter-spacing="1">ASSET FLOW — USDT ⇄ PP → GP (PP→GP 동적 환율)</text>'+
            '</svg>',
            caption:'USDT ⇄ PP 환금(담보 한도 내) / PP → GP 동적 환율 5~20' }
        ]
      },
      { id: 'wallet', icon: '🔐', title: '지갑 & 키 보관',
        blocks: [
          { type:'p', text:'플레이에 메타마스크나 외부 지갑이 **필요 없습니다.** 이메일로 가입하면 게임이 **자동으로 실제 지갑(키페어)을 생성**해 줍니다. 이 지갑이 당신의 온체인 자산을 보관하며, 모든 게임 행동이 이 지갑에 연결됩니다.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '자동 생성 지갑',
            '개인키 열람 & 백업',
            '키 보관 책임 (면책)',
            '입금 & 출금'
          ]},

          { type:'h2', text:'1. 자동 생성 지갑' },
          { type:'p', text:'이메일 가입 시 게임이 내부적으로 진짜 **키페어**를 생성합니다. 브라우저 확장 프로그램, 별도 지갑 앱, 시드 구문 설정이 전혀 필요 없습니다. 가입 즉시 영토 클레임과 수익 활동을 시작할 수 있습니다.' },
          { type:'callout', variant:'info', title:'메타마스크 불필요',
            text:'실제 지갑이 자동으로 발급됩니다. 발급된 주소가 인게임 신원이자 입금받는 주소가 됩니다.' },

          { type:'h2', text:'2. 개인키 열람 & 백업' },
          { type:'p', text:'본인의 **개인키를 언제든 열람하고 백업**할 수 있습니다. **BASE의 지갑 패널**을 열고 **🔑 KEY** 버튼을 누른 뒤 비밀번호를 재확인하면 키가 표시되어 복사·보관할 수 있습니다.' },
          { type:'callout', variant:'tip', title:'오프라인에 백업하세요',
            text:'키를 오프라인의 안전한 곳(예: 금고 속 종이 메모, 암호화된 오프라인 파일)에 복사해 두세요. 자산 접근을 복구할 수 있는 유일한 수단입니다.' },

          { type:'h2', text:'3. 키 보관 책임 (면책)' },
          { type:'callout', variant:'warn', title:'⚠ 개인키 보관 책임은 전적으로 본인에게 있습니다',
            text:'개인키 보관 책임은 **전적으로 본인에게 있습니다.** 분실·도난 시 **운영자는 키나 자산을 복구할 수 없습니다** — 초기화도, 백도어도 없습니다. 키는 오프라인에 안전하게 보관하고, 운영진을 사칭하는 사람을 포함해 **누구에게도 절대 공유하지 마세요.**' },

          { type:'h2', text:'4. 입금 & 출금' },
          { type:'p', text:'자금 충전은 자동 생성된 지갑을 사용합니다:' },
          { type:'table',
            headers:['행동','동작 방식'],
            rows:[
              ['USDT 입금', {v:'자동 감지되어 게임 잔고에 반영',cls:'num'}],
              ['출금',      {v:'보안 절차(비밀번호 / 서명)를 거침',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'입금은 자동 감지됩니다',
            text:'Base 체인의 지갑으로 들어온 USDT는 **자동으로 감지**되어 게임 잔고에 반영됩니다. **출금은 보안 절차(비밀번호 / 서명)**를 통과한 뒤에 처리됩니다.' }
        ]
      },
      { id: 'territory', icon: '🏴', title: '영토 시스템',
        blocks: [
          { type:'p', text:'화성 표면의 **픽셀**을 사는 게 이 게임의 출발점이야. 한 번의 클레임으로 사각형 영역을 지정하고 이미지를 업로드해서 네 깃발을 꽂아.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '클레임 기본 규칙',
            '섹터 티어별 가격',
            '하이잭 (영토 탈취)',
            '쉴드 (방어)',
            '이미지 업로드 제한',
            '영토 이름 변경',
            '컨디션·등급·정비(TEND)'
          ]},

          { type:'h2', text:'1. 클레임 기본 규칙' },
          { type:'p', text:'`CLAIM` 버튼을 누르고 지구본 위에서 사각형을 드래그 → 이미지 업로드 → 결제. 한 번의 트랜잭션으로 최대 **500×500 px** 까지 잡을 수 있어 (`max_claim_width=500`, `max_claim_height=500`).' },
          { type:'callout', variant:'info', title:'픽셀은 영구 소유',
            text:'한 번 산 픽셀은 **시즌이 리셋돼도 사라지지 않아**. 하이잭 당하거나 스스로 포기하기 전까지는 영구 자산이야.' },

          { type:'h2', text:'2. 섹터 티어별 가격' },
          { type:'p', text:'화성 표면은 3개 티어로 나뉘어 있어. 중심부로 갈수록 비싸지만 수확 주기도 빨라져.' },
          { type:'table',
            headers:['티어','픽셀당 기본가','동적 배수','특징'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 최대 3.0',cls:'num'}, '수확 24h·하이잭 타겟'],
              [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 최대 2.0',cls:'num'}, '수확 48h·밸런스형'],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1.0',cls:'num'},      '수확 72h·변방']
            ]},
          { type:'callout', variant:'tip', title:'가격은 수요에 따라 움직인다',
            text:'티어별 가격은 **동적 배수**가 곱해져. 해당 섹터에 이미 팔린 픽셀이 많을수록 가격이 올라가서 최대 3배까지 튀어. 싸게 사고 싶으면 활동 없는 섹터를 노려.' },

          { type:'h2', text:'3. 하이잭 — 영토 탈취' },
          { type:'p', text:'누군가 이미 소유한 픽셀 위에 클레임하면 **하이잭**이야. 기존 가격의 **1.2배**를 지불하면 영토가 넘어와 (`hijack_multiplier=1.2`).' },
          { type:'table',
            headers:['항목','값','비고'],
            rows:[
              ['기본 배수',         {v:'× 1.2',cls:'num'},    '공격자가 원가의 1.2배 지불'],
              ['원주인 회수',       {v:'110 %',cls:'num'},    '원가 100% + 프리미엄(0.2x)의 절반 → 원주인 합 1.1x'],
              ['플랫폼 수수료',     {v:'10 %',cls:'num'},     '나머지 0.1x는 금고로'],
              ['쉴드 차감',         {v:'50 ~ 75 %',cls:'num'},'쉴드가 걸려있으면 피해 흡수']
            ]},
          { type:'callout', variant:'warn', title:'⚠ 하이잭 전투의 함선 영구파괴',
            text:'하이잭은 **함대전**으로 번질 수 있고, 거기서 격침된(HP 0) 함선은 **영구 손실**돼 — 되살릴 수 없고 조선소에서 재건조해야 해 (`hijack_ship_loss_enabled=true`). 잃어도 되는 함대만 투입해. 건조/수리는 [함대 & 조선소](#fleet) 참고.' },
          { type:'callout', variant:'warn', title:'섣부른 하이잭은 손해',
            text:'비싼 CORE 섹터에서 하이잭하면 비용이 금방 수십 USDT로 뛰어. 타겟은 **1주일 이상 활동 없는 대형 영토**가 가성비 최고. 작은 땅 빼앗으려고 하이잭 하면 수수료만 날려.' },
          { type:'callout', variant:'pro', title:'하이잭도 시즌 점수',
            text:'하이잭으로 뺏은 픽셀마다 `xp_per_hijack=3 XP`. 시즌 리더보드 상위권은 전부 하이잭 달인이야.' },

          { type:'h2', text:'4. 쉴드 — 방어 아이템' },
          { type:'p', text:'쉴드를 장착하면 하이잭 피해를 일정 % **흡수**해. 상점에서 PP/USDT 어느 쪽으로도 살 수 있어.' },
          { type:'table',
            headers:['아이템','비용','지속','흡수율'],
            rows:[
              [{v:'⚡ 기본 에너지 쉴드',cls:'mars'},{v:'2.5 PP / 2.5 USDT',cls:'num'}, {v:'12 시간',cls:'num'}, {v:'50 %',cls:'num'}],
              [{v:'💠 플라즈마 쉴드',cls:'mars'},{v:'5.0 PP / 5.0 USDT',cls:'num'}, {v:'24 시간',cls:'num'}, {v:'75 %',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'기본은 12h 에너지 쉴드',
            text:'2.5 PP면 하이잭 피해 절반을 깎아. 일일 퀘스트 보상 하나만 챙겨도 쉴드 하나 살 수 있으니 매일 걸어두는 게 국룰.' },

          { type:'h2', text:'5. 이미지 업로드 제한' },
          { type:'table',
            headers:['항목','제한','비고'],
            rows:[
              ['최대 용량', {v:'5 MB',cls:'num'},                '`max_image_size_mb=5`'],
              ['허용 포맷', {v:'PNG · JPG · GIF · WEBP',cls:'num'},'애니메이션 GIF 지원'],
              ['링크 URL', {v:'https:// 만',cls:'num'},          '보안상 http 금지']
            ]},
          { type:'callout', variant:'tip', title:'움직이는 GIF는 호버에서 재생',
            text:'애니메이션 GIF를 올리면 지구본에서 네 영토가 호버될 때 재생돼. 중요한 영토일수록 움직이는 걸 쓰는 게 눈에 띄어.' },

          { type:'h2', text:'6. 영토 이름 변경' },
          { type:'p', text:'영토를 클릭하면 뜨는 정보 팝업에 **커스텀 이름**을 붙일 수 있어. 비용은 아주 저렴해.' },
          { type:'table',
            headers:['항목','비용'],
            rows:[
              ['영토 이름 변경', {v:'0.3 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'이름은 길드·하이잭 심리전 무기',
            text:'"Do Not Hijack — Woo\'s HQ" 같은 이름을 붙이면 실제로 하이잭 시도가 줄어. 커뮤니티 매너가 있는 플레이어들은 대부분 이름 있는 영토는 건드리지 않거든.' },

          { type:'h2', text:'7. 컨디션·등급·정비(TEND)' },
          { type:'p', text:'모든 영토에는 **컨디션(0~100, HP 개념)**과 **등급(F → S)**이 있어. 컨디션은 **매일 조금씩 감쇠**해서, 손대지 않으면 영토 등급이 서서히 내려가. 영토 **PRODUCTION** 패널을 열면 HP 바와 등급 뱃지를 볼 수 있어.' },
          { type:'table',
            headers:['등급','수확 PP','광물 드롭'],
            rows:[
              [{v:'S',cls:'mars'}, {v:'× 1.50',cls:'num'}, {v:'× 1.50',cls:'num'}],
              [{v:'A',cls:'mars'}, {v:'× 1.25',cls:'num'}, {v:'× 1.30',cls:'num'}],
              [{v:'B',cls:'mars'}, {v:'× 1.10',cls:'num'}, {v:'× 1.15',cls:'num'}],
              [{v:'C',cls:'mars'}, {v:'× 1.00',cls:'num'}, {v:'× 1.00',cls:'num'}],
              [{v:'D',cls:'mars'}, {v:'× 0.85',cls:'num'}, {v:'× 0.90',cls:'num'}],
              [{v:'F',cls:'mars'}, {v:'× 0.60',cls:'num'}, {v:'× 0.75',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'🔧 TEND로 수익을 유지한다',
            text:'PRODUCTION 패널의 **🔧 TEND(정비)** 버튼은 GP를 소모해 컨디션을 회복하고 등급을 다시 끌어올려. **등급이 높을수록 수확 PP와 광물 드롭이 늘어나니까**, 좋은 영토를 꾸준히 정비하면 그 비용은 본전을 뽑아. 등급 F까지 방치하면 잠재 수익의 절반 남짓밖에 못 벌어.' }
        ]
      },
      { id: 'mining', icon: '⛏', title: '채굴 & 수익',
        blocks: [
          { type:'p', text:'화성에서 PP(Potato Points)를 버는 방법은 5가지야. **패시브 채굴**은 안정적인 기본 수입이지만 **수익률은 크지 않아**. 큰 돈은 POI·로켓·일퀘·커미션(DYNASTY)에서 나와.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '영토별 수확 방법',
            '패시브 채굴 공식 (실제 수치)',
            '보유 픽셀별 수확량',
            '티어별 수확 주기',
            '광물 드롭 테이블',
            'POI (자원 지점)',
            '로켓 이벤트',
            '일일 퀘스트',
            '커미션 수익 (DYNASTY)'
          ]},

          { type:'h2', text:'0. 영토별 수확 방법' },
          { type:'p', text:'BASE → **내 영토** 탭에서 내 영토 목록을 확인할 수 있어. 각 영토 행을 탭하면 아코디언이 열리고, `⛏ 수확` 버튼으로 **해당 영토만 개별 수확**해. 영토마다 쿨다운이 따로 있으니 각각 관리해야 해.' },
          { type:'callout', variant:'tip', title:'영토마다 수확 타이밍이 다를 수 있어',
            text:'코어 영토는 24h 주기, 미드는 48h, 프론티어는 72h. 아코디언에서 "다음 수확: Xh Ym"을 확인하고 타이밍 맞춰 수확하는 게 효율적이야.' },

          { type:'h2', text:'1. 패시브 채굴 공식' },
          { type:'p', text:'영토를 보유하고 있는 한, 매 수확 주기마다 **자동으로** PP가 쌓여. BASE → 내 영토 탭의 각 영토 아코디언에서 `⛏ 수확` 버튼으로 개별 수령해.' },
          { type:'formula', label:'HARVEST YIELD PER CYCLE',
            eq:'Yield = rand(~0.01~, ~0.5~) × min( ~√pixels~ ÷ 10, ~3.0~ )   →   max ~1.0 PP~ / harvest',
            note:'핵심: **제곱근 스케일 + 3배 캡 + 하베스트당 1 PP 상한**. 픽셀을 10,000배 더 사도 수익은 3배 밖에 안 올라. 고래 방지 설계야.' },
          { type:'callout', variant:'warn', title:'중요 — 픽셀은 무한 스케일 아니다',
            text:'`pixelFactor`가 √pixels/10 으로 **제곱근**이야. 1 픽셀 → 0.1, 100 → 1.0, 1,000 → 3.0 (상한). 1,000 픽셀 넘으면 **추가 픽셀당 채굴 수익은 0**이야. 채굴만 노리고 땅 계속 사는 건 낭비.' },
          { type:'callout', variant:'info', title:'티어 배수는 "주기"에만 적용',
            text:'CORE/MID/FRONTIER 차이는 **수확 주기**(24h / 48h / 72h)지 **보상 금액**이 아니야. 영토가 여러 티어에 걸쳐있으면 가장 좋은 티어(CORE > MID > FRONTIER) 주기가 전체에 적용돼.' },

          { type:'h2', text:'2. 보유 픽셀별 수확량 (평균)' },
          { type:'table',
            headers:['보유 픽셀','pixelFactor','주기당 평균','CORE 일일','FRONTIER 일일'],
            rows:[
              [{v:'1 px'},      {v:'0.10',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.009 PP',cls:'num'}],
              [{v:'10 px'},     {v:'0.32',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.027 PP',cls:'num'}],
              [{v:'100 px'},    {v:'1.00',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.085 PP',cls:'num'}],
              [{v:'1,000 px'},  {v:'3.00 (캡)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}],
              [{v:'10,000 px'}, {v:'3.00 (캡)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'하드 캡',
            text:'각종 부스트(거버너 +20%·섹터 버프 +20%·더블마이닝 ×2·날씨·스타링크·아이템)가 곱해지지만, 최종값은 **1 하베스트당 1.0 PP**로 고정 상한. 즉 최상위 플레이어도 **하루 최대 약 1 PP** 정도만 패시브로 받아.' },
          { type:'callout', variant:'pro', title:'프로 팁',
            text:'채굴만으론 상위권 못 가. 패시브 채굴은 "기본 생활비" 수준. 실제 성장은 **POI 사냥 + 일일 퀘스트 + DYNASTY 커미션**에서 터져. 아래 섹션들 잘 봐.' },

          { type:'h2', text:'3. 티어별 수확 주기' },
          { type:'table',
            headers:['티어','수확 주기','일일 하베스트 횟수','비고'],
            rows:[
              [{v:'🔴 CORE',cls:'mars'},     {v:'24 h',cls:'num'}, {v:'1회',cls:'num'}, '중심부 — 고트래픽·하이잭 타겟'],
              [{v:'🟡 MID',cls:'mars'},      {v:'48 h',cls:'num'}, {v:'0.5회',cls:'num'}, '중간 — 균형형'],
              [{v:'⚪ FRONTIER',cls:'mars'}, {v:'72 h',cls:'num'}, {v:'0.33회',cls:'num'}, '변방 — 싸지만 느려']
            ]},
          { type:'callout', variant:'tip', title:'동일 면적 3배 효율',
            text:'CORE 1픽셀 + FRONTIER 999픽셀 > FRONTIER 1000픽셀. 주기가 24h로 짧아져서 **같은 면적으로 3배 더 자주** 수확해. 가장 싼 CORE 부동산 한 칸을 앵커로 꽂는 게 국룰.' },

          { type:'h2', text:'3-1. 광물 드롭 테이블' },
          { type:'p', text:'채굴 시 PP와 함께 섹터 티어에 따라 **광물이 확률적으로 드롭**돼. 광물은 함선 건조·강화 재료 및 마켓 거래에 사용돼. 아코디언에서 해당 영토의 드롭 가능 광물을 미리 확인할 수 있어.' },
          { type:'table',
            headers:['티어','드롭 광물 (예시)','용도'],
            rows:[
              [{v:'⚪ FRONTIER',cls:'mars'}, '🟤 철분 / 🔴 붉은 모래 / ⬛ 현무암 조각 / 🔵 얼음 결정 / 🟠 레골리스', 'T1 — 기본 함선 건조'],
              [{v:'🟡 MID',cls:'mars'},      '🧵 탄소섬유 / 🪨 철광석 / 💠 실리콘칩 / ☄️ 운석파편 / ⬢ 합금프레임', 'T2 — 고급 건조·강화'],
              [{v:'🔴 CORE',cls:'mars'},     '🔮 플라즈마 결정 / ⚙️ 티타늄합금 / 🧬 나노폴리머 / ✨ 이국합금 / ⚡ 양자코어', 'T3 — 전함급 건조·Lv10+ 강화']
            ]},
          { type:'callout', variant:'info', title:'강화 티어와 드롭 연결',
            text:'함선 강화는 강화 횟수(레벨)에 따라 요구 재료 등급이 올라가. Lv1~5 = T1, Lv6~10 = T2, Lv11+ = T3. 높은 레벨로 강화된 함선은 **T3 코어 섹터 광물**을 소모했다는 의미라서 마켓에서 가치가 있어.' },

          { type:'h2', text:'4. POI — 자원 지점' },
          { type:'p', text:'화성 표면에 랜덤으로 **자원 포인트**가 생성돼. `EXPLORE` 탭에서 지도를 열고 찾아가서 `🔍 DISCOVER` 버튼 누르면 보상 수령. **영토 없어도 누구나 수확 가능** — 선착순이야.' },
          { type:'table',
            headers:['항목','값','출처'],
            rows:[
              ['스폰 주기',          {v:'4시간마다',cls:'num'},             '`poi_spawn_interval_hours=4`'],
              ['주기당 생성 수',      {v:'6개 (최대 12개 동시)',cls:'num'},  '`poi_count_per_cycle=6, poi_max_active=12`'],
              ['만료 시간',          {v:'12시간',cls:'num'},                '`poi_expire_hours=12`'],
              ['탐사 수수료',        {v:'관리자 설정 (기본 0 PP)',cls:'num'}, '`exploration_fee_pp`'],
              ['발견 XP 보너스',      {v:'+5 XP',cls:'num'},                 '`poi_discovery_xp=5`']
            ]},
          { type:'h2', text:'POI 드롭 테이블 (실제 가중치)' },
          { type:'table',
            headers:['드롭 종류','가중치','보상 범위','비고'],
            rows:[
              [{v:'🏛 GP',cls:'mars'},   {v:'70 %',cls:'num'},  {v:'10 ~ 50 GP',cls:'num'},      '가장 흔함'],
              [{v:'📦 아이템',cls:'mars'}, {v:'20 %',cls:'num'},  {v:'드롭 테이블 무작위',cls:'num'}, '쉴드·부스트 등'],
              [{v:'🥔 PP',cls:'mars'},   {v:'10 %',cls:'num'},  {v:'0.05 ~ 0.3 PP',cls:'num'},   '가장 드뭄'],
              [{v:'✨ 코스메틱',cls:'mars'}, {v:'+5 %',cls:'num'},  {v:'위에 추가 굴림',cls:'num'},  '모든 발견에 추가 보너스']
            ]},
          { type:'callout', variant:'info', title:'스케일 보정',
            text:'보상량은 **활성 유저 수**에 따라 자동 스케일 — 10명당 +10%, 최대 ×3까지. 유저가 많을수록 보상도 커져.' },
          { type:'callout', variant:'pro', title:'POI가 가장 활동적 수익원',
            text:'채굴은 하루 1 PP 남짓이지만 POI는 **GP 드롭**이 커. 12시간 안에 6개 POI 중 몇 개만 먹어도 수십 GP가 쌓여. GP는 거버너 선거·섹터 세수로 연결되니 장기 수익.' },

          { type:'h2', text:'4. 로켓 이벤트' },
          { type:'p', text:'**12시간마다** 로켓이 랜덤 위치에 착륙해 대규모 전리품을 뿌려. 착륙 2시간 전 경고 → 1시간 루팅 창. 5% 확률로 `RUD` (폭발) — 드롭 2배·반경 2배.' },
          { type:'table',
            headers:['드롭 종류','가중치','값','비고'],
            rows:[
              [{v:'🏛 GP',cls:'mars'},       {v:'50 %',cls:'num'}, {v:'10 ~ 40 GP',cls:'num'}, '가장 흔함'],
              [{v:'📦 아이템',cls:'mars'},    {v:'25 %',cls:'num'}, '드롭 테이블', '쉴드·부스트'],
              [{v:'⭐ XP',cls:'mars'},       {v:'17 %',cls:'num'}, {v:'5 ~ 25 XP',cls:'num'}, '—'],
              [{v:'🥔 PP',cls:'mars'},       {v:'6 %',cls:'num'},  {v:'0.02 ~ 0.1 PP',cls:'num'}, '드뭄'],
              [{v:'🚀 스타쉽 테두리',cls:'mars'}, {v:'2 %',cls:'num'},  {v:'1개',cls:'num'},        '한정 코스메틱']
            ]},
          { type:'callout', variant:'warn', title:'RUD는 대박이지만',
            text:'5% 확률로 발동되는 **RUD(Rapid Unscheduled Disassembly)** = 폭발. 일반 15개 → RUD 30개 드롭. 반경도 5km → 10km 2배. 경쟁자가 몰릴 수 있으니 준비하고 가.' },

          { type:'h2', text:'5. 일일 퀘스트' },
          { type:'p', text:'매일 퀘스트가 리셋돼. 무료/활동/지출 3티어로 나뉘어 있고 완료하면 PP + XP 획득. 완료 XP는 고정 **5 XP/퀘스트** (주간 퀘스트는 30 XP).' },
          { type:'table',
            headers:['티어','퀘스트 예시','보상 범위'],
            rows:[
              ['💫 무료',   '로그인 / 섹터 보기 / 첫 픽셀',   {v:'0.01 ~ 0.05 PP',cls:'num'}],
              ['⚡ 활동',   '클레임 / 수확 / 섹터 탐험 / 연속 로그인',  {v:'0.05 ~ 0.50 PP',cls:'num'}],
              ['💎 지출',   '입금 / 프리미엄 클레임 / 스왑 / 대규모 확장', {v:'0.30 ~ 1.50 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'매일 5분, 확정 수익',
            text:'일일 퀘스트는 **확정 보상**이야. 채굴보다 상위 퀘스트가 훨씬 PP 수익이 좋고 XP도 쌓여. 랭크 업 속도는 퀘스트가 결정해.' },

          { type:'h2', text:'6. 커미션 수익 (DYNASTY)' },
          { type:'p', text:'누군가를 추천하면, 그들이 쓰는 **6가지 활동**(입금 · 스왑 · 상점 · 수확 · 칸티나 · 하이잭) 전부에서 자동 커미션이 네 지갑으로 들어와. 3단계 MLM 구조로 친구의 친구의 친구까지 쌓여.' },
          { type:'callout', variant:'pro', title:'장기적으로는 이게 제일 크다',
            text:'영토·채굴은 선형 성장(내가 일한 만큼), **DYNASTY는 네트워크 효과**야. 활발한 유저 5명만 초대해도 패시브 PP가 본인 채굴보다 많아지는 시점이 와. 자세한 건 [DYNASTY 추천](#dynasty) §8 참고.' }
        ]
      },
      { id: 'fleet', icon: '🚢', title: '함대 & 조선소',
        blocks: [
          { type:'p', text:'함선은 **잃을 수 있는 진짜 자산**이야. 조선소에서 건조하고, GP와 광물로 강화·수리하고, 함선 가챠로 희귀 함선을 노리고, 함선 마켓에서 거래해. 하이젝 전투에선 함선이 **영구 파괴**될 수 있어.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '함선 로스터 & 파벌',
            '조선소 — 건조 & 수리',
            '스탯 강화',
            '함선 가챠(Ship Crate)',
            '함선 마켓 (지역)',
            '영구파괴 경고'
          ]},

          { type:'h2', text:'1. 함선 로스터 & 파벌' },
          { type:'p', text:'3파벌(MCC / FSP / CV)에 걸쳐 **함선 22종**, 5개 사이즈 클래스가 있어. 큰 함급은 화력·탱킹이 강하지만 희귀한 Core/Mid 광물이 필요해. 타이탄은 서버 캡(종류당 생존 3척)으로 제한돼.' },
          { type:'table',
            headers:['함급','역할','건조 비용 티어'],
            rows:[
              [{v:'프리깃',cls:'mars'},   '고속 태클 / 전자전',        {v:'낮음',cls:'num'}],
              [{v:'구축함',cls:'mars'},   '스커미시 딜',               {v:'낮음–중간',cls:'num'}],
              [{v:'순양함',cls:'mars'},   '유연한 주력',               {v:'중간',cls:'num'}],
              [{v:'전함',cls:'mars'},     '중장 라인 — Core/Mid 광물', {v:'높음',cls:'num'}],
              [{v:'타이탄',cls:'mars'},   '캐피탈 — 서버 캡',          {v:'최상',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'🜲 기동 슈퍼유닛 (퍼펙트 가챠)',
            text:'`가챠`의 **퍼펙트 가챠 박스**에서 파츠를 모아 거대 슈퍼유닛을 **기동**시킬 수 있어. 한 유닛당 **파츠 5종**이 필요하고, 다 모으면 조선소 `기동` 탭에서 함대에 배치돼. 중복 파츠는 **조각**으로 분해되어 원하는 파츠와 교환 가능(코어 파츠는 교환비용이 더 비싸). 로봇 6종(볼타리스·이그니스·글라키우스·움브라·아우룸·템페스트)과 화성 외계 생명체 4종(디바우러·레비아탄·하이브 퀸·보이드 모)이 있고, 각각 무기 특화·상성이 달라. 중상위 성능이라 저격/폭격/전자전에 약점이 있고, 해체하면 파츠로 되돌아와(영구 손실 없음).' },

          { type:'h2', text:'2. 조선소 — 건조 & 수리' },
          { type:'p', text:'`조선소`를 열면 청사진이 보여. 각 카드는 GP + 광물 비용을 **보유 / 필요**로 표시하고, 어느 섹터 티어가 그 광물을 드롭하는지 ⛏ 뱃지로 알려줘. 건조하면 `ship_build_job`이 큐에 들어가고, 함선은 기본 함대에 편입돼.' },
          { type:'table',
            headers:['행동','비용','비고'],
            rows:[
              ['건조', {v:'GP + 광물',cls:'num'}, '전함/타이탄은 Core + Mid 광물 필요'],
              ['수리', {v:'GP + 광물',cls:'num'}, '전투 후 HP 회복'],
              ['실드', {v:'GP',cls:'num'},        '전투 전 피해 흡수'],
              ['해체', {v:'—',cls:'num'},         '분해해서 일부 회수']
            ]},
          { type:'callout', variant:'info', title:'판매중 함선은 잠김',
            text:'마켓에 등록된(`is_market_listed`) 함선은 등록을 취소하기 전까지 강화·수리·실드·해체·함대 이동이 모두 막혀.' },
          { type:'callout', variant:'tip', title:'신규 유저도 초반에 함선 제작 가능',
            text:'밸런스 보정으로 이제 **frontier 섹터에서도 일부 tier-2 제작 재료**가 드롭돼 — 비싼 CORE 영토 없이 저렴한 변방 땅만으로도 첫 함선을 만들 수 있어.' },

          { type:'h2', text:'3. 스탯 강화' },
          { type:'p', text:'보유 함선은 `atk / def / hp / speed`를 **영구 강화**할 수 있어. 강화는 **성공 확률**이 있고, 성공/실패 모두 GP + 재료를 소모해. 비용은 총 투자 횟수에 따라 올라가.' },
          { type:'callout', variant:'pro', title:'강화는 확률형',
            text:'실패해도 GP와 재료는 소모되고, 성공할 때만 스탯 보너스가 붙어. 전투 엔진이 `bonus_atk/def/hp/speed`를 직접 읽어서 실제 전투에 반영돼.' },

          { type:'h2', text:'4. 함선 가챠(Ship Crate)' },
          { type:'p', text:'**GP**로 함선 가챠를 열어 사이즈 클래스별 함선을 무작위로 얻어. 모든 상자는 **확률 공개**가 돼 있고, 프리미엄/레전더리 상자는 정해진 횟수에 도달하면 순양함 이상을 보장하는 **천장(pity)**이 있어.' },
          { type:'table',
            headers:['상자','가격','천장','최고 함급'],
            rows:[
              [{v:'📦 스탠다드',cls:'mars'},  {v:'300 GP',cls:'num'},  {v:'—',cls:'num'},      '순양함'],
              [{v:'🎁 프리미엄',cls:'mars'},  {v:'1,000 GP',cls:'num'},{v:'10회',cls:'num'},   '전함'],
              [{v:'🌟 레전더리',cls:'mars'}, {v:'3,000 GP',cls:'num'},{v:'5회',cls:'num'},    '타이탄']
            ]},
          { type:'callout', variant:'info', title:'서버 RNG + 타이탄 캡',
            text:'추첨은 서버 권위 RNG를 써. 타이탄 서버 캡이 가득 차면 타이탄 추첨은 전함으로 강등돼. 확률은 각 상자 카드에 표시돼.' },

          { type:'h2', text:'5. 함선 마켓 (지역)' },
          { type:'p', text:'`등록 → 구매 → 취소`로 함선을 거래해. 각 매물은 **판매자 거점 섹터**에 귀속돼: 매수 시 해당 **섹터 거버너에게 관세**가 붙을 수 있고, 운영자는 같은 섹터 구매만 허용하도록 제한할 수 있어 — 섹터를 거래 허브로 만들고 섹터 간 차익거래를 유발해.' },
          { type:'callout', variant:'tip', title:'섹터 관세를 보라',
            text:'세율 높은 CORE 섹터의 매물은 매수자가 추가 비용을 내. 더 싼 매물은 세율 낮은 프론티어 섹터에 있는 경우가 많아 — 대신 물류 부담이 있지.' },

          { type:'h2', text:'6. ⚠ 영구파괴 경고' },
          { type:'callout', variant:'warn', title:'격침된 함선은 영영 사라진다',
            text:'풀로스 적용 상태(`hijack_ship_loss_enabled=true`)에서 하이젝 전투 중 **HP 0이 된 함선은 영구 파괴**돼 — `is_alive=false`, 부활 불가. 조선소에서 다시 건조해야 해. 잃어도 되는 함대만 투입하고, 재건조용 예비 함선 + 광물을 비축해 둬.' }
        ]
      },
      { id: 'governance', icon: '🏛', title: '거버넌스',
        blocks: [
          { type:'p', text:'화성은 **두 단계 권력 구조**로 돌아가. 전역 1인자인 **커맨더**와 섹터마다 한 명씩 있는 **거버너**. 둘 다 세수·권한·이벤트 발동 같은 실제 게임 규칙을 바꿀 수 있어. 거버넌스는 구현된 실제 기능이야 — 상징적인 장식이 아냐.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '권력 구조 (커맨더 / 거버너)',
            '섹터 세금과 분배',
            '섹터 버프 (거버너 권한)',
            '글로벌 이벤트 (커맨더 권한)',
            '현상금 시스템',
            '거버넌스의 GP'
          ]},

          { type:'h2', text:'1. 권력 구조' },
          { type:'table',
            headers:['직책','범위','수','권한'],
            rows:[
              [{v:'👑 커맨더',cls:'mars'},     '전역',     {v:'1명',cls:'num'}, '글로벌 이벤트·전역 공지·현상금'],
              [{v:'⚔ 부커맨더',cls:'mars'},    '전역',     {v:'1명',cls:'num'}, '커맨더 부재 시 이벤트 대행'],
              [{v:'🏛 거버너',cls:'mars'},     '섹터',     {v:'섹터당 1명',cls:'num'}, '섹터 세율·섹터 버프·섹터 세수'],
              [{v:'⚖ 부거버너',cls:'mars'},    '섹터',     {v:'섹터당 1명',cls:'num'}, '세수 20% 수령']
            ]},
          { type:'callout', variant:'info', title:'선출 방식',
            text:'각 포지션은 **GP 보유량**이 가장 많은 플레이어가 차지해. 언제든 GP를 더 쌓으면 현 직책자를 밀어낼 수 있어 — 상시 선거야.' },

          { type:'h2', text:'2. 섹터 세금과 분배' },
          { type:'p', text:'거버너는 자기 섹터에서 일어나는 **클레임 비용에 세율**을 건다. 세율은 관리자가 설정한 범위 안에서 거버너가 직접 조정해.' },
          { type:'table',
            headers:['항목','값'],
            rows:[
              ['세율 범위',   {v:'1 ~ 5 %',cls:'num'}],
              ['기본 세율',   {v:'2 %',cls:'num'}],
              ['거버너 수령',  {v:'70 %',cls:'num'}],
              ['부거버너 수령',{v:'20 %',cls:'num'}],
              ['섹터 풀',     {v:'10 %',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'고트래픽 섹터 = 수익 머신',
            text:'인기 섹터 거버너가 되면 앉아있기만 해도 세수가 들어와. 타인이 클레임할 때마다 자동 정산이야. CORE 섹터는 세율 1%만 걸어도 금방 수백 USDT가 쌓여.' },

          { type:'h2', text:'3. 섹터 버프 — 거버너 권한' },
          { type:'p', text:'거버너는 GP를 태워서 섹터 전체에 버프를 걸 수 있어. 자기 영토뿐 아니라 **모든 주민에게 혜택**이 가. 선거 공약으로 많이 쓰여.' },
          { type:'table',
            headers:['버프','효과','비용 (GP)'],
            rows:[
              ['⛏ 채굴 부스트',  '섹터 전체 채굴 수확량 +20%', {v:'100 ~ 150',cls:'num'}],
              ['🛡 방어 보너스',  '쉴드 흡수율 증가',         {v:'100 ~ 150',cls:'num'}],
              ['💰 클레임 할인', '섹터 내 신규 클레임 가격 인하',{v:'100 ~ 150',cls:'num'}]
            ]},

          { type:'h2', text:'4. 글로벌 이벤트 — 커맨더 권한' },
          { type:'p', text:'커맨더는 **하루 1회** 전역 이벤트를 발동할 수 있어. 하나만 켤 수 있고 GP 소모가 큰 대신 전 화성에 영향을 줘.' },
          { type:'table',
            headers:['이벤트','효과','비용 (GP)'],
            rows:[
              ['⚡ 더블 마이닝', '전역 채굴 수확량 × 2',      {v:'300 ~ 500',cls:'num'}],
              ['⚔ 전시 체제',   '하이잭 XP·보상 증가',       {v:'300 ~ 500',cls:'num'}],
              ['🕊 평화 조약',   '일정 시간 하이잭 금지',     {v:'300 ~ 500',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'1일 1회 제한',
            text:'`max_global_events_per_day=1`. 커맨더가 아무리 GP가 많아도 하루에 한 번만 이벤트를 발동할 수 있어. 타이밍이 전략이야.' },

          { type:'h2', text:'5. 현상금 시스템' },
          { type:'p', text:'커맨더와 거버너는 특정 유저에게 **현상금**을 걸 수 있어. 현상금 타깃을 먼저 하이잭하는 사람이 보상을 전부 가져가.' },
          { type:'table',
            headers:['항목','값'],
            rows:[
              ['발행 권한',    '커맨더·거버너'],
              ['보상 타입',    'GP + 선택적 PP'],
              ['상태',         'active → claimed / expired / cancelled'],
              ['만료',         '발행 시 지정']
            ]},
          { type:'callout', variant:'pro', title:'현상금은 정치 도구',
            text:'경쟁자 거버너를 흔들고 싶으면 그의 핵심 영토에 현상금을 걸어. 다른 유저들이 습격하러 몰려오면 그 거버너는 방어에 쫓겨서 세수를 제대로 못 걷어.' },

          { type:'h2', text:'6. 거버넌스의 GP' },
          { type:'p', text:'거버넌스는 주 소비 통화인 GP로 돌아가. 게임 플레이 보상 **그리고 PP → GP 환전**(동적 5~20 환율)으로 모은 뒤 선거·섹터 지배·버프에 써. GP는 PP나 USDT로 되돌릴 수 없어.' },
          { type:'table',
            headers:['GP 획득 경로','일반 보상'],
            rows:[
              ['일일 로그인 (7일 주기)',  {v:'5 ~ 100 GP',cls:'num'}],
              ['일일 미션 (3개/일)',      {v:'10 ~ 25 GP 각',cls:'num'}],
              ['일일 미션 3개 완료',      {v:'+50 GP',cls:'num'}],
              ['POI 발견',               {v:'10 ~ 50 GP',cls:'num'}],
              ['시즌 랭킹 보상',          {v:'500 ~ 5000 GP',cls:'num'}],
              ['로켓 드롭',              {v:'10 ~ 40 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'거버너 되는 가장 빠른 길',
            text:'매일 출석 + 미션 3개 + POI 몇 개만 먹어도 일 100 GP는 쌓여. 한 달이면 3000 GP. 활동 없는 섹터 거버너는 그 정도면 밀어낼 수 있어.' }
        ]
      },
      { id: 'ops', icon: '🚀', title: 'OPS 미션',
        blocks: [
          { type:'p', text:'OPS 미션은 네 군사 작전 본부야. 합병된 영토의 발사대에서 **침공(⚔)** 또는 **탐사(🛰)** 두 종류를 출격시켜. 침공은 다른 플레이어 영토를 습격해서 PP·GP·XP를 빼앗고, 탐사는 좌표에 탐침을 쏘아서 PP·XP·희귀 아이템을 발견해.' },
          { type:'toc', label:'이 섹션 내용', items:[
            'OPS 미션이란',
            '발사대',
            '미션 등급',
            '보상',
            '타깃 중복 방지',
            '팁'
          ]},

          { type:'h2', text:'1. OPS 미션이란' },
          { type:'p', text:'합병한 영토가 곧 발사대야. 각 합병 영역 = 발사대 1개, 여기서 두 종류의 군사 작전을 출격시켜:' },
          { type:'table',
            headers:['종류','아이콘','타깃','수익'],
            rows:[
              [{v:'침공',cls:'mars'}, '⚔', '다른 플레이어 영토', 'PP + GP + XP'],
              [{v:'탐사',cls:'mars'}, '🛰', '좌표 탐침', 'PP + XP + 희귀 아이템']
            ]},
          { type:'callout', variant:'info', title:'두 가지 출격 방식',
            text:'침공은 직접 대결 — 상대 영토를 공격해서 자원을 탈취해. 탐사는 PvE — 지정 좌표에 탐침을 쏴서 보상을 발견해. 각각 리스크와 리턴이 달라.' },

          { type:'h2', text:'2. 발사대' },
          { type:'p', text:'합병된 영토가 자동으로 발사대가 돼. 발사대가 클수록 보상 배율이 높아져.' },
          { type:'table',
            headers:['속성','상세'],
            rows:[
              ['발사대 출처',    '합병 영토 1개 = 발사대 1기'],
              ['크기 배율',      {v:'×0.5 ~ ×3.0',cls:'num'}],
              ['배율 공식',      '√(픽셀 수 / 25), 상한·하한 클램프'],
              ['동시 제한',      '발사대 하나에 동시에 미션 1개만']
            ]},
          { type:'callout', variant:'pro', title:'큰 영토 = 큰 배율',
            text:'충분히 큰 합병 영토는 ×3.0 배율에 도달해 — 미션 보상이 통째로 3배야. 대형 합병 영토 건설이 OPS 수익을 끌어올리는 핵심 전략이야.' },

          { type:'h2', text:'3. 미션 등급' },
          { type:'p', text:'미션은 타깃까지의 거리에 따라 3등급으로 나뉘어. 거리가 멀수록 비용과 시간이 늘어나지만, 성공 시 보상도 커져.' },
          { type:'table',
            headers:['등급','거리','비용 (PP)','소요 시간','성공률'],
            rows:[
              [{v:'NEAR',cls:'mars'}, '< 30°',   {v:'0.2(침공) / 0.1(탐사)',cls:'num'}, {v:'~30분',cls:'num'}, {v:'80%',cls:'num'}],
              [{v:'MID',cls:'mars'},  '30–90°',  {v:'0.8 / 0.4',cls:'num'},              {v:'~2시간',cls:'num'},  {v:'65%',cls:'num'}],
              [{v:'FAR',cls:'mars'},  '> 90°',   {v:'1.5 / 1.0',cls:'num'},              {v:'~5시간',cls:'num'},  {v:'50%',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'실패 = 연료 손실',
            text:'미션 실패 시 보상은 제로지만, 발사 시 소모한 PP는 돌아오지 않아. 원거리 미션은 하이리스크·하이리턴 — 무리하지 마.' },

          { type:'h2', text:'4. 보상' },
          { type:'table',
            headers:['미션 종류','보상 내용','배율 적용'],
            rows:[
              ['⚔ 침공', 'PP + GP + XP',             '전부 발사대 배율 적용'],
              ['🛰 탐사', 'PP + XP + 희귀 아이템 확률', '전부 발사대 배율 적용']
            ]},
          { type:'callout', variant:'info', title:'배율이 전부를 결정해',
            text:'같은 FAR 침공이라도 ×1.0 발사대와 ×3.0 발사대에서 받는 PP는 3배 차이야. 가장 큰 발사대에서 먼저 출격시켜.' },

          { type:'h2', text:'5. 타깃 중복 방지' },
          { type:'p', text:'시스템이 자동으로 타깃 충돌을 방지해서 미션이 겹치지 않게 해:' },
          { type:'list', items:[
            '같은 영토에 두 개의 침공이 동시에 걸릴 수 없어',
            '중복 시 시스템이 자동으로 타깃의 다른 영토로 리다이렉트',
            '탐사 탐침 좌표가 겹치면 자동 오프셋'
          ]},

          { type:'h2', text:'6. 팁' },
          { type:'list', items:[
            '대형 합병 영토를 만들어서 ×3.0 배율을 노려',
            'FAR 미션은 리스크가 가장 높지만 보상도 최고 — 한판 걸어볼 때',
            '같은 길드 멤버는 침공 불가',
            'READY 상태 발사대가 리스트 맨 위에 정렬되니 편해'
          ]},
          { type:'callout', variant:'pro', title:'OPS는 능동 수익의 핵심',
            text:'채굴은 수동이고, OPS는 능동이야. OPS 미션을 일상적인 채굴과 결합하면 단순 방치보다 훨씬 많이 벌어.' }
        ]
      },
      { id: 'quests', icon: '📋', title: '퀘스트',
        blocks: [
          { type:'p', text:'퀘스트 시스템은 평소 플레이하면서 자동으로 진행도를 추적해 — 수동 조작 필요 없어. 항상 3개의 활성 퀘스트(등급별 1개씩)가 있고, 완료하면 PP 보상을 수령하고 새 퀘스트가 자동 갱신돼.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '퀘스트 등급',
            '퀘스트 작동 방식',
            '퀘스트 액션',
            '팁'
          ]},

          { type:'h2', text:'1. 퀘스트 등급' },
          { type:'p', text:'퀘스트는 3개 등급으로 나뉘고, 난이도와 보상이 단계적으로 올라가:' },
          { type:'table',
            headers:['등급','유형','보상','예시'],
            rows:[
              [{v:'FREE',cls:'mars'},     '간단한 일과', {v:'0.01 ~ 0.05 PP',cls:'num'}, '로그인, 섹터 보기, 기지 방문'],
              [{v:'ACTIVITY',cls:'mars'}, '게임플레이',   {v:'0.05 ~ 0.25 PP',cls:'num'}, '픽셀 클레임, 수확, 미션 출격, 칸티나'],
              [{v:'SPENDING',cls:'mars'}, '소비 행위',    {v:'0.30 ~ 1.50 PP',cls:'num'}, 'USDT 입금, 프리미엄 클레임, 대규모 확장']
            ]},
          { type:'callout', variant:'info', title:'3단계 병행',
            text:'항상 3개 퀘스트(등급별 1개)가 동시 활성. FREE 등급은 순수익, SPENDING 등급은 보상이 가장 크지만 지출이 필요해.' },

          { type:'h2', text:'2. 퀘스트 작동 방식' },
          { type:'list', items:[
            '동시에 3개 활성 퀘스트 (등급별 1개)',
            '평소 플레이하면 자동으로 진행도 추적 — 수동 클릭 불필요',
            '완료 후 PP 보상 수령',
            '수령 후 새 퀘스트 자동 갱신, 쿨다운 24h ~ 168h'
          ]},

          { type:'h2', text:'3. 퀘스트 액션' },
          { type:'p', text:'시스템이 추적하는 액션 범위는 넓어서 거의 모든 게임 행동을 커버해:' },
          { type:'table',
            headers:['분류','액션'],
            rows:[
              ['영토',  '픽셀 클레임·수확·하이잭'],
              ['미션',  '침공/탐사 출격·완료'],
              ['소셜',  '길드 채팅·칸티나 게임'],
              ['경제',  '아이템 구매·사용, USDT 입금, 토큰 스왑']
            ]},

          { type:'h2', text:'4. 팁' },
          { type:'list', items:[
            '기지의 「퀘스트」 탭을 수시로 확인해',
            'FREE 등급 퀘스트는 순수익 — 절대 건너뛰지 마',
            '퀘스트 목표를 평소 플레이와 겹쳐(예: 클레임 퀘스트 있을 때 픽셀 클레임)',
            '연속 로그인 퀘스트가 FREE 등급에서 보상이 가장 좋아'
          ]},
          { type:'callout', variant:'pro', title:'무비용 PP',
            text:'FREE 등급 퀘스트만으로도 매일 안정적으로 PP를 받을 수 있어, 완전 무료야. 평소 플레이와 겹치면 효율이 배로 뛰어.' }
        ]
      },
      { id: 'guilds', icon: '⚔', title: '길드 & 시즌',
        blocks: [
          { type:'p', text:'혼자 성장에 한계가 오면 **길드**로 묶여. 픽셀이 자동으로 합산되고, 길드 채팅·엠블렘·시즌 리더보드까지 팀플레이 전부 구현되어 있어. 시즌은 **30일 주기**로 돌아가고 매 시즌마다 테마가 바뀌어.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '길드 생성과 역할',
            '길드 커스터마이즈 비용',
            '길드 채팅',
            '시즌 시스템',
            '시즌 점수 계산',
            '시즌 보상'
          ]},

          { type:'h2', text:'1. 길드 생성과 역할' },
          { type:'table',
            headers:['항목','값','출처'],
            rows:[
              ['생성 비용',      {v:'50 GP',cls:'num'},  '`guild_create_cost_gp`'],
              ['최대 멤버',      {v:'20명',cls:'num'},   '`guild_max_members`'],
              ['역할',          '리더 · 장교 · 멤버',   '`guild_members.role`'],
              ['초대 만료',      {v:'72 시간',cls:'num'},'`guild_invite_expire_hours`'],
              ['1인 1길드',      '강제 (UNIQUE wallet)',  '`guild_members`']
            ]},
          { type:'callout', variant:'info', title:'리더·장교·멤버',
            text:'**리더** — 추방·승격·강등·해산·리더 이양. **장교** — 초대·일부 편집. **멤버** — 채팅·뷰. 리더가 장기 부재면 장교가 대신 운영할 수 있어.' },

          { type:'h2', text:'2. 길드 커스터마이즈 비용' },
          { type:'p', text:'생성 후에도 GP로 길드 외형을 계속 바꿀 수 있어. 리더만 결제 가능.' },
          { type:'table',
            headers:['항목','비용','비고'],
            rows:[
              ['이름 변경',          {v:'100 GP',cls:'num'}, '`guild_rename_cost_gp`'],
              ['설명 변경',          {v:'20 GP',cls:'num'},  '`guild_desc_cost_gp`'],
              ['엠블렘 이모지',      {v:'50 GP',cls:'num'},  '텍스트 이모지'],
              ['엠블렘 픽셀 아트',   {v:'50 GP',cls:'num'},  {v:'32×32 · 최대 8 KB',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'픽셀 아트 엠블렘은 강력한 브랜딩',
            text:'길드 픽셀 아트 엠블렘은 **32×32**까지 업로드 가능. 작은 사이즈라도 영토 팝업에 뜨면 인식력이 엄청 높아.' },

          { type:'h2', text:'3. 길드 채팅' },
          { type:'table',
            headers:['항목','값','출처'],
            rows:[
              ['최대 길이',   {v:'300 자',cls:'num'},  '`guild_chat_max_len`'],
              ['쿨다운',     {v:'3 초',cls:'num'},    '`guild_chat_cooldown_sec`'],
              ['히스토리',    {v:'최신 100개',cls:'num'}, '`guild_chat_history_limit`']
            ]},
          { type:'callout', variant:'info', title:'폴링 기반',
            text:'웹소켓 아니고 **폴링** 방식이야. 메시지 한 번에 새로고침되는 게 아니라 몇 초 간격으로 동기화돼. 실시간 전투 상황에서는 반응이 살짝 느릴 수 있어.' },

          { type:'h2', text:'4. 시즌 시스템' },
          { type:'p', text:'시즌은 **30일 주기**. 매 시즌마다 화성 날씨 **테마**가 바뀌고, **26개 카테고리 중 6개**가 무작위로 선정돼서 그 시즌의 랭킹 종목이 돼.' },
          { type:'table',
            headers:['시즌','테마','화성 환경'],
            rows:[
              [{v:'시즌 1',cls:'mars'}, '🌋 Volcanic Dawn',    '마그마 분화구 재가동'],
              [{v:'시즌 2',cls:'mars'}, '❄ Frozen Frontier',  '극지 빙하가 적도까지 확장'],
              [{v:'시즌 3',cls:'mars'}, '☀ Solar Inferno',    '코로나 질량 방출'],
              [{v:'시즌 4',cls:'mars'}, '🌪 Dust Epoch',      '행성 전체 모래폭풍']
            ]},
          { type:'callout', variant:'warn', title:'시즌은 30일 — 장식 아님',
            text:'시즌 길이는 **30일**로 하드 설정되어 있어 (`seasons.ends_at`). 테마에 따라 날씨 확률이 달라지고, 시각 틴트가 화성 표면 위에 입혀져.' },

          { type:'h2', text:'5. 시즌 점수 계산' },
          { type:'p', text:'시즌 카테고리는 총 **26종** — territory, mining, combat, defender, explorer, quester, gambler, recruiter, namer 등등. 매 시즌엔 그 중 **6종만 활성화**돼서 풀에서 무작위로 뽑혀. 지난 시즌엔 의미 있던 카테고리가 이번엔 비활성일 수 있어.' },
          { type:'table',
            headers:['활동','점수','설정 키'],
            rows:[
              ['클레임한 픽셀',   {v:'+1 점 / px',cls:'num'},  '`season_mult_pixels`'],
              ['수확 완료',      {v:'+5 점',cls:'num'},       '`season_mult_harvest`'],
              ['하이잭 승리',    {v:'+10 점',cls:'num'},      '`season_mult_hijack`'],
              ['POI 발견',      {v:'+15 점',cls:'num'},      '`season_mult_poi`']
            ]},
          { type:'callout', variant:'tip', title:'활성 6개부터 확인해라',
            text:'SEASON 탭에서 이번 시즌 활성 카테고리 6개부터 확인해. *combat*이 비활성인 시즌에 전투만 파면 점수 헛돈다 — 활성 리더보드만 노려.' },

          { type:'h2', text:'6. 시즌 보상' },
          { type:'p', text:'시즌이 끝나면 카테고리별 상위권에게 자동 지급. 수령은 `RANK` 탭에서.' },
          { type:'table',
            headers:['순위','시즌1 보상','시즌3 보상'],
            rows:[
              [{v:'1위',cls:'mars'},    {v:'3000 GP + 0.5 PP + 500 XP',cls:'num'}, {v:'5000 GP + 1.0 PP + 800 XP',cls:'num'}],
              [{v:'2 ~ 3위',cls:'mars'}, {v:'1500 GP',cls:'num'},                   {v:'2500 GP',cls:'num'}],
              [{v:'4 ~ 10위',cls:'mars'}, {v:'500 GP',cls:'num'},                    {v:'800 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'시즌별로 보상이 커진다',
            text:'첫 시즌이 가장 작고 시즌이 갈수록 보상이 커지도록 설계되어 있어. 오래 플레이할수록 복리처럼 보상이 늘어.' }
        ]
      },
      { id: 'guildwar', icon: '🎮', title: '길드전 & 미니게임',
        blocks: [
          { type:'p', text:'길드전은 두 길드가 **24시간 아케이드 대전**을 벌이는 시스템이다. 길드원들이 화성 테마 미니게임을 플레이하고 점수를 합산한다. 합산 점수가 높은 길드가 GP를 획득.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '전쟁 선포', '미니게임 소개', '컨티뉴 메카닉', '점수 & 보상'
          ]},
          { type:'h2', text:'1. 전쟁 선포' },
          { type:'table',
            headers:['항목','값','설정'],
            rows:[
              ['선포 비용',  {v:'200 GP (재무에서)',cls:'num'}, '`guild_war_declare_cost_gp`'],
              ['최소 멤버',  {v:'3명',cls:'num'},               '`guild_war_min_members`'],
              ['전쟁 시간',  {v:'24시간',cls:'num'},            '`guild_war_duration_hours`'],
              ['쿨다운',     {v:'48시간',cls:'num'},            '`guild_war_cooldown_hours`'],
              ['동시 전쟁',  {v:'길드당 1개',cls:'num'},         '`guild_war_max_active`'],
              ['승리 보상',  {v:'500 GP → 재무',cls:'num'},     '`guild_war_winner_gp`']
            ]},
          { type:'callout', variant:'info', title:'양쪽 다 체크됨',
            text:'공격측과 방어측 모두 활성 전쟁이 없어야 선포 가능. 이미 전쟁 중인 길드는 타겟 불가.' },

          { type:'h2', text:'2. 미니게임' },
          { type:'p', text:'화성 테마 아케이드 게임 3종. 길드원마다 하루 플레이 횟수 제한 있음.' },
          { type:'table',
            headers:['게임','테마','플레이 방법'],
            rows:[
              [{v:'🚀 Mars Invaders',cls:'mars'}, '갤러그 스타일', '도트 스프라이트 에일리언 웨이브 사격. 5웨이브마다 보스. 240초 제한, 3목숨, 오토파이어.'],
              [{v:'👨‍🚀 Mars Runner',cls:'mars'},  '팩맨 미로',    '도트 스프라이트 우주비행사로 터널 탐험, 미네랄 수집, 에일리언 회피. 파워업으로 적 잡기 가능. 240초 제한.'],
              [{v:'⛏️ Mars Digger',cls:'mars'},   '디그더그',     '도트 스프라이트로 화성 토양 굴착, 크리스탈 수집, 듄 스타일 샌드웜 펌프. 낙석으로 적 처치. 240초 제한.']
            ]},
          { type:'callout', variant:'tip', title:'일일 플레이 제한',
            text:'기본 멤버당 하루 3회 (`guild_war_game_plays_per_day`). 길드원과 조율하자 — 모든 플레이가 합산된다!' },

          { type:'h2', text:'3. 컨티뉴 메카닉' },
          { type:'p', text:'죽으면 **돈 내고 이어하기** 가능 — 점수 유지, 게임 재개. 경쟁 길드들이 점수를 끝없이 올리는 비결.' },
          { type:'table',
            headers:['컨티뉴 #','비용','유형'],
            rows:[
              ['1회차', {v:'5 GP',cls:'num'},    'GP'],
              ['2회차', {v:'15 GP',cls:'num'},   'GP'],
              ['3회차', {v:'30 GP',cls:'num'},   'GP'],
              ['4회차', {v:'0.1 PP',cls:'num'},  'PP (실제 돈!)'],
              ['5회차', {v:'0.2 PP',cls:'num'},  'PP (매번 2배)'],
              ['6회차', {v:'0.4 PP',cls:'num'},  'PP'],
              ['7회차+', {v:'계속 2배',cls:'num'}, 'PP']
            ]},
          { type:'callout', variant:'warn', title:'PP 컨티뉴는 실제 돈',
            text:'3회차 이후부터 PP로 결제. PP = 실제 돈이다. 현명하게 쓰자 — 아니면 이기려다 파산.' },

          { type:'h2', text:'4. 점수 & 보상' },
          { type:'p', text:'전쟁 중 모든 길드원의 게임 점수를 합산. 24시간 후 합산 점수가 높은 길드가 500 GP를 재무로 획득. 점수 배율은 어드민 조정 가능 (`guild_war_game_score_multiplier`).' }
        ]
      },
      { id: 'research', icon: '🔬', title: '길드 연구',
        blocks: [
          { type:'p', text:'길드는 재무의 GP를 써서 **7가지 연구 퍼크**를 해금할 수 있다. 각 연구는 모든 길드원에게 영구 보너스를 준다.' },
          { type:'table',
            headers:['연구','효과','설정'],
            rows:[
              ['⛏ 채굴 효율 I',     {v:'+3% 채굴 PP',cls:'num'},          '`mining_eff_1_bonus`'],
              ['🛡 쉴드 규율',       {v:'+15% 방어력',cls:'num'},          '`shield_disc_bonus`'],
              ['🕊 외교 면책',       {v:'-10% 침공 성공률 감소',cls:'num'}, '`diplomatic_bonus`'],
              ['🔭 궤도 스캔',       {v:'+15% 탐사 보상',cls:'num'},       '`orbital_scan_bonus`'],
              ['🚀 고속 배치',       {v:'-20% 미션 이동 시간',cls:'num'},  '`rapid_deploy_bonus`'],
              ['📦 물류 네트워크',   {v:'-10% 클레임 비용',cls:'num'},     '`logistics_bonus`'],
              ['👑 화성 지배',       {v:'+5% 모든 보너스 중첩',cls:'num'}, '`mars_dominion_bonus`']
            ]},
          { type:'callout', variant:'pro', title:'화성 지배는 마지막에 해금',
            text:'화성 지배는 모든 연구 보너스에 +5%를 추가한다. 채굴이 +3.15%, 방어가 +15.75%가 되는 식.' }
        ]
      },
      { id: 'seasonpass', icon: '🎫', title: '시즌 패스',
        blocks: [
          { type:'p', text:'매 시즌마다 **30단계 배틀패스** (무료+프리미엄). 게임플레이로 XP를 모아 단계 보상을 해금한다.' },
          { type:'h2', text:'1. XP 획득' },
          { type:'table',
            headers:['활동','XP','설정'],
            rows:[
              ['채굴',   {v:'+5 XP',cls:'num'},  '`season_pass_xp_harvest`'],
              ['클레임', {v:'+10 XP',cls:'num'}, '`season_pass_xp_claim`'],
              ['침공',   {v:'+15 XP',cls:'num'}, '`season_pass_xp_invasion`'],
              ['탐사',   {v:'+10 XP',cls:'num'}, '`season_pass_xp_exploration`'],
              ['퀘스트', {v:'+8 XP',cls:'num'},  '`season_pass_xp_quest`']
            ]},
          { type:'h2', text:'2. 단계 보상' },
          { type:'p', text:'무료 트랙은 매 단계 GP 지급. 프리미엄은 더 많은 GP + 마일스톤 아이템. **모든 보상은 GP — PP는 절대 안 줌.**' },
          { type:'table',
            headers:['단계','무료 보상','프리미엄 보상'],
            rows:[
              ['매 단계',       {v:'10×단계 GP',cls:'num'},  {v:'25×단계 GP',cls:'num'}],
              ['5단계마다(무료)',{v:'50×단계 GP 보너스',cls:'num'}, '—'],
              ['10단계마다(프리미엄)', '—',                    '특수 아이템'],
              ['30단계(최대)',   {v:'500 GP',cls:'num'},      {v:'1500 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'프리미엄 패스는 GP로 구매',
            text:'프리미엄 업그레이드는 현재 라이브 기본값 기준 **150 GP** (어드민 조정 가능). 현재 시즌에만 적용.' }
        ]
      },
      { id: 'exchange', icon: '💱', title: 'PP → GP 환전',
        blocks: [
          { type:'p', text:'GP가 급하면 PP(가치 토큰)를 GP로 환전. 환율은 고정이 아니라 수요에 따라 **변동**해. 수수료 부분은 영구 소각 = **PP 싱크**.' },
          { type:'h2', text:'1. 동적 PP → GP 환율' },
          { type:'p', text:'환율은 24h 환전 수요로 재계산되고 하드밴드 안에 묶여. GP 수요가 높으면 환율이 **내려가고**(PP당 GP 적게), 낮으면 다시 **올라가**.' },
          { type:'table',
            headers:['설정','값','소스'],
            rows:[
              ['환율 밴드',  {v:'5 ~ 20 GP/PP',cls:'num'}, '`pp_to_gp_rate_floor` / `_ceil`'],
              ['기준 환율',  {v:'10 GP/PP',cls:'num'},      '`pp_to_gp_exchange_rate`'],
              ['1회 변동',   {v:'±2% / 재계산',cls:'num'},   '`pp_to_gp_rate_max_step_pct`'],
              ['수수료',     {v:'5% (소각)',cls:'num'},      '`pp_to_gp_exchange_fee_pct`'],
              ['동적 환율',  {v:'활성',cls:'num'},           '`pp_to_gp_dynamic_enabled=true`']
            ]},
          { type:'callout', variant:'warn', title:'PP → GP는 단방향',
            text:'**PP를 GP로** 바꾸는 거지 반대는 안 돼 — GP는 PP로 되돌릴 수 없어. 함선 건조·강화·가챠·상점·거버넌스에 GP가 필요할 때 PP를 환전해. 평소 GP는 로그인·미션·전투로도 들어와.' },
          { type:'callout', variant:'tip', title:'환율 보고 환전',
            text:'환율이 PP당 5~20 GP 사이에서 변동하니까, GP 수요가 낮을 때(환율이 20 근처) 환전하면 PP당 GP를 더 받아. 5% 수수료는 소각돼 PP 공급량을 줄여.' },

          { type:'h2', text:'2. PP → USDT 환금 (담보 한도)' },
          { type:'p', text:'PP는 `SWAP` 탭에서 **USDT로 환금**할 수도 있어 — 단 운영자가 적립한 **담보 풀** 한도 내에서만. 구조적으로 뱅크런을 막아.' },
          { type:'formula', label:'환금 가능 한도(room)',
            eq:'room = ~담보~ − ~전체 유저 USDT 부채~',
            note:'PP → USDT 환금(과 PP 유래 출금)은 `room`까지만 허용돼. 풀이 소진되면 운영자가 담보를 채울 때까지 환금이 멈춰.' },
          { type:'callout', variant:'warn', title:'환금은 무제한이 아니다',
            text:'PP는 운영 환율(변동 가능)로 USDT 환금하며, 환금 가능액은 가용 담보 한도에 달려 있어 — 고정 페그가 아니야. 동시 대량 환금은 한도에 막힐 수 있어 — 이게 뱅크런 안전장치야 (`migration 230`).' }
        ]
      },
      { id: 'casino', icon: '🎰', title: '칸티나 카지노',
        blocks: [
          { type:'p', text:'**칸티나**는 5종 미니게임으로 구성된 인게임 카지노야. 전부 PP와 USDT 둘 다로 베팅 가능. 실제 하우스 엣지가 있으니 수익원이 아니라 엔터테인먼트로 생각해.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '게임 5종 요약',
            '베팅 한도 & 하우스 엣지',
            '코인플립',
            '다이스',
            '하이로우',
            '크래쉬 / 마인스'
          ]},

          { type:'h2', text:'1. 게임 5종 요약' },
          { type:'table',
            headers:['게임','유형','통화'],
            rows:[
              [{v:'🚀 Crash',cls:'mars'},   '라이브 배수','PP · USDT'],
              [{v:'💣 Mines',cls:'mars'},   '그리드',    'PP · USDT'],
              [{v:'🪙 코인플립',cls:'mars'},'50/50',     'PP · USDT'],
              [{v:'🎲 다이스',cls:'mars'},  '범위 굴리기','PP · USDT'],
              [{v:'🃏 하이로우',cls:'mars'},'카드 스트릭','PP · USDT']
            ]},

          { type:'h2', text:'2. 베팅 한도 & 하우스 엣지' },
          { type:'table',
            headers:['게임','최소 베팅','최대 베팅','하우스 엣지'],
            rows:[
              [{v:'Crash',cls:'mars'},   {v:'0.1',cls:'num'},  {v:'50',cls:'num'},  {v:'4 %',cls:'num'}],
              [{v:'Mines',cls:'mars'},   {v:'0.1',cls:'num'},  {v:'20',cls:'num'},  {v:'3 %',cls:'num'}],
              [{v:'코인플립',cls:'mars'},{v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 3 %',cls:'num'}],
              [{v:'다이스',cls:'mars'},  {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'가변',cls:'num'}],
              [{v:'하이로우',cls:'mars'},{v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 4 %',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'하우스 엣지는 진짜로 적용됨',
            text:'장기적으로 모든 게임은 하우스가 이겨. 엣지가 3~4%라는 건 베팅한 모든 금액의 평균 **3~4%가 사라진다**는 뜻. 100 PP 베팅하면 평균 3~4 PP가 증발.' },

          { type:'h2', text:'3. 코인플립' },
          { type:'p', text:'**HEADS 또는 TAILS**를 고르고 베팅, 뒤집기. 맞추면 1.96배. 단순하고 빠른 50/50.' },
          { type:'callout', variant:'info', title:'단순하지만 하우스 엣지는 있다',
            text:'50/50처럼 보이지만 배당이 2.0배가 아니라 그보다 낮아서 엣지가 발생해. 빠른 시간에 많은 판을 할 수 있는 게 장점.' },

          { type:'h2', text:'4. 다이스' },
          { type:'p', text:'주사위를 굴려. **특정 범위 위/아래**를 고르고, 범위가 좁을수록 배수가 커져.' },
          { type:'callout', variant:'tip', title:'범위 조정으로 리스크 조절',
            text:'낮은 배수·높은 확률 또는 높은 배수·낮은 확률을 직접 선택해. 번 게임에서 가장 조절 폭이 넓어.' },

          { type:'h2', text:'5. 하이로우' },
          { type:'p', text:'카드 한 장이 공개돼. 다음 카드가 **현재보다 높을지 / 낮을지** 맞춰. 연속으로 맞추면 배수가 누적돼.' },
          { type:'callout', variant:'pro', title:'연승이 핵심',
            text:'베이스 배당은 작지만 **스트릭**으로 기하급수적으로 커져. 적절한 타이밍에 캐시아웃하는 감각이 전부.' },

          { type:'h2', text:'6. Crash / Mines' },
          { type:'p', text:'**Crash** — 배수가 계속 오르다가 언젠가 추락해. 추락 전에 캐시아웃. **Mines** — 그리드에서 타일을 열어. 폭탄 피해서 안전 타일 공개할 때마다 배수가 올라가. 이 둘은 가장 인기 있는 두 게임이야.' },
          { type:'callout', variant:'warn', title:'책임감 있게 플레이',
            text:'카지노는 엔터테인먼트. 패시브 채굴로 하루에 버는 PP의 일부만 써라. 수익원으로 보지 마. 한 판에 올인하면 자동 청산이야.' }
        ]
      },
      { id: 'dynasty', icon: '👑', title: 'DYNASTY 추천',
        blocks: [
          { type:'p', text:'친구를 초대하면 **3단계 MLM** 구조로 커미션이 들어와. 직접 초대한 친구(Tier 1)뿐 아니라 그 친구가 초대한 사람(Tier 2), 또 그 아래까지(Tier 3) 전부 내 수익 라인이 돼.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '3단계 구조',
            '커미션이 발생하는 활동 (라이브 기본값)',
            '리더보드와 트리 뷰',
            '장기 전략'
          ]},

          { type:'h2', text:'1. 3단계 구조' },
          { type:'diagram',
            svg:'<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg">'+
              '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
              '<circle cx="260" cy="30" r="22" fill="rgba(255,209,102,.18)" stroke="#ffd166" stroke-width="2"/><text x="260" y="34" fill="#ffd166">YOU</text>'+
              '<circle cx="140" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="140" y="99">T1</text>'+
              '<circle cx="260" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="260" y="99">T1</text>'+
              '<circle cx="380" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="380" y="99">T1</text>'+
              '<circle cx="90"  cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="90"  y="159" font-size="9">T2</text>'+
              '<circle cx="180" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="180" y="159" font-size="9">T2</text>'+
              '<circle cx="260" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="260" y="159" font-size="9">T2</text>'+
              '<circle cx="340" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="340" y="159" font-size="9">T2</text>'+
              '<circle cx="430" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="430" y="159" font-size="9">T2</text>'+
              '</g>'+
              '<line x1="250" y1="48" x2="150" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="260" y1="52" x2="260" y2="75" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="270" y1="48" x2="370" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
              '<line x1="132" y1="114" x2="94"  y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="148" y1="114" x2="176" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="260" y1="115" x2="260" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="372" y1="114" x2="336" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
              '<line x1="388" y1="114" x2="425" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '</svg>',
            caption:'YOU → T1 (직접 초대) → T2 (간접) → T3 (3단계까지)' },
          { type:'p', text:'테이블 `referral_rewards` 에 **tier INT** 컬럼이 있어서 각 지급이 몇 단계에서 왔는지 추적돼. 단계별 비율은 관리자 설정에서 조정 가능해 — 게임 내 수치가 바뀔 수 있으니 DYNASTY 탭에서 실시간 비율을 확인하는 게 정확해.' },

          { type:'h2', text:'2. 커미션이 발생하는 활동 (라이브 기본값)' },
          { type:'p', text:'현재 라이브 기본값 기준 커미션은 **5가지 활동** 에서 발생해. 일부 소스는 운영 설정으로 켜고 끌 수 있으니, 최종 실시간 기준은 DYNASTY 탭이 맞다.' },
          { type:'table',
            headers:['활동','설명'],
            rows:[
              ['💰 입금',        'USDT를 게임에 넣을 때'],
              ['🔄 스왑',        'USDT ↔ PP 교환'],
              ['🛒 상점',        '아이템·코스메틱 구매'],
              ['🎰 칸티나',       '카지노 베팅'],
              ['🏪 마켓 수수료',   '마켓 등록/거래 수수료']
            ]},
          { type:'callout', variant:'info', title:'실시간 정산',
            text:'피추천인이 라이브 커미션 소스를 실행할 때마다 즉시 **PP 형태**로 내 지갑에 들어와. 수확·하이잭·강화·경매 구매 계열은 운영 설정에 따라 비활성일 수 있어.' },

          { type:'h2', text:'3. 리더보드와 트리 뷰' },
          { type:'p', text:'`DYNASTY` 탭에서 내 추천 트리와 전체 리더보드를 볼 수 있어.' },
          { type:'table',
            headers:['항목','내용'],
            rows:[
              ['추천 코드',      '내 지갑 기반 고유 코드'],
              ['직접 초대 수',    '내가 Tier 1로 가진 인원'],
              ['총 다운라인',     'T1 + T2 + T3 합계'],
              ['누적 수익',       '지금까지 모든 Tier에서 받은 PP']
            ]},

          { type:'h2', text:'4. 장기 전략' },
          { type:'callout', variant:'pro', title:'DYNASTY는 게임 내 최고 EV 액션',
            text:'영토·채굴은 내가 일한 만큼만 벌어 (선형). DYNASTY는 네트워크가 커지면 **복리**로 불어나. 활발한 유저 5명만 초대해도 패시브 수익이 내 채굴보다 많아지는 시점이 반드시 와.' },
          { type:'callout', variant:'warn', title:'봇 초대는 의미 없다',
            text:'커미션은 피추천인의 **실제 지출**에 연동돼. 봇 100명 초대해도 걔네가 활동을 안 하면 0 PP야. 활동하는 한 명이 봇 1000명보다 가치 있어.' }
        ]
      },
      { id: 'cosmetics', icon: '✨', title: '코스메틱 & 아이템',
        blocks: [
          { type:'p', text:'영토를 꾸미는 **시각 코스메틱**과 전투·효율을 바꾸는 **소비 아이템**, 두 종류가 있어. 둘 다 `SHOP` 탭에서 PP·USDT·GP로 구매 가능.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '코스메틱 3종 카테고리',
            '쉴드·부스트·유틸 아이템',
            '통화별 결제 옵션',
            '드롭 전용 코스메틱'
          ]},

          { type:'h2', text:'1. 코스메틱 3종 카테고리' },
          { type:'p', text:'영토마다 **테두리 1개 + 글로우 1개 + 지형 1개**씩 장착 가능. 중복 장착 불가.' },
          { type:'table',
            headers:['카테고리','종류','가격대'],
            rows:[
              [{v:'🟧 테두리',cls:'mars'}, '네온 · 플레임 · 아이스 · 골드', {v:'3 ~ 15 PP',cls:'num'}],
              [{v:'✨ 글로우',cls:'mars'}, '펄스 · 레인보우 · 다크 오라',   {v:'4 ~ 8 PP',cls:'num'}],
              [{v:'⛰ 지형',cls:'mars'},   '볼케이닉 · 프로즌 · 크리스탈 · 톡식', {v:'5 ~ 7 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'시즌 끝나도 유지',
            text:'한 번 구매한 코스메틱은 **영구 보유**. 시즌 리셋돼도 남아있고, 여러 영토에 번갈아 장착할 수 있어.' },

          { type:'h2', text:'2. 쉴드·부스트·유틸 아이템' },
          { type:'table',
            headers:['아이템','효과','비용'],
            rows:[
              [{v:'⚡ 에너지 쉴드',cls:'mars'},    '하이잭 피해 50% 흡수 (12h)', {v:'2.5 PP',cls:'num'}],
              [{v:'💠 플라즈마 쉴드',cls:'mars'},  '하이잭 피해 75% 흡수 (24h)', {v:'5.0 PP',cls:'num'}],
              [{v:'🔥 Mars Rage',cls:'mars'},    '공격 +20% × 3회',            {v:'2.0 PP',cls:'num'}],
              [{v:'🫥 스텔스 클록',cls:'mars'},   '영토 숨김 (8h)',             {v:'1.5 PP',cls:'num'}],
              [{v:'📡 레이더 스캔',cls:'mars'},   '클록 영토 공개 1회',          {v:'1.0 PP',cls:'num'}],
              [{v:'⛏ 마이닝 부스트',cls:'mars'}, '채굴 × 2 (6h)',               {v:'3.0 PP',cls:'num'}],
              [{v:'🟡 픽셀 더블러',cls:'mars'},  '다음 클레임 픽셀 카운트 × 2',  {v:'4.0 PP',cls:'num'}]
            ]},
          { type:'callout', variant:'pro', title:'가성비 No.1 — 에너지 쉴드',
            text:'2.5 PP면 일일 미션 2~3개 보상으로 충당돼. 매일 하나 걸어두면 24시간 방어 공짜. 시즌 상위권 노리면 항상 플라즈마 쉴드를 꽂아둬야 해.' },

          { type:'h2', text:'3. 통화별 결제 옵션' },
          { type:'p', text:'모든 상점 아이템은 **PP·USDT·GP** 세 가지로 결제 가능. 가격 비율은 다음과 같아.' },
          { type:'table',
            headers:['통화','환산'],
            rows:[
              ['PP',   {v:'기준가',cls:'num'}],
              ['USDT', {v:'PP 가격과 동일 (1:1)',cls:'num'}],
              ['GP',   {v:'PP 가격 × 4',cls:'num'}]
            ]},
          { type:'callout', variant:'tip', title:'GP 썩히지 마',
            text:'GP는 거버넌스가 메인 용도지만 코스메틱도 살 수 있어. 거버너 선거 참여할 생각 없으면 GP로 코스메틱 사서 소각하는 게 영토 꾸미기에 유리해.' },

          { type:'h2', text:'4. 드롭 전용 코스메틱' },
          { type:'p', text:'일부 코스메틱은 상점에서 팔지 않아. 로켓 드롭·시즌 보상·POI 같은 **이벤트에서만** 나와.' },
          { type:'table',
            headers:['아이템','출처','희귀도'],
            rows:[
              [{v:'🚀 스타쉽 테두리',cls:'mars'}, '로켓 드롭 (2% 가중치)', {v:'한정',cls:'num'}],
              [{v:'시즌 엠블렘',cls:'mars'},     '시즌 TOP 10',          {v:'한정',cls:'num'}],
              [{v:'💎 POI 특수 코스메틱',cls:'mars'}, 'POI 발견 +5% 추가 굴림', {v:'랜덤',cls:'num'}]
            ]},
          { type:'callout', variant:'warn', title:'한 번 놓치면 끝',
            text:'시즌 리워드 코스메틱은 해당 시즌이 지나면 **다시는 구할 수 없어**. 시즌 상위권에 들 자신 없으면 최소 로켓 드롭은 챙겨봐.' }
        ]
      },
      { id: 'strategy', icon: '🎯', title: '전략 팁',
        blocks: [
          { type:'p', text:'마지막 섹션은 **실전 운영 팁**. 첫 날·첫 주·장기 플레이 단계별로 무엇을 우선해야 하는지, 그리고 이 게임에서 자주 실패하는 패턴들을 정리해뒀어.' },
          { type:'toc', label:'이 섹션 내용', items:[
            '첫 날 체크리스트',
            '첫 주 운영법',
            '장기 빌드',
            '흔한 실수 TOP 5'
          ]},

          { type:'h2', text:'1. 첫 날 체크리스트' },
          { type:'p', text:'가입한 첫 날에 이 5가지만 끝내면 **다음 날부터 자동 수익**이 돌아가기 시작해.' },
          { type:'table',
            headers:['순서','할 일','보상'],
            rows:[
              [{v:'1',cls:'num'}, '로그인 보너스 수령',          {v:'5 GP',cls:'num'}],
              [{v:'2',cls:'num'}, '일일 미션 3개 완료',          {v:'+50 GP',cls:'num'}],
              [{v:'3',cls:'num'}, 'FRONTIER 섹터에 작은 클레임', {v:'수확 시작',cls:'num'}],
              [{v:'4',cls:'num'}, 'POI 1개 발견',               {v:'10~50 GP',cls:'num'}],
              [{v:'5',cls:'num'}, '추천 코드로 친구 1명 초대',   {v:'Tier 1 셋업',cls:'num'}]
            ]},

          { type:'h2', text:'2. 첫 주 운영법' },
          { type:'p', text:'**목표: 영토 100~300 px + 에너지 쉴드 상시 장착 + 길드 가입.**' },
          { type:'callout', variant:'tip', title:'10일 루틴',
            text:'매일 ① 로그인 ② 미션 3개 ③ POI 2~3개 ④ 수확 1~2회 ⑤ 쉴드 갱신. 이것만 해도 일 100 GP + 1 PP 쌓여. 7일이면 700 GP · 7 PP.' },
          { type:'callout', variant:'info', title:'길드는 언제 가입?',
            text:'활동 인원 10명 이상 + 채팅이 살아있는 길드. 생성은 늦게 하는 게 유리 — 혼자 만들면 50 GP 쓰고 멤버가 안 찰 수 있어.' },

          { type:'h2', text:'3. 장기 빌드' },
          { type:'table',
            headers:['목표','전략'],
            rows:[
              ['🏛 거버너 당선',     '저트래픽 섹터부터 노려. 1000~3000 GP 쌓으면 현직 거버너를 밀어낼 수 있어.'],
              ['⚔ 시즌 TOP 10',    'POI 중심 운영 (POI 1개 = 15점). 상위권 보상 대부분은 GP라 거버너 파워로 재투자.'],
              ['👑 커맨더 도전',     '전역 1위 GP는 수만 GP 단위. 길드 리더 + 꾸준한 POI + 추천 네트워크 없이는 불가능.'],
              ['💸 DYNASTY 복리',   '활발한 큰손 3~5명 초대. 그들이 쓰는 모든 PP·USDT가 내 수익으로 환원.']
            ]},

          { type:'h2', text:'4. 흔한 실수 TOP 5' },
          { type:'callout', variant:'warn', title:'① 채굴 인프라 없이 카지노',
            text:'USDT 입금 → 바로 칸티나 직행은 최악. 하우스 엣지 3~4%는 진짜로 적용돼. 영토와 POI부터 안정화시켜.' },
          { type:'callout', variant:'warn', title:'② 외진 좌표에 큰 클레임',
            text:'변방에 대형 영토 사도 아무도 안 봐. CORE 섹터 한 칸이 FRONTIER 100칸보다 노출이 높아.' },
          { type:'callout', variant:'warn', title:'③ 쉴드 무시',
            text:'쉴드 하나 아끼려다 하이잭으로 영토 날리면 복구 비용이 20배. 일일 2.5 PP는 무조건 쉴드에 써.' },
          { type:'callout', variant:'warn', title:'④ 일일 미션 스킵',
            text:'일일 미션 + 로그인 보너스 = 매일 공짜 50~150 GP. 한 달 쌓으면 1500~4500 GP. 이걸 놓치는 건 거버너 자리를 포기하는 것과 같아.' },
          { type:'callout', variant:'warn', title:'⑤ 친구 초대 안 함',
            text:'DYNASTY는 이 게임에서 **기대값(EV)이 가장 높은 액션**. 친구 1명만 초대해도 선형 성장이 복리로 바뀌어. 추천 코드 자랑은 부끄러운 게 아냐.' }
        ]
      }
    ]
  }
};
// ── Japanese / Chinese guidebook (translated from verified EN/KO content) ──
CODEX_CONTENT.ja = {
  sections: [
    { id: 'siegewar', icon: '🏛', title: 'ギルド攻城戦',
      blocks: [
        { type:'p', text:'**火星をセクター単位で占領せよ。** ギルドが定刻の艦隊戦でセクターを奪い、税を徴収し、最終的に火星総督の座を争う。EVE同盟戦＋リネージュ攻城戦に着想。' },
        { type:'h2', text:'🗺 セクターと総督' },
        { type:'p', text:'• 火星は**24セクター**(frontier/mid/core)に分かれる。セクター攻城戦に勝ったギルドが**総督(Governor)**となり**セクター税**を**ギルド金庫**へ徴収。\n• 全体は **BASE → GOVERN → 🗺 SOV MAP** で: 誰がどのセクターを支配し、支配ギルド順位、次回攻城スケジュールを確認。' },
        { type:'h2', text:'⚔ セクター攻城戦(週次)' },
        { type:'p', text:'1. 挑戦者がセクターに攻城を宣言(そのセクターの領地が必要)。\n2. 決戦は**固定週次スロット**(水・土 12:00 UTC)に固定され全員が観戦可能。\n3. **ギルド員が各自1艦隊**を攻撃/防衛に投入(1人1艦隊)。\n4. 決戦時刻に**投入された全艦隊が一つの戦場でリアルタイム戦闘** — 自分の艦隊を直接操作。\n5. 勝利ギルドが新総督。' },
        { type:'h2', text:'🎮 リアルタイム指令' },
        { type:'p', text:'ライブ攻城中、**自分の艦隊**を指揮: **陣形**、**機動**、**集中攻撃**、チャージ式手動スキル **☢ ビーム** / **☄ ミサイル**(サーバーチャージ — 100%で発動)。全員が同じ権威戦闘を観戦。' },
        { type:'callout', variant:'warn', title:'⚠ 艦船は永久喪失しうる', text:'攻城 full-loss が ON のとき、敗北した艦隊は**永久破壊**される。無損失で行うなら**艦隊を投入しない** — 領地占有率で挑戦/防衛すれば(ピクセル数判定)艦船損失なし。' },
        { type:'h2', text:'👑 総督攻城戦(月次)' },
        { type:'p', text:'• 最多セクターを支配するギルドが**火星総督**。毎月1回(1日 12:00 UTC)**総督攻城戦**が自動開催: 総督(防衛) vs 2位ギルド(挑戦)。勝者が火星を支配。\n• 数サイクル誰も挑戦しなければ王座は**空位**となり、最多支配ギルドへフォールバック。' },
        { type:'h2', text:'💰 税 → ギルド金庫' },
        { type:'p', text:'セクター税は**ギルド金庫**に入る。リーダー/オフィサーがギルドパネルから引き出す。解散時は金庫がリーダーへ**返還**される(GP焼却なし)。' },
      ] },
    { id: 'whatsnew', icon: '🆕', title: '最新アップデート',
      blocks: [
        { type:'p', text:'**v7.27x — 2026-05 資源出航 + GP中心の経済。** 最新の安定ビルド。' },
        { type:'h2', text:'⛏ 資源出航 — 領土なしのF2P採掘' },
        { type:'p', text:'• **資源出航**（任務 → ⛏ 資源出航）で艦隊を送り、**領土なしでGP+製作素材**を採掘 — 領土を持たないプレイヤーのF2Pの足がかり。\n• **距離別の目的地**（近/中/遠）を選択：遠いほど収率↑・希少素材↑だが**耐久摩耗**と**襲撃リスク**が増加。摩耗した艦は**造船所で修理**（GP消費）。\n• 収率は艦隊の**積載量**（艦級×等級）に比例し、出航の1日GPには上限があります。' },
        { type:'h2', text:'💱 GP ↔ PP オークション & 報酬のGP化' },
        { type:'p', text:'• **無料PP付与はすべてGPに転換**されました — PPは**入金でのみ発行されるUSDT償還専用トークン**です。クエスト・指揮官の賞金報酬も**GP**で支給されます（UIはすべてGP表記）。\n• 入金せずPPが必要なら**オークションで他プレイヤーから購入**（GP↔PP取引）。価格は自分で設定し、運営はGPからPPを発行しません。' },
        { type:'h2', text:'🏗 領土のコンディション・等級・整備(TEND)' },
        { type:'p', text:'• すべての領土に**コンディション(0〜100、HP の概念)**と**等級(F → S)**が付いた。コンディションは**毎日少しずつ減衰**し、放置すると等級が下がる。\n• **🔧 TEND(整備)**(領土の **PRODUCTION** パネル)は GP を消費して**コンディションを回復**し、等級を押し上げる。\n• **等級が高いほど報酬が増える**: 収穫 PP と鉱物ドロップ率が等級に比例(おおよそ **S ×1.5 〜 F ×0.6**)。領土をこまめに管理することが収益に直結する。' },
        { type:'h2', text:'🔓 レベル別タブ解放' },
        { type:'p', text:'• 上級機能がアカウントレベルで段階的に解放: **艦隊 Lv3、輸送 Lv4、PVP Lv6、ギルド Lv8、ガバナンス Lv10**。\n• コアな序盤タブ(領土・ショップ・マーケット・キャンペーン)は**最初から開いている**。ロックされたタブは **🔒 + 必要レベル**バッジで表示。' },
        { type:'h2', text:'🤖 NPC アリーナ — 生きた世界' },
        { type:'p', text:'• NPC 艦隊が**アリーナで 24 時間戦闘**するようになり、過疎時間帯でも世界が生きているように感じられ、いつでも観戦して学べる。' },
        { type:'h2', text:'⛏ 素材供給のリバランス' },
        { type:'p', text:'• frontier セクターでも**一部の tier-2 製作素材**がドロップするようになり、新規プレイヤーも高価な CORE 領土なしで最初の艦船を建造できる。' },
        { type:'h2', text:'🏪 地域マーケットのセクターフィルタ' },
        { type:'p', text:'• 艦船/アイテムマーケットを**セクター別にフィルタ**できる — セクター間の裁定取引や同一セクターの出品を簡単に探せる。' },
        { type:'callout', variant:'warn', title:'⚠ 艦船の完全ロスト(full-loss)が有効化',
          text:'ハイジャック戦で撃沈された(HP 0)艦船は**永久に失われる** — 復活不可、造船所で再建造が必要。艦隊は失っても許容できる本物の資産として運用すること。(`hijack_ship_loss_enabled = true`)' },
        { type:'h2', text:'💰 通貨モデルの明確化' },
        { type:'p', text:'• **GP がメイン消費通貨** — デイリーログイン・ミッション・戦闘・遠征の報酬で得るほか、**PP → GP 両替**でも補充。ショップ、艦船の建造/強化/修理、艦船ガチャ、領土アップグレード、マーケット手数料などに消費。\n• **PP は領土採掘トークン。** 運営レート(変動あり・担保プール内)で USDT に換金可能 — 固定ペッグではない。領土収穫(日次採掘キャップ)・登録/紹介/入金ボーナスで獲得。領土クレーム/アップグレード、GP への両替、**USDT への換金**(運営者の担保プール内)に使用。\n• **USDT** は Base チェーンの実入出金。' },
        { type:'h2', text:'🎰 艦船ガチャ(Ship Crate)' },
        { type:'p', text:'• **GP** で艦船クレートを開封。3 ティア: スタンダード 300 GP、プレミアム 1,000 GP、レジェンダリー 3,000 GP。\n• 全クレートに**確率公開** + **天井(pity)**(プレミアム 10 回、レジェンダリー 5 回)で巡洋艦以上を保証。' },
        { type:'h2', text:'📈 動的 PP ↔ GP レート' },
        { type:'p', text:'• PP→GP レートは固定ではなく、24h 需要に応じて **PP あたり 5〜20 GP** のハードバンド内で変動し、1 回の再計算で最大 **±2%** 動く。GP 需要が高いとレートは下がり、低いと再び上がる。' },
        { type:'h2', text:'🏪 地域(セクター)マーケット' },
        { type:'p', text:'• マーケット出品は**出品者の拠点セクター**に紐づくようになった。購入時にその**セクターガバナーへ関税**がかかることがあり、運営者は同一セクター取引のみ許可するよう設定できる — セクターが取引ハブになる。' },
        { type:'h2', text:'🛡 経済の安全装置' },
        { type:'p', text:'• **バンクラン防止**: PP→USDT 換金は運営者が積み立てた**担保枠(room = 担保 − 負債)**内でのみ可能。裏付けのない換金は不可。\n• **PP 採掘キャップ**: パッシブ収穫は**ユーザーあたり 1 PP/日**が上限(`mining_daily_cap_per_user=1.0`)。クジラ対策。\n• 紹介報酬に**シビル防御**(アカウント別・日次キャップ)。' },
        { type:'h2', text:'⚙ インフラ' },
        { type:'p', text:'• **マルチインスタンス水平スケーリング** — スケジューラ/リスナーワーカーを `RUN_SCHEDULERS` で分離、Redis キャッシュ + 共有レートリミット(インメモリフォールバック)。\n• **WebSocket リアルタイムプッシュ** — チャット・アクティビティフィードがポーリングではなく WebSocket でストリーミング、Redis Pub/Sub でインスタンス間ファンアウト。' },
        { type:'h2', text:'🚢 リアルタイム艦隊戦' },
        { type:'p', text:'• WebSocket でライブ戦闘ビューア — 艦隊位置・HP・陣形がリアルタイム更新。\n• Tactical Lab v11 を公式戦闘ビューアとして統合、22 種の艦船 PNG スプライト(トップダウン)。\n• 手動スキル: ビーム砲 ☢、ミサイル斉射 ☄、EMP、集中攻撃。\n• 収穫は BASE → 領土内で領土ごと(CORE 24h / MID 48h / FRONTIER 72h)、鉱物ドロップ付き。' },
        { type:'callout', variant:'tip', title:'開発者向け',
          text:'技術的詳細はリポジトリルートの `CHANGELOG.md` と `AUDIT_FINDINGS.md` を参照。' }
      ]
    },
    { id: 'overview', icon: '🌍', title: 'ゲーム概要',
      blocks: [
        { type:'p', text:'**Occupy Mars** は Base チェーン上で動く**領土征服 MMO** だ。3D 火星グローブ上にピクセル領土をクレームし、採掘で PP を集め、敵を襲撃し、ギルドで結束し、シーズンリーダーボードで競い合う — 要するに **火星のデジタル植民地化ゲーム**だ。' },
        { type:'toc', label:'このセクションの内容', items:[
          'コアゲームループ',
          '通貨構造 (USDT / PP / GP / XP)',
          '勝利条件',
          '進行 & 解放',
          '最初の 5 分チェックリスト'
        ]},

        { type:'h2', text:'1. コアゲームループ' },
        { type:'p', text:'すべての活動は以下の **5 ステップループ** を中心に回る。1 周するごとに領土・資本・名声が拡大する。' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg">'+
            '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
            '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
            '<circle cx="60"  cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="60"  y="66">🏴</text><text x="60"  y="82" fill="#ff783c">CLAIM</text>'+
            '<circle cx="170" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="170" y="66">⛏</text><text x="170" y="82" fill="#ff783c">MINE</text>'+
            '<circle cx="280" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="280" y="66">🛡</text><text x="280" y="82" fill="#ff783c">DEFEND</text>'+
            '<circle cx="390" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="390" y="66">⚔</text><text x="390" y="82" fill="#ff783c">RAID</text>'+
            '<circle cx="480" cy="70" r="32" fill="rgba(255,120,60,.18)" stroke="#ffd166" stroke-width="2"/><text x="480" y="66">📈</text><text x="480" y="82" fill="#ffd166">GROW</text>'+
            '</g>'+
            '<line x1="94"  y1="70" x2="134" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="204" y1="70" x2="244" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="314" y1="70" x2="354" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="424" y1="70" x2="444" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<path d="M480,100 Q480,130 260,130 Q60,130 60,100" fill="none" stroke="#ff783c" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="4,4" marker-end="url(#ar)"/>'+
          '</svg>',
          caption:'CLAIM → MINE → DEFEND → RAID → GROW →(再び CLAIM)' },

        { type:'h2', text:'2. 通貨構造' },
        { type:'p', text:'ゲーム内には **4 種類の資産** がある。それぞれ役割が異なるので混同しないこと。' },
        { type:'table',
          headers:['資産','役割','獲得方法','用途','変換可能?'],
          rows:[
            [{v:'💵 USDT',cls:'mars'},  '実暗号資産',          '入金(Base チェーン)',                'プレミアムクレーム・コスメ・カンティナ', {v:'入金 / 出金',cls:'num'}],
            [{v:'🥔 PP',cls:'mars'},    '領土トークン (~$1)', '領土収穫・登録/紹介/入金',            '領土クレーム/アップグレード, →GP, →USDT 換金', {v:'→GP / →USDT (上限あり)',cls:'num'}],
            [{v:'🏛 GP',cls:'mars'},    'メイン消費通貨',     'ログイン・ミッション・戦闘・PP→GP',   'ショップ, 艦船(建造/強化/修理/ガチャ), アップグレード', {v:'PP→GP で購入',cls:'num'}],
            [{v:'⭐ XP',cls:'mars'},    'アカウントレベル',   '全活動',                             'ランク特典・手数料ブースト',       {v:'✕',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'GP で使い、PP で価値を蓄える',
          text:'**GP がほぼ全ての消費先(ショップ・艦船・アップグレード)の通貨** だ。報酬で貯め、PP を両替しても補充する。**PP は価値トークン**で、採掘して GP に換えたり運営レート(変動あり)で USDT に換金(運営者の担保プール内)したりする — 固定ペッグではない。**USDT は本物のお金**でカジノで賭けると実際に失う。詳細は [トークン経済](#tokens) §2 参照。' },

        { type:'h2', text:'3. 勝利条件' },
        { type:'callout', variant:'pro', title:'エンディングは存在しない',
          text:'Occupy Mars は **永続世界** だ。ゴールはスコアではなく、**領土 + 名声 + ガバナンス権力** を積み上げて「誰も無視できないコマンダー」になること。シーズンごとにリセットされるのはランキングだけで、領土と資産は永久だ。' },

        { type:'h2', text:'4. 進行 & 解放' },
        { type:'p', text:'コアな序盤ループは**最初から開いている** — 領土・ショップ・マーケット・キャンペーンにレベル制限はない。上級機能はアカウントレベルが上がると解放される。ロックされたタブは **🔒 + 必要レベル**バッジで表示。' },
        { type:'table',
          headers:['機能','解放レベル'],
          rows:[
            ['領土 · ショップ · マーケット · キャンペーン', {v:'Lv 1 (開放)',cls:'num'}],
            ['🚢 艦隊 & 造船所',                            {v:'Lv 3',cls:'num'}],
            ['🚚 輸送',                                     {v:'Lv 4',cls:'num'}],
            ['⚔ PVP',                                      {v:'Lv 6',cls:'num'}],
            ['🛡 ギルド',                                   {v:'Lv 8',cls:'num'}],
            ['🏛 ガバナンス',                               {v:'Lv 10',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'プレイすればレベルが上がる',
          text:'クレーム・ハイジャック・ミッション・ログインのたびに XP が入る。デイリーループを回すだけでこれらのゲートをすぐ越えられる — XP 表は [トークン経済](#tokens) §4 参照。' },

        { type:'h2', text:'5. 最初の 5 分チェックリスト' },
        { type:'p', text:'ゲームを初めて起動したらこの順番で進めると素早く本編に入れる:' },
        { type:'table',
          headers:['#','やること','実際の報酬'],
          rows:[
            [{v:'1'}, 'ウォレット接続 & ニックネーム登録',          {v:'毎日無料 艦船ガチャ + 日次ログイン GP',cls:'num'}],
            [{v:'2'}, '最初のピクセル CLAIM',                         {v:'+2 XP / px',cls:'num'}],
            [{v:'3'}, '最初の USDT 入金',                              {v:'+50 XP + 10% PP ボーナス',cls:'num'}],
            [{v:'4'}, 'デイリーミッション無料ティアを全完了',         {v:'≈ 0.1~0.3 PP + 15 XP',cls:'num'}],
            [{v:'5'}, '紹介コード入力 → 自分のコード共有',            {v:'DYNASTY チェーン有効',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'行き詰まったらここから',
          text:'長期収益の核心は **デイリーミッションルーティン + POI ハント + DYNASTY 紹介** だ。採掘は小さなベースラインに過ぎない。詳細は [採掘と収益](#mining) §4 と [DYNASTY/紹介](#dynasty) §8 参照。' }
      ]
    },
    { id: 'tokens', icon: '🪙', title: 'トークン経済',
      blocks: [
        { type:'p', text:'ゲーム内のすべての数字は 4 種類の資産のいずれかだ。**それぞれ役割が異なり、互いに完全互換ではない**。このセクションではそれぞれの稼ぎ方と使い方を整理する。' },
        { type:'toc', label:'このセクションの内容', items:[
          'USDT — 実通貨',
          'PP — ゲーム内メイン通貨',
          'GP — ガバナンスポイント',
          'XP — アカウントレベル',
          '資産フローチャート(スワップ・変換)'
        ]},

        { type:'h2', text:'1. USDT — 実通貨' },
        { type:'p', text:'**Base チェーンの Tether USD**。本物のお金だ。ゲームが発行することはなく、ウォレットから **入金/出金** のみ。ピクセルクレームの **基本価格単位** も USDT 建てだ。' },
        { type:'table',
          headers:['セクターティア','ピクセル基本価格','乗数適用後'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 最大 3 (動的)',cls:'num'}],
            [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 最大 2',cls:'num'}],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'入金ボーナス',
          text:'USDT 入金時に自動で **+10% PP ボーナス**(`deposit_pp_bonus=10`)。初回入金は追加で **+50 XP** の一度きりボーナス。' },
        { type:'callout', variant:'warn', title:'USDT は実マネー',
          text:'ゲーム内で `USDT` ラベルが付いたすべての数字は **あなたの実資金** だ。カジノタブで USDT を賭ければ本当にお金が飛ぶ。常に慎重に。' },

        { type:'h2', text:'2. PP — Pixel Points (価値トークン)' },
        { type:'p', text:'PP は **領土採掘の価値トークン**で、運営レート(変動あり)で USDT に換金できる — 固定ペッグではない。新規登録ボーナス + 入金/紹介で得る。日常の消費通貨ではなく、**価値を蓄え、GP に換え、USDT に換金する**資産だ。' },
        { type:'formula', label:'PP 獲得ルート',
          eq:'PP = ~領土収穫~ + ~登録ボーナス~ + ~紹介~ + ~入金ボーナス~',
          note:'パッシブ収穫は **ユーザーあたり 1 PP/日** が上限(`mining_daily_cap_per_user=1.0`)。PP は希少で価値あるよう設計され、大量ファーム不可。' },
        { type:'table',
          headers:['PP の用途','詳細'],
          rows:[
            ['領土クレーム/アップグレード', {v:'ピクセルクレーム & 領土アップグレード',cls:'num'}],
            ['PP → GP 両替',                {v:'動的レート 5〜20 GP/PP',cls:'num'}],
            ['PP → USDT 換金',              {v:'担保枠内',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'PP ↔ USDT 換金',
          text:'`SWAP` タブで PP を USDT に(または逆に)交換する。**換金は運営者が積み立てた担保プール内でのみ許可**され、無制限の現金化はできない。バンクラン防止ルールは [PP ⇄ USDT 換金](#exchange) 参照。' },

        { type:'h2', text:'3. GP — Game Points (メイン消費通貨)' },
        { type:'p', text:'GP は **ゲーム内のメイン消費通貨**だ。ショップ、艦船の建造/強化/修理、艦船ガチャ、領土アップグレード、マーケット手数料、ガバナンス行動などに使う。ゲームプレイ報酬 **および PP → GP 両替** で貯める。' },
        { type:'table',
          headers:['獲得方法','詳細'],
          rows:[
            ['デイリーログイン/ミッション', {v:'ログイン + 日次 3 種',cls:'num'}],
            ['POI ドロップ (70% 重み)',{v:'10 ~ 50 GP/POI',cls:'num'}],
            ['ロケットドロップ (50% 重み)', {v:'10 ~ 40 GP/ドロップ',cls:'num'}],
            ['戦闘 / 遠征',            {v:'撃沈ごとの報酬',cls:'num'}],
            ['PP → GP 両替',           {v:'5〜20 GP/PP (動的)',cls:'num'}],
            ['セクター税 / ガバナー',   {v:'セクター継続収入',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'GP が足りなければ PP を両替',
          text:'建造や強化に GP が足りなければ `SWAP`/両替タブで PP を GP に換える。レートは需要に応じて PP あたり 5〜20 GP の間で変動する。詳細は [PP → GP 両替](#exchange) §1 参照。' },

        { type:'h2', text:'4. XP & ランク' },
        { type:'p', text:'**全活動** で XP が蓄積される。実際のランクテーブル(全 30 段階 — 一部抜粋):' },
        { type:'table',
          headers:['Lv','名称','必要 XP','ランクアップ報酬'],
          rows:[
            [{v:'1',cls:'num'},  'Dust Walker',    {v:'0',cls:'num'},       {v:'—',cls:'num'}],
            [{v:'5',cls:'num'},  'Storm Chaser',   {v:'1,600',cls:'num'},   {v:'+18 PP',cls:'num'}],
            [{v:'10',cls:'num'}, 'Lava Walker',    {v:'12,500',cls:'num'},  {v:'+85 PP',cls:'num'}],
            [{v:'15',cls:'num'}, 'Storm Commander',{v:'42,000',cls:'num'},  {v:'+260 PP',cls:'num'}],
            [{v:'20',cls:'num'}, 'God of Mars',    {v:'100,000',cls:'num'}, {v:'+700 PP',cls:'num'}],
            [{v:'25',cls:'num'}, 'Crimson Archon', {v:'260,000',cls:'num'}, {v:'+2,000 PP',cls:'num'}],
            [{v:'30',cls:'num'}, 'Architect of Worlds', {v:'1,000,000',cls:'num'}, {v:'+6,000 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'XP 獲得量',
          text:'`xp_per_claim=2/px`, `xp_per_hijack=3/px`、デイリーミッション `5 XP`、週次クエスト `30 XP`、日次ログイン `5 XP`、初回入金 `50 XP`、領土 1 週間防衛成功 `1 XP/px`。' },
        { type:'callout', variant:'pro', title:'ランクアップゲート',
          text:'Lv 5・10・15・20・25 では単純な XP 以外に **活動要件**(保有ピクセル数、プレイ日数、ハイジャック回数、入金額など)が課される。XP だけ貯めても突破できない。' },

        { type:'h2', text:'5. 資産フローチャート' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" font-family="monospace">'+
            '<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
            '<rect x="30"  y="30" width="110" height="50" rx="6" fill="rgba(91,184,232,.1)" stroke="#5bb8e8" stroke-width="1.5"/>'+
            '<text x="85"  y="55" text-anchor="middle" font-size="12" fill="#5bb8e8" font-weight="700">USDT</text>'+
            '<text x="85"  y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">実通貨</text>'+
            '<rect x="195" y="30" width="110" height="50" rx="6" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/>'+
            '<text x="250" y="55" text-anchor="middle" font-size="12" fill="#ff783c" font-weight="700">PP</text>'+
            '<text x="250" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">価値トークン ~$1</text>'+
            '<rect x="360" y="30" width="110" height="50" rx="6" fill="rgba(255,209,102,.1)" stroke="#ffd166" stroke-width="1.5"/>'+
            '<text x="415" y="55" text-anchor="middle" font-size="12" fill="#ffd166" font-weight="700">GP</text>'+
            '<text x="415" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">メイン消費通貨</text>'+
            '<line x1="140" y1="55" x2="190" y2="55" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="165" y="48" text-anchor="middle" font-size="8" fill="#ff783c">換金</text>'+
            '<line x1="190" y1="60" x2="140" y2="60" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)" stroke-dasharray="3,3"/>'+
            '<line x1="305" y1="55" x2="355" y2="55" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="330" y="48" text-anchor="middle" font-size="8" fill="#ffd166">PP→GP 5-20</text>'+
            '<text x="250" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">領土採掘・ボーナス ↓</text>'+
            '<line x1="250" y1="125" x2="250" y2="80" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="415" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">ログイン・任務・戦闘 ↓</text>'+
            '<line x1="415" y1="125" x2="415" y2="80" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="85"  y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">入金 ↓</text>'+
            '<line x1="85"  y1="125" x2="85"  y2="80" stroke="#5bb8e8" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="250" y="160" text-anchor="middle" font-size="9" fill="#ff783c" letter-spacing="1">ASSET FLOW — USDT ⇄ PP → GP (PP→GP 動的レート)</text>'+
          '</svg>',
          caption:'USDT ⇄ PP 換金(担保枠内) / PP → GP 動的レート 5〜20' }
      ]
    },
    { id: 'wallet', icon: '🔐', title: 'ウォレットと鍵の保管',
      blocks: [
        { type:'p', text:'プレイにMetaMaskや外部ウォレットは**不要です。** メールで登録すると、ゲームが**自動的に実際のウォレット(キーペア)を生成**します。このウォレットがあなたのオンチェーン資産を保管し、すべてのゲーム行動がこのウォレットに紐づきます。' },
        { type:'toc', label:'このセクションの内容', items:[
          '自動生成ウォレット',
          '秘密鍵の閲覧とバックアップ',
          '鍵保管の責任(免責)',
          '入金と出金'
        ]},

        { type:'h2', text:'1. 自動生成ウォレット' },
        { type:'p', text:'メール登録時、ゲームは内部で本物の**キーペア**を生成します。ブラウザ拡張機能、別のウォレットアプリ、シードフレーズの設定は一切不要です。登録後すぐに領土クレームや収益活動を始められます。' },
        { type:'callout', variant:'info', title:'MetaMaskは不要',
          text:'実際のウォレットが自動的に発行されます。発行されたアドレスがゲーム内のあなたのIDであり、入金先アドレスになります。' },

        { type:'h2', text:'2. 秘密鍵の閲覧とバックアップ' },
        { type:'p', text:'自分の**秘密鍵をいつでも閲覧・バックアップ**できます。**BASEのウォレットパネル**を開き、**🔑 KEY**ボタンを押してパスワードを再確認すると、鍵が表示されコピー・保管できます。' },
        { type:'callout', variant:'tip', title:'オフラインにバックアップ',
          text:'鍵をオフラインの安全な場所(例:金庫の中の手書きメモ、暗号化されたオフラインファイル)にコピーしてください。資産へのアクセスを復元できる唯一の手段です。' },

        { type:'h2', text:'3. 鍵保管の責任(免責)' },
        { type:'callout', variant:'warn', title:'⚠ 秘密鍵の保管責任は完全にあなた自身にあります',
          text:'秘密鍵の保管責任は**完全にあなた自身にあります。** 紛失・盗難の場合、**運営は鍵や資産を復元できません** — リセットもバックドアもありません。鍵はオフラインで安全に保管し、運営を装う者を含め**誰にも絶対に共有しないでください。**' },

        { type:'h2', text:'4. 入金と出金' },
        { type:'p', text:'資金のチャージには自動生成されたウォレットを使用します:' },
        { type:'table',
          headers:['操作','仕組み'],
          rows:[
            ['USDT入金', {v:'自動検出されゲーム残高に反映',cls:'num'}],
            ['出金',     {v:'セキュリティ手順(パスワード / 署名)を経る',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'入金は自動検出されます',
          text:'BaseチェーンのウォレットへのUSDT入金は**自動的に検出**され、ゲーム残高に反映されます。**出金はセキュリティフロー(パスワード / 署名)**を通過した後に処理されます。' }
      ]
    },
    { id: 'territory', icon: '🏴', title: '領土システム',
      blocks: [
        { type:'p', text:'火星表面の **ピクセル** を買うのがこのゲームの出発点だ。1 回のクレームで矩形エリアを指定し、画像をアップロードして旗を立てる。' },
        { type:'toc', label:'このセクションの内容', items:[
          'クレームの基本ルール',
          'セクターティア別価格',
          'ハイジャック(領土奪取)',
          'シールド(防御)',
          '画像アップロード制限',
          '領土名変更',
          'コンディション・等級・整備(TEND)'
        ]},

        { type:'h2', text:'1. クレームの基本ルール' },
        { type:'p', text:'`CLAIM` ボタンを押してグローブ上で矩形をドラッグ → 画像アップロード → 決済。1 トランザクションで最大 **500×500 px** まで確保できる(`max_claim_width=500`, `max_claim_height=500`)。' },
        { type:'callout', variant:'info', title:'ピクセルは永久所有',
          text:'一度買ったピクセルは **シーズンがリセットされても消えない**。ハイジャックされるか自分で放棄するまでは永続資産だ。' },

        { type:'h2', text:'2. セクターティア別価格' },
        { type:'p', text:'火星表面は 3 ティアに分かれている。中心部ほど高価だがハーベスト周期も速い。' },
        { type:'table',
          headers:['ティア','ピクセル基本価格','動的乗数','特徴'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 最大 3.0',cls:'num'}, 'ハーベスト 24h・ハイジャック標的'],
            [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 最大 2.0',cls:'num'}, 'ハーベスト 48h・バランス型'],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1.0',cls:'num'},      'ハーベスト 72h・辺境']
          ]},
        { type:'callout', variant:'tip', title:'価格は需要で動く',
          text:'ティア別価格には **動的乗数** が掛かる。セクターに売れたピクセルが多いほど価格が上がり、最大 3 倍まで跳ねる。安く買いたければ活動のないセクターを狙え。' },

        { type:'h2', text:'3. ハイジャック — 領土奪取' },
        { type:'p', text:'他者のピクセルに重ねてクレームすると **ハイジャック**。元価格の **1.2 倍** を支払うと領土が移る(`hijack_multiplier=1.2`)。' },
        { type:'table',
          headers:['項目','値','備考'],
          rows:[
            ['基本倍率',       {v:'× 1.2',cls:'num'},    '元所有者への 1.2 倍支払い'],
            ['元所有者への還付',{v:'+50 %',cls:'num'},    'ハイジャック費用の 50% をボーナス還元'],
            ['シールド吸収',   {v:'50 ~ 75 %',cls:'num'},'シールド有効時はダメージ吸収']
          ]},
        { type:'callout', variant:'warn', title:'⚠ ハイジャック戦の艦船完全ロスト',
          text:'ハイジャックは**艦隊戦**に発展することがあり、そこで撃沈された(HP 0)艦船は**永久に失われる** — 復活不可、造船所で再建造が必要(`hijack_ship_loss_enabled=true`)。失っても許容できない艦船は持ち込むな。建造/修理は [艦隊と造船所](#fleet) 参照。' },
        { type:'callout', variant:'warn', title:'軽率なハイジャックは損',
          text:'高価な CORE セクターでハイジャックするとあっという間に数十 USDT に跳ね上がる。ターゲットは **1 週間以上活動のない大型領土** が一番コスパが良い。小さな土地を奪おうとすると手数料だけが飛ぶ。' },
        { type:'callout', variant:'pro', title:'ハイジャックはシーズンスコアにも',
          text:'奪ったピクセル 1 つあたり `xp_per_hijack=3 XP`。シーズンリーダーボード上位は全員ハイジャックの達人だ。' },

        { type:'h2', text:'4. シールド — 防御アイテム' },
        { type:'p', text:'シールドを装備するとハイジャックダメージを一定 % **吸収** する。ショップで PP/USDT どちらでも購入可。' },
        { type:'table',
          headers:['アイテム','コスト','持続','吸収率'],
          rows:[
            [{v:'⚡ エナジーシールド',cls:'mars'},{v:'2.5 PP / 2.5 USDT',cls:'num'}, {v:'12 時間',cls:'num'}, {v:'50 %',cls:'num'}],
            [{v:'💠 プラズマシールド',cls:'mars'},{v:'5.0 PP / 5.0 USDT',cls:'num'}, {v:'24 時間',cls:'num'}, {v:'75 %',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'基本は 12h エナジーシールド',
          text:'2.5 PP でハイジャックダメージを半分に削れる。デイリーミッション 1 つの報酬でシールド 1 枚賄えるので、毎日装着するのが定石。' },

        { type:'h2', text:'5. 画像アップロード制限' },
        { type:'table',
          headers:['項目','制限','備考'],
          rows:[
            ['最大容量', {v:'5 MB',cls:'num'},                 '`max_image_size_mb=5`'],
            ['許容フォーマット', {v:'PNG · JPG · GIF · WEBP',cls:'num'},'アニメ GIF 対応'],
            ['リンク URL', {v:'https:// のみ',cls:'num'},       'セキュリティ上 HTTP 禁止']
          ]},
        { type:'callout', variant:'tip', title:'動く GIF はホバーで再生',
          text:'アニメ GIF をアップロードするとグローブ上で領土がホバーされたとき再生される。重要領土ほど動きのあるものを使うと目立つ。' },

        { type:'h2', text:'6. 領土名変更' },
        { type:'p', text:'領土をクリックして表示される情報ポップアップで **カスタム名** を付けられる。コストは非常に安い。' },
        { type:'table',
          headers:['項目','コスト'],
          rows:[
            ['領土名変更', {v:'0.3 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'名前はギルド・ハイジャック心理戦の武器',
          text:'「Do Not Hijack — Woo\'s HQ」のような名前を付けると実際にハイジャック試行が減る。マナーのあるプレイヤーは名前のある領土にはあまり手を出さない。' },

        { type:'h2', text:'7. コンディション・等級・整備(TEND)' },
        { type:'p', text:'すべての領土には**コンディション(0〜100、HP の概念)**と**等級(F → S)**がある。コンディションは**毎日少しずつ減衰**するため、手を入れない領土は徐々に等級が下がっていく。領土の **PRODUCTION** パネルを開くと HP バーと等級バッジが見える。' },
        { type:'table',
          headers:['等級','収穫 PP','鉱物ドロップ'],
          rows:[
            [{v:'S',cls:'mars'}, {v:'× 1.50',cls:'num'}, {v:'× 1.50',cls:'num'}],
            [{v:'A',cls:'mars'}, {v:'× 1.25',cls:'num'}, {v:'× 1.30',cls:'num'}],
            [{v:'B',cls:'mars'}, {v:'× 1.10',cls:'num'}, {v:'× 1.15',cls:'num'}],
            [{v:'C',cls:'mars'}, {v:'× 1.00',cls:'num'}, {v:'× 1.00',cls:'num'}],
            [{v:'D',cls:'mars'}, {v:'× 0.85',cls:'num'}, {v:'× 0.90',cls:'num'}],
            [{v:'F',cls:'mars'}, {v:'× 0.60',cls:'num'}, {v:'× 0.75',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'🔧 TEND で収益を維持する',
          text:'PRODUCTION パネルの **🔧 TEND(整備)** ボタンは GP を消費してコンディションを回復し、等級を再び引き上げる。**等級が高いほど収穫 PP と鉱物ドロップが増える**ので、優良領土をこまめに整備すればその費用は元が取れる。等級 F まで放置すると潜在収益の半分ちょっとしか稼げない。' }
      ]
    },
    { id: 'mining', icon: '⛏', title: '採掘と収益',
      blocks: [
        { type:'p', text:'火星で PP(Potato Points)を稼ぐ方法は 5 つ。**パッシブ採掘** は安定した基本収入だが **収益率は大きくない**。大きな金は POI・ロケット・デイリーミッション・コミッション(DYNASTY)から出る。' },
        { type:'toc', label:'このセクションの内容', items:[
          'パッシブ採掘の公式(実数値)',
          '保有ピクセル別ハーベスト量',
          'ティア別ハーベスト周期',
          'POI(資源ポイント)',
          'ロケットイベント',
          'デイリーミッション',
          'コミッション収入(DYNASTY)'
        ]},

        { type:'h2', text:'1. パッシブ採掘の公式' },
        { type:'p', text:'領土を保持している限り、収穫周期ごとに **自動的に** PP と鉱物が蓄積される。BASE → **My Territory** タブの各領土カードにある ⛏ ボタンで個別収穫。MINE タブは廃止済み。' },
        { type:'formula', label:'HARVEST YIELD PER CYCLE',
          eq:'Yield = rand(~0.01~, ~0.5~) × min( ~√pixels~ ÷ 10, ~3.0~ )   →   max ~1.0 PP~ / harvest',
          note:'キモ: **平方根スケール + 3 倍キャップ + ハーベスト 1 PP 上限**。ピクセルを 10,000 倍買っても収益は 3 倍しか伸びない。クジラ対策設計だ。' },
        { type:'callout', variant:'warn', title:'重要 — ピクセルは無限スケールではない',
          text:'`pixelFactor` は √pixels/10 の **平方根**。1 px → 0.1、100 → 1.0、1,000 → 3.0(上限)。1,000 ピクセル超えると **追加ピクセルの採掘収入はゼロ**。採掘狙いで土地を買い続けるのは無駄。' },
        { type:'callout', variant:'info', title:'ティア乗数は「周期」にのみ適用',
          text:'CORE/MID/FRONTIER の差は **ハーベスト周期**(24h / 48h / 72h)であり **報酬金額** ではない。領土が複数ティアにまたがる場合は最良ティア(CORE > MID > FRONTIER)の周期が全体に適用される。' },

        { type:'h2', text:'2. 保有ピクセル別ハーベスト量(平均)' },
        { type:'table',
          headers:['保有ピクセル','pixelFactor','1 周期平均','CORE 日次','FRONTIER 日次'],
          rows:[
            [{v:'1 px'},      {v:'0.10',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.009 PP',cls:'num'}],
            [{v:'10 px'},     {v:'0.32',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.027 PP',cls:'num'}],
            [{v:'100 px'},    {v:'1.00',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.085 PP',cls:'num'}],
            [{v:'1,000 px'},  {v:'3.00 (キャップ)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}],
            [{v:'10,000 px'}, {v:'3.00 (キャップ)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'ハードキャップ',
          text:'各種ブースト(ガバナー +20%・セクターバフ +20%・Double Mining ×2・天候・Starlink・アイテム)が乗算されるが、最終値は **ハーベスト 1 回あたり 1.0 PP** で固定上限。つまり最上位プレイヤーでも **1 日最大約 1 PP** 程度しかパッシブで受け取れない。' },
        { type:'callout', variant:'pro', title:'プロのヒント',
          text:'採掘だけでは上位に行けない。パッシブ採掘は「生活費」レベル。実際の成長は **POI ハント + デイリーミッション + DYNASTY コミッション** から来る。以下のセクションをしっかり読め。' },

        { type:'h2', text:'3. ティア別ハーベスト周期' },
        { type:'table',
          headers:['ティア','ハーベスト周期','1 日のハーベスト回数','備考'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'24 h',cls:'num'}, {v:'1 回',cls:'num'}, '中心部 — 高トラフィック・ハイジャック標的'],
            [{v:'🟡 MID',cls:'mars'},      {v:'48 h',cls:'num'}, {v:'0.5 回',cls:'num'}, '中間 — バランス型'],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'72 h',cls:'num'}, {v:'0.33 回',cls:'num'}, '辺境 — 安いが遅い']
          ]},
        { type:'callout', variant:'tip', title:'同面積で 3 倍効率',
          text:'CORE 1 px + FRONTIER 999 px > FRONTIER 1,000 px。周期が 24h に短縮されるため **同面積で 3 倍多くハーベスト** できる。安い CORE の 1 マスをアンカーにするのが定石。' },

        { type:'h2', text:'3. POI — 資源ポイント' },
        { type:'p', text:'火星表面にランダムに **資源ポイント** が生成される。`EXPLORE` タブのマップを開いて向かい、`🔍 DISCOVER` ボタンを押すと報酬受取。**領土がなくても誰でもハーベスト可能** — 先着順だ。' },
        { type:'table',
          headers:['項目','値','出典'],
          rows:[
            ['スポーン周期',         {v:'4 時間ごと',cls:'num'},             '`poi_spawn_interval_hours=4`'],
            ['周期ごと生成数',        {v:'6 個(最大同時 12 個)',cls:'num'},  '`poi_count_per_cycle=6, poi_max_active=12`'],
            ['有効時間',              {v:'12 時間',cls:'num'},                '`poi_expire_hours=12`'],
            ['探索手数料',            {v:'管理者設定(デフォルト 0 PP)',cls:'num'}, '`exploration_fee_pp`'],
            ['発見 XP ボーナス',      {v:'+5 XP',cls:'num'},                 '`poi_discovery_xp=5`']
          ]},
        { type:'h2', text:'POI ドロップテーブル(実重み)' },
        { type:'table',
          headers:['ドロップ種別','重み','報酬範囲','備考'],
          rows:[
            [{v:'🏛 GP',cls:'mars'},   {v:'70 %',cls:'num'},  {v:'10 ~ 50 GP',cls:'num'},      '最頻出'],
            [{v:'📦 アイテム',cls:'mars'}, {v:'20 %',cls:'num'},  {v:'ドロップテーブルからランダム',cls:'num'}, 'シールド・ブーストなど'],
            [{v:'🥔 PP',cls:'mars'},   {v:'10 %',cls:'num'},  {v:'0.05 ~ 0.3 PP',cls:'num'},   '最希少'],
            [{v:'✨ コスメ',cls:'mars'}, {v:'+5 %',cls:'num'},  {v:'上記に追加ロール',cls:'num'},  '発見ごとに追加ボーナス']
          ]},
        { type:'callout', variant:'info', title:'スケール補正',
          text:'報酬量は **アクティブユーザー数** に応じて自動スケール — 10 名につき +10%、最大 ×3 まで。ユーザーが多いほど報酬も大きくなる。' },
        { type:'callout', variant:'pro', title:'POI こそ最もアクティブな収入源',
          text:'採掘は 1 日 1 PP そこそこだが POI は **GP ドロップ** が大きい。12 時間以内に 6 個の POI のうち数個取るだけで数十 GP 貯まる。GP はガバナー選挙・セクター税収に繋がるので長期収入だ。' },

        { type:'h2', text:'4. ロケットイベント' },
        { type:'p', text:'**12 時間ごと** にロケットがランダムな位置に着陸して大量の戦利品を撒く。着陸 2 時間前に予告 → 1 時間の回収窓。5% 確率で `RUD`(爆発) — ドロップ 2 倍・半径 2 倍。' },
        { type:'table',
          headers:['ドロップ種別','重み','値','備考'],
          rows:[
            [{v:'🏛 GP',cls:'mars'},       {v:'50 %',cls:'num'}, {v:'10 ~ 40 GP',cls:'num'}, '最頻出'],
            [{v:'📦 アイテム',cls:'mars'},    {v:'25 %',cls:'num'}, 'ドロップテーブル', 'シールド・ブースト'],
            [{v:'⭐ XP',cls:'mars'},       {v:'17 %',cls:'num'}, {v:'5 ~ 25 XP',cls:'num'}, '—'],
            [{v:'🥔 PP',cls:'mars'},       {v:'6 %',cls:'num'},  {v:'0.02 ~ 0.1 PP',cls:'num'}, '希少'],
            [{v:'🚀 スターシップボーダー',cls:'mars'}, {v:'2 %',cls:'num'},  {v:'1 個',cls:'num'},        '限定コスメ']
          ]},
        { type:'callout', variant:'warn', title:'RUD は大当たりだが…',
          text:'5% で発動する **RUD(Rapid Unscheduled Disassembly)** = 爆発。通常 15 個 → RUD 30 個ドロップ。半径も 5km → 10km と 2 倍。競合が殺到する可能性があるので準備して行け。' },

        { type:'h2', text:'5. デイリーミッション' },
        { type:'p', text:'毎日クエストがリセットされる。無料/活動/支出の 3 ティアに分かれ、完了で PP + XP が手に入る。完了 XP は固定 **5 XP/クエスト**(週次クエストは 30 XP)。' },
        { type:'table',
          headers:['ティア','クエスト例','報酬範囲'],
          rows:[
            ['💫 無料',   'ログイン / セクター閲覧 / 初ピクセル',   {v:'0.01 ~ 0.05 PP',cls:'num'}],
            ['⚡ 活動',   'クレーム / ハーベスト / セクター探検 / 連続ログイン',  {v:'0.05 ~ 0.50 PP',cls:'num'}],
            ['💎 支出',   '入金 / プレミアムクレーム / スワップ / 大規模拡張', {v:'0.30 ~ 1.50 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'毎日 5 分で確定収益',
          text:'デイリーミッションは **確定報酬** だ。上位ティアのクエストは採掘よりはるかに PP 収益が良く XP も貯まる。ランクアップ速度はクエストが決める。' },

        { type:'h2', text:'6. コミッション収入(DYNASTY)' },
        { type:'p', text:'誰かを紹介すると、彼らが使う **6 種類の活動**(入金・スワップ・ショップ・ハーベスト・カンティナ・ハイジャック)すべてから自動コミッションが自分のウォレットに入る。3 段階 MLM 構造で友達の友達の友達まで積み上がる。' },
        { type:'callout', variant:'pro', title:'長期的にはこれが一番大きい',
          text:'領土・採掘は線形成長(自分が働いた分)、**DYNASTY はネットワーク効果** だ。活発なユーザーを 5 人招待すればパッシブ PP が自分の採掘を上回る時点が必ず来る。詳細は [DYNASTY/紹介](#dynasty) §8 参照。' }
      ]
    },
    { id: 'fleet', icon: '🚢', title: '艦隊と造船所',
      blocks: [
        { type:'p', text:'艦船は**失う可能性のある本物の資産**だ。造船所で建造し、GP と鉱物で強化・修理し、艦船ガチャでレア艦を狙い、艦船マーケットで取引する。ハイジャック戦では艦船が**永久に破壊**されることがある。' },
        { type:'toc', label:'このセクションの内容', items:[
          '艦船ロスター & 派閥',
          '造船所 — 建造 & 修理',
          'ステータス強化',
          '艦船ガチャ(Ship Crate)',
          '艦船マーケット(地域)',
          '完全ロスト警告'
        ]},

        { type:'h2', text:'1. 艦船ロスター & 派閥' },
        { type:'p', text:'3 派閥(MCC / FSP / CV)にまたがり **22 種の艦船**、5 つのサイズクラスがある。大型艦ほど火力・耐久が高いがレアな Core/Mid 鉱物を要する。タイタンはサーバーキャップ(種別ごと生存 3 隻)で制限される。' },
        { type:'table',
          headers:['艦級','役割','建造コストティア'],
          rows:[
            [{v:'フリゲート',cls:'mars'}, '高速タックル / 電子戦',        {v:'低',cls:'num'}],
            [{v:'駆逐艦',cls:'mars'},     'スカーミッシュ火力',          {v:'低〜中',cls:'num'}],
            [{v:'巡洋艦',cls:'mars'},     '柔軟な主力',                  {v:'中',cls:'num'}],
            [{v:'戦艦',cls:'mars'},       '重ライン — Core/Mid 鉱物',    {v:'高',cls:'num'}],
            [{v:'タイタン',cls:'mars'},   'キャピタル — サーバーキャップ',{v:'最高',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'🜲 起動スーパーユニット（合体ガチャ）',
          text:'`ガチャ`の**合体パーツBOX**でパーツを集め、巨大スーパーユニットを**起動（合体）**できる。1ユニットにつき**5種のパーツ**が必要で、揃うと造船所の`起動`タブから艦隊に配備される。重複パーツは**シャード**に分解して任意のパーツと交換可能（コアは交換コストが高い）。ロボ6種とエイリアン4種があり武器特化・相性が異なる。中上位性能で狙撃/爆撃/電子戦に弱点があり、分解すればパーツに戻る（永久損失なし）。' },
        { type:'h2', text:'2. 造船所 — 建造 & 修理' },
        { type:'p', text:'`造船所` を開くと設計図が見える。各カードは GP + 鉱物コストを **保有 / 必要** で表示し、どのセクターティアがその鉱物をドロップするかを ⛏ バッジで示す。建造すると `ship_build_job` がキューに入り、艦船はデフォルト艦隊に編入される。' },
        { type:'table',
          headers:['行動','コスト','備考'],
          rows:[
            ['建造', {v:'GP + 鉱物',cls:'num'}, '戦艦/タイタンは Core + Mid 鉱物が必要'],
            ['修理', {v:'GP + 鉱物',cls:'num'}, '戦闘後の HP 回復'],
            ['シールド',{v:'GP',cls:'num'},     '戦闘前のダメージ吸収'],
            ['解体', {v:'—',cls:'num'},         '分解して一部回収']
          ]},
        { type:'callout', variant:'info', title:'出品中の艦船はロック',
          text:'マーケットに出品された(`is_market_listed`)艦船は、出品を取り消すまで強化・修理・シールド・解体・艦隊移動がすべて不可。' },
        { type:'callout', variant:'tip', title:'新規プレイヤーも序盤から建造できる',
          text:'バランス調整により、**frontier セクターでも一部の tier-2 製作素材**がドロップするようになった — 高価な CORE 領土なしで、安価な辺境の土地だけで最初の艦船を建造できる。' },

        { type:'h2', text:'3. ステータス強化' },
        { type:'p', text:'保有艦船は `atk / def / hp / speed` を**永久強化**できる。強化には**成功確率**があり、成功/失敗いずれも GP + 素材を消費する。コストは累計投資回数に応じて上昇する。' },
        { type:'callout', variant:'pro', title:'強化は確率型',
          text:'失敗しても GP と素材は消費され、成功時のみステータスボーナスが付く。戦闘エンジンが `bonus_atk/def/hp/speed` を直接参照するため、実戦に反映される。' },

        { type:'h2', text:'4. 艦船ガチャ(Ship Crate)' },
        { type:'p', text:'**GP** で艦船クレートを開け、サイズクラス別の艦船をランダムに得る。全クレートは**確率公開**され、プレミアム/レジェンダリーは規定回数に達すると巡洋艦以上を保証する**天井(pity)**を持つ。' },
        { type:'table',
          headers:['クレート','価格','天井','最高艦級'],
          rows:[
            [{v:'📦 スタンダード',cls:'mars'},  {v:'300 GP',cls:'num'},  {v:'—',cls:'num'},     '巡洋艦'],
            [{v:'🎁 プレミアム',cls:'mars'},    {v:'1,000 GP',cls:'num'},{v:'10 回',cls:'num'}, '戦艦'],
            [{v:'🌟 レジェンダリー',cls:'mars'},{v:'3,000 GP',cls:'num'},{v:'5 回',cls:'num'},  'タイタン']
          ]},
        { type:'callout', variant:'info', title:'サーバー RNG + タイタンキャップ',
          text:'抽選はサーバー権威 RNG を使う。タイタンのサーバーキャップが満杯ならタイタン抽選は戦艦に降格される。確率は各クレートカードに表示される。' },

        { type:'h2', text:'5. 艦船マーケット(地域)' },
        { type:'p', text:'`出品 → 購入 → 取消` で艦船を取引する。各出品は**出品者の拠点セクター**に紐づく: 購入時にその**セクターガバナーへ関税**がかかることがあり、運営者は同一セクター購入のみ許可するよう制限できる — セクターを取引ハブにし、セクター間アービトラージを生む。' },
        { type:'callout', variant:'tip', title:'セクター関税を見よ',
          text:'税率の高い CORE セクターの出品は購入者が追加コストを払う。安い出品は税率の低いフロンティアセクターにあることが多い — 代わりに物流の負担がある。' },

        { type:'h2', text:'6. ⚠ 完全ロスト警告' },
        { type:'callout', variant:'warn', title:'撃沈された艦船は永遠に消える',
          text:'完全ロスト有効時(`hijack_ship_loss_enabled=true`)、ハイジャック戦で **HP 0 になった艦船は永久破壊**される — `is_alive=false`、復活不可。造船所で再建造が必要だ。失っても許容できる艦隊のみ投入し、再建造用の予備艦 + 鉱物を備蓄しておけ。' }
      ]
    },
    { id: 'governance', icon: '🏛', title: 'ガバナンス',
      blocks: [
        { type:'p', text:'火星は **2 層の権力構造** で動く。全域トップの **コマンダー** と、セクターごとに 1 人の **ガバナー**。どちらも税収・権限・イベント発動など実際のゲームルールを変えられる。ガバナンスは実装済みの実機能であり、象徴的な装飾ではない。' },
        { type:'toc', label:'このセクションの内容', items:[
          '権力構造(コマンダー / ガバナー)',
          'セクター税と分配',
          'セクターバフ(ガバナー権限)',
          'グローバルイベント(コマンダー権限)',
          '賞金システム',
          'ガバナンスの GP'
        ]},

        { type:'h2', text:'1. 権力構造' },
        { type:'table',
          headers:['役職','範囲','人数','権限'],
          rows:[
            [{v:'👑 コマンダー',cls:'mars'},     '全域',     {v:'1 名',cls:'num'}, 'グローバルイベント・全体告知・賞金'],
            [{v:'⚔ 副コマンダー',cls:'mars'},    '全域',     {v:'1 名',cls:'num'}, 'コマンダー不在時のイベント代行'],
            [{v:'🏛 ガバナー',cls:'mars'},     'セクター',     {v:'セクターごと 1 名',cls:'num'}, 'セクター税率・バフ・税収'],
            [{v:'⚖ 副ガバナー',cls:'mars'},    'セクター',     {v:'セクターごと 1 名',cls:'num'}, '税収 20% を受取']
          ]},
        { type:'callout', variant:'info', title:'選出方式',
          text:'各ポジションは **GP 保有量** が最多のプレイヤーが占める。いつでも GP をさらに積めば現職を追い出せる — 常時選挙だ。' },

        { type:'h2', text:'2. セクター税と分配' },
        { type:'p', text:'ガバナーは自分のセクターで発生する **クレーム費用に税率** をかける。税率は管理者が設定した範囲内でガバナーが直接調整できる。' },
        { type:'table',
          headers:['項目','値'],
          rows:[
            ['税率範囲',   {v:'1 ~ 5 %',cls:'num'}],
            ['デフォルト税率',{v:'2 %',cls:'num'}],
            ['ガバナー受取',  {v:'70 %',cls:'num'}],
            ['副ガバナー受取',{v:'20 %',cls:'num'}],
            ['セクタープール',{v:'10 %',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'高トラフィックセクター = 収益マシン',
          text:'人気セクターのガバナーになれば座っているだけで税収が入る。他人がクレームするたびに自動精算だ。CORE セクターは税率 1% でもすぐに数百 USDT 貯まる。' },

        { type:'h2', text:'3. セクターバフ — ガバナー権限' },
        { type:'p', text:'ガバナーは GP を消費してセクター全体にバフを掛けられる。自分の領土だけでなく **全住民に利益** が行く。選挙公約でよく使われる。' },
        { type:'table',
          headers:['バフ','効果','コスト (GP)'],
          rows:[
            ['⛏ 採掘ブースト',  'セクター全体の採掘量 +20%', {v:'100 ~ 150',cls:'num'}],
            ['🛡 防御ボーナス',  'シールド吸収率上昇',         {v:'100 ~ 150',cls:'num'}],
            ['💰 クレーム割引', 'セクター内の新規クレーム価格引下げ',{v:'100 ~ 150',cls:'num'}]
          ]},

        { type:'h2', text:'4. グローバルイベント — コマンダー権限' },
        { type:'p', text:'コマンダーは **1 日 1 回** 全域イベントを発動できる。同時に 1 つしか発動できず GP 消費も大きいが、火星全域に影響する。' },
        { type:'table',
          headers:['イベント','効果','コスト (GP)'],
          rows:[
            ['⚡ ダブルマイニング', '全域採掘量 × 2',      {v:'300 ~ 500',cls:'num'}],
            ['⚔ 戦時体制',   'ハイジャック XP・報酬増加',       {v:'300 ~ 500',cls:'num'}],
            ['🕊 平和条約',   '一定時間ハイジャック禁止',     {v:'300 ~ 500',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'1 日 1 回制限',
          text:'`max_global_events_per_day=1`。コマンダーがどれだけ GP を持っていても 1 日にイベントは 1 回しか発動できない。タイミングが戦略だ。' },

        { type:'h2', text:'5. 賞金システム' },
        { type:'p', text:'コマンダーとガバナーは特定のユーザーに **賞金** を掛けられる。賞金対象を最初にハイジャックした者が報酬を総取り。' },
        { type:'table',
          headers:['項目','値'],
          rows:[
            ['発行権限',    'コマンダー・ガバナー'],
            ['報酬タイプ',  'GP + 任意 PP'],
            ['状態',       'active → claimed / expired / cancelled'],
            ['有効期限',    '発行時に指定']
          ]},
        { type:'callout', variant:'pro', title:'賞金は政治ツール',
          text:'ライバルガバナーを揺さぶりたいなら、彼の核心領土に賞金を掛けろ。他のユーザーが襲いに殺到すれば、そのガバナーは防衛に追われて税収を満足に取れなくなる。' },

        { type:'h2', text:'6. ガバナンスの GP' },
        { type:'p', text:'ガバナンスはメイン消費通貨である GP で動く。ゲームプレイ報酬 **および PP → GP 両替**(動的 5〜20 レート)で貯め、選挙・セクター支配・バフに使う。GP は PP や USDT に戻せない。' },
        { type:'table',
          headers:['GP 獲得経路','一般的な報酬'],
          rows:[
            ['日次ログイン(7 日周期)',  {v:'5 ~ 100 GP',cls:'num'}],
            ['デイリーミッション(3 個/日)',{v:'各 10 ~ 25 GP',cls:'num'}],
            ['デイリーミッション 3 個完了',{v:'+50 GP',cls:'num'}],
            ['POI 発見',               {v:'10 ~ 50 GP',cls:'num'}],
            ['シーズンランキング報酬',    {v:'500 ~ 5000 GP',cls:'num'}],
            ['ロケットドロップ',         {v:'10 ~ 40 GP',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'ガバナーになる最速ルート',
          text:'毎日出席 + ミッション 3 個 + POI 数個こなすだけでも 1 日 100 GP は貯まる。1 ヶ月で 3000 GP。活動のないセクターのガバナーならその程度で追い出せる。' }
      ]
    },
    { id: 'ops', icon: '🚀', title: 'OPSミッション',
      blocks: [
        { type:'p', text:'OPS ミッションは君の軍事行動の中枢だ。合併済み領土の発射台から **侵攻(⚔)** と **探査(🛰)** の 2 種類を出撃させる。侵攻は他プレイヤーの領土を襲撃して PP・GP・XP を奪い、探査は座標にプローブを射出して PP・XP・レアアイテムを発見する。' },
        { type:'toc', label:'このセクションの内容', items:[
          'OPS ミッションとは',
          '発射台',
          'ミッションティア',
          '報酬',
          'ターゲット重複排除',
          'ヒント'
        ]},

        { type:'h2', text:'1. OPS ミッションとは' },
        { type:'p', text:'合併した領土がそのまま発射台になる。各合併領域 = 1 発射台、ここから 2 種類の軍事行動を出撃させる:' },
        { type:'table',
          headers:['種類','アイコン','ターゲット','収益'],
          rows:[
            [{v:'侵攻',cls:'mars'}, '⚔', '他プレイヤーの領土', 'PP + GP + XP'],
            [{v:'探査',cls:'mars'}, '🛰', '座標プローブ', 'PP + XP + レアアイテム']
          ]},
        { type:'callout', variant:'info', title:'2 つの出撃方式',
          text:'侵攻は直接対決 — 相手の領土を襲って資源を奪う。探査は PvE — 指定座標にプローブを射出して報酬を発見する。それぞれリスクとリターンが違う。' },

        { type:'h2', text:'2. 発射台' },
        { type:'p', text:'合併した領土が自動的に発射台になる。発射台が大きいほど報酬倍率が高い。' },
        { type:'table',
          headers:['属性','詳細'],
          rows:[
            ['発射台の由来',    '合併領土 1 つ = 発射台 1 基'],
            ['サイズ倍率',      {v:'×0.5 ~ ×3.0',cls:'num'}],
            ['倍率計算式',      '√(ピクセル数 / 25)、上下限クランプ'],
            ['同時制限',        '1 発射台につき同時に 1 ミッションのみ']
          ]},
        { type:'callout', variant:'pro', title:'大きい領土 = 高倍率',
          text:'十分に大きい合併領土なら ×3.0 倍率に到達できる — ミッション報酬が丸ごと 3 倍だ。大型合併領土の建設が OPS 収益を伸ばす核心戦略。' },

        { type:'h2', text:'3. ミッションティア' },
        { type:'p', text:'ミッションはターゲットまでの距離で 3 段階に分かれる。遠いほどコストと時間がかかるが、成功時のリターンも大きい。' },
        { type:'table',
          headers:['ティア','距離','コスト (PP)','所要時間','成功率'],
          rows:[
            [{v:'NEAR',cls:'mars'}, '< 30°',   {v:'0.2(侵攻) / 0.1(探査)',cls:'num'}, {v:'約 30 分',cls:'num'}, {v:'80%',cls:'num'}],
            [{v:'MID',cls:'mars'},  '30–90°',  {v:'0.8 / 0.4',cls:'num'},              {v:'約 2 時間',cls:'num'},  {v:'65%',cls:'num'}],
            [{v:'FAR',cls:'mars'},  '> 90°',   {v:'1.5 / 1.0',cls:'num'},              {v:'約 5 時間',cls:'num'},  {v:'50%',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'失敗 = 燃料損失',
          text:'ミッション失敗時は報酬ゼロだが、発射時に消費した PP は戻らない。遠距離ミッションはハイリスク・ハイリターン — 無理は禁物。' },

        { type:'h2', text:'4. 報酬' },
        { type:'table',
          headers:['ミッション種別','報酬内容','倍率適用'],
          rows:[
            ['⚔ 侵攻', 'PP + GP + XP',             '全て発射台倍率が乗る'],
            ['🛰 探査', 'PP + XP + レアアイテム確率', '全て発射台倍率が乗る']
          ]},
        { type:'callout', variant:'info', title:'倍率が全てを決める',
          text:'同じ FAR 侵攻でも ×1.0 発射台と ×3.0 発射台では PP が 3 倍違う。最も大きな発射台から優先出撃させろ。' },

        { type:'h2', text:'5. ターゲット重複排除' },
        { type:'p', text:'システムが自動的にターゲットの衝突を回避し、ミッションが被らないようにする:' },
        { type:'list', items:[
          '同一領土に 2 つの侵攻が同時に当たることはない',
          '重複時はシステムが自動的にターゲットの別の領土にリダイレクト',
          '探査プローブの座標が重複した場合は自動オフセット'
        ]},

        { type:'h2', text:'6. ヒント' },
        { type:'list', items:[
          '大型合併領土を作って ×3.0 倍率を目指せ',
          'FAR ミッションはリスク最大だがリターンも最高 — 賭けに出るなら',
          '同じギルドのメンバーには侵攻できない',
          'READY 状態の発射台がリストの先頭にソートされるので便利'
        ]},
        { type:'callout', variant:'pro', title:'OPS はアクティブ収益の中核',
          text:'採掘はパッシブ、OPS はアクティブだ。OPS ミッションを日常の採掘と組み合わせれば、放置だけより遥かに稼げる。' }
      ]
    },
    { id: 'quests', icon: '📋', title: 'クエスト',
      blocks: [
        { type:'p', text:'クエストシステムは通常プレイ中に自動で進捗を追跡する — 手動操作は不要だ。常に 3 つのアクティブクエスト(各ティア 1 つずつ)があり、完了したら PP 報酬を受け取り、新しいクエストが自動リフレッシュされる。' },
        { type:'toc', label:'このセクションの内容', items:[
          'クエストティア',
          'クエストの仕組み',
          'クエストアクション',
          'ヒント'
        ]},

        { type:'h2', text:'1. クエストティア' },
        { type:'p', text:'クエストは 3 つのティアに分かれ、難易度と報酬が段階的に上がる:' },
        { type:'table',
          headers:['ティア','種類','報酬','例'],
          rows:[
            [{v:'FREE',cls:'mars'},     'シンプル日課', {v:'0.01 ~ 0.05 PP',cls:'num'}, 'ログイン、セクター閲覧、ベース訪問'],
            [{v:'ACTIVITY',cls:'mars'}, 'ゲームプレイ', {v:'0.05 ~ 0.25 PP',cls:'num'}, 'ピクセル占領、収穫、ミッション出撃、カンティーナ'],
            [{v:'SPENDING',cls:'mars'}, '消費アクション', {v:'0.30 ~ 1.50 PP',cls:'num'}, 'USDT 入金、プレミアム占領、大規模拡張']
          ]},
        { type:'callout', variant:'info', title:'3 ティア並行',
          text:'常に 3 つのクエスト(各ティア 1 つ)が同時にアクティブ。FREE ティアは純利益、SPENDING ティアは報酬最大だが消費が必要。' },

        { type:'h2', text:'2. クエストの仕組み' },
        { type:'list', items:[
          '同時に 3 つのアクティブクエスト(各ティア 1 つ)',
          '通常プレイで自動進捗 — 手動クリック不要',
          '完了したら PP 報酬を受取り',
          '受取り後は新クエストが自動リフレッシュ、クールダウン 24h ~ 168h'
        ]},

        { type:'h2', text:'3. クエストアクション' },
        { type:'p', text:'システムが追跡するアクションの範囲は広く、ほぼ全てのゲーム行動をカバー:' },
        { type:'table',
          headers:['カテゴリ','アクション'],
          rows:[
            ['領土',  'ピクセル占領・収穫・ハイジャック'],
            ['ミッション',  '侵攻/探査の出撃・完了'],
            ['ソーシャル',  'ギルドチャット・カンティーナゲーム'],
            ['経済',  'アイテム購入・使用、USDT 入金、トークンスワップ']
          ]},

        { type:'h2', text:'4. ヒント' },
        { type:'list', items:[
          'ベースの「クエスト」タブを定期的にチェック',
          'FREE ティアのクエストは純利益 — 絶対にスキップするな',
          'クエスト目標を普段のプレイと重ねろ(例:占領クエスト中にピクセル占領)',
          '連続ログインクエストは FREE ティアで最高の報酬'
        ]},
        { type:'callout', variant:'pro', title:'ゼロコスト PP',
          text:'FREE ティアのクエストだけでも毎日安定して PP が手に入る。完全無料だ。普段のプレイと重ねれば効率は倍増する。' }
      ]
    },
    { id: 'guilds', icon: '⚔', title: 'ギルド & シーズン',
      blocks: [
        { type:'p', text:'単独成長に限界が来たら **ギルド** で結束しよう。ピクセルが自動合算され、ギルドチャット・エンブレム・シーズンリーダーボードまでチームプレイ要素は全部実装されている。シーズンは **30 日周期** で回り、毎シーズンテーマが変わる。' },
        { type:'toc', label:'このセクションの内容', items:[
          'ギルド作成と役職',
          'ギルドカスタマイズ費用',
          'ギルドチャット',
          'シーズンシステム',
          'シーズンスコア計算',
          'シーズン報酬'
        ]},

        { type:'h2', text:'1. ギルド作成と役職' },
        { type:'table',
          headers:['項目','値','出典'],
          rows:[
            ['作成費',      {v:'50 GP',cls:'num'},  '`guild_create_cost_gp`'],
            ['最大メンバー',      {v:'20 名',cls:'num'},   '`guild_max_members`'],
            ['役職',          'リーダー · オフィサー · メンバー',   '`guild_members.role`'],
            ['招待有効期限',      {v:'72 時間',cls:'num'},'`guild_invite_expire_hours`'],
            ['1 人 1 ギルド',      '強制 (UNIQUE wallet)',  '`guild_members`']
          ]},
        { type:'callout', variant:'info', title:'リーダー・オフィサー・メンバー',
          text:'**リーダー** — 追放・昇格・降格・解散・リーダー委譲。**オフィサー** — 招待・一部編集。**メンバー** — チャット・閲覧。リーダー長期不在時はオフィサーが代わりに運営できる。' },

        { type:'h2', text:'2. ギルドカスタマイズ費用' },
        { type:'p', text:'作成後も GP でギルドの外観を変え続けられる。リーダーのみ決済可能。' },
        { type:'table',
          headers:['項目','コスト','備考'],
          rows:[
            ['名称変更',          {v:'100 GP',cls:'num'}, '`guild_rename_cost_gp`'],
            ['説明変更',          {v:'20 GP',cls:'num'},  '`guild_desc_cost_gp`'],
            ['絵文字エンブレム',      {v:'50 GP',cls:'num'},  'テキスト絵文字'],
            ['ピクセルアートエンブレム',   {v:'50 GP',cls:'num'},  {v:'32×32 · 最大 8 KB',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'ピクセルアートエンブレムは強力なブランディング',
          text:'ギルドのピクセルアートエンブレムは **32×32** までアップロード可能。小さくても領土ポップアップに出れば認識力は抜群だ。' },

        { type:'h2', text:'3. ギルドチャット' },
        { type:'table',
          headers:['項目','値','出典'],
          rows:[
            ['最大長',   {v:'300 文字',cls:'num'},  '`guild_chat_max_len`'],
            ['クールダウン',     {v:'3 秒',cls:'num'},    '`guild_chat_cooldown_sec`'],
            ['履歴',    {v:'最新 100 件',cls:'num'}, '`guild_chat_history_limit`']
          ]},
        { type:'callout', variant:'info', title:'ポーリング方式',
          text:'WebSocket ではなく **ポーリング** 方式だ。メッセージが一回で更新されるのではなく数秒間隔で同期される。リアルタイム戦闘中は反応がやや遅く感じるかも。' },

        { type:'h2', text:'4. シーズンシステム' },
        { type:'p', text:'シーズンは **30 日周期**。各シーズンで火星天候の **テーマ** が選ばれ、**26 カテゴリの中から 6 つ** がランキング種目として無作為に活性化される。' },
        { type:'table',
          headers:['シーズン','テーマ','火星環境'],
          rows:[
            [{v:'シーズン 1',cls:'mars'}, '🌋 Volcanic Dawn',    'マグマ噴出口の再活性化'],
            [{v:'シーズン 2',cls:'mars'}, '❄ Frozen Frontier',  '極冠氷が赤道方向へ拡大'],
            [{v:'シーズン 3',cls:'mars'}, '☀ Solar Inferno',    'コロナ質量放出'],
            [{v:'シーズン 4',cls:'mars'}, '🌪 Dust Epoch',      '惑星規模の砂嵐']
          ]},
        { type:'callout', variant:'warn', title:'シーズンは 30 日 — 装飾ではない',
          text:'シーズン長は **30 日** にハード設定されている(`seasons.ends_at`)。テーマに応じて天候確率が変わり、視覚ティントが火星表面に被さる。' },

        { type:'h2', text:'5. シーズンスコア計算' },
        { type:'p', text:'ランキングカテゴリは合計 **26 種** — territory, mining, combat, defender, explorer, quester, gambler, recruiter, namer など。各シーズンで **そのうち 6 つだけ** が活性化され、プールから無作為に選ばれる。前シーズンに重要だったカテゴリが今シーズンは休眠している場合もある。' },
        { type:'table',
          headers:['活動','スコア','設定キー'],
          rows:[
            ['クレーム済みピクセル',   {v:'+1 点 / px',cls:'num'},  '`season_mult_pixels`'],
            ['ハーベスト完了',      {v:'+5 点',cls:'num'},       '`season_mult_harvest`'],
            ['ハイジャック勝利',    {v:'+10 点',cls:'num'},      '`season_mult_hijack`'],
            ['POI 発見',      {v:'+15 点',cls:'num'},      '`season_mult_poi`']
          ]},
        { type:'callout', variant:'tip', title:'まず活性 6 種を確認',
          text:'SEASON タブで今シーズンの活性カテゴリ 6 つを最初にチェック。*combat* が非活性のシーズンで戦闘ばかり狙うのは無駄 — 活性リーダーボードだけを追え。' },

        { type:'h2', text:'6. シーズン報酬' },
        { type:'p', text:'シーズンが終わるとカテゴリ別上位に自動支給される。受取は `RANK` タブで。' },
        { type:'table',
          headers:['順位','シーズン 1 報酬','シーズン 3 報酬'],
          rows:[
            [{v:'1 位',cls:'mars'},    {v:'3000 GP + 0.5 PP + 500 XP',cls:'num'}, {v:'5000 GP + 1.0 PP + 800 XP',cls:'num'}],
            [{v:'2 ~ 3 位',cls:'mars'}, {v:'1500 GP',cls:'num'},                   {v:'2500 GP',cls:'num'}],
            [{v:'4 ~ 10 位',cls:'mars'}, {v:'500 GP',cls:'num'},                    {v:'800 GP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'シーズンごとに報酬が大きくなる',
          text:'最初のシーズンが一番小さく、シーズンが進むほど報酬が大きくなるよう設計されている。長くプレイするほど複利のように報酬が増える。' }
      ]
    },
      { id: 'guildwar', icon: '🎮', title: 'ギルド戦 & ミニゲーム',
        blocks: [
          { type:'p', text:'ギルド戦は2つのギルドが**24時間のアーケード対決**を行うシステム。メンバーが火星テーマのミニゲームをプレイしてスコアを合算。合計スコアが高いギルドがGPを獲得。' },
          { type:'toc', label:'このセクションの内容', items:[
            '宣戦布告', 'ミニゲーム紹介', 'コンティニュー', 'スコア & 報酬'
          ]},
          { type:'h2', text:'1. 宣戦布告' },
          { type:'table',
            headers:['項目','値','設定'],
            rows:[
              ['宣戦コスト',  {v:'200 GP(財務から)',cls:'num'}, '`guild_war_declare_cost_gp`'],
              ['最低人数',    {v:'3人',cls:'num'},              '`guild_war_min_members`'],
              ['戦争時間',    {v:'24時間',cls:'num'},           '`guild_war_duration_hours`'],
              ['クールダウン', {v:'48時間',cls:'num'},           '`guild_war_cooldown_hours`'],
              ['同時戦争数',  {v:'ギルドあたり1',cls:'num'},    '`guild_war_max_active`'],
              ['勝利報酬',    {v:'500 GP → 財務',cls:'num'},   '`guild_war_winner_gp`']
            ]},
          { type:'callout', variant:'info', title:'両方チェック済み',
            text:'攻撃側も防衛側もアクティブな戦争がないことが必要。既に戦争中のギルドはターゲット不可。' },

          { type:'h2', text:'2. ミニゲーム' },
          { type:'table',
            headers:['ゲーム','テーマ','遊び方'],
            rows:[
              [{v:'🚀 Mars Invaders',cls:'mars'}, 'ギャラガ風', 'ドットスプライトのエイリアンウェーブを撃て。5波ごとにボス。240秒、3ライフ、オートファイア。'],
              [{v:'👨‍🚀 Mars Runner',cls:'mars'},  'パックマン迷路', 'ドットスプライトの宇宙飛行士でトンネル探索、ミネラル収集、エイリアン回避。パワーアップで敵を食える。240秒。'],
              [{v:'⛏️ Mars Digger',cls:'mars'},   'ディグダグ',  'ドットスプライトで火星の土を掘り、クリスタル収集、デューン風サンドワームをポンプ。落石で敵を潰せ。240秒。']
            ]},

          { type:'h2', text:'3. コンティニュー' },
          { type:'p', text:'死んでも**お金を払ってコンティニュー**できる。スコアを維持したまま再開。競争ギルドがスコアを極限まで伸ばす秘訣。' },
          { type:'table',
            headers:['回数','コスト','種類'],
            rows:[
              ['1回目', {v:'5 GP',cls:'num'},   'GP'],
              ['2回目', {v:'15 GP',cls:'num'},  'GP'],
              ['3回目', {v:'30 GP',cls:'num'},  'GP'],
              ['4回目', {v:'0.1 PP',cls:'num'}, 'PP(リアルマネー!)'],
              ['5回目', {v:'0.2 PP',cls:'num'}, 'PP(毎回2倍)'],
              ['6回目+', {v:'倍増し続ける',cls:'num'}, 'PP']
            ]},
          { type:'callout', variant:'warn', title:'PPコンティニューはリアルマネー',
            text:'3回目以降はPPで支払い。PP = リアルマネーだ。賢く使おう。' },

          { type:'h2', text:'4. スコア & 報酬' },
          { type:'p', text:'戦争中の全メンバーのゲームスコアをギルドごとに合算。24時間後、合計スコアが高いギルドが500 GPを財務に獲得。' }
        ]
      },
      { id: 'research', icon: '🔬', title: 'ギルド研究',
        blocks: [
          { type:'p', text:'ギルドは財務のGPで**7つの研究パーク**を解放できる。各研究は全メンバーに永久ボーナスを付与。' },
          { type:'table',
            headers:['研究','効果','設定'],
            rows:[
              ['⛏ 採掘効率 I',     {v:'+3% 収穫PP',cls:'num'},           '`mining_eff_1_bonus`'],
              ['🛡 シールド規律',   {v:'+15% 防御',cls:'num'},            '`shield_disc_bonus`'],
              ['🕊 外交免除',       {v:'-10% 侵攻成功率減少',cls:'num'},  '`diplomatic_bonus`'],
              ['🔭 軌道スキャン',   {v:'+15% 探索報酬',cls:'num'},        '`orbital_scan_bonus`'],
              ['🚀 高速展開',       {v:'-20% ミッション移動時間',cls:'num'},'`rapid_deploy_bonus`'],
              ['📦 物流ネットワーク', {v:'-10% クレームコスト',cls:'num'}, '`logistics_bonus`'],
              ['👑 火星支配',       {v:'+5% 全ボーナス重複',cls:'num'},   '`mars_dominion_bonus`']
            ]},
          { type:'callout', variant:'pro', title:'火星支配は最後に解放',
            text:'火星支配は全研究ボーナスに+5%を追加。採掘が+3.15%、防御が+15.75%になる。' }
        ]
      },
      { id: 'seasonpass', icon: '🎫', title: 'シーズンパス',
        blocks: [
          { type:'p', text:'各シーズンに**30段階バトルパス**(無料+プレミアム)。ゲームプレイでXPを貯めて段階報酬を解放。' },
          { type:'h2', text:'1. XP獲得' },
          { type:'table',
            headers:['アクション','XP','設定'],
            rows:[
              ['収穫',   {v:'+5 XP',cls:'num'},  '`season_pass_xp_harvest`'],
              ['クレーム', {v:'+10 XP',cls:'num'}, '`season_pass_xp_claim`'],
              ['侵攻',   {v:'+15 XP',cls:'num'}, '`season_pass_xp_invasion`'],
              ['探索',   {v:'+10 XP',cls:'num'}, '`season_pass_xp_exploration`'],
              ['クエスト', {v:'+8 XP',cls:'num'}, '`season_pass_xp_quest`']
            ]},
          { type:'h2', text:'2. 段階報酬' },
          { type:'p', text:'無料トラックは毎段階GP。プレミアムはより多くのGP+マイルストーンアイテム。**全報酬はGP — PPは一切なし。**' },
          { type:'table',
            headers:['段階','無料報酬','プレミアム報酬'],
            rows:[
              ['毎段階',         {v:'10×段階 GP',cls:'num'},  {v:'25×段階 GP',cls:'num'}],
              ['5段階ごと(無料)',{v:'50×段階 GPボーナス',cls:'num'}, '—'],
              ['10段階ごと(プレミアム)', '—',                  '特殊アイテム'],
              ['30段階(最大)',   {v:'500 GP',cls:'num'},      {v:'1500 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'プレミアムパスはGPで購入',
            text:'プレミアムアップグレードは現在のライブ既定値で **150 GP** (管理者調整可)。現シーズンのみ有効。' }
        ]
      },
      { id: 'exchange', icon: '💱', title: 'PP → GP 両替',
        blocks: [
          { type:'p', text:'GP が急ぎで必要? PP(価値トークン)を GP に両替する。レートは固定ではなく需要に応じて**変動**する。手数料分は永久バーン = **PP シンク**。' },
          { type:'h2', text:'1. 動的 PP → GP レート' },
          { type:'p', text:'レートは 24h の両替需要から再計算され、ハードバンド内に収まる。GP 需要が高いとレートは**下がり**(PP あたり GP 減)、低いと再び**上がる**。' },
          { type:'table',
            headers:['設定','値','ソース'],
            rows:[
              ['レートバンド', {v:'5 〜 20 GP/PP',cls:'num'}, '`pp_to_gp_rate_floor` / `_ceil`'],
              ['基準レート',   {v:'10 GP/PP',cls:'num'},      '`pp_to_gp_exchange_rate`'],
              ['1 回の変動',   {v:'±2% / 再計算',cls:'num'},   '`pp_to_gp_rate_max_step_pct`'],
              ['手数料',       {v:'5% (焼却)',cls:'num'},      '`pp_to_gp_exchange_fee_pct`'],
              ['動的レート',   {v:'有効',cls:'num'},           '`pp_to_gp_dynamic_enabled=true`']
            ]},
          { type:'callout', variant:'warn', title:'PP → GP は一方通行',
            text:'**PP を GP に**変換するのであって逆はできない — GP は PP に戻せない。艦船建造・強化・ガチャ・ショップ・ガバナンスに GP が必要なとき PP を両替せよ。普段の GP はログイン・ミッション・戦闘でも入る。' },
          { type:'callout', variant:'tip', title:'レートを見て両替',
            text:'レートは PP あたり 5〜20 GP の間で変動するので、GP 需要が低いとき(レートが 20 付近)に両替すると PP あたり GP を多く得られる。5% 手数料はバーンされ PP 供給を減らす。' },

          { type:'h2', text:'2. PP → USDT 換金(担保ゲート)' },
          { type:'p', text:'PP は `SWAP` タブで **USDT に換金**もできる — ただし運営者が積み立てた**担保プール**内でのみ。構造的にバンクランを防ぐ。' },
          { type:'formula', label:'換金可能枠(room)',
            eq:'room = ~担保~ − ~全ユーザー USDT 負債~',
            note:'PP → USDT 換金(と PP 由来の出金)は `room` までのみ許可される。プールが尽きると運営者が担保を補充するまで換金は停止する。' },
          { type:'callout', variant:'warn', title:'換金は無制限ではない',
            text:'PP は運営レート(変動あり)で USDT に換金でき、換金額は利用可能な担保枠に依存する — 固定ペッグではない。同時大量換金は上限に達することがある — これがバンクラン安全装置だ(`migration 230`)。' }
        ]
      },
    { id: 'casino', icon: '🎰', title: 'カンティナカジノ',
      blocks: [
        { type:'p', text:'**カンティナ** は 5 種ミニゲームで構成されるゲーム内カジノだ。すべて PP と USDT どちらでもベット可能。実際のハウスエッジがあるので収益源ではなくエンタメとして捉えよう。' },
        { type:'toc', label:'このセクションの内容', items:[
          'ゲーム 5 種サマリ',
          'ベット上限 & ハウスエッジ',
          'コインフリップ',
          'ダイス',
          'ハイロー',
          'クラッシュ / マインズ'
        ]},

        { type:'h2', text:'1. ゲーム 5 種サマリ' },
        { type:'table',
          headers:['ゲーム','タイプ','通貨'],
          rows:[
            [{v:'🚀 Crash',cls:'mars'},      'ライブ倍率','PP · USDT'],
            [{v:'💣 Mines',cls:'mars'},      'グリッド',  'PP · USDT'],
            [{v:'🪙 コインフリップ',cls:'mars'},'50/50',     'PP · USDT'],
            [{v:'🎲 ダイス',cls:'mars'},     'レンジロール','PP · USDT'],
            [{v:'🃏 ハイロー',cls:'mars'},   'カードストリーク','PP · USDT']
          ]},

        { type:'h2', text:'2. ベット上限 & ハウスエッジ' },
        { type:'table',
          headers:['ゲーム','最小ベット','最大ベット','ハウスエッジ'],
          rows:[
            [{v:'Crash',cls:'mars'},      {v:'0.1',cls:'num'},  {v:'50',cls:'num'},  {v:'4 %',cls:'num'}],
            [{v:'Mines',cls:'mars'},      {v:'0.1',cls:'num'},  {v:'20',cls:'num'},  {v:'3 %',cls:'num'}],
            [{v:'コインフリップ',cls:'mars'},{v:'0.1',cls:'num'},{v:'500',cls:'num'},{v:'~ 3 %',cls:'num'}],
            [{v:'ダイス',cls:'mars'},     {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'可変',cls:'num'}],
            [{v:'ハイロー',cls:'mars'},   {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 4 %',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'ハウスエッジは本当に効く',
          text:'長期的には全ゲームでハウスが勝つ。エッジが 3~4% ということは、ベットした全金額の平均 **3~4% が消える** という意味だ。100 PP ベットすれば平均 3~4 PP が蒸発する。' },

        { type:'h2', text:'3. コインフリップ' },
        { type:'p', text:'**HEADS か TAILS** を選んでベット、フリップ。当たれば 1.96 倍。シンプルで速い 50/50。' },
        { type:'callout', variant:'info', title:'シンプルだがハウスエッジはある',
          text:'50/50 に見えるが配当が 2.0 倍ではなくそれより低いためエッジが発生する。短時間で多数の試合ができるのが利点。' },

        { type:'h2', text:'4. ダイス' },
        { type:'p', text:'サイコロを振る。**特定範囲の上/下** を選び、範囲が狭いほど倍率が大きくなる。' },
        { type:'callout', variant:'tip', title:'範囲調整でリスク管理',
          text:'低倍率・高確率、または高倍率・低確率を自分で選べる。5 ゲーム中で最も調整幅が広い。' },

        { type:'h2', text:'5. ハイロー' },
        { type:'p', text:'カードが 1 枚公開される。次のカードが **現在より高いか/低いか** を当てる。連続で当てると倍率が累積する。' },
        { type:'callout', variant:'pro', title:'連勝が肝',
          text:'ベース配当は小さいが **ストリーク** で指数関数的に膨らむ。適切なタイミングでキャッシュアウトする感覚がすべて。' },

        { type:'h2', text:'6. Crash / Mines' },
        { type:'p', text:'**Crash** — 倍率が上昇し続けていつか墜落する。墜落前にキャッシュアウト。**Mines** — グリッドのタイルを開示。爆弾を避けて安全タイルを開くたびに倍率上昇。この 2 つがカンティナで最も人気のあるゲームだ。' },
        { type:'callout', variant:'warn', title:'責任を持ってプレイ',
          text:'カジノはエンタメだ。パッシブ採掘で 1 日に稼ぐ PP の一部だけで遊べ。収益源と見るな。1 試合にオールインすれば自動清算だ。' }
      ]
    },
    { id: 'dynasty', icon: '👑', title: 'DYNASTY/紹介',
      blocks: [
        { type:'p', text:'友人を招待すると **3 段階 MLM** 構造でコミッションが入る。直接招待した友人(Tier 1)だけでなく、その友人が招待した人(Tier 2)、さらにその下(Tier 3)まで全部自分の収益ラインになる。' },
        { type:'toc', label:'このセクションの内容', items:[
          '3 段階構造',
          'コミッション発生活動 (ライブ既定値)',
          'リーダーボードとツリービュー',
          '長期戦略'
        ]},

        { type:'h2', text:'1. 3 段階構造' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg">'+
            '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
            '<circle cx="260" cy="30" r="22" fill="rgba(255,209,102,.18)" stroke="#ffd166" stroke-width="2"/><text x="260" y="34" fill="#ffd166">YOU</text>'+
            '<circle cx="140" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="140" y="99">T1</text>'+
            '<circle cx="260" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="260" y="99">T1</text>'+
            '<circle cx="380" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="380" y="99">T1</text>'+
            '<circle cx="90"  cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="90"  y="159" font-size="9">T2</text>'+
            '<circle cx="180" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="180" y="159" font-size="9">T2</text>'+
            '<circle cx="260" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="260" y="159" font-size="9">T2</text>'+
            '<circle cx="340" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="340" y="159" font-size="9">T2</text>'+
            '<circle cx="430" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="430" y="159" font-size="9">T2</text>'+
            '</g>'+
            '<line x1="250" y1="48" x2="150" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="260" y1="52" x2="260" y2="75" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="270" y1="48" x2="370" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="132" y1="114" x2="94"  y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="148" y1="114" x2="176" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="260" y1="115" x2="260" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="372" y1="114" x2="336" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="388" y1="114" x2="425" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
          '</svg>',
          caption:'YOU → T1(直接招待)→ T2(間接)→ T3(3 段階まで)' },
        { type:'p', text:'テーブル `referral_rewards` には **tier INT** カラムがあり、各支払いがどの段階から来たか追跡される。段階別比率は管理者設定で調整可能 — ゲーム内の数字が変わる可能性があるので DYNASTY タブでリアルタイム比率を確認するのが正確だ。' },

        { type:'h2', text:'2. コミッション発生活動 (ライブ既定値)' },
        { type:'p', text:'現在のライブ既定値ではコミッションは **5 種類の活動** から発生する。一部ソースは運営設定で ON/OFF されるため、最終的なリアルタイム基準は DYNASTY タブを見ればよい。' },
        { type:'table',
          headers:['活動','説明'],
          rows:[
            ['💰 入金',        'USDT をゲームに入れるとき'],
            ['🔄 スワップ',        'USDT ↔ PP 交換'],
            ['🛒 ショップ',        'アイテム・コスメ購入'],
            ['🎰 カンティナ',       'カジノベット'],
            ['🏪 マーケット手数料',  '出品・取引手数料']
          ]},
        { type:'callout', variant:'info', title:'リアルタイム精算',
          text:'被紹介者がライブコミッションソースを実行するたび、即時 **PP 形式** で自分のウォレットに入る。採掘・ハイジャック・強化・オークション購入系は運営設定で無効化される場合がある。' },

        { type:'h2', text:'3. リーダーボードとツリービュー' },
        { type:'p', text:'`DYNASTY` タブで自分の紹介ツリーと全体リーダーボードを見られる。' },
        { type:'table',
          headers:['項目','内容'],
          rows:[
            ['紹介コード',      '自分のウォレットベースの固有コード'],
            ['直接招待数',    '自分が Tier 1 として持つ人数'],
            ['総ダウンライン',     'T1 + T2 + T3 合計'],
            ['累計収益',       'これまですべての Tier から受取った PP']
          ]},

        { type:'h2', text:'4. 長期戦略' },
        { type:'callout', variant:'pro', title:'DYNASTY はゲーム内最高 EV アクション',
          text:'領土・採掘は自分が働いた分しか稼げない(線形)。DYNASTY はネットワークが大きくなれば **複利** で膨らむ。活発なユーザーを 5 人招待するだけでパッシブ収益が自分の採掘を上回る時点が必ず来る。' },
        { type:'callout', variant:'warn', title:'ボット招待は無意味',
          text:'コミッションは被紹介者の **実際の支出** に連動する。ボット 100 人招待しても彼らが活動しなければ 0 PP だ。活動する 1 人がボット 1000 人より価値がある。' }
      ]
    },
    { id: 'cosmetics', icon: '✨', title: 'コスメ & アイテム',
      blocks: [
        { type:'p', text:'領土を飾る **視覚コスメ** と戦闘・効率を変える **消費アイテム** の 2 種類がある。どちらも `SHOP` タブで PP・USDT・GP で購入可能。' },
        { type:'toc', label:'このセクションの内容', items:[
          'コスメ 3 種カテゴリ',
          'シールド・ブースト・ユーティリティアイテム',
          '通貨別決済オプション',
          'ドロップ限定コスメ'
        ]},

        { type:'h2', text:'1. コスメ 3 種カテゴリ' },
        { type:'p', text:'領土ごとに **ボーダー 1 個 + グロー 1 個 + テレイン 1 個** ずつ装備可能。重複装備不可。' },
        { type:'table',
          headers:['カテゴリ','種類','価格帯'],
          rows:[
            [{v:'🟧 ボーダー',cls:'mars'}, 'ネオン · フレイム · アイス · ゴールド', {v:'3 ~ 15 PP',cls:'num'}],
            [{v:'✨ グロー',cls:'mars'}, 'パルス · レインボー · ダークオーラ',   {v:'4 ~ 8 PP',cls:'num'}],
            [{v:'⛰ テレイン',cls:'mars'},   'ボルケニック · フローズン · クリスタル · トキシック', {v:'5 ~ 7 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'シーズン終了後も保持',
          text:'一度購入したコスメは **永久保有**。シーズンリセット後も残り、複数領土に付け替えできる。' },

        { type:'h2', text:'2. シールド・ブースト・ユーティリティアイテム' },
        { type:'table',
          headers:['アイテム','効果','コスト'],
          rows:[
            [{v:'⚡ エナジーシールド',cls:'mars'},    'ハイジャックダメージ 50% 吸収(12h)', {v:'2.5 PP',cls:'num'}],
            [{v:'💠 プラズマシールド',cls:'mars'},  'ハイジャックダメージ 75% 吸収(24h)', {v:'5.0 PP',cls:'num'}],
            [{v:'🔥 Mars Rage',cls:'mars'},    '攻撃 +20% × 3 回',            {v:'2.0 PP',cls:'num'}],
            [{v:'🫥 ステルスクローク',cls:'mars'},   '領土隠蔽(8h)',             {v:'1.5 PP',cls:'num'}],
            [{v:'📡 レーダースキャン',cls:'mars'},   '隠蔽領土開示 1 回',          {v:'1.0 PP',cls:'num'}],
            [{v:'⛏ マイニングブースト',cls:'mars'}, '採掘 × 2(6h)',               {v:'3.0 PP',cls:'num'}],
            [{v:'🟡 ピクセルダブラー',cls:'mars'},  '次のクレームピクセル数 × 2',  {v:'4.0 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'コスパ No.1 — エナジーシールド',
          text:'2.5 PP はデイリーミッション 2~3 個の報酬で賄える。毎日 1 枚掛けておけば 24 時間防御が無料。シーズン上位を狙うなら常にプラズマシールドを装着しておけ。' },

        { type:'h2', text:'3. 通貨別決済オプション' },
        { type:'p', text:'すべてのショップアイテムは **PP・USDT・GP** 3 種類で決済可能。価格比率は以下の通り。' },
        { type:'table',
          headers:['通貨','換算'],
          rows:[
            ['PP',   {v:'基準価格',cls:'num'}],
            ['USDT', {v:'PP 価格と同じ(1:1)',cls:'num'}],
            ['GP',   {v:'PP 価格 × 4',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'GP を腐らせるな',
          text:'GP はガバナンスがメイン用途だがコスメも買える。ガバナー選挙に参加する気がないなら、GP でコスメを買って消費する方が領土装飾に有利だ。' },

        { type:'h2', text:'4. ドロップ限定コスメ' },
        { type:'p', text:'一部のコスメはショップで売られていない。ロケットドロップ・シーズン報酬・POI などの **イベントでのみ** 出現する。' },
        { type:'table',
          headers:['アイテム','出典','希少度'],
          rows:[
            [{v:'🚀 スターシップボーダー',cls:'mars'}, 'ロケットドロップ(2% 重み)', {v:'限定',cls:'num'}],
            [{v:'シーズンエンブレム',cls:'mars'},     'シーズン TOP 10',          {v:'限定',cls:'num'}],
            [{v:'💎 POI 特殊コスメ',cls:'mars'}, 'POI 発見 +5% 追加ロール', {v:'ランダム',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'一度逃すと終わり',
          text:'シーズン報酬コスメは該当シーズンが過ぎると **二度と手に入らない**。シーズン上位に入る自信がないなら、せめてロケットドロップだけでも拾え。' }
      ]
    },
    { id: 'strategy', icon: '🎯', title: '戦略のヒント',
      blocks: [
        { type:'p', text:'最後のセクションは **実戦運用のヒント** だ。初日・初週・長期プレイ段階別に何を優先すべきか、そしてこのゲームでよくある失敗パターンをまとめておいた。' },
        { type:'toc', label:'このセクションの内容', items:[
          '初日チェックリスト',
          '最初の 1 週間の運用法',
          '長期ビルド',
          'よくあるミス TOP 5'
        ]},

        { type:'h2', text:'1. 初日チェックリスト' },
        { type:'p', text:'初日にこの 5 つだけ終わらせれば **翌日から自動収益** が回り始める。' },
        { type:'table',
          headers:['順','やること','報酬'],
          rows:[
            [{v:'1',cls:'num'}, 'ログインボーナス受取',          {v:'5 GP',cls:'num'}],
            [{v:'2',cls:'num'}, 'デイリーミッション 3 個完了',          {v:'+50 GP',cls:'num'}],
            [{v:'3',cls:'num'}, 'FRONTIER セクターに小さなクレーム', {v:'ハーベスト開始',cls:'num'}],
            [{v:'4',cls:'num'}, 'POI を 1 個発見',               {v:'10~50 GP',cls:'num'}],
            [{v:'5',cls:'num'}, '紹介コードで友人 1 人招待',   {v:'Tier 1 セットアップ',cls:'num'}]
          ]},

        { type:'h2', text:'2. 最初の 1 週間の運用法' },
        { type:'p', text:'**目標: 領土 100~300 px + エナジーシールド常時装着 + ギルド加入。**' },
        { type:'callout', variant:'tip', title:'10 日ルーティン',
          text:'毎日 ① ログイン ② ミッション 3 個 ③ POI 2~3 個 ④ ハーベスト 1~2 回 ⑤ シールド更新。これだけで 1 日 100 GP + 1 PP 貯まる。7 日で 700 GP · 7 PP。' },
        { type:'callout', variant:'info', title:'ギルドはいつ加入?',
          text:'活動メンバー 10 人以上 + チャットが生きているギルド。作成は遅めが有利 — 1 人で作ると 50 GP を使ってもメンバーが集まらないことがある。' },

        { type:'h2', text:'3. 長期ビルド' },
        { type:'table',
          headers:['目標','戦略'],
          rows:[
            ['🏛 ガバナー当選',     '低トラフィックセクターから狙え。1000~3000 GP 貯めれば現職ガバナーを追い出せる。'],
            ['⚔ シーズン TOP 10',    'POI 中心運用(POI 1 個 = 15 点)。上位報酬のほとんどは GP なのでガバナーパワーに再投資。'],
            ['👑 コマンダー挑戦',     '全域 1 位 GP は数万 GP 単位。ギルドリーダー + 継続的な POI + 紹介ネットワークなしには不可能。'],
            ['💸 DYNASTY 複利',   '活発な大口を 3~5 人招待。彼らが使うすべての PP・USDT が自分の収益に還元される。']
          ]},

        { type:'h2', text:'4. よくあるミス TOP 5' },
        { type:'callout', variant:'warn', title:'① 採掘インフラなしでカジノ',
          text:'USDT 入金 → すぐカンティナ直行は最悪だ。ハウスエッジ 3~4% は本当に効く。領土と POI を安定化させてから。' },
        { type:'callout', variant:'warn', title:'② 辺境座標に大きなクレーム',
          text:'辺境に大型領土を買っても誰も見ない。CORE セクター 1 マスが FRONTIER 100 マスより目立つ。' },
        { type:'callout', variant:'warn', title:'③ シールド無視',
          text:'シールド 1 枚ケチってハイジャックで領土を失えば復旧コストは 20 倍。1 日 2.5 PP は絶対シールドに使え。' },
        { type:'callout', variant:'warn', title:'④ デイリーミッションスキップ',
          text:'デイリーミッション + ログインボーナス = 毎日無料 50~150 GP。1 ヶ月貯めれば 1500~4500 GP。これを逃すのはガバナー席を放棄するのと同じだ。' },
        { type:'callout', variant:'warn', title:'⑤ 友人を招待しない',
          text:'DYNASTY はこのゲームで **期待値(EV)が最も高いアクション** だ。友人 1 人招待するだけで線形成長が複利に変わる。紹介コードの宣伝は恥ずかしいことではない。' }
      ]
    }
  ]
};

CODEX_CONTENT.zh = {
  sections: [
    { id: 'siegewar', icon: '🏛', title: '公会攻城战',
      blocks: [
        { type:'p', text:'**逐区占领火星。** 公会在固定时间进行舰队战，夺取区域、征收税收，并最终争夺火星统帅之位。灵感来自 EVE 联盟战 + 天堂攻城战。' },
        { type:'h2', text:'🗺 区域与总督' },
        { type:'p', text:'• 火星分为**24个区域**(frontier/mid/core)。赢得区域攻城战的公会成为**总督**，将**区域税收**收入**公会金库**。\n• 全局查看 **BASE → GOVERN → 🗺 SOV MAP**: 谁统治哪个区域、统治公会排行、即将到来的攻城时间。' },
        { type:'h2', text:'⚔ 区域攻城战(每周)' },
        { type:'p', text:'1. 挑战者对区域宣战(需在该区域拥有领地)。\n2. 决战固定到**每周固定时段**(周三、周六 12:00 UTC)以便观战。\n3. **公会成员各投入1支舰队**进攻或防守(每人1舰队)。\n4. 决战时刻**所有投入舰队在同一战场实时作战** — 直接操控自己的舰队。\n5. 获胜公会成为新总督。' },
        { type:'h2', text:'🎮 实时指令' },
        { type:'p', text:'实时攻城中指挥**你自己的舰队**: **阵型**、**机动**、**集火**，以及充能手动技能 **☢ 光束** / **☄ 导弹**(服务器充能 — 满100%释放)。所有人观看同一权威战斗。' },
        { type:'callout', variant:'warn', title:'⚠ 舰船可能永久损失', text:'攻城 full-loss 开启时，战败舰队将被**永久摧毁**。想零风险？**不要投入舰队** — 改以领地占有率挑战/防守(按像素数判定，无舰船损失)。' },
        { type:'h2', text:'👑 统帅攻城战(每月)' },
        { type:'p', text:'• 控制最多区域的公会即**火星统帅**。每月一次(1日 12:00 UTC)自动开启**统帅攻城战**: 统帅(防守) vs 第2名公会(挑战)。胜者统治火星。\n• 若数个周期无人挑战，王座**空缺**并回退至控制最多区域的公会。' },
        { type:'h2', text:'💰 税收 → 公会金库' },
        { type:'p', text:'区域税收进入**公会金库**。会长/官员从公会面板提取。解散公会时金库**返还**给会长(不销毁GP)。' },
      ] },
    { id: 'whatsnew', icon: '🆕', title: '最新更新',
      blocks: [
        { type:'p', text:'**v7.27x — 2026-05 资源出航 + GP 中心经济。** 最新稳定版本。' },
        { type:'h2', text:'⛏ 资源出航 — 无需领地的F2P采集' },
        { type:'p', text:'• 通过**资源出航**（任务 → ⛏ 资源出航）派遣舰队，**无需领地即可采集GP+制作材料** — 无地玩家的F2P阶梯。\n• 选择**按距离的目的地**（近/中/远）：越远收益越高、材料越稀有，但**船体磨损**和**袭击风险**也越大。磨损的舰船须在**造船厂修理**（消耗GP）。\n• 收益与舰队的**载货量**（舰级×等级）成正比，出航的每日GP有上限。' },
        { type:'h2', text:'💱 GP ↔ PP 拍卖 & 奖励GP化' },
        { type:'p', text:'• **免费PP发放全部改为GP** — PP是**仅通过充值发行的USDT可赎回代币**。任务和指挥官悬赏奖励现在都以**GP**发放（UI全部显示GP）。\n• 无需充值就想要PP？**在拍卖行向其他玩家购买**（GP↔PP交易），价格由你决定，运营方绝不会用GP铸造PP。' },
        { type:'h2', text:'🏗 领土状态·等级·维护(TEND)' },
        { type:'p', text:'• 每块领土现在都有**状态(0~100,HP 概念)**和**等级(F → S)**。状态**每天小幅衰减**,若放任不管,等级就会下滑。\n• **🔧 TEND(维护)**(领土 **PRODUCTION** 面板)消耗 GP **恢复状态**并把等级重新拉高。\n• **等级越高,收益越大**: 收获 PP 与矿物掉落率随等级提升(约 **S ×1.5 ~ F ×0.6**)。持续打理领土直接关系到收益。' },
        { type:'h2', text:'🔓 按等级解锁标签页' },
        { type:'p', text:'• 高级功能按账号等级分阶段解锁: **舰队 Lv3、运输 Lv4、PVP Lv6、公会 Lv8、治理 Lv10**。\n• 核心前期标签(领地·商店·市场·战役)**从一开始就开放**。锁定的标签会显示 **🔒 + 所需等级**徽章。' },
        { type:'h2', text:'🤖 NPC 竞技场 — 活的世界' },
        { type:'p', text:'• NPC 舰队现在**全天候在竞技场战斗**,即使在冷门时段世界也显得鲜活,随时都有可观摩学习的对战。' },
        { type:'h2', text:'⛏ 材料供给再平衡' },
        { type:'p', text:'• 现在 frontier 区域也会掉落**部分 tier-2 制作材料**,新玩家无需拥有昂贵的 CORE 领地也能建造第一艘真正的舰船。' },
        { type:'h2', text:'🏪 地区市场区域筛选' },
        { type:'p', text:'• 舰船/物品市场可**按区域筛选** — 轻松发现跨区域套利和同区域交易。' },
        { type:'callout', variant:'warn', title:'⚠ 舰船永久损失(full-loss)已上线',
          text:'劫持战中被击沉(HP 0)的舰船现在会**永久损失** — 无法复活,必须在船坞重新建造。请把舰队当作可能失去的真实资产来运营。(`hijack_ship_loss_enabled = true`)' },
        { type:'h2', text:'💰 货币模型澄清' },
        { type:'p', text:'• **GP 是主要消费货币** — 通过每日登录、任务、战斗、远征奖励获得,也可**将 PP 兑换为 GP**。消费于商店、舰船建造/强化/维修、舰船扭蛋、领地升级、市场手续费等。\n• **PP 是领地采矿代币。** 可按运营汇率(可变,担保池额度内)赎回为 USDT — 并非固定锚定。通过领地收获(每日采矿上限)、注册/推荐/充值奖励获得。用于领地占领/升级、兑换为 GP、或**赎回为 USDT**(在运营方担保池额度内)。\n• **USDT** 是 Base 链的真实充提。' },
        { type:'h2', text:'🎰 舰船扭蛋(Ship Crate)' },
        { type:'p', text:'• 用 **GP** 开启舰船箱。三档: 标准 300 GP、高级 1,000 GP、传说 3,000 GP。\n• 每个箱子均**公开概率** + **保底(pity)**(高级 10 抽、传说 5 抽)保证巡洋舰或更高。' },
        { type:'h2', text:'📈 动态 PP ↔ GP 汇率' },
        { type:'p', text:'• PP→GP 汇率不再固定,随 24h 需求在 **每 PP 5~20 GP** 的硬区间内浮动,每次重算最多 **±2%**。GP 需求高则汇率下降,需求低则回升。' },
        { type:'h2', text:'🏪 地区(区域)市场' },
        { type:'p', text:'• 市场挂单现在绑定到**卖家的据点区域**。购买时可能对该**区域总督征收关税**,运营方还可选择仅允许同区域交易 — 让区域成为交易枢纽。' },
        { type:'h2', text:'🛡 经济安全机制' },
        { type:'p', text:'• **挤兑防护**: PP→USDT 赎回仅在运营方注资的**担保额度(room = 担保 − 负债)**内允许。无担保赎回不可。\n• **PP 采矿上限**: 被动收获上限为**每用户 1 PP/天**(`mining_daily_cap_per_user=1.0`),反巨鲸设计。\n• 推荐奖励设有**女巫防御**(按账号与每日上限)。' },
        { type:'h2', text:'⚙ 基础设施' },
        { type:'p', text:'• **多实例水平扩展** — 调度器/监听器 worker 由 `RUN_SCHEDULERS` 开关分离,Redis 缓存 + 共享限流(内存回退)。\n• **WebSocket 实时推送** — 聊天与活动流改用 WebSocket 推送而非轮询,通过 Redis Pub/Sub 跨实例扇出。' },
        { type:'h2', text:'🚢 实时舰队战' },
        { type:'p', text:'• WebSocket 实时战斗查看器 — 舰队位置、HP、阵型实时更新。\n• Tactical Lab v11 为官方战斗查看器,22 种舰船 PNG 精灵图(俯视角)。\n• 手动技能: 粒子炮 ☢、导弹齐射 ☄、EMP、集中火力。\n• 收获在 BASE → 领地内逐块进行(CORE 24h / MID 48h / FRONTIER 72h),附带矿物掉落。' },
        { type:'callout', variant:'tip', title:'面向开发者',
          text:'完整技术细节请查看仓库根目录的 `CHANGELOG.md` 和 `AUDIT_FINDINGS.md`。' }
      ]
    },
    { id: 'overview', icon: '🌍', title: '游戏概述',
      blocks: [
        { type:'p', text:'**Occupy Mars** 是运行在 Base 链上的**领土征服 MMO**。在 3D 火星球体上占领像素领土,通过采矿积累 PP,袭击对手,加入公会,争夺赛季排行榜 — 简而言之,就是**火星的数字殖民化**。' },
        { type:'toc', label:'本节内容', items:[
          '核心游戏循环',
          '货币结构 (USDT / PP / GP / XP)',
          '胜利条件',
          '进度 & 解锁',
          '前 5 分钟清单'
        ]},

        { type:'h2', text:'1. 核心游戏循环' },
        { type:'p', text:'所有活动都围绕下方的 **5 步循环** 展开。每完成一轮,你的领土、资本和声望都会扩张。' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg">'+
            '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
            '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
            '<circle cx="60"  cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="60"  y="66">🏴</text><text x="60"  y="82" fill="#ff783c">CLAIM</text>'+
            '<circle cx="170" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="170" y="66">⛏</text><text x="170" y="82" fill="#ff783c">MINE</text>'+
            '<circle cx="280" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="280" y="66">🛡</text><text x="280" y="82" fill="#ff783c">DEFEND</text>'+
            '<circle cx="390" cy="70" r="32" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/><text x="390" y="66">⚔</text><text x="390" y="82" fill="#ff783c">RAID</text>'+
            '<circle cx="480" cy="70" r="32" fill="rgba(255,120,60,.18)" stroke="#ffd166" stroke-width="2"/><text x="480" y="66">📈</text><text x="480" y="82" fill="#ffd166">GROW</text>'+
            '</g>'+
            '<line x1="94"  y1="70" x2="134" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="204" y1="70" x2="244" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="314" y1="70" x2="354" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<line x1="424" y1="70" x2="444" y2="70" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar)"/>'+
            '<path d="M480,100 Q480,130 260,130 Q60,130 60,100" fill="none" stroke="#ff783c" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="4,4" marker-end="url(#ar)"/>'+
          '</svg>',
          caption:'CLAIM → MINE → DEFEND → RAID → GROW →(再次 CLAIM)' },

        { type:'h2', text:'2. 货币结构' },
        { type:'p', text:'游戏中有 **4 种资产** 在流转,各自角色不同,不要混淆。' },
        { type:'table',
          headers:['资产','角色','获取','用途','可转换?'],
          rows:[
            [{v:'💵 USDT',cls:'mars'},  '真实加密货币',     '充值(Base 链)',                  '高级占领·饰品·卡提纳', {v:'充值 / 提现',cls:'num'}],
            [{v:'🥔 PP',cls:'mars'},    '领地代币 (~$1)',  '领地收获·注册/推荐/充值',         '领地占领/升级, →GP, →USDT 赎回',   {v:'→GP / →USDT (有额度)',cls:'num'}],
            [{v:'🏛 GP',cls:'mars'},    '主要消费货币',    '登录·任务·战斗·PP→GP',            '商店, 舰船(建造/强化/维修/扭蛋), 升级', {v:'通过 PP→GP 获得',cls:'num'}],
            [{v:'⭐ XP',cls:'mars'},    '账号等级',        '所有活动',                        '等级特权·费用加成',        {v:'✕',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'用 GP 消费,用 PP 储值',
          text:'**GP 是几乎所有消费(商店·舰船·升级)的货币**,靠奖励攒取并通过兑换 PP 补充。**PP 是价值代币**,你采矿获得它、换成 GP、或按运营汇率(可变)赎回为 USDT(在运营方担保池额度内)— 并非固定锚定。**USDT 是真钱**,在赌场投注会真的亏钱。详情见 [代币经济](#tokens) §2。' },

        { type:'h2', text:'3. 胜利条件' },
        { type:'callout', variant:'pro', title:'没有终局',
          text:'Occupy Mars 是一个 **永续世界**。目标不是分数,而是积累 **领土 + 声望 + 治理权力**,成为一个「没人能忽视的指挥官」。每个赛季重置的只是排行,领土和资产是永久的。' },

        { type:'h2', text:'4. 进度 & 解锁' },
        { type:'p', text:'核心前期循环**从一开始就开放** — 领地、商店、市场、战役无需等级。高级功能随账号等级提升而解锁。锁定的标签会显示 **🔒 + 所需等级**徽章。' },
        { type:'table',
          headers:['功能','解锁等级'],
          rows:[
            ['领地 · 商店 · 市场 · 战役', {v:'Lv 1 (开放)',cls:'num'}],
            ['🚢 舰队 & 船坞',            {v:'Lv 3',cls:'num'}],
            ['🚚 运输',                  {v:'Lv 4',cls:'num'}],
            ['⚔ PVP',                   {v:'Lv 6',cls:'num'}],
            ['🛡 公会',                  {v:'Lv 8',cls:'num'}],
            ['🏛 治理',                  {v:'Lv 10',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'边玩边升级',
          text:'每次占领、劫持、任务和登录都会获得 XP。只要跑日常循环就能很快越过这些门槛 — XP 表见 [代币经济](#tokens) §4。' },

        { type:'h2', text:'5. 前 5 分钟清单' },
        { type:'p', text:'首次启动游戏时,按这个顺序做,可以最快进入正式玩法:' },
        { type:'table',
          headers:['#','要做的事','实际奖励'],
          rows:[
            [{v:'1'}, '连接钱包 & 注册昵称',                  {v:'每日免费舰船宝箱 + 每日登录 GP',cls:'num'}],
            [{v:'2'}, '首次像素 CLAIM',                             {v:'+2 XP / px',cls:'num'}],
            [{v:'3'}, '首次 USDT 充值',                              {v:'+50 XP + 10% PP 奖励',cls:'num'}],
            [{v:'4'}, '完成所有免费层每日任务',            {v:'≈ 0.1~0.3 PP + 15 XP',cls:'num'}],
            [{v:'5'}, '输入推荐码 → 分享自己的代码',              {v:'DYNASTY 链路激活',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'不知从何开始?',
          text:'长期收益的核心是 **每日任务例程 + POI 狩猎 + DYNASTY 推荐**。采矿只是小额基线。详情见 [采矿与收入](#mining) §4 和 [DYNASTY/推荐](#dynasty) §8。' }
      ]
    },
    { id: 'tokens', icon: '🪙', title: '代币经济',
      blocks: [
        { type:'p', text:'游戏内的每个数字都属于 4 种资产之一。**它们角色不同,彼此并不完全互通**。本节整理如何赚取和如何花费每种资产。' },
        { type:'toc', label:'本节内容', items:[
          'USDT — 真实货币',
          'PP — 游戏主货币',
          'GP — 治理积分',
          'XP — 账号等级',
          '资产流程图(兑换与转换)'
        ]},

        { type:'h2', text:'1. USDT — 真实货币' },
        { type:'p', text:'**Base 链上的 Tether USD**。真钱。游戏不铸造,只能从你的钱包 **充值/提现**。像素占领的 **基础价格单位** 也是以 USDT 计价。' },
        { type:'table',
          headers:['扇区等级','每像素基础价','乘数后'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 最多 3 (动态)',cls:'num'}],
            [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 最多 2',cls:'num'}],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'充值奖励',
          text:'USDT 充值时自动获得 **+10% PP 奖励**(`deposit_pp_bonus=10`)。首次充值额外 **+50 XP** 一次性奖励。' },
        { type:'callout', variant:'warn', title:'USDT 是真钱',
          text:'游戏中所有带 `USDT` 标签的数字都是 **你的真实资金**。在赌场用 USDT 投注就是真的在烧钱。务必谨慎。' },

        { type:'h2', text:'2. PP — Pixel Points (价值代币)' },
        { type:'p', text:'PP 是**领地采矿的价值代币**,可按运营汇率(可变)赎回为 USDT — 并非固定锚定。通过注册奖励 + 充值/推荐获得。它不是日常消费货币,而是用来**储值、换成 GP、或赎回为 USDT**的资产。' },
        { type:'formula', label:'PP 获取途径',
          eq:'PP = ~领地收获~ + ~注册奖励~ + ~推荐~ + ~充值奖励~',
          note:'被动收获上限为**每用户 1 PP/天**(`mining_daily_cap_per_user=1.0`)。PP 被设计得稀缺且有价值 — 无法批量刷取。' },
        { type:'table',
          headers:['PP 用途','详情'],
          rows:[
            ['领地占领/升级', {v:'像素占领 & 领地升级',cls:'num'}],
            ['PP → GP 兑换',  {v:'动态汇率 5~20 GP/PP',cls:'num'}],
            ['PP → USDT 赎回', {v:'担保额度内',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'PP ↔ USDT 赎回',
          text:'`SWAP` 标签可把 PP 换成 USDT(或反向)。**赎回仅在运营方注资的担保池额度内允许** — 没有无限套现。挤兑防护规则见 [PP ⇄ USDT 赎回](#exchange)。' },

        { type:'h2', text:'3. GP — Game Points (主要消费货币)' },
        { type:'p', text:'GP 是**游戏内主要消费货币**。用于商店、舰船建造/强化/维修、舰船扭蛋、领地升级、市场手续费、治理行动等。通过游戏奖励**以及 PP → GP 兑换**攒取。' },
        { type:'table',
          headers:['获取方式','详情'],
          rows:[
            ['每日登录/任务',          {v:'登录 + 每日 3 种',cls:'num'}],
            ['POI 掉落 (70% 权重)',     {v:'10 ~ 50 GP/POI',cls:'num'}],
            ['火箭掉落 (50% 权重)',    {v:'10 ~ 40 GP/掉落',cls:'num'}],
            ['战斗 / 远征',            {v:'每击沉奖励',cls:'num'}],
            ['PP → GP 兑换',           {v:'5~20 GP/PP (动态)',cls:'num'}],
            ['扇区税收 / 总督',        {v:'扇区持续收入',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'GP 不足就兑换 PP',
          text:'建造或强化时 GP 不够,就在 `SWAP`/兑换标签把 PP 换成 GP。汇率随需求在每 PP 5~20 GP 之间浮动。详情见 [PP → GP 兑换](#exchange) §1。' },

        { type:'h2', text:'4. XP & 等级' },
        { type:'p', text:'**所有活动** 都会积累 XP。实际等级表(共 30 级 — 部分显示):' },
        { type:'table',
          headers:['Lv','名称','所需 XP','升级奖励'],
          rows:[
            [{v:'1',cls:'num'},  'Dust Walker',    {v:'0',cls:'num'},       {v:'—',cls:'num'}],
            [{v:'5',cls:'num'},  'Storm Chaser',   {v:'1,600',cls:'num'},   {v:'+18 PP',cls:'num'}],
            [{v:'10',cls:'num'}, 'Lava Walker',    {v:'12,500',cls:'num'},  {v:'+85 PP',cls:'num'}],
            [{v:'15',cls:'num'}, 'Storm Commander',{v:'42,000',cls:'num'},  {v:'+260 PP',cls:'num'}],
            [{v:'20',cls:'num'}, 'God of Mars',    {v:'100,000',cls:'num'}, {v:'+700 PP',cls:'num'}],
            [{v:'25',cls:'num'}, 'Crimson Archon', {v:'260,000',cls:'num'}, {v:'+2,000 PP',cls:'num'}],
            [{v:'30',cls:'num'}, 'Architect of Worlds', {v:'1,000,000',cls:'num'}, {v:'+6,000 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'XP 获取量',
          text:'`xp_per_claim=2/px`、`xp_per_hijack=3/px`,每日任务 `5 XP`,每周任务 `30 XP`,每日登录 `5 XP`,首次充值 `50 XP`,领土防守 1 周 `1 XP/px`。' },
        { type:'callout', variant:'pro', title:'升级门槛',
          text:'Lv 5、10、15、20、25 除了纯 XP 外还有 **活动要求**(持有像素数、游玩天数、劫掠次数、充值额等)。光靠 XP 是过不去的。' },

        { type:'h2', text:'5. 资产流程图' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 500 180" xmlns="http://www.w3.org/2000/svg" font-family="monospace">'+
            '<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ff783c"/></marker></defs>'+
            '<rect x="30"  y="30" width="110" height="50" rx="6" fill="rgba(91,184,232,.1)" stroke="#5bb8e8" stroke-width="1.5"/>'+
            '<text x="85"  y="55" text-anchor="middle" font-size="12" fill="#5bb8e8" font-weight="700">USDT</text>'+
            '<text x="85"  y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">真实货币</text>'+
            '<rect x="195" y="30" width="110" height="50" rx="6" fill="rgba(255,120,60,.12)" stroke="#ff783c" stroke-width="1.5"/>'+
            '<text x="250" y="55" text-anchor="middle" font-size="12" fill="#ff783c" font-weight="700">PP</text>'+
            '<text x="250" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">价值代币 ~$1</text>'+
            '<rect x="360" y="30" width="110" height="50" rx="6" fill="rgba(255,209,102,.1)" stroke="#ffd166" stroke-width="1.5"/>'+
            '<text x="415" y="55" text-anchor="middle" font-size="12" fill="#ffd166" font-weight="700">GP</text>'+
            '<text x="415" y="70" text-anchor="middle" font-size="8"  fill="#9aa3b0">主要消费货币</text>'+
            '<line x1="140" y1="55" x2="190" y2="55" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="165" y="48" text-anchor="middle" font-size="8" fill="#ff783c">赎回</text>'+
            '<line x1="190" y1="60" x2="140" y2="60" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)" stroke-dasharray="3,3"/>'+
            '<line x1="305" y1="55" x2="355" y2="55" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="330" y="48" text-anchor="middle" font-size="8" fill="#ffd166">PP→GP 5-20</text>'+
            '<text x="250" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">领地采矿·奖励 ↓</text>'+
            '<line x1="250" y1="125" x2="250" y2="80" stroke="#ff783c" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="415" y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">登录·任务·战斗 ↓</text>'+
            '<line x1="415" y1="125" x2="415" y2="80" stroke="#ffd166" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="85"  y="115" text-anchor="middle" font-size="9" fill="#9aa3b0">充值 ↓</text>'+
            '<line x1="85"  y1="125" x2="85"  y2="80" stroke="#5bb8e8" stroke-width="1.5" marker-end="url(#ar2)"/>'+
            '<text x="250" y="160" text-anchor="middle" font-size="9" fill="#ff783c" letter-spacing="1">ASSET FLOW — USDT ⇄ PP → GP (PP→GP 动态汇率)</text>'+
          '</svg>',
          caption:'USDT ⇄ PP 赎回(担保额度内) / PP → GP 动态汇率 5~20' }
      ]
    },
    { id: 'wallet', icon: '🔐', title: '钱包与密钥保管',
      blocks: [
        { type:'p', text:'游玩**无需**MetaMask或任何外部钱包。用邮箱注册时,游戏会**自动为你创建一个真实钱包(密钥对)。** 该钱包保管你的链上资产,所有游戏行为都与它绑定。' },
        { type:'toc', label:'本节内容', items:[
          '自动生成钱包',
          '查看与备份私钥',
          '密钥保管责任(免责)',
          '充值与提现'
        ]},

        { type:'h2', text:'1. 自动生成钱包' },
        { type:'p', text:'邮箱注册时,游戏在后台为你生成真正的**密钥对** — 无需浏览器扩展、无需单独的钱包应用、无需设置助记词。注册后即可立刻开始占领领地与赚取收益。' },
        { type:'callout', variant:'info', title:'无需MetaMask',
          text:'系统自动为你配置一个真实钱包。生成的地址即为你的游戏内身份,也是充值的目标地址。' },

        { type:'h2', text:'2. 查看与备份私钥' },
        { type:'p', text:'你可随时**查看并备份自己的私钥。** 打开**BASE中的钱包面板**,点击**🔑 KEY**按钮并再次输入密码确认,密钥便会显示出来供你复制保存。' },
        { type:'callout', variant:'tip', title:'离线备份',
          text:'请将密钥复制到离线的安全处(例如保险箱里的手写记录,或加密的离线文件)。这是唯一能恢复资产访问权的凭据。' },

        { type:'h2', text:'3. 密钥保管责任(免责)' },
        { type:'callout', variant:'warn', title:'⚠ 私钥保管责任完全在于你本人',
          text:'私钥的保管责任**完全在于你本人。** 一旦丢失或被盗,**运营方无法找回你的密钥或资产** — 没有重置,也没有后门。请将密钥离线安全保管,并且**绝不向任何人分享**,包括任何自称是客服的人。' },

        { type:'h2', text:'4. 充值与提现' },
        { type:'p', text:'账户充值使用你的自动生成钱包:' },
        { type:'table',
          headers:['操作','工作方式'],
          rows:[
            ['USDT充值', {v:'自动检测,计入游戏余额',cls:'num'}],
            ['提现',     {v:'需通过安全流程(密码 / 签名)',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'充值自动检测',
          text:'向你Base链钱包发送的USDT会被**自动检测**并反映到游戏余额中。**提现需先通过安全流程(密码 / 签名)**后才会放行。' }
      ]
    },
    { id: 'territory', icon: '🏴', title: '领土系统',
      blocks: [
        { type:'p', text:'购买火星表面的 **像素** 是这款游戏的起点。一次占领就是指定一个矩形区域,上传图片,插上你的旗帜。' },
        { type:'toc', label:'本节内容', items:[
          '占领基本规则',
          '各等级价格',
          '劫掠(领土夺取)',
          '护盾(防御)',
          '图像上传限制',
          '领土改名',
          '状态·等级·维护(TEND)'
        ]},

        { type:'h2', text:'1. 占领基本规则' },
        { type:'p', text:'按下 `CLAIM` 按钮,在球体上拖拽矩形 → 上传图片 → 付款。一次交易最大可占 **500×500 像素**(`max_claim_width=500`, `max_claim_height=500`)。' },
        { type:'callout', variant:'info', title:'像素永久所有',
          text:'购买后的像素 **即使赛季重置也不会消失**。在被劫掠或自己放弃之前,都是你的永久资产。' },

        { type:'h2', text:'2. 各等级价格' },
        { type:'p', text:'火星表面分为 3 个等级。越中心越贵,但收获周期越快。' },
        { type:'table',
          headers:['等级','每像素基础价','动态乘数','特征'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'0.15 USDT',cls:'num'}, {v:'× 最多 3.0',cls:'num'}, '收获 24h·劫掠目标'],
            [{v:'🟡 MID',cls:'mars'},      {v:'0.05 USDT',cls:'num'}, {v:'× 最多 2.0',cls:'num'}, '收获 48h·平衡型'],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'0.02 USDT',cls:'num'}, {v:'× 1.0',cls:'num'},      '收获 72h·边疆']
          ]},
        { type:'callout', variant:'tip', title:'价格随需求波动',
          text:'每等级价格会乘上 **动态乘数**。扇区里已卖出的像素越多,价格就越高,最多涨 3 倍。想便宜买就盯冷清扇区。' },

        { type:'h2', text:'3. 劫掠 — 领土夺取' },
        { type:'p', text:'在别人已占领的像素上继续 CLAIM 就是 **劫掠**。付出原价的 **1.2 倍**,领土就归你了(`hijack_multiplier=1.2`)。' },
        { type:'table',
          headers:['项目','值','备注'],
          rows:[
            ['基础倍率',         {v:'× 1.2',cls:'num'},    '按 1.2 倍支付给原主'],
            ['原主返还',       {v:'+50 %',cls:'num'},    '劫掠费用的 50% 作为补偿返回'],
            ['护盾抵扣',         {v:'50 ~ 75 %',cls:'num'},'有护盾时吸收伤害']
          ]},
        { type:'callout', variant:'warn', title:'⚠ 劫持战中的舰船永久损失',
          text:'劫持可能升级为**舰队战**,在那里被击沉(HP 0)的舰船会**永久损失** — 无法复活,必须在船坞重新建造(`hijack_ship_loss_enabled=true`)。绝不要带上你无法承受失去的舰船。建造/维修见 [舰队与船坞](#fleet)。' },
        { type:'callout', variant:'warn', title:'轻率劫掠反吃亏',
          text:'在昂贵的 CORE 扇区劫掠,费用会立刻飙到几十 USDT。**超过一周没活动的大型领地** 才是最划算的目标。为了抢小地块去劫掠只会白白送手续费。' },
        { type:'callout', variant:'pro', title:'劫掠也计赛季分',
          text:'每劫掠 1 像素 `xp_per_hijack=3 XP`。赛季榜前列几乎都是劫掠高手。' },

        { type:'h2', text:'4. 护盾 — 防御物品' },
        { type:'p', text:'装备护盾后会 **吸收** 一定 % 的劫掠伤害。在商店里 PP/USDT 都能买。' },
        { type:'table',
          headers:['物品','费用','持续','吸收率'],
          rows:[
            [{v:'⚡ 基础能量护盾',cls:'mars'},{v:'2.5 PP / 2.5 USDT',cls:'num'}, {v:'12 小时',cls:'num'}, {v:'50 %',cls:'num'}],
            [{v:'💠 等离子护盾',cls:'mars'},{v:'5.0 PP / 5.0 USDT',cls:'num'}, {v:'24 小时',cls:'num'}, {v:'75 %',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'基础配置是 12h 能量护盾',
          text:'2.5 PP 就能削掉一半劫掠伤害。随便一个每日任务奖励就够买一个,天天挂着是常规操作。' },

        { type:'h2', text:'5. 图像上传限制' },
        { type:'table',
          headers:['项目','限制','备注'],
          rows:[
            ['最大容量', {v:'5 MB',cls:'num'},                '`max_image_size_mb=5`'],
            ['允许格式', {v:'PNG · JPG · GIF · WEBP',cls:'num'},'支持动态 GIF'],
            ['链接 URL', {v:'仅 https://',cls:'num'},          '出于安全禁用 HTTP']
          ]},
        { type:'callout', variant:'tip', title:'动图在悬停时播放',
          text:'上传动态 GIF 后,在球体上你的领土被悬停时会播放。越重要的领土越适合用会动的,更显眼。' },

        { type:'h2', text:'6. 领土改名' },
        { type:'p', text:'点击领土弹出的信息面板可以设置 **自定义名称**,费用很低。' },
        { type:'table',
          headers:['项目','费用'],
          rows:[
            ['领土改名', {v:'0.3 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'名字是公会·劫掠的心理战武器',
          text:'起个类似「Do Not Hijack — Woo\'s HQ」的名字,劫掠尝试会真的减少。讲究社区礼仪的玩家大多不会去碰带名字的领土。' },

        { type:'h2', text:'7. 状态·等级·维护(TEND)' },
        { type:'p', text:'每块领土都带有**状态(0~100,HP 概念)**和**等级(F → S)**。状态**每天小幅衰减**,因此从不打理的领土会慢慢沿等级阶梯下滑。打开领土 **PRODUCTION** 面板即可看到 HP 条与等级徽章。' },
        { type:'table',
          headers:['等级','收获 PP','矿物掉落'],
          rows:[
            [{v:'S',cls:'mars'}, {v:'× 1.50',cls:'num'}, {v:'× 1.50',cls:'num'}],
            [{v:'A',cls:'mars'}, {v:'× 1.25',cls:'num'}, {v:'× 1.30',cls:'num'}],
            [{v:'B',cls:'mars'}, {v:'× 1.10',cls:'num'}, {v:'× 1.15',cls:'num'}],
            [{v:'C',cls:'mars'}, {v:'× 1.00',cls:'num'}, {v:'× 1.00',cls:'num'}],
            [{v:'D',cls:'mars'}, {v:'× 0.85',cls:'num'}, {v:'× 0.90',cls:'num'}],
            [{v:'F',cls:'mars'}, {v:'× 0.60',cls:'num'}, {v:'× 0.75',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'🔧 TEND 维持收益流',
          text:'PRODUCTION 面板里的 **🔧 TEND(维护)** 按钮消耗 GP 恢复状态并把等级重新拉高。由于**等级越高,收获 PP 越多、矿物掉落越多**,定期维护你的优质领地能回本。把领土放任到 F 级,它只能赚到潜在收益的一半多一点。' }
      ]
    },
    { id: 'mining', icon: '⛏', title: '采矿 & 收入',
      blocks: [
        { type:'p', text:'在火星上赚 PP(Potato Points)的方法有 5 种。**被动采矿** 是稳定的基础收入,但 **收益率不高**。真正的大钱来自 POI、火箭、每日任务和佣金(DYNASTY)。' },
        { type:'toc', label:'本节内容', items:[
          '被动采矿公式(实际数值)',
          '按持有像素的收获量',
          '各等级收获周期',
          'POI(资源点)',
          '火箭事件',
          '每日任务',
          '佣金收入(DYNASTY)'
        ]},

        { type:'h2', text:'1. 被动采矿公式' },
        { type:'p', text:'只要持有领地,每个收获周期就会 **自动** 累积 PP 和矿物。在 BASE → **My Territory** 标签中,点击每块领地的 ⛏ 按钮单独收取。MINE 标签已废弃。' },
        { type:'formula', label:'HARVEST YIELD PER CYCLE',
          eq:'Yield = rand(~0.01~, ~0.5~) × min( ~√pixels~ ÷ 10, ~3.0~ )   →   max ~1.0 PP~ / harvest',
          note:'要点:**平方根缩放 + 3 倍封顶 + 每次收获 1 PP 上限**。多买 10,000 倍像素,收益也只翻 3 倍。反巨鲸设计。' },
        { type:'callout', variant:'warn', title:'重要 — 像素不是无限扩展',
          text:'`pixelFactor` 是 √pixels/10 的 **平方根**。1 像素 → 0.1,100 → 1.0,1,000 → 3.0(封顶)。超过 1,000 像素后,**每增加一像素的采矿收入是 0**。只为了挖矿一直买地是浪费。' },
        { type:'callout', variant:'info', title:'等级乘数只影响「周期」',
          text:'CORE/MID/FRONTIER 差别在 **收获周期**(24h / 48h / 72h),不是 **奖励金额**。跨多个等级的领地使用最好等级(CORE > MID > FRONTIER)的周期。' },

        { type:'h2', text:'2. 按持有像素的收获量(平均)' },
        { type:'table',
          headers:['持有像素','pixelFactor','每周期平均','CORE 每日','FRONTIER 每日'],
          rows:[
            [{v:'1 px'},      {v:'0.10',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.026 PP',cls:'num'}, {v:'≈ 0.009 PP',cls:'num'}],
            [{v:'10 px'},     {v:'0.32',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.081 PP',cls:'num'}, {v:'≈ 0.027 PP',cls:'num'}],
            [{v:'100 px'},    {v:'1.00',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}, {v:'≈ 0.085 PP',cls:'num'}],
            [{v:'1,000 px'},  {v:'3.00 (封顶)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}],
            [{v:'10,000 px'}, {v:'3.00 (封顶)',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.765 PP',cls:'num'}, {v:'≈ 0.255 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'硬上限',
          text:'各种加成(总督 +20%·扇区 buff +20%·Double Mining ×2·天气·Starlink·物品)会相乘,但最终值 **每次收获封顶 1.0 PP**。即便是顶级玩家,被动采矿每天最多也只有约 **1 PP**。' },
        { type:'callout', variant:'pro', title:'高手提示',
          text:'只靠采矿进不了顶层。被动采矿只是「生活费」级别。真正的增长来自 **POI 狩猎 + 每日任务 + DYNASTY 佣金**。下面几节好好看。' },

        { type:'h2', text:'3. 各等级收获周期' },
        { type:'table',
          headers:['等级','收获周期','每日收获次数','备注'],
          rows:[
            [{v:'🔴 CORE',cls:'mars'},     {v:'24 h',cls:'num'}, {v:'1 次',cls:'num'}, '中心部 — 高流量·劫掠目标'],
            [{v:'🟡 MID',cls:'mars'},      {v:'48 h',cls:'num'}, {v:'0.5 次',cls:'num'}, '中间 — 平衡型'],
            [{v:'⚪ FRONTIER',cls:'mars'}, {v:'72 h',cls:'num'}, {v:'0.33 次',cls:'num'}, '边疆 — 便宜但慢']
          ]},
        { type:'callout', variant:'tip', title:'同面积 3 倍效率',
          text:'CORE 1 像素 + FRONTIER 999 像素 > FRONTIER 1000 像素。周期缩短到 24h,同面积可以 **收获 3 倍次数**。在 CORE 里锚一格是常规玩法。' },

        { type:'h2', text:'3. POI — 资源点' },
        { type:'p', text:'火星表面会随机生成 **资源点**。打开 `EXPLORE` 标签的地图去到那里,按 `🔍 DISCOVER` 就领奖。**不需要持有领土,谁都能拿** — 先到先得。' },
        { type:'table',
          headers:['项目','值','来源'],
          rows:[
            ['刷新周期',          {v:'每 4 小时',cls:'num'},             '`poi_spawn_interval_hours=4`'],
            ['每周期数量',      {v:'6 个(最多同时 12 个)',cls:'num'},  '`poi_count_per_cycle=6, poi_max_active=12`'],
            ['过期时间',          {v:'12 小时',cls:'num'},                '`poi_expire_hours=12`'],
            ['探索费用',        {v:'管理员设置(默认 0 PP)',cls:'num'}, '`exploration_fee_pp`'],
            ['发现 XP 奖励',      {v:'+5 XP',cls:'num'},                 '`poi_discovery_xp=5`']
          ]},
        { type:'h2', text:'POI 掉落表(实际权重)' },
        { type:'table',
          headers:['掉落类别','权重','奖励范围','备注'],
          rows:[
            [{v:'🏛 GP',cls:'mars'},   {v:'70 %',cls:'num'},  {v:'10 ~ 50 GP',cls:'num'},      '最常见'],
            [{v:'📦 物品',cls:'mars'}, {v:'20 %',cls:'num'},  {v:'掉落表随机',cls:'num'}, '护盾·加成等'],
            [{v:'🥔 PP',cls:'mars'},   {v:'10 %',cls:'num'},  {v:'0.05 ~ 0.3 PP',cls:'num'},   '最稀有'],
            [{v:'✨ 饰品',cls:'mars'}, {v:'+5 %',cls:'num'},  {v:'额外投掷',cls:'num'},  '每次发现都有额外奖励']
          ]},
        { type:'callout', variant:'info', title:'规模校准',
          text:'奖励量会根据 **活跃用户数** 自动缩放 — 每 10 人 +10%,最高 ×3。用户越多,奖励越大。' },
        { type:'callout', variant:'pro', title:'POI 是最活跃的收入来源',
          text:'采矿一天只有 1 PP 左右,但 POI 的 **GP 掉落** 很大。12 小时内在 6 个 POI 里拿下几个就能攒几十 GP。GP 连接总督选举和扇区税收,属于长期收入。' },

        { type:'h2', text:'4. 火箭事件' },
        { type:'p', text:'**每 12 小时**,火箭会在随机位置降落撒下大量战利品。降落 2 小时前预警 → 1 小时拾取窗口。5% 概率触发 `RUD`(爆炸)— 掉落 2 倍·半径 2 倍。' },
        { type:'table',
          headers:['掉落类别','权重','值','备注'],
          rows:[
            [{v:'🏛 GP',cls:'mars'},       {v:'50 %',cls:'num'}, {v:'10 ~ 40 GP',cls:'num'}, '最常见'],
            [{v:'📦 物品',cls:'mars'},    {v:'25 %',cls:'num'}, '掉落表', '护盾·加成'],
            [{v:'⭐ XP',cls:'mars'},       {v:'17 %',cls:'num'}, {v:'5 ~ 25 XP',cls:'num'}, '—'],
            [{v:'🥔 PP',cls:'mars'},       {v:'6 %',cls:'num'},  {v:'0.02 ~ 0.1 PP',cls:'num'}, '稀有'],
            [{v:'🚀 Starship 边框',cls:'mars'}, {v:'2 %',cls:'num'},  {v:'1 个',cls:'num'},        '限定饰品']
          ]},
        { type:'callout', variant:'warn', title:'RUD 是大奖,但……',
          text:'5% 概率触发的 **RUD(Rapid Unscheduled Disassembly)** = 爆炸。普通 15 个 → RUD 30 个掉落。半径也从 5km → 10km,翻倍。竞争者可能扎堆,准备好再去。' },

        { type:'h2', text:'5. 每日任务' },
        { type:'p', text:'每日任务重置。分成免费/活动/支出三个层,完成可得 PP + XP。完成 XP 固定为 **5 XP/任务**(周任务是 30 XP)。' },
        { type:'table',
          headers:['层级','任务示例','奖励范围'],
          rows:[
            ['💫 免费',   '登录 / 查看扇区 / 首次像素',   {v:'0.01 ~ 0.05 PP',cls:'num'}],
            ['⚡ 活动',   '占领 / 收获 / 扇区探索 / 连续登录',  {v:'0.05 ~ 0.50 PP',cls:'num'}],
            ['💎 支出',   '充值 / 高级占领 / 兑换 / 大规模扩张', {v:'0.30 ~ 1.50 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'每天 5 分钟,确定收益',
          text:'每日任务是 **确定奖励**。上层任务的 PP 收益比采矿好多了,XP 也攒得快。升级速度取决于任务。' },

        { type:'h2', text:'6. 佣金收入(DYNASTY)' },
        { type:'p', text:'推荐他人后,他们在 **6 种活动**(充值 · 兑换 · 商店 · 收获 · 卡提纳 · 劫掠)中消费时都会自动给你分佣。3 级 MLM 结构,朋友的朋友的朋友也算。' },
        { type:'callout', variant:'pro', title:'长期看这才是最大的',
          text:'领土·采矿是线性增长(你干多少赚多少),**DYNASTY 是网络效应**。仅邀请 5 个活跃用户,到某一刻被动 PP 就会超过你自己的采矿。详情见 [DYNASTY/推荐](#dynasty) §8。' }
      ]
    },
    { id: 'fleet', icon: '🚢', title: '舰队与船坞',
      blocks: [
        { type:'p', text:'舰船是**可能失去的真实资产**。你在船坞建造它们,用 GP 和矿物强化、维修,开舰船扭蛋博取稀有舰,在舰船市场交易。在劫持战中,舰船可能**永久被摧毁**。' },
        { type:'toc', label:'本节内容', items:[
          '舰船阵容 & 派系',
          '船坞 — 建造 & 维修',
          '属性强化',
          '舰船扭蛋(Ship Crate)',
          '舰船市场(地区)',
          '永久损失警告'
        ]},

        { type:'h2', text:'1. 舰船阵容 & 派系' },
        { type:'p', text:'横跨 3 个派系(MCC / FSP / CV)共有 **22 种舰船**,分 5 个尺寸等级。大型舰输出与耐久更高,但需要更稀有的 Core/Mid 矿物。泰坦受服务器上限限制(每型存活 3 艘)。' },
        { type:'table',
          headers:['舰级','角色','建造成本档'],
          rows:[
            [{v:'护卫舰',cls:'mars'}, '高速缠斗 / 电子战',         {v:'低',cls:'num'}],
            [{v:'驱逐舰',cls:'mars'}, '游击输出',                  {v:'低–中',cls:'num'}],
            [{v:'巡洋舰',cls:'mars'}, '灵活主力',                  {v:'中',cls:'num'}],
            [{v:'战列舰',cls:'mars'}, '重型阵线 — Core/Mid 矿物',  {v:'高',cls:'num'}],
            [{v:'泰坦',cls:'mars'},   '旗舰级 — 服务器上限',       {v:'最高',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'🜲 启动超级单位（合体扭蛋）',
          text:'在`扭蛋`的**合体零件宝箱**收集零件,即可**启动（合体）**巨型超级单位。每个单位需要**5种零件**,集齐后在船坞`启动`标签部署到舰队。重复零件分解为**碎片**,可兑换想要的零件(核心成本更高)。共有机器人6种与火星外星生命4种,各有武器特化与克制。中上位性能,对狙击/轰炸/电子战有弱点,拆解后返还零件(无永久损失)。' },
        { type:'h2', text:'2. 船坞 — 建造 & 维修' },
        { type:'p', text:'打开 `船坞` 查看蓝图。每张卡以 **拥有 / 需要** 显示 GP + 矿物成本,并用 ⛏ 徽章标示哪个区域等级掉落所需矿物。建造会排入 `ship_build_job` 队列,舰船落入你的默认舰队。' },
        { type:'table',
          headers:['操作','成本','备注'],
          rows:[
            ['建造', {v:'GP + 矿物',cls:'num'}, '战列舰/泰坦需要 Core + Mid 矿物'],
            ['维修', {v:'GP + 矿物',cls:'num'}, '战后恢复 HP'],
            ['护盾', {v:'GP',cls:'num'},        '战前伤害吸收'],
            ['拆解', {v:'—',cls:'num'},         '拆解回收部分资源']
          ]},
        { type:'callout', variant:'info', title:'挂售中的舰船被锁定',
          text:'已挂到市场(`is_market_listed`)的舰船在取消挂售前无法强化、维修、护盾、拆解或在舰队间移动。' },
        { type:'callout', variant:'tip', title:'新玩家也能早期建造',
          text:'经过平衡调整,现在 **frontier 区域也会掉落部分 tier-2 制作材料** — 无需拥有昂贵的 CORE 领地,仅靠便宜的边境土地就能建造第一艘真正的舰船。' },

        { type:'h2', text:'3. 属性强化' },
        { type:'p', text:'已有舰船可**永久强化** `atk / def / hp / speed`。强化有**成功概率**,无论成功或失败都消耗 GP + 材料。成本随累计投资次数上升。' },
        { type:'callout', variant:'pro', title:'强化是概率型',
          text:'失败也会消耗 GP 和材料,只有成功才加属性加成。战斗引擎直接读取 `bonus_atk/def/hp/speed`,因此强化在实战中确实有用。' },

        { type:'h2', text:'4. 舰船扭蛋(Ship Crate)' },
        { type:'p', text:'用 **GP** 开舰船箱,按尺寸等级随机获得舰船。每个箱子都**公开概率**,高级/传说箱带有**保底(pity)**,达到抽数即保证巡洋舰或更高。' },
        { type:'table',
          headers:['箱子','价格','保底','最高舰级'],
          rows:[
            [{v:'📦 标准',cls:'mars'},  {v:'300 GP',cls:'num'},  {v:'—',cls:'num'},     '巡洋舰'],
            [{v:'🎁 高级',cls:'mars'},  {v:'1,000 GP',cls:'num'},{v:'10 抽',cls:'num'}, '战列舰'],
            [{v:'🌟 传说',cls:'mars'}, {v:'3,000 GP',cls:'num'},{v:'5 抽',cls:'num'},  '泰坦']
          ]},
        { type:'callout', variant:'info', title:'服务器 RNG + 泰坦上限',
          text:'抽取使用服务器权威 RNG。若泰坦服务器上限已满,泰坦抽取会降级为战列舰。概率显示在每张箱子卡上。' },

        { type:'h2', text:'5. 舰船市场(地区)' },
        { type:'p', text:'通过 `挂售 → 购买 → 取消` 交易舰船。每个挂单绑定**卖家的据点区域**: 购买时可能对该**区域总督征收关税**,运营方还可限制仅同区域购买 — 让区域成为交易枢纽并产生区域间套利。' },
        { type:'callout', variant:'tip', title:'留意区域关税',
          text:'高税率 CORE 区域的挂单会让买家多付钱。更便宜的挂单往往在低税率的前沿区域 — 代价是物流成本。' },

        { type:'h2', text:'6. ⚠ 永久损失警告' },
        { type:'callout', variant:'warn', title:'被击沉的舰船永远消失',
          text:'在永久损失生效时(`hijack_ship_loss_enabled=true`),劫持战中 **HP 归零的舰船会被永久摧毁** — `is_alive=false`,无法复活。必须在船坞重新建造。只投入你愿意失去的舰队,并备好重建用的备用舰 + 矿物。' }
      ]
    },
    { id: 'governance', icon: '🏛', title: '治理',
      blocks: [
        { type:'p', text:'火星以 **两层权力结构** 运作。全局第一的 **指挥官** 和每扇区一人的 **总督**。两者都能修改税收、权限、事件触发这类真实的游戏规则。治理是实装的真功能,不是装饰。' },
        { type:'toc', label:'本节内容', items:[
          '权力结构(指挥官 / 总督)',
          '扇区税与分配',
          '扇区 buff(总督权限)',
          '全局事件(指挥官权限)',
          '悬赏系统',
          '治理中的 GP'
        ]},

        { type:'h2', text:'1. 权力结构' },
        { type:'table',
          headers:['职位','范围','人数','权限'],
          rows:[
            [{v:'👑 指挥官',cls:'mars'},     '全局',     {v:'1 名',cls:'num'}, '全局事件·公告·悬赏'],
            [{v:'⚔ 副指挥官',cls:'mars'},    '全局',     {v:'1 名',cls:'num'}, '指挥官不在时代行事件'],
            [{v:'🏛 总督',cls:'mars'},     '扇区',     {v:'每扇区 1 名',cls:'num'}, '扇区税率·buff·税收'],
            [{v:'⚖ 副总督',cls:'mars'},    '扇区',     {v:'每扇区 1 名',cls:'num'}, '收取 20% 税收']
          ]},
        { type:'callout', variant:'info', title:'选举方式',
          text:'每个职位由 **GP 最多** 的玩家占据。只要继续积累 GP,随时可以把现任赶下去 — 这是持续选举。' },

        { type:'h2', text:'2. 扇区税与分配' },
        { type:'p', text:'总督会对自己扇区的 **占领费用征税**。税率在管理员设定范围内由总督自行调整。' },
        { type:'table',
          headers:['项目','值'],
          rows:[
            ['税率范围',   {v:'1 ~ 5 %',cls:'num'}],
            ['默认税率',   {v:'2 %',cls:'num'}],
            ['总督收取',  {v:'70 %',cls:'num'}],
            ['副总督收取',{v:'20 %',cls:'num'}],
            ['扇区池',     {v:'10 %',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'高流量扇区 = 收益机器',
          text:'做上热门扇区的总督,坐着就有税收进。每次有人占领都会自动结算。CORE 扇区哪怕只抽 1% 的税,很快就能攒到几百 USDT。' },

        { type:'h2', text:'3. 扇区 buff — 总督权限' },
        { type:'p', text:'总督可以烧 GP 为整个扇区加 buff。不只是自己的领地,**所有居民都受益**。很常用作竞选承诺。' },
        { type:'table',
          headers:['buff','效果','费用 (GP)'],
          rows:[
            ['⛏ 采矿加成',  '扇区整体采矿量 +20%', {v:'100 ~ 150',cls:'num'}],
            ['🛡 防御加成',  '护盾吸收率提升',         {v:'100 ~ 150',cls:'num'}],
            ['💰 占领折扣', '扇区内新占领价格下调',{v:'100 ~ 150',cls:'num'}]
          ]},

        { type:'h2', text:'4. 全局事件 — 指挥官权限' },
        { type:'p', text:'指挥官可以 **每天 1 次** 触发全局事件。同时只能开一个,GP 消耗大,但会影响整个火星。' },
        { type:'table',
          headers:['事件','效果','费用 (GP)'],
          rows:[
            ['⚡ Double Mining', '全局采矿 × 2',      {v:'300 ~ 500',cls:'num'}],
            ['⚔ 战时体制',   '劫掠 XP·奖励增加',       {v:'300 ~ 500',cls:'num'}],
            ['🕊 和平条约',   '一段时间内禁止劫掠',     {v:'300 ~ 500',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'每日 1 次限制',
          text:'`max_global_events_per_day=1`。不管指挥官有多少 GP,每天只能发动一次事件。时机就是策略。' },

        { type:'h2', text:'5. 悬赏系统' },
        { type:'p', text:'指挥官和总督可以对特定玩家发布 **悬赏**。第一个劫掠目标的人拿走全部奖励。' },
        { type:'table',
          headers:['项目','值'],
          rows:[
            ['发布权限',    '指挥官·总督'],
            ['奖励类型',    'GP + 可选 PP'],
            ['状态',         'active → claimed / expired / cancelled'],
            ['过期',         '发布时设定']
          ]},
        { type:'callout', variant:'pro', title:'悬赏是政治工具',
          text:'想撼动对手总督,就给他核心领土发悬赏。一旦其他用户涌过去袭击,那个总督就得忙着防守,没法正经收税了。' },

        { type:'h2', text:'6. 治理中的 GP' },
        { type:'p', text:'治理依靠主要消费货币 GP 运转。通过游戏奖励 **以及 PP → GP 兑换**(动态 5~20 汇率)攒取,再用于选举、区域掌控和增益。GP 无法换回 PP 或 USDT。' },
        { type:'table',
          headers:['GP 获取途径','常规奖励'],
          rows:[
            ['每日登录(7 天循环)',  {v:'5 ~ 100 GP',cls:'num'}],
            ['每日任务(3 个/天)',      {v:'各 10 ~ 25 GP',cls:'num'}],
            ['完成全部 3 个每日任务',      {v:'+50 GP',cls:'num'}],
            ['POI 发现',               {v:'10 ~ 50 GP',cls:'num'}],
            ['赛季排名奖励',          {v:'500 ~ 5000 GP',cls:'num'}],
            ['火箭掉落',              {v:'10 ~ 40 GP',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'当总督的最快路径',
          text:'每天出席 + 3 个任务 + 几个 POI,一天也能攒 100 GP。一个月就是 3000 GP。冷清扇区的总督靠这个量就能掀翻。' }
      ]
    },
    { id: 'ops', icon: '🚀', title: 'OPS任务',
      blocks: [
        { type:'p', text:'OPS 任务是你的军事行动中心。从你的领地发射台上出动 **入侵(⚔)** 或 **探索(🛰)** 两类任务。入侵抢其他玩家的 PP、GP 和 XP;探索向坐标发射探针,发现 PP、XP 和稀有道具。' },
        { type:'toc', label:'本节内容', items:[
          'OPS 任务是什么',
          '发射台',
          '任务等级',
          '奖励',
          '目标去重',
          '小贴士'
        ]},

        { type:'h2', text:'1. OPS 任务是什么' },
        { type:'p', text:'你的合并领地就是发射台。每个合并区域 = 一个发射台,从这里可以出动两种军事行动:' },
        { type:'table',
          headers:['类型','图标','目标','收益'],
          rows:[
            [{v:'入侵',cls:'mars'}, '⚔', '其他玩家领地', 'PP + GP + XP'],
            [{v:'探索',cls:'mars'}, '🛰', '坐标探针', 'PP + XP + 稀有道具']
          ]},
        { type:'callout', variant:'info', title:'两种出击方式',
          text:'入侵是直接对抗 — 攻击他人领地窃取资源。探索是 PvE — 向指定坐标发射探针发现奖励。两者各有风险与回报。' },

        { type:'h2', text:'2. 发射台' },
        { type:'p', text:'每个合并领地自动成为一个发射台。发射台越大,报酬倍率越高。' },
        { type:'table',
          headers:['属性','详情'],
          rows:[
            ['发射台来源',    '每个合并领地 = 1 个发射台'],
            ['大小倍率',      {v:'×0.5 ~ ×3.0',cls:'num'}],
            ['倍率公式',      '√(像素数 / 25),上下限钳制'],
            ['并发限制',      '一个发射台同时只能执行一个任务']
          ]},
        { type:'callout', variant:'pro', title:'大领地 = 大倍率',
          text:'一个足够大的合并领地可以达到 ×3.0 倍率 — 每次任务奖励直接翻三倍。建设大型合并领地是提升 OPS 收益的核心策略。' },

        { type:'h2', text:'3. 任务等级' },
        { type:'p', text:'任务根据目标距离分为三个等级。距离越远,花费越高、时间越长,但成功时回报更丰厚。' },
        { type:'table',
          headers:['等级','距离','花费 (PP)','持续时间','成功率'],
          rows:[
            [{v:'NEAR',cls:'mars'}, '< 30°',   {v:'0.2(入侵) / 0.1(探索)',cls:'num'}, {v:'~30 分钟',cls:'num'}, {v:'80%',cls:'num'}],
            [{v:'MID',cls:'mars'},  '30–90°',  {v:'0.8 / 0.4',cls:'num'},              {v:'~2 小时',cls:'num'},  {v:'65%',cls:'num'}],
            [{v:'FAR',cls:'mars'},  '> 90°',   {v:'1.5 / 1.0',cls:'num'},              {v:'~5 小时',cls:'num'},  {v:'50%',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'失败 = 燃料白费',
          text:'任务失败不会获得任何奖励,但发射时消耗的 PP 不会退还。远程任务高风险高回报 — 量力而行。' },

        { type:'h2', text:'4. 奖励' },
        { type:'table',
          headers:['任务类型','奖励内容','倍率加成'],
          rows:[
            ['⚔ 入侵', 'PP + GP + XP',             '全部受发射台倍率影响'],
            ['🛰 探索', 'PP + XP + 稀有道具概率', '全部受发射台倍率影响']
          ]},
        { type:'callout', variant:'info', title:'倍率就是一切',
          text:'同样的 FAR 入侵,×1.0 发射台和 ×3.0 发射台拿到的 PP 差三倍。优先从最大的发射台出动。' },

        { type:'h2', text:'5. 目标去重' },
        { type:'p', text:'系统自动避免目标冲突,确保任务不会撞车:' },
        { type:'list', items:[
          '同一领地不能被两个入侵同时攻击',
          '重复时系统自动重定向到目标的其他领地',
          '探索探针坐标重叠时自动偏移'
        ]},

        { type:'h2', text:'6. 小贴士' },
        { type:'list', items:[
          '建设大型合并领地来追求 ×3.0 倍率',
          'FAR 任务风险最高但收益最好 — 适合赌一把',
          '不能入侵自己的公会成员',
          'READY 状态的发射台会排在列表最前面,方便操作'
        ]},
        { type:'callout', variant:'pro', title:'OPS 是主动收益的核心',
          text:'采矿是被动的,OPS 是主动的。把 OPS 任务和日常采矿结合起来,收益远超单纯挂机。' }
      ]
    },
    { id: 'quests', icon: '📋', title: '任务',
      blocks: [
        { type:'p', text:'任务系统会在你正常游玩时自动追踪进度 — 不需要手动操作。始终有 3 个活跃任务(每个等级各一个),完成后领取 PP 奖励,新任务自动刷新。' },
        { type:'toc', label:'本节内容', items:[
          '任务等级',
          '任务运作机制',
          '任务动作',
          '小贴士'
        ]},

        { type:'h2', text:'1. 任务等级' },
        { type:'p', text:'任务分为三个等级,难度和奖励逐级递增:' },
        { type:'table',
          headers:['等级','类型','奖励','举例'],
          rows:[
            [{v:'FREE',cls:'mars'},     '简单日常', {v:'0.01 ~ 0.05 PP',cls:'num'}, '登录、查看扇区、访问基地'],
            [{v:'ACTIVITY',cls:'mars'}, '游玩操作', {v:'0.05 ~ 0.25 PP',cls:'num'}, '占领像素、收获、出动任务、玩酒吧'],
            [{v:'SPENDING',cls:'mars'}, '消费行为', {v:'0.30 ~ 1.50 PP',cls:'num'}, '充值 USDT、高级占领、大规模扩张']
          ]},
        { type:'callout', variant:'info', title:'三级并行',
          text:'始终有 3 个任务(每级一个)同时活跃。FREE 级是纯利润,SPENDING 级奖励最多但需要花钱。' },

        { type:'h2', text:'2. 任务运作机制' },
        { type:'list', items:[
          '同时 3 个活跃任务(每个等级各 1 个)',
          '正常游玩自动追踪进度 — 无需手动点击',
          '完成后领取 PP 奖励',
          '领取后新任务自动刷新,冷却时间 24h ~ 168h'
        ]},

        { type:'h2', text:'3. 任务动作' },
        { type:'p', text:'系统追踪的动作范围很广,覆盖几乎所有游戏行为:' },
        { type:'table',
          headers:['分类','动作'],
          rows:[
            ['领地',  '占领像素、收获、劫掠'],
            ['任务',  '发射/完成入侵和探索'],
            ['社交',  '公会聊天、酒吧游戏'],
            ['经济',  '购买道具、使用道具、充值 USDT、兑换代币']
          ]},

        { type:'h2', text:'4. 小贴士' },
        { type:'list', items:[
          '定期查看基地中的「任务」标签页',
          'FREE 级任务是纯利润 — 千万别跳过',
          '把任务目标和日常游玩结合(比如有占领任务时去占领像素)',
          '连续登录任务在 FREE 级中奖励最高'
        ]},
        { type:'callout', variant:'pro', title:'零成本 PP',
          text:'仅靠 FREE 级任务每天就能稳定获得 PP 奖励,完全不花钱。把它们和正常游玩叠加,收益更上一层楼。' }
      ]
    },
    { id: 'guilds', icon: '⚔', title: '公会 & 赛季',
      blocks: [
        { type:'p', text:'个人成长遇到瓶颈就 **加入公会**。像素自动汇总,公会聊天、徽章、赛季排行榜这些团队玩法全都实装好了。赛季按 **30 天周期** 运行,每赛季主题都会变。' },
        { type:'toc', label:'本节内容', items:[
          '公会创建与角色',
          '公会自定义费用',
          '公会聊天',
          '赛季系统',
          '赛季计分',
          '赛季奖励'
        ]},

        { type:'h2', text:'1. 公会创建与角色' },
        { type:'table',
          headers:['项目','值','来源'],
          rows:[
            ['创建费用',      {v:'50 GP',cls:'num'},  '`guild_create_cost_gp`'],
            ['最大成员',      {v:'20 人',cls:'num'},   '`guild_max_members`'],
            ['角色',          '会长 · 干事 · 成员',   '`guild_members.role`'],
            ['邀请过期',      {v:'72 小时',cls:'num'},'`guild_invite_expire_hours`'],
            ['一人一公会',      '强制 (UNIQUE wallet)',  '`guild_members`']
          ]},
        { type:'callout', variant:'info', title:'会长·干事·成员',
          text:'**会长** — 踢人·晋升·降级·解散·转让会长。**干事** — 邀请·部分编辑。**成员** — 聊天·查看。会长长期不在时,干事可以代为管理。' },

        { type:'h2', text:'2. 公会自定义费用' },
        { type:'p', text:'创建后仍可用 GP 持续调整公会外观。仅会长能付款。' },
        { type:'table',
          headers:['项目','费用','备注'],
          rows:[
            ['改名',          {v:'100 GP',cls:'num'}, '`guild_rename_cost_gp`'],
            ['改描述',          {v:'20 GP',cls:'num'},  '`guild_desc_cost_gp`'],
            ['表情徽章',      {v:'50 GP',cls:'num'},  '文本表情'],
            ['像素艺术徽章',   {v:'50 GP',cls:'num'},  {v:'32×32 · 最多 8 KB',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'像素艺术徽章是强力品牌',
          text:'公会像素艺术徽章最大可以上传到 **32×32**。尺寸虽小,但一在领土弹窗里出现识别度就爆表。' },

        { type:'h2', text:'3. 公会聊天' },
        { type:'table',
          headers:['项目','值','来源'],
          rows:[
            ['最大长度',   {v:'300 字',cls:'num'},  '`guild_chat_max_len`'],
            ['冷却',     {v:'3 秒',cls:'num'},    '`guild_chat_cooldown_sec`'],
            ['历史',    {v:'最新 100 条',cls:'num'}, '`guild_chat_history_limit`']
          ]},
        { type:'callout', variant:'info', title:'基于轮询',
          text:'不是 WebSocket,而是 **轮询** 方式。消息不是一发就刷新,而是每几秒同步一次。实时战斗里反应可能会稍微慢一点。' },

        { type:'h2', text:'4. 赛季系统' },
        { type:'p', text:'赛季是 **30 天周期**。每个赛季会选定一个火星天气 **主题**,并从 **26 个排名类别中随机选 6 个** 作为该赛季的排行榜项目。' },
        { type:'table',
          headers:['赛季','主题','火星环境'],
          rows:[
            [{v:'赛季 1',cls:'mars'}, '🌋 Volcanic Dawn',    '岩浆喷口重新激活'],
            [{v:'赛季 2',cls:'mars'}, '❄ Frozen Frontier',  '极地冰盖向赤道扩张'],
            [{v:'赛季 3',cls:'mars'}, '☀ Solar Inferno',    '日冕物质抛射'],
            [{v:'赛季 4',cls:'mars'}, '🌪 Dust Epoch',      '行星级沙尘暴']
          ]},
        { type:'callout', variant:'warn', title:'赛季 30 天 — 不是装饰',
          text:'赛季长度硬编码为 **30 天**(`seasons.ends_at`)。主题不同天气概率也不同,视觉色调会覆盖在火星表面上。' },

        { type:'h2', text:'5. 赛季计分' },
        { type:'p', text:'排名类别共 **26 种** — territory, mining, combat, defender, explorer, quester, gambler, recruiter, namer 等等。每个赛季 **只有 6 种** 被激活,从池子里随机抽取。上赛季关键的类别这赛季可能根本不参与计分。' },
        { type:'table',
          headers:['活动','分数','配置项'],
          rows:[
            ['占领像素',   {v:'+1 分 / px',cls:'num'},  '`season_mult_pixels`'],
            ['完成收获',      {v:'+5 分',cls:'num'},       '`season_mult_harvest`'],
            ['劫掠胜利',    {v:'+10 分',cls:'num'},      '`season_mult_hijack`'],
            ['POI 发现',      {v:'+15 分',cls:'num'},      '`season_mult_poi`']
          ]},
        { type:'callout', variant:'tip', title:'先看本赛季的 6 种活跃类别',
          text:'打开 SEASON 标签,先确认本赛季激活的 6 个类别。在 *combat* 不活跃的赛季硬刷战斗就是浪费 — 只追当前活跃的排行榜。' },

        { type:'h2', text:'6. 赛季奖励' },
        { type:'p', text:'赛季结束后,自动按分类给上位玩家发奖励。在 `RANK` 标签领取。' },
        { type:'table',
          headers:['排名','赛季 1 奖励','赛季 3 奖励'],
          rows:[
            [{v:'第 1 名',cls:'mars'},    {v:'3000 GP + 0.5 PP + 500 XP',cls:'num'}, {v:'5000 GP + 1.0 PP + 800 XP',cls:'num'}],
            [{v:'第 2 ~ 3 名',cls:'mars'}, {v:'1500 GP',cls:'num'},                   {v:'2500 GP',cls:'num'}],
            [{v:'第 4 ~ 10 名',cls:'mars'}, {v:'500 GP',cls:'num'},                    {v:'800 GP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'奖励越到后期越大',
          text:'第一个赛季最小,后续赛季奖励设计成递增。玩得越久,奖励像复利一样越多。' }
      ]
    },
      { id: 'guildwar', icon: '🎮', title: '公会战 & 小游戏',
        blocks: [
          { type:'p', text:'公会战是两个公会进行**24小时街机对决**的系统。成员玩火星主题小游戏并合算分数。总分高的公会赢得GP。' },
          { type:'toc', label:'本节内容', items:[
            '宣战', '小游戏介绍', '续命机制', '计分 & 奖励'
          ]},
          { type:'h2', text:'1. 宣战' },
          { type:'table',
            headers:['项目','值','设置'],
            rows:[
              ['宣战费用',  {v:'200 GP(从金库)',cls:'num'}, '`guild_war_declare_cost_gp`'],
              ['最少成员',  {v:'3人',cls:'num'},             '`guild_war_min_members`'],
              ['战争时长',  {v:'24小时',cls:'num'},          '`guild_war_duration_hours`'],
              ['冷却时间',  {v:'48小时',cls:'num'},          '`guild_war_cooldown_hours`'],
              ['同时战争',  {v:'每公会1场',cls:'num'},       '`guild_war_max_active`'],
              ['胜利奖励',  {v:'500 GP → 金库',cls:'num'},  '`guild_war_winner_gp`']
            ]},
          { type:'callout', variant:'info', title:'双方都会检查',
            text:'攻击方和防守方都必须没有进行中的战争。已在战争中的公会无法被选为目标。' },

          { type:'h2', text:'2. 小游戏' },
          { type:'table',
            headers:['游戏','主题','玩法'],
            rows:[
              [{v:'🚀 Mars Invaders',cls:'mars'}, '太空侵略者', '像素艺术外星人波次射击。每5波出Boss。240秒限时，3条命，自动射击。'],
              [{v:'👨‍🚀 Mars Runner',cls:'mars'},  '吃豆人迷宫', '像素宇航员探索隧道，收集矿物，躲避外星人。能量道具可以吃敌人。240秒。'],
              [{v:'⛏️ Mars Digger',cls:'mars'},   '挖掘机',     '像素艺术挖掘火星土壤，收集水晶，用泵打沙丘风沙虫。落石可以砸死敌人。240秒。']
            ]},

          { type:'h2', text:'3. 续命机制' },
          { type:'p', text:'死亡后可以**付费续命** — 保持当前分数继续游戏。竞争公会把分数推到极限的秘诀。' },
          { type:'table',
            headers:['次数','费用','类型'],
            rows:[
              ['第1次', {v:'5 GP',cls:'num'},   'GP'],
              ['第2次', {v:'15 GP',cls:'num'},  'GP'],
              ['第3次', {v:'30 GP',cls:'num'},  'GP'],
              ['第4次', {v:'0.1 PP',cls:'num'}, 'PP(真金白银!)'],
              ['第5次', {v:'0.2 PP',cls:'num'}, 'PP(每次翻倍)'],
              ['第6次+', {v:'持续翻倍',cls:'num'}, 'PP']
            ]},
          { type:'callout', variant:'warn', title:'PP续命是真钱',
            text:'第3次之后用PP支付。PP = 真钱。明智消费 — 否则为了赢倾家荡产。' },

          { type:'h2', text:'4. 计分 & 奖励' },
          { type:'p', text:'战争期间所有成员的游戏分数按公会合算。24小时后总分高的公会获得500 GP到金库。' }
        ]
      },
      { id: 'research', icon: '🔬', title: '公会研究',
        blocks: [
          { type:'p', text:'公会可以用金库GP解锁**7项研究特权**。每项研究给所有成员永久加成。' },
          { type:'table',
            headers:['研究','效果','设置'],
            rows:[
              ['⛏ 采矿效率 I',     {v:'+3% 采矿PP',cls:'num'},         '`mining_eff_1_bonus`'],
              ['🛡 护盾纪律',       {v:'+15% 防御',cls:'num'},           '`shield_disc_bonus`'],
              ['🕊 外交豁免',       {v:'-10% 入侵成功率降低',cls:'num'}, '`diplomatic_bonus`'],
              ['🔭 轨道扫描',       {v:'+15% 探索奖励',cls:'num'},       '`orbital_scan_bonus`'],
              ['🚀 快速部署',       {v:'-20% 任务旅行时间',cls:'num'},   '`rapid_deploy_bonus`'],
              ['📦 物流网络',       {v:'-10% 占领费用',cls:'num'},       '`logistics_bonus`'],
              ['👑 火星统治',       {v:'+5% 所有加成叠加',cls:'num'},    '`mars_dominion_bonus`']
            ]},
          { type:'callout', variant:'pro', title:'火星统治最后解锁',
            text:'火星统治在所有研究加成上额外+5%。采矿变成+3.15%，防御变成+15.75%。' }
        ]
      },
      { id: 'seasonpass', icon: '🎫', title: '赛季通行证',
        blocks: [
          { type:'p', text:'每赛季有**30级战斗通行证**(免费+高级)。通过游戏获取XP来解锁级别奖励。' },
          { type:'h2', text:'1. 获取XP' },
          { type:'table',
            headers:['活动','XP','设置'],
            rows:[
              ['采矿',   {v:'+5 XP',cls:'num'},  '`season_pass_xp_harvest`'],
              ['占领',   {v:'+10 XP',cls:'num'}, '`season_pass_xp_claim`'],
              ['入侵',   {v:'+15 XP',cls:'num'}, '`season_pass_xp_invasion`'],
              ['探索',   {v:'+10 XP',cls:'num'}, '`season_pass_xp_exploration`'],
              ['任务',   {v:'+8 XP',cls:'num'},  '`season_pass_xp_quest`']
            ]},
          { type:'h2', text:'2. 级别奖励' },
          { type:'p', text:'免费轨道每级给GP。高级轨道给更多GP加里程碑物品。**所有奖励都是GP — 绝不给PP。**' },
          { type:'table',
            headers:['级别','免费奖励','高级奖励'],
            rows:[
              ['每级',          {v:'10×级 GP',cls:'num'},     {v:'25×级 GP',cls:'num'}],
              ['每5级(免费)',   {v:'50×级 GP额外',cls:'num'}, '—'],
              ['每10级(高级)',  '—',                          '特殊物品'],
              ['30级(最高)',    {v:'500 GP',cls:'num'},       {v:'1500 GP',cls:'num'}]
            ]},
          { type:'callout', variant:'info', title:'高级通行证用GP购买',
            text:'高级升级当前 live 默认价为 **150 GP**（管理员可调）。仅当前赛季有效。' }
        ]
      },
      { id: 'exchange', icon: '💱', title: 'PP → GP 兑换',
        blocks: [
          { type:'p', text:'急需 GP?把 PP(价值代币)兑换成 GP。汇率不固定,随需求**浮动**。手续费部分永久销毁 = **PP 通缩**。' },
          { type:'h2', text:'1. 动态 PP → GP 汇率' },
          { type:'p', text:'汇率根据 24h 兑换需求重算,并被锁定在硬区间内。GP 需求高则汇率**下降**(每 PP 换到的 GP 更少),需求低则再次**上升**。' },
          { type:'table',
            headers:['设置','值','来源'],
            rows:[
              ['汇率区间', {v:'5 ~ 20 GP/PP',cls:'num'}, '`pp_to_gp_rate_floor` / `_ceil`'],
              ['基准汇率', {v:'10 GP/PP',cls:'num'},      '`pp_to_gp_exchange_rate`'],
              ['单次变动', {v:'±2% / 每次重算',cls:'num'}, '`pp_to_gp_rate_max_step_pct`'],
              ['手续费',   {v:'5% (销毁)',cls:'num'},       '`pp_to_gp_exchange_fee_pct`'],
              ['动态汇率', {v:'启用',cls:'num'},           '`pp_to_gp_dynamic_enabled=true`']
            ]},
          { type:'callout', variant:'warn', title:'PP → GP 是单向',
            text:'是**把 PP 换成 GP**,反过来不行 — GP 无法换回 PP。当舰船建造、强化、扭蛋、商店或治理需要 GP 时就兑换 PP。日常 GP 也来自登录、任务和战斗。' },
          { type:'callout', variant:'tip', title:'看汇率再兑换',
            text:'汇率在每 PP 5~20 GP 间浮动,所以在 GP 需求低(汇率接近 20)时兑换,每 PP 能换到更多 GP。5% 手续费被销毁,减少 PP 供应。' },

          { type:'h2', text:'2. PP → USDT 赎回(担保门槛)' },
          { type:'p', text:'PP 也可在 `SWAP` 标签**赎回为 USDT** — 但仅在运营方注资的**担保池**额度内。从结构上防止挤兑。' },
          { type:'formula', label:'可赎回额度(room)',
            eq:'room = ~担保~ − ~全体用户 USDT 负债~',
            note:'PP → USDT 赎回(及 PP 来源的提现)仅允许到 `room` 上限。池子耗尽则赎回暂停,直到运营方补充担保。' },
          { type:'callout', variant:'warn', title:'赎回并非无限',
            text:'PP 按运营汇率(可变)赎回为 USDT,赎回额取决于可用担保额度 — 并非固定锚定。同时大量赎回可能触及上限 — 这就是挤兑安全机制(`migration 230`)。' }
        ]
      },
    { id: 'casino', icon: '🎰', title: '卡提纳赌场',
      blocks: [
        { type:'p', text:'**卡提纳** 是由 5 款小游戏组成的游戏内赌场。全部游戏都能用 PP 或 USDT 下注。庄家优势是真的,把它当娱乐,不要当收入。' },
        { type:'toc', label:'本节内容', items:[
          '5 款游戏概要',
          '投注上限 & 庄家优势',
          '掷硬币',
          '骰子',
          '比大小',
          'Crash / Mines'
        ]},

        { type:'h2', text:'1. 5 款游戏概要' },
        { type:'table',
          headers:['游戏','类型','货币'],
          rows:[
            [{v:'🚀 Crash',cls:'mars'},  '实时倍率','PP · USDT'],
            [{v:'💣 Mines',cls:'mars'},  '网格',    'PP · USDT'],
            [{v:'🪙 掷硬币',cls:'mars'},'50/50',   'PP · USDT'],
            [{v:'🎲 骰子',cls:'mars'},  '范围掷骰','PP · USDT'],
            [{v:'🃏 比大小',cls:'mars'},'纸牌连胜','PP · USDT']
          ]},

        { type:'h2', text:'2. 投注上限 & 庄家优势' },
        { type:'table',
          headers:['游戏','最小投注','最大投注','庄家优势'],
          rows:[
            [{v:'Crash',cls:'mars'},  {v:'0.1',cls:'num'},  {v:'50',cls:'num'},  {v:'4 %',cls:'num'}],
            [{v:'Mines',cls:'mars'},  {v:'0.1',cls:'num'},  {v:'20',cls:'num'},  {v:'3 %',cls:'num'}],
            [{v:'掷硬币',cls:'mars'}, {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 3 %',cls:'num'}],
            [{v:'骰子',cls:'mars'},   {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'可变',cls:'num'}],
            [{v:'比大小',cls:'mars'}, {v:'0.1',cls:'num'},  {v:'500',cls:'num'}, {v:'~ 4 %',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'庄家优势是真的',
          text:'长期来看所有游戏都是庄家赢。优势 3~4% 意味着每次投注平均 **3~4% 会蒸发**。投 100 PP,平均 3~4 PP 就没了。' },

        { type:'h2', text:'3. 掷硬币' },
        { type:'p', text:'选择 **HEADS 或 TAILS**,下注,翻转。赢 = 1.96 倍。简单快速的 50/50。' },
        { type:'callout', variant:'info', title:'简单但仍有庄家优势',
          text:'看起来像 50/50,但赔率不是 2.0 倍而是更低,庄家优势就在这里。优点是短时间可以玩很多局。' },

        { type:'h2', text:'4. 骰子' },
        { type:'p', text:'掷骰子。选 **某范围的上/下**,范围越窄倍率越高。' },
        { type:'callout', variant:'tip', title:'靠范围调整风险',
          text:'可以自己选低倍率·高概率或高倍率·低概率。是卡提纳里调节幅度最大的游戏。' },

        { type:'h2', text:'5. 比大小' },
        { type:'p', text:'公开一张牌。猜下一张比现在 **高还是低**。连续猜中,倍率累计。' },
        { type:'callout', variant:'pro', title:'连胜是关键',
          text:'基础赔率不大,但 **连胜** 会指数级膨胀。关键是在合适的时机套现。' },

        { type:'h2', text:'6. Crash / Mines' },
        { type:'p', text:'**Crash** — 倍率一直涨,直到某个时候坠毁。坠毁前套现。**Mines** — 在网格里开格子,避开炸弹。每开一个安全格子,倍率就上一层。这两款是最受欢迎的。' },
        { type:'callout', variant:'warn', title:'理性游玩',
          text:'赌场是娱乐。只拿被动采矿一天能赚的 PP 的一部分来玩。别把它当收入来源。单局全押 = 自动清算。' }
      ]
    },
    { id: 'dynasty', icon: '👑', title: 'DYNASTY/推荐',
      blocks: [
        { type:'p', text:'邀请朋友后,佣金会按 **3 级 MLM** 结构进入你的账户。不仅是你直接邀请的朋友(Tier 1),朋友邀请的人(Tier 2)、再下面的人(Tier 3)也全都是你的收益线。' },
        { type:'toc', label:'本节内容', items:[
          '3 级结构',
          '产生佣金的活动（live 默认）',
          '排行榜与树状视图',
          '长期策略'
        ]},

        { type:'h2', text:'1. 3 级结构' },
        { type:'diagram',
          svg:'<svg viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg">'+
            '<g font-family="monospace" font-size="10" fill="#fff" text-anchor="middle">'+
            '<circle cx="260" cy="30" r="22" fill="rgba(255,209,102,.18)" stroke="#ffd166" stroke-width="2"/><text x="260" y="34" fill="#ffd166">YOU</text>'+
            '<circle cx="140" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="140" y="99">T1</text>'+
            '<circle cx="260" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="260" y="99">T1</text>'+
            '<circle cx="380" cy="95" r="20" fill="rgba(255,120,60,.15)" stroke="#ff783c" stroke-width="1.5"/><text x="380" y="99">T1</text>'+
            '<circle cx="90"  cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="90"  y="159" font-size="9">T2</text>'+
            '<circle cx="180" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="180" y="159" font-size="9">T2</text>'+
            '<circle cx="260" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="260" y="159" font-size="9">T2</text>'+
            '<circle cx="340" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="340" y="159" font-size="9">T2</text>'+
            '<circle cx="430" cy="155" r="16" fill="rgba(255,120,60,.08)" stroke="#ff783c" stroke-opacity=".6" stroke-width="1"/><text x="430" y="159" font-size="9">T2</text>'+
            '</g>'+
            '<line x1="250" y1="48" x2="150" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="260" y1="52" x2="260" y2="75" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="270" y1="48" x2="370" y2="78" stroke="#ff783c" stroke-opacity=".6" stroke-width="1.2"/>'+
            '<line x1="132" y1="114" x2="94"  y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="148" y1="114" x2="176" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="260" y1="115" x2="260" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="372" y1="114" x2="336" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
            '<line x1="388" y1="114" x2="425" y2="140" stroke="#ff783c" stroke-opacity=".35" stroke-width="1"/>'+
          '</svg>',
          caption:'YOU → T1(直接邀请)→ T2(间接)→ T3(到 3 级)' },
        { type:'p', text:'`referral_rewards` 表里有 **tier INT** 列,可以追踪每笔到账来自第几级。各级百分比可由管理员设置调整 — 游戏里的数字有可能变,所以以 DYNASTY 标签里的实时数字为准更准确。' },

        { type:'h2', text:'2. 产生佣金的活动（live 默认）' },
        { type:'p', text:'当前 live 默认下，佣金来自 **5 种活动**。部分来源可被运营设置开关，所以最终实时口径以 DYNASTY 标签为准。' },
        { type:'table',
          headers:['活动','说明'],
          rows:[
            ['💰 充值',        '把 USDT 放进游戏时'],
            ['🔄 兑换',        'USDT ↔ PP 互换'],
            ['🛒 商店',        '买物品·饰品'],
            ['🎰 卡提纳',       '赌场投注'],
            ['🏪 市场手续费',   '上架/交易手续费']
          ]},
        { type:'callout', variant:'info', title:'实时结算',
          text:'被推荐人每次触发 live 佣金来源时都会立刻以 **PP 形式** 进入你的钱包。收获·劫掠·强化·拍卖购买等来源可能被运营设置关闭。' },

        { type:'h2', text:'3. 排行榜与树状视图' },
        { type:'p', text:'在 `DYNASTY` 标签里可以看到自己的推荐树和全服排行榜。' },
        { type:'table',
          headers:['项目','内容'],
          rows:[
            ['推荐码',      '基于你钱包的唯一代码'],
            ['直接邀请数',    '你作为 Tier 1 拥有的人数'],
            ['总下线',     'T1 + T2 + T3 合计'],
            ['累计收益',       '迄今为止所有 Tier 合计收到的 PP']
          ]},

        { type:'h2', text:'4. 长期策略' },
        { type:'callout', variant:'pro', title:'DYNASTY 是游戏里期望值最高的动作',
          text:'领土·采矿你付出多少就赚多少(线性)。DYNASTY 随着网络扩张是 **复利** 增长。只要邀请 5 个活跃用户,被动收益超过你自身采矿的那一刻一定会来。' },
        { type:'callout', variant:'warn', title:'邀请机器人没用',
          text:'佣金跟被推荐人的 **实际支出** 挂钩。邀请 100 个机器人,他们不活动就是 0 PP。1 个活跃的人胜过 1000 个机器人。' }
      ]
    },
    { id: 'cosmetics', icon: '✨', title: '饰品 & 物品',
      blocks: [
        { type:'p', text:'有装饰领土的 **视觉饰品** 和改变战斗·效率的 **消耗物品** 两类。两种都在 `SHOP` 标签里,能用 PP·USDT·GP 购买。' },
        { type:'toc', label:'本节内容', items:[
          '3 类饰品',
          '护盾·加成·工具物品',
          '各货币付款选项',
          '仅掉落饰品'
        ]},

        { type:'h2', text:'1. 3 类饰品' },
        { type:'p', text:'每个领地最多装备 **1 条边框 + 1 个光效 + 1 种地形**,不能重复装备。' },
        { type:'table',
          headers:['类别','种类','价格区间'],
          rows:[
            [{v:'🟧 边框',cls:'mars'}, '霓虹 · 火焰 · 寒冰 · 黄金', {v:'3 ~ 15 PP',cls:'num'}],
            [{v:'✨ 光效',cls:'mars'}, '脉冲 · 彩虹 · 暗影光环',   {v:'4 ~ 8 PP',cls:'num'}],
            [{v:'⛰ 地形',cls:'mars'},   '火山 · 冰封 · 水晶 · 剧毒', {v:'5 ~ 7 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'info', title:'跨赛季保留',
          text:'购买过的饰品 **永久保留**。赛季重置后依然存在,可以在多个领地之间切换装备。' },

        { type:'h2', text:'2. 护盾·加成·工具物品' },
        { type:'table',
          headers:['物品','效果','费用'],
          rows:[
            [{v:'⚡ 能量护盾',cls:'mars'},    '吸收 50% 劫掠伤害 (12h)', {v:'2.5 PP',cls:'num'}],
            [{v:'💠 等离子护盾',cls:'mars'},  '吸收 75% 劫掠伤害 (24h)', {v:'5.0 PP',cls:'num'}],
            [{v:'🔥 Mars Rage',cls:'mars'},    '攻击 +20% × 3 次',            {v:'2.0 PP',cls:'num'}],
            [{v:'🫥 隐形斗篷',cls:'mars'},   '隐藏领土 (8h)',             {v:'1.5 PP',cls:'num'}],
            [{v:'📡 雷达扫描',cls:'mars'},   '揭示隐形领土 1 次',          {v:'1.0 PP',cls:'num'}],
            [{v:'⛏ 采矿加速',cls:'mars'}, '采矿 × 2 (6h)',               {v:'3.0 PP',cls:'num'}],
            [{v:'🟡 像素倍增器',cls:'mars'},  '下次占领像素 × 2',  {v:'4.0 PP',cls:'num'}]
          ]},
        { type:'callout', variant:'pro', title:'性价比 No.1 — 能量护盾',
          text:'2.5 PP 用两三个每日任务奖励就能补回来。每天挂一个,24 小时防御免费。冲赛季榜的话,始终要挂着等离子护盾。' },

        { type:'h2', text:'3. 各货币付款选项' },
        { type:'p', text:'所有商店物品都能用 **PP·USDT·GP** 三种方式支付。价格比例如下。' },
        { type:'table',
          headers:['货币','换算'],
          rows:[
            ['PP',   {v:'基准价',cls:'num'}],
            ['USDT', {v:'与 PP 价同(1:1)',cls:'num'}],
            ['GP',   {v:'PP 价 × 4',cls:'num'}]
          ]},
        { type:'callout', variant:'tip', title:'别让 GP 烂在手里',
          text:'GP 的主要用途是治理,但也能买饰品。如果你不打算参加总督选举,用 GP 换饰品消耗掉反而能让领土更漂亮。' },

        { type:'h2', text:'4. 仅掉落饰品' },
        { type:'p', text:'有些饰品商店里买不到,只从火箭掉落·赛季奖励·POI 这类 **事件里** 出。' },
        { type:'table',
          headers:['物品','来源','稀有度'],
          rows:[
            [{v:'🚀 Starship 边框',cls:'mars'}, '火箭掉落(2% 权重)', {v:'限定',cls:'num'}],
            [{v:'赛季徽章',cls:'mars'},     '赛季 TOP 10',          {v:'限定',cls:'num'}],
            [{v:'💎 POI 特殊饰品',cls:'mars'}, 'POI 发现 +5% 额外投掷', {v:'随机',cls:'num'}]
          ]},
        { type:'callout', variant:'warn', title:'错过就没了',
          text:'赛季奖励饰品,过了那个赛季就 **再也拿不到**。如果没把握冲上赛季榜,至少要把火箭掉落的捞一捞。' }
      ]
    },
    { id: 'strategy', icon: '🎯', title: '战略要点',
      blocks: [
        { type:'p', text:'最后一节是 **实战运营小贴士**。按第一天、第一周、长期阶段分别说明要优先做什么,以及这款游戏里常见的失败模式。' },
        { type:'toc', label:'本节内容', items:[
          '第一天清单',
          '第一周运营法',
          '长期构建',
          '前 5 大常见错误'
        ]},

        { type:'h2', text:'1. 第一天清单' },
        { type:'p', text:'注册第一天完成下面 5 件事,**从第二天开始被动收益** 就开始转。' },
        { type:'table',
          headers:['顺序','要做的事','奖励'],
          rows:[
            [{v:'1',cls:'num'}, '领取登录奖励',          {v:'5 GP',cls:'num'}],
            [{v:'2',cls:'num'}, '完成 3 个每日任务',          {v:'+50 GP',cls:'num'}],
            [{v:'3',cls:'num'}, '在 FRONTIER 扇区小量占领', {v:'开始收获',cls:'num'}],
            [{v:'4',cls:'num'}, '发现 1 个 POI',               {v:'10~50 GP',cls:'num'}],
            [{v:'5',cls:'num'}, '用推荐码邀请 1 位朋友',   {v:'Tier 1 建成',cls:'num'}]
          ]},

        { type:'h2', text:'2. 第一周运营法' },
        { type:'p', text:'**目标:领土 100~300 像素 + 能量护盾常挂 + 加入公会。**' },
        { type:'callout', variant:'tip', title:'10 天例程',
          text:'每天 ① 登录 ② 3 个任务 ③ 2~3 个 POI ④ 1~2 次收获 ⑤ 更新护盾。光这样每天就能攒 ~100 GP + 1 PP。7 天就是 700 GP · 7 PP。' },
        { type:'callout', variant:'info', title:'公会什么时候加入?',
          text:'找那种活跃成员 10 人以上、聊天氛围好的公会。自己创建要晚一点 — 一个人开,50 GP 花了成员却凑不齐。' },

        { type:'h2', text:'3. 长期构建' },
        { type:'table',
          headers:['目标','策略'],
          rows:[
            ['🏛 总督当选',     '先盯低流量扇区。攒 1000~3000 GP 就能把现任挤掉。'],
            ['⚔ 赛季前 10',    '以 POI 为核心运营(POI 1 个 = 15 分)。榜单奖励大多是 GP,可以继续投入治理。'],
            ['👑 冲击指挥官',     '全球第一 GP 要几万级别。没有公会领袖 + 稳定 POI + 推荐网络是做不到的。'],
            ['💸 DYNASTY 复利',   '邀请 3~5 个活跃大户。他们花的 PP·USDT 都会回流成你的收益。']
          ]},

        { type:'h2', text:'4. 前 5 大常见错误' },
        { type:'callout', variant:'warn', title:'① 没有采矿基础就冲赌场',
          text:'USDT 充值 → 直接冲卡提纳是最糟的路径。3~4% 的庄家优势是真的。先把领土和 POI 稳住。' },
        { type:'callout', variant:'warn', title:'② 在偏远坐标开大领地',
          text:'在边疆买大地根本没人看。一格 CORE 扇区的曝光度就比 100 格 FRONTIER 强。' },
        { type:'callout', variant:'warn', title:'③ 无视护盾',
          text:'为了省一个护盾结果被劫掠丢领土,恢复成本是 20 倍。每天 2.5 PP 固定用来买护盾。' },
        { type:'callout', variant:'warn', title:'④ 跳过每日任务',
          text:'每日任务 + 登录奖励 = 每天白拿 50~150 GP。一个月就是 1500~4500 GP。错过等于放弃总督席位。' },
        { type:'callout', variant:'warn', title:'⑤ 不邀请朋友',
          text:'DYNASTY 是这款游戏里 **期望值(EV)最高的动作**。哪怕只邀请 1 位朋友,线性增长就会变成复利。分享推荐码不丢人。' }
      ]
    }
  ]
};

var _codexIdx = 0;
function openCodex() {
  var ov = document.getElementById('codexOverlay');
  ov.classList.add('open');
  ov.style.display = 'flex';
  renderCodex(0);
}
function closeCodex() {
  var ov = document.getElementById('codexOverlay');
  ov.classList.remove('open');
  ov.style.display = 'none';
}
function codexNav(delta){
  var lang = window.LANG || 'en';
  var content = CODEX_CONTENT[lang] || CODEX_CONTENT.en;
  var total = content.sections.length;
  var next = _codexIdx + delta;
  if(next < 0) next = 0;
  if(next > total - 1) next = total - 1;
  if(next === _codexIdx) return;
  renderCodex(next);
}
// ── Rich block renderer ──
function _codexEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _codexInline(s){
  // Inline markdown: **bold**, [text](#section-id) xref, line breaks, backtick code
  return _codexEsc(s)
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code style="font-family:SF Mono,Menlo,monospace;font-size:10.5px;color:var(--mars);background:rgba(255,120,60,.08);padding:1px 5px;border-radius:3px">$1</code>')
    .replace(/\[([^\]]+)\]\(#([a-z0-9_-]+)\)/gi,'<a class="codex-xref" href="#" onclick="codexGoto(\'$2\');return false;">$1</a>')
    .replace(/\n/g,'<br>');
}
function _codexRenderBlock(b){
  if(!b || !b.type) return '';
  switch(b.type){
    case 'p':
      return '<p>'+_codexInline(b.text||'')+'</p>';
    case 'h2':
      return '<div class="codex-h2">'+_codexEsc(b.text||'')+'</div>';
    case 'toc': {
      var items = (b.items||[]).map(function(it){return '<li>'+_codexInline(it)+'</li>';}).join('');
      return '<div class="codex-toc"><b>'+_codexEsc(b.label||'IN THIS SECTION')+'</b><ul>'+items+'</ul></div>';
    }
    case 'formula': {
      // eq: array of tokens like [{v:'Yield'},{op:'='},{v:'pixels'},{op:'×'},{v:'base',hi:true}]
      // Or simpler: b.eq is a raw string with ~x~ around emphasized tokens
      var eqHtml;
      if(typeof b.eq === 'string'){
        eqHtml = _codexEsc(b.eq).replace(/~([^~]+)~/g,'<em>$1</em>');
      } else {
        eqHtml = '';
      }
      var note = b.note ? '<div class="codex-formula-note">'+_codexInline(b.note)+'</div>' : '';
      return '<div class="codex-formula">'+
        '<div class="codex-formula-label">'+_codexEsc(b.label||'FORMULA')+'</div>'+
        '<div class="codex-formula-eq">'+eqHtml+'</div>'+ note +
      '</div>';
    }
    case 'table': {
      var head = (b.headers||[]).map(function(h){return '<th>'+_codexEsc(h)+'</th>';}).join('');
      var rows = (b.rows||[]).map(function(r){
        var tds = r.map(function(c){
          if(c && typeof c === 'object'){
            var cls = c.cls ? ' class="'+c.cls+'"' : '';
            return '<td'+cls+'>'+_codexInline(c.v||'')+'</td>';
          }
          return '<td>'+_codexInline(c||'')+'</td>';
        }).join('');
        return '<tr>'+tds+'</tr>';
      }).join('');
      return '<div class="codex-table-wrap"><table class="codex-table">'+
        '<thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
    }
    case 'callout': {
      var v = b.variant || 'info';
      var title = b.title ? '<span class="codex-callout-title">'+_codexEsc(b.title)+'</span>' : '';
      return '<div class="codex-callout '+v+'">'+title+_codexInline(b.text||'')+'</div>';
    }
    case 'diagram': {
      var cap = b.caption ? '<div class="codex-diagram-cap">'+_codexEsc(b.caption)+'</div>' : '';
      return '<div class="codex-diagram">'+(b.svg||'')+cap+'</div>';
    }
    default:
      return '';
  }
}
// Jump to a section by id (for xref links)
function codexGoto(id){
  var lang = window.LANG || 'en';
  var content = CODEX_CONTENT[lang] || CODEX_CONTENT.en;
  for(var i=0;i<content.sections.length;i++){
    if(content.sections[i].id === id){ renderCodex(i); return; }
  }
}

function renderCodex(activeIdx) {
  _codexIdx = activeIdx;
  var lang = window.LANG || 'en';
  var content = CODEX_CONTENT[lang] || CODEX_CONTENT.en;
  // tabs
  var tabsEl = document.getElementById('codexTabs');
  tabsEl.innerHTML = '';
  content.sections.forEach(function(sec, i) {
    var btn = document.createElement('button');
    var active = i === activeIdx;
    btn.style.cssText = 'flex-shrink:0;padding:7px 12px;font-size:10px;font-family:var(--fn);letter-spacing:1px;background:' +
      (active ? 'linear-gradient(135deg,rgba(255,120,60,.18),rgba(255,120,60,.05))' : 'transparent') +
      ';border:1px solid ' + (active ? 'rgba(255,120,60,.45)' : 'rgba(255,255,255,.06)') +
      ';border-bottom:none;border-radius:7px 7px 0 0;color:' + (active ? 'var(--mars)' : 'var(--tx3)') +
      ';cursor:pointer;white-space:nowrap;margin-bottom:-1px;font-weight:' + (active ? '700' : '500');
    btn.innerHTML = sec.icon + ' ' + sec.title.toUpperCase();
    btn.onclick = function() { renderCodex(i); };
    if(active){ try{ btn.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'}); }catch(_e){} }
    tabsEl.appendChild(btn);
  });
  // body
  var sec = content.sections[activeIdx];
  var body = document.getElementById('codexBody');
  var html = '<div style="font-size:18px;color:#fff;letter-spacing:1px;margin-bottom:4px">' + sec.icon + ' ' + sec.title + '</div>' +
             '<div style="font-size:9px;color:var(--mars);letter-spacing:1.5px;margin-bottom:16px;opacity:.75">§ ' + (activeIdx + 1) + ' / ' + content.sections.length + '</div>';
  if (Array.isArray(sec.blocks) && sec.blocks.length) {
    // New rich block format
    html += sec.blocks.map(_codexRenderBlock).join('');
  } else if (typeof sec.body === 'string') {
    // Legacy markdown-ish string format: **bold**, \n linebreaks
    var text = sec.body
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    html += '<p>' + text + '</p>';
  }
  body.innerHTML = html;
  body.scrollTop = 0;
  // Update nav footer
  var total = content.sections.length;
  var prevBtn = document.getElementById('codexPrev');
  var nextBtn = document.getElementById('codexNext');
  var ind = document.getElementById('codexStepInd');
  if(prevBtn) prevBtn.disabled = (activeIdx <= 0);
  if(nextBtn) nextBtn.disabled = (activeIdx >= total - 1);
  if(ind) ind.textContent = '§ ' + (activeIdx+1) + ' / ' + total + ' · ' + sec.title.toUpperCase();
}
// Close on background click / ESC; ←/→ to navigate
document.addEventListener('keydown', function(e) {
  var ov = document.getElementById('codexOverlay');
  if(!ov || ov.style.display !== 'flex') return;
  if (e.key === 'Escape') { closeCodex(); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); codexNav(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); codexNav(1); }
});
document.getElementById('codexOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeCodex();
});
// Touch swipe navigation on body
(function(){
  var body = document.getElementById('codexBody');
  if(!body) return;
  var sx = 0, sy = 0, tracking = false;
  body.addEventListener('touchstart', function(e){
    if(!e.touches || !e.touches[0]) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, {passive:true});
  body.addEventListener('touchend', function(e){
    if(!tracking) return;
    tracking = false;
    if(!e.changedTouches || !e.changedTouches[0]) return;
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)*1.5){
      codexNav(dx < 0 ? 1 : -1);
    }
  }, {passive:true});
})();
