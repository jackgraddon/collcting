# Collcting

A self-hosted, privacy-first photo sharing PWA for friends and family. Connects to any [Collct](https://github.com/jackgraddon/collct) server.

No algorithm. No tracking. No strangers.

## Features

- **Multi-account** — switch between servers and accounts
- **Browser auth** — sign in with passkeys, no API token required
- **PWA** — installable on iOS, Android, and desktop
- **Push notifications** — get alerted for likes, comments, and group joins
- **Photo groups** — control who sees your photos
- **Dark mode** — built-in light/dark theme

## Getting Started

### Prerequisites

A running [Collct server](https://github.com/jackgraddon/collct) instance.

### Setup

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000` by default.

### Production

```bash
pnpm build
pnpm preview
```

## Tech Stack

- [Nuxt 4](https://nuxt.com) (SPA mode)
- [Nuxt UI v4](https://ui.nuxt.com)
- [Tailwind CSS v4](https://tailwindcss.com)
- TypeScript

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

[AGPL-3.0](LICENSE)
