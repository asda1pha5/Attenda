export const babyShowerStyles = [
  { id: 'garden-welcome', name: 'Garden Welcome', description: 'Soft florals for a sweet, intimate shower.', flyer_background: 'sage', accent: '#d8a895', detail: 'A little one is on the way' },
  { id: 'little-sunshine', name: 'Little Sunshine', description: 'Warm, cheerful, and easy to make your own.', flyer_background: 'butter', accent: '#cf9f42', detail: 'A shower for our little sunshine' },
  { id: 'storybook-baby', name: 'Storybook Baby', description: 'Gentle blush tones for a sentimental gathering.', flyer_background: 'blush', accent: '#bb7f87', detail: 'Once upon a little beginning' },
  { id: 'modern-nest', name: 'Modern Nest', description: 'Warm neutral details with a refined, minimal feel.', flyer_background: 'sand', accent: '#8b7660', detail: 'Gathering for baby' },
];

export function getBabyShowerStyle(id) {
  return babyShowerStyles.find((style) => style.id === id);
}
