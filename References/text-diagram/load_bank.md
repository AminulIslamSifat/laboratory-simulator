# Resistive Load Bank

> [!NOTE]
> Reference sheet for the load bank. No photo reference exists in
> `simplified-image-diagram/` for this unit — the sprite is drawn from the
> nameplate data and the physical layout of the bench.

## Nameplate

| Parameter | Value |
| --- | --- |
| Type | Resistive, step-switched |
| Steps | 4 (binary weighted) |
| Max power | 500 W |
| Max current | 5 A |
| Max voltage | 250 V DC / 250 V AC |
| Cooling | AN |

## Terminals

| Terminal | Function |
| --- | --- |
| `A` | Load + |
| `B` | Load − |

> [!IMPORTANT]
> The load bank has only **two** terminals. There is no earth reference — it
> floats with the circuit it is connected across. This is why it works
> equally well in the DC machine experiments (Exp 03, Exp 04) and any AC
> setup without modification.

## Model parameters (js/engine/devices.js)

| Param | Value | Meaning |
| --- | --- | --- |
| `Rstep` | per-step resistance | binary weighted |
| `Pmax` | 500 W | thermal dissipation limit |
| `steps` | 4 | number of switchable elements |

## Usage in experiments

| Exp | Connection |
| --- | --- |
| Exp 03 · DC load test | `RACK.out → load_bank.A`, `load_bank.B → DC-` |
| Exp 04 · DC shunt gen | `RACK.out → load_bank.A`, `load_bank.B → dc_machine.A2` |
