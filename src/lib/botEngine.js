/**
 * Bot Engine v6.6
 * Full dynamic IPL franchise auction valuation engine.
 * Every franchise independently calculates its max willingness-to-pay
 * for each player based on: player quality, role need, squad gaps,
 * purse management, future planning, personality, and controlled randomness.
 * NO fixed price caps. NO uniform stopping points.
 */

import { ref, runTransaction, push } from 'firebase/database';
import { rtdb } from './firebase';
import { IPL_PLAYERS } from '../data/players';

// ── Franchise profiles ───────────────────────────────────────────────────────
// Each franchise has a strategy type and role priorities.
// Role priorities affect how aggressively they bid for each role.
// playerAffinities: specific player IDs this franchise values extra (e.g. RCB for Kohli).
export const FRANCHISE_OWNERS = {
  CSK: {
    ownerName: 'N. Srinivasan',
    strategy: 'balanced',
    avatar: '👔',
    rolePriority: { Batsman: 8, 'Wicket-Keeper': 7, 'All-Rounder': 9, Bowler: 7 },
    preferExperience: true,   // prefers high-match-count players
    budgetStyle: 'conservative', // saves more for later
  },
  MI: {
    ownerName: 'Mukesh Ambani',
    strategy: 'aggressive',
    avatar: '💼',
    rolePriority: { Batsman: 9, 'Wicket-Keeper': 8, 'All-Rounder': 10, Bowler: 8 },
    preferExperience: false,
    budgetStyle: 'spender',
  },
  RCB: {
    ownerName: 'Virat Kohli XI',
    strategy: 'star_hunter',  // chases star batsmen hard
    avatar: '🔴',
    rolePriority: { Batsman: 10, 'Wicket-Keeper': 7, 'All-Rounder': 8, Bowler: 6 },
    playerAffinities: ['p_609', 'p_104'], // Kohli, Hardik (example IDs — engine still works without exact match)
    preferExperience: true,
    budgetStyle: 'spender',
  },
  KKR: {
    ownerName: 'Shah Rukh Khan',
    strategy: 'unpredictable',
    avatar: '⭐',
    rolePriority: { Batsman: 8, 'Wicket-Keeper': 7, 'All-Rounder': 9, Bowler: 8 },
    preferExperience: false,
    budgetStyle: 'impulsive',
  },
  DC: {
    ownerName: 'Parth Jindal',
    strategy: 'data_driven',  // bids on value, not names
    avatar: '📊',
    rolePriority: { Batsman: 7, 'Wicket-Keeper': 8, 'All-Rounder': 9, Bowler: 9 },
    preferExperience: false,
    budgetStyle: 'conservative',
  },
  PBKS: {
    ownerName: 'Preity Zinta',
    strategy: 'squad_need',   // bids hard when role is missing
    avatar: '🌟',
    rolePriority: { Batsman: 9, 'Wicket-Keeper': 9, 'All-Rounder': 8, Bowler: 7 },
    preferExperience: true,
    budgetStyle: 'balanced',
  },
  RR: {
    ownerName: 'Manoj Badale',
    strategy: 'value_hunter', // wants high quality at low price
    avatar: '🧮',
    rolePriority: { Batsman: 7, 'Wicket-Keeper': 7, 'All-Rounder': 9, Bowler: 8 },
    preferExperience: false,
    budgetStyle: 'conservative',
  },
  SRH: {
    ownerName: 'Kalanithi Maran',
    strategy: 'aggressive',
    avatar: '📺',
    rolePriority: { Batsman: 8, 'Wicket-Keeper': 7, 'All-Rounder': 8, Bowler: 10 },
    preferExperience: true,
    budgetStyle: 'spender',
  },
  GT: {
    ownerName: 'CVC Capital',
    strategy: 'balanced',
    avatar: '💹',
    rolePriority: { Batsman: 8, 'Wicket-Keeper': 7, 'All-Rounder': 9, Bowler: 8 },
    preferExperience: false,
    budgetStyle: 'conservative',
  },
  LSG: {
    ownerName: 'Sanjiv Goenka',
    strategy: 'squad_need',
    avatar: '🏗️',
    rolePriority: { Batsman: 8, 'Wicket-Keeper': 8, 'All-Rounder': 8, Bowler: 8 },
    preferExperience: false,
    budgetStyle: 'balanced',
  },
};

