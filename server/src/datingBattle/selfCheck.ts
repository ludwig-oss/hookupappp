import assert from 'node:assert/strict';
import { promptCatalog, nextPrompt, SEED_PROMPTS } from './icebreakers.js';
import {
  agesAlign,
  isRarelyRejected,
  isTopTierAccount,
  isWorkingOnSelf,
  pairAllowed,
} from './matchMatrix.js';
import { polishFuture } from './polish.js';

function align(boy: number, girl: number, expected: boolean) {
  assert.equal(agesAlign(boy, girl), expected, `boy ${boy} / girl ${girl} expected ${expected}`);
}

align(18, 18, true);
align(18, 22, true);
align(18, 23, false);
align(18, 29, false);
align(18, 30, true);
align(18, 33, true);
align(18, 34, false);
align(18, 17, false);
align(21, 19, true);
align(21, 32, true);

align(22, 19, true);
align(22, 18, false);
align(22, 33, true);
align(22, 34, false);
align(25, 22, true);
align(25, 21, false);
align(25, 33, true);
align(29, 26, true);
align(29, 25, false);
align(29, 33, true);

align(30, 18, true);
align(30, 24, true);
align(30, 25, false);
align(30, 33, false);
align(30, 39, false);
align(30, 40, true);
align(30, 50, true);
align(30, 51, false);
align(45, 21, true);
align(45, 47, true);

assert.equal(agesAlign(19, 31), agesAlign(19, 31));
assert.equal(pairAllowed({
  boyAge: 25,
  girlAge: 24,
  boyWorkingOnSelf: true,
  girlTopTier: true,
  girlRarelyRejected: false,
}), false);
assert.equal(pairAllowed({
  boyAge: 25,
  girlAge: 24,
  boyWorkingOnSelf: true,
  girlTopTier: false,
  girlRarelyRejected: true,
}), false);
assert.equal(pairAllowed({
  boyAge: 25,
  girlAge: 24,
  boyWorkingOnSelf: true,
  girlTopTier: false,
  girlRarelyRejected: false,
}), true);
assert.equal(pairAllowed({
  boyAge: 35,
  girlAge: 22,
  boyWorkingOnSelf: false,
  girlTopTier: false,
  girlRarelyRejected: false,
}), true);
assert.equal(isWorkingOnSelf({ futurePlans: 'Starting a YouTube channel' }), true);
assert.equal(isWorkingOnSelf({ futurePlans: 'Teaching high school' }), false);
assert.equal(isTopTierAccount(96, 40, 2), true);
assert.equal(isTopTierAccount(90, 90, 4), false);
assert.equal(isTopTierAccount(100, 100, 0), false);
assert.equal(isRarelyRejected(4, 0), true);
assert.equal(isRarelyRejected(4, 1), false);
assert.equal(isRarelyRejected(3, 0), false);
assert.equal(isRarelyRejected(10, 1), true);
assert.equal(polishFuture('Teacher'), 'Training the future saviors of Earth');

const catalog = promptCatalog();
assert.ok(catalog.length >= 2000, `catalog ${catalog.length}`);
const ids = new Set(catalog.map((item) => item.id));
const texts = new Set(catalog.map((item) => item.text));
assert.equal(ids.size, catalog.length);
assert.equal(texts.size, catalog.length);

const seen = new Set<string>();
const drawn = new Set<string>();
assert.equal(nextPrompt(seen).text, SEED_PROMPTS[0].text);
for (let i = 0; i < 2500; i += 1) {
  const prompt = nextPrompt(seen);
  assert.equal(seen.has(prompt.id), false, prompt.id);
  assert.equal(drawn.has(prompt.text), false, prompt.text);
  seen.add(prompt.id);
  drawn.add(prompt.text);
}

console.log(`dating battle checks ok (${catalog.length} icebreakers)`);
