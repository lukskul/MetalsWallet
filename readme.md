# Metal Wallet

**Metal Wallet** is a desktop application built with Electron that allows users to manage their precious metal investments. You can track gold, silver, and copper holdings, view current spot prices, and calculate gains/losses — all from a clean, retractable UI.

## 🚀 Features

- Add and view metal holdings with design, weight, and purchase price
- Real-time spot price fetch for Gold, Silver (from GoldAPI)
- Auto-calculate total portfolio value and gain/loss
- Clean UI with collapsible input form
- Offline fallback using local and server-cached spot prices
- Standalone desktop app (built with Electron)

## 🖥️ Installation

1. **Clone the repo:**

   ```bash
   git clone https://github.com/yourusername/metal-wallet.git
   cd metal-wallet

.
├── main.js             # Electron main process
├── index.html          # Main UI
├── renderer.js         # App logic (wallet, price fetch, UI rendering)
├── data/
│   ├── wallet.json     # Local wallet data
│   └── spotPrices.json # Cached spot prices
├── public/             # Assets like icons and CSS
├── .gitignore
├── package.json
└── README.md


## npm install

## npm start 