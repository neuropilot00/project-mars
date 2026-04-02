# PIXEL WAR - 12-Month Launch Roadmap & Technical Strategy
> Research Date: 2026-04-01 | Based on Web3 Gaming Industry Data through Q1 2026

---

## EXECUTIVE SUMMARY

PIXEL WAR is a Web3 advertising-game hybrid where users claim pixel territory on a world map as NFTs, upload ad images, and compete through overwrite mechanics and arena betting. This document provides a 12-month launch roadmap with specific milestones, metrics, and go/no-go decision points.

**Key Recommendation**: Launch as a Telegram Mini App first (lowest friction), with Base L2 as primary chain (low fees, Coinbase ecosystem), using a hybrid on-chain/off-chain architecture. Target Q3 2026 for public launch after 2-month closed beta.

---

## PART 1: LAUNCH STRATEGY

### 1.1 Launch Sequencing (Recommended)

Based on successful Web3 game launches (Pixels, Hamster Kombat, Notcoin, Catizen):

| Phase | Timeline | Strategy |
|-------|----------|----------|
| Pre-Alpha | Month 1-2 | Internal testing + seed community (200-500 OGs) |
| Closed Beta | Month 3-4 | Invite-only, 2,000-5,000 users, Discord/Telegram gated |
| Open Beta | Month 5-6 | Public access, soft launch on Telegram Mini App |
| Full Launch | Month 7 | Marketing push, exchange partnerships, PR blitz |
| Growth Phase | Month 8-12 | Feature expansion, cross-chain, partnerships |

**Why this sequence works**: Web3 games that skip beta and go straight to public launch typically see 80%+ churn in week 1. Closed beta builds organic evangelists who reduce CAC during public launch.

### 1.2 Platform Strategy

**Primary: Telegram Mini App (TWA)**
- Rationale: 900M+ Telegram users, lowest onboarding friction, no app store approval needed
- Hamster Kombat reached 300M users via Telegram; Notcoin hit 35M
- TON ecosystem grants available ($250M+ TON Foundation fund)
- PIXEL WAR's map-based UI works well in mobile web view
- Wallet integration via TON Connect or embedded wallets (Privy, Dynamic)

**Secondary: Own Website (desktop-first experience)**
- Full canvas experience for power users who want precision pixel claiming
- WalletConnect / Coinbase Wallet / MetaMask integration
- Better for large-area claims (advertising clients)

**Tertiary (Month 8+): Discord Integration**
- Bot for notifications (your pixel was hijacked, race results)
- Mini-game commands for engagement
- NOT the primary game platform

### 1.3 Community Building (Pre-Launch)

**Channel Strategy**:
| Platform | Purpose | Target by Launch |
|----------|---------|-----------------|
| Twitter/X | Announcements, memes, viral content | 15,000-30,000 followers |
| Telegram Group | Primary community, beta access | 5,000-10,000 members |
| Discord | Builder community, feedback, governance | 3,000-5,000 members |

**Tactics that worked in 2024-2025**:
1. **Whitelist/OG campaigns**: Early access to pixel claiming at discount (first 1,000 users get 50% off base price)
2. **Quest platforms**: Galxe, Layer3, Zealy campaigns for social tasks (follow, RT, join TG) -> earn OG role
3. **Content creator collab**: Give KOLs free pixel territory to place their brand logo -> they promote organically
4. **Testnet incentives**: Points system during beta -> converts to PP tokens or claim credits at launch

### 1.4 Pre-Sale / Early Adopter Strategy

**What works**:
- **"Founding Pixel" NFTs**: Limited edition 10x10 pixel blocks in premium map locations (capital cities, landmarks). Sold at fixed price ($10-50), gives permanent 10% discount on future claims in that region
- **PP Token Pre-Sale**: NOT recommended as standalone token sale (regulatory risk). Instead, sell "Credit Packs" (1,000 PP = $80, normally $100) during pre-launch
- **Land Rush Event**: First 24 hours of open beta = all pixels at 50% base price. Creates urgency and viral FOMO

**What fails**:
- Selling governance tokens before product exists (rug pull perception)
- Dutch auction pixel sales (confuses casual users)
- Multiple pre-sale rounds with increasing prices (feels like pyramid)

### 1.5 Airdrop Strategy (Retention-Focused)

**Anti-Bot / Pro-Retention Design**:

| Approach | Retention Rate | Notes |
|----------|---------------|-------|
| One-time token drop | 5-10% | Most users dump immediately (Arbitrum-style) |
| Vested/locked drops | 15-25% | Better but users just wait and dump |
| Activity-based points -> drop | 30-45% | Blast, EigenLayer model - users stay to farm |
| In-game utility drop | 50-70% | Best - drop usable items not tradeable tokens |

