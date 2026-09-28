/**
 * Rigid shaft coupling - binds two machines to one rotational speed.
 *
 * A `Machine` (it has inertia and an omega) but not an electrical device: its
 * only ports are the mechanical MA / MB.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Machine, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { terminalsOf } from '../_shared/types.js';
import { coupling } from './layout.js';

/* ── Shaft coupling ─────────────────────────────────────────────── */

/**
 * A rigid mechanical link between two machines.
 *
 * Purely mechanical: no electrical stamp, and the ports never appear in the
 * MNA matrix. `_mechA` / `_mechB` name the two machines, resolved by the
 * wiring layer when a shaft port is connected. The simulator's mechanical
 * pass then forces the pair to a shared angular velocity.
 *
 * This is what turns a motor-driven generator from a scripted `primeRpm` into
 * an actual coupled pair.
 */
export class Coupling implements Machine {
  readonly id: string;
  readonly type = 'coupling';
  readonly label: string;
  // MA / MB are mechanical ports, not electrical jacks. They are still
  // declared as nodes so the wire pass can find them and refuse to route
  // current through them — and so a coupling cannot be built whose ports do
  // not match the flange the sprite draws.
  readonly terminals = terminalsOf(coupling.layout);

  /** Mechanical port names, painted on the sprite. */
  readonly mechA: string;
  readonly mechB: string;

  /** Loss coefficient for the speed-mismatch torque. */
  joint: number;
  /** Torque at which the coupling slips rather than locking. */
  Tmax: number;
  slipped = false;
  T = 0;

  // A coupling has no rotor, but the mechanical pass requires the Machine
  // shape. Zero inertia means it never dominates a shared speed.
  readonly J = 0;
  omega = 0;
  primeRpm = 0;
  _coupled = false;

  /** Ids of the machines on each port, set by the wiring layer. */
  _mechA: string | null = null;
  _mechB: string | null = null;

  constructor(opts: { id?: string; label?: string; mechA?: string; mechB?: string; joint?: number; Tmax?: number } = {}) {
    this.id = opts.id ?? uid('cp');
    this.label = opts.label ?? 'Shaft Coupling';
    this.mechA = opts.mechA ?? 'MA';
    this.mechB = opts.mechB ?? 'MB';
    this.joint = opts.joint ?? 0.0002;
    this.Tmax = opts.Tmax ?? 40;
  }

  update(dt: number, _sol: Solution): void {
    // The velocity equalisation runs in the solver's mechanical pass, not
    // here, because it needs both coupled machines in hand. This only decays
    // the reported coupling torque.
    this.T *= Math.max(0, 1 - dt * 4);
  }

  readouts(): Readout[] {
    return [
      { name: 'T', value: Math.abs(this.T), unit: 'N m', warn: this.slipped },
      { name: 'st', value: this.slipped ? 'SLIP' : 'LOCK', unit: '', warn: this.slipped }
    ];
  }
}

