/**
 * Dense linear solve for the MNA system, with honest singularity reporting.
 *
 * The old implementation did this on singular input:
 *
 *     if (best < 1e-13) continue;      // silently skip the column
 *     …
 *     x[r] = |M[r][r]| > 1e-13 ? s / M[r][r] : 0;   // silently return 0
 *
 * A floating winding, an open rail, a disconnected subnet — all of them
 * produced a *plausible-looking* voltage vector with no error raised. The
 * rest of the codebase then defended against that garbage with roughly
 * fifteen scattered `isFinite()` guards, because nobody could tell a real
 * reading from a fabricated one.
 *
 * This version returns `singular: true` and names the offending nodes, so
 * the bench can say "node 7 is floating" instead of quietly lying.
 */

/** A pivot below this, relative to the largest diagonal, is rank-deficient. */
const REL_EPS = 1e-7;
const ABS_EPS = 1e-14;

export interface SolveResult {
  /** Solution vector, length n. Zeros fill the unconstrained entries. */
  x: Float64Array;
  /** True if the matrix was rank-deficient — the answer is not trustworthy. */
  singular: boolean;
  /** Number of pivots found. `rank < n` iff singular. */
  rank: number;
  /** Indices of columns that never received a pivot. */
  badColumns: number[];
}

/**
 * Gaussian elimination with partial pivoting.
 *
 * @param A  n×n matrix, row-major, NOT modified (copied internally)
 * @param b  right-hand side, length n, NOT modified
 * @param n  dimension
 */
export function solveLinear(A: Float64Array, b: Float64Array, n: number): SolveResult {
  const M = A.slice();
  const rhs = b.slice();
  const badColumns: number[] = [];

  // Scale the singularity threshold to this matrix. A bench of pure
  // milliohm shunts has a very different natural scale from one with a
  // 1 MΩ voltmeter input; an absolute epsilon gets one of them wrong.
  let maxDiag = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(M[i * n + i]);
    if (v > maxDiag) maxDiag = v;
  }
  const threshold = Math.max(ABS_EPS, REL_EPS * maxDiag);

  let rank = 0;

  for (let col = 0; col < n; col++) {
    // Partial pivot: pick the largest magnitude in this column at or below
    // the diagonal. Never divide by a small number when a big one exists.
    let piv = -1;
    let best = threshold;
    for (let r = col; r < n; r++) {
      const v = Math.abs(M[r * n + col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }

    if (piv < 0) {
      // No usable pivot. Record it and move on — do NOT pretend the column
      // was eliminated.
      badColumns.push(col);
      continue;
    }

    if (piv !== col) {
      for (let c = col; c < n; c++) {
        const t = M[piv * n + c];
        M[piv * n + c] = M[col * n + c];
        M[col * n + c] = t;
      }
      const t = rhs[piv];
      rhs[piv] = rhs[col];
      rhs[col] = t;
    }

    const d = M[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r * n + col] / d;
      if (f === 0) continue;
      M[r * n + col] = 0;
      for (let c = col + 1; c < n; c++) {
        M[r * n + c] -= f * M[col * n + c];
      }
      rhs[r] -= f * rhs[col];
    }
    rank++;
  }

  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    const d = M[r * n + r];
    if (Math.abs(d) < ABS_EPS) {
      x[r] = 0;
      continue;
    }
    let s = rhs[r];
    for (let c = r + 1; c < n; c++) {
      s -= M[r * n + c] * x[c];
    }
    x[r] = s / d;
  }

  return {
    x,
    singular: badColumns.length > 0,
    rank,
    badColumns
  };
}