**Recommended for PIXEL WAR**:
1. Airdrop PP (in-game points), NOT a separate token
2. PP can only be used to claim pixels or bet in arena (not directly sellable)
3. PP -> USDT swap requires 5% fee (already in your economy spec)
4. Daily login streak -> escalating PP rewards (Day 1: 10 PP, Day 7: 100 PP, Day 30: 1,000 PP)
5. Referral airdrops: Inviter gets 5% of referee's first deposit as PP

**Sybil Resistance**:
- Require wallet to have > $1 in any token on Base (filters empty wallets)
- Telegram account age > 30 days for TWA claims
- Progressive KYC at withdrawal thresholds ($500+)

### 1.6 Influencer Marketing ROI

**Web3 Gaming KOL Tiers (2025-2026 market)**:

| Tier | Followers | Cost/Post | Expected CPI | Typical ROI |
|------|-----------|-----------|--------------|-------------|
| Nano (gaming guilds) | 1K-10K | $200-500 | $2-5 | 3-5x |
| Micro (crypto gaming) | 10K-50K | $500-2,000 | $3-8 | 2-4x |
| Mid (crypto Twitter) | 50K-200K | $2,000-8,000 | $5-15 | 1-3x |
| Macro (mainstream crypto) | 200K-1M | $8,000-30,000 | $10-25 | 0.5-2x |
| Mega (top-tier) | 1M+ | $30,000-100,000+ | $15-40 | 0.3-1.5x |

**Best ROI approach for PIXEL WAR**:
- 20-30 nano/micro KOLs with genuine gaming audiences (total budget: $10,000-20,000)
- Give each KOL a free 50x50 pixel plot to brand with their logo
- Their audience can see the KOL's territory on the map -> organic promotion
- Affiliate tracking: each KOL gets unique referral link -> 10% of referred users' first claim value as PP

---

## PART 2: TECHNICAL ARCHITECTURE FOR SCALE

### 2.1 Blockchain Selection

**Recommendation: Base (primary) + TON (Telegram integration)**

| Chain | Gas/Tx | TPS | Gaming Ecosystem | Wallet UX | Verdict |
|-------|--------|-----|-----------------|-----------|---------|
| **Base** | $0.001-0.01 | ~100 (L2) | Growing (Farcaster/Onchain Summer) | Coinbase Smart Wallet (gasless) | **PRIMARY** |
| **Arbitrum** | $0.01-0.05 | ~100 (L2) | Strong (Treasure, Xai) | Standard MetaMask | Good backup |
| **Polygon PoS** | $0.001-0.01 | ~65 | Mature but declining | Wide support | Decent |
| **Solana** | $0.0001 | ~4,000 | Strong gaming (Star Atlas) | Phantom wallet | Different ecosystem |
| **TON** | $0.005 | ~100K | Explosive (Telegram games) | TON Connect (built-in TG) | **TELEGRAM LAYER** |

**Why Base**:
- Coinbase Smart Wallets: gasless transactions via paymaster, no wallet popup for each tx
- Account abstraction (ERC-4337) native support -> users don't need to understand gas
- USDT/USDC native availability (Coinbase onramp)
- Ethereum security guarantees (L2 settlement)
- Growing developer ecosystem and grants program

**Why TON as secondary**:
- Native Telegram wallet integration (800M+ users)
- If launching as Telegram Mini App, TON Connect provides seamless auth
- Can bridge USDT between Base and TON via cross-chain bridges

### 2.2 Gas Fees & Transaction Speeds Comparison

| Operation | Base Cost | Arbitrum Cost | Polygon Cost | TON Cost |
|-----------|-----------|---------------|--------------|----------|
| Pixel Claim (1 NFT) | $0.002 | $0.02 | $0.003 | $0.01 |
| Batch Claim (100 px) | $0.01 | $0.08 | $0.015 | $0.05 |
| Arena Bet | $0.001 | $0.01 | $0.002 | $0.005 |
| PP Swap | $0.001 | $0.01 | $0.002 | $0.005 |
| Confirmation Time | 2-4 sec | 2-4 sec | 2-4 sec | 5-6 sec |

For PIXEL WAR with potential high-frequency claims, Base's sub-cent gas keeps user friction minimal.

### 2.3 On-Chain vs Off-Chain Hybrid Architecture

**Recommended Architecture**:

