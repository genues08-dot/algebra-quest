const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/game.js');
const rewards = require('../js/rewards.js');
const storage = require('../js/storage.js');
const { makeUnit, makeSave, makeRichUnit } = require('./fixtures.js');

const TODAY = '2026-11-12'; // a Thursday; that week's Monday is 2026-11-09

function fourLessonUnit() {
  const unit = makeUnit();
  const q = (id, answer) => ({ id, type: 'input', prompt: 'P ' + id, hint: 'h', solution: 's', answers: [answer] });
  unit.levels[0].lessons.push({ id: 'a3', questions: [q('q5', '5')] }, { id: 'a4', questions: [q('q6', '6')] });
  return unit;
}

// ----- Combo, Rewind, Speed Round, daily counters -----

test('combo counts right answers in a row, resets on a miss, and every 5th gives +5 XP', () => {
  const unit = makeUnit();
  unit.levels[0].lessons[0].questions = Array.from({ length: 10 }, (_, i) =>
    ({ id: 'c' + i, type: 'input', prompt: 'C' + i, hint: 'h', solution: 's', answers: ['1'] }));
  const save = makeSave(unit);
  const session = game.startLesson(unit, 'a1');
  const results = [];
  for (const response of ['1', '1', '0', '1', '1', '1', '1', '1', '1', '1', '1']) {
    const result = game.submitAnswer(save, unit, session, response, TODAY);
    game.continueSession(session);
    if (result) results.push([result.combo, result.xp]);
  }
  assert.deepEqual(results.slice(0, 3), [[1, 10], [2, 10], [0, 0]]);
  assert.deepEqual(results[7], [5, 15]);
  assert.equal(session.bestCombo, 8);
  assert.equal(save.bestCombo, 8);
  assert.equal(save.daily.bestCombo, 8);
  assert.equal(save.daily.correct, 10);
});

test('finishing lessons and reviews counts toward today, and a new day starts fresh', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  const lesson = game.startLesson(unit, 'a2');
  game.submitAnswer(save, unit, lesson, '1/2', TODAY);
  assert.deepEqual(save.daily, { date: TODAY, lessons: 1, perfect: 1, correct: 1, bestCombo: 1, practice: 0, claimed: [] });
  save.progress.u1.review = ['q3'];
  const review = game.startReview(unit, save.progress.u1);
  game.submitAnswer(save, unit, review, '1/2', TODAY);
  assert.equal(save.daily.practice, 1);
  assert.equal(game.dailyFor(save, '2026-11-13').lessons, 0);
});

test('Unit Rewind picks from finished lessons and adds a bonus', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  assert.equal(game.startRewind(unit, save.progress.u1, () => 0), null);
  save.progress.u1.completedLessons = ['a2'];
  const session = game.startRewind(unit, save.progress.u1, () => 0);
  assert.deepEqual([session.kind, session.queue], ['rewind', ['q3']]);
  game.submitAnswer(save, unit, session, '1/2', TODAY);
  assert.equal(session.status, 'complete');
  assert.equal(session.xpEarned, 10 + 20 + 10 + 20);
});

test('Speed Round: graded once each, wrong ones go to review, ends on time or when empty', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.progress.u1.completedLessons = ['a1', 'a2'];
  assert.equal(game.startSpeed(unit, makeSave(unit).progress.u1, Math.random, 0), null);
  const session = game.startSpeed(unit, save.progress.u1, () => 0, 1000);
  assert.equal(session.endsAt, 61000);
  assert.equal(session.queue.length, 3);
  const first = game.currentQuestion(unit, session);
  const wrong = first.type === 'choice' ? 0 : 'nope';
  game.submitAnswer(save, unit, session, wrong, TODAY, 2000);
  assert.equal(session.awaitingContinue, false);
  assert.deepEqual(save.progress.u1.review, [first.id]);
  const timeUp = game.submitAnswer(save, unit, session, 'x', TODAY, 62000);
  assert.equal(timeUp.timeUp, true);
  assert.equal(session.status, 'complete');
  assert.equal(save.progress.u1.speedBest, 0);
  assert.equal(save.daily.practice, 1);

  const again = game.startSpeed(unit, save.progress.u1, () => 0, 0);
  for (let i = 0; i < 3; i++) {
    const q = game.currentQuestion(unit, again);
    const right = q.type === 'choice' ? q.answer : q.answers[0];
    game.submitAnswer(save, unit, again, right, TODAY, 1000);
  }
  assert.equal(again.status, 'complete');
  assert.equal(again.newBest, true);
  assert.equal(save.progress.u1.speedBest, 3);
  assert.equal(game.finishSpeed(save, again, TODAY), false);
});