// ── Strategy behaviour params ─────────────────────────────────────────────────
const STRATEGY = {
  aggressive: {
    bidProbabilityBase: 0.82,
    valuationMultiplier: 1.25,  // pays more than calculated value
    fightBaseChance: 0.78,
    thinkMin: 3000, thinkMax: 6000,
    budgetReserveRatio: 0.12,   // keeps 12% of total budget in reserve
    maxSingleSpendRatio: 0.55,  // can spend up to 55% of remaining on one player
    futureDiscountFactor: 0.7,  // less worried about saving for future
  },
  balanced: {
    bidProbabilityBase: 0.65,
    valuationMultiplier: 1.0,
    fightBaseChance: 0.60,
    thinkMin: 4000, thinkMax: 8000,
    budgetReserveRatio: 0.18,
    maxSingleSpendRatio: 0.40,
    futureDiscountFactor: 0.85,
  },
  star_hunter: {
    bidProbabilityBase: 0.70,
    valuationMultiplier: 1.35,  // overpays for stars
    fightBaseChance: 0.85,      // very persistent on priority players
    thinkMin: 3500, thinkMax: 7000,
    budgetReserveRatio: 0.10,
    maxSingleSpendRatio: 0.65,  // willing to blow budget on one star
    futureDiscountFactor: 0.6,
  },
  data_driven: {
    bidProbabilityBase: 0.60,
    valuationMultiplier: 0.90,  // never overpays
    fightBaseChance: 0.50,
    thinkMin: 5000, thinkMax: 9000,
    budgetReserveRatio: 0.22,
    maxSingleSpendRatio: 0.35,
    futureDiscountFactor: 0.95, // most concerned about future planning
  },
  unpredictable: {
    bidProbabilityBase: 0.72,
    valuationMultiplier: 1.0,   // base — but gets huge random swings
    fightBaseChance: 0.65,
    thinkMin: 2000, thinkMax: 10000,
    budgetReserveRatio: 0.08,
    maxSingleSpendRatio: 0.70,
    futureDiscountFactor: 0.5,
  },
  squad_need: {
    bidProbabilityBase: 0.75,
    valuationMultiplier: 1.15,
    fightBaseChance: 0.72,
    thinkMin: 4000, thinkMax: 8000,
    budgetReserveRatio: 0.20,
    maxSingleSpendRatio: 0.45,
    futureDiscountFactor: 0.80,
  },
  value_hunter: {
    bidProbabilityBase: 0.58,
    valuationMultiplier: 0.85,
    fightBaseChance: 0.45,
    thinkMin: 5000, thinkMax: 10000,
    budgetReserveRatio: 0.25,
    maxSingleSpendRatio: 0.30,
    futureDiscountFactor: 0.90,
  },
};

// ── Player quality rating 0–10 ────────────────────────────────────────────────
function ratePlayer(player) {
  if (!player?.stats) return 4;
  const s = player.stats;
  const n = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const role = (player.role || '').toLowerCase();
  let score = 0, count = 0;

  // Batting score
  const runs = n(s.runs); const avg = n(s.avg); const sr = n(s.sr);
  if (runs !== null) { score += Math.min(10, runs / 600); count++; }
  if (avg !== null)  { score += Math.min(10, (avg - 10) / 3.5); count++; }
  if (sr !== null)   { score += Math.min(10, (sr - 90) / 9); count++; }

  // Bowling score
  const wk = n(s.wickets); const ec = n(s.econ);
  if (wk !== null)   { score += Math.min(10, wk / 18); count++; }
  if (ec !== null)   { score += Math.min(10, (11 - ec) / 2); count++; }

  // Role weighting — don't penalise pure bowlers for bad batting
  let finalScore;
  if (role.includes('bowler')) {
    const bowlScore = [wk !== null ? Math.min(10, wk / 18) : null, ec !== null ? Math.min(10, (11 - ec) / 2) : null].filter(v => v !== null);
    finalScore = bowlScore.length ? bowlScore.reduce((a, b) => a + b, 0) / bowlScore.length : 4;
  } else if (role.includes('all')) {
    finalScore = count ? score / count : 5;
  } else {
    // Batsman / WK — weight batting more
    const batScore = [runs !== null ? Math.min(10, runs / 600) : null, avg !== null ? Math.min(10, (avg - 10) / 3.5) : null, sr !== null ? Math.min(10, (sr - 90) / 9) : null].filter(v => v !== null);
    finalScore = batScore.length ? batScore.reduce((a, b) => a + b, 0) / batScore.length : 4;
  }

  // Experience bonus (matches played)
  const matches = n(s.matches);
  if (matches !== null && matches > 80) finalScore = Math.min(10, finalScore + 0.5);

  return Math.max(0, Math.min(10, finalScore));
}