```
                    [Frontend: React/Next.js or Vanilla JS]
                               |
                    [API Gateway / Load Balancer]
                               |
              +----------------+----------------+
              |                                 |
    [Game Server (off-chain)]          [Blockchain Layer (on-chain)]
    - Pixel state cache               - NFT ownership (ERC-721)
    - Real-time map rendering          - USDT deposits/withdrawals
    - Arena race simulation            - PP token (ERC-20 or off-chain)
    - Matchmaking                      - Claim history (event logs)
    - Chat / notifications             - Arena payout settlement
    - Image processing
              |                                 |
    [PostgreSQL + Redis]              [Base L2 / TON]
    - User sessions                    - Smart contracts
    - Pixel grid state                 - Treasury multisig
    - Race results                     - Bridge contracts
    - Transaction queue
```

**What goes ON-CHAIN**:
1. Pixel NFT ownership (ERC-721 or ERC-1155 for batch claims)
2. USDT deposit/withdrawal
3. Claim transaction records (immutable proof)
4. Arena bet settlement (trustless payout)
5. Treasury fund management

**What stays OFF-CHAIN**:
1. Real-time pixel map state (read from chain, cached in Redis)
2. Image storage and rendering
3. Arena race simulation (VRF seed from chain, execution off-chain)
4. User sessions and auth
5. PP balance (internal ledger, settles on-chain only at withdrawal)
6. Chat, notifications, leaderboards

**Key principle**: Use blockchain for value transfer and ownership proof. Use traditional infrastructure for everything else.

### 2.4 Handling 10K+ Concurrent Users

**Infrastructure Stack**:

| Component | Technology | Scaling Strategy |
|-----------|-----------|------------------|
| Web Server | Node.js (Express/Fastify) | Horizontal scaling behind ALB |
| Real-time | WebSocket (Socket.io / ws) | Redis pub/sub for multi-node |
| Database | PostgreSQL | Read replicas + connection pooling (PgBouncer) |
| Cache | Redis Cluster | Pixel state, session, leaderboards |
| CDN | Cloudflare | Static assets, map tiles, claim images |
| Image Processing | Sharp (Node.js) | Resize/compress uploaded images |
| Queue | BullMQ (Redis) | Blockchain tx submission, image processing |
| Monitoring | Grafana + Prometheus | Real-time metrics, alerts |

**Scaling Milestones**:

| Users | Infrastructure | Monthly Cost Estimate |
|-------|---------------|----------------------|
| 0-1,000 | 1 VPS (4 CPU, 8GB) | $40-80 |
| 1K-5K | 2 app servers + managed DB | $200-400 |
| 5K-10K | 3 app servers + Redis cluster + CDN | $500-1,000 |
| 10K-50K | Auto-scaling group + read replicas | $1,000-3,000 |
| 50K+ | Kubernetes cluster + managed services | $3,000-10,000 |

### 2.5 Image Storage

**Recommendation: Centralized CDN (primary) + IPFS (proof/backup)**

| Solution | Cost | Speed | Permanence | Verdict |
|----------|------|-------|-----------|---------|
| Cloudflare R2 + CDN | $0.015/GB/mo | Fastest (edge) | Provider-dependent | **PRIMARY** |
| IPFS (Pinata/nft.storage) | $0.02-0.10/GB/mo | Slower (p2p) | Semi-permanent | Backup/proof |
| Arweave | $5-10/GB (one-time) | Slow | Permanent | Too expensive for images |
| AWS S3 + CloudFront | $0.023/GB/mo | Fast | Provider-dependent | Alternative |

**Strategy**:
1. User uploads image -> server resizes to max 512x512, compresses to WebP
2. Stored on Cloudflare R2 (cheap, fast, S3-compatible API)
3. Served via Cloudflare CDN (free tier: 100GB/month bandwidth)
4. IPFS hash stored in NFT metadata for proof of original content
5. Do NOT put actual display images on IPFS/Arweave (too slow for real-time map rendering)

### 2.6 Real-Time Features

**Recommendation: WebSocket (Socket.io) for primary, SSE for fallback**

| Technology | Use Case | Pros | Cons |
|-----------|----------|------|------|
| **WebSocket** | Map updates, arena race, betting | Bi-directional, low latency | Server resource intensive |
| SSE | Notifications, price updates | Simple, auto-reconnect | One-way only |
| Polling | Fallback for restricted networks | Works everywhere | High latency, wasteful |

**WebSocket Channel Design**:
```
ws://api.pixelwar.io/
  /map          -> pixel claim broadcasts (new claim, hijack alerts)
  /arena/:id   -> live race data, bet updates, VRF events
  /user/:wallet -> personal notifications (hijacked, payout, etc.)
```

