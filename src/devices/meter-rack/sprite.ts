/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, screw, panel, _rr, _cc, _tt, _lv, _screw, _screws, _jack, _socket, _lamp, _db9, _iwy, _lu } from '../_shared/svg.js';
export function spriteMeterRack(){
  var W = 560, H = 420;
  var s = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 1195 896" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ─── cabinet ───
  s += _rr(0,0,1195,896,'#9a9a9a');
  s += _rr(37,0,1124,30,'#a2a2a2');
  s += _rr(37,30,35,850,'#3a3a3a','#111',1.4);
  s += _rr(1126,30,35,850,'#3a3a3a','#111',1.4);
  s += _rr(37,811,1124,85,'#a2a2a2');
  s += _rr(68,101,1063,710,'#ecece4','#333',1.6);
  s += _screw(82,115)+_screw(1117,115)+_screw(82,797)+_screw(1117,797);

  // row separators (double lines)
  s += _rr(68,241,1063,1.2,'#555')+_rr(68,264,1063,1.2,'#555');
  s += _rr(68,398,1063,1.2,'#555')+_rr(68,420,1063,1.2,'#555');
  s += _rr(68,554,1063,1.2,'#555')+_rr(68,576,1063,1.2,'#555');
  s += _rr(68,706,1063,1.2,'#555')+_rr(68,727,1063,1.2,'#555');

  // ─── ROW 1 (y101..241) — bays 68|206|479|719|893|1126 ───
  s += _rr(206,101,1.4,140,'#888');
  s += _rr(479,101,1.4,140,'#888');
  s += _rr(719,101,1.4,140,'#888');
  s += _rr(893,101,1.4,140,'#888');
  s += spriteSYNCSCOPY();
  s += spriteVIPSModule();   // traced module (already correct)
  s += spriteMINSSCOPY();
  s += spriteVIPS2();
  s += spriteOutletBay();

  // ─── ROW 2 (y264..398) — bays 68|223|479|685|893|1126 ───
  s += _rr(223,264,1.4,134,'#888');
  s += _rr(479,264,1.4,134,'#888');
  s += _rr(685,264,1.4,134,'#888');
  s += _rr(893,264,1.4,134,'#888');
  s += spriteAAPower();
  s += spriteDINMeters();
  s += spriteOutletR2();
  s += spriteCounter();

  // ─── ROW 3 (y420..554) — bays 68|479|685|1122 ───
  s += _rr(479,420,1.4,134,'#888');
  s += _rr(685,420,1.4,134,'#888');
  s += spriteIWYBay();
  s += spriteAZ67_R3();
  // bay 3 — blank panel
  s += _rr(685,420,437,134,'#c8c8c2','#333',1);
  s += _screw(695,430)+_screw(1112,430)+_screw(695,544)+_screw(1112,544);

  // ─── ROW 4 (y576..706) — bays 68|289|479|685|893|1122 ───
  s += _rr(289,576,1.4,130,'#888');
  s += _rr(479,576,1.4,130,'#888');
  s += _rr(685,576,1.4,130,'#888');
  s += _rr(893,576,1.4,130,'#888');
  // bay 1 — blank panel
  s += _rr(68,576,221,130,'#c8c8c2','#333',1);
  s += _screw(78,586)+_screw(279,586)+_screw(78,696)+_screw(279,696);
  s += spriteIWYBay_R4();
  s += spriteAZ68_R4();
  s += spriteAZ67_R4();
  // bay 5 — blank panel
  s += _rr(893,576,229,130,'#c8c8c2','#333',1);
  s += _screw(903,586)+_screw(1112,586)+_screw(903,696)+_screw(1112,696);

  // ─── BOTTOM STRIP (y727..811) ───
  s += _screw(82,741)+_screw(294,741)+_screw(412,741)+_screw(554,741)+_screw(751,741)+_screw(1117,741);
  s += _screw(82,797)+_screw(294,797)+_screw(412,797)+_screw(554,797)+_screw(751,797)+_screw(1117,797);

  return s + '</svg>';
}

