/**
 * LoL Draft Assistant - Enhanced Recommendation Engine
 * 
 * 対面カウンター、チーム構成シナジー（コンボ）、物理/魔法（AD/AP）ダメージ比率、
 * およびプレイヤーの熟練度を総合的にスコアリングして提案します。
 * カスタム戦（相手プールあり）とフルパランク戦（相手プール不明・メタ依存）の双方に対応。
 */

const DraftEngine = {
  /**
   * BAN推奨チャンピオンを算出します。
   * 
   * @param {Object} draftState - 現在のドラフト状況（bans, picks, draftMode）
   * @param {Array} opponentPlayers - 相手チームのプレイヤー情報（カスタム戦用）
   * @param {Object} database - カウンター・シナジー・メタデータのデータベース
   * @returns {Array} 推奨BANリスト（スコア順）
   */
  getBanRecommendations(draftState, opponentPlayers, database) {
    const allBannedAndPicked = new Set([
      ...draftState.blueBans,
      ...draftState.redBans,
      ...draftState.bluePicks,
      ...draftState.redPicks
    ]);

    const allyPicks = draftState.activeTeam === 'blue' ? draftState.bluePicks : draftState.redPicks;
    const banCandidates = {};

    // 1. フルパランクモード（相手プール不明）の場合
    if (draftState.draftMode === 'ranked') {
      // データベースからメタチャンピオン(高BAN率キャラ)を抽出
      const meta = database.metaChampions || {
        "TOP": [], "JUNGLE": [], "MIDDLE": [], "BOTTOM": [], "UTILITY": []
      };

      Object.entries(meta).forEach(([role, champList]) => {
        champList.forEach((champId, index) => {
          if (allBannedAndPicked.has(champId)) return;

          if (!banCandidates[champId]) {
            banCandidates[champId] = {
              champId: champId,
              score: 80 - (index * 8), // リスト順位に応じて重みづけ
              badges: [{
                type: 'mastery',
                text: `現在メタの強キャラ（${role}枠）`
              }],
              role: role
            };
          }
        });
      });

      // 味方のピックに対する敵のカウンターになるメタキャラをBAN加点
      Object.values(banCandidates).forEach(candidate => {
        let counterWeight = 0;
        allyPicks.forEach(allyChamp => {
          if (database.counters[allyChamp] && database.counters[allyChamp].includes(candidate.champId)) {
            counterWeight += 20;
            candidate.badges.push({
              type: 'counter',
              text: `味方の ${allyChamp} のメタカウンター`
            });
          }
        });
        candidate.score += counterWeight;
      });

      return Object.values(banCandidates).sort((a, b) => b.score - a.score);
    }

    // 2. カスタム戦（相手プールあり）の場合
    opponentPlayers.forEach(player => {
      if (!player.pool || !Array.isArray(player.pool)) return;

      player.pool.forEach(item => {
        const champId = item.champId;
        if (!champId || allBannedAndPicked.has(champId)) return;

        const winRate = parseFloat(item.winRate) || 50.0;
        const mastery = parseInt(item.mastery) || 3;

        if (!banCandidates[champId]) {
          banCandidates[champId] = {
            champId: champId,
            baseScore: 0,
            badges: [],
            players: []
          };
        }

        const playerScore = (winRate * 0.7) + (mastery * 6);
        banCandidates[champId].baseScore += playerScore;
        banCandidates[champId].players.push({
          name: player.name || '相手選手',
          role: player.role,
          winRate: winRate,
          mastery: mastery
        });
      });
    });

    const result = Object.values(banCandidates).map(candidate => {
      let finalScore = candidate.baseScore / Math.max(candidate.players.length, 1);
      if (candidate.players.length > 1) {
        finalScore += (candidate.players.length - 1) * 15;
      }

      const badges = [];
      const primaryPlayer = candidate.players.sort((a, b) => (b.winRate * 0.7 + b.mastery * 6) - (a.winRate * 0.7 + a.mastery * 6))[0];
      
      badges.push({
        type: 'mastery',
        text: `${primaryPlayer.name}の得意キャラ (勝率${primaryPlayer.winRate}%, 熟練度★${primaryPlayer.mastery})`
      });

      if (candidate.players.length > 1) {
        badges.push({
          type: 'synergy',
          text: `相手チームの複数名(${candidate.players.length}人)のプール`
        });
      }

      let counterWeight = 0;
      allyPicks.forEach(allyChamp => {
        if (database.counters[allyChamp] && database.counters[allyChamp].includes(candidate.champId)) {
          counterWeight += 25;
          badges.push({
            type: 'counter',
            text: `味方の ${allyChamp} に対する強力なカウンター`
          });
        }
      });
      candidate.score = Math.round(finalScore + counterWeight);
      candidate.badges = badges;
      candidate.role = primaryPlayer.role;

      return candidate;
    });

    return result.sort((a, b) => b.score - a.score);
  },

  /**
   * Pick推奨チャンピオンを算出します。
   * 
   * @param {Object} draftState - 現在のドラフト状況（bans, picks, draftMode）
   * @param {Object} currentPlayer - 今回ピックするプレイヤー情報
   * @param {Array} allyPlayers - 味方チーム全員の情報
   * @param {Array} opponentPlayers - 相手チーム全員の情報
   * @param {Object} database - カウンター・シナジーのデータベース
   * @returns {Array} 推奨Pickリスト（スコア順）
   */
  getPickRecommendations(draftState, currentPlayer, allyPlayers, opponentPlayers, database) {
    if (!currentPlayer || !currentPlayer.pool || !Array.isArray(currentPlayer.pool)) {
      return [];
    }

    const allyPicks = draftState.activeTeam === 'blue' ? draftState.bluePicks.filter(Boolean) : draftState.redPicks.filter(Boolean);
    const enemyPicks = draftState.activeTeam === 'blue' ? draftState.redPicks.filter(Boolean) : draftState.bluePicks.filter(Boolean);

    const allBannedAndPicked = new Set([
      ...draftState.blueBans,
      ...draftState.redBans,
      ...draftState.bluePicks,
      ...draftState.redPicks
    ]);

    // 1. 味方チームのダメージタイプ (AD / AP) の集計
    let allyADCount = 0;
    let allyAPCount = 0;
    allyPicks.forEach(champId => {
      const details = database.champDetails[champId];
      if (details) {
        if (details.damageType === "AD") allyADCount++;
        if (details.damageType === "AP") allyAPCount++;
      }
    });

    // 2. 味方チームの構成タグ（WombCombo, Shield, Poke, Dive）の集計
    let allyTags = {
      WombCombo: 0,
      Shield: 0,
      Poke: 0,
      Dive: 0
    };
    allyPicks.forEach(champId => {
      const details = database.champDetails[champId];
      if (details && details.tags) {
        details.tags.forEach(tag => {
          if (allyTags[tag] !== undefined) allyTags[tag]++;
        });
      }
    });

    // 3. 相手のピックしている対面レーナーの特定 (カスタム/ランク共通で実際の敵ピックから特定)
    let laneOpponentChampId = null;
    const opponentPicksState = draftState.activeTeam === 'blue' ? draftState.redPicks : draftState.bluePicks;
    opponentPlayers.forEach((oppPlayer, idx) => {
      if (oppPlayer.role === currentPlayer.role) {
        laneOpponentChampId = opponentPicksState[idx];
      }
    });

    const recommendations = [];

    currentPlayer.pool.forEach(item => {
      const champId = item.champId;
      if (!champId || allBannedAndPicked.has(champId)) return;

      const winRate = parseFloat(item.winRate) || 50.0;
      const mastery = parseInt(item.mastery) || 3;
      const details = database.champDetails[champId] || { damageType: "AD", tags: [] };

      // A. ベーススコア（プレイヤー本人の勝率・熟練度）
      let score = (winRate * 0.5) + (mastery * 4);
      const badges = [];

      badges.push({
        type: 'mastery',
        text: `本人の得意キャラ (勝率${winRate}%, 熟練度★${mastery})`
      });

      // B. レーン対面カウンター判定 (対面がすでにピックされている時のみ)
      if (laneOpponentChampId) {
        if (database.counters[laneOpponentChampId] && database.counters[laneOpponentChampId].includes(champId)) {
          score += 45;
          badges.push({
            type: 'counter',
            text: `対面 ${laneOpponentChampId} への強力なカウンター ⚔️`
          });
        }
      }

      // 一般的なカウンター判定
      let enemyCounterCount = 0;
      enemyPicks.forEach(enemyChamp => {
        if (enemyChamp !== laneOpponentChampId) {
          if (database.counters[enemyChamp] && database.counters[enemyChamp].includes(champId)) {
            enemyCounterCount++;
          }
        }
      });
      if (enemyCounterCount > 0) {
        score += enemyCounterCount * 15;
        badges.push({
          type: 'counter',
          text: `敵のピックに対して有利 (${enemyCounterCount}体へのカウンター)`
        });
      }

      // C. チーム構成シナジー（Womb Combo, Protect ADC, Poke, Dive）
      let synergyAdded = false;

      if (details.tags.includes("WombCombo") && allyTags.WombCombo > 0) {
        score += 25;
        synergyAdded = true;
        badges.push({
          type: 'synergy',
          text: `味方の集団戦・CCコンボ（Womb Combo）構成と高シナジー 🔗`
        });
      }

      const hasHyperCarryAlly = allyPicks.some(c => database.champDetails[c] && database.champDetails[c].tags.includes("HyperCarry"));
      if (details.tags.includes("Shield") && hasHyperCarryAlly) {
        score += 25;
        synergyAdded = true;
        badges.push({
          type: 'synergy',
          text: `味方キャリーを守るプロテクト構成に最適 🛡️`
        });
      } else if (details.tags.includes("HyperCarry") && allyTags.Shield > 0) {
        score += 25;
        synergyAdded = true;
        badges.push({
          type: 'synergy',
          text: `味方のサポート・ピール構成で輝くハイパーキャリー 🏹`
        });
      }

      if (details.tags.includes("Poke") && allyTags.Poke >= 1) {
        score += 20;
        synergyAdded = true;
        badges.push({
          type: 'synergy',
          text: `味方のポーク・遠距離削り構成を強化 🎯`
        });
      }

      if (details.tags.includes("Dive") && allyTags.Dive >= 1) {
        score += 20;
        synergyAdded = true;
        badges.push({
          type: 'synergy',
          text: `味方のダイブ・突撃構成にマッチ ⚔️`
        });
      }

      let directSynergyCount = 0;
      allyPicks.forEach(allyChamp => {
        const hasDirectSynergy = 
          (database.synergies[allyChamp] && database.synergies[allyChamp].includes(champId)) ||
          (database.synergies[champId] && database.synergies[champId].includes(allyChamp));

        if (hasDirectSynergy && !synergyAdded) {
          directSynergyCount++;
        }
      });
      if (directSynergyCount > 0) {
        score += directSynergyCount * 20;
        badges.push({
          type: 'synergy',
          text: `味方の特定ピックと強力なシナジーあり`
        });
      }

      // D. ダメージ属性（AD/AP比率）の調整
      if (allyPicks.length >= 2) {
        if (allyADCount >= 2 && allyAPCount === 0 && details.damageType === "AP") {
          score += 35;
          badges.push({
            type: 'damage',
            text: `APダメージ補強：物理偏りを防ぐ魔法枠 🔮`
          });
        }
        else if (allyAPCount >= 2 && allyADCount === 0 && details.damageType === "AD") {
          score += 35;
          badges.push({
            type: 'damage',
            text: `ADダメージ補強：魔法偏りを防ぐ物理枠 ⚡`
          });
        }
      }

      recommendations.push({
        champId: champId,
        score: Math.round(score),
        badges: badges,
        playerRole: currentPlayer.role
      });
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }
};

if (typeof module !== 'undefined') {
  module.exports = { DraftEngine };
}
