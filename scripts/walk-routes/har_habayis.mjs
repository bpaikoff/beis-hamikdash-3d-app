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
  // (z -22 .. -38, closed door) and Lishkas HaEtz (z -102 .. -134) on the south, so those
  // stretches are bypassed over the plaza.
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
    amos(85.5, -14, HB), // the opening opposite the Beis HaMoked's Cheil gate (closed; the hall stands 1 amah inside the Soreg)
  ],
};