function spriteVIPSModule(){
  // ref bay x206..479 y101..241
  var s = '';
  s += _rr(206,101,273,140,'#ecece4','#444',1);
  s += _screw(216,112)+_screw(469,112)+_screw(216,230)+_screw(469,230);
  s += _tt(474,116,'AZ-VIPS',12,'700','#111','end');
  s += _rr(217,120,93,92,'#e0e0d8','#111',1.3,3);
  s += _rr(225,128,77,58,'#5aa8de','#0a2530',1);
  // live readout + its unit; the V / A / W switch and the + / − input
  // banks for this display live on the control strip (see spriteControlPanelA)
  s += _lv(259,170,'d1',22);
  s += _lu(297,180,'d1',12);
  s += _tt(415,124,'VOLTAGE MEASUREMENT',6,'700','#333');
  s += _tt(415,132,'TEMP -20/150C',5.5,'400','#333');
  s += _jack(330,155,8);
  s += '<path d="M330,163 L330,172 L335,177 L325,183 L335,189 L330,195 L330,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(330,210,8);
  s += _tt(365,185,'RAUDS',6,'400','#333');
  s += _cc(350,148,8,'#8a8a86','#000',1.2)+_cc(350,148,3.5,'#151515');
  s += _cc(376,148,8,'#8a8a86','#000',1.2)+_cc(376,148,3.5,'#151515');
  s += _cc(402,148,8,'#8a8a86','#000',1.2)+_cc(402,148,3.5,'#151515');
  s += _cc(428,148,8,'#8a8a86','#000',1.2)+_cc(428,148,3.5,'#151515');
  s += _tt(350,140,'A1',5.5,'400','#333')+_tt(376,140,'B1',5.5,'400','#333')+_tt(402,140,'B2',5.5,'400','#333')+_tt(428,140,'D',5.5,'400','#333');
  s += _jack(350,170,7)+_jack(376,170,7)+_jack(402,170,7);
  s += _jack(350,208,7)+_jack(376,208,7)+_jack(402,208,7);
  s += _tt(350,222,'R',5.5,'400','#333')+_tt(376,222,'D',5.5,'400','#333')+_tt(402,222,'C',5.5,'400','#333');
  s += '<path d="M410,170 L440,170 L440,208 L410,208" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _tt(465,182,'VOLTAGE',5,'400','#333')+_tt(465,190,'REAL RANGE',4.5,'400','#333')+_tt(465,198,'AS HOLD',4.5,'400','#333');
  return s;
}

function spriteSYNCSCOPY(){
  // ref bay x68..206 y101..241
  var s = '';
  s += _rr(68,101,138,140,'#ecece4','#333',1);
  s += _screw(78,112)+_screw(196,112)+_screw(78,230)+_screw(196,230);
  // SYNC SCOPY labelled box with two DB9 connectors
  s += _rr(84,122,82,32,'#f4f4ee','#333',1);
  s += _tt(125,131,'SYNC SCOPY',5,'700','#333');
  s += _db9(88,138,34)+_db9(126,138,34);
  // AZ POWER SUPPLY label
  s += _tt(116,164,'AZ POWER SUPPLY',6,'700','#333');
  // framed Schuko outlet
  s += _rr(88,174,56,54,'#f4f4ee','#333',1.2,2);
  s += _cc(116,201,20,'#dcdcd4','#555',1.2);
  s += _cc(108,197,2.2,'#222')+_cc(124,197,2.2,'#222')+_cc(116,209,2.2,'#222');
  // ALARM pair on right edge
  s += _jack(183,160,8);
  s += '<path d="M183,168 L183,175 L188,180 L178,186 L188,192 L183,198 L183,204" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(183,210,8);
  s += _tt(160,182,'ALARM',5.5,'400','#333');
  return s;
}

function spriteMINSSCOPY(){
  // ref bay x479..719 y101..241
  var s = '';
  s += _rr(479,101,240,140,'#ecece4','#333',1);
  s += _screw(490,112)+_screw(707,112)+_screw(490,230)+_screw(707,230);
  // MINS SCOPY labelled box
  s += _rr(495,122,105,32,'#f4f4ee','#333',1);
  s += _tt(547,131,'MINS SCOPY',5,'700','#333');
  s += _db9(500,138,42)+_db9(550,138,42);
  s += _tt(547,165,'AC TONER OUTPUT',6,'700','#333');
  // dark DIN rounded-hex body
  s += '<path d="M525,178 L562,175 L600,190 L600,220 L562,235 L525,232 Z" fill="#1a1a1a" stroke="#000" stroke-width="1.3"/>';
  s += _rr(548,188,26,30,'#2a2a2a','#111',1,2);
  s += _cc(556,197,2.5,'#555')+_cc(566,197,2.5,'#555');
  s += _rr(553,205,16,4,'#333')+_rr(553,212,16,4,'#333');
  // ALARM pair + zigzag
  s += _jack(575,155,8);
  s += '<path d="M575,163 L575,172 L580,177 L570,183 L580,189 L575,195 L575,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(575,210,8);
  s += _tt(548,186,'ALARM',5.5,'400','#333');
  // LCD bezel + buttons on right
  s += _rr(612,120,93,92,'#e0e0d8','#111',1.3,3);
  s += _rr(620,128,77,58,'#5aa8de','#0a2530',1);
  s += _lv(654,170,'d2',22);
  s += _lu(692,180,'d2',12);
  return s;
}

