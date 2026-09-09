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
// (TempleGame); `outside` is a ring 40 amos beyond the outer wall, so every gate can be
// walked through (see outer_gates_through).
export const routes = {
  // Through each outer gate of the mount to the ground outside and back (Middot 1:3).
  // Shushan (east, z 278), Tadi (north, x 197.5), Kiponus (west, z -222), Chuldah (south).
  outer_gates_through: [
    amos(0, 265, HB),
    at('shaar_shushan', HB),
    amos(0, 292, HB), // outside the east wall
    amos(20, 292, HB),
    amos(20, 300, HB),
    amos(0, 292, HB),
    at('shaar_shushan', HB),
    amos(0, 265, HB),
    amos(185, 265, HB), // round the Soreg (x 83.5, z 157) over the plaza
    amos(185, -20, HB),
    at('shaar_tadi', HB),
    amos(212, -20, HB), // outside the north wall
    amos(212, 10, HB),
    amos(212, -20, HB),
    at('shaar_tadi', HB),
    amos(185, -20, HB),
    amos(100, -210, HB), // round the Soreg's north-west corner (83.5, -203)
    amos(0, -210, HB),
    at('shaar_kiponus', HB),
    amos(0, -236, HB), // outside the west wall
    amos(-30, -236, HB),
    amos(0, -236, HB),
    at('shaar_kiponus', HB),
    amos(0, -210, HB),
  ],
  // The outer faces: from the western Chuldah gate round the south-west corner, up the
  // west face to Kiponus, on to the north-west corner, along the north face to Tadi, to
  // the north-east corner, down the east face to Shushan, and to the south-east corner.
  // Each convex corner is turned at a waypoint 1.5 amos past the face just left, with
  // a tight reach, so the body clears the corner before the next leg starts.
  outer_faces: [
    amos(-309.3, -30, HB),
    amos(-309.3, -229.5, HB, { reach: 0.3 }), // south-west corner, outside
    amos(-296, -229.5, HB), // clear of the corner before closing on the west face
    amos(-100, -228.8, HB),
    amos(0, -228.8, HB), // Kiponus from outside
    amos(190, -228.8, HB),
    amos(205, -228.8, HB, { reach: 0.3 }), // north-west corner
    amos(205, -215, HB),
    amos(204.3, -20, HB), // Tadi from outside
    amos(204.3, 260, HB),
    amos(204.3, 285.5, HB, { reach: 0.3 }), // north-east corner
    amos(190, 285.5, HB),
    amos(0, 284.8, HB), // Shushan from outside
    amos(-280, 284.8, HB),
    amos(-310, 284.8, HB, { reach: 0.3 }), // south-east corner
    amos(-310, 270, HB),
    amos(-309.3, 90, HB), // the eastern Chuldah gate from outside
  ],
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
    amos(78.5, -102, CH),
    amos(82.4, -102, { ...CH, reach: 0.4 }), // round the Nitzotz stair tower (round 6: x to 81, z -99 .. -83) by the lane along the Soreg
    amos(82.4, -81, { ...CH, reach: 0.4 }),
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
    // Round the foot of the twelve steps and their cheek wall. Reached tight: counted 1.2 m
    // short the player is still at x ~9, inside the flight's 20-amah span, and the next leg
    // slides it up the steps along the cheek (the round-4 walk found it 8 risers up).
    amos(11.3, 153.8, { ...CH, reach: 0.3 }),
    amos(11.3, 147.8, CH),
    amos(75, 147.8, { ...CH, reach: 0.3 }), // the courts' north-east corner
    amos(74.3, -1.2, CH), // north strip, to the Beis HaMoked's east wall
    amos(74.3, 148.5, { ...CH, reach: 0.3 }),
    amos(11.3, 153.8, CH),
    amos(0, 155, CH),
    amos(0, 165, HB), // out, and over the plaza to the opening opposite Shaar HaNashim
    amos(90, 165, HB),
    amos(90, -36, HB),
    // Round 6: the vault of the Middot 1:9 passage (x to 77) runs along the wall's foot from
    // the Beis HaMoked's west wall (z -26) to the bath-house (x to 81.5, z -52 .. -42), and
    // the Nitzotz stair tower (x to 81) stands at z -99 .. -83; both are rounded by the
    // 2-amah lane along the Soreg (x 83.5).
    amos(77.8, -36, CH),
    amos(77.8, -26.8, CH), // the Beis HaMoked's west wall, along the passage's vault
    amos(77.8, -36, CH),
    amos(77.8, -41.2, { ...CH, reach: 0.3 }), // the bath-house's east wall
    amos(82.4, -41.2, { ...CH, reach: 0.3 }),
    amos(82.4, -52.8, { ...CH, reach: 0.3 }), // its west wall
    amos(74.3, -52.8, { ...CH, reach: 0.3 }),
    amos(74.3, -82.2, { ...CH, reach: 0.3 }), // past Shaar HaKorban to the Nitzotz tower's east wall
    amos(82.4, -82.2, { ...CH, reach: 0.3 }),
    amos(82.4, -99.8, { ...CH, reach: 0.3 }), // its west wall
    amos(74.3, -99.8, { ...CH, reach: 0.3 }),
    amos(74.3, -194.5, { ...CH, reach: 0.3 }), // north strip to the north-west corner
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

  // A visitor's circuit, gate to gate (Middot 2:2: in by the right, round the mount, out by
  // the left): from the ground outside, in through one gate, round the plaza outside the
  // Soreg (x +-83.5, z -203 .. 157), and out through another. The mount's wall is 6 thick
  // (outer faces x -308.5 / 203.5, z -228 / 284); the ground outside is the environment
  // plane, 0.1 amah below the plaza.
  visitor_shushan_tadi: [
    amos(0, 300, HB), // the road east of the mount (Har HaMishcha side)
    amos(0, 288, HB),
    at('shaar_shushan', HB),
    amos(0, 265, HB),
    amos(185, 265, HB),
    amos(185, -20, HB),
    at('shaar_tadi', HB),
    amos(215, -20, HB),
  ],
  visitor_tadi_kiponus: [
    amos(215, -20, HB),
    at('shaar_tadi', HB),
    amos(185, -20, HB),
    amos(100, -210, HB),
    amos(0, -210, HB),
    at('shaar_kiponus', HB),
    amos(0, -245, HB),
  ],
  visitor_kiponus_chuldah: [
    amos(0, -245, HB),
    at('shaar_kiponus', HB),
    amos(0, -210, HB),
    amos(-100, -215, HB),
    amos(-290, -30, HB),
    at('chuldah_gate_west', HB),
    amos(-325, -30, HB),
  ],
  visitor_chuldah_shushan: [
    amos(-325, 90, HB),
    at('chuldah_gate_east', HB),
    amos(-290, 90, HB),
    amos(-290, 200, HB),
    amos(-100, 265, HB),
    amos(0, 265, HB),
    at('shaar_shushan', HB),
    amos(0, 300, HB),
  ],
  // In by the western Chuldah gate, round the southern expanse, out by the eastern (Middot 1:3).
  visitor_chuldah_pair: [
    amos(-325, -30, HB),
    at('chuldah_gate_west', HB),
    amos(-290, -30, HB),
    amos(-100, -100, HB),
    amos(-100, 200, HB),
    amos(-290, 90, HB),
    at('chuldah_gate_east', HB),
    amos(-325, 90, HB),
  ],

  // The gate reveals, both directions: in hugging one reveal and out hugging the other,
  // 1.3 amos off the reveal (the open leaves stand folded 0.5 amah off it for the middle
  // 5 amos of the passage; CourtBuilder.gateA). East and north gates, then west and south.
  gate_reveals_east: [
    amos(3.7, 295, HB),
    amos(3.7, 265, HB), // Shushan, north reveal
    amos(-3.7, 265, HB),
    amos(-3.7, 295, HB), // south reveal
    amos(215, 295, HB), // round the north-east corner outside
    amos(215, -16.3, HB),
    amos(185, -16.3, HB), // Tadi, east reveal
    amos(185, -23.7, HB),
    amos(215, -23.7, HB), // west reveal
  ],
  gate_reveals_west: [
    amos(3.7, -250, HB),
    amos(3.7, -210, HB), // Kiponus, north reveal
    amos(-3.7, -210, HB),
    amos(-3.7, -250, HB), // south reveal
    amos(-325, -250, HB), // round the south-west corner outside
    amos(-325, -26.3, HB),
    amos(-290, -26.3, HB), // the western Chuldah gate, east reveal
    amos(-290, -33.7, HB),
    amos(-325, -33.7, HB), // west reveal
    amos(-325, 86.3, HB),
    amos(-290, 86.3, HB), // the eastern Chuldah gate, west reveal
    amos(-290, 93.7, HB),
    amos(-325, 93.7, HB), // east reveal
  ],

  // Along the outer faces at 0.8 amos, into each gate from outside (mid-wall, then out
  // to 3.5 amos clear of the reveal before the run resumes), with `blocked` legs into the
  // wall faces and the gate jambs (the frame's jambs stand in the amah of wall beside
  // each opening). East face (the low wall, Middot 2:4) and north face; then west and south.
  outside_east_north: [
    amos(-150, 284.8, HB),
    amos(-20, 284.8, HB),
    amos(-20, 275, { ...HB, expect: 'blocked' }), // the east wall's outer face
    amos(-20, 288, HB),
    amos(-6.2, 288, HB),
    amos(-6.2, 272, { ...HB, expect: 'blocked' }), // Shushan's south jamb
    amos(-6.2, 288, HB),
    amos(0, 288, HB),
    amos(0, 281, HB), // into Shushan, mid-wall
    amos(0, 288.5, HB),
    amos(6.2, 288, HB),
    amos(6.2, 272, { ...HB, expect: 'blocked' }), // the north jamb
    amos(6.2, 288, HB),
    amos(150, 284.8, HB),
    amos(205, 284.8, { ...HB, reach: 0.3 }), // north-east corner
    amos(205, 270, HB),
    amos(204.3, 100, HB),
    amos(204.3, 0, HB),
    amos(195, 0, { ...HB, expect: 'blocked' }), // the north wall's outer face
    amos(208, 0, HB),
    amos(208, -13.8, HB),
    amos(190, -13.8, { ...HB, expect: 'blocked' }), // Tadi's east jamb
    amos(208, -13.8, HB),
    amos(208, -20, HB),
    amos(200.5, -20, HB), // into Tadi, mid-wall, under the leaning stones
    amos(208.5, -20, HB),
    amos(208, -26.2, HB),
    amos(190, -26.2, { ...HB, expect: 'blocked' }), // the west jamb
    amos(208, -26.2, HB),
    amos(204.3, -150, HB),
    amos(204.3, -229.5, { ...HB, reach: 0.3 }), // north-west corner
    amos(190, -229.5, HB),
  ],
  outside_west_south: [
    amos(190, -228.8, HB),
    amos(20, -228.8, HB),
    amos(20, -215, { ...HB, expect: 'blocked' }), // the west wall's outer face
    amos(20, -232, HB),
    amos(6.2, -232, HB),
    amos(6.2, -215, { ...HB, expect: 'blocked' }), // Kiponus's north jamb
    amos(6.2, -232, HB),
    amos(0, -232, HB),
    amos(0, -225, HB), // into Kiponus, mid-wall
    amos(0, -232.5, HB),
    amos(-6.2, -232, HB),
    amos(-6.2, -215, { ...HB, expect: 'blocked' }), // the south jamb
    amos(-6.2, -232, HB),
    amos(-150, -228.8, HB),
    amos(-310, -228.8, { ...HB, reach: 0.3 }), // south-west corner
    amos(-310, -215, HB),
    amos(-309.3, -100, HB),
    amos(-309.3, -50, HB),
    amos(-300, -50, { ...HB, expect: 'blocked' }), // the south wall's outer face
    amos(-313, -50, HB),
    amos(-313, -36.2, HB),
    amos(-295, -36.2, { ...HB, expect: 'blocked' }), // the western Chuldah gate's west jamb
    amos(-313, -36.2, HB),
    amos(-313, -30, HB),
    amos(-305.5, -30, HB), // in, mid-wall
    amos(-313.5, -30, HB),
    amos(-313, -23.8, HB),
    amos(-295, -23.8, { ...HB, expect: 'blocked' }), // its east jamb
    amos(-313, -23.8, HB),
    amos(-309.3, 60, HB),
    amos(-313, 83.8, HB),
    amos(-295, 83.8, { ...HB, expect: 'blocked' }), // the eastern gate's west jamb
    amos(-313, 83.8, HB),
    amos(-313, 90, HB),
    amos(-305.5, 90, HB), // in, mid-wall
    amos(-313.5, 90, HB),
    amos(-313, 96.2, HB),
    amos(-295, 96.2, { ...HB, expect: 'blocked' }), // its east jamb
    amos(-313, 96.2, HB),
    amos(-309.3, 200, HB),
    amos(-309.3, 285.5, { ...HB, reach: 0.3 }), // south-east corner
    amos(-296, 285.5, HB),
    amos(-150, 284.8, HB),
  ],
  // Diagonally into each corner of the wall from outside: the body must wedge in the
  // corner, not clip through either face.
  outside_corners: [
    amos(-318, 294, HB),
    amos(-306, 282, { ...HB, expect: 'blocked' }), // south-east
    amos(-318, 294, HB),
    amos(-318, 0, HB),
    amos(-318, -238, HB),
    amos(-306, -226, { ...HB, expect: 'blocked' }), // south-west
    amos(-318, -238, HB),
    amos(0, -238, HB),
    amos(213, -238, HB),
    amos(201, -226, { ...HB, expect: 'blocked' }), // north-west
    amos(213, -238, HB),
    amos(213, 0, HB),
    amos(213, 294, HB),
    amos(201, 282, { ...HB, expect: 'blocked' }), // north-east
    amos(213, 294, HB),
    amos(0, 294, HB),
    amos(-318, 294, HB),
  ],
};
