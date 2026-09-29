# Facebook Auto Like & Reply

Standalone Android project for the workflow discussed in chat.

UI:
- Post URL
- Editable public reply with `[اسم العميل]`
- Per-post private message
- Alternative public reply when messaging is unavailable
- Comment limit and delay
- Toggles for public/private steps
- Counters and compact scrollable log above Facebook

Validation performed before delivery:
- XML parsed successfully
- JavaScript syntax checked with Node.js
- Source structure reviewed for IDs, manifest, Gradle configuration and state-machine flow

The final behavioral test must be performed on the target Facebook page because Facebook's WebView DOM and labels can change. The app intentionally stops rather than claiming success when the expected private-message confirmation cannot be found.

## Changes in this build
- Comment actions are resolved inside the current comment instead of using page-wide controls.
- Reply composer is selected from the newly opened/current comment composer, avoiding the main post "Comment as ..." field.
- Like is clicked and then checked again before being counted.
- The comments sort dialog is handled once per opened post: Newest -> OK.
- Human verification remains manual; when detected, the app hides both the settings panel and resize handle so the WebView gets the full available area.