function spriteVIPS2(){
  // ref bay x719..894 y101..241 — jack cluster + label only
  var s = '';
  s += _rr(719,101,175,140,'#ecece4','#333',1);
  s += _screw(729,112)+_screw(884,112)+_screw(729,230)+_screw(884,230);
  s += _tt(888,116,'AZ-VIPS',12,'700','#111','end');
  s += _tt(805,124,'VOLTAGE MEASUREMENT',5.5,'700','#333');
  s += _tt(805,132,'TEMP -20/150C',5,'400','#333');
  s += _jack(748,155,8);
  s += '<path d="M748,163 L748,172 L753,177 L743,183 L753,189 L748,195 L748,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(748,210,8);
  s += _tt(780,185,'RAUDS',5.5,'400','#333');
  s += _cc(775,148,8,'#8a8a86','#000',1.2)+_cc(775,148,3.5,'#151515');
  s += _cc(800,148,8,'#8a8a86','#000',1.2)+_cc(800,148,3.5,'#151515');
  s += _cc(825,148,8,'#8a8a86','#000',1.2)+_cc(825,148,3.5,'#151515');
  s += _cc(850,148,8,'#8a8a86','#000',1.2)+_cc(850,148,3.5,'#151515');
  s += _tt(775,140,'A1',5.5,'400','#333')+_tt(800,140,'B1',5.5,'400','#333')+_tt(825,140,'B2',5.5,'400','#333')+_tt(850,140,'D',5.5,'400','#333');
  s += _jack(775,170,7)+_jack(800,170,7)+_jack(825,170,7);
  s += _jack(775,208,7)+_jack(800,208,7)+_jack(825,208,7);
  s += _tt(775,222,'R',5.5,'400','#333')+_tt(800,222,'D',5.5,'400','#333')+_tt(825,222,'C',5.5,'400','#333');
  s += '<path d="M835,170 L865,170 L865,208 L835,208" stroke="#333" stroke-width="0.9" fill="none"/>';
  return s;
}

function spriteOutletBay(){
  // ref bay x894..1122 y101..241
  var s = '';
  s += _rr(894,101,228,140,'#c8c8c2','#333',1);
  s += _screw(905,112)+_screw(1112,112)+_screw(905,230)+_screw(1112,230);
  // white framed square with Schuko
  s += _rr(920,128,96,100,'#f4f4ee','#111',1.4,3);
  s += _cc(968,178,34,'#c8c8c2','#333',1.2);
  s += _cc(956,178,3,'#222')+_cc(980,178,3,'#222');
  s += '<path d="M951,158 L951,152 M985,158 L985,152" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M962,204 L962,210 M974,204 L974,210" stroke="#333" stroke-width="1.2"/>';
  return s;
}

function spriteAAPower(){
  // ref bay x68..223 y264..398
  var s = '';
  s += _rr(68,264,155,134,'#ecece4','#333',1);
  s += _screw(78,274)+_screw(213,274)+_screw(78,388)+_screw(213,388);
  s += _tt(135,320,'AA POWER SUPPLY',5.5,'700','#333');
  s += _rr(105,340,60,56,'#f4f4ee','#111',1.4,2);
  s += _cc(135,368,22,'#dcdcd4','#555',1.2);
  s += _cc(126,364,2.5,'#222')+_cc(144,364,2.5,'#222')+_cc(135,379,2.5,'#222');
  s += '<path d="M127,351 L127,346 M143,351 L143,346" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M127,385 L127,390 M143,385 L143,390" stroke="#333" stroke-width="1.2"/>';
  s += _rr(168,307,50,32,'#f4f4ee','#111',1);
  s += _tt(193,320,'DC MULTIMETER',4.2,'700','#111');
  s += _tt(193,331,'600V - 25A',4.2,'400','#333');
  s += _jack(184,292,8);
  s += _cc(213,292,8,'#151515','#000',1.2)+_cc(213,292,3.5,'#000');
  s += _jack(184,358,8);
  s += _cc(213,358,8,'#151515','#000',1.2)+_cc(213,358,3.5,'#000');
  s += _tt(184,283,'+',5.5,'700','#333')+_tt(213,283,'-',5.5,'700','#333');
  s += _tt(184,370,'-',5.5,'700','#333')+_tt(213,370,'-',5.5,'700','#333');
  return s;
}

