/**
 * Exp 04's saved bench must survive a round trip through the preset system.
 *
 * The whole point of shipping the real bench as data is that it is the bench
 * that was actually wired on the desk. That guarantee is only worth anything
 * if every wire in it lands on a terminal the devices really declare — the
 * netlist DROPS an unresolvable wire in silence, so a typo in the JSON would
 * produce a preset that builds, looks right, and is quietly missing a
 * connection.
 *
 * The generic preset test already checks terminal names. This one checks the
 * things specific to Exp 04 being REAL rather than reconstructed:
 *
 *   · every saved id is preserved, or wires resolve to nothing
 *   · the two rheostats are addressed by ROLE and the ids in EXP04_IDS still
 *     match the ids actually in the file
 *   · the mechanical train (motor -> coupling -> generator) is intact, which
 *     is what makes it a motor-coupled generator and not a spinning prop
 */

import { describe, it, expect } from 'vitest';
import { EXP04_BENCH, EXP04_IDS } from '../src/ui/exp04-bench.js';
import { PRESETS } from '../src/ui/presets.js';
import { DEVICE_KINDS } from '../src/devices/index.js';

/** Minimal Lab stand-in, matching the one in presets.test.ts. */
function fakeLab(): any {
  let seq = 0;
  const lab: any = {
    devices: [], wires: [], titleEl: { textContent: '' },
    clear() { this.devices = []; this.wires = []; },
    fitView() {},
    place(kind: string, x = 0, y = 0, rot = 0) {
      const Ctor = DEVICE_KINDS[kind];
      if (!Ctor) throw new Error('unknown kind ' + kind);
      const model = new (Ctor as new () => unknown)();
      const entry = { id: kind + '_' + ++seq, kind, x, y, rot, model };
      this.devices.push(entry);
      return entry;
    },
    loadBench(data: any) {
      this.clear();
      for (const d of data.devices) {
        const e = this.place(d.kind, d.x, d.y, d.rot || 0);
        e.id = d.id; e.model.id = d.id;
        if (d.state) e.state = d.state;
      }
      for (const w of data.wires) this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
    },
    wiring: {
      add(aDev: string, aTerm: string, bDev: string, bTerm: string) {
        lab.wires.push({ aDev, aTerm, bDev, bTerm });
        return { id: 'w' + lab.wires.length, aDev, aTerm, bDev, bTerm };
      }
    }
  };
  return lab;
}