**Optimization for Scale**:
- Redis pub/sub to broadcast across multiple WebSocket server instances
- Debounce map updates: batch pixel changes and broadcast every 500ms (not per-pixel)
- Arena races: broadcast at 10fps (not 60fps) to reduce bandwidth
- Client-side interpolation for smooth animations between updates

---

## PART 3: GROWTH MILESTONES & METRICS

### 3.1 Month 1-3: Foundation Phase

| Metric | Target | Go/No-Go Threshold |
|--------|--------|---------------------|
| Discord members | 3,000 | 1,000 minimum |
| Telegram members | 5,000 | 2,000 minimum |
| Twitter followers | 10,000 | 3,000 minimum |
| Waitlist signups | 5,000 | 1,500 minimum |
| Beta testers (closed) | 500-2,000 | 200 minimum |
| Beta D7 retention | 30%+ | 15% minimum |
| Pixels claimed (beta) | 50,000 | 10,000 minimum |
| Critical bugs reported | < 5 open | < 10 open |

**Key Activities**:
- Smart contract audit (budget: $10,000-30,000 for CertiK/OpenZeppelin lite)
- Community buildout via quest campaigns (Galxe/Zealy)
- KOL seeding (5-10 micro influencers)
- Landing page + waitlist with referral mechanic

**GO/NO-GO Decision (End of Month 3)**:
- IF beta retention > 15% AND community > 5,000 total: proceed to open beta
- IF beta retention < 10%: pivot game mechanics before scaling
- IF community < 2,000: increase marketing budget or delay launch

### 3.2 Month 3-6: Scaling Phase

| Metric | Target | Go/No-Go Threshold |
|--------|--------|---------------------|
| DAU | 2,000-5,000 | 500 minimum |
| MAU | 10,000-20,000 | 3,000 minimum |
| DAU/MAU ratio | 20-30% | 10% minimum |
| Total pixels claimed | 200,000 | 50,000 minimum |
| Revenue (pixel claims) | $20,000-50,000/mo | $5,000/mo minimum |
| Arena bets/day | 500-1,000 | 100 minimum |
| Avg. session length | 8-15 min | 3 min minimum |
| D30 retention | 15-25% | 8% minimum |
| Organic/paid user ratio | 40/60 | 20/80 minimum |

**Key Activities**:
- Open beta launch (Telegram Mini App)
- First land rush event
- KOL campaign expansion (20-30 KOLs)
- Arena betting launch
- PP economy balancing based on data
- First exchange listing discussions

**GO/NO-GO Decision (End of Month 6)**:
- IF DAU > 1,000 AND revenue > $10,000/mo: proceed to full marketing push
- IF DAU 500-1,000: optimize retention before spending on acquisition
- IF DAU < 500: major product pivot needed

### 3.3 Month 6-12: Maturity Phase

| Metric | Target | Industry Benchmark |
|--------|--------|-------------------|
| DAU | 10,000-50,000 | Top 20 web3 game |
| MAU | 50,000-150,000 | Top 10 web3 game |
| DAU/MAU ratio | 25-35% | Web3 avg: 10-20%, good: 25%+ |
| Monthly revenue | $100,000-500,000 | Sustainable with team of 5-10 |
| Total pixels claimed | 500,000+ (50% of grid) | Triggers scarcity mechanics |
| Unique wallets | 30,000-100,000 | |
| Arena daily volume | $10,000-50,000 | |
| Overwrite rate | 10-20% of claims | Healthy competition indicator |

### 3.4 Industry Benchmarks

**DAU/MAU Ratios for Web3 Games (2024-2025 data)**:
- Pixels (pixel farming): 25-35% DAU/MAU at peak
- Axie Infinity (2023, declining): 15-20%
- Hamster Kombat (Telegram): 40-60% (casual, high frequency)
- Star Atlas (complex): 8-12%
- Average web3 game: 10-20%
- Traditional mobile game benchmark: 20-30%

**Target for PIXEL WAR**: 20-30% DAU/MAU (casual enough for daily check-ins, deep enough for power users)

**User Acquisition Costs (Web3 Gaming, 2025)**:
| Channel | CAC | Quality |
|---------|-----|---------|
| Organic (Twitter/TG viral) | $0 | Highest retention |
| Quest platforms (Galxe) | $0.50-2.00 | Medium (many bots) |
| KOL marketing | $3-15 | Varies by KOL |
| Paid ads (Twitter/Google) | $5-25 | Low in web3 (many tire kickers) |
| Gaming guild partnerships | $1-5 | Good (pre-qualified gamers) |
| Telegram ads | $0.10-0.50 | High volume, lower quality |

**Recommended CAC budget**: $3-8 per retained user (D30), primarily through KOL + quest + Telegram channels.

---

