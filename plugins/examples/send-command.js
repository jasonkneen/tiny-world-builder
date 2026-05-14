#!/usr/bin/env node
// Small CLI for sending commands to sse-command-relay.js.

const DEFAULT_URL = process.env.TINYWORLD_RELAY_URL || 'http://localhost:8788/command';
const TOKEN = process.env.TINYWORLD_RELAY_TOKEN || '';

function usage() {
  console.log(`Usage:
    node plugins/examples/send-command.js place --x 2 --z 2 --kind tree --terrain grass
    node plugins/examples/send-command.js place --x 4 --z 4 --terrain dirt --kind corn --floors 2
    node plugins/examples/send-command.js clear
    node plugins/examples/send-command.js reset

Vehicle commands:
    node plugins/examples/send-command.js vehicle-spawn --x 4 --z 4 --mode auto --goalX 8 --goalZ 8
    node plugins/examples/send-command.js vehicle-goal --id vehicle-1 --x 10 --z 4
    node plugins/examples/send-command.js vehicle-controls --id vehicle-1 --forward --left
    node plugins/examples/send-command.js vehicle-remove --id vehicle-1
    node plugins/examples/send-command.js vehicle-clear

Options for place:
  --x <n>              cell x coordinate
  --z <n>              cell z coordinate
  --terrain <name>     grass, path, dirt, water, stone, lava, sand, snow
  --kind <name|null>   house, tree, fence, rock, bridge, crop, corn, wheat, etc.
  --floors <n>         object intensity/floors, 1..8
  --buildingType <id>  cottage, manor, tower, turret, skyscraper
  --fenceSide <side>   n, s, e, w, center-x, center-z

Options for vehicle-spawn:
  --id <string>        optional id (auto-generated if omitted)
  --mode manual|auto    movement mode
  --goalX <n> --goalZ <n>
  --maxSpeed <n>
  --maxReverseSpeed <n>
  --accel <n>
  --brake <n>
  --turnRate <n>

Options for vehicle-controls:
  --id <string>
  --forward           turn on forward throttle
  --reverse           turn on reverse throttle
  --left              steer left
  --right             steer right

  --relay <url>        override relay command URL
`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function number(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    return !(s === '0' || s === 'false' || s === 'off' || s === 'no');
  }
  return !!value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const op = args._[0];
  if (!op || args.help) {
    usage();
    return;
  }

  let command;
  if (op === 'clear' || op === 'reset') {
    command = { op };
  } else if (op === 'place' || op === 'set_cell') {
    command = {
      op: 'place',
      x: number(args.x, NaN),
      z: number(args.z, NaN),
      terrain: args.terrain || 'grass',
      kind: args.kind === 'null' ? null : (args.kind || null),
      floors: number(args.floors, 1),
      buildingType: args.buildingType || null,
      fenceSide: args.fenceSide || null,
      rotationY: number(args.rotationY, 0),
      offsetX: number(args.offsetX, 0),
      offsetZ: number(args.offsetZ, 0),
    };
    if (!Number.isFinite(command.x) || !Number.isFinite(command.z)) {
      throw new Error('place requires --x and --z');
    }
  } else if (op === 'vehicle-spawn') {
    command = {
      op: 'vehicle_spawn',
      x: number(args.x, NaN),
      z: number(args.z, NaN),
      id: args.id || undefined,
      mode: args.mode || 'manual',
      angle: number(args.angle, undefined),
      maxSpeed: number(args.maxSpeed, undefined),
      maxReverseSpeed: number(args.maxReverseSpeed, undefined),
      accel: number(args.accel, undefined),
      brake: number(args.brake, undefined),
      turnRate: number(args.turnRate, undefined),
      goalX: number(args.goalX, undefined),
      goalZ: number(args.goalZ, undefined),
    };
    if (!Number.isFinite(command.x) || !Number.isFinite(command.z)) {
      throw new Error('vehicle-spawn requires --x and --z');
    }
  } else if (op === 'vehicle-goal') {
    command = {
      op: 'vehicle_set_goal',
      id: args.id,
      x: number(args.x, NaN),
      z: number(args.z, NaN),
    };
    if (!command.id || !Number.isFinite(command.x) || !Number.isFinite(command.z)) {
      throw new Error('vehicle-goal requires --id, --x and --z');
    }
  } else if (op === 'vehicle-controls') {
    if (!args.id) throw new Error('vehicle-controls requires --id');
    command = {
      op: 'vehicle_controls',
      id: args.id,
      controls: {
        forward: bool(args.forward),
        reverse: bool(args.reverse),
        left: bool(args.left),
        right: bool(args.right),
      },
    };
  } else if (op === 'vehicle-remove') {
    command = {
      op: 'vehicle_remove',
      id: args.id || 'all',
    };
  } else if (op === 'vehicle-clear') {
    command = { op: 'vehicle_clear' };
  } else {
    throw new Error(`unknown command: ${op}`);
  }

  const url = args.relay || DEFAULT_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify(command),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  console.log(text);
}

main().catch(err => {
  console.error(`[tinyworld:send-command] ${err.message}`);
  process.exit(1);
});
