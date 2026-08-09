# Attenda project notes

## Completed

- Built Attenda's RSVP invitation experience with public event pages, RSVP collection, guest counts, private host messages, a guest book, image/GIF support, audio, responsive layouts, and event-detail controls.
- Added customer and admin hubs, RSVP search/export, theme toggle, safe image file names, and host-notification function scaffolding.
- Established the Attenda visual system: shared mark/favicon, marketing-oriented sign-up experience, responsive navigation direction, and curated invitation backgrounds.
- Created Git commit `af71517` as the baseline backup before the Signature bundle work.
- Moved the experimental movable RSVP overlay into Attenda Signature's Advanced layout. Standard invitations now use dependable above, below, left, or right placements; prior overlay events safely render below the flyer unless a Signature host enables overlay again.
- Added client-side media safeguards: flyer and guest images are resized/compressed before upload, while audio and animated GIFs have clear limits to keep Supabase storage and bandwidth sustainable.
- Added Attenda's branded envelope social-preview image and event-page-only Open Graph metadata so shared invitation links have a polished preview in compatible messages and social apps without giving the default site an invitation preview.
- Added clear paid-plan explanations throughout locked Signature controls.

## In progress

- Attenda Signature: premium template looks, password protection, remove-branding, guest photo album, reminder setting, and reminder-delivery function.
- Stripe Checkout and webhook activation so Signature can be purchased without manual plan changes.

## Next

- Deploy the reminder function and schedule it after Resend is configured.
- Test the complete production flow on mobile: sign-up, invitation creation, RSVP, password access, comments, and reminders.
