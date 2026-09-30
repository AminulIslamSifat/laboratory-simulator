Rajshahi University of Engineering & Technology
Department of Electrical & Electronic Engineering
Course No.: EEE - 2152
Course Title: Electrical Drives and Instrumentations Sessional
Experiment No.
: 04
Experiment Title : Observation of external Characteristics curve
of a DC shunt Generator
Submitted by:
Shadow
Roll: 2403000
Section: C
Session: 2024-25
Submitted to:
Course Instructor
Assistant Professor
Dept. of Electrical & Electronic
Engineering
& Engineering, RUET
Date of Experiment : 2 August 2026
Date of Submission : 23 August 2026Experiment No.: 04
Experiment Name: Observation of External Characteristic Curve of a DC Shunt Generator
Objectives
We needed to get the external characteristic of our DC shunt generator — basically plot
terminal voltage against load current and see how badly the voltage sags as we pile on more
load.
Theory
The field winding sits in parallel with the armature — that’s what makes it “shunt.” Load
connects across the output terminals. When you draw current, terminal voltage drops for three
reasons: armature circuit resistance (I²R loss in windings and brushes), armature reaction
(armature flux opposes the main field flux, weakening it), and field current reduction (since the
field coil is powered from the terminals, lower Vₜ means less field current, which weakens flux
further — a feedback loop specific to shunt machines).
Vₜ = Eₗ − IₐRₐ
Voltage regulation: [(E₀ − Vₜ) / Vₜ] × 100, where E₀ is no-load voltage and V ₜ is full-load
voltage.
Required Apparatus
DC generator rated at 250 V, 18 A. Prime mover was an induction motor running at 1420 rpm.
Load bank was resistive, 108 Ω rated at 2 A. We had a voltmeter (0–450 V range), two
ammeters (0–10 A for load current, 0–2 A for field current), a field rheostat, and the usual
wires and safety switch.
Circuit Diagram
Fig. 4.1 shows the setup — shunt field with rheostat in series, armature feeding the load through an
ammeter, voltmeter across the output.Procedure
We coupled the generator to the motor and brought it up to rated speed. Adjusted the field
rheostat until the no-load voltage built up to around 220 V. Recorded that as our baseline —
V₀ = 220 V, Iᵐ = 0.088 A.
Then we started switching in resistive loads one step at a time. At each step we noted down the
load current, field current, and terminal voltage. Kept going until we hit the maximum safe
load. Disconnected everything after and compiled the readings.
Data Table
Obs.
No.
1
2
3
4
5
6
7
8
9
10
11
12
13
14
Graph
Load Current, Iₗ (A)Terminal Voltage, Vₜ (V)Field Current, Iᵐ (A)
0.000
0.456
0.460
0.502
0.526
0.543
0.560
0.599
0.617
0.641
0.654
0.710
0.805
0.836220.0
196.2
194.0
190.6
188.0
186.7
185.5
182.0
180.1
177.6
176.1
169.3
154.0
148.50.088 (No load)
0.089
0.083
0.083
0.081
0.082
0.082
0.079
0.079
0.078
0.078
0.076
0.071
0.069Fig. 4.2 plots Vₜ versus Iₗ. The curve droops steadily from 220 V at no load down to 148.5 V at 0.836
A.
Calculations
Voltage regulation worked out to:
E₀ = 220 V, Vₜ at full load = 148.5 V
Regulation = [(220 − 148.5) / 148.5] × 100 = 48.15%
That’s pretty high, but expected for a shunt machine where the field isn’t independently
excited.
Conclusion
The external characteristic came out as a drooping curve, exactly what theory predicts. Voltage
fell from 220 V to 148.5 V as load current went from zero to 0.836 A. All three mechanisms
— IR drop, armature reaction, and field current reduction — contributed to the drop.
Discussion
Up to about 0.65 A the drop is gradual, then it steepens between 0.71 A and 0.836 A — that’s
where armature reaction and falling field current compound. Field current went from 0.089 A
to 0.069 A, confirming the shunt feedback effect.
48.15% regulation is high but normal for a shunt machine. Some scatter from meter resolution
and brush contact variations, nothing significant.
