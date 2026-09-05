const at = (id, o = {}) => ({ id, ...o });

// dx/dz are METRES in the scene frame (+x north, +z east). Walks are straight lines
// between waypoints, so route through doors and openings explicitly.
export const routes = {
  // Around the Azarah: the lishkos and the gates from inside the court
  azarah: [
    at('azaras_kohanim', { level: 'azaras_kohanim' }),
    at('lishkas_hagazis', { level: 'azaras_kohanim' }),
    at('azaras_kohanim', { level: 'azaras_kohanim' }),
    at('beis_hamoked', { level: 'azaras_kohanim' }),
    at('azaras_kohanim', { level: 'azaras_kohanim' }),
    at('slaughter_tables', { dz: 4, level: 'azaras_kohanim' }),
    at('hanging_pillars', { dz: 4, level: 'azaras_kohanim' }),
    at('water_gate', { dx: 4, level: 'azaras_kohanim' }),
    at('lishkas_haparvah', { level: 'azaras_kohanim' }),
    at('azaras_kohanim', { level: 'azaras_kohanim' }),
    at('kevesh_katan_east', { dz: 3, level: 'azaras_kohanim' }),
  ],
};