## PART 4: RISKS AND MITIGATION

### 4.1 Regulatory Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Pixel NFTs as securities** | MEDIUM | Pixels are utility tokens (ad space), not investment contracts. No promise of profit. No revenue sharing to holders. Document this in Terms of Service clearly. |
| **Arena betting as gambling** | HIGH | Korean gambling law (사행행위규제법) is strict. Arena betting with real money (USDT) likely qualifies. **Mitigation**: Use only PP (non-withdrawable game points) for arena bets, OR restrict Korean users from arena, OR obtain offshore gambling license (Curacao, Malta). |
| **USDT as money transmission** | MEDIUM | Operating a platform where users deposit/withdraw USDT may require money transmitter licenses in some jurisdictions. **Mitigation**: Use a licensed payment processor (MoonPay, Transak) for fiat on-ramp. Keep USDT flows peer-to-contract only. |
| **Image copyright** | MEDIUM | Users may upload copyrighted images to their pixels. **Mitigation**: DMCA takedown process, image moderation (manual + AI), ToS requiring users own uploaded content. |

**Critical Legal Recommendation**: Before launch, consult with a Korean crypto-regulatory attorney regarding:
1. Arena betting mechanics (PP-only vs USDT)
2. Whether PP-to-USDT swap creates a de-facto token issuance
3. VASP registration requirements

### 4.2 Smart Contract Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Reentrancy attack | Loss of treasury funds | Use OpenZeppelin ReentrancyGuard, checks-effects-interactions pattern |
| Integer overflow | Incorrect pricing | Solidity 0.8+ has built-in overflow checks |
| Access control bypass | Unauthorized minting | Role-based access (OpenZeppelin AccessControl), multi-sig for admin |
| Oracle manipulation | Rigged arena results | Use Chainlink VRF v2+ for verifiable randomness |
| Upgrade bug | Bricked contract | Use UUPS proxy pattern, timelock on upgrades, test on fork |
| Bridge exploit | Loss of cross-chain funds | Use established bridges (Wormhole, LayerZero), limit bridge TVL |

**Audit Strategy**:
- Phase 1 (Month 2): Internal review + Slither/Mythril automated analysis ($0)
- Phase 2 (Month 3): Competitive audit on Code4rena or Sherlock ($15,000-30,000)
- Phase 3 (Month 5, pre-launch): Professional audit by CertiK or Trail of Bits ($20,000-50,000)
- Ongoing: Bug bounty program on Immunefi ($5,000-20,000 pool)

### 4.3 Trust Building (Anti-Rug-Pull Perception)

Web3 users are extremely skeptical. Proven trust signals:

| Action | Impact | Cost |
|--------|--------|------|
| **Doxxed team** | Very High | Free (but personal risk) |
| **Smart contract audit** | High | $15,000-50,000 |
| **Open-source contracts** | High | Free |
| **Treasury multi-sig (3/5)** | High | Free (Gnosis Safe) |
| **Locked liquidity** | Medium | Free (if applicable) |
| **Regular community updates** | High | Time only |
| **Transparent treasury dashboard** | High | 1-2 days dev time |
| **Progressive decentralization roadmap** | Medium | Documentation |

**Minimum trust package for launch**: Audit report + multi-sig treasury + open-source contracts + doxxed at least 1 team member + weekly community calls.

### 4.4 Market Timing

**Is 2026 good for Web3 gaming launch?**

Favorable signals:
- Bitcoin halving in April 2024 historically creates 12-18 month bull cycle (peak late 2025 to mid 2026)
- Ethereum ETF approval (2024) brought institutional capital
- Telegram Mini App ecosystem exploded in 2024-2025, creating massive new web3 user base
- Gaming-specific L2s (Immutable X, Xai, Ronin) have matured
- Account abstraction makes onboarding dramatically easier than 2022-2023 era

Unfavorable signals:
- If crypto winter returns in H2 2026, user attention and capital will decline
- Regulatory crackdown possible (MiCA in EU, potential SEC action on gaming tokens)
- Web3 gaming market is more competitive than 2022

**Assessment**: H1-H2 2026 is a reasonable window. The Telegram Mini App channel specifically is high-opportunity due to massive user base and relatively few high-quality games. The key risk is launching too late in a potential bull cycle.

### 4.5 Competition Analysis

**Direct Competitors** (pixel/territory web3 games):

