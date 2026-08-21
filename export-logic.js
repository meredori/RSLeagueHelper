(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LeagueExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 4;
  const POINTS = { Easy: 10, Medium: 30, Hard: 80, Elite: 200, Master: 400 };

  const RELIC_TIERS = [
    { tier: 'Tier 1', breakpoint_points: 10, choices: ['Endless Harvest', 'Golden Touch', 'Survivalist'] },
    { tier: 'Tier 2', breakpoint_points: 750, choices: ['Animal Wrangler', 'Superheated', 'Divine Druid'] },
    { tier: 'Tier 3', breakpoint_points: 1750, choices: ["Nature's Network", "Assassin's Insight", 'Voidwalker'] },
    { tier: 'Tier 4', breakpoint_points: 3500, choices: ['Crystal Grace', 'Transmutation', 'Antiquarian'] },
    { tier: 'Tier 5', breakpoint_points: 6000, choices: ['Clue Connoisseur', 'Production Master', 'Devout'] },
    { tier: 'Tier 6', breakpoint_points: 12000, choices: ['Perkfection', 'Rejuvenated'] },
    { tier: 'Tier 7', breakpoint_points: 20000, choices: ['Infernal Fire', 'Naragi Edict', 'Icyenic Faith'] }
  ];

  const BLESSING_TIERS = [
    { tier: 'Tier 1', breakpoint_tasks: 1, choices: ['Adrenaline Junkie', 'Big Boned', "Teragard's Aegis"] },
    { tier: 'Tier 2', breakpoint_tasks: 3, choices: ['Abyssal Cinders', 'Barkscales', 'Striking Light'] },
    { tier: 'Tier 3', breakpoint_tasks: 5, choices: ['Avernic Rampage', 'Eternal Sustenance', 'Steadfast Will'] },
    { tier: 'God Tier 1', breakpoint_tasks: 9, choices: ["Demon's Mark", 'Splash Zone', 'Sacred Fervor'] },
    { tier: 'Tier 4', breakpoint_tasks: 12, choices: ['Havoc Born', 'True Equilibrium', 'Higher Power'] },
    { tier: 'Tier 5', breakpoint_tasks: 16, choices: ['Unholy Critual', 'Tearing Thorns', 'Lord of Light'] },
    { tier: 'Tier 6', breakpoint_tasks: 20, choices: ['Perfidious', 'Envenomed', 'Tempered Heart'] },
    { tier: 'God Tier 2', breakpoint_tasks: 26, choices: ['Chaotic Insight', 'Power Archive', 'Genesis Essence'] }
  ];

  function validateCharacter(character) {
    if (!character || typeof character !== 'object' || Array.isArray(character)) return 'Character JSON must be an object.';
    if (!Array.isArray(character.league_tasks)) return 'Expected league_tasks to be an array.';
    if (!character.levels || typeof character.levels !== 'object' || Array.isArray(character.levels)) return 'Expected levels to be an object.';
    return null;
  }

  function normaliseRegions(regions) {
    return ['global', ...new Set((regions || []).filter(region => region && region !== 'global'))];
  }

  function completedIds(character) {
    return new Set(character.league_tasks.map(Number).filter(Number.isFinite));
  }

  function selectedIncompleteTasks(tasks, character, regions) {
    const allowed = new Set(normaliseRegions(regions));
    const completed = completedIds(character);
    return (tasks || []).filter(task => allowed.has(task.region) && !completed.has(Number(task.id)));
  }

  function calculateProgress(tasks, character) {
    const completed = completedIds(character);
    const matching = (tasks || []).filter(task => completed.has(Number(task.id)));
    return {
      completed_task_count: matching.length,
      league_points: matching.reduce((total, task) => total + (Number(task.points) || 0), 0)
    };
  }

  function taskView(task) {
    return {
      id: Number(task.id),
      region: task.region || '',
      tier: task.tier || '',
      points: Number(task.points) || 0,
      task: task.task || '',
      info: task.info || '',
      requirements_text: task.requirements_text || '',
      skill_requirements: Array.isArray(task.skill_requirements) ? task.skill_requirements : [],
      completion_pct: Number.isFinite(task.completion_pct) ? task.completion_pct : null,
      blessing_task: Boolean(task.blessing_task)
    };
  }

  function selectionsWithBreakpoints(tiers, selections, breakpointKey) {
    return tiers.map(definition => ({
      tier: definition.tier,
      [breakpointKey]: definition[breakpointKey],
      choice: definition.choices.includes(selections?.[definition.tier]) ? selections[definition.tier] : null
    }));
  }

  function buildExport({ tasks, character, regions, relicSelections, blessingSelections, taskDatabase }) {
    const error = validateCharacter(character);
    if (error) throw new TypeError(error);
    const selectedRegions = normaliseRegions(regions);
    const incomplete = selectedIncompleteTasks(tasks, character, selectedRegions).map(taskView);
    const progress = calculateProgress(tasks, character);
    return {
      schema_version: SCHEMA_VERSION,
      league: 'RuneScape 3 Leagues II: Equilibrium',
      task_database: {
        source: 'RuneScape Wiki Equilibrium League task page',
        task_count: (tasks || []).length,
        refreshed_at: taskDatabase?.refreshed_at || null
      },
      selected_regions: selectedRegions,
      relics: selectionsWithBreakpoints(RELIC_TIERS, relicSelections, 'breakpoint_points'),
      blessings: selectionsWithBreakpoints(BLESSING_TIERS, blessingSelections, 'breakpoint_tasks'),
      character,
      derived: { ...progress, incomplete_task_count: incomplete.length },
      incomplete_tasks: incomplete
    };
  }

  function buildClipboardText(exportData) {
    const prompt = 'Use this as the complete current context for my RS3 Equilibrium character. Recommend only from incomplete_tasks; do not recommend any task listed as completed in character.league_tasks.';
    return `${prompt}\n\n${JSON.stringify(exportData, null, 2)}`;
  }

  function validSelections(tiers, value) {
    const selections = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return selections;
    for (const definition of tiers) {
      if (definition.choices.includes(value[definition.tier])) selections[definition.tier] = value[definition.tier];
    }
    return selections;
  }

  function migrateState(state) {
    const source = state && typeof state === 'object' ? state : {};
    const relics = validSelections(RELIC_TIERS, source.relics);
    let blessings = validSelections(BLESSING_TIERS, source.blessing_selections || source.blessings);
    if (typeof source.blessings === 'string') {
      const legacy = source.blessings.toLowerCase();
      blessings = {};
      for (const definition of BLESSING_TIERS) {
        const match = definition.choices.find(choice => legacy.includes(choice.toLowerCase()));
        if (match) blessings[definition.tier] = match;
      }
    }
    return {
      schema_version: SCHEMA_VERSION,
      regions: normaliseRegions(Array.isArray(source.regions) ? source.regions : ['global', 'misthalin', 'havenhythe']),
      relics,
      blessings,
      charjson: typeof source.charjson === 'string' ? source.charjson : ''
    };
  }

  return {
    SCHEMA_VERSION,
    POINTS,
    RELIC_TIERS,
    BLESSING_TIERS,
    validateCharacter,
    normaliseRegions,
    selectedIncompleteTasks,
    calculateProgress,
    taskView,
    buildExport,
    buildClipboardText,
    migrateState
  };
});
