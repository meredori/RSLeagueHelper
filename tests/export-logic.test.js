'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LeagueExport = require('../export-logic.js');

function task(id, region = 'global', overrides = {}) {
  return {
    id,
    region,
    tier: 'Easy',
    points: 10,
    task: `Task ${id}`,
    info: `Info ${id}`,
    requirements_text: `Requirements ${id}`,
    skill_requirements: [],
    completion_pct: 25,
    blessing_task: false,
    ...overrides
  };
}

function character(overrides = {}) {
  return { username: 'Player', league_tasks: [], levels: { Attack: 50 }, ...overrides };
}

function build(tasks, overrides = {}) {
  return LeagueExport.buildExport({
    tasks,
    character: character(),
    regions: ['global', 'misthalin'],
    relicSelections: {},
    blessingSelections: {},
    taskDatabase: { refreshed_at: '2026-08-21T00:00:00.000Z' },
    ...overrides
  });
}

test('validates the required character JSON shape', () => {
  assert.equal(LeagueExport.validateCharacter(null), 'Character JSON must be an object.');
  assert.equal(LeagueExport.validateCharacter({ league_tasks: {}, levels: {} }), 'Expected league_tasks to be an array.');
  assert.equal(LeagueExport.validateCharacter({ league_tasks: [], levels: [] }), 'Expected levels to be an object.');
  assert.equal(LeagueExport.validateCharacter(character()), null);
});

test('exports only incomplete tasks from Global and selected regions', () => {
  const result = build([
    task(1),
    task(2, 'global'),
    task(3, 'misthalin'),
    task(4, 'desert')
  ], { character: character({ league_tasks: [1] }) });

  assert.deepEqual(result.selected_regions, ['global', 'misthalin']);
  assert.deepEqual(result.incomplete_tasks.map(entry => entry.id), [2, 3]);
  assert.deepEqual(result.derived, { completed_task_count: 1, league_points: 10, incomplete_task_count: 2 });
});

test('Global is always included and duplicate region choices are removed', () => {
  assert.deepEqual(LeagueExport.normaliseRegions(['misthalin', 'global', 'misthalin']), ['global', 'misthalin']);
  const result = build([task(1), task(2, 'misthalin')], { regions: [] });
  assert.deepEqual(result.incomplete_tasks.map(entry => entry.id), [1]);
});

test('exports every eligible task without truncation', () => {
  const tasks = Array.from({ length: 750 }, (_, index) => task(index + 1));
  const result = build(tasks);
  assert.equal(result.incomplete_tasks.length, 750);
  assert.equal(result.incomplete_tasks.at(-1).id, 750);
});

test('preserves the exact character object and all task prerequisite fields', () => {
  const sourceCharacter = character({ custom_field: { keep: true }, timestamp: 'now' });
  const result = build([task(7, 'global', {
    tier: 'Elite',
    points: 200,
    info: 'Bring an item',
    requirements_text: 'Requires access',
    skill_requirements: [{ skill: 'Magic', level: 80 }],
    completion_pct: null,
    blessing_task: true
  })], { character: sourceCharacter });

  assert.strictEqual(result.character, sourceCharacter);
  assert.deepEqual(result.incomplete_tasks[0], {
    id: 7,
    region: 'global',
    tier: 'Elite',
    points: 200,
    task: 'Task 7',
    info: 'Bring an item',
    requirements_text: 'Requires access',
    skill_requirements: [{ skill: 'Magic', level: 80 }],
    completion_pct: null,
    blessing_task: true
  });
});

test('includes every relic and blessing tier with breakpoints and selected choices', () => {
  const result = build([], {
    relicSelections: { 'Tier 1': 'Endless Harvest', 'Tier 6': 'Not a relic' },
    blessingSelections: { 'God Tier 1': "Demon's Mark" }
  });

  assert.equal(result.relics.length, 7);
  assert.deepEqual(result.relics[0], { tier: 'Tier 1', breakpoint_points: 10, choice: 'Endless Harvest' });
  assert.equal(result.relics.find(entry => entry.tier === 'Tier 6').choice, null);
  assert.equal(result.relics.at(-1).breakpoint_points, 20000);
  assert.equal(result.blessings.length, 8);
  assert.deepEqual(result.blessings.find(entry => entry.tier === 'God Tier 1'), {
    tier: 'God Tier 1', breakpoint_tasks: 9, choice: "Demon's Mark"
  });
  assert.equal(result.blessings.at(-1).breakpoint_tasks, 26);
});

test('migrates valid legacy regions, relics, blessing text, and character JSON', () => {
  const migrated = LeagueExport.migrateState({
    regions: ['global', 'tirannwn'],
    relics: { 'Tier 1': 'Endless Harvest', 'Tier 2': 'Made Up' },
    blessings: "Tier 1: Big Boned\nGod Tier 2: Genesis Essence\nSomething unknown",
    charjson: '{"league_tasks":[],"levels":{}}'
  });

  assert.deepEqual(migrated.regions, ['global', 'tirannwn']);
  assert.deepEqual(migrated.relics, { 'Tier 1': 'Endless Harvest' });
  assert.deepEqual(migrated.blessings, { 'Tier 1': 'Big Boned', 'God Tier 2': 'Genesis Essence' });
  assert.equal(migrated.charjson, '{"league_tasks":[],"levels":{}}');
});

test('clipboard output is deterministic prompt plus structured JSON', () => {
  const result = build([task(1)]);
  const first = LeagueExport.buildClipboardText(result);
  const second = LeagueExport.buildClipboardText(result);
  assert.equal(first, second);
  const [prompt, json] = first.split('\n\n');
  assert.match(prompt, /Recommend only from incomplete_tasks/);
  assert.deepEqual(JSON.parse(json), result);
});