| Project | Status | Differentiator | PIXEL WAR Advantage |
|---------|--------|---------------|-------------------|
| The Million Dollar Homepage | Legacy (2005) | Original pixel concept | Dynamic (overwrite), gamified |
| Pixels (Ronin) | Live, 50K+ DAU | Farming game with pixel land | More accessible, no grinding |
| Decentraland | Live, declining | Full 3D metaverse | Simpler, lower barrier, ad-focused |
| The Sandbox | Live, moderate | 3D voxel builder | No download needed, instant play |
| Otherside (Yuga Labs) | Development | AAA-budget metaverse | Much lower cost to enter |

**Indirect Competitors** (Telegram mini games):

| Project | Users | Mechanic | Threat Level |
|---------|-------|---------|-------------|
| Hamster Kombat | 300M+ | Tap-to-earn | LOW (different mechanic) |
| Notcoin | 35M | Tap-to-earn | LOW (already launched/fading) |
| Catizen | 30M | Cat breeding | MEDIUM (same TG audience) |
| BANANA | 5M+ | Tap game | LOW |

**PIXEL WAR's unique positioning**: No direct competitor combines pixel territory claiming + advertising utility + arena betting in a Telegram Mini App format. The "overwrite war" mechanic creates genuine competitive gameplay that tap-to-earn games lack.

---

## PART 5: PARTNERSHIP OPPORTUNITIES

### 5.1 SpaceX / Elon Musk Mars Theme - Trademark Analysis

**CRITICAL WARNING**: Using SpaceX, Elon Musk, or Mars colonization themes that directly reference these brands carries significant legal risk.

| Element | Risk Level | Notes |
|---------|-----------|-------|
| "SpaceX" name/logo | VERY HIGH | Registered trademark. Do not use. |
| "Elon Musk" name/likeness | VERY HIGH | Right of publicity violation. Do not use. |
| "Mars" (the planet) | NONE | Not trademarkable. Free to use. |
| "Mars colonization" theme | LOW | Generic sci-fi concept. Safe if no SpaceX branding. |
| "Starship" | HIGH | SpaceX trademark for their rocket. Avoid. |
| Mars surface imagery (NASA) | NONE | Public domain. Free to use. |

**Safe approach**: Use Mars theme generically. Call it "Mars Colony" or "Red Planet" without referencing SpaceX or Musk. This is a common game theme (Surviving Mars, Terraformers, Per Aspera) with no IP issues.

### 5.2 NASA Mars Data (Public Domain)

NASA provides extensive Mars data under public domain (no copyright):

| Resource | URL | Use Case |
|----------|-----|----------|
| Mars HiRISE imagery | hirise.lpl.arizona.edu | High-res surface textures for pixel map |
| Mars Trek (3D maps) | trek.nasa.gov/mars | Topographic data for terrain |
| Mars Reconnaissance Orbiter | mars.nasa.gov | Surface photos |
| MOLA elevation data | astrogeology.usgs.gov | Height maps for 3D terrain |

**All NASA imagery is public domain** unless it contains identifiable people or patented items. Perfect for creating a Mars-themed pixel map layer.

**Implementation idea**: "Mars Expansion" - a second pixel map based on real Mars topography data. Users claim "land" on Mars. Purely thematic, uses NASA open data.

### 5.3 Crypto Exchange Partnerships

| Exchange | Listing Requirements | Cost | Value |
|----------|---------------------|------|-------|
| **Binance** | Top-tier project, $1M+ volume, community | $100K-500K+ | Highest visibility |
| **OKX** | Growing project, reasonable traction | $50K-200K | Strong Asian market |
| **Bybit** | Active community, novel concept | $30K-100K | Good for gaming tokens |
| **Gate.io** | Lower bar, accepts newer projects | $10K-50K | Quick listing |
| **MEXC** | Lowest bar, many small tokens | $5K-20K | Easy first listing |
| **Coinbase** | Requires regulatory compliance, Base native | Relationship-based | Ideal if on Base chain |

**Strategy**: Start with MEXC or Gate.io listing (Month 8-10), build volume track record, then approach Bybit/OKX. Coinbase listing is ideal long-term given Base chain choice.

**Important**: Only list a token IF you create one. PIXEL WAR could operate purely on USDT + PP (internal points) without a native token, avoiding token listing complexity entirely. This is actually a strategic advantage for regulatory clarity.

### 5.4 Gaming Guild Partnerships

| Guild | Size | Region | Potential Value |
|-------|------|--------|----------------|
| YGG (Yield Guild Games) | 500K+ scholars | SEA | Player supply, brand credibility |
| Merit Circle (now Beam) | 200K+ | Global | Investment arm, ecosystem support |
| GuildFi | 100K+ | SEA | Onboarding pipeline |
| Avocado Guild | 50K+ | SEA | Active gaming community |
| Unix Gaming | 50K+ | Global | Multi-game guild |

