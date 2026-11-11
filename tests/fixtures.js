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
    progress: { [unit.id]: { completedLessons: [], review: [] } }
  };
}

module.exports = { makeUnit, makeSave };