// ----- Unlocking -----

test('a level stays open when it or a later level has a finished lesson', () => {
  const unit = fourLessonUnit();
  const progress = { completedLessons: ['a1', 'a2', 'b1'], review: [], testBest: null };
  assert.deepEqual(game.levelStates(unit, progress), ['open', 'complete']);
  progress.completedLessons = ['a1'];
  assert.deepEqual(game.levelStates(unit, progress), ['open', 'locked']);
  assert.equal(game.nextStep(unit, { completedLessons: ['a1', 'a2', 'b1'], review: [] }).lessonId, 'a3');
});

// ----- Streak freezes -----

test('freezes cover missed days, are used up, and log the days as frozen', () => {
  const save = makeSave(makeUnit());
  save.streak = 5;
  save.lastStudyDate = '2026-11-09';
  save.freezes = 2;
  assert.equal(game.refreshStreak(save, TODAY), 2);
  assert.deepEqual([save.streak, save.freezes, save.lastStudyDate], [5, 0, '2026-11-11']);
  assert.equal(save.days['2026-11-10'].frozen, true);
  const week = game.weekStrip(save, TODAY);
  assert.deepEqual(week.slice(4).map(d => [d.date, d.frozen]), [['2026-11-10', true], ['2026-11-11', true], [TODAY, false]]);
  assert.equal(storage.isValidSave(save), true);

  const short = makeSave(makeUnit());
  short.streak = 5;
  short.lastStudyDate = '2026-11-08';
  short.freezes = 2;
  assert.equal(game.refreshStreak(short, TODAY), 0);
  assert.deepEqual([short.streak, short.freezes], [0, 2]);
});

// ----- Daily quests -----

test('each date has 3 fixed quests, never two XP ones', () => {
  for (const date of ['2026-11-12', '2026-11-13', '2026-12-25', '2027-01-01']) {
    const quests = rewards.questsFor(date);
    assert.equal(quests.length, 3);
    assert.deepEqual(rewards.questsFor(date).map(q => q.id), quests.map(q => q.id));
    assert.ok(quests.filter(q => q.id.startsWith('xp')).length <= 1, date);
  }
});

test('quests show progress, and a finished one is claimed once for its gems', () => {
  const save = makeSave(makeUnit());
  save.days = { [TODAY]: { xp: 120, studied: true } };
  save.daily = { date: TODAY, lessons: 2, perfect: 1, correct: 20, bestCombo: 6, practice: 1, claimed: [] };
  const quests = rewards.questStatus(save, TODAY);
  assert.ok(quests.every(q => q.done && !q.claimed));
  const first = quests[0];
  assert.equal(rewards.claimQuest(save, TODAY, first.id), first.gems);
  assert.equal(save.gems, first.gems);
  assert.equal(rewards.claimQuest(save, TODAY, first.id), 0);
  assert.equal(rewards.questStatus(save, TODAY)[0].claimed, true);
  assert.equal(storage.isValidSave(save), true);

  const fresh = makeSave(makeUnit());
  assert.ok(rewards.questStatus(fresh, TODAY).every(q => q.progress === 0));
  assert.equal(rewards.claimQuest(fresh, TODAY, rewards.questsFor(TODAY)[0].id), 0);
});

// ----- Week rewards and the weekly challenge -----

test('week starts on Monday', () => {
  assert.equal(rewards.weekStart('2026-11-12'), '2026-11-09');
  assert.equal(rewards.weekStart('2026-11-09'), '2026-11-09');
  assert.equal(rewards.weekStart('2026-11-15'), '2026-11-09');
});

test('week rewards: one claim a day after studying, rising gems, a new week starts over', () => {
  const save = makeSave(makeUnit());
  assert.equal(rewards.weekRewardStatus(save, TODAY).slots[0].state, 'waiting');
  assert.equal(rewards.claimWeekReward(save, TODAY), 0);
  save.days = { [TODAY]: { xp: 10, studied: true }, '2026-11-13': { xp: 10, studied: true } };
  assert.equal(rewards.weekRewardStatus(save, TODAY).slots[0].state, 'ready');
  assert.equal(rewards.claimWeekReward(save, TODAY), 5);
  assert.equal(rewards.claimWeekReward(save, TODAY), 0);
  assert.deepEqual(rewards.weekRewardStatus(save, TODAY).slots.slice(0, 3).map(s => s.state), ['claimed', 'later', 'later']);
  assert.equal(rewards.claimWeekReward(save, '2026-11-13'), 10);
  assert.equal(save.gems, 15);
  assert.equal(storage.isValidSave(save), true);
  assert.equal(rewards.weekRewardStatus(save, '2026-11-16').slots[0].state, 'waiting');
});

