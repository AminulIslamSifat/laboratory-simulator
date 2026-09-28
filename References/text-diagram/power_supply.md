+---------------------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                                       |
|        LIGNE VARIABLE DE 0 A 435V 502 A CA TRIPHASEE 3 A     LINEA VARIABLE DE 0 E CAPASICA RE 0 A 500V DC 3.5E 3 A 190V DC 2 A      |
|        LINEA VARIABLE 0 A 450 V A CA TRIPASEE 2 A            LINEA PUENTE DE ALIMENTACION / FONTE DE ALIMENTAÇAO                      |
|                                                     L13A                                                                              |
|                                                 L1 A    L5PA                                                                          |
|       +----------+                             ON  \     /                                                 +----------+               |
|       | --- ESAM |                                  \   /                                                  | --- ESAM |               |
|       +----------+                                   \ /                                                   +----------+               |
|                                                       *                                                                               |
|            ON                                                                                                       P1                |
|          MARCHE                                                                                                  +-----+              |
|        +--------+  +-----+                                             (     )                                   |E.TN |              |
|        | AEG    |  |E.TN |                                           /         \                                 |     |              |
|        |        |  |     |                                          |     |     |                                |  0-I|              |
|        |        |  |  0-I|                                          |     v     |                                |   |              |
|        +--------+  +-----+                                           \         /                                 +-----+              |
|           OFF                                                          (     )                                                        |
|          ARRET                                                            S1                                                          |
|                                                                        ON /                                                           |
|                                                                        OFF  *  \ ON                                                   |
|          L1      L2      L3      L4                                             \ OFF                                                 |
|         (O)     (O)     (O)     (O)    (O)=                                O      (O)     (O)                                         |
|        Black   Black   Black    Blue   Yellow                             White   Red    Black                                        |
+---------------------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                                       |
|            THREE-PHASE FIXED LINE 400 V 10 A                       FIXED LINE 6/12/24 V DC 2 A                     FIXED LINE 50V V DC 2 A  |
|            LINEA FIJA TRIFASICA 400 V 10 A                         FIXED LINE 0/12/24 V DC 2 A                     FIXED LINE 0/50 V DC 2 A |
|            LINEA FIXA TRIFASICA 400 V 10 A                         LINEA FIJA 0/12/24 V DC 2 A                     LINEA FIJA 50 V DC 2 A   |
|            LINEA FIXA TRIFASICA 400 V 10 A                         LINEA FIXA 0/12/24 V DC 3 A                     LINEA FIXA 220 V DC 5 A  |
|                                                                                                                                       |
|               ON                                                    P2                                              P3                |
|             MARCHE                                               +-----+                                         +-----+              |
|           +--------+                                  ( )        |E.TN |             ( )             ( )         |E.TN |              |
|           | AEG    |                                             |     |                                         |     |              |
|           |        |                                             |  0-I|                                         |  0-I|              |
|           |        |                                             |     |                                         |     |              |
|           +--------+                                             +-----+                                         +-----+              |
|              OFF                                                    A1 S0 24                                                          |
|             ARRET                                                    \ | /                                                            |
|                                                                       \|/                                                             |
|             ON/MARCHE                                                  *                                         ON/MARCHE            |
|             +-------+                                                  |                                         +-------+            |
|             |  OFF  |                                           +             -                                  |  OFF  |            |
|             | ARRET |                                          (O)           (O)                                 | RESET |            |
|                                                                Red          Black                                +-------+            |
|             L1      L2      L3      L4                                                                              +      -          |
|            (O)     (O)     (O)     (O)    (O)=                                                                     (O)    (O)         |
|           Black   Black   Black    Blue   Yellow                                                                   Red   Black        |
+---------------------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                                       |
|                                                       MAIN LINE                                                                       |
|                                        LIGNE GENERALE   LINEA GENERAL                                                                 |
|                                        LINEA GENERALE   LINHA PRINCIPAL                                                               |
|                                                                                                                                       |
|               ON                        N      N             MAIN SWITCH                      EMERGENCY                               |
|             MARCHE                     +----+ +----+           SIT REG                        EMERGENCY                               |
|          +--------+   +-----+          |E.TN| |E.TN|          MT GERAL                         EMERGENZA                              |
|          | AEG    |   | U>A |          |    | |    |             |                            EMERGENCY               START           |
|          |        |   +-----+          | 0-I| | 0-I|             |                             +-----+                START           |
|          |        |                    |    | |    |             v                            / EMERGENCY \           INICIO          |
|          +--------+                    +----+ +----+             *                           | ( STOP )  |         +----------+       |
|             OFF                                                   \                           \ EMERGENCY /        |  (  )    |       |
|            ARRET                                                   \                             +-----+           |  GREEN   |       |
|                                                                     *                                              +----------+       |
|                                                                                                                                       |
|          ElettronicaVeneta                              POWER SUPPLY                                               mod. AV-1/EV       |
|                                                   ALIMENTATION    FUENTE DE ALIMENTACIÓN                                              |
|                                                   ALIMENTATORE    FONTE DE ALIMENTAÇÃO                                                |
+---------------------------------------------------------------------------------------------------------------------------------------+

