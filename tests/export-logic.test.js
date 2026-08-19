'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LeagueExport = require('../export-logic.js');

function task(id, points, overrides = {}) {
  const tiers = { 10: 'Easy', 30: 'Medium', 80: 'Hard', 200: 'Elite', 400: 'Master' };
  return {
    id,
    region: 'global',
    tier: tiers[points],
    points,
    task: `Task ${id}`,
    info: `Info ${id}`,
    requirements_text: `Requirements ${id}`,
    skill_requirements: [],
    completion_pct: 10,
    blessing_task: false,
    ...overrides
  };
}

function build(tasks, overrides = {}) {
  return LeagueExport.buildPlanningData({
    tasks,
    selectedRegions: ['global'],
    completedTaskIds: [],
    levels: { Smithing: 50, Cooking: 50, Fletching: 50 },
    currentPoints: 5900,
    nextRelicPoints: 6000,
    ...overrides
  });
}

test('filters completed and unselected tasks before every remaining-task section', () => {
  const data = build([
    task(1, 10),
    task(2, 30),
    task(3, 80, { region: 'desert' }),
    task(4, 200, { task: 'Smith 100 rune bars', skill_requirements: [{ skill: 'Smithing', level: 40 }] })
  ], { completedTaskIds: [1] });
  const sections = [
    data.quick_win_remaining,
    data.high_completion_remaining,
    data.ranked_quick_wins,
    data.near_relic_target.ranked_route_with_backups,
    data.production_master_defer_candidates
  ];
  for (const section of sections) assert.equal(section.some(entry => entry.id === 1 || entry.id === 3), false);
  assert.deepEqual(data.remaining_by_points['10'], { task_count: 0, total_points: 0 });
});

test('quick-win sorting follows completion, points, readiness, total gap, then ID', () => {
  const data = build([
    task(1, 80, { completion_pct: 40, skill_requirements: [{ skill: 'Smithing', level: 60 }] }),
    task(2, 30, { completion_pct: 50 }),
    task(3, 80, { completion_pct: 50, skill_requirements: [{ skill: 'Smithing', level: 55 }] }),
    task(4, 80, { completion_pct: 50 }),
    task(5, 80, { completion_pct: null })
  ]);
  assert.deepEqual(data.quick_win_remaining.map(entry => entry.id), [4, 3, 2, 1, 5]);
  assert.deepEqual(data.high_completion_remaining.map(entry => entry.id), [2, 3, 4, 1, 5]);
});

test('score is transparent and numeric skill readiness is vacuously true without requirements', () => {
  const readyBlessing = LeagueExport.enrichTask(task(1, 80, { completion_pct: 20, blessing_task: true }), {});
  const gapTask = LeagueExport.enrichTask(task(2, 30, {
    completion_pct: null,
    skill_requirements: [{ skill: 'Smithing', level: 70 }, { skill: 'Cooking', level: 60 }]
  }), { Smithing: 50, Cooking: 50 });
  assert.equal(readyBlessing.skill_ready, true);
  assert.equal(LeagueExport.quickWinScore(readyBlessing), 46);
  assert.equal(gapTask.total_skill_gap, 30);
  assert.equal(LeagueExport.quickWinScore(gapTask), -12);
});

test('point buckets count all tiers and skill-ready tasks separately', () => {
  const data = build([
    task(1, 10),
    task(2, 10, { skill_requirements: [{ skill: 'Smithing', level: 60 }] }),
    task(3, 30), task(4, 80), task(5, 200), task(6, 400)
  ]);
  assert.deepEqual(data.remaining_by_points['10'], { task_count: 2, total_points: 20 });
  assert.deepEqual(data.skill_ready_by_points['10'], { task_count: 1, total_points: 10 });
  assert.deepEqual(data.remaining_by_points['400'], { task_count: 1, total_points: 400 });
});

test('relic route reaches the 125 percent backup target when candidates permit', () => {
  const data = build([task(1, 80), task(2, 30), task(3, 30), task(4, 10)]);
  const target = data.near_relic_target;
  assert.equal(target.points_required, 100);
  assert.equal(target.backup_points_target, 125);
  assert.equal(target.route_available_points, 140);
  assert.equal(target.target_reached, true);
  assert.equal(target.backup_target_reached, true);
  assert.equal(target.ranked_route_with_backups.at(-1).cumulative_points, 140);
});

test('relic route reports already reached and insufficient candidate states honestly', () => {
  const reached = build([task(1, 10)], { currentPoints: 6000 }).near_relic_target;
  assert.equal(reached.points_required, 0);
  assert.equal(reached.ranked_route_with_backups.length, 0);
  assert.equal(reached.target_reached, true);
  assert.equal(reached.backup_target_reached, true);

  const insufficient = build([task(1, 30)], { currentPoints: 5800 }).near_relic_target;
  assert.equal(insufficient.route_available_points, 30);
  assert.equal(insufficient.target_reached, false);
  assert.equal(insufficient.backup_target_reached, false);
});

test('Production Master candidates require explicit bulk production language', () => {
  const data = build([
    task(1, 200, { task: 'Smith 100 rune platebodies', skill_requirements: [{ skill: 'Smithing', level: 50 }] }),
    task(2, 80, { task: 'Cook several sharks', skill_requirements: [{ skill: 'Cooking', level: 45 }] }),
    task(3, 30, { task: 'Talk to the smith', skill_requirements: [{ skill: 'Smithing', level: 50 }] }),
    task(4, 30, { task: 'Smith a sword', skill_requirements: [{ skill: 'Smithing', level: 50 }] }),
    task(5, 400, { task: 'Smith 100 masterwork pieces', skill_requirements: [{ skill: 'Smithing', level: 99 }] }),
    task(6, 80, { task: 'Craft 100 nature runes', skill_requirements: [{ skill: 'Runecrafting', level: 44 }] })
  ]);
  assert.deepEqual(data.production_master_defer_candidates.map(entry => entry.id).sort(), [1, 2, 6]);
  assert.match(data.production_master_defer_candidates[0].reason, /Production Master/);
  assert.match(data.production_master_defer_candidates.find(entry => entry.id === 6).reason, /runecrafting/);
});

test('exported task views preserve prerequisite context', () => {
  const data = build([task(1, 10, { info: 'Buy this item', requirements_text: 'Requires access to an area' })]);
  const exported = data.ranked_quick_wins[0];
  assert.equal(exported.info, 'Buy this item');
  assert.equal(exported.requirements_text, 'Requires access to an area');
  assert.equal(exported.skill_ready, true);
});
