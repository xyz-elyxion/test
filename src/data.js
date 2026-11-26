// East Doncaster Secondary College — campus data.
// Coordinates are the pixel coordinates of the original campus plan (1600 x 1131).
// The scene root is offset by (-800, 0, -565) so the plan is centred on the origin.
// Building heights are in the same pixel units (1px ≈ 0.2 m), so a single storey ≈ 16.

export const PLAN = { width: 1600, height: 1131, cx: 800, cy: 565 };

export const CATEGORIES = {
  arts: { label: 'Performing Arts Centre', color: '0xf0a02a' },
  kblock: { label: 'K Block & Classrooms', color: '0x7b9fe0' },
  reception: { label: 'Reception & Admin', color: '0xa06ad6' },
  sblock: { label: 'S Block', color: '0xe0392f' },
  wellbeing: { label: 'Wellbeing', color: '0xe878bd' },
  library: { label: 'Library & International', color: '0x8b2a7a' },
  maintenance: { label: 'Maintenance', color: '0xe8c39a' },
  dblock: { label: 'D Block', color: '0x3fb54a' },
  canteen: { label: 'Canteen & Careers', color: '0xf4a8d0' },
  cblock: { label: 'C Block', color: '0xffe23a' },
  johnlandy: { label: 'John Landy Centre', color: '0xf5f3a8' },
  stadium: { label: 'Sports Stadium', color: '0x2ad4d4' },
  courts: { label: 'Courts & Fields', color: '0x4a7bd8' },
  wblock: { label: 'W Block', color: '0xdcc9a3' },
  wablock: { label: 'WA Block', color: '0xf2a89a' },
  courtyard: { label: 'Courtyards & Grounds', color: '0xd2d2d2' },
};

