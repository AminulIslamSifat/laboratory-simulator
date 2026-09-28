/**
 * Lumped thermal model.
 *
 * A single heat capacity C [J/K] losing heat to ambient through one
 * resistance Rth [K/W]. That is the whole model, and it is enough: it gets
 * the shape right — fast rise under overload, slow decay after — which is
 * what the student is meant to observe.
 *
 * Damage accumulates above Tmax and becomes permanent at 1.0. Tburn is the
 * hard kill: insulation fails instantly.
 */

export interface ThermalOptions {
  /** Initial and ambient temperature, °C. */
  T0?: number;
  Tamb?: number;
  /** Heat capacity, J/K. Bigger = slower to heat. */
  C?: number;
  /** Thermal resistance to ambient, K/W. Bigger = hotter for the same watts. */
  Rth?: number;
  /** Temperature above which damage accumulates, °C. */
  Tmax?: number;
  /** Temperature at which the device is destroyed outright, °C. */
  Tburn?: number;
}

export class Thermal {
  /** Winding / element temperature, °C. */
  T: number;
  Tamb: number;
  C: number;
  Rth: number;
  Tmax: number;
  Tburn: number;

  /** Accumulated damage, 0…1. Reaching 1 kills the device. */
  damage = 0;
  dead = false;
  /** Visible smoke, 0…1. Drives the puff renderer. */
  smoke = 0;

  constructor(opts: ThermalOptions = {}) {
    this.T = opts.T0 ?? 25;
    this.Tamb = opts.Tamb ?? 25;
    this.C = opts.C ?? 200;
    this.Rth = opts.Rth ?? 2;
    this.Tmax = opts.Tmax ?? 130;
    this.Tburn = opts.Tburn ?? 250;
  }

  /**
   * Advance one timestep.
   * @param dt seconds
   * @param P  dissipated power, W
   */
  step(dt: number, P: number): void {
    if (this.dead) return;
    if (!Number.isFinite(P)) P = 0;

    this.T += (dt * (P - (this.T - this.Tamb) / this.Rth)) / this.C;

    // A NaN here would poison every downstream readout and the solver would
    // keep integrating it silently. Pin it to the burn temperature instead so
    // the failure is visible rather than invisible.
    if (!Number.isFinite(this.T)) this.T = this.Tburn;

    if (this.T > this.Tmax) {
      const over = this.T - this.Tmax;
      this.damage += dt * over * 0.0005;
      this.smoke = Math.min(1, this.smoke + dt * over * 0.002);
    } else if (this.smoke > 0) {
      // Cool down and the smoke clears.
      this.smoke = Math.max(0, this.smoke - dt * 0.15);
    }

    if (this.T > this.Tburn || this.damage >= 1) {
      this.dead = true;
      this.smoke = 1;
    }
  }

  /** Back to cold and undamaged. Used by Clear. */
  reset(): void {
    this.T = this.Tamb;
    this.damage = 0;
    this.dead = false;
    this.smoke = 0;
  }
}
