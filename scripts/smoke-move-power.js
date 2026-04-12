'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const fmtCommonPath = path.join(root, 'extension', 'fmtCommon.js');
const simplePath = path.join(root, 'extension', 'simpleMovePower.js');
const modifiers = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'modifiers.json'), 'utf8'));
const moveTags = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'moveTags.json'), 'utf8'));
const moveKo = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'moveKoMap.json'), 'utf8'));

const ctx = { globalThis: {}, self: {}, console };
ctx.globalThis = ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(fmtCommonPath, 'utf8'), ctx);
vm.runInContext(fs.readFileSync(simplePath, 'utf8'), ctx);
const SMP = ctx.simpleMovePower;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function cmp(slot, types) {
  return SMP.computeMovePowers(slot, types, modifiers, moveTags, moveKo);
}

const firePunch = {
  name: 'Fire Punch',
  power: '75',
  damage_class: 'physical',
  type: 'Fire',
};
const slot = {
  pokemon: {
    moves: [firePunch],
    stats: {
      attack: { real: 100 },
      special_attack: { real: 100 },
    },
  },
  ability: { name: 'Tough Claws' },
};

const row = cmp(slot, ['fire']);
const wantTough = Math.round(Math.round(75 * 1.3) * 1.5) * 100;
assert(row[0].buffed === wantTough, 'tough claws buffed: got ' + row[0].buffed + ' want ' + wantTough);
assert(row[0].base === row[0].buffed, 'tough claws base equals buffed');

const sheer = cmp(Object.assign({}, slot, { ability: { name: 'Sheer Force' } }), ['fire']);
const wantSheer = Math.round(Math.round(75 * 1.3) * 1.5) * 100;
assert(sheer[0].buffed === wantSheer, 'sheer force buffed');
assert(sheer[0].base === sheer[0].buffed, 'sheer base equals buffed');

const firePunchKo = {
  nameKr: '불꽃펀치',
  power: '75',
  damage_class: 'physical',
  type: 'Fire',
};
const koRow = cmp(
  {
    pokemon: {
      moves: [firePunchKo],
      stats: { attack: { real: 100 }, special_attack: { real: 100 } },
    },
    ability: { name: 'Tough Claws' },
  },
  ['fire']
);
assert(koRow[0].buffed === wantTough, 'tough claws + Korean move name');

const bullet = {
  name: 'Bullet Punch',
  power: '40',
  damage_class: 'physical',
  type: 'Steel',
};
const techSlot = {
  pokemon: {
    moves: [bullet],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Technician' },
};
const techRow = cmp(techSlot, ['steel']);
const techWant = Math.round(Math.round(40 * 1.5) * 1.5) * 100;
assert(techRow[0].buffed === techWant, 'technician');
assert(techRow[0].base === techRow[0].buffed, 'technician no split');

const wild = {
  name: 'Wild Charge',
  power: '90',
  damage_class: 'physical',
  type: 'Electric',
};
const rec = {
  pokemon: {
    moves: [wild],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Reckless' },
};
const recRow = cmp(rec, ['electric']);
const wantRec = Math.round(Math.round(90 * 1.2) * 1.5) * 100;
assert(recRow[0].buffed === wantRec, 'reckless');
assert(recRow[0].base === recRow[0].buffed, 'reckless no split');

const ft = {
  name: 'Flamethrower',
  power: '90',
  damage_class: 'special',
  type: 'Fire',
};
const droughtSlot = {
  pokemon: {
    moves: [ft],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Drought' },
};
const dr = cmp(droughtSlot, ['fire']);
const wantDroughtBuffed = Math.round(Math.round(90 * 1.5) * 1.5) * 100;
const wantDroughtBase = Math.round(90 * 1.5) * 100;
assert(dr[0].buffed === wantDroughtBuffed, 'drought buffed');
assert(dr[0].base === wantDroughtBase, 'drought base without sun mul: got ' + dr[0].base + ' want ' + wantDroughtBase);
assert(dr[0].base < dr[0].buffed, 'drought base < buffed');

const tb = {
  name: 'Thunderbolt',
  power: '90',
  damage_class: 'special',
  type: 'Electric',
};
const surgeSlot = {
  pokemon: {
    moves: [tb],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Electric Surge' },
};
const sur = cmp(surgeSlot, ['electric']);
const wantSurgeBuffed = Math.round(Math.round(90 * 1.3) * 1.5) * 100;
const wantSurgeBase = Math.round(90 * 1.5) * 100;
assert(sur[0].buffed === wantSurgeBuffed, 'electric surge buffed');
assert(sur[0].base === wantSurgeBase, 'electric surge base');
assert(sur[0].base < sur[0].buffed, 'surge split');

const tackle = {
  name: 'Tackle',
  power: '40',
  damage_class: 'physical',
  type: 'Normal',
};
const normSlot = {
  pokemon: {
    moves: [tackle],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Normalize' },
};
const normRow = cmp(normSlot, ['normal']);
const normWant = Math.round(Math.round(40 * 1.2) * 1.5) * 100;
assert(normRow[0].buffed === normWant, 'normalize');
assert(normRow[0].base === normRow[0].buffed, 'normalize no split');

const pbSlot = {
  pokemon: {
    moves: [firePunch],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Parental Bond' },
};
const pbRow = cmp(pbSlot, ['fire']);
const pbWant = Math.round(Math.round(75 * 1.5) * 100 * 1.25);
assert(pbRow[0].buffed === pbWant, 'parental bond');
assert(pbRow[0].base === pbRow[0].buffed, 'parental bond no conditional split');

const rockHeadSlot = {
  pokemon: {
    moves: [
      {
        name: 'Double-Edge',
        power: '120',
        damage_class: 'physical',
        type: 'Normal',
      },
    ],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Rock Head' },
};
const rh = cmp(rockHeadSlot, ['normal']);
assert(rh[0].base === rh[0].buffed, 'rock head single display cell');

const tackleRuin = {
  name: 'Tackle',
  power: '40',
  damage_class: 'physical',
  type: 'Normal',
};
const swordSlot = {
  pokemon: {
    moves: [tackleRuin],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Sword of Ruin' },
};
const sw = cmp(swordSlot, ['normal']);
const swordWant = Math.round(Math.round(40 * 1.5) * 100 * (4 / 3));
assert(sw[0].buffed === swordWant, 'sword of ruin ×4/3 phys: got ' + sw[0].buffed + ' want ' + swordWant);
assert(sw[0].base === sw[0].buffed, 'sword ruin no base split');

const beadsSlot = {
  pokemon: {
    moves: [ft],
    stats: { attack: { real: 100 }, special_attack: { real: 100 } },
  },
  ability: { name: 'Beads of Ruin' },
};
const bd = cmp(beadsSlot, ['fire']);
const beadsWant = Math.round(Math.round(90 * 1.5) * 100 * (4 / 3));
assert(bd[0].buffed === beadsWant, 'beads of ruin ×4/3 spec');
assert(bd[0].base === bd[0].buffed, 'beads ruin no base split');

console.log('smoke-move-power: ok');