**Partnership Model**:
- Guilds get reserved pixel territory (e.g., 100x100 block) at discount
- Guild members get bonus PP on sign-up via guild referral link
- Revenue share: guild gets 5% of referred members' claim fees
- Guild logo displayed prominently on their territory -> organic advertising

---

## PART 6: 12-MONTH ROADMAP

### MONTH 1-2: Foundation & Pre-Alpha

**Development**:
- [ ] Smart contracts: ERC-721 pixel NFT, deposit/withdraw, claim mechanics
- [ ] Backend: Node.js API server, PostgreSQL schema, Redis cache
- [ ] Frontend: Migrate from static HTML to React/Next.js (or keep vanilla JS for performance)
- [ ] Telegram Mini App wrapper (TWA SDK integration)
- [ ] Basic wallet integration (Coinbase Smart Wallet + TON Connect)
- [ ] Internal testing environment on Base Sepolia testnet

**Community**:
- [ ] Twitter/X account launch with 3x/week content
- [ ] Discord server setup (roles, channels, bot)
- [ ] Telegram group creation
- [ ] Landing page with email/wallet waitlist
- [ ] Brand identity finalization (logo, colors, style guide)

**Budget**: $5,000-10,000 (infra + design + small KOL seeds)

**Milestone**: Working testnet demo with claim + overwrite + arena prototype

---

### MONTH 3-4: Closed Beta

**Development**:
- [ ] Smart contract audit (automated tools + community audit)
- [ ] Image upload + CDN pipeline (Cloudflare R2)
- [ ] WebSocket real-time map updates
- [ ] Arena betting MVP (PP only, not USDT initially)
- [ ] PP economy: deposit bonus, daily rewards, referral system
- [ ] Admin dashboard for monitoring + moderation

**Community**:
- [ ] Galxe/Zealy quest campaign (target: 5,000 participants)
- [ ] OG NFT or role for first 500 beta testers
- [ ] Weekly community calls (Twitter Spaces or Discord)
- [ ] 5-10 micro KOL partnerships ($200-500 each)

**Metrics to Track**:
- Beta DAU and D1/D7/D30 retention
- Average claims per user per day
- PP economy balance (inflation vs. sink rate)
- Bug reports and crash rate
- User feedback themes

**Budget**: $15,000-30,000 (audit + KOLs + infra scaling)

**GO/NO-GO GATE #1 (End of Month 4)**:
| Condition | Go | Rework | Kill |
|-----------|-----|--------|------|
| D7 Retention | > 20% | 10-20% | < 10% |
| Beta Users | > 500 | 200-500 | < 200 |
| Critical Bugs | < 3 open | 3-10 | > 10 |
| Community Size | > 5,000 | 2,000-5,000 | < 2,000 |

---

### MONTH 5-6: Open Beta / Soft Launch

**Development**:
- [ ] Telegram Mini App public launch
- [ ] Desktop web app public launch
- [ ] USDT deposit/withdrawal (on-chain, Base mainnet)
- [ ] Arena betting with USDT (if legal review approves)
- [ ] Referral system with tracking dashboard
- [ ] Anti-bot measures (rate limiting, wallet age checks)
- [ ] Performance optimization for 5K+ concurrent users

**Marketing**:
- [ ] "Land Rush" event: 48-hour 50% discount on all pixel claims
- [ ] 20-30 KOL campaign ($10,000-20,000 total)
- [ ] Telegram Ads campaign (test $2,000-5,000 budget)
- [ ] PR: 3-5 crypto media articles (CoinDesk, The Block, Decrypt)
- [ ] Gaming guild outreach (YGG, Merit Circle)

**Budget**: $30,000-60,000 (marketing + infra + operations)

**GO/NO-GO GATE #2 (End of Month 6)**:
| Condition | Go | Rework | Kill |
|-----------|-----|--------|------|
| DAU | > 1,000 | 500-1,000 | < 500 |
| Monthly Revenue | > $10,000 | $3,000-10,000 | < $3,000 |
| D30 Retention | > 10% | 5-10% | < 5% |
| Overwrite Rate | > 5% | 2-5% | < 2% |

---

### MONTH 7-8: Full Launch & Growth

**Development**:
- [ ] Cross-chain support (add TON or Arbitrum)
- [ ] Mobile-optimized UI improvements
- [ ] Guild system (territories, shared PP pool, leaderboards)
- [ ] Kaiju/disaster events system (Phase 3 from existing roadmap)
- [ ] API for external developers (embed pixel map widget)

**Marketing**:
- [ ] Major marketing push ($30,000-50,000)
- [ ] Exchange listing process (start with MEXC/Gate.io)
- [ ] Gaming conference presence (if budget allows)
- [ ] Collaboration with 1-2 mid-tier brands (test B2B pixel advertising)

