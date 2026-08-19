(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LeagueExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QUICK_POINTS = new Set([10, 30, 80]);
  const DEFER_POINTS = new Set([10, 30, 80, 200]);
  const POINT_BUCKETS = [10, 30, 80, 200, 400];
  const POINT_BONUS = { 10: 1, 30: 3, 80: 8 };
  const SCORE_DESCRIPTION = 'completion_pct (missing = 0) + point bonus (10 = 1, 30 = 3, 80 = 8) + 15 when explicit numeric skill requirements are met - min(30, 0.5 x total numeric skill gap) + 3 for a blessing task. Ranking aid only; it does not prove a task is easy or account for non-numeric prerequisites.';

  const PRODUCTION_DOMAINS = [
    { name: 'smithing', skills: ['smithing'], action: /\b(?:smith|smithing|forge)(?:ed|ing|s)?\b/i },
    { name: 'smelting', skills: ['smithing'], action: /\bsmelt(?:ed|ing|s)?\b/i },
    { name: 'fletching', skills: ['fletching'], action: /\b(?:fletch|fletching)(?:ed|ing|s)?\b|\b(?:make|create|craft)\b[^.]{0,60}\b(?:bows?|arrows?|bolts?|darts?)\b/i },
    { name: 'crafting', skills: ['crafting'], action: /\bcraft(?:ed|ing|s)?\b|\b(?:make|create)\b[^.]{0,60}\b(?:jewellery|jewelry|urns?|pots?|leather|glass|battlestaves|battlestaffs)\b/i },
    { name: 'cooking', skills: ['cooking'], action: /\b(?:cook|cooking|bake)(?:ed|ing|s)?\b/i },
    { name: 'herblore production', skills: ['herblore'], action: /\b(?:mix|make|create|brew)(?:ed|ing|s)?\b[^.]{0,60}\b(?:potions?|doses?)\b|\bherblore production\b/i },
    { name: 'runecrafting production', skills: ['runecrafting'], action: /\b(?:runecraft|runecrafting)(?:ed|ing|s)?\b|\bcraft(?:ed|ing|s)?\b[^.]{0,60}\brunes?\b/i }
  ];
  const PRODUCTION_SKILLS = new Set(PRODUCTION_DOMAINS.flatMap(domain => domain.skills));
  const BULK_TEXT = /\b(?:[2-9]\d*|[1-9][\d,]{2,})(?:\s+[a-z'-]+){0,3}\s+(?:bars?|items?|pieces?|sets?|platebodies|weapons?|armou?r|bows?|arrows?|bolts?|darts?|runes?|potions?|doses?|food|fish|sharks?|urns?|pots?|gems?|jewellery|jewelry)\b|\b(?:multiple|several|batch|all|each|every|various|different)\b|\bfull\s+(?:set|inventory)\b|\bsets\s+of\b/i;

  function numericCompletion(task) {
    return Number.isFinite(task.completion_pct) ? task.completion_pct : null;
  }

  function skillStatus(task, levels) {
    const requirements = Array.isArray(task.skill_requirements) ? task.skill_requirements : [];
    const gaps = requirements.map(requirement => {
      const current = Number(levels?.[requirement.skill]) || 0;
      const level = Number(requirement.level) || 0;
      return { ...requirement, current, gap: Math.max(0, level - current) };
    });
    return {
      gaps,
      skill_ready: gaps.every(gap => gap.gap === 0),
      total_skill_gap: gaps.reduce((total, gap) => total + gap.gap, 0),
      max_skill_gap: gaps.length ? Math.max(...gaps.map(gap => gap.gap)) : 0
    };
  }

  function enrichTask(task, levels) {
    return { ...task, completion_pct: numericCompletion(task), ...skillStatus(task, levels) };
  }

  function taskView(task, extras) {
    return {
      id: task.id,
      region: task.region,
      tier: task.tier,
      points: task.points,
      task: task.task,
      info: task.info || '',
      requirements_text: task.requirements_text || '',
      skill_requirements: Array.isArray(task.skill_requirements) ? task.skill_requirements : [],
      skill_ready: task.skill_ready,
      completion_pct: task.completion_pct,
      blessing_task: Boolean(task.blessing_task),
      ...(extras || {})
    };
  }

  function compareCompletion(a, b) {
    const aPct = a.completion_pct;
    const bPct = b.completion_pct;
    if (aPct === null && bPct !== null) return 1;
    if (aPct !== null && bPct === null) return -1;
    if (aPct !== bPct) return (bPct ?? -Infinity) - (aPct ?? -Infinity);
    return a.id - b.id;
  }

  function compareQuickWin(a, b) {
    const completionOrder = compareCompletion(a, b);
    if (a.completion_pct !== b.completion_pct) return completionOrder;
    return b.points - a.points || Number(b.skill_ready) - Number(a.skill_ready) || a.total_skill_gap - b.total_skill_gap || a.id - b.id;
  }

  function quickWinScore(task) {
    const completion = task.completion_pct ?? 0;
    const readyBonus = task.skill_ready ? 15 : 0;
    const gapPenalty = Math.min(30, task.total_skill_gap * 0.5);
    const blessingBonus = task.blessing_task ? 3 : 0;
    return Math.round((completion + (POINT_BONUS[task.points] || 0) + readyBonus - gapPenalty + blessingBonus) * 100) / 100;
  }

  function compareRankedQuickWin(a, b) {
    return b.quick_win_score - a.quick_win_score || compareQuickWin(a, b);
  }

  function pointBuckets(tasks) {
    const buckets = {};
    for (const points of POINT_BUCKETS) {
      const matching = tasks.filter(task => task.points === points);
      buckets[String(points)] = { task_count: matching.length, total_points: matching.length * points };
    }
    return buckets;
  }

  function productionReason(task) {
    if (!DEFER_POINTS.has(task.points)) return null;
    const descriptiveText = `${task.task || ''} ${task.info || ''}`;
    if (!BULK_TEXT.test(descriptiveText)) return null;
    const skillNames = new Set((task.skill_requirements || []).map(requirement => String(requirement.skill).toLowerCase()));
    const hasProductionSkillMetadata = [...skillNames].some(skill => PRODUCTION_SKILLS.has(skill));
    for (const domain of PRODUCTION_DOMAINS) {
      const skillMatches = domain.skills.some(skill => skillNames.has(skill));
      if (domain.action.test(descriptiveText) && (!hasProductionSkillMetadata || skillMatches)) {
        return `bulk ${domain.name} task; potentially faster after Production Master`;
      }
    }
    return null;
  }

  function buildNearRelicTarget(rankedTasks, currentPoints, nextRelicPoints) {
    const threshold = Number.isFinite(Number(nextRelicPoints)) ? Math.max(0, Math.trunc(Number(nextRelicPoints))) : 6000;
    const current = Number.isFinite(Number(currentPoints)) ? Math.max(0, Number(currentPoints)) : 0;
    const required = Math.max(0, threshold - current);
    const backupTarget = required === 0 ? 0 : Math.ceil(required * 1.25);
    const route = [];
    let cumulative = 0;
    for (const task of rankedTasks) {
      if (cumulative >= backupTarget) break;
      cumulative += task.points;
      route.push(taskView(task, { quick_win_score: task.quick_win_score, cumulative_points: cumulative }));
    }
    return {
      next_relic_points: threshold,
      current_league_points: current,
      points_required: required,
      ten_point_tasks_theoretically_required: required ? Math.ceil(required / 10) : 0,
      thirty_point_tasks_theoretically_required: required ? Math.ceil(required / 30) : 0,
      eighty_point_tasks_theoretically_required: required ? Math.ceil(required / 80) : 0,
      backup_points_target: backupTarget,
      route_available_points: cumulative,
      target_reached: cumulative >= required,
      backup_target_reached: cumulative >= backupTarget,
      route_note: 'Highest-ranked heuristic candidates with backups; not a claim of ease or an optimal route.',
      ranked_route_with_backups: route
    };
  }

  function buildPlanningData({ tasks, selectedRegions, completedTaskIds, levels, currentPoints, nextRelicPoints }) {
    const regions = new Set(selectedRegions || []);
    const completed = new Set((completedTaskIds || []).map(Number));
    const enrichedRemaining = (tasks || [])
      .filter(task => regions.has(task.region) && !completed.has(Number(task.id)))
      .map(task => enrichTask(task, levels || {}));

    const quickCandidates = enrichedRemaining.filter(task => QUICK_POINTS.has(task.points));
    const quickWinRemaining = [...quickCandidates].sort(compareQuickWin).slice(0, 100).map(task => taskView(task));
    const highCompletionRemaining = [...enrichedRemaining].sort(compareCompletion).slice(0, 50).map(task => taskView(task));
    const rankedAll = quickCandidates
      .map(task => ({ ...task, quick_win_score: quickWinScore(task) }))
      .sort(compareRankedQuickWin);
    const rankedQuickWins = rankedAll.slice(0, 50).map(task => taskView(task, { quick_win_score: task.quick_win_score }));
    const deferCandidates = enrichedRemaining
      .map(task => ({ task, reason: productionReason(task) }))
      .filter(candidate => candidate.reason)
      .sort((a, b) => compareRankedQuickWin(
        { ...a.task, quick_win_score: quickWinScore(a.task) },
        { ...b.task, quick_win_score: quickWinScore(b.task) }
      ))
      .map(candidate => taskView(candidate.task, { reason: candidate.reason }));

    return {
      enriched_remaining: enrichedRemaining,
      quick_win_scoring: SCORE_DESCRIPTION,
      quick_win_remaining: quickWinRemaining,
      high_completion_remaining: highCompletionRemaining,
      ranked_quick_wins: rankedQuickWins,
      remaining_by_points: pointBuckets(enrichedRemaining),
      skill_ready_by_points: pointBuckets(enrichedRemaining.filter(task => task.skill_ready)),
      near_relic_target: buildNearRelicTarget(rankedAll, currentPoints, nextRelicPoints),
      production_master_defer_candidates: deferCandidates
    };
  }

  return {
    SCORE_DESCRIPTION,
    skillStatus,
    enrichTask,
    taskView,
    compareCompletion,
    compareQuickWin,
    quickWinScore,
    pointBuckets,
    productionReason,
    buildNearRelicTarget,
    buildPlanningData
  };
});