test('weekly challenge: beat last week (at least 100 XP) for 30 gems once', () => {
  const save = makeSave(makeUnit());
  save.days = {
    '2026-11-03': { xp: 80, studied: true }, '2026-11-08': { xp: 70, studied: true },
    '2026-11-10': { xp: 100, studied: true }, [TODAY]: { xp: 40, studied: true }
  };
  let status = rewards.challengeStatus(save, TODAY);
  assert.deepEqual([status.lastWeek, status.thisWeek, status.target, status.beaten], [150, 140, 151, false]);
  assert.equal(rewards.claimChallenge(save, TODAY), 0);
  save.days[TODAY].xp = 60;
  assert.equal(rewards.challengeStatus(save, TODAY).beaten, true);
  assert.equal(rewards.claimChallenge(save, TODAY), 30);
  assert.equal(rewards.claimChallenge(save, TODAY), 0);
  assert.equal(storage.isValidSave(save), true);
  assert.equal(rewards.challengeStatus(makeSave(makeUnit()), TODAY).target, 100);
});

// ----- Shop -----

test('freezes cost 50 and stop at 2; hats are bought once, worn, and taken off', () => {
  const save = makeSave(makeUnit());
  save.gems = 160;
  assert.equal(rewards.buyFreeze(save), true);
  assert.equal(rewards.buyFreeze(save), true);
  assert.equal(rewards.buyFreeze(save), false);
  assert.deepEqual([save.gems, save.freezes], [60, 2]);
  assert.equal(rewards.buyHat(save, 'crown'), false);
  assert.equal(rewards.buyHat(save, 'party'), true);
  assert.deepEqual(save.outfits, { owned: ['party'], worn: 'party' });
  assert.equal(rewards.buyHat(save, 'party'), false);
  assert.equal(rewards.buyHat(save, 'nope'), false);
  assert.equal(rewards.wearHat(save, 'party'), true);
  assert.equal(save.outfits.worn, null);
  assert.equal(rewards.wearHat(save, 'beanie'), false);
  assert.equal(save.gems, 30);
  assert.equal(storage.isValidSave(save), true);
});

// ----- Chests -----

test('a chest after lesson 2 opens once both lessons are done, for gems by level', () => {
  const unit = fourLessonUnit();
  const save = makeSave(unit);
  assert.equal(rewards.chestState(unit, save.progress.u1, 1), null);
  assert.equal(rewards.chestState(unit, save.progress.u1, 0), 'locked');
  assert.equal(rewards.openChest(save, 'u1', 0), 0);
  save.progress.u1.completedLessons = ['a1', 'a2'];
  assert.equal(rewards.chestState(unit, save.progress.u1, 0), 'ready');
  assert.equal(rewards.openChest(save, 'u1', 0), 15);
  assert.equal(rewards.chestState(unit, save.progress.u1, 0), 'open');
  assert.equal(rewards.openChest(save, 'u1', 0), 0);
  assert.deepEqual([save.gems, save.progress.u1.chests], [15, ['0']]);
  assert.deepEqual([rewards.chestGems(1), rewards.chestGems(2), rewards.chestGems(3)], [20, 25, 15]);
  assert.equal(storage.isValidSave(save), true);
});

// ----- Save checks -----

test('bad reward fields make a save invalid, and old saves get the defaults', () => {
  const bad = [
    s => { s.gems = -1; }, s => { s.gems = 1.5; }, s => { s.freezes = 3; }, s => { s.bestCombo = 'x'; },
    s => { s.outfits = { owned: ['cape'], worn: null }; }, s => { s.outfits = { owned: ['party'], worn: 'crown' }; },
    s => { s.outfits = { owned: ['party', 'party'], worn: null }; },
    s => { s.daily = { date: TODAY, lessons: -1, perfect: 0, correct: 0, bestCombo: 0, practice: 0, claimed: [] }; },
    s => { s.weekRewards = { week: 'monday', claimed: [] }; }, s => { s.weekChallenge = { week: TODAY, claimed: 'yes' }; },
    s => { s.progress.u1.chests = [0]; }, s => { s.progress.u1.speedBest = -2; },
    s => { s.days = { [TODAY]: { xp: 1, studied: true, frozen: 'no' } }; }
  ];
  bad.forEach((change, index) => {
    const save = makeSave(makeRichUnit());
    change(save);
    assert.equal(storage.isValidSave(save), false, 'case ' + index);
  });
  const old = makeSave(makeUnit());
  for (const key of ['gems', 'freezes', 'bestCombo', 'outfits']) delete old[key];
  delete old.progress.u1.chests;
  const loaded = storage.load({ getItem: () => JSON.stringify(old) }).save;
  assert.deepEqual([loaded.gems, loaded.freezes, loaded.bestCombo, loaded.outfits, loaded.progress.u1.chests],
    [0, 0, 0, { owned: [], worn: null }, []]);
});