**Operations**:
- [ ] Scale infrastructure for 10K+ concurrent
- [ ] 24/7 community moderation
- [ ] Customer support system
- [ ] Legal entity setup (offshore if needed for regulatory reasons)

**Budget**: $50,000-100,000

---

### MONTH 9-10: Scale & Monetize

**Development**:
- [ ] B2B advertising API (brands buy pixel territory programmatically)
- [ ] "Mars Expansion" map (second map using NASA data)
- [ ] Tournament/season system for arena
- [ ] Governance proposal system (community votes on map features)
- [ ] Mobile app (React Native PWA or native wrapper)

**Business**:
- [ ] B2B sales outreach to web3 projects (buy pixels for brand awareness)
- [ ] Higher-tier exchange listing (Bybit/OKX)
- [ ] Revenue target: $50,000+/month
- [ ] Explore institutional partnership (gaming fund investment)

**Budget**: $40,000-80,000

---

### MONTH 11-12: Maturity & Sustainability

**Development**:
- [ ] DAO governance framework (if community demands it)
- [ ] Advanced analytics dashboard for advertisers
- [ ] Second arena game mode
- [ ] SDK for third-party integrations

**Business**:
- [ ] Series A fundraise (if growth justifies)
- [ ] Team expansion (target: 8-15 people)
- [ ] Annual financial audit
- [ ] 2027 roadmap planning

**Targets at Month 12**:
| Metric | Success | Moderate | Pivot |
|--------|---------|----------|-------|
| DAU | > 10,000 | 3,000-10,000 | < 3,000 |
| MAU | > 50,000 | 15,000-50,000 | < 15,000 |
| Monthly Revenue | > $100,000 | $30,000-100,000 | < $30,000 |
| Pixels Claimed | > 500,000 | 200,000-500,000 | < 200,000 |
| Unique Wallets | > 30,000 | 10,000-30,000 | < 10,000 |
| Team Size | 8-15 | 5-8 | 3-5 |

---

## BUDGET SUMMARY

| Phase | Timeline | Budget Range |
|-------|----------|-------------|
| Foundation | Month 1-2 | $5,000-10,000 |
| Closed Beta | Month 3-4 | $15,000-30,000 |
| Open Beta | Month 5-6 | $30,000-60,000 |
| Full Launch | Month 7-8 | $50,000-100,000 |
| Scale | Month 9-10 | $40,000-80,000 |
| Maturity | Month 11-12 | $30,000-60,000 |
| **TOTAL** | **12 months** | **$170,000-340,000** |

Note: This assumes a lean team (2-5 core members initially). If salaries are included, add $200,000-500,000/year depending on team size and location.

---

## KEY DECISION POINTS SUMMARY

| When | Decision | Data Required |
|------|----------|--------------|
| Month 2 | Chain: Base vs TON vs both | Gas cost analysis, wallet UX testing |
| Month 4 | Go/No-Go #1: proceed to open beta? | Beta retention, community size, bugs |
| Month 5 | Arena betting: PP-only vs USDT? | Legal review completion |
| Month 6 | Go/No-Go #2: scale marketing? | DAU, revenue, retention data |
| Month 7 | Token launch: yes/no? | Revenue model sustainability, regulatory |
| Month 9 | Mars expansion: build or not? | User demand signals, development capacity |
| Month 10 | Exchange listing: which tier? | Volume data, community size, budget |
| Month 12 | Fundraise vs bootstrap? | Revenue trajectory, growth rate |

---

## APPENDIX: TOP 3 STRATEGIC RISKS

1. **Regulatory risk on arena betting (HIGH)**: Korean gambling law could classify USDT-based arena betting as illegal gambling. Mitigation: PP-only betting for Korean users, or operate through non-Korean entity with geo-restriction.

2. **User retention after airdrop farming (MEDIUM)**: Many web3 users join only to farm airdrops/rewards, then leave. Mitigation: Make PP useful only within the game ecosystem, avoid promising tradeable token, focus on genuine gameplay loops.

3. **Bull/bear market timing (MEDIUM)**: If crypto enters bear market in H2 2026, web3 gaming interest drops 60-80% historically. Mitigation: Ensure product works and retains users independent of token price speculation. The advertising utility (pixels as ad space) provides non-speculative value.

---

*Note: This research is based on industry knowledge through Q1 2026. For the most current data on specific metrics, exchange listing costs, and regulatory developments, real-time web research is recommended. WebSearch and WebFetch tools were unavailable during this analysis - the user should grant these permissions for follow-up research with live data.*
