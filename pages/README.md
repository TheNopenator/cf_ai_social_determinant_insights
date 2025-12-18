# Social Determinants of Health - Frontend Chat UI

## Architecture Overview

The frontend is built with vanilla HTML, CSS, and JavaScript for Cloudflare Pages, providing a modern, responsive chat interface with the following features:

### Core Features

1. **Two-Panel Layout**
   - Left sidebar: User profile with risk factors, conditions, and session info
   - Right main area: Chat interface with messages and input

2. **Chat Interface**
   - User and assistant message bubbles with distinct styling
   - Auto-scroll to latest messages
   - Real-time message rendering with animation

3. **Quick Reply Suggestions**
   - Pre-populated buttons for common questions
   - One-click message sending
   - Customizable suggestion list

4. **Session Management**
   - Cookie-based session persistence (7 days)
   - Unique user ID generation
   - Session reset capability
   - Automatic session restoration on page refresh

5. **Risk Factor Management**
   - Modal dialog for entering risk factors and conditions
   - Comma-separated input parsing
   - Real-time profile display
   - Auto-sync with backend

6. **Responsive Design**
   - Mobile-friendly layout
   - Flexible two-panel to stacked layout on smaller screens
   - Touch-optimized buttons and inputs

## File Structure

```
pages/
├── index.html          # Main chat UI markup
├── styles.css          # Complete styling (no frameworks)
├── script.js           # Frontend logic and API integration
└── _routes.json        # Cloudflare Pages routing config
```

## API Integration

The frontend communicates with the worker backend via these endpoints:

### POST /api/chat
Send a message and get AI response
```json
{
  "userId": "user_1234567890_abc123",
  "message": "What factors affect my health?"
}
```

### POST /api/risk
Update user risk factors and conditions
```json
{
  "userId": "user_1234567890_abc123",
  "riskFactors": ["low income", "food insecurity"],
  "conditions": ["diabetes"]
}
```

### GET /api/context?userId=...
Fetch current user memory and profile state
```
Response: {
  "userId": "...",
  "memory": {
    "profile": { riskFactors, conditions, interests },
    "conversation": { recentQuestions, keyInsights },
    "meta": { createdAt, lastActive }
  }
}
```

## Session Management

### Cookie-Based Sessions
- **Cookie Name**: `sdh_user_id`
- **Max Age**: 7 days
- **SameSite**: Lax (CSRF protection)
- **Auto-Generated ID**: `user_${timestamp}_${random}`

### Session Flow
1. Page loads → Check for existing session cookie
2. If no cookie → Generate new user ID
3. Set cookie for 7 days
4. Fetch user context from backend
5. Restore chat history and profile state

### Session Reset
- Click "New Session" button
- Confirms deletion
- Generates new user ID
- Clears all local state
- Refreshes UI

## Styling System

### Design Tokens
```css
--primary-color: #4f46e5 (Indigo)
--secondary-color: #10b981 (Green)
--accent-color: #f59e0b (Amber)
--bg-primary: #ffffff
--bg-secondary: #f9fafb
--text-primary: #111827
--text-secondary: #6b7280
```

### Component Classes
- `.message` / `.user-message` / `.assistant-message`
- `.message-bubble`
- `.tag` / `.tag.active`
- `.btn-primary` / `.btn-secondary`
- `.sidebar` / `.chat-container`
- `.modal` / `.modal-content`

## Deployment

### Cloudflare Pages Setup

1. **Create Pages Project**
   ```bash
   npm install wrangler -g
   wrangler pages project create social-determinants-chat
   ```

2. **Connect to GitHub**
   - Link your repository
   - Set build command: (none for static site)
   - Set publish directory: `pages`

3. **Configure Worker Integration**
   - Update `API_BASE_URL` in `script.js` to match worker domain
   - Example: `https://worker.example.com/api`

4. **Environment Variables**
   - No secrets needed for frontend
   - All auth happens via worker

### Local Development

```bash
# Serve static files
python -m http.server 8000

# Or with live reload
npm install -g live-server
live-server pages/
```

## Accessibility Features

- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- Focus management
- Color contrast compliance
- Touch-friendly button sizes (44px minimum)

## Performance Optimizations

- No external dependencies (vanilla JS)
- CSS-only animations
- Efficient DOM manipulation
- Smooth scrolling behavior
- Lazy loading ready
- Image optimization support

## Security Considerations

1. **XSS Protection**
   - All user input sanitized with `textContent`
   - No `innerHTML` used for user data
   - API responses validated

2. **CSRF Protection**
   - Cookies set with `SameSite=Lax`
   - POST requests with proper headers

3. **Session Security**
   - User ID is non-sensitive (randomly generated)
   - Server validates user identity for all operations
   - 7-day expiration prevents stale sessions

4. **Input Validation**
   - Frontend: Length and format checks
   - Backend: Full validation and sanitization

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- Message persistence (local storage)
- Typing indicators
- Read receipts
- Message search
- Export chat history
- Dark mode toggle
- Settings page
- Mobile app wrapper
