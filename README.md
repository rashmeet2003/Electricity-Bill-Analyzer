# ⚡ ElectraInsight - Electricity Bill Analyzer Dashboard

ElectraInsight is a premium, client-side Single Page Application (SPA) designed to help households and businesses take control of their electricity bills. By parsing electricity bill PDFs locally, users get instant insights into their usage trends, Appliance allocations, ROI on device upgrades, and interactive "What-If" simulation options to optimize savings.

---

## ✨ Features

1. **PDF Bill Analyzer**: Drag-and-drop electricity PDF bills. Auto extracts consumer number, units, bill month, fixed charges, taxes, and net amount completely client-side (no data leaves your browser).
2. **Monthly Trend Dashboard**: Visualizes billing data using multi-axis Chart.js representations. Includes Summer vs. Winter analysis, average unit cost, and peak month detection.
3. **Bill Spike Detection**: Detects and highlights month-on-month spikes ($> 20\%$) and maps them to seasonal heat/cooling patterns or appliance overuse.
4. **Appliance-wise Consumption Calculator**: Customize device wattages, quantities, and daily runtimes to compute real-time energy allocation shares shown in a donut chart.
5. **Interactive "What-If" Simulator**: Move sliders to cut AC hours, adjust thermostats, replace bulbs with LEDs, or eliminate standby power to immediately see simulated financial and carbon footprint savings.
6. **Upgrade ROI Calculator**: Compares conventional appliances to 5-star inverter models, mapping out cumulative payback timeline crossovers over 5 years.
7. **AI Energy Assistant**: Interactive chat interface (*"Electra"*) that parses your actual dashboard parameters to resolve queries like *"Why is my bill high?"* or *"How can I reduce my bill below ₹2000?"*.
8. **Gamification & Streaks**: Earn XP by achieving saving goals, unlock trophy badges, and maintain consecutive saving streaks.
9. **Multi-Property Manager**: Manage multiple property logs (e.g. Home vs. Retail Shop) independently, synced in local storage.
10. **Dual-Theme Support**: Instantly toggles between high-contrast Dark and Light modes.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS (custom properties, glassmorphism, responsive grid systems).
- **Libraries (via CDN)**:
  - [Chart.js](https://www.chartjs.org/) (Data visualization)
  - [PDF.js by Mozilla](https://mozilla.github.io/pdf.js/) (Client-side PDF text extraction)
  - [Lucide Icons](https://lucide.dev/) (Modern vector UI icons)
- **Local Dev Server**: [Vite](https://vitejs.dev/) (fast, standard ES modules server).

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### Installation & Launch
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/electricity-bill-analyzer.git
   cd electricity-bill-analyzer
   ```
2. Install the dev dependencies (Vite):
   ```bash
   npm install
   ```
3. Start the local server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   👉 **http://localhost:8088**

---

## 🐍 Alternative Server Option (No Node.js needed)
If you don't have Node.js installed, you can serve the application instantly using Python or any simple static file server.

In the project root directory, run:
```bash
# For Python 3
python -m http.server 8088
```
Then navigate to `http://localhost:8088` in your browser.