function spriteDINMeters(){
  // ref bay x223..479 y264..398
  var s = '';
  s += _rr(223,264,256,134,'#ecece4','#333',1);
  s += _screw(233,274)+_screw(469,274)+_screw(233,388)+_screw(469,388);
  s += _tt(470,278,'AZ-VIDC',8,'700','#111','end');
  function meter(x0?: any, disp?: any) {
    var t = '';
    t += _rr(x0,295,95,96,'#9a9a94','#333',1.2);
    t += _rr(x0+6,301,83,18,'#5a5a56','#222',0.8);
    t += _tt(x0+26,314,'ENTER',3.2,'400','#ddd');
    t += _tt(x0+64,314,'CLEAR',3.2,'400','#ddd');
    t += _rr(x0+6,323,83,50,'#3a3a38','#111',1);
    t += _rr(x0+10,327,75,42,'#5aa8de','#0a2530',1);
    t += _lv(x0+44,357,disp,16);
    t += _lu(x0+66,364,disp,8);
    t += _rr(x0+6,378,83,10,'#3a3a38','#111',0.8);
    return t;
  }
  s += meter(230, 'd3');
  s += meter(333, 'd4');
  s += _jack(440,290,8);
  s += _cc(462,290,8,'#151515','#000',1.2)+_cc(462,290,3.5,'#000');
  s += _rr(425,305,52,32,'#f4f4ee','#111',1);
  s += _tt(451,318,'DC DIKJOSTER',3.6,'700','#111');
  s += _tt(451,329,'010Y - 25A',3.6,'400','#333');
  s += _jack(440,360,8);
  s += _cc(462,360,8,'#151515','#000',1.2)+_cc(462,360,3.5,'#000');
  s += _tt(440,283,'+',5,'700','#333')+_tt(462,283,'-',5,'700','#333');
  s += _tt(440,370,'-',5,'700','#333')+_tt(462,370,'-',5,'700','#333');
  return s;
}

function spriteOutletR2(){
  // ref bay x479..685 y264..398 — grey DIN panel with framed Schuko
  var s = '';
  s += _rr(479,264,206,134,'#c8c8c2','#333',1);
  s += _screw(489,274)+_screw(676,274)+_screw(489,388)+_screw(676,388);
  s += _rr(496,300,96,96,'#f4f4ee','#111',1.4,2);
  s += _cc(544,348,34,'#c8c8c2','#333',1.2);
  s += _cc(534,348,3,'#222')+_cc(554,348,3,'#222');
  s += '<path d="M529,330 L529,324 M559,330 L559,324" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M529,366 L529,372 M559,366 L559,372" stroke="#333" stroke-width="1.2"/>';
  return s;
}

function spriteCounter(){
  // ref bay x685..893 y264..398 — counter + AC 250SE OUTPUT
  var s = '';
  s += _rr(685,264,208,134,'#ecece4','#333',1);
  s += _screw(695,274)+_screw(884,274)+_screw(695,388)+_screw(884,388);
  // wide counter bezel
  s += _rr(700,308,140,66,'#2a2a2a','#000',1.5);
  s += _rr(710,318,120,46,'#0a0a0a','#111',1);
  s += '<text x="770" y="352" font-family="monospace" font-size="30" font-weight="700" fill="#e02020" text-anchor="middle">00000</text>';
  s += _tt(770,388,'COUNT 000-000',5,'400','#333');
  // red + jack above
  s += _jack(825,292,8);
  s += _tt(812,295,'+',5.5,'700','#333');
  // AOG circle
  s += _cc(825,336,10,'#f4f4ee','#111',1.2);
  s += _tt(825,339,'AOG',4.5,'700','#333');
  // hex connector
  s += '<polygon points="850,308 875,308 883,332 875,356 850,356 842,332" fill="#2a2a2a" stroke="#000" stroke-width="1.3"/>';
  s += _rr(853,318,22,26,'#1a1a1a','#111',1);
  s += _cc(864,326,2.2,'#ccc')+_cc(864,336,2.2,'#ccc');
  s += _tt(862,290,'AC 250SE OUTPUT',5.2,'700','#333');
  s += _cc(825,375,9,'#151515','#000',1.2)+_cc(825,375,4,'#000');
  s += _tt(800,378,'LOTING',4.8,'400','#333');
  s += _tt(800,386,'DET OUT',4.8,'400','#333');
  return s;
}

