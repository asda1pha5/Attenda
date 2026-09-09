export function babyShowerWording(tone = 'warm') {
  const opening = {
    warm: 'A little one is on the way! Please join us for a baby shower celebrating [name].',
    simple: 'You’re invited to a baby shower for [name]. We’d love to celebrate with you.',
    playful: 'Tiny toes, big joy! Help us shower [name] with love before the little one arrives.',
  };
  return `${opening[tone] || opening.warm}\n\n[Day, date] at [time]\n[Venue and address]\n\nPlease RSVP by [date] using the invitation link.\nRegistry (optional): [link]\n\nWe look forward to spending this special day with you.`;
}
