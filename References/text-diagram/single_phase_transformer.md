# Single-Phase Transformer

> [!NOTE]
> Reference sheet for the panel traced from `simplified-image-diagram/single_phase_transformer.jpg`.
> Rated 230 V / 50 Hz primary, tapped secondary for the lab exercises.

## Nameplate

| Parameter | Value |
| --- | --- |
| Type | Single-phase, shell-form |
| Primary | 230 V · 50 Hz |
| Secondary taps | 2U1 · 2U2 · 2U3 · 2U4 · 3U1 · 3U2 · 3U3 |
| Rating | 1 kVA (lab-scale) |
| Cooling | AN (air natural) |
| Insulation class | B |

## Printed terminals

```
PRIMARY            SECONDARY
  P230  ──┐          ┌── 2U1   (outer, high)
          │          ├── 2U3   (inner, below-right)
          │          ├── 2U4   (outer)
  (coil)  │          ├── 2U2   (inner)
          │          ├── 3U1   (outer)
  (coil)  │          ├── 3U2   (outer, low)
          │          └── 3U3   (inner, low)
```

## Notes

- The primary coil loop is printed with **230V** inside it.
- The secondary has **two columns** of taps: an OUTER column at x ≈ 955 (ref px) and an INNER column hugging the winding at x ≈ 705.
- The inner column sits **lower** than the outer one — this is the printed layout, not a drawing error.
- The third red jack on the primary side connects to the bottom of the primary coil.

## Model parameters (js/engine/devices.js)

| Param | Value | Meaning |
| --- | --- | --- |
| `Rmag` | core loss resistance | no-load current |
| `Gref` | reflected load conductance | clamped at 0.4 S |
| `Irated` | 1.4 A | secondary rated current |
