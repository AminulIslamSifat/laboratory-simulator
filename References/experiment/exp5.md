Rajshahi University of Engineering & Technology
Department of Electrical & Electronic Engineering
Course No.: EEE - 2152
Course Title: Electrical Drives and Instrumentations Sessional
Experiment No.
: 05
Experiment Title : Observation of the characteristics of a single
phase induction motor
Submitted by:
Md Aminul Islam Sifat
Roll: 2403123
Section: C
Session: 2024-25
Submitted to:
Tasnim Sarker Joyeeta
Assistant Professor
Dept. of Electrical & Electronic
Engineering
& Engineering, RUET
Date of Experiment : 23 August 2026
Date of Submission : 6 September 2026Experiment No: 05
Observation of the Characteristics of a Single-
Phase Induction Motor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Objective




Understand the construction and working principle of a single-phase induction
motor.
Connect and energize both the main (primary) and auxiliary (starting) windings
properly.
Measure and compare the line voltage and line current with and without the
starting capacitor.
Analyze how the capacitor influences starting behavior and overall current draw.
2. Theory
A standard single-phase AC supply produces a pulsating magnetic field rather than
a rotating one. This means the field simply pushes back and forth along a single
axis, which by itself cannot generate the torque needed to start the motor from
rest.
To visualize this, imagine trying to pedal a bicycle when both pedals are perfectly
vertical — one at the top and one at the bottom. Pushing straight down produces no
rotational force; the system is stuck. Similarly, a single-phase motor without any
assistance will just hum and vibrate without turning.
From a theoretical standpoint, this pulsating field can be resolved into two equal
and opposite rotating fields that cancel each other out at standstill, resulting in zero
net starting torque.
How the Capacitor Solves This
To create actual rotation, we need a rotating magnetic field. This is achieved by
introducing a second winding and a capacitor:



Auxiliary Winding: A secondary coil is placed physically 90° apart from the main
winding inside the stator.
Starting Capacitor: A capacitor is connected in series with this auxiliary winding.
It causes the current through the auxiliary coil to lead the supply voltage,
creating a phase difference between the currents in the two windings.
Result: Because the two currents are now out of phase, their combined magnetic
fields produce a revolving field that mimics a two-phase supply, giving the rotor
the initial push it needs to start spinning.The capacitor also changes the impedance of the auxiliary branch, which alters both
the phase angle and the magnitude of the total line current. As a result, the power
factor and efficiency of the motor differ noticeably between the "with capacitor" and
"without capacitor" conditions — even though both windings receive the same
supply voltage.
3. Apparatus Required







Single-Phase Induction Motor
Single-Phase AC Supply (230V, 50Hz)
AC Ammeter (0–5A range)
AC Voltmeter (0–300V range)
Starting Capacitor (C)
Connecting Wires
Variac / Autotransformer (optional, for voltage regulation)
4. Circuit Diagram
(Refer to the attached circuit diagram showing the main winding and auxiliary
winding with capacitor connected in parallel across the single-phase supply, with
ammeter in series and voltmeter in parallel.)
5. Procedure






Step 1: The circuit was assembled according to the diagram, with the main
winding and the auxiliary winding (in series with capacitor C) connected in
parallel across the single-phase AC supply. An ammeter was placed in series to
measure line current, and a voltmeter was connected in parallel to monitor
supply voltage.
Step 2: All connections were carefully verified before energizing the circuit.
Step 3: The single-phase supply was switched on, exciting the main (primary)
winding first.
Step 4: With both windings energized but the capacitor disconnected from the
auxiliary circuit, the supply voltage and line current readings were recorded.
Step 5: The capacitor was then connected in series with the auxiliary winding,
and a fresh set of voltage and current readings was taken under this condition.
Step 6: Both sets of observations were tabulated and compared to evaluate the
effect of the capacitor.
6. Observation Table
Sl. No.
1
Condition
With Capacitor
(Auxiliary winding
Supply Voltage (V)Line Current (A)
2172.1energized through
C)
2
Without Capacitor
(Both windings, no
capacitor)
228
3.5
7. Discussion
Self-Starting Capability
The capacitor introduces the necessary phase shift between the main and auxiliary
winding currents, producing a rotating magnetic field. Without this phase shift, the
motor would remain stationary and merely hum. The experimental results confirm
that the motor starts smoothly and reliably when the capacitor is in the circuit.
Current Reduction & Efficiency Improvement
Adding the capacitor reduced the line current from 3.5 A to 2.1 A — a significant
drop of approximately 40%. This improvement occurs because the capacitor
corrects the phase relationship between voltage and current, effectively raising the
power factor. A higher power factor means less reactive power is wasted, reducing
I²R losses in the wiring and improving overall motor efficiency.
Voltage Variations
Minor differences in supply voltage between the two test conditions (217 V vs. 228
V) were observed, likely due to natural fluctuations in the incoming AC mains. For
more precise and repeatable results in future experiments, using a variac or
regulated supply would help maintain a constant voltage across both tests.
8. Conclusion
This experiment successfully demonstrated the role of the starting capacitor in a
single-phase induction motor. Connecting the capacitor in series with the auxiliary
winding reduced the line current from 3.5 A to 2.1 A while enabling reliable self-
starting. These results confirm that the capacitor improves the phase shift between
windings, enhances the power factor, and allows the motor to operate more
efficiently. The observations align well with the theoretical expectations of split-
phase motor operation.