// ── Squad analysis ────────────────────────────────────────────────────────────
function analyseSquad(squad) {
  const counts = { Batsman: 0, Bowler: 0, 'All-Rounder': 0, 'Wicket-Keeper': 0 };
  const totalPlayers = squad.length;
  squad.forEach(entry => {
    const pid = typeof entry === 'string' ? entry : entry?.id;
    const p = IPL_PLAYERS.find(x => x.id === pid);
    if (p?.role && counts[p.role] !== undefined) counts[p.role]++;
  });
  return { counts, totalPlayers };
}

// ── Upcoming players analysis — how many good players of each role remain ─────
function analyseUpcoming(playerOrder, currentOrderIndex, role) {
  if (!playerOrder || !Array.isArray(playerOrder)) return 0;
  const remaining = playerOrder.slice(currentOrderIndex + 1, currentOrderIndex + 40); // look ahead 40
  let goodOnesLeft = 0;
  remaining.forEach(idx => {
    const p = IPL_PLAYERS[idx];
    if (p?.role === role && ratePlayer(p) >= 6) goodOnesLeft++;
  });
  return goodOnesLeft;
}

// ── Core valuation engine ─────────────────────────────────────────────────────
// Returns the max price this bot is willing to pay for this player.
// Called ONCE per player per bot and cached.
function calculateMaxValuation(bot, player, franchise, strategy, squadAnalysis, playerOrder, currentOrderIndex, defaultBudget) {
  const playerRating = ratePlayer(player);

  // 1. Base market value from player rating (₹ Cr)
  //    Rating 10 = ₹25 Cr market cap, rating 5 = ₹8 Cr, rating 2 = ₹3 Cr
  const baseMarketValue = Math.pow(playerRating / 10, 1.8) * 25;

  // 2. Role priority multiplier — how much does THIS franchise value THIS role
  const rolePriority = (franchise.rolePriority?.[player.role] || 7) / 10; // 0.6–1.0
  const rolePriorityMult = 0.6 + rolePriority * 0.8; // 0.6x to 1.4x

  // 3. Squad need multiplier — bid harder when role is missing
  const roleCount = squadAnalysis.counts[player.role] || 0;
  const needMult = roleCount === 0 ? 1.35 :   // desperate — no one in this role
                   roleCount === 1 ? 1.15 :   // needs backup
                   roleCount === 2 ? 1.0  :   // comfortable
                   roleCount >= 3  ? 0.75 :   // already covered — backs off
                   1.0;

  // 4. Player affinity — specific franchise-player preferences (e.g. RCB for Kohli)
  const hasAffinity = franchise.playerAffinities?.includes(player.id);
  // Also check name-based affinity for key players
  const nameAffinityMap = {
    RCB: ['Virat Kohli', 'Glenn Maxwell', 'Faf du Plessis'],
    MI:  ['Rohit Sharma', 'Jasprit Bumrah', 'Hardik Pandya'],
    CSK: ['MS Dhoni', 'Ravindra Jadeja', 'Deepak Chahar'],
    KKR: ['Andre Russell', 'Sunil Narine', 'Rinku Singh'],
    DC:  ['Rishabh Pant', 'Axar Patel', 'Kuldeep Yadav'],
    SRH: ['Pat Cummins', 'Heinrich Klaasen', 'Travis Head'],
    PBKS: ['Shikhar Dhawan', 'Arshdeep Singh', 'Sam Curran'],
    RR:  ['Sanju Samson', 'Yashasvi Jaiswal', 'Trent Boult'],
    GT:  ['Shubman Gill', 'Rashid Khan', 'Mohammed Shami'],
    LSG: ['KL Rahul', 'Quinton de Kock', 'Mark Wood'],
  };
  const nameAffinities = nameAffinityMap[bot.teamId] || [];
  const nameAffinity = nameAffinities.some(name => player.name?.toLowerCase().includes(name.toLowerCase().split(' ')[1] || name.toLowerCase()));
  const affinityMult = (hasAffinity || nameAffinity) ? 1.4 : 1.0;

  // 5. Experience preference
  const matches = typeof player.stats?.matches === 'number' ? player.stats.matches : 0;
  const expMult = franchise.preferExperience
    ? (matches > 100 ? 1.15 : matches > 50 ? 1.05 : 0.92)
    : 1.0;

  // 6. Future planning discount — if good players of same role are coming, bid less
  const upcomingGoodPlayers = analyseUpcoming(playerOrder, currentOrderIndex, player.role);
  const futurePlanningDiscount = 1 - (upcomingGoodPlayers * 0.04 * strategy.futureDiscountFactor);

  // 7. Purse management — cannot overspend
  const slotsRemaining = Math.max(1, 25 - squadAnalysis.totalPlayers);
  const reserveNeeded = bot.budgetRemaining * strategy.budgetReserveRatio;
  const costPerRemainingSlot = 0.5; // assume 0.5 Cr minimum per remaining slot
  const minReserve = Math.max(reserveNeeded, slotsRemaining * costPerRemainingSlot);
  const spendableBudget = Math.max(0, bot.budgetRemaining - minReserve);
  const maxSpendable = spendableBudget * strategy.maxSingleSpendRatio;

  // 8. Strategy valuation multiplier
  const stratMult = strategy.valuationMultiplier;

  // 9. Unpredictable random swing (only for KKR/unpredictable strategy)
  const randomSwing = bot.franchiseInfo?.strategy === 'unpredictable'
    ? (0.5 + Math.random() * 1.2)  // 0.5x to 1.7x random
    : (0.85 + Math.random() * 0.35); // 0.85x to 1.20x for all others

  // Combine all factors
  let maxVal = baseMarketValue
    * rolePriorityMult
    * needMult
    * affinityMult
    * expMult
    * Math.max(0.5, futurePlanningDiscount)
    * stratMult
    * randomSwing;

  // Hard cap: cannot exceed spendable budget
  maxVal = Math.min(maxVal, maxSpendable);

  // Minimum: must be at least base price
  maxVal = Math.max(player.basePrice || 0.3, maxVal);

  return Number(maxVal.toFixed(2));
}

