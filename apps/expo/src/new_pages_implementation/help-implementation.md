# Help & Support Page Implementation

## Current Status

The Help & Support page exists at `apps/expo/src/app/settings/help.tsx` with static FAQ content and a non-functional chat button.

## Backend Dependencies

- **FAQ content**: Hardcoded. Could be fetched from CMS for easy updates.
- **Chat support**: Needs integration with support SDK (Intercom, Zendesk) or backend ticket system.
- **Bug report shortcut**: Should pre-fill feedback form with category="bug".
- **Search functionality**: Currently missing.
- **Collapsible accordions**: Currently always-expanded.

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Make FAQ items collapsible**:
   - Convert each FAQ item to an accordion using local state to toggle expansion.
   - Use `useState` to track which FAQ is open.

2. **Add search filter**:
   - Implement client-side search filtering across FAQ questions and answers.
   - Filter the `FAQS` array based on query string.

3. **Chat button action**:
   - Replace with `Linking.openURL` to open email (`mailto:Thatxliner@gmail.com`) or external helpdesk URL.
   - Alternatively, use `Linking.openURL` to open a web-based chat widget.

4. **Bug report shortcut**:
   - Add a "Report a bug" button that navigates to feedback screen with category preset to "bug".
   - Pass query param `?category=bug` to feedback screen.

### Local Storage Alternative:

- No local storage needed for core functionality.
- Could store recently viewed FAQs or search history locally.

### Migration Path to Backend:

- Fetch FAQ content from CMS via tRPC endpoint (`content.faq.list`).
- Integrate with Intercom/Zendesk SDK for in-app chat.
- Implement backend search endpoint for more comprehensive help articles.

## Priority: 🟡 Medium (User experience)

**Can ship with**: Collapsible FAQs, local search, email support link.
**Blockers**: None for static version.
