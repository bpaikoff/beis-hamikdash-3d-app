const at = (id, o = {}) => ({ id, ...o });

// dx/dz are METRES in the scene frame (+x north, +z east). Walks are straight lines
// between waypoints, so route through doors and openings explicitly.
export const routes = {
  // Around the Ezras Nashim: the four corner chambers through their doors
  ezras_nashim: [
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('chamber_oils', { level: 'ezras_nashim' }),
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('chamber_lepers', { level: 'ezras_nashim' }),
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('chamber_nazirites', { level: 'ezras_nashim' }),
    at('ezras_nashim', { level: 'ezras_nashim' }),
    at('chamber_wood', { level: 'ezras_nashim' }),
  ],
};