// f = storeys, h = explicit height override, top = draw a permanent label
// r = [x, y, width, height] footprint rectangle, s = polygon [[x,y], ...]
export const BUILDINGS = [
  // ---------------------------------------------------------------- Performing Arts
  { n: 'Music Office', c: 'arts', r: [238, 58, 84, 110], f: 2 },
  { n: 'Performing Arts Centre', c: 'arts', r: [322, 58, 160, 110], f: 2, h: 40, top: true,
    d: 'Main auditorium and theatre for music, drama and school productions. Seats the whole school for assemblies.' },
  { n: 'Room P01', c: 'arts', r: [320, 168, 162, 56], f: 2 },
  { n: 'Room P02', c: 'arts', r: [182, 163, 56, 54], f: 1 },

  // ---------------------------------------------------------------- K Block cluster
  { n: 'K16', c: 'kblock', r: [205, 232, 80, 38], f: 1 },
  { n: 'K17', c: 'kblock', r: [283, 222, 62, 32], f: 1 },
  { n: 'K18', c: 'kblock', r: [348, 238, 54, 42], f: 1 },
  { n: 'K15', c: 'kblock', r: [208, 270, 52, 30], f: 1 },
  { n: 'K Block Staff', c: 'kblock', r: [262, 268, 66, 32], f: 1 },
  { n: 'K14', c: 'kblock', r: [172, 312, 62, 34], f: 1 },
  { n: 'K12', c: 'kblock', r: [245, 300, 86, 32], f: 1 },
  { n: 'K11', c: 'kblock', r: [330, 298, 52, 38], f: 2 },
  { n: 'K13', c: 'kblock', r: [168, 348, 74, 46], f: 1 },
  { n: 'Alumni Office', c: 'kblock', r: [244, 336, 48, 44], f: 1 },
  { n: 'K09', c: 'kblock', r: [188, 392, 46, 32], f: 1 },
  { n: 'K10', c: 'kblock', r: [236, 392, 50, 32], f: 1 },
  { n: 'K08', c: 'kblock', r: [188, 432, 46, 32], f: 1 },
  { n: 'K07', c: 'kblock', r: [236, 432, 50, 32], f: 1 },
  { n: 'K19', c: 'kblock', r: [415, 238, 76, 30], f: 1 },
  { n: 'K22', c: 'kblock', r: [515, 68, 46, 56], f: 1 },
  { n: 'K21', c: 'kblock', r: [535, 138, 40, 32], f: 1 },
  { n: 'K20', c: 'kblock', r: [528, 183, 50, 32], f: 1 },
  { n: 'K05', c: 'kblock', r: [323, 522, 42, 32], f: 1 },
  { n: 'K06', c: 'kblock', r: [328, 562, 54, 32], f: 1 },
  { n: 'Staff Room', c: 'kblock', r: [243, 522, 76, 32], f: 1 },
  { n: 'Staff Room', c: 'kblock', r: [243, 562, 76, 32], f: 1 },
  { n: 'K04', c: 'kblock', r: [408, 498, 48, 32], f: 1 },
  { n: 'K01', c: 'kblock', r: [470, 478, 52, 32], f: 1 },
  { n: 'K03 Staff', c: 'kblock', r: [408, 528, 62, 32], f: 1 },
  { n: 'K03', c: 'kblock', r: [408, 558, 48, 32], f: 1 },
  { n: 'K02', c: 'kblock', r: [480, 522, 52, 32], f: 1 },

  // ---------------------------------------------------------------- B block
  { n: 'B01 · Drama Staff', c: 'kblock', r: [595, 145, 85, 95], f: 1 },
  { n: 'B02', c: 'kblock', r: [682, 145, 44, 42], f: 1 },
  { n: 'B03', c: 'kblock', r: [728, 145, 48, 42], f: 1 },
  { n: 'B04', c: 'kblock', r: [778, 145, 78, 42], f: 1 },
  { n: 'B05', c: 'kblock', r: [856, 145, 34, 42], f: 1 },
  { n: 'B07', c: 'kblock', r: [682, 190, 48, 50], f: 1 },
  { n: 'Maths Staff', c: 'kblock', r: [732, 190, 52, 50], f: 1 },
  { n: 'IT', c: 'kblock', r: [786, 190, 60, 50], f: 1 },
  { n: 'B06', c: 'kblock', r: [848, 190, 45, 50], f: 1 },

  // ---------------------------------------------------------------- Reception / Sick bay
  { n: 'Main Reception', c: 'reception', r: [875, 140, 135, 95], f: 2, h: 34, top: true,
    d: 'Front office and visitor sign-in, directly inside the main entrance from George Street.' },
  { n: 'Sick Bay', c: 'reception', r: [1010, 140, 46, 85], f: 1, h: 22 },

  // ---------------------------------------------------------------- S block
  { n: 'S01', c: 'sblock', r: [1065, 140, 76, 40], f: 1 },
  { n: 'S02', c: 'sblock', r: [1142, 140, 50, 40], f: 1 },
  { n: 'S03', c: 'sblock', r: [1194, 140, 62, 40], f: 1 },
  { n: 'S04', c: 'sblock', r: [1258, 140, 52, 40], f: 1 },
  { n: 'S07', c: 'sblock', r: [1065, 182, 70, 40], f: 1 },
  { n: 'S06', c: 'sblock', r: [1136, 182, 56, 40], f: 1 },
  { n: 'Art & Science Staff', c: 'sblock', r: [1194, 182, 62, 36], f: 1 },
  { n: 'S05', c: 'sblock', r: [1258, 182, 52, 42], f: 1 },
  { n: 'S09', c: 'sblock', r: [1330, 148, 60, 44], f: 1 },
  { n: 'S08', c: 'sblock', r: [1330, 194, 60, 42], f: 1 },

  // ---------------------------------------------------------------- Wellbeing
  { n: 'Wellbeing Office', c: 'wellbeing', r: [512, 315, 50, 60], f: 1, h: 22 },
  { n: 'Phillip Gardner Wellbeing Hub', c: 'wellbeing', r: [562, 282, 76, 68], f: 1, h: 24, top: true,
    d: 'Counselling, wellbeing and student support. Named after former principal Phillip Gardner.' },

  // ---------------------------------------------------------------- Canteen / Careers
  { n: 'Careers', c: 'canteen', r: [900, 478, 26, 42], f: 1 },
  { n: 'Canteen', c: 'canteen', r: [926, 478, 140, 42], f: 1, h: 22, top: true },

  // ---------------------------------------------------------------- Library
  { n: 'Library', c: 'library', r: [918, 258, 138, 172], f: 2, h: 36, top: true,
    d: 'Resource centre, study spaces and the International / Integration Office on the ground floor.' },
  { n: 'International / Integration Office', c: 'library', r: [918, 400, 138, 30], f: 1, h: 20 },

  // ---------------------------------------------------------------- Maintenance
  { n: 'Maintenance', c: 'maintenance', r: [1318, 252, 72, 104], f: 1, h: 24 },

  // ---------------------------------------------------------------- D block
  { n: 'D04', c: 'dblock', r: [1298, 368, 50, 40], f: 1 },
  { n: 'D05', c: 'dblock', r: [1350, 368, 52, 40], f: 1 },
  { n: 'D06', c: 'dblock', r: [1442, 418, 50, 46], f: 1 },
  { n: 'D01', c: 'dblock', r: [1108, 425, 64, 50], f: 1 },
  { n: 'D02', c: 'dblock', r: [1172, 425, 64, 52], f: 1 },
  { n: 'D03', c: 'dblock', r: [1236, 425, 68, 48], f: 1 },
  { n: 'D12', c: 'dblock', r: [1108, 480, 62, 48], f: 1 },
  { n: 'D11', c: 'dblock', r: [1170, 480, 60, 48], f: 1 },
  { n: 'D10', c: 'dblock', r: [1230, 480, 62, 48], f: 1 },
  { n: 'D09', c: 'dblock', r: [1292, 480, 60, 48], f: 1 },
  { n: 'D08', c: 'dblock', r: [1352, 480, 54, 46], f: 1 },
  { n: 'D07', c: 'dblock', r: [1406, 480, 54, 46], f: 1 },
  { n: 'D13', c: 'dblock', r: [1108, 535, 66, 44], f: 1 },
  { n: 'D14', c: 'dblock', r: [1178, 535, 66, 44], f: 1 },
  { n: 'D15', c: 'dblock', r: [1244, 535, 66, 44], f: 1 },
  { n: 'D16', c: 'dblock', r: [1312, 535, 66, 44], f: 1 },

  // ---------------------------------------------------------------- C block
  { n: 'Health Office', c: 'cblock', r: [592, 432, 48, 32], f: 1 },
  { n: 'Middle School Office', c: 'cblock', r: [652, 432, 58, 32], f: 1 },
  { n: 'C01', c: 'cblock', r: [722, 442, 68, 44], f: 1 },
  { n: 'C02', c: 'cblock', r: [842, 442, 40, 44], f: 1 },
  { n: 'C09', c: 'cblock', r: [608, 472, 74, 26], f: 1 },
  { n: 'Kitchen / Air Staff', c: 'cblock', r: [748, 472, 84, 26], f: 1 },
  { n: 'C08', c: 'cblock', r: [592, 500, 54, 32], f: 1 },
  { n: 'C07', c: 'cblock', r: [646, 500, 54, 32], f: 1 },
  { n: 'C06', c: 'cblock', r: [700, 500, 52, 32], f: 1 },
  { n: 'C05', c: 'cblock', r: [752, 500, 54, 32], f: 1 },
  { n: 'C04', c: 'cblock', r: [806, 500, 42, 32], f: 1 },
  { n: 'C03', c: 'cblock', r: [848, 500, 40, 32], f: 1 },

  // ---------------------------------------------------------------- John Landy Centre
  { n: 'John Landy Centre', c: 'johnlandy', s: [[856, 566], [1052, 566], [1052, 624], [928, 624], [904, 600], [856, 600]], f: 1, h: 26, top: true,
    d: 'Named after Olympian and former Victorian Governor John Landy. Home of the senior school and L Block rooms.' },
  { n: 'Senior School Office', c: 'johnlandy', r: [778, 568, 80, 42], f: 1, h: 20 },
  { n: 'L4', c: 'johnlandy', r: [912, 578, 34, 42], f: 1, h: 22 },
  { n: 'L3', c: 'johnlandy', r: [946, 578, 34, 42], f: 1, h: 22 },
  { n: 'L2', c: 'johnlandy', r: [980, 578, 34, 42], f: 1, h: 22 },
  { n: 'L1', c: 'johnlandy', r: [1014, 578, 38, 42], f: 1, h: 22 },

  // ---------------------------------------------------------------- W block
  // Single-storey portables. The two blocks the plan marks "G" are two-storey
  // and live in DOUBLES below.
  { n: 'W06', c: 'wblock', r: [214, 648, 62, 42], f: 1 },
  { n: 'W05', c: 'wblock', r: [276, 648, 46, 42], f: 1 },
  { n: 'W04', c: 'wblock', r: [324, 648, 66, 42], f: 1 },
  { n: 'W03', c: 'wblock', r: [390, 648, 50, 42], f: 1 },
  { n: 'W02', c: 'wblock', r: [456, 618, 64, 46], f: 1 },
  { n: 'W01', c: 'wblock', r: [520, 618, 60, 46], f: 1 },
  { n: 'W15', c: 'wblock', r: [226, 718, 56, 36], f: 1 },
  { n: 'W16', c: 'wblock', r: [282, 718, 60, 36], f: 1 },

  // ---------------------------------------------------------------- Sports stadium
  { n: 'Sports Stadium', c: 'stadium', s: [[810, 872], [1042, 782], [1142, 892], [930, 1062]], f: 1, h: 34, top: true,
    d: 'Indoor stadium with basketball, netball and volleyball courts, plus the PE staff office and change rooms.' },
  { n: 'PE Staff', c: 'stadium', r: [1018, 930, 60, 40], f: 1, h: 20 },
  { n: 'STC 1', c: 'stadium', r: [928, 790, 72, 40], f: 1, h: 16 },
  { n: 'LIFE', c: 'stadium', r: [1010, 1000, 40, 32], f: 1, h: 16 },

  // ---------------------------------------------------------------- Dirt / small buildings
  { n: 'Bike Enclosure', c: 'courtyard', r: [1058, 72, 52, 44], f: 1, h: 8 },
];

