import { toWorld } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A waypoint at (x, z) amos in the azarah frame (see docs/content.md), optional level name. */
const amos = (x, z, o = {}) => {
  const [wx, , wz] = toWorld({ x, y: 0, z });
  return { x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)), ...o };
};

const HB = { level: 'har_habayis' };
const CH = { level: 'cheil' };

// Walks are straight lines, so every leg between gates keeps outside the Soreg
// (x +-83.5, z -203 .. 157). The player is clamped to the union of the area bounds
// (TempleGame), i.e. the plaza interior, so each gate is walked from its opening at the
// wall's inner face; the passage through the wall itself is covered by the walk() test in
// src/game/builders/CourtBuilders.test.js.
export const routes = {
  // The five gates of the mount (Middot 1:3): Shushan (E), Tadi (N), Kiponus (W), the two Chuldah gates (S).
  har_habayis_gates: [
    at('shaar_shushan', HB),
    amos(0, 265, HB),
    at('shaar_shushan', HB),
    amos(100, 200, HB),
    amos(185, -20, HB),
    at('shaar_tadi', HB),
    amos(185, -20, HB),
    amos(100, -215, HB),
    amos(0, -210, HB),
    at('shaar_kiponus', HB),
    amos(0, -210, HB),
    amos(-100, -215, HB),
    amos(-290, -30, HB),
    at('chuldah_gate_west', HB),
    amos(-290, -30, HB),
    amos(-290, 90, HB),
    at('chuldah_gate_east', HB),
    amos(-290, 90, HB),
  ],

  // The Cheil (Middot 2:3) all round the courts, entering and leaving through the Soreg
  // opening opposite every gate. The ring is interrupted where temple.json puts buildings
  // across it: Beis HaMoked (x to 82.5, z -26 .. -2) on the north, Lishkas Palhedrin
  // (z -21 .. -37, with a door to the Cheil) and Lishkas HaEtz (z -118 .. -148) on the
  // south, so those stretches are bypassed over the plaza. The last leg goes in through
  // the Beis HaMoked's Cheil door into its vestibule (stairs.mjs walks the stair).
  cheil: [
    amos(0, 165, HB),
    at('cheil', CH), // in through the opening opposite the Ezras Nashim gate
    amos(78.5, 155, CH),
    amos(78.5, 2, CH), // north strip, up to the Beis HaMoked
    amos(78.5, 155, CH),
    amos(-78.5, 155, CH),
    amos(-78.5, -10, CH), // south strip, up to Palhedrin
    amos(-78.5, -16, CH),
    amos(-90, -16, HB), // out opposite the Water Gate
    amos(-90, -44, HB),
    amos(-78.5, -44, CH), // in opposite Shaar HaBechoros
    amos(-78.5, -78, CH),
    amos(-80.5, -90, CH), // beside Lishkas HaGazis, to the wall of Lishkas HaEtz
    amos(-80.5, -100, CH),
    amos(-78.5, -78, CH),
    amos(-90, -78, HB), // out opposite Shaar HaDelek
    amos(-90, -172, HB),
    amos(-78.5, -172, CH), // in opposite Shaar HaElyon
    amos(-78.5, -198, CH),
    amos(-50, -198, CH),
    amos(-50, -210, HB), // out opposite the southern west gate
    amos(-50, -198, CH),
    amos(0, -198, CH), // behind the Beis HaKapores
    amos(50, -198, CH),
    amos(50, -210, HB), // out opposite the northern west gate
    amos(50, -198, CH),
    amos(78.5, -198, CH),
    amos(78.5, -100, CH),
    amos(78.5, -78, CH),
    amos(90, -78, HB), // out opposite Shaar HaNitzotz
    amos(78.5, -78, CH),
    amos(78.5, -58, CH),
    amos(90, -58, HB), // out opposite Shaar HaKorban
    amos(78.5, -58, CH),
    amos(78.5, -36, CH),
    amos(90, -36, HB), // out opposite Shaar HaNashim
    amos(90, -14, HB),
    amos(83, -14, { ...CH, reach: 0.5 }), // the opening opposite the Beis HaMoked's Cheil gate: the amah of Cheil between the Soreg and the hall
    amos(79, -14, CH), // through the door into the vestibule under the hall's chol half
    amos(83, -14, { ...CH, reach: 0.5 }),
    amos(90, -14, HB),
  ],

  // The inside face of the outer wall, corner to corner, 0.4 m (0.8 amos) off the face.
  // Only the Chuldah gates can be walked into: the player is clamped to the union of the
  // area bounds (TempleGame), which reaches beyond the wall only on the south ('outside'),
  // so Shushan, Tadi and Kiponus are reached at the inner face. The walker counts a
  // waypoint reached 1.2 m short, so after each gate the run resumes from a point 3.5 amos
  // off the face, clear of the reveal.
  har_habayis_wall_inside: [
    amos(-301.7, -221.2, HB), // south-west corner
    amos(-301.7, -30, HB),
    amos(-305.5, -30, HB), // into the western Chuldah gate, mid-wall
    amos(-299, -30, HB),
    amos(-301.7, 90, HB),
    amos(-305.5, 90, HB), // the eastern Chuldah gate
    amos(-299, 90, HB),
    amos(-301.7, 277.2, HB), // south-east corner
    amos(-150, 277.2, HB),
    at('shaar_shushan', HB), // (0, 278): the inner face
    amos(0, 274.5, HB),
    amos(196.7, 277.2, HB), // north-east corner (the low east wall)
    amos(196.7, 130, HB),
    at('shaar_tadi', HB), // (197.5, -20)
    amos(194, -20, HB),
    amos(196.7, -221.2, HB), // north-west corner
    amos(0, -221.2, HB),
    at('shaar_kiponus', HB), // (0, -222)
    amos(0, -218.5, HB),
    amos(-150, -221.2, HB),
    amos(-301.7, -221.2, HB),
  ],

  // The Cheil ring hugging the court walls (0.8 amos off their outer faces), with the
  // bypasses over the plaza where temple.json puts buildings across the ring: Beis
  // HaMoked (x 52.5 .. 82.5, z -26 .. -2) leaves the north strip east of it a dead end
  // (no Soreg opening between it and the east side); Lishkas Palhedrin (z -37 .. -21)
  // and Lishkas HaEtz (z -148 .. -118) fill the south strip, and the chol half of
  // Lishkas HaGazis (x to -77.5, z -118 .. -88) narrows it. Palhedrin's door to the Cheil
  // is walked into; Beis HaMoked's and the Gazis' Cheil doors, at the Cheil level into
  // the vestibules under their chol halves, are walked in stairs.mjs.
  // Convex corners (the courts' corners, the Gazis) are turned at a waypoint 1.5 amos past
  // the face just left, with a tight reach, so the body clears the corner before it turns.
  cheil_ring: [
    amos(0, 165, HB),
    amos(0, 155, CH), // in opposite the Ezras Nashim gate
    amos(11.3, 153.8, CH), // round the foot of the twelve steps and their cheek wall
    amos(11.3, 147.8, CH),
    amos(75, 147.8, { ...CH, reach: 0.3 }), // the courts' north-east corner
    amos(74.3, -1.2, CH), // north strip, to the Beis HaMoked's east wall
    amos(74.3, 148.5, { ...CH, reach: 0.3 }),
    amos(11.3, 153.8, CH),
    amos(0, 155, CH),
    amos(0, 165, HB), // out, and over the plaza to the opening opposite Shaar HaNashim
    amos(90, 165, HB),
    amos(90, -36, HB),
    amos(74.3, -36, CH),
    amos(74.3, -26.8, CH), // the Beis HaMoked's south wall
    amos(74.3, -36, CH),
    amos(74.3, -194.5, { ...CH, reach: 0.3 }), // north strip past Shaar HaKorban and Shaar HaNitzotz to the north-west corner
    amos(-75, -193.8, { ...CH, reach: 0.3 }), // west strip behind the building, past the two western gates (closed, at court level), to the south-west corner
    amos(-74.3, -148.8, CH), // south strip to the west wall of Lishkas HaEtz
    amos(-74.3, -172, CH),
    amos(-90, -172, HB), // out opposite Shaar HaElyon, over the plaza
    amos(-90, -78, HB),
    amos(-74.3, -78, CH), // in opposite Shaar HaDelek
    amos(-74.3, -86.5, CH), // the Gazis' east wall
    amos(-79, -86.5, { ...CH, reach: 0.3 }),
    amos(-78.3, -117.2, CH), // beside the Gazis' chol half, to the east wall of Lishkas HaEtz
    amos(-79, -86.5, { ...CH, reach: 0.3 }),
    amos(-74.3, -86.5, CH),
    amos(-74.3, -37.8, CH), // to Palhedrin's west wall
    amos(-74.3, -44, CH),
    amos(-90, -44, HB), // out opposite Shaar HaBechoros, over the plaza
    amos(-90, -16, HB),
    amos(-78.5, -16, CH), // in opposite the Water Gate
    amos(-78.5, -20.2, CH), // Palhedrin's door to the Cheil (Yoma 19a), in its east wall
    amos(-78.5, -30, CH), // inside, between the two flights of its stair
    amos(-78.5, -18, CH),
    amos(-74.3, -18, CH),
    amos(-74.3, 148.5, { ...CH, reach: 0.3 }), // south strip along the Azarah and Ezras Nashim walls to the south-east corner
    amos(-11.3, 147.8, CH),
    amos(-11.3, 153.8, CH),
    amos(0, 155, CH),
    amos(0, 165, HB),
  ],

  // Every Soreg opening, out and in (Middot 2:3: an opening opposite each gate).
  soreg_openings: [
    amos(0, 155, CH),
    amos(0, 165, HB), // opposite the Ezras Nashim gate
    amos(0, 155, CH),
    amos(0, 165, HB),
    amos(-90, 165, HB),
    amos(-90, -16, HB),
    amos(-78.5, -16, CH), // opposite the Water Gate
    amos(-90, -16, HB),
    amos(-90, -44, HB),
    amos(-78.5, -44, CH), // Shaar HaBechoros
    amos(-90, -44, HB),
    amos(-90, -78, HB),
    amos(-78.5, -78, CH), // Shaar HaDelek
    amos(-90, -78, HB),
    amos(-90, -172, HB),
    amos(-78.5, -172, CH), // Shaar HaElyon
    amos(-90, -172, HB),
    amos(-90, -210, HB),
    amos(-50, -210, HB),
    amos(-50, -198, CH), // the southern west gate
    amos(-50, -210, HB),
    amos(50, -210, HB),
    amos(50, -198, CH), // the northern west gate
    amos(50, -210, HB),
    amos(90, -210, HB),
    amos(90, -78, HB),
    amos(78.5, -78, CH), // Shaar HaNitzotz
    amos(90, -78, HB),
    amos(90, -58, HB),
    amos(78.5, -58, CH), // Shaar HaKorban
    amos(90, -58, HB),
    amos(90, -36, HB),
    amos(78.5, -36, CH), // Shaar HaNashim
    amos(90, -36, HB),
    amos(90, -14, HB),
    amos(83, -14, { ...CH, reach: 0.5 }), // the Beis HaMoked's Cheil gate: the hall's wall stands 1 amah inside the Soreg
    amos(79, -14, CH), // and its door at the Cheil level leads into the vestibule under the hall
    amos(83, -14, { ...CH, reach: 0.5 }),
    amos(90, -14, HB),
  ],

  // Outside the mount: along the outer face of the south wall (x -308.5; hugged 0.8 amos
  // off) to both Chuldah gates and in through each (Middot 1:3). The ground outside is
  // the environment plane at the mount's level (temple.json puts it 6 amos lower).
  chuldah_approach: [
    amos(-309.3, -215, HB),
    amos(-309.3, -30, HB),
    amos(-305.5, -30, HB), // in the western gate
    amos(-296, -30, HB), // on the plaza
    amos(-305.5, -30, HB),
    amos(-312, -30, HB), // out, clear of the reveal
    amos(-309.3, 90, HB),
    amos(-305.5, 90, HB), // the eastern gate
    amos(-296, 90, HB),
    amos(-305.5, 90, HB),
    amos(-312, 90, HB),
    amos(-309.3, 275, HB), // to the south-east corner
  ],
};