function spriteIWYBay(){
  // ref bay x68..479 y420..554 — IWY + LETI/LOPS + bypass diagram + AZ68 lamps
  var s = '';
  s += _rr(68,420,411,134,'#ecece4','#333',1);
  s += _screw(78,430)+_screw(469,430)+_screw(78,544)+_screw(469,544);
  // IWY switch
  s += _tt(115,490,'IWY',7,'700','#111');
  s += _rr(133,455,62,80,'#f0f0ea','#111',1.4,3);
  s += _rr(140,462,26,66,'#2a2a2a','#111',1);
  s += _cc(153,478,3,'#888')+_cc(153,510,3,'#888');
  s += _tt(178,478,'ON',5.5,'700','#111');
  s += _tt(178,496,'OO',5.5,'700','#111');
  s += _tt(178,516,'ON',5.5,'700','#111');
  s += _rr(196,468,6,20,'#bcd');s += _rr(196,500,6,20,'#bcd');
  s += _tt(226,497,'ON',7,'700','#111');
  // LETI row
  s += _tt(300,432,'LETI',5.5,'700','#333')+_tt(330,432,'LETI',5.5,'700','#333')+_tt(360,432,'LETI',5.5,'700','#333');
  s += _cc(300,447,9,'#2a2a2a','#000',1.2)+_cc(300,447,4,'#000');
  s += _cc(330,447,9,'#2a2a2a','#000',1.2)+_cc(330,447,4,'#000');
  s += _jack(360,447,9);
  // dashed bypass diagram w/ 3 knife switches + 3 ⊗
  s += '<line x1="300" y1="470" x2="420" y2="470" stroke="#333" stroke-width="0.8" stroke-dasharray="3,2"/>';
  s += '<path d="M300,447 L300,470 M330,447 L330,470 M360,447 L360,470" stroke="#333" stroke-width="0.8"/>';
  s += '<path d="M300,470 L300,500 M330,470 L330,500 M360,470 L360,500" stroke="#333" stroke-width="0.8"/>';
  s += '<path d="M300,485 L330,480 M330,485 L360,480 M360,485 L390,480" stroke="#333" stroke-width="0.8"/>';
  s += _tt(408,455,'ANY',5.5,'400','#333');
  s += _cc(390,470,7,'#f0f0ea','#333',1)+'<path d="M385,465 L395,475 M395,465 L385,475" stroke="#333" stroke-width="0.8"/>';
  s += _cc(415,470,7,'#f0f0ea','#333',1)+'<path d="M410,465 L420,475 M420,465 L410,475" stroke="#333" stroke-width="0.8"/>';
  s += _cc(440,470,7,'#f0f0ea','#333',1)+'<path d="M435,465 L445,475 M445,465 L435,475" stroke="#333" stroke-width="0.8"/>';
  // LOPS row
  s += _tt(300,520,'LOPS',5.5,'700','#333')+_tt(330,520,'LOPS',5.5,'700','#333')+_tt(360,520,'LOPS',5.5,'700','#333');
  s += _cc(300,535,9,'#2a2a2a','#000',1.2)+_cc(300,535,4,'#000');
  s += _cc(330,535,9,'#2a2a2a','#000',1.2)+_cc(330,535,4,'#000');
  s += _jack(360,535,9);
  // AZ68 + 3 lamps at right
  s += _tt(468,432,'AZ68',10,'700','#111','end');
  s += _lamp(408,464,15,'#c81414');
  s += _tt(408,488,'SD',5.5,'700','#333');
  s += _lamp(395,517,15,'#c81414');
  s += _lamp(440,517,15,'#c81414');
  return s;
}

