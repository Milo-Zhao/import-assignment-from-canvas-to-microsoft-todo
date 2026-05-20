# Canvas → Microsoft To Do

A Chrome extension that adds an **Add to To Do** button next to every assignment on Canvas LMS, exporting the assignment name, description, and due date directly into Microsoft To Do via the Graph API.

## Features

- Works on Canvas assignment **list pages** (`/courses/:id/assignments`) and **detail pages** (`/courses/:id/assignments/:id`)
- Exports assignment title, HTML description, and due date
- One-click sign-in via Microsoft OAuth 2.0
- Tasks land in your default Microsoft To Do "Tasks" list
- Toast feedback on success or error
- Local mock pages under `test/` for development without a Canvas account

---

## Install

1. Open `chrome://extensions` and enable **Developer mode**
2. Click **Load unpacked** and select this folder
3. Click the extension icon → **Sign in with Microsoft**

That's it — no setup required beyond signing in.

---

## How It Works

| File | Role |
|---|---|
| `manifest.json` | Declares permissions, content scripts, service worker |
| `background.js` | OAuth implicit flow, Graph API calls, token storage |
| `content.js` | Injects "Add to To Do" buttons into Canvas pages |
| `content.css` | Button and toast styles |
| `popup.html/js/css` | Toolbar popup — sign-in status |
| `options.html/js/css` | Sign-in / sign-out settings page |
| `test/` | Mock Canvas pages for local development |

### Authentication

Uses OAuth 2.0 **implicit flow** via `chrome.identity.launchWebAuthFlow`. The access token is returned directly in the redirect URL fragment — no client secret or token exchange step is needed. When the token expires the extension silently re-authenticates using the existing Microsoft session.

### Task Creation

Tasks are created via `POST /me/todo/lists/{listId}/tasks` on the Microsoft Graph API. The extension finds and caches your default "Tasks" list ID on first use.

---

## Local Development

```bash
cd test
python3 -m http.server 8080
```

Then open:
- **List page:** `http://localhost:8080/mock-assignment-list.html`
- **Detail page:** `http://localhost:8080/mock-assignment-detail.html`

---

## Permissions

| Permission | Why |
|---|---|
| `identity` | Chrome's OAuth helper for the Microsoft sign-in popup |
| `storage` | Stores tokens locally |
| `https://*.instructure.com/*` | Injects the button into Canvas pages |
| `https://graph.microsoft.com/*` | Creates tasks in Microsoft To Do |
| `https://login.microsoftonline.com/*` | OAuth authentication |

---

## Troubleshooting

**Button doesn't appear on my Canvas page**
Canvas's HTML structure varies by institution. Open DevTools and check if assignment rows use `.ig-row`, `.assignment`, or `[data-testid="assignment-list-item"]` — open an issue with the selector you see.

**Tasks appear without a due date**
Canvas sometimes renders the due date asynchronously. The extension tries multiple selectors; open an issue with the HTML around the due date element on your Canvas instance.