// Double-storey buildings. Where the plan prints "G" the room is on the ground
// floor, and the room named beside it sits on the same footprint one level up.
// `lv: 0` = ground floor (G), `lv: 1` = first floor, directly above.
export const DOUBLES = [
  { n: 'W07 – W10', c: 'wblock', rooms: [
    { n: 'W09', lv: 1, r: [78, 612, 42, 36] },
    { n: 'W07', lv: 0, r: [120, 612, 46, 36] },
    { n: 'W10', lv: 1, r: [78, 648, 42, 36] },
    { n: 'W08', lv: 0, r: [120, 648, 46, 36] },
  ] },
  { n: 'W11 – W14', c: 'wblock', rooms: [
    { n: 'W14', lv: 1, r: [78, 718, 42, 36] },
    { n: 'W13', lv: 0, r: [120, 718, 46, 36] },
    { n: 'W12', lv: 1, r: [78, 754, 42, 36] },
    { n: 'W11', lv: 0, r: [120, 754, 46, 36] },
  ] },

  // ------------------------------------------------------------ WA block portables
  { n: 'WA17 – WA20', c: 'wablock', rooms: [
    { n: 'WA20', lv: 1, r: [58, 808, 38, 34] },
    { n: 'WA18', lv: 0, r: [96, 808, 40, 34] },
    { n: 'WA19', lv: 1, r: [58, 843, 38, 34] },
    { n: 'WA17', lv: 0, r: [96, 843, 40, 34] },
  ] },
  { n: 'WA13 – WA16', c: 'wablock', rooms: [
    { n: 'WA13', lv: 0, r: [186, 802, 34, 32] },
    { n: 'WA15', lv: 1, r: [148, 802, 38, 32] },
    { n: 'WA14', lv: 0, r: [186, 834, 34, 30] },
    { n: 'WA16', lv: 1, r: [148, 834, 38, 30] },
  ] },
  { n: 'WA09 – WA12', c: 'wablock', rooms: [
    { n: 'WA12', lv: 1, r: [278, 802, 42, 32] },
    { n: 'WA11', lv: 0, r: [320, 802, 42, 32] },
    { n: 'WA10', lv: 1, r: [278, 834, 42, 30] },
    { n: 'WA09', lv: 0, r: [320, 834, 42, 30] },
  ] },
  { n: 'WA05 – WA08', c: 'wablock', rooms: [
    { n: 'WA08', lv: 1, r: [408, 802, 32, 32] },
    { n: 'WA07', lv: 0, r: [440, 802, 34, 32] },
    { n: 'WA06', lv: 1, r: [408, 834, 32, 30] },
    { n: 'WA05', lv: 0, r: [440, 834, 34, 30] },
  ] },
  { n: 'WA01 – WA04', c: 'wablock', rooms: [
    { n: 'WA04', lv: 1, r: [528, 802, 32, 32] },
    { n: 'WA03', lv: 0, r: [560, 802, 32, 32] },
    { n: 'WA02', lv: 1, r: [528, 834, 32, 30] },
    { n: 'WA01', lv: 0, r: [560, 834, 32, 30] },
  ] },
  { n: 'WA21 – WA24', c: 'wablock', rooms: [
    { n: 'WA24', lv: 1, r: [64, 882, 34, 32] },
    { n: 'WA22', lv: 0, r: [98, 882, 38, 32] },
    { n: 'WA23', lv: 1, r: [64, 916, 34, 30] },
    { n: 'WA21', lv: 0, r: [98, 916, 38, 30] },
  ] },
  { n: 'WA25 – WA28', c: 'wablock', rooms: [
    { n: 'WA28', lv: 1, r: [64, 952, 34, 32] },
    { n: 'WA26', lv: 0, r: [98, 952, 38, 32] },
    { n: 'WA27', lv: 1, r: [64, 986, 34, 30] },
    { n: 'WA25', lv: 0, r: [98, 986, 38, 30] },
  ] },

  // The plan marks STC 2–5 "G" too, so they are stacked, not a flat court.
  { n: 'STC 2 – 5', c: 'stadium', rooms: [
    { n: 'STC 2', lv: 0, r: [1158, 828, 66, 27] },
    { n: 'STC 3', lv: 0, r: [1224, 828, 66, 27] },
    { n: 'STC 4', lv: 0, r: [1158, 855, 66, 27] },
    { n: 'STC 5', lv: 0, r: [1224, 855, 66, 27] },
  ] },
];

