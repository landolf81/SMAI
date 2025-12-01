# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

경락가 (Meridian Price) - A Korean agricultural market web application built with React + Vite. The app provides agricultural market price information, community features, Q&A, and a second-hand marketplace for farmers and market participants.

## Development Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)

# Build
npm run build            # Development build
npm run build:prod       # Production build (drops debugger statements)

# Testing
npm run test             # Run vitest tests
npm run test:ui          # Run tests with UI
npm run test:coverage    # Run tests with coverage

# Linting
npm run lint             # Check for lint errors
npm run lint:fix         # Auto-fix lint errors

# Other
npm run preview          # Preview production build
npm run analyze          # Analyze bundle size
```

## Tech Stack

- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS + DaisyUI (custom themes: market-light, market-dark)
- **State**: React Context (AuthContext) + TanStack Query
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **Routing**: React Router v6 (createBrowserRouter)

## Architecture

### Directory Structure

```
src/
├── App.jsx              # Router configuration, Layout component
├── main.jsx             # App entry point with AuthContextProvider
├── config/
│   └── supabase.js      # Supabase client and helper functions
├── context/
│   └── AuthContext.jsx  # Authentication state management
├── services/            # Supabase data layer (API calls)
├── pages/               # Route components
│   └── admin/           # Admin panel pages
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
└── utils/               # Utility functions
```

### Key Patterns

**Services Layer** (`src/services/`): All Supabase database operations are abstracted through service modules. Import from `services/index.js`:
```javascript
import { postService, userService, tagService } from './services';
```

Available services: `postService`, `commentService`, `tagService`, `tagGroupService`, `userService`, `adService`, `reportService`, `marketService`, `qnaService`, `badgeService`, `dmService`, `storageService`

**Authentication**: Uses Supabase Auth with a custom users table. The `AuthContext` provides:
- `currentUser` - User profile with role and permissions
- `login(inputs)`, `logout()`, `register(data)`
- `updateUserProfile(updates)`

User roles are managed through `admin_roles` table with granular permissions (canManagePosts, canManageTags, canManageUsers, canManageAds).

**Protected Routes**: Use `ProtectedRoute` component wrapper in App.jsx for authenticated pages.

**Layout**: The app uses a responsive layout with:
- `Navbar` - Top navigation
- `Leftbar` - PC sidebar (only shown when logged in)
- `MobileBottomNav` - Mobile bottom navigation

### Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Custom Theming

Custom Tailwind colors defined: `market` (green), `produce` (orange), `fresh` (blue). DaisyUI themes: `market-light`, `market-dark`.