describe('exp04 saved bench', () => {
  it('the preset loads the real bench, wire for wire', () => {
    const lab = fakeLab();
    PRESETS.exp04_dcgen.build(lab);

    expect(lab.devices).toHaveLength(EXP04_BENCH.devices.length);
    expect(lab.wires).toHaveLength(EXP04_BENCH.wires.length);
  });

  it('every device keeps the id the wires reference', () => {
    const lab = fakeLab();
    PRESETS.exp04_dcgen.build(lab);

    const ids = new Set(lab.devices.map((d: any) => d.id));
    const savedIds = EXP04_BENCH.devices.map((d) => d.id);

    for (const id of savedIds) {
      expect(ids.has(id), `saved id ${id} did not survive the load`).toBe(true);
    }

    // And the reverse: no wire points at an id that is not on the bench.
    const dangling = lab.wires.filter(
      (w: any) => !ids.has(w.aDev) || !ids.has(w.bDev)
    );
    expect(dangling).toEqual([]);
  });

  it('every wire lands on a terminal the device declares', () => {
    const lab = fakeLab();
    PRESETS.exp04_dcgen.build(lab);

    const byId = new Map<string, any>(lab.devices.map((d: any) => [d.id, d]));
    const bad: string[] = [];

    for (const w of lab.wires as any[]) {
      const A = byId.get(w.aDev);
      const B = byId.get(w.bDev);
      if (!A || !B) { bad.push(`${w.aDev}:${w.aTerm} -> ${w.bDev}:${w.bTerm} (missing device)`); continue; }
      if (!(w.aTerm in (A.model.terminals ?? {}))) bad.push(`${A.kind}:${w.aTerm} — no such terminal`);
      if (!(w.bTerm in (B.model.terminals ?? {}))) bad.push(`${B.kind}:${w.bTerm} — no such terminal`);
    }

    expect(bad).toEqual([]);
  });

  it('EXP04_IDS still names the rheostats that are actually in the file', () => {
    const ids = new Set(EXP04_BENCH.devices.map((d) => d.id));

    // A renamed or re-saved bench that forgets to update EXP04_IDS would make
    // setup() silently skip its trim — the preset would still build and look
    // fine, and the field would just be wrong.
    expect(ids.has(EXP04_IDS.FIELD_RH), 'FIELD_RH is not in the bench').toBe(true);
    expect(ids.has(EXP04_IDS.LOAD_RH), 'LOAD_RH is not in the bench').toBe(true);
    expect(EXP04_IDS.FIELD_RH).not.toBe(EXP04_IDS.LOAD_RH);

    // Both must actually be rheostats, or the trim writes to a foreign model.
    for (const id of [EXP04_IDS.FIELD_RH, EXP04_IDS.LOAD_RH]) {
      const d = EXP04_BENCH.devices.find((x) => x.id === id);
      expect(d?.kind, `${id} is not a rheostat`).toBe('rheostat');
    }
  });

  it('the mechanical train is intact: motor -> coupling -> generator', () => {
    const lab = fakeLab();
    PRESETS.exp04_dcgen.build(lab);

    const byId = new Map<string, any>(lab.devices.map((d: any) => [d.id, d]));
    const kindOf = (id: string) => byId.get(id)?.kind;

    const shaftWires = (lab.wires as any[]).filter(
      (w) => w.aTerm === 'SHAFT' || w.bTerm === 'SHAFT'
    );

    // Two SHAFT links: prime mover -> coupling, coupling -> generator.
    expect(shaftWires).toHaveLength(2);

    const ends = shaftWires.map((w) =>
      w.aTerm === 'SHAFT' ? { dev: w.aDev, term: w.aTerm, other: w.bDev } : { dev: w.bDev, term: w.bTerm, other: w.aDev }
    );

    const motorEnd = ends.find((e) => kindOf(e.dev) === 'async_motor_3p');
    const genEnd = ends.find((e) => kindOf(e.dev) === 'dc_machine');

    expect(motorEnd, 'no SHAFT link from the 3φ prime mover').toBeTruthy();
    expect(genEnd, 'no SHAFT link to the DC machine').toBeTruthy();
    // Both must land on the SAME coupling, or the two shafts are not coupled.
    expect(motorEnd!.other).toBe(genEnd!.other);
    expect(kindOf(motorEnd!.other)).toBe('coupling');
  });

  it('the field loop runs through the rheostat and back', () => {
    const lab = fakeLab();
    PRESETS.exp04_dcgen.build(lab);

    const byId = new Map<string, any>(lab.devices.map((d: any) => [d.id, d]));
    const field = EXP04_IDS.FIELD_RH;

    // The rheostat must be in the F2 loop, in series — not shorted across it.
    const touching = (lab.wires as any[]).filter(
      (w) => w.aDev === field || w.bDev === field
    );
    expect(touching.length, 'field rheostat is not wired into anything').toBeGreaterThan(0);

    const dc = EXP04_BENCH.devices.find((d) => d.kind === 'dc_machine')!;
    const onF2 = (lab.wires as any[]).some(
      (w) => (w.aDev === dc.id && w.aTerm === 'F2') || (w.bDev === dc.id && w.bTerm === 'F2')
    );
    expect(onF2, 'F2 is not wired — the field loop is open').toBe(true);

    // And the loop must close back to the armature, or no field current flows.
    const wires = lab.wires as any[];
    const reached = new Set<string>([field]);
    for (let pass = 0; pass < 8; pass++) {
      for (const w of wires) {
        if (reached.has(w.aDev)) reached.add(w.bDev);
        if (reached.has(w.bDev)) reached.add(w.aDev);
      }
    }
    expect(reached.has(dc.id), 'field rheostat does not reach the DC machine').toBe(true);
  });
});
