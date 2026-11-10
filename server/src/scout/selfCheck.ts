import assert from 'node:assert/strict';
import { experienceScore, listSizeForExperience, profileQuality, qualityFloor, scoutCycle } from './algorithm.js';
import { overlapWindows } from './planner.js';
import { searchProfessions } from './professions.js';

assert.equal(experienceScore(0), 0);
assert.equal(experienceScore(12), 96);
assert.equal(experienceScore(20), 100);
assert.equal(listSizeForExperience(10), 3);
assert.equal(listSizeForExperience(30), 5);
assert.equal(listSizeForExperience(50), 8);
assert.equal(listSizeForExperience(70), 12);
assert.equal(listSizeForExperience(90), 18);
assert.equal(qualityFloor(0), 20);
assert.equal(qualityFloor(100), 70);
assert.ok(profileQuality(2, false, false) < qualityFloor(80));

const picked = scoutCycle(
  [
    { item: 'low', quality: 15 },
    { item: 'mid', quality: 45 },
    { item: 'high', quality: 90 },
  ],
  10,
  80
);
assert.deepEqual(picked, ['high']);

const open = overlapWindows(
  [{ id: 'a', start: '2026-12-01T10:00:00.000Z', end: '2026-12-01T14:00:00.000Z', label: 'Train' }],
  [{ id: 'b', start: '2026-12-01T12:00:00.000Z', end: '2026-12-01T16:00:00.000Z', label: 'Train' }]
);
assert.equal(open.length, 1);
assert.equal(open[0].start, '2026-12-01T12:00:00.000Z');
assert.ok(searchProfessions('foot').some((item) => item.id === 'footballer'));
assert.ok(searchProfessions('judge').some((item) => item.id === 'judge'));

console.log('scout checks ok');