// Flat surfaces: courtyards, fields, courts, car parks, roads.
export const SURFACES = [
  { n: 'Middle Courtyard', c: 'courtyard', r: [648, 232, 220, 222], y: 1.2, top: true, flat: true,
    d: 'Central quadrangle between K, B, C and the library — the main gathering space at recess and lunch.' },
  { n: 'Upper Courtyard', c: 'courtyard', r: [1068, 232, 224, 222], y: 1.2, top: true, flat: true },
  { n: 'Lower Courtyard', c: 'courtyard', s: [[300, 330], [520, 330], [560, 500], [300, 520]], y: 1.2, top: true, flat: true },
  { n: 'Multi-purpose Sports Field', c: 'courts', r: [178, 902, 462, 164], y: 1.5, top: true, flat: true,
    d: 'Full-size oval / multi-purpose field used for athletics, soccer, cricket training and PE.' },
  { n: 'Covered Basketball Courts', c: 'courts', r: [1098, 618, 202, 172], y: 1.5, top: true, flat: true, roof: true,
    d: 'Two undercover outdoor courts, playable in most weather.' },
  { n: 'Tennis Courts', c: 'courts', r: [1328, 610, 170, 292], y: 1.5, flat: true, courts: 4, top: true },
];

export const CARPARKS = [
  { n: 'Carpark A', x: 115, z: 95, r: 44 },
  { n: 'Carpark B', x: 1465, z: 545, r: 40 },
  { n: 'Carpark C', x: 1172, z: 932, r: 42 },
];

export const ROADS = [
  { r: [-60, -180, 1760, 90], label: 'GEORGE STREET', lx: 800, lz: -130 },
  { r: [1500, -180, 100, 1320], label: 'DRYDEN STREET', lx: 1550, lz: 565, vertical: true },
  { r: [-60, 1070, 1760, 100], label: 'DRYDEN STREET', lx: 700, lz: 1120 },
];

export const PATHS = [
  { r: [862, 60, 34, 380] },
  { r: [615, 300, 22, 220] },
  { r: [860, 600, 24, 300] },
  { r: [640, 455, 230, 20] },
  { r: [1090, 452, 250, 16] },
  { r: [250, 500, 20, 240] },
  { r: [430, 600, 24, 210] },
  { r: [560, 660, 22, 180] },
  { r: [700, 700, 24, 200] },
  { r: [1090, 790, 20, 120] },
  { r: [940, 860, 18, 160] },
  { r: [660, 870, 260, 22] },
];

export const ENTRANCES = [
  { n: 'Main Entrance', x: 886, z: 92 },
  { n: 'Bike Enclosure', x: 1084, z: 94 },
];
