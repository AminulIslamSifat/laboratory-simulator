Rajshahi University of Engineering & Technology
Department of Electrical & Electronic Engineering
Course No.: EEE - 2152
Course Title: Electrical Drives and Instrumentations Sessional
Experiment No.
: 06
Experiment Title : Experimental Analysis for Finding the
Synchronous Reactance of a
Three-Phase Synchronous Generator
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
Date of Experiment : 6 September 2026
Date of Submission : 25 September 2026EXPERIMENT NO: 06
Experimental Analysis for Finding the
Synchronous Reactance
of a Three-Phase Synchronous Generator
1. Objective
The main purpose of this experiment is to determine the synchronous reactance
(Xs) of a three-phase synchronous generator, or alternator. To get there, two
standard tests are carried out — the open circuit test and the short circuit test.
From the readings collected during these tests, the synchronous impedance (Zs)
and the armature resistance (Ra) are also worked out.
2. Theory
A synchronous generator converts mechanical energy into three-phase AC electrical
energy. When current flows through the armature winding, the winding offers an
internal opposition known as the synchronous impedance (Zs). This impedance has
two components — the armature resistance (Ra) and the synchronous reactance
(Xs). In phasor form it is written as:
Zs = Ra + jXs
Since the resistive and reactive parts sit at right angles to each other, the
magnitude of the synchronous impedance becomes:
Zs = √(Ra² + Xs²)
Once Zs and Ra are both known, the synchronous reactance can be pulled out
directly:
Xs = √(Zs² − Ra²)
The synchronous impedance itself is found by running the open circuit and short
circuit tests at the same field current. At any particular field current, if Voc is the
open circuit voltage per phase and Isc is the short circuit current, then:
Zs = Voc / Isc
The armature resistance is measured as a DC value with a multimeter. Because the
AC resistance of a winding is slightly higher than its DC resistance, a small
correction factor of 1.4 is applied:
Ra = 1.4 × Rdc
3. Apparatus






Three-phase synchronous generator (alternator) coupled to a DC motor as the
prime mover
DC motor with starter
220 V DC supply
0–230 V AC autotransformer
Rheostats of 500 Ω and 3000 Ω for field current control
Ammeter and voltmeter
Connecting wires
4. Circuit Diagram
Figure 1: Circuit arrangement for the open circuit and short circuit tests.
5. Data Table
Armature resistance measured with the multimeter: Rdc = 18.5 Ω
If (A)Voc (V)Isc (A)
0.100155.10.182
0.130203.90.242
0.199302.40.392
0.290398.80.575
6. Calculation
The DC resistance is first converted into the effective armature resistance:
Ra = 1.4 × Rdc = 1.4 × 18.5 = 25.9 Ω
For every set of readings, Zs is obtained from Voc / Isc and Xs is then found using
√(Zs² − Ra²):
If (A)
Voc (V)
Isc (A)
Zs = Voc/Isc
Xs =
√(Zs²−Ra²)(Ω)(Ω)
0.100155.10.182852.20851.81
0.130203.90.242842.56842.16
0.199302.40.392771.43770.99
0.290398.80.575693.57693.08
Sample calculation for the first row (If = 0.100 A):
Zs = 155.1 / 0.182 = 852.20 Ω
Xs = √(852.20² − 25.9²) = √(726244.8 − 670.8) = 851.81 Ω
Taking the average of the four reactance values:
Xs(avg) = (851.81 + 842.16 + 770.99 + 693.08) / 4 ≈ 789.5 Ω
7. Result




DC armature resistance, Rdc = 18.5 Ω
Effective armature resistance, Ra = 25.9 Ω
Synchronous impedance, Zs, lies between roughly 693.6 Ω and 852.2 Ω over the
tested field-current range.
Synchronous reactance, Xs, lies between roughly 693.1 Ω and 851.8 Ω, giving an
average value of about 789.5 Ω.
8. Discussion
Looking at the numbers, both Zs and Xs fall a little as the field current rises. The
reason behind this is magnetic saturation. Once the core begins to saturate, the
generated voltage no longer grows in proportion to the field current, so the ratio
Voc / Isc gradually drops. In an ideal machine Zs would stay fixed, but a real
machine always shows this mild variation.
Another point worth noticing is how small Ra is (25.9 Ω) compared with Zs, which
stays somewhere between 694 Ω and 852 Ω. Because Ra is so tiny next to Zs, the
value of Xs turns out almost identical to Zs in every single row. This makes it clear
that the synchronous reactance is by far the dominant part of the synchronous
impedance.
9. Conclusion
The synchronous reactance of the three-phase synchronous generator was
determined successfully using the open circuit and short circuit tests. The effective
armature resistance came out to 25.9 Ω, which is very small compared to the
synchronous impedance of roughly 694–852 Ω. As a result, the synchronous
reactance is almost equal to the synchronous impedance. The slight drop in Zs andXs at higher field currents is caused by magnetic saturation. The experiment also
confirms the fundamental relation Zs = Ra + jXs, and shows that this method offers
a simple and reliable way to find the internal reactance of an alternator.
