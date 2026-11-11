// Checks a unit file before it is imported into the app.
// Usage: node tools/validate-unit.js <unit.json>
// Exit codes: 0 = valid, 1 = invalid or unreadable, 2 = no file given.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const units = require(path.join(__dirname, '../js/units.js'));

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/validate-unit.js <unit.json>');
  process.exit(2);
}

let unit;
try {
  unit = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error('Not valid JSON: ' + file);
  process.exit(1);
}

const result = units.validate(unit);
if (!result.ok) {
  for (const message of result.errors) console.error(message);
  process.exit(1);
}

const levels = unit.levels.length;
const lessons = units.lessonIds(unit).length;
const questions = units.questionIds(unit).length;
console.log(`OK: ${unit.title} (${levels} levels, ${lessons} lessons, ${questions} questions)`);