// ── BotEngine class ───────────────────────────────────────────────────────────
export class BotEngine {
  constructor(auctionId, getSyncedTime, defaultBudget = 120) {
    this.auctionId = auctionId;
    this.getSyncedTime = getSyncedTime;
    this.defaultBudget = defaultBudget;
    this.bots = {};
    this.pendingBid = {};
    this.destroyed = false;
    this._valuations = {};   // cache: `${teamId}_${playerId}` → maxVal
    this._fightChance = {};  // cache: `${teamId}_${playerId}` → fightChance
    this._playerOrder = [];  // full auction order for future planning
    this._currentOrderIdx = 0;
  }

  setPlayerOrder(order) {
    this._playerOrder = order || [];
  }

  registerBots(roomTeams, allTeamIds) {
    const occupiedTeamIds = new Set(
      (roomTeams || []).map(rt => rt.teamId).filter(Boolean)
    );
    allTeamIds.forEach(teamId => {
      if (!occupiedTeamIds.has(teamId) && !this.bots[teamId]) {
        const franchiseInfo = FRANCHISE_OWNERS[teamId] || {
          ownerName: `${teamId} Owner`,
          strategy: 'balanced',
          avatar: '🤖',
          rolePriority: { Batsman: 7, Bowler: 7, 'All-Rounder': 7, 'Wicket-Keeper': 7 },
          preferExperience: false,
          budgetStyle: 'balanced',
        };
        const stratCfg = STRATEGY[franchiseInfo.strategy] || STRATEGY.balanced;
        this.bots[teamId] = {
          teamId,
          ownerName: franchiseInfo.ownerName,
          avatar: franchiseInfo.avatar,
          franchiseInfo,
          stratCfg,
          budgetRemaining: this.defaultBudget,
          squad: [],
          uid: `bot_${teamId}`,
        };
      }
    });
  }

  syncBotState(teamsData) {
    if (!teamsData) return;
    Object.values(teamsData).forEach(t => {
      const bot = this.bots[t.teamId];
      if (bot) {
        bot.budgetRemaining = t.budgetRemaining ?? this.defaultBudget;
        bot.squad = t.squad || [];
      }
    });
  }

