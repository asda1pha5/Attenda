export const babyShowerRsvpReminders = [
  {
    id: 'before-deadline',
    label: 'Before the RSVP date',
    title: 'A light reminder before the date arrives',
    note: 'Useful when the invitation has been out for a while and the RSVP date is getting close.',
    message: 'Hi [name]! Just a little reminder that RSVPs for [parent-to-be’s name]’s baby shower are due by [date]. We’d love to celebrate with you if you can make it. If you can’t, a quick “no” helps too. You can reply here: [invitation link]',
  },
  {
    id: 'deadline-today',
    label: 'On the RSVP date',
    title: 'A same-day nudge without the pressure',
    note: 'Keep it brief and make both “yes” and “no” easy answers.',
    message: 'Hi [name]! A quick reminder that today is the RSVP date for [parent-to-be’s name]’s baby shower. When you have a moment, could you let me know if you’ll be joining us? We’d love to see you, and completely understand if you can’t make it. [invitation link]',
  },
  {
    id: 'past-deadline',
    label: 'After the RSVP date',
    title: 'A kind check-in after the date has passed',
    note: 'Assume the invitation may have slipped their mind, and give them one clear next step.',
    message: 'Hi [name]! I’m checking in because the RSVP date for [parent-to-be’s name]’s baby shower has passed and I haven’t seen your response yet. Could you let me know by [new date] whether you can join us? Either answer is helpful. Here’s the invitation: [invitation link]',
  },
  {
    id: 'maybe',
    label: 'For a “maybe” guest',
    title: 'When someone is still uncertain',
    note: 'Acknowledge the uncertainty while making your own planning need clear.',
    message: 'Hi [name]! I know you weren’t sure yet about the baby shower. No pressure either way—could you let me know by [date] whether I should include you in the final count? We’d love to see you if it works out.',
  },
  {
    id: 'final-count',
    label: 'Final headcount',
    title: 'A clear final check before numbers are due',
    note: 'Choose this only when you have a real venue, catering, or planning cutoff.',
    message: 'Hi [name]! I’m sending the final baby-shower headcount to [the venue / caterer] on [date]. If you’d like to join us, please RSVP by [time and date]. If I don’t hear from you by then, I’ll mark you as unable to attend. Thank you for understanding! [invitation link]',
  },
];
