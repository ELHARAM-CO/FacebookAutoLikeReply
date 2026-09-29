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
