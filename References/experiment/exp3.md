Heaven’s Light is Our Guide
Rajshahi University of Engineering & Technology
Department of Computer Science & Engineering
Course No.: EEE - 2152
Course Title: Electrical Drives and Instrumentations Sessional
Experiment No. : 03
Experiment Title : Determination of Transformer Parameters by
Open Circuit and Short Circuit Tests
Submitted by:
Shadow
Roll: 2403000
Section: C
Submitted to:
Course Instructor
Assistant Professor
Dept. of Electrical & Elec-
tronic Engineering, RUET
Date of Experiment : 26 July 2026
Date of Submission : 2 August 2026Experiment No. : 3
Determination of Transformer Parameters by Open Circuit and Short
Circuit Tests
1. Objective
The aim of this experiment is to find the parameters of the equivalent circuit of a single-phase
transformer using two common tests known as the open circuit (OC) test and short circuit (SC)
test.
During the OC test, the secondary winding is kept open while rated voltage is applied to the
primary side. Since there is no secondary current, the primary current is quite low as the
transformer operates on no load, making it possible to calculate the two excitation parameters:
core loss resistance R₀ and magnetizing reactance X₀.
During the SC test, the secondary side is kept short-circuited while a low voltage is applied on
the primary side to maintain rated current on the secondary side. The magnetizing current is
very low, and thus the parameters calculated give the winding resistance Rᵉₑ and leakage
reactance Xᵉₑ. All parameters are referred to one side.
2. Theory
The equivalent circuit of a single-phase transformer consists of two distinct branches: a shunt
(excitation) branch that models the core behaviour, and a series branch that models the winding
impedance. Determining these parameters directly under full load would require dissipating
large amounts of power in a physical load, making the process inefficient and impractical.
Instead, two indirect tests — the Open Circuit test and the Short Circuit test — allow extraction
of all four parameters with minimal energy consumption.
2.1 Open Circuit (O.C.) Test
In this test, one winding (typically the low-voltage side, for safety and convenience) is
connected to a supply at its rated voltage, while the other winding is left open-circuited. Since
no load current flows in the secondary, the primary draws only the small no-load exciting
current I₀. At this tiny current, the copper loss in the winding is negligible, and the wattmeter
reading therefore represents essentially the core (iron) loss of the transformer.
From the measured quantities — voltage V₀, current I₀, and power W₀ — the shunt branch
parameters are determined as follows:
cos φ₀ = W₀ / (V₀ × I₀)
Iw = I₀ × cos φ₀
Im = I₀ × sin φ₀
R₀ = V₀ / Iw = V₀² / W₀
X₀ = V₀ / Im
2.2 Short Circuit (S.C.) Test
In this test, one winding (typically the high-voltage side) is supplied through a variable low-
voltage source, while the other winding is short-circuited. The applied voltage is graduallyincreased from zero until rated current flows through the windings. The voltage required is
only a small fraction (typically 5–10%) of the rated voltage.
At this reduced voltage, the core flux is proportionally small, and hence the core loss is
negligible. The wattmeter reading therefore represents essentially the total copper (I²R) loss of
the transformer.
From the measured quantities — voltage Vsc, current Isc, and power Wsc — the equivalent
series parameters are:
Zeq = Vsc / Isc
Req = Wsc / Isc²
Xeq = sqrt(Zeq² − Req²)
3. Circuit Diagram
(i) Open Circuit Test:
(ii) Short Circuit Test:4. Apparatus
•
•
•
•
Single-phase transformer
Digital power meter / wattmeter
Variac for supply voltage adjustment
Connecting wires and safety switch
5. Procedure
1. Open-Circuit Test: The secondary winding was made open. The rated voltage was
supplied to the primary side using variac, and the voltmeter, ammeter, active power,
reactive power, apparent power, and power factor values were noted using the meter.
2. Short-Circuit Test: The secondary winding was short-circuited using an ammeter.
The variac was gradually increased from zero till the rated value of current appeared
on the ammeter, and all the meter readings (voltage, current, active power, reactive
power, and power factor) were noted down.
3. The supply was disconnected after each test and readings were recorded.
6. Experimental Data
Table 1: Open-Circuit (O.C.) Test Readings
Quantity
SymbolValueUnit
Phase-to-Neutral VoltageV₀ᴄ230.2V
CurrentI₀ᴄ0.192A
Active PowerP₀ᴄ24.3W
Reactive PowerQ₀ᴄ36.5VAR
Apparent PowerS₀ᴄ43.5VA
Power Factorcosφ₀ᴄ0.56—
Table 2: Short-Circuit (S.C.) Test ReadingsQuantity
SymbolValueUnit
Phase-to-Neutral VoltageVsc20V
CurrentIsc3.8A
Active PowerPsc75.2W
Reactive PowerQsc10.3VAR
Power Factorcosφsc0.99—
7. Calculations
7.1 From the O.C. Test (Shunt Branch)
cosφ₀ᴄ = 24.3 / (230.2 × 0.192) = 24.3 / 44.2 = 0.55
Iw = 0.192 × 0.55 = 0.106 A
Im = 0.192 × sin(56.6°) = 0.192 × 0.835 = 0.160 A
R₀ = 230.2 / 0.106 ≈ 2181 Ω
X₀ = 230.2 / 0.160 ≈ 1436 Ω
7.2 From the S.C. Test (Series Branch)
Zeq = 20 / 3.8 = 5.26 Ω
Req = cosφsc × Zeq = 0.99 × 5.26 ≈ 5.21 Ω
Xeq = sqrt(5.26² − 5.21²) ≈ 0.72 Ω
Table 3: Calculated Equivalent Circuit Parameters
Parameter
SymbolValue
Core-loss (shunt) resistanceR₀≈ 2181 Ω
Magnetizing reactanceX₀≈ 1436 Ω
Equivalent series resistanceReq≈ 5.21 Ω
Equivalent series reactanceXeq≈ 0.72 Ω
8. Discussion and Conclusion
The results from the O.C. and S.C. tests helped to determine the parameters of the equivalent
circuit of the transformer without subjecting it to load, thus saving time and energy. For the
O.C. test, the very small power factor (0.56) and current values indicated that the transformer
was drawing mainly magnetization current, and the wattmeter reading indicated the core loss
of the machine. This resulted in high shunt resistance R₀ and reactance X₀, which is expected
because the magnetization branch takes only a small percentage of the rated current.
The low value of applied voltage (20 V) in the S.C. test was sufficient to circulate the rated
current in the short-circuited winding, while the near-unity power factor (0.99) indicates that
the impedance at this stage is predominantly resistive, thus the wattmeter reading gives a close
value of the copper losses in the windings. The small values of Req and Xeq in comparison
with R₀ and X₀ are in accordance with the usual ratio of series (leakage) to magnetizing
impedance of the transformer.
Small discrepancies in the calculation of apparent power compared to measured values can be
explained by meter reading errors, supply voltage variations, and rounding of measurements.In general, the results are consistent with transformer characteristics, and the obtained
parameters (R₀, X₀, Req, Xeq) can be used for drawing the equivalent circuit diagram and
estimating performance at any load condition.