function spriteAZ68_R3(){ return ''; }

function spriteAZ67_R3(){
  // ref bay x479..685 y420..554 — AZ67
  var s = '';
  s += _rr(479,420,206,134,'#ecece4','#333',1);
  s += _screw(489,430)+_screw(675,430)+_screw(489,544)+_screw(675,544);
  s += _tt(675,432,'AZ67',10,'700','#111','end');
  // AMT socket top-left
  s += _tt(540,448,'AMT',5,'700','#333');
  s += _cc(540,462,8,'#2a2a2a','#000',1.2)+_cc(540,462,3.5,'#000');
  s += _tt(522,478,'A',5,'400','#333')+_tt(558,478,'A',5,'400','#333');
  // two big lamps
  s += _lamp(520,500,26,'#c81414');
  s += _lamp(575,500,26,'#c81414');
  // SEG SCOPY diagram on right
  s += _tt(615,448,'SEG',4.5,'400','#333')+_tt(615,455,'SCOPY',4.5,'400','#333');
  s += '<line x1="605" y1="462" x2="672" y2="462" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="605" y1="466" x2="672" y2="466" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="605" y1="470" x2="672" y2="470" stroke="#333" stroke-width="0.7"/>';
  s += '<path d="M614,462 L614,500 M666,462 L666,500" stroke="#333" stroke-width="0.8"/>';
  s += _jack(640,483,7);
  s += _tt(658,478,'LNT',4.5,'400','#333');
  s += '<path d="M640,490 L640,500" stroke="#333" stroke-width="0.8"/>';
  s += '<line x1="630" y1="502" x2="650" y2="502" stroke="#333" stroke-width="1.4"/>';
  s += '<line x1="630" y1="507" x2="650" y2="507" stroke="#333" stroke-width="1.4"/>';
  s += '<path d="M640,507 L632,515 M640,507 L648,515" stroke="#333" stroke-width="0.8"/>';
  s += _cc(624,515,6,'#f0f0ea','#333',0.9)+'<path d="M620,511 L628,519 M628,511 L620,519" stroke="#333" stroke-width="0.7"/>';
  s += _cc(656,515,6,'#f0f0ea','#333',0.9)+'<path d="M652,511 L660,519 M660,511 L652,519" stroke="#333" stroke-width="0.7"/>';
  s += _cc(614,522,7,'#2a2a2a','#000',1.2)+_cc(614,522,3,'#000');
  s += _cc(666,522,7,'#2a2a2a','#000',1.2)+_cc(666,522,3,'#000');
  s += _tt(614,538,'LNT',4.5,'400','#333')+_tt(666,538,'NAUO',4.5,'400','#333');
  return s;
}

function spriteBenchBay(){
  // ref bay x893..1122 y576..706 — bench connections, 4 clickable term dots.
  // Terms: V+, V- (left column), in, out (right column).
  //   V+ / V-  : the voltmeter movement — d1's AZ-VIPS reads across these.
  //   in / out : the shared series shunt — the rack's ammeter movement.
  var s = '';
  s += _rr(893,576,229,130,'#c8c8c2','#333',1);
  s += _screws(893,576,229,130);
  s += _tt(1008,596,'BENCH CONNECTIONS',7,'700','#333');
  // left column — voltage posts
  s += _jack(939,623,10)+_jack(939,672,10);
  s += _tt(912,627,'V+',9,'700','#111','end')+_tt(912,676,'V\u2212',9,'700','#111','end');
  // right column — series current posts
  s += _jack(1020,623,10)+_jack(1020,672,10);
  s += _tt(1046,627,'IN',9,'700','#111','start')+_tt(1046,676,'OUT',9,'700','#111','start');
  // orange markers beside each jack (cue that these are the live binding posts)
  s += _rr(927,634,24,3,'#e87820','none',0);
  s += _rr(927,683,24,3,'#e87820','none',0);
  s += _rr(1008,634,24,3,'#e87820','none',0);
  s += _rr(1008,683,24,3,'#e87820','none',0);
  return s;
}

