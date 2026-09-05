const at = (id, o = {}) => ({ id, ...o });

// dx/dz are METRES in the scene frame (+x north, +z east). Walks are straight lines
// between waypoints, so route through doors and openings explicitly.
export const routes = {
  // The main ladder: Har HaBayis -> Cheil steps -> Ezras Nashim -> 15 steps -> Nicanor -> Duchan
  // -> Kohanim court -> altar ramp -> back down -> Ulam steps -> Ulam -> Heichal -> KHK
  ladder: [
    at('ezras_nashim_gate', { dz: 14, level: 'har_habayis' }),
    at('cheil_steps', { dz: 5, level: 'har_habayis' }),
    at('cheil_steps', { dz: -5, level: 'ezras_nashim' }),
    at('ezras_nashim_gate', { dz: -6, level: 'ezras_nashim' }),
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('maalos_shir', { dz: 8, level: 'ezras_nashim' }),
    at('nicanor_gate', { dz: 1.5, level: 'azaras_yisrael' }),
    at('nicanor_gate', { dz: -4, level: 'azaras_yisrael' }),
    at('duchan', { dz: 2, level: 'azaras_yisrael' }),
    at('duchan', { dz: -3, level: 'azaras_kohanim' }),
    at('mizbeach', { dz: 12, level: 'azaras_kohanim' }),
    at('kevesh', { dx: -10, dz: 0, level: 'azaras_kohanim' }), // foot of the ramp (south end)
    at('kevesh', { dx: 6, dz: 0, level: 'azaras_kohanim', minY: 3 }), // up the ramp
    at('kevesh', { dx: -10, dz: 0, level: 'azaras_kohanim' }),
    at('kiyor', { dz: 3, level: 'azaras_kohanim' }),
    at('maalos_ulam', { dz: 7, level: 'azaras_kohanim' }),
    at('maalos_ulam', { dz: -7, level: 'ulam' }),
    at('ulam', { level: 'ulam' }),
    at('pesach_haheichal', { dz: 2, level: 'ulam' }),
    at('heichal', { dz: 6, level: 'heichal' }),
    at('mizbeach_hazahav', { dz: 3, level: 'heichal' }),
    at('paroches', { dz: 2, level: 'heichal' }),
    at('even_hashtiya', { dz: 3, level: 'kodesh_hakodashim' }),
  ],
  // Behind and beside the building at the Kohanim level
  around_building: [
    at('maalos_ulam', { dz: 7, level: 'azaras_kohanim' }),
    at('ulam', { dx: 55, dz: 4, level: 'azaras_kohanim' }),
    at('heichal', { dx: 45, dz: -10, level: 'azaras_kohanim' }),
    at('kodesh_hakodashim', { dx: 45, dz: -14, level: 'azaras_kohanim' }),
    at('kodesh_hakodashim', { dx: -45, dz: -14, level: 'azaras_kohanim' }),
    at('ulam', { dx: -55, dz: 4, level: 'azaras_kohanim' }),
  ],
};
