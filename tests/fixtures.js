function makeUnit() {
  const q = (id, extra) => Object.assign({ id, prompt: 'P ' + id, hint: 'H ' + id, solution: 'S ' + id }, extra);
  return {
    format: 1, id: 'u1', title: 'Unit 1',
    levels: [
      { id: 'A', title: 'Level A', lessons: [
        { id: 'a1', questions: [
          q('q1', { type: 'choice', choices: ['one', 'two', 'three'], answer: 1 }),
          q('q2', { type: 'input', answers: ['7'] })] },
        { id: 'a2', questions: [q('q3', { type: 'input', answers: ['1/2'] })] }] },
      { id: 'B', title: 'Level B', lessons: [
        { id: 'b1', questions: [q('q4', { type: 'input', answers: ['3,-3', '-3,3'] })] }] }
    ]
  };
}

function makeSave(unit) {
  return {
    version: 1, xp: 0, streak: 0, lastStudyDate: null, currentUnitId: unit.id,
    units: { [unit.id]: unit },
    progress: { [unit.id]: { completedLessons: [], review: [], testBest: null, stars: {} } },
    days: {},
    badges: {},
    settings: { sound: true, angle: 'deg', goal: 100, theme: 'light', mascot: { color: 'pink', name: 'Axl' } }
  };
}

function makeRichUnit() {
  const unit = makeUnit();
  unit.levels[0].lessons[0].teach = [
    { title: 'Card one', text: ['First paragraph.', 'Second paragraph.'] },
    {
      title: 'Card two',
      text: ['Look at x < 3.'],
      example: { problem: 'Solve x + 1 = 3', steps: ['Subtract 1.', 'x = 2'] },
      graph: { fn: 'x^2 - 4', x: [-5, 5], y: [-6, 6], numbers: false }
    }
  ];
  unit.levels[0].lessons[1].questions[0].graph = { fn: 'x^3 - 3x^2 - 3' };
  unit.levels[1].lessons[0].questions[0].calculator = false;
  const typed = (id, answer) => ({ id, type: 'input', prompt: 'T ' + id, hint: 'H ' + id, solution: 'S ' + id, answers: [answer] });
  unit.test = {
    questions: [
      { id: 't1', type: 'choice', prompt: 'T t1', hint: 'H t1', solution: 'S t1', choices: ['no', 'yes'], answer: 1, graph: { fn: '2x - 4' } },
      typed('t2', '2'), typed('t3', '3'), typed('t4', '4'),
      Object.assign(typed('t5', '5'), { calculator: false })
    ]
  };
  return unit;
}

module.exports = { makeUnit, makeSave, makeRichUnit };
