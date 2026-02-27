# SkipBar
A lightweight browser extension designed for mouse only HTPC (Home Theater PC) setups. SkipBar adds a simple, auto-hiding quick-skip toolbar to the top of the screen when watching fullscreen video. Built for my own personal use.

If you control your PC from the couch with just a mouse, scrubbing through long-form content or skipping sponsors can be a pain. SkipBar gives you massive, easy-to-click buttons to jump forward or backward in set increments.

## Features

- **Built for Fullscreen:** Only activates when a video is in fullscreen mode.
- **Auto-Hiding UI:** Move your mouse to the top edge of the screen to reveal the toolbar. It hides automatically after 15 seconds or when you move the mouse away.
- **Smart Video Detection:** Pierces through Shadow DOMs to find the underlying `<video>` element, making it compatible with complex custom web players.
- **One-Click Skips:** Buttons for `-60s`, `-30s`, `-10s`, `-5s` and `+5s`, `+10s`, `+30s`, `+60s`.

## Installation (Unpacked)

Since this is a personal extension, you can install it manually in Chromium-based browsers (Chrome, Edge, Brave, etc.):

1. Download or clone this repository to your local machine.
2. Open your browser and go to the extensions page (`chrome://extensions/` or `edge://extensions/`).
3. Turn on **Developer mode** (usually a toggle in the top right corner).
4. Click **Load unpacked**.
5. Select the `SkipBar` folder containing the `manifest.json`.

## Usage

1. Play a video on any website and enter Fullscreen mode.
2. Move your cursor to the top of the screen to reveal the SkipBar toolbar.
3. Click to skip around!

## License

MIT License. Feel free to fork, modify, and use it however you like.