// ----- Review fixes -----

test('a Speed Round with no answers does not count as studying', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.progress.u1.completedLessons = ['a1'];
  save.streak = 4;
  save.lastStudyDate = '2026-11-11';
  const session = game.startSpeed(unit, save.progress.u1, () => 0, 0);
  assert.equal(game.finishSpeed(save, session, TODAY), true);
  assert.deepEqual([save.streak, save.lastStudyDate], [4, '2026-11-11']);
  assert.equal(save.daily === undefined || save.daily.practice === 0, true);
  assert.equal(rewards.weekRewardStatus(save, TODAY).canClaim, false);
});

test('a freeze still covers missed days when the app stayed open over them', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  save.streak = 10;
  save.freezes = 2;
  save.lastStudyDate = '2026-11-09';
  const session = game.startLesson(unit, 'a2');
  game.submitAnswer(save, unit, session, '1/2', TODAY);
  assert.deepEqual([save.streak, save.freezes, save.lastStudyDate], [11, 0, TODAY]);
});

test('moving the clock back does not give quests, week rewards, or the challenge again', () => {
  const save = makeSave(makeUnit());
  const later = '2026-11-20';
  save.days = { [TODAY]: { xp: 500, studied: true }, [later]: { xp: 500, studied: true } };
  save.daily = { date: later, lessons: 5, perfect: 5, correct: 50, bestCombo: 9, practice: 5, claimed: [] };
  save.weekRewards = { week: '2026-11-16', claimed: [] };
  save.weekChallenge = { week: '2026-11-16', claimed: true };
  assert.ok(rewards.questStatus(save, TODAY).every(q => q.claimed));
  assert.equal(rewards.claimQuest(save, TODAY, rewards.questsFor(TODAY)[0].id), 0);
  assert.equal(rewards.weekRewardStatus(save, TODAY).canClaim, false);
  assert.equal(rewards.challengeStatus(save, TODAY).claimed, true);
  assert.equal(game.dailyFor(save, TODAY).date, TODAY);
  assert.equal(save.daily.date, later);
});

test('two finished lessons open the next level, and Continue picks up after the latest one', () => {
  const unit = fourLessonUnit();
  unit.levels.push({ id: 'C', title: 'Level C', lessons: [{ id: 'c1', questions: [{ id: 'q9', type: 'input', prompt: 'P', hint: 'h', solution: 's', answers: ['9'] }] }] });
  const progress = { completedLessons: ['a1'], review: [], testBest: null };
  assert.deepEqual(game.levelStates(unit, progress), ['open', 'locked', 'locked']);
  progress.completedLessons = ['a1', 'a2'];
  assert.deepEqual(game.levelStates(unit, progress), ['open', 'open', 'locked']);
  assert.equal(game.nextStep(unit, progress).lessonId, 'a3');
  progress.completedLessons = ['a1', 'a2', 'b1'];
  assert.deepEqual(game.levelStates(unit, progress), ['open', 'complete', 'open']);
  assert.equal(game.nextStep(unit, progress).lessonId, 'c1');
  progress.completedLessons = ['a1', 'a2', 'b1', 'c1'];
  assert.equal(game.nextStep(unit, progress).lessonId, 'a3');
});

test('a final test taken before stays open after the unit gains lessons', () => {
  const unit = fourLessonUnit();
  unit.test = { questions: [{ id: 't1', type: 'input', prompt: 'T', hint: 'h', solution: 's', answers: ['1'] }] };
  const progress = { completedLessons: ['a1', 'a2', 'b1'], review: [], testBest: null };
  assert.equal(game.isTestUnlocked(unit, progress), false);
  progress.testBest = 85;
  assert.equal(game.isTestUnlocked(unit, progress), true);
});

test('a 2-lesson level has its chest after lesson 2', () => {
  const unit = makeUnit();
  const save = makeSave(unit);
  assert.equal(rewards.chestState(unit, save.progress.u1, 0), 'locked');
  save.progress.u1.completedLessons = ['a1', 'a2'];
  assert.equal(rewards.openChest(save, 'u1', 0), 15);
});
