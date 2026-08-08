export const flyerBackgrounds = [
  { id: 'ivory', label: 'Ivory', color: '#f8f5ee', ink: '#273126' },
  { id: 'sage', label: 'Sage', color: '#dfe8dc', ink: '#2d4030' },
  { id: 'blush', label: 'Blush', color: '#f5e3e2', ink: '#572f39' },
  { id: 'sky', label: 'Sky', color: '#dcebf0', ink: '#29424c' },
  { id: 'butter', label: 'Butter', color: '#f7edc9', ink: '#51431f' },
  { id: 'sand', label: 'Sand', color: '#ece1d1', ink: '#4d3d2e' },
  { id: 'lilac', label: 'Lilac', color: '#e8e2f0', ink: '#403652' },
  { id: 'peach', label: 'Peach', color: '#f7dfce', ink: '#5a382d' },
  { id: 'mist', label: 'Mist', color: '#e7eeeb', ink: '#30433d' },
  { id: 'ocean', label: 'Ocean', color: '#cadde0', ink: '#243f47' },
  { id: 'berry', label: 'Berry', color: '#eadadd', ink: '#502d3a' },
  { id: 'midnight', label: 'Midnight', color: '#29363b', ink: '#f7f5ee' },
];

export function getFlyerBackground(id) {
  return flyerBackgrounds.find((background) => background.id === id) || flyerBackgrounds[0];
}