function spriteIWYBay_R4(){
  // ref bay x289..479 — IWY switch + LETI/LOPS cluster with interconnect diagram
  var s = '';
  s += _screws(289,576,190,130);
  s += _iwy(300,598);
  // top LETI row
  s += _tt(372,590,'LETI',6,'700','#222')+_tt(404,590,'LETI',6,'700','#222')+_tt(436,590,'LETI',6,'700','#222');
  s += _socket(372,606)+_socket(404,606)+_jack(436,606,6);
  // interconnect wire diagram
  s += _rr(358,620,90,26,'none','#888',1);
  s += _cc(368,633,3,'#333')+_cc(420,633,3,'#333')+_cc(410,633,3,'#333');
  s += _tt(395,646,'AMT',5.5,'400','#333');
  // bottom LOPS row
  s += _tt(372,664,'LOPS',6,'700','#222')+_tt(404,664,'LOPS',6,'700','#222')+_tt(436,664,'LOPS',6,'700','#222');
  s += _socket(372,682)+_socket(404,682)+_jack(436,682,6);
  return s;
}

function spriteAZ68_R4(){
  // ref bay x479..685 y576..706 — AZ68: 1 top lamp, 2 lamps on dark box, SD label
  var s = '';
  s += _rr(479,576,206,130,'#ecece4','#333',1);
  s += _screw(489,586)+_screw(675,586)+_screw(489,696)+_screw(675,696);
  s += _tt(675,588,'AZ68',10,'700','#111','end');
  // top lamp
  s += _lamp(565,618,20,'#c81414');
  s += _tt(565,646,'M0',5.5,'700','#333');
  // dark device box with 2 lamps + red button
  s += _rr(520,662,150,44,'#3a3a38','#111',1.4);
  s += _lamp(558,678,19,'#c81414');
  s += _lamp(605,678,19,'#c81414');
  s += _rr(632,660,10,20,'#c81414','#7a0e0e',1);
  s += _cc(535,662,5,'#1a1a1a','#000',1);
  s += _cc(660,662,5,'#1a1a1a','#000',1);
  return s;
}

function spriteAZ67_R4(){
  // ref bay x685..893 y576..706 — AZ67: AMT, red+green lamps, SEG SCOPY diagram
  var s = '';
  s += _rr(685,576,208,130,'#ecece4','#333',1);
  s += _screw(695,586)+_screw(884,586)+_screw(695,696)+_screw(884,696);
  s += _tt(884,588,'AZ67',10,'700','#111','end');
  // AMT
  s += _tt(745,600,'AMT',5,'700','#333');
  s += _cc(745,614,8,'#2a2a2a','#000',1.2)+_cc(745,614,3.5,'#000');
  s += _tt(728,632,'A',5,'400','#333')+_tt(762,632,'A',5,'400','#333');
  // red + green lamps
  s += _lamp(722,662,19,'#c81414');
  s += _lamp(775,662,19,'#1eaa1e');
  // SEG SCOPY diagram right
  s += _tt(858,600,'SEG',4.5,'400','#333')+_tt(858,607,'SCOPY',4.5,'400','#333');
  s += '<line x1="840" y1="614" x2="900" y2="614" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="840" y1="618" x2="900" y2="618" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="840" y1="622" x2="900" y2="622" stroke="#333" stroke-width="0.7"/>';
  s += '<path d="M845,614 L845,660 M893,614 L893,660" stroke="#333" stroke-width="0.8"/>';
  s += _jack(869,635,7);
  s += _tt(886,632,'LNT',4.5,'400','#333');
  s += '<path d="M869,642 L869,652" stroke="#333" stroke-width="0.8"/>';
  s += '<line x1="860" y1="654" x2="878" y2="654" stroke="#333" stroke-width="1.3"/>';
  s += '<line x1="860" y1="658" x2="878" y2="658" stroke="#333" stroke-width="1.3"/>';
  s += _cc(855,668,6,'#f0f0ea','#333',0.8)+'<path d="M851,664 L859,672 M859,664 L851,672" stroke="#333" stroke-width="0.7"/>';
  s += _cc(884,668,6,'#f0f0ea','#333',0.8)+'<path d="M880,664 L888,672 M888,664 L880,672" stroke="#333" stroke-width="0.7"/>';
  s += _cc(845,680,6,'#2a2a2a','#000',1.2)+_cc(845,680,2.5,'#000');
  s += _cc(893,680,6,'#2a2a2a','#000',1.2)+_cc(893,680,2.5,'#000');
  s += _tt(845,694,'SDV',4,'400','#333')+_tt(893,694,'NUU',4,'400','#333');
  return s;
}