  onLiveState(liveState, settings) {
    if (this.destroyed || !liveState) return;

    if (liveState.status !== 'bidding') {
      Object.keys(this.pendingBid).forEach(tid => {
        clearTimeout(this.pendingBid[tid]);
        delete this.pendingBid[tid];
      });
      return;
    }

    const currentBid = liveState.currentBid || 0;
    const highBidderId = liveState.highBidderId || '';
    const playerId = liveState.playerId;
    const timerEndsAt = liveState.timerEndsAt || 0;
    const player = IPL_PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    // Update current order index from the live state if available
    if (typeof liveState.playerOrderIndex === 'number') {
      this._currentOrderIdx = liveState.playerOrderIndex;
    }

    Object.values(this.bots).forEach(bot => {
      if (this.destroyed) return;
      if (this.pendingBid[bot.teamId]) return;
      if (highBidderId === bot.uid) return;

      const stratCfg = bot.stratCfg;
      const squadAnalysis = analyseSquad(bot.squad);

      // Calculate max valuation ONCE per player per bot (cached)
      const valKey = `${bot.teamId}_${playerId}`;
      if (this._valuations[valKey] === undefined) {
        this._valuations[valKey] = calculateMaxValuation(
          bot, player, bot.franchiseInfo, stratCfg,
          squadAnalysis, this._playerOrder, this._currentOrderIdx,
          this.defaultBudget
        );
        // Fight chance — how persistently this bot pursues this player
        // High-affinity or high-need → higher fight chance
        const roleCount = squadAnalysis.counts[player.role] || 0;
        const needBonus = roleCount === 0 ? 0.2 : roleCount === 1 ? 0.1 : 0;
        const affinityBonus = bot.franchiseInfo?.playerAffinities?.includes(playerId) ? 0.15 : 0;
        this._fightChance[valKey] = Math.min(0.95,
          stratCfg.fightBaseChance + needBonus + affinityBonus + (Math.random() * 0.15 - 0.07)
        );
      }

      const maxVal = this._valuations[valKey];
      const fightChance = this._fightChance[valKey];

      // Next bid amount
      const inc = currentBid < 5 ? 0.20 : 0.25;
      const nextBid = currentBid === 0 ? (player.basePrice || 0.3) : currentBid + inc;

      // Exit if beyond max valuation
      if (nextBid > maxVal) return;

      // Budget check
      const slotsLeft = Math.max(1, 25 - squadAnalysis.totalPlayers - 1);
      const minReserve = slotsLeft * 0.3; // at least 0.3 Cr per remaining slot
      if (nextBid > bot.budgetRemaining - minReserve) return;

      // Bid probability — based on strategy + how much they want this player
      const interestRatio = Math.min(1, maxVal > 0 ? (maxVal - nextBid) / maxVal : 0.5);
      const bidProb = stratCfg.bidProbabilityBase * (0.5 + interestRatio * 0.8);
      if (Math.random() > bidProb) return;

      // Fight chance — might back off even within valuation
      if (currentBid > 0 && Math.random() > fightChance) return;

      // Think time — more urgent bids when near time limit
      const timeLeft = timerEndsAt - this.getSyncedTime();
      const thinkTime = Math.min(
        stratCfg.thinkMin + Math.random() * (stratCfg.thinkMax - stratCfg.thinkMin),
        timeLeft - 1800
      );
      if (thinkTime < 400) return;

      this.pendingBid[bot.teamId] = setTimeout(() => {
        delete this.pendingBid[bot.teamId];
        if (!this.destroyed) this._executeBid(bot, nextBid, settings, player);
      }, thinkTime);
    });
  }

  async _executeBid(bot, amount, settings, player) {
    if (this.destroyed) return;
    try {
      const liveRef = ref(rtdb, `auctions/${this.auctionId}/live`);
      let finalAmount = amount;
      let aborted = false;

      await runTransaction(liveRef, (currentData) => {
        if (!currentData || currentData.status !== 'bidding') { aborted = true; return; }
        if (currentData.highBidderId === bot.uid) { aborted = true; return; }

        const cBid = currentData.currentBid || 0;
        const inc = cBid < 5 ? 0.20 : 0.25;
        const nBid = cBid === 0 ? (player?.basePrice || 0.3) : cBid + inc;

        const valKey = `${bot.teamId}_${currentData.playerId}`;
        const cachedMax = this._valuations[valKey];
        if (cachedMax !== undefined && nBid > cachedMax) { aborted = true; return; }
        if (nBid > bot.budgetRemaining) { aborted = true; return; }

        finalAmount = Number(nBid.toFixed(2));
        currentData.currentBid = finalAmount;
        currentData.highBidderId = bot.uid;
        currentData.highBidderName = bot.ownerName;
        currentData.highBidderTeamId = bot.teamId;
        currentData.timerEndsAt = this.getSyncedTime() + (settings?.bidTimer || 10) * 1000;
        return currentData;
      });

      if (aborted) return;

      await push(ref(rtdb, `auctions/${this.auctionId}/messages`), {
        userId: 'system',
        userName: 'System',
        text: `₹${finalAmount.toFixed(2)} Cr — ${bot.ownerName} ${bot.avatar} (${bot.teamId})`,
        type: 'log',
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('Bot bid error (non-critical):', e?.message);
    }
  }

  destroy() {
    this.destroyed = true;
    Object.keys(this.pendingBid).forEach(tid => clearTimeout(this.pendingBid[tid]));
    this.pendingBid = {};
    this._valuations = {};
    this._fightChance = {};
  }
}
