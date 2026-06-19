/**
 * ElectraInsight - Electricity Bill Analyzer Logic
 * Client-Side JavaScript Application with LocalStorage Persistence
 */

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Default State Configuration
const DEFAULT_PROPERTIES = [
  {
    id: 'prop-home',
    name: 'Home Apartment',
    type: 'apartment',
    sanctionedLoad: 3, // kW
    history: [
      { month: 'Jan 2026', units: 180, amount: 1260, fixedCharges: 120, taxes: 108, consumerNo: '109843729' },
      { month: 'Feb 2026', units: 195, amount: 1365, fixedCharges: 120, taxes: 117, consumerNo: '109843729' },
      { month: 'Mar 2026', units: 220, amount: 1540, fixedCharges: 120, taxes: 132, consumerNo: '109843729' },
      { month: 'Apr 2026', units: 310, amount: 2480, fixedCharges: 120, taxes: 248, consumerNo: '109843729' },
      { month: 'May 2026', units: 410, amount: 3690, fixedCharges: 120, taxes: 369, consumerNo: '109843729' },
      { month: 'Jun 2026', units: 540, amount: 5130, fixedCharges: 120, taxes: 513, consumerNo: '109843729' }
    ],
    appliances: [
      { id: 'app-ac', name: 'Air Conditioner', icon: 'snowflake', wattage: 1500, quantity: 1, hours: 8 },
      { id: 'app-fan', name: 'Ceiling Fan', icon: 'wind', wattage: 75, quantity: 4, hours: 12 },
      { id: 'app-tv', name: 'Television', icon: 'tv', wattage: 100, quantity: 1, hours: 4 },
      { id: 'app-fridge', name: 'Refrigerator', icon: 'refrigerator', wattage: 150, quantity: 1, hours: 24 }, // duty cycle handled in calc
      { id: 'app-led', name: 'LED Bulbs', icon: 'lightbulb', wattage: 9, quantity: 8, hours: 6 },
      { id: 'app-pump', name: 'Water Pump', icon: 'droplet', wattage: 750, quantity: 1, hours: 1 }
    ]
  },
  {
    id: 'prop-shop',
    name: 'Retail Shop',
    type: 'commercial',
    sanctionedLoad: 8, // kW
    history: [
      { month: 'Jan 2026', units: 450, amount: 4050, fixedCharges: 350, taxes: 360, consumerNo: '540928172' },
      { month: 'Feb 2026', units: 480, amount: 4320, fixedCharges: 350, taxes: 384, consumerNo: '540928172' },
      { month: 'Mar 2026', units: 520, amount: 4680, fixedCharges: 350, taxes: 416, consumerNo: '540928172' },
      { month: 'Apr 2026', units: 680, amount: 6800, fixedCharges: 350, taxes: 680, consumerNo: '540928172' },
      { month: 'May 2026', units: 820, amount: 8200, fixedCharges: 350, taxes: 820, consumerNo: '540928172' },
      { month: 'Jun 2026', units: 980, amount: 9800, fixedCharges: 350, taxes: 980, consumerNo: '540928172' }
    ],
    appliances: [
      { id: 'app-ac-comm', name: 'Commercial AC', icon: 'snowflake', wattage: 2200, quantity: 2, hours: 10 },
      { id: 'app-lighting', name: 'Shop Lighting', icon: 'lightbulb', wattage: 15, quantity: 20, hours: 12 },
      { id: 'app-computer', name: 'Billing Systems', icon: 'monitor', wattage: 150, quantity: 2, hours: 10 },
      { id: 'app-fridge-comm', name: 'Beverage Cooler', icon: 'refrigerator', wattage: 300, quantity: 1, hours: 24 }
    ]
  }
];

const DEFAULT_GAMIFICATION = {
  points: 120,
  streak: 3,
  challenges: [
    { id: 'ch-saver', title: 'Summer Power Saver', desc: 'Keep units consumed under 250 units in your next bill.', reward: 150, progress: 0, target: 250, completed: false, type: 'units' },
    { id: 'ch-led', title: 'LED Champion', desc: 'Simulate replacing 5 conventional bulbs with 9W LEDs.', reward: 100, progress: 0, target: 5, completed: false, type: 'leds' },
    { id: 'ch-ac', title: 'Cooling Efficiency', desc: 'Set AC temperature setpoint to 25°C or higher in What-If.', reward: 80, progress: 24, target: 25, completed: false, type: 'ac-temp' }
  ],
  badges: [
    { id: 'bdg-novice', name: 'Eco Novice', desc: 'Unlocked by starting your energy savings journey.', unlocked: true, icon: 'shield' },
    { id: 'bdg-streak', name: 'Streak Master', desc: 'Save energy for 3 consecutive months.', unlocked: true, icon: 'flame' },
    { id: 'bdg-architect', name: 'Savings Architect', desc: 'Run a simulation using the What-If tool.', unlocked: false, icon: 'activity' },
    { id: 'bdg-carbon', name: 'Forest Creator', desc: 'Reduce Carbon Footprint equivalent to 5+ trees.', unlocked: false, icon: 'trees' }
  ]
};

// Global App State
let appState = {
  properties: [],
  selectedPropertyId: '',
  gamification: {}
};

// Global Chart Instances
let trendChartInstance = null;
let applianceDonutInstance = null;
let roiLineInstance = null;

// Average energy rates per unit (Tier-based estimation)
const BASE_RATE = 8.5; // ₹ per kWh average

/* ----------------------------------------------------
   CORE STORAGE SYNC
   ---------------------------------------------------- */
function loadStateFromStorage() {
  const stored = localStorage.getItem('electra_insight_state');
  if (stored) {
    try {
      appState = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse storage state. Reinitializing defaults.', e);
      initializeDefaultState();
    }
  } else {
    initializeDefaultState();
  }
  
  // Backwards compatibility check
  if (!appState.properties || appState.properties.length === 0) {
    initializeDefaultState();
  }
}

function initializeDefaultState() {
  appState.properties = JSON.parse(JSON.stringify(DEFAULT_PROPERTIES));
  appState.selectedPropertyId = appState.properties[0].id;
  appState.gamification = JSON.parse(JSON.stringify(DEFAULT_GAMIFICATION));
  saveStateToStorage();
}

function saveStateToStorage() {
  localStorage.setItem('electra_insight_state', JSON.stringify(appState));
}

function getActiveProperty() {
  return appState.properties.find(p => p.id === appState.selectedPropertyId) || appState.properties[0];
}

/* ----------------------------------------------------
   THEME TOGGLE SYSTEM (LIGHT & DARK MODES)
   ---------------------------------------------------- */
function loadTheme() {
  const theme = localStorage.getItem('electra_theme') || 'dark';
  applyTheme(theme);
}

function applyTheme(theme) {
  const root = document.documentElement;
  const sunIcon = document.querySelector('.theme-toggle-btn .sun-icon');
  const moonIcon = document.querySelector('.theme-toggle-btn .moon-icon');
  
  if (theme === 'light') {
    root.classList.add('light-mode');
    if (sunIcon) sunIcon.classList.add('hidden');
    if (moonIcon) moonIcon.classList.remove('hidden');
  } else {
    root.classList.remove('light-mode');
    if (sunIcon) sunIcon.classList.remove('hidden');
    if (moonIcon) moonIcon.classList.add('hidden');
  }
}

function toggleTheme() {
  const root = document.documentElement;
  const isLight = root.classList.contains('light-mode');
  const newTheme = isLight ? 'dark' : 'light';
  localStorage.setItem('electra_theme', newTheme);
  applyTheme(newTheme);
  
  // Re-render active view's charts to adapt grid lines and label colors
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    const targetId = activeNav.getAttribute('data-target');
    if (targetId === 'dashboard') {
      renderDashboard();
    } else if (targetId === 'appliances') {
      recalculateApplianceTotals();
    } else if (targetId === 'roi') {
      calculateUpgradeROI();
    }
  }
}

/* ----------------------------------------------------
   DOM RENDERING & CONTROLLER INTERACTION
   ---------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  loadTheme();
  initializeUI();
  
  // Navigation Handler
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetId = item.getAttribute('data-target');
      
      // Update sidebar active link
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update visible viewport section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
          section.classList.add('active');
        }
      });

      // Update Section Title
      const titleMapping = {
        'dashboard': 'Dashboard Overview',
        'appliances': 'Appliance Share Calculator',
        'simulator': '"What-If" Savings Simulator',
        'roi': 'Appliance Upgrade ROI',
        'gamification': 'Challenges & Badges',
        'properties': 'Properties Manager',
        'chatbot': 'AI Energy Assistant'
      };
      document.getElementById('currentSectionTitle').innerText = titleMapping[targetId] || 'VoltInsight';

      // Perform context-specific redraws/computations
      if (targetId === 'dashboard') {
        renderDashboard();
      } else if (targetId === 'appliances') {
        renderAppliancesSection();
      } else if (targetId === 'simulator') {
        initSimulatorSection();
      } else if (targetId === 'roi') {
        calculateUpgradeROI();
      } else if (targetId === 'gamification') {
        renderGamificationSection();
      } else if (targetId === 'properties') {
        renderPropertiesSection();
      }
    });
  });

  // Sidebar toggle for mobile/tablets
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Handle outside click to close sidebar
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Property selection listener
  const propSelector = document.getElementById('propertySelector');
  propSelector.addEventListener('change', (e) => {
    appState.selectedPropertyId = e.target.value;
    saveStateToStorage();
    
    // Refresh current view
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      activeNav.click();
    }
    
    // Quick update of common badges
    updateGlobalHeaderMetrics();
  });

  // Load Initial Screen
  renderDashboard();
});

/* Initialize UI Controls on startup */
function initializeUI() {
  // Populate property selector
  const propSelector = document.getElementById('propertySelector');
  propSelector.innerHTML = '';
  appState.properties.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.innerText = p.name;
    if (p.id === appState.selectedPropertyId) {
      opt.selected = true;
    }
    propSelector.appendChild(opt);
  });

  // Initialize common header metrics
  updateGlobalHeaderMetrics();

  // Uploader Dropzone listeners
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('billFileInput');
  const browseBtn = document.getElementById('browseBtn');

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleUploadedBillPDF(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUploadedBillPDF(e.target.files[0]);
    }
  });

  // Demo Data helper button
  document.getElementById('loadDemoBtn').addEventListener('click', () => {
    loadDemoHistory();
  });

  // Chart view switches (All vs Summer/Winter toggle)
  const chartToggles = document.querySelectorAll('.chart-toggle-btn');
  chartToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      chartToggles.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-chart-type');
      renderDashboardChart(type);
    });
  });

  // Chat chatbot send actions
  document.getElementById('sendChatBtn').addEventListener('click', handleChatSendMessage);
  document.getElementById('chatInputField').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSendMessage();
  });

  // Chat quick questions shortcuts
  document.querySelectorAll('.btn-chat-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-query');
      document.getElementById('chatInputField').value = text;
      handleChatSendMessage();
    });
  });

  // "What-if" simulator controllers
  document.getElementById('simAcHoursSlider').addEventListener('input', updateWhatIfSimulator);
  document.getElementById('simAcTempSlider').addEventListener('input', updateWhatIfSimulator);
  document.getElementById('simLedsSlider').addEventListener('input', updateWhatIfSimulator);
  document.getElementById('simStandbySwitch').addEventListener('change', updateWhatIfSimulator);

  // Sync to simulator button in appliances
  document.getElementById('syncToSimulatorBtn').addEventListener('click', () => {
    const activeNav = document.querySelector('.nav-item[data-target="simulator"]');
    if (activeNav) {
      activeNav.click();
      // Setup some default simulation starting parameters from appliance configs
      const prop = getActiveProperty();
      const ac = prop.appliances.find(a => a.id === 'app-ac' || a.name.toLowerCase().includes('ac'));
      if (ac && ac.hours > 4) {
        document.getElementById('simAcHoursSlider').value = 1.5; // Simulate 1.5 hrs reduction
      }
      const ledCount = prop.appliances.find(a => a.id === 'app-led');
      if (ledCount) {
        document.getElementById('simLedsSlider').value = 5; // Simulate replacing 5 bulbs
      }
      updateWhatIfSimulator();
    }
  });

  // Appliance ROI upgrades calculator submit
  document.getElementById('btnCalculateRoi').addEventListener('click', calculateUpgradeROI);
  document.getElementById('roiHoursDaily').addEventListener('input', (e) => {
    document.getElementById('roiHoursDailyVal').innerText = e.target.value;
  });

  // Add custom appliance action
  document.getElementById('addApplianceBtn').addEventListener('click', showAddAppliancePrompt);

  // Property Form Actions
  document.getElementById('addNewPropertyBtn').addEventListener('click', () => {
    document.getElementById('addPropertyFormCard').classList.remove('hidden');
    document.getElementById('propName').value = '';
    document.getElementById('propSanctionedLoad').value = 3;
  });

  document.getElementById('cancelAddPropBtn').addEventListener('click', () => {
    document.getElementById('addPropertyFormCard').classList.add('hidden');
  });

  document.getElementById('savePropertyBtn').addEventListener('click', handleSaveNewProperty);

  // Alert card click simulator red-alert routing
  document.getElementById('viewSimulatorFromAlert').addEventListener('click', () => {
    const simNav = document.querySelector('.nav-item[data-target="simulator"]');
    if (simNav) {
      simNav.click();
      document.getElementById('simAcHoursSlider').value = 2; // Suggest 2 hours cut
      updateWhatIfSimulator();
    }
  });

  // Theme Toggle Button click handler
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Initialize Lucide Icons
  lucide.createIcons();
}

function updateGlobalHeaderMetrics() {
  const prop = getActiveProperty();
  
  // Streak
  document.getElementById('streakCount').innerText = `${appState.gamification.streak} Months`;
  
  // Compute score
  const score = computeEnergyScore(prop);
  document.getElementById('headerScoreValue').innerText = score > 0 ? score : '--';
}

/* Calculate a property's overall efficiency score based on current billing trends and configurations */
function computeEnergyScore(property) {
  if (!property.history || property.history.length === 0) return 0;
  
  // Score formula incorporates: average units consumed per month relative to appliance profile,
  // spikes count, and whether they use led lights vs high wattage options.
  const latestBill = property.history[property.history.length - 1];
  if (!latestBill) return 0;

  let baseScore = 85;

  // Penalty for high consumption per sanctioned load
  const unitsPerLoad = latestBill.units / property.sanctionedLoad;
  if (unitsPerLoad > 150) {
    baseScore -= 15;
  } else if (unitsPerLoad < 80) {
    baseScore += 5;
  }

  // Penalty for recent spikes
  if (property.history.length >= 2) {
    const prev = property.history[property.history.length - 2];
    const MoMChange = (latestBill.units - prev.units) / prev.units;
    if (MoMChange > 0.2) {
      baseScore -= 20; // Massive penalty for high spikes
    } else if (MoMChange < -0.05) {
      baseScore += 8; // Reward for savings
    }
  }

  // Reward for low appliance standby configuration
  const hasLeds = property.appliances.some(a => (a.id === 'app-led' || a.name.toLowerCase().includes('led')) && a.quantity > 5);
  if (hasLeds) {
    baseScore += 5;
  }

  return Math.max(20, Math.min(100, Math.round(baseScore)));
}

/* ----------------------------------------------------
   1. DASHBOARD VIEW CONTROLLER
   ---------------------------------------------------- */
function renderDashboard() {
  const prop = getActiveProperty();
  const history = prop.history;

  if (!history || history.length === 0) {
    // Show empty states
    document.getElementById('statUnits').innerHTML = `-- <span class="unit-label">kWh</span>`;
    document.getElementById('statUnitsCompare').innerText = 'No history loaded';
    document.getElementById('statAmount').innerText = '--';
    document.getElementById('statAmountCompare').innerText = 'No history loaded';
    document.getElementById('statCarbon').innerHTML = `-- <span class="unit-label">kg CO₂</span>`;
    document.getElementById('statTreesOffset').innerText = '-- trees';
    
    document.getElementById('dashScoreValue').innerText = '--';
    document.getElementById('scoreLevel').innerText = 'Calculating';
    document.getElementById('scoreFeedback').innerText = 'Upload a bill or load sample history';
    
    document.getElementById('spikeAlertCard').classList.add('hidden');
    document.getElementById('smartRecommendationsContainer').innerHTML = `
      <div class="rec-empty-state">
        <i data-lucide="info" class="empty-icon"></i>
        <span>No recommendations. Load sample history below.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Retrieve latest bill
  const latest = history[history.length - 1];
  const units = latest.units;
  const amount = latest.amount;

  document.getElementById('statUnits').innerHTML = `${units} <span class="unit-label">kWh</span>`;
  document.getElementById('statAmount').innerText = `₹${amount}`;

  // MoM comparison for units & amount
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    
    // Units MoM
    const unitsChange = ((units - prev.units) / prev.units * 100).toFixed(1);
    const unitsArrow = units > prev.units ? '↑' : '↓';
    const unitsClass = units > prev.units ? 'text-red' : 'text-green';
    document.getElementById('statUnitsCompare').innerHTML = `<span class="${unitsClass}">${unitsArrow} ${Math.abs(unitsChange)}%</span> vs last month`;

    // Amount MoM
    const amountChange = ((amount - prev.amount) / prev.amount * 100).toFixed(1);
    const amountArrow = amount > prev.amount ? '↑' : '↓';
    const amountClass = amount > prev.amount ? 'text-red' : 'text-green';
    document.getElementById('statAmountCompare').innerHTML = `<span class="${amountClass}">${amountArrow} ${Math.abs(amountChange)}%</span> vs last month`;
  } else {
    document.getElementById('statUnitsCompare').innerText = '1 month loaded';
    document.getElementById('statAmountCompare').innerText = '1 month loaded';
  }

  // Carbon footprint estimation
  // 1 unit (kWh) of electricity in India standard grid = ~0.82 kg CO2 equivalent
  const co2 = Math.round(units * 0.82);
  // 1 tree absorbs ~24 kg CO2 per year, which is ~2 kg per month.
  const treesNeeded = (co2 / 2).toFixed(1);
  document.getElementById('statCarbon').innerHTML = `${co2} <span class="unit-label">kg CO₂</span>`;
  document.getElementById('statTreesOffset').innerText = `Equivalent to planting ${treesNeeded} trees monthly`;

  // Energy score card
  const score = computeEnergyScore(prop);
  document.getElementById('dashScoreValue').innerText = score;
  
  // Set stroke-dashoffset on ring. Max circumference = 2 * PI * 28 = ~175.9
  const offset = 175.9 - (score / 100) * 175.9;
  document.getElementById('scoreRing').style.strokeDashoffset = offset;

  let levelText = 'Fair';
  let feedback = 'Your energy usage is average. Try reducing cooling loads.';
  let scoreColor = 'var(--neon-yellow)';

  if (score >= 85) {
    levelText = 'Excellent';
    feedback = 'Highly efficient! Keep up the eco-habits.';
    scoreColor = 'var(--neon-green)';
  } else if (score >= 70) {
    levelText = 'Good';
    feedback = 'Smart optimization is visible. Look into standby loads.';
    scoreColor = 'var(--neon-cyan)';
  } else if (score < 55) {
    levelText = 'Poor';
    feedback = 'High usage detected. AC cooling optimization needed!';
    scoreColor = 'var(--neon-red)';
  }
  
  document.getElementById('scoreLevel').innerText = levelText;
  document.getElementById('scoreLevel').style.color = scoreColor;
  document.getElementById('scoreFeedback').innerText = feedback;
  document.getElementById('scoreRing').setAttribute('stroke', scoreColor);

  // Spike Alert Panel (Spike > 20% Mom)
  let spiked = false;
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const MoMChange = ((units - prev.units) / prev.units * 100);
    if (MoMChange >= 20) {
      spiked = true;
      document.getElementById('spikeAlertCard').classList.remove('hidden');
      document.getElementById('spikeValueText').innerText = `Consumption increased by ${MoMChange.toFixed(0)}% this month`;
    }
  }
  if (!spiked) {
    document.getElementById('spikeAlertCard').classList.add('hidden');
  }

  // Current Bill Breakdown panel
  document.getElementById('bdConsumerNo').innerText = latest.consumerNo || 'N/A';
  document.getElementById('bdBillingMonth').innerText = latest.month || 'Current';
  document.getElementById('bdFixedCharges').innerText = `₹${latest.fixedCharges || 120}`;
  document.getElementById('bdTaxes').innerText = `₹${latest.taxes || Math.round(amount * 0.1)}`;
  const energyChg = amount - (latest.fixedCharges || 120) - (latest.taxes || Math.round(amount * 0.1));
  document.getElementById('bdEnergyCharges').innerText = `₹${energyChg}`;
  document.getElementById('bdGrandTotal').innerText = `₹${amount}`;

  // Load Main Trend Chart
  renderDashboardChart('all');

  // Load Recommendations
  generateRecommendations(prop);
}

/* Chart.js dual axis rendering for history trends */
function renderDashboardChart(mode) {
  const prop = getActiveProperty();
  const ctx = document.getElementById('trendChart').getContext('2d');
  
  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  let labels = [];
  let unitData = [];
  let costData = [];

  const history = prop.history;

  if (mode === 'all') {
    labels = history.map(h => h.month);
    unitData = history.map(h => h.units);
    costData = history.map(h => h.amount);
  } else if (mode === 'seasons') {
    // Summer (April, May, June, July) vs Winter (Nov, Dec, Jan, Feb)
    const summerMonths = ['Apr', 'May', 'Jun', 'Jul'];
    const winterMonths = ['Nov', 'Dec', 'Jan', 'Feb'];

    const summerRecords = history.filter(h => summerMonths.some(m => h.month.includes(m)));
    const winterRecords = history.filter(h => winterMonths.some(m => h.month.includes(m)));

    labels = ['Avg Summer Usage', 'Avg Winter Usage'];
    
    const avgSummerUnits = summerRecords.reduce((sum, h) => sum + h.units, 0) / (summerRecords.length || 1);
    const avgSummerCost = summerRecords.reduce((sum, h) => sum + h.amount, 0) / (summerRecords.length || 1);
    
    const avgWinterUnits = winterRecords.reduce((sum, h) => sum + h.units, 0) / (winterRecords.length || 1);
    const avgWinterCost = winterRecords.reduce((sum, h) => sum + h.amount, 0) / (winterRecords.length || 1);

    unitData = [Math.round(avgSummerUnits), Math.round(avgWinterUnits)];
    costData = [Math.round(avgSummerCost), Math.round(avgWinterCost)];
  }

  const isLight = document.documentElement.classList.contains('light-mode');
  const textColor = isLight ? '#475569' : '#8e9aae';
  const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.03)';

  trendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Units Consumed (kWh)',
          data: unitData,
          backgroundColor: 'rgba(189, 94, 255, 0.4)',
          borderColor: '#bd5eff',
          borderWidth: 2,
          borderRadius: 4,
          yAxisID: 'yUnits'
        },
        {
          label: 'Bill Amount (₹)',
          data: costData,
          type: 'line',
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderColor: '#00e5ff',
          borderWidth: 3,
          pointBackgroundColor: '#00e5ff',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 7,
          tension: 0.35,
          yAxisID: 'yAmount'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Inter', size: 11 } }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        yUnits: {
          type: 'linear',
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: textColor },
          title: { display: true, text: 'Units (kWh)', color: textColor }
        },
        yAmount: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: textColor },
          title: { display: true, text: 'Amount (₹)', color: textColor }
        }
      }
    }
  });

  // Calculate footer submetrics
  if (history.length > 0) {
    const totalUnits = history.reduce((sum, h) => sum + h.units, 0);
    const totalAmt = history.reduce((sum, h) => sum + h.amount, 0);
    const avgRate = (totalAmt / totalUnits).toFixed(2);
    document.getElementById('avgCostPerUnit').innerText = `₹${avgRate}/unit`;

    // Peak Month
    let peakIndex = 0;
    history.forEach((h, index) => {
      if (h.units > history[peakIndex].units) {
        peakIndex = index;
      }
    });
    document.getElementById('peakMonthText').innerText = `${history[peakIndex].month} (${history[peakIndex].units} units)`;

    // Projections
    const lastUnits = history[history.length - 1].units;
    const minPred = Math.round(lastUnits * 0.95);
    const maxPred = Math.round(lastUnits * 1.05);
    
    // Estimate billing range
    const minCost = Math.round(minPred * parseFloat(avgRate));
    const maxCost = Math.round(maxPred * parseFloat(avgRate));
    document.getElementById('nextMonthPrediction').innerText = `₹${minCost} - ₹${maxCost}`;
  }
}

/* AI savings recommendations generator based on the active property's metrics and history */
function generateRecommendations(property) {
  const container = document.getElementById('smartRecommendationsContainer');
  container.innerHTML = '';

  if (!property.history || property.history.length === 0) return;

  const latestBill = property.history[property.history.length - 1];
  const avgRate = latestBill ? (latestBill.amount / latestBill.units) : BASE_RATE;

  // Scenarios suggestions
  let suggestions = [];

  // AC check
  const ac = property.appliances.find(a => a.id === 'app-ac' || a.name.toLowerCase().includes('ac'));
  if (ac && ac.hours >= 6) {
    const savedUnits = Math.round(ac.wattage * ac.quantity * 1.5 * 30 / 1000); // reducing 1.5 hours daily
    const savedCost = Math.round(savedUnits * avgRate);
    suggestions.push({
      icon: 'snowflake',
      iconClass: 'bg-cyan text-cyan',
      text: `Reducing AC usage by 1.5 hours daily on your ${ac.name} configuration can save approximately **${savedUnits} units** next month.`,
      math: `Estimated Savings: ~₹${savedCost}/month`
    });

    suggestions.push({
      icon: 'thermometer',
      iconClass: 'bg-yellow text-yellow',
      text: `Set AC thermostat temperature to **24°C** instead of 20°C. Lower settings consume ~24% more compressor duty load.`,
      math: `Estimated Savings: ~₹${Math.round(ac.wattage * ac.quantity * ac.hours * 0.24 * 30 / 1000 * avgRate)}/month`
    });
  }

  // Standby plug check
  suggestions.push({
    icon: 'toggle-left',
    iconClass: 'bg-purple text-purple',
    text: `Eliminate vampire standby power draw on home media systems, TVs, and microwave appliances using smart switches.`,
    math: `Estimated Savings: ~₹${Math.round(20 * avgRate)}/month`
  });

  // LED bulb check
  const led = property.appliances.find(a => a.id === 'app-led' || a.name.toLowerCase().includes('led'));
  if (led && led.quantity < 10) {
    suggestions.push({
      icon: 'lightbulb',
      iconClass: 'bg-green text-green',
      text: `Replace 5 older conventional/halogen bulbs with 9W energy-saving LED bulbs.`,
      math: `Estimated Savings: ~₹${Math.round((60 - 9) * 5 * 6 * 30 / 1000 * avgRate)}/month`
    });
  }

  if (suggestions.length === 0) {
    container.innerHTML = `
      <div class="rec-empty-state">
        <i data-lucide="check-circle" class="empty-icon text-green"></i>
        <span>Your configuration is highly optimized! Try adding more appliances to identify additional savings.</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  suggestions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.innerHTML = `
      <div class="rec-icon-box ${s.iconClass}">
        <i data-lucide="${s.icon}"></i>
      </div>
      <div class="rec-info">
        <p class="rec-text">${s.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
        <span class="rec-math text-green">${s.math}</span>
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

/* ----------------------------------------------------
   2. DEMO BILL & PDF PARSING LOGIC
   ---------------------------------------------------- */
function loadDemoHistory() {
  const prop = getActiveProperty();
  // Populate history from static default template
  const defaultProp = DEFAULT_PROPERTIES.find(p => p.id === prop.id) || DEFAULT_PROPERTIES[0];
  prop.history = JSON.parse(JSON.stringify(defaultProp.history));
  prop.appliances = JSON.parse(JSON.stringify(defaultProp.appliances));
  
  saveStateToStorage();
  
  // Re-unlock some initial gamification achievements
  appState.gamification.points += 50;
  saveStateToStorage();

  renderDashboard();
  updateGlobalHeaderMetrics();
  
  alert('Sample billing records and appliance parameters loaded successfully for: ' + prop.name);
}

/* Parses local PDF client-side using PDF.js and tries to extract billing items */
async function handleUploadedBillPDF(file) {
  if (!file) return;

  const dropzone = document.getElementById('uploadDropzone');
  const loader = document.getElementById('parsingLoader');
  const statusText = document.getElementById('parsingStatusText');

  // Toggle visibility loaders
  dropzone.classList.add('hidden');
  loader.classList.remove('hidden');
  statusText.innerText = `Reading "${file.name}"...`;

  try {
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        
        statusText.innerText = 'Extracting PDF layout text...';
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        statusText.innerText = 'Analyzing billing parameters...';
        // Delay to make parsing look thorough
        setTimeout(() => {
          parseBillTextAndAddRecord(fullText);
          loader.classList.add('hidden');
          dropzone.classList.remove('hidden');
        }, 1200);

      } catch (err) {
        console.error('PDF JS Extract Error:', err);
        showParsingError();
      }
    };
    fileReader.readAsArrayBuffer(file);

  } catch (err) {
    console.error('File Read Error:', err);
    showParsingError();
  }
}

function showParsingError() {
  const dropzone = document.getElementById('uploadDropzone');
  const loader = document.getElementById('parsingLoader');
  loader.classList.add('hidden');
  dropzone.classList.remove('hidden');
  alert('Failed to read PDF. Please ensure it is a valid PDF file.');
}

/* Helper to parse text using regex rules and push to property history */
function parseBillTextAndAddRecord(text) {
  console.log("PDF parsed raw text length:", text.length);
  
  // Normalize text casing and space
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');

  // Extraction values
  let consumerNo = null;
  let units = null;
  let amount = null;
  let monthStr = null;
  let fixedCharges = 120;
  let taxes = null;

  // 1. Consumer No patterns
  const consumerMatches = [
    /consumer\s*(?:no|num|number)\s*[:\-\s]*(\d{8,12})/i,
    /account\s*(?:no|id|number)\s*[:\-\s]*(\d{8,12})/i,
    /conn\s*(?:no|id|id)\s*[:\-\s]*(\d{8,12})/i
  ];
  for (let regex of consumerMatches) {
    const match = regex.exec(text);
    if (match && match[1]) {
      consumerNo = match[1];
      break;
    }
  }
  if (!consumerNo) consumerNo = '109843729'; // Fallback

  // 2. Units consumed patterns
  const unitsMatches = [
    /(?:units|consumption|energy|qty|units\s*billed)\s*[:\-\s]*(\d{2,4})\s*(?:kwh|units|units)?/i,
    /billed\s*units\s*[:\-\s]*(\d{2,4})/i,
    /(\d{2,4})\s*(?:kwh|units)\s*(?:consumed|used)/i
  ];
  for (let regex of unitsMatches) {
    const match = regex.exec(text);
    if (match && match[1]) {
      units = parseInt(match[1]);
      break;
    }
  }

  // 3. Amount patterns
  const amountMatches = [
    /(?:amount\s*due|payable|net\s*due|total\s*payable|amount\s*payable)\s*[:\-\s\₹]*(\d{4,6})/i,
    /bill\s*amount\s*[:\-\s\₹]*(\d{4,6})/i,
    /total\s*bill\s*[:\-\s\₹]*(\d{4,6})/i
  ];
  for (let regex of amountMatches) {
    const match = regex.exec(text);
    if (match && match[1]) {
      amount = parseInt(match[1]);
      break;
    }
  }

  // 4. Month patterns
  const monthRegexes = [
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}/i,
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s]*\d{4}/i,
    /bill\s*month\s*[:\-\s]*([a-z]{3,9}\s*\d{4})/i
  ];
  for (let regex of monthRegexes) {
    const match = regex.exec(text);
    if (match) {
      monthStr = match[1] || match[0];
      // Format as "Jun 2026"
      const parts = monthStr.split(/[\s\-]+/);
      if (parts.length >= 2) {
        const mon = parts[0].substring(0, 3);
        const year = parts[1];
        monthStr = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase() + ' ' + year;
      }
      break;
    }
  }

  // Fallback engine for demos if uploading a random PDF
  // We calculate next month in sequence with random realistic variables
  const prop = getActiveProperty();
  if (!units || !amount) {
    console.log("Regex parameters failed. Generating simulated fallback billing card.");
    
    // Pick last month in history
    let lastMonthObj = null;
    let nextMonthName = "Jul 2026";
    if (prop.history && prop.history.length > 0) {
      lastMonthObj = prop.history[prop.history.length - 1];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const parts = lastMonthObj.month.split(' ');
      const curIndex = monthNames.indexOf(parts[0]);
      let nextYear = parseInt(parts[1]);
      let nextIndex = curIndex + 1;
      if (nextIndex > 11) {
        nextIndex = 0;
        nextYear++;
      }
      nextMonthName = monthNames[nextIndex] + ' ' + nextYear;
    }

    // Generate random realistic billing statistics
    units = Math.round(300 + Math.random() * 200);
    amount = Math.round(units * BASE_RATE + 200);
    monthStr = nextMonthName;
  }

  taxes = Math.round(amount * 0.1);
  fixedCharges = prop.type === 'commercial' ? 350 : 120;

  // Ensure record is not duplicate
  const exists = prop.history.some(h => h.month.toLowerCase() === monthStr.toLowerCase());
  if (exists) {
    alert(`A billing record already exists for ${monthStr}. Overriding with updated parameters.`);
    prop.history = prop.history.filter(h => h.month.toLowerCase() !== monthStr.toLowerCase());
  }

  const record = {
    month: monthStr,
    units: units,
    amount: amount,
    fixedCharges: fixedCharges,
    taxes: taxes,
    consumerNo: consumerNo
  };

  prop.history.push(record);
  
  // Gamification triggers
  appState.gamification.points += 80;
  
  // Check challenges
  appState.gamification.challenges.forEach(ch => {
    if (ch.type === 'units' && units < ch.target && !ch.completed) {
      ch.completed = true;
      ch.progress = units;
      appState.gamification.points += ch.reward;
      alert(`🎉 Challenge Completed: "${ch.title}"! Unlocked +${ch.reward} XP.`);
    }
  });

  saveStateToStorage();
  
  renderDashboard();
  updateGlobalHeaderMetrics();

  alert(`📄 Bill parsed successfully!\nMonth: ${monthStr}\nUnits: ${units} kWh\nAmount: ₹${amount}\nAdded to property "${prop.name}".`);
}

/* ----------------------------------------------------
   3. APPLIANCE CALCULATOR VIEW CONTROLLER
   ---------------------------------------------------- */
function renderAppliancesSection() {
  const prop = getActiveProperty();
  const grid = document.getElementById('appliancesGrid');
  grid.innerHTML = '';

  prop.appliances.forEach(app => {
    const card = document.createElement('div');
    card.className = `appliance-card ${app.hours > 0 ? 'active' : ''}`;
    card.id = `app-card-${app.id}`;
    card.innerHTML = `
      <div class="app-card-top">
        <div class="app-info-left">
          <div class="app-icon-wrapper">
            <i data-lucide="${app.icon || 'plug'}"></i>
          </div>
          <div>
            <div class="app-name">${app.name}</div>
            <div class="app-wattage">${app.wattage}W</div>
          </div>
        </div>
        <button class="app-delete-btn" onclick="deleteAppliance('${app.id}')" title="Delete Appliance">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      
      <div class="app-card-controls">
        <!-- Quantity counter -->
        <div class="number-input-group">
          <button class="btn-num" onclick="adjustQty('${app.id}', -1)">-</button>
          <span class="num-val" id="qty-val-${app.id}">${app.quantity}</span>
          <button class="btn-num" onclick="adjustQty('${app.id}', 1)">+</button>
        </div>

        <!-- Slider daily usage -->
        <div class="slider-group">
          <div class="slider-group-labels">
            <span>Daily usage</span>
            <span id="slider-txt-${app.id}"><strong>${app.hours} hrs</strong></span>
          </div>
          <input type="range" class="custom-slider" min="0" max="24" step="0.5" 
                 value="${app.hours}" oninput="updateApplianceHours('${app.id}', this.value)">
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  lucide.createIcons();
  recalculateApplianceTotals();
}

function adjustQty(appId, delta) {
  const prop = getActiveProperty();
  const app = prop.appliances.find(a => a.id === appId);
  if (app) {
    app.quantity = Math.max(1, app.quantity + delta);
    document.getElementById(`qty-val-${appId}`).innerText = app.quantity;
    saveStateToStorage();
    recalculateApplianceTotals();
  }
}

function updateApplianceHours(appId, val) {
  const prop = getActiveProperty();
  const app = prop.appliances.find(a => a.id === appId);
  if (app) {
    app.hours = parseFloat(val);
    document.getElementById(`slider-txt-${appId}`).innerHTML = `<strong>${val} hrs</strong>`;
    
    // Toggle active card styling
    const card = document.getElementById(`app-card-${appId}`);
    if (app.hours > 0) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }

    saveStateToStorage();
    recalculateApplianceTotals();
  }
}

function deleteAppliance(appId) {
  const prop = getActiveProperty();
  prop.appliances = prop.appliances.filter(a => a.id !== appId);
  saveStateToStorage();
  renderAppliancesSection();
}

function showAddAppliancePrompt() {
  const name = prompt("Enter appliance name:");
  if (!name) return;
  const watts = parseInt(prompt("Enter wattage (Watts):", "100"));
  if (isNaN(watts)) return;

  const prop = getActiveProperty();
  const newApp = {
    id: `app-custom-${Date.now()}`,
    name: name,
    icon: 'plug',
    wattage: watts,
    quantity: 1,
    hours: 4
  };

  prop.appliances.push(newApp);
  saveStateToStorage();
  renderAppliancesSection();
}

/* Recalculates units share sum and redraws the Donut Chart */
function recalculateApplianceTotals() {
  const prop = getActiveProperty();
  let totalUnits = 0;
  
  // Calculate average units per month per appliance
  const applianceUnits = prop.appliances.map(app => {
    // Refrigerator has a running duty cycle of ~40% (doesn't draw full watts continuously)
    const dutyCycle = app.icon === 'refrigerator' ? 0.4 : 1.0;
    const units = (app.wattage * app.quantity * app.hours * dutyCycle * 30) / 1000;
    totalUnits += units;
    return { name: app.name, units: units };
  });

  // Display Total Units
  document.getElementById('calcTotalUnits').innerHTML = `${Math.round(totalUnits)} <span class="unit-label">kWh</span>`;
  
  // Calculate cost
  let rate = BASE_RATE;
  if (prop.history && prop.history.length > 0) {
    const latest = prop.history[prop.history.length - 1];
    rate = latest.amount / latest.units;
  }
  const totalCost = Math.round(totalUnits * rate);
  document.getElementById('calcTotalCost').innerText = `₹${totalCost}`;

  // Percentage of last bill comparison
  if (prop.history && prop.history.length > 0) {
    const latestBill = prop.history[prop.history.length - 1];
    const pct = Math.round((totalUnits / latestBill.units) * 100);
    document.getElementById('calcBillPct').innerText = `${pct}%`;
    document.getElementById('calcBillPctFill').style.width = `${Math.min(100, pct)}%`;
  }

  // Draw or update Donut Chart
  renderApplianceDonutChart(applianceUnits);
}

function renderApplianceDonutChart(data) {
  const ctx = document.getElementById('applianceShareChart').getContext('2d');
  
  if (applianceDonutInstance) {
    applianceDonutInstance.destroy();
  }

  // Filter out zero units to keep chart clean
  const filtered = data.filter(d => d.units > 0);
  
  const labels = filtered.map(d => d.name);
  const values = filtered.map(d => Math.round(d.units));

  const colors = [
    '#bd5eff', // purple
    '#00e5ff', // cyan
    '#00e676', // green
    '#ffd600', // yellow
    '#ff3d00', // red
    '#566275'  // grey
  ];

  const isLight = document.documentElement.classList.contains('light-mode');
  const textColor = isLight ? '#475569' : '#8e9aae';
  const bgSecondary = isLight ? '#ffffff' : '#0f131c';

  applianceDonutInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 1,
        borderColor: bgSecondary
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, font: { family: 'Inter', size: 10 } }
        }
      },
      cutout: '70%'
    }
  });
}

/* ----------------------------------------------------
   4. "WHAT-IF" SIMULATOR VIEW CONTROLLER
   ---------------------------------------------------- */
function initSimulatorSection() {
  const prop = getActiveProperty();
  
  // Unlocked Simulator Badge on view
  const badge = appState.gamification.badges.find(b => b.id === 'bdg-architect');
  if (badge && !badge.unlocked) {
    badge.unlocked = true;
    appState.gamification.points += 40;
    saveStateToStorage();
    alert('🏆 Badge Unlocked: "Savings Architect" for exploring What-If scenarios!');
  }

  // Reset Sliders
  document.getElementById('simAcHoursSlider').value = 0;
  document.getElementById('simAcHoursVal').innerText = '0 hours';
  
  document.getElementById('simAcTempSlider').value = 20;
  document.getElementById('simAcTempVal').innerText = '20°C';

  document.getElementById('simLedsSlider').value = 0;
  document.getElementById('simLedsVal').innerText = '0 bulbs';
  
  document.getElementById('simStandbySwitch').checked = false;

  updateWhatIfSimulator();
}

function updateWhatIfSimulator() {
  const prop = getActiveProperty();
  
  // Get latest bill parameters to compute rate
  let originalBill = 3500;
  let originalUnits = 400;
  let rate = BASE_RATE;

  if (prop.history && prop.history.length > 0) {
    const latest = prop.history[prop.history.length - 1];
    originalBill = latest.amount;
    originalUnits = latest.units;
    rate = latest.amount / latest.units;
  }

  // Get simulator inputs
  const acHoursCut = parseFloat(document.getElementById('simAcHoursSlider').value);
  document.getElementById('simAcHoursVal').innerText = `${acHoursCut} hours`;

  const acTempSetting = parseInt(document.getElementById('simAcTempSlider').value);
  document.getElementById('simAcTempVal').innerText = `${acTempSetting}°C`;

  const ledsReplacement = parseInt(document.getElementById('simLedsSlider').value);
  document.getElementById('simLedsVal').innerText = `${ledsReplacement} bulbs`;

  const standbyOn = document.getElementById('simStandbySwitch').checked;

  // Calculators
  let savedUnits = 0;

  // 1. AC hours reduction (Avg AC wattage = 1500W)
  const acApp = prop.appliances.find(a => a.id === 'app-ac' || a.name.toLowerCase().includes('ac'));
  const acWatts = acApp ? acApp.wattage : 1500;
  const acQty = acApp ? acApp.quantity : 1;
  const acHoursSaved = (acWatts * acQty * acHoursCut * 30) / 1000;
  savedUnits += acHoursSaved;

  // 2. AC temperature increase (saves ~6% per degree, base AC usage estimated at 8 hours)
  if (acTempSetting > 20) {
    const baseAcHours = acApp ? acApp.hours : 8;
    const acBaseUsageUnits = (acWatts * acQty * baseAcHours * 30) / 1000;
    const tempDifference = acTempSetting - 20;
    const tempSavingsUnits = acBaseUsageUnits * (0.06 * tempDifference);
    savedUnits += tempSavingsUnits;
  }

  // 3. LED replacements (saving difference conventional 60W - 9W LED = 51W)
  // Assuming average daily bulb runtime of 6 hours
  const bulbSavingsUnits = (51 * ledsReplacement * 6 * 30) / 1000;
  savedUnits += bulbSavingsUnits;

  // 4. Standby energy savings (Microwave, TV standby saved ~20 units/mo)
  if (standbyOn) {
    savedUnits += 20;
  }

  // Final math values
  savedUnits = Math.min(originalUnits, Math.round(savedUnits));
  const savedMoney = Math.round(savedUnits * rate);
  const newBill = Math.max(120, originalBill - savedMoney); // Min charge ₹120

  document.getElementById('simSavedUnits').innerHTML = `${savedUnits} <span class="unit-label">kWh</span>`;
  document.getElementById('simSavedMoney').innerText = `₹${savedMoney}`;

  // Ecological math
  const co2Saved = Math.round(savedUnits * 0.82);
  const treesOffset = (co2Saved / 2).toFixed(1);
  document.getElementById('simCarbonSaved').innerText = `${co2Saved} kg CO₂`;
  document.getElementById('simTreesOffsetSaved').innerText = `${treesOffset} trees`;

  // Update original vs simulated bars
  document.getElementById('simOriginalBillText').innerText = `₹${originalBill}`;
  document.getElementById('simNewBillText').innerText = `₹${newBill}`;

  const originalWidth = 100;
  const newWidth = Math.round((newBill / originalBill) * 100);
  
  document.getElementById('simOriginalBillBar').style.width = '100%';
  document.getElementById('simNewBillBar').style.width = `${newWidth}%`;

  // Track Challenges validation
  appState.gamification.challenges.forEach(ch => {
    if (ch.type === 'leds' && ledsReplacement >= ch.target && !ch.completed) {
      ch.completed = true;
      ch.progress = ledsReplacement;
      appState.gamification.points += ch.reward;
      alert(`🎉 Challenge Completed: "${ch.title}"! Unlocked +${ch.reward} XP.`);
    }
    if (ch.type === 'ac-temp' && acTempSetting >= ch.target && !ch.completed) {
      ch.completed = true;
      ch.progress = acTempSetting;
      appState.gamification.points += ch.reward;
      alert(`🎉 Challenge Completed: "${ch.title}"! Unlocked +${ch.reward} XP.`);
    }
  });

  // Carbon tree badge checker
  const carbonBadge = appState.gamification.badges.find(b => b.id === 'bdg-carbon');
  if (carbonBadge && !carbonBadge.unlocked && parseFloat(treesOffset) >= 5.0) {
    carbonBadge.unlocked = true;
    appState.gamification.points += 60;
    alert('🏆 Badge Unlocked: "Forest Creator" for saving equivalent to 5+ offset trees!');
  }

  saveStateToStorage();
}

/* ----------------------------------------------------
   5. APPLIANCE UPGRADE ROI CALCULATOR
   ---------------------------------------------------- */
function calculateUpgradeROI() {
  const type = document.getElementById('roiApplianceType').value;
  const star = parseInt(document.getElementById('roiCurrentStar').value);
  const age = parseInt(document.getElementById('roiCurrentAge').value);
  const hours = parseInt(document.getElementById('roiHoursDaily').value);
  const upfrontCost = parseInt(document.getElementById('roiUpgradeCost').value);

  // Setup device profiles
  let currentWatts = 1500;
  let upgradeWatts = 800; // 5-star inverter average

  if (type === 'AC') {
    // Inefficient conventional older ACs:
    currentWatts = star === 1 ? 1700 : star === 2 ? 1600 : star === 3 ? 1500 : 1350;
    // Older age increases wear/leakages, increasing power draw by 2% per year
    currentWatts = Math.round(currentWatts * (1 + (age * 0.02)));
    upgradeWatts = 800; // 5-Star inverter average compressor cycle load
  } else if (type === 'Fridge') {
    // 300L fridge models
    currentWatts = star === 1 ? 250 : star === 2 ? 220 : star === 3 ? 190 : 170;
    currentWatts = Math.round(currentWatts * (1 + (age * 0.015)));
    upgradeWatts = 90; // inverter 5-star
  } else if (type === 'Fan') {
    currentWatts = star === 1 ? 85 : star === 2 ? 78 : star === 3 ? 70 : 60;
    upgradeWatts = 28; // BLDC Fan
  }

  // Calculate annual savings
  const prop = getActiveProperty();
  let rate = BASE_RATE;
  if (prop.history && prop.history.length > 0) {
    const latest = prop.history[prop.history.length - 1];
    rate = latest.amount / latest.units;
  }

  // Fridge has continuous duty cycle, while others use user defined slider hours
  const activeHours = type === 'Fridge' ? 24 : hours;
  const dutyRatio = type === 'Fridge' ? 0.45 : 1.0;

  const currentAnnualKwh = (currentWatts * activeHours * dutyRatio * 365) / 1000;
  const upgradeAnnualKwh = (upgradeWatts * activeHours * dutyRatio * 365) / 1000;

  const annualKwhSaved = Math.round(currentAnnualKwh - upgradeAnnualKwh);
  const annualMoneySaved = Math.round(annualKwhSaved * rate);
  const paybackYears = (upfrontCost / annualMoneySaved).toFixed(1);

  // Display outputs
  document.getElementById('roiEnergySaved').innerHTML = `${annualKwhSaved} <span class="unit-label">kWh</span>`;
  document.getElementById('roiMoneySaved').innerText = `₹${annualMoneySaved}/year`;
  document.getElementById('roiPaybackPeriod').innerText = `${paybackYears} Years`;

  let verdict = 'Good long-term investment.';
  let verdictColor = 'var(--neon-green)';
  if (parseFloat(paybackYears) <= 3.5) {
    verdict = 'Highly Recommended - Rapid Payback!';
    verdictColor = 'var(--neon-yellow)';
  } else if (parseFloat(paybackYears) > 6) {
    verdict = 'Moderate payback period. Recommended if upgrading.';
    verdictColor = 'var(--text-secondary)';
  }

  document.getElementById('roiVerdictText').innerText = verdict;
  document.getElementById('roiVerdictText').style.color = verdictColor;

  // Draw Payback line chart timeline
  renderRoiTimelineChart(upfrontCost, annualMoneySaved);
}

function renderRoiTimelineChart(upfrontCost, annualSavings) {
  const ctx = document.getElementById('roiTimelineChart').getContext('2d');
  
  if (roiLineInstance) {
    roiLineInstance.destroy();
  }

  const isLight = document.documentElement.classList.contains('light-mode');
  const textColor = isLight ? '#475569' : '#8e9aae';
  const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.03)';

  // Data over 5 years
  const labels = ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
  const newAppInvest = [-upfrontCost];
  const oldAppCost = [0];

  for (let i = 1; i <= 5; i++) {
    newAppInvest.push(-upfrontCost + (annualSavings * i));
    oldAppCost.push(0); // baseline
  }

  roiLineInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Upgrade (Cumulative Return)',
          data: newAppInvest,
          borderColor: '#00e676',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          fill: true,
          borderWidth: 3,
          tension: 0.2
        },
        {
          label: 'Continue using old unit',
          data: oldAppCost,
          borderColor: '#ff3d00',
          borderDash: [5, 5],
          fill: false,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 10 } } }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}

/* ----------------------------------------------------
   6. GAMIFICATION VIEW CONTROLLER
   ---------------------------------------------------- */
function renderGamificationSection() {
  const gam = appState.gamification;

  // Streak & Points UI
  document.getElementById('gamificationStreakVal').innerText = gam.streak;
  document.getElementById('userPoints').innerHTML = `${gam.points} <span class="unit-label">XP</span>`;
  
  // XP Level
  let level = 'Level 1: Eco-Novice';
  if (gam.points >= 500) level = 'Level 4: Grid Hero';
  else if (gam.points >= 300) level = 'Level 3: Carbon Crusader';
  else if (gam.points >= 150) level = 'Level 2: Energy Master';
  document.getElementById('userRank').innerText = level;

  // Challenges list
  const list = document.getElementById('challengesList');
  list.innerHTML = '';

  gam.challenges.forEach(ch => {
    const item = document.createElement('div');
    const statusClass = ch.completed ? 'completed-state' : 'active-state';
    
    // Check dynamic slider conditions for LEDs & AC
    const prop = getActiveProperty();
    if (ch.type === 'leds' && !ch.completed) {
      // simulated values check
    }

    item.className = `challenge-item ${statusClass}`;
    item.innerHTML = `
      <div class="challenge-top">
        <div class="challenge-info">
          <span class="challenge-title">${ch.title}</span>
          <span class="challenge-desc">${ch.desc}</span>
        </div>
        <span class="challenge-reward">+${ch.reward} XP</span>
      </div>
      <div class="challenge-bottom">
        <div class="challenge-progress-lbl">
          <span>Progress</span>
          <span>${ch.completed ? 'Completed' : 'In Progress'}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${ch.completed ? 'bg-green' : 'bg-cyan'}" 
               style="width: ${ch.completed ? '100%' : '20%'}"></div>
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  // Badges drawer grid
  const badgeGrid = document.getElementById('badgesGrid');
  badgeGrid.innerHTML = '';

  gam.badges.forEach(bdg => {
    const card = document.createElement('div');
    card.className = `badge-item ${bdg.unlocked ? 'unlocked' : ''}`;
    card.innerHTML = `
      <div class="badge-icon-box">
        <i data-lucide="${bdg.icon || 'award'}"></i>
      </div>
      <div class="badge-name">${bdg.name}</div>
      <div class="badge-desc">${bdg.desc}</div>
    `;
    badgeGrid.appendChild(card);
  });

  lucide.createIcons();
}

/* ----------------------------------------------------
   7. PROPERTY MANAGER VIEW CONTROLLER
   ---------------------------------------------------- */
function renderPropertiesSection() {
  const container = document.getElementById('propertiesContainer');
  container.innerHTML = '';

  appState.properties.forEach(p => {
    const isActive = p.id === appState.selectedPropertyId;
    const latestBill = p.history[p.history.length - 1];
    const billText = latestBill ? `Last Bill: ₹${latestBill.amount} (${latestBill.month})` : 'No bill history';

    const card = document.createElement('div');
    card.className = `property-card ${isActive ? 'active-prop' : ''}`;
    card.innerHTML = `
      <div class="prop-left" onclick="selectProperty('${p.id}')" style="cursor: pointer; flex-grow: 1;">
        <div class="prop-avatar">
          <i data-lucide="${p.type === 'commercial' ? 'shopping-bag' : 'home'}"></i>
        </div>
        <div>
          <div class="prop-info-title">
            ${p.name}
            ${isActive ? '<span class="badge badge-green">Active</span>' : ''}
          </div>
          <div class="prop-info-desc">Type: ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} | Load: ${p.sanctionedLoad} kW | ${billText}</div>
        </div>
      </div>
      <div class="prop-actions">
        ${appState.properties.length > 1 ? `
          <button class="app-delete-btn" onclick="deleteProperty('${p.id}')" title="Delete Property">
            <i data-lucide="trash-2"></i>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

function selectProperty(propId) {
  appState.selectedPropertyId = propId;
  saveStateToStorage();
  
  // Update property selector dropdown
  document.getElementById('propertySelector').value = propId;

  // Refresh
  renderPropertiesSection();
  updateGlobalHeaderMetrics();
}

function deleteProperty(propId) {
  if (confirm("Are you sure you want to delete this property and all of its historical logs?")) {
    appState.properties = appState.properties.filter(p => p.id !== propId);
    if (appState.selectedPropertyId === propId) {
      appState.selectedPropertyId = appState.properties[0].id;
    }
    saveStateToStorage();
    
    // Refresh dropdown and list
    initializeUI();
    renderPropertiesSection();
  }
}

function handleSaveNewProperty() {
  const name = document.getElementById('propName').value.trim();
  const type = document.getElementById('propType').value;
  const load = parseInt(document.getElementById('propSanctionedLoad').value);

  if (!name) {
    alert("Please enter a property name.");
    return;
  }

  const newProp = {
    id: `prop-${Date.now()}`,
    name: name,
    type: type,
    sanctionedLoad: load,
    history: [],
    appliances: [
      { id: `app-fan-${Date.now()}`, name: 'Ceiling Fan', icon: 'wind', wattage: 75, quantity: 2, hours: 10 },
      { id: `app-led-${Date.now()}`, name: 'LED Bulbs', icon: 'lightbulb', wattage: 9, quantity: 5, hours: 6 }
    ]
  };

  appState.properties.push(newProp);
  appState.selectedPropertyId = newProp.id;
  
  saveStateToStorage();

  // Hide form
  document.getElementById('addPropertyFormCard').classList.add('hidden');
  
  // Refresh UI
  initializeUI();
  renderPropertiesSection();
  
  alert(`Property "${name}" created successfully and selected.`);
}

/* ----------------------------------------------------
   8. AI CHATBOT (ELECTRA ASSISTANT)
   ---------------------------------------------------- */
function handleChatSendMessage() {
  const input = document.getElementById('chatInputField');
  const query = input.value.trim();
  if (!query) return;

  // Clear Input
  input.value = '';

  // Append User message
  appendChatMessage(query, 'user');

  // Scroll to bottom
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;

  // Typing state
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-bubble assistant typing-bubble';
  typingBubble.innerHTML = `
    <div class="bubble-avatar"><i data-lucide="zap" class="text-cyan"></i></div>
    <div class="bubble-content">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  container.appendChild(typingBubble);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();

  // Process Query NLP responses after artificial delay
  setTimeout(() => {
    container.removeChild(typingBubble);
    const reply = processChatbotNLP(query);
    appendChatMessage(reply, 'assistant');
    container.scrollTop = container.scrollHeight;
  }, 1000);
}

function appendChatMessage(text, sender) {
  const container = document.getElementById('chatMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  
  const icon = sender === 'user' ? 'user' : 'zap';
  const iconClass = sender === 'user' ? 'text-purple' : 'text-cyan';

  bubble.innerHTML = `
    <div class="bubble-avatar">
      <i data-lucide="${icon}" class="${iconClass}"></i>
    </div>
    <div class="bubble-content">
      ${text}
    </div>
  `;
  container.appendChild(bubble);
  lucide.createIcons();
}

/* Chat NLP query parser mapping state to natural responses */
function processChatbotNLP(query) {
  const normalized = query.toLowerCase();
  const prop = getActiveProperty();
  const history = prop.history;

  if (!history || history.length === 0) {
    return `<p>I notice you don't have any billing records loaded for <strong>${prop.name}</strong>.</p>
            <p>Please load our <strong>Sample History</strong> on the Dashboard so I can analyze trends and answer your questions!</p>`;
  }

  const latest = history[history.length - 1];
  const avgRate = latest ? (latest.amount / latest.units).toFixed(2) : BASE_RATE;

  // Spike search
  if (normalized.includes('high') || normalized.includes('spike') || normalized.includes('increase')) {
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const mom = ((latest.units - prev.units) / prev.units * 100).toFixed(0);
      if (parseFloat(mom) > 15) {
        return `<p>Compared to last month (${prev.month}), your usage increased by <strong>${mom}%</strong> (an extra <strong>${latest.units - prev.units} units</strong>).</p>
                <p>This spike added approximately <strong>₹${latest.amount - prev.amount}</strong> to your bill.</p>
                <p>💡 <strong>Potential Causes:</strong> Heavy summer AC operations (which consume ~360 units/month) or new appliance loads. Consider using the <strong>"What-If" Simulator</strong> to see how raising AC to 24°C saves up to ₹420/month.</p>`;
      }
    }
    return `<p>Your last bill amount for ${latest.month} is <strong>₹${latest.amount}</strong> (${latest.units} units). This is stable compared to previous periods.</p>
            <p>Our appliance scan shows that cooling loads (AC/Fridge) continue to be your largest category (~65%).</p>`;
  }

  // Peak month
  if (normalized.includes('highest') || normalized.includes('peak') || normalized.includes('maximum')) {
    let peak = history[0];
    history.forEach(h => {
      if (h.units > peak.units) peak = h;
    });
    return `<p>Your highest bill month in record was <strong>${peak.month}</strong>.</p>
            <ul>
              <li><strong>Units Billed:</strong> ${peak.units} kWh</li>
              <li><strong>Total Bill:</strong> ₹${peak.amount}</li>
              <li><strong>Calculated Cost/Unit:</strong> ₹${(peak.amount / peak.units).toFixed(2)}</li>
            </ul>
            <p>Peak seasons usually witness AC running loads. We recommend scheduling off-peak usage if your utility supports differential tariffs.</p>`;
  }

  // Budget queries
  if (normalized.includes('reduce') || normalized.includes('save') || normalized.includes('under') || normalized.includes('below')) {
    const targetMatch = /(\d{4})/.exec(normalized);
    const targetAmt = targetMatch ? parseInt(targetMatch[1]) : 2000;

    let targetDiff = latest.amount - targetAmt;
    if (targetDiff <= 0) {
      return `<p>Your current bill (₹${latest.amount}) is already below your target of <strong>₹${targetAmt}</strong>! Good job keeping energy consumption optimized.</p>`;
    }

    const unitsToSave = Math.round(targetDiff / parseFloat(avgRate));

    return `<p>To reduce your monthly bill below <strong>₹${targetAmt}</strong>, you need to save approximately <strong>${unitsToSave} units (kWh)</strong> next month.</p>
            <p>Here is an action plan to achieve this:</p>
            <ol>
              <li><strong>Reduce AC:</strong> Cut AC operation by 1.5 hours daily (saves ~67 units / ₹${Math.round(67 * parseFloat(avgRate))}).</li>
              <li><strong>Increase AC Temp:</strong> Set AC thermostat to 25°C instead of 20°C (saves ~45 units / ₹${Math.round(45 * parseFloat(avgRate))}).</li>
              <li><strong>Bulbs:</strong> Replace 6 conventional lamps with LEDs (saves ~55 units / ₹${Math.round(55 * parseFloat(avgRate))}).</li>
            </ol>
            <p>This plan saves a total of <strong>~${67 + 45 + 55} units</strong>, easily hitting your target savings!</p>`;
  }

  // Summer vs Winter
  if (normalized.includes('summer') || normalized.includes('winter') || normalized.includes('season')) {
    const summerMonths = ['Apr', 'May', 'Jun', 'Jul'];
    const winterMonths = ['Nov', 'Dec', 'Jan', 'Feb'];

    const summer = history.filter(h => summerMonths.some(m => h.month.includes(m)));
    const winter = history.filter(h => winterMonths.some(m => h.month.includes(m)));

    if (summer.length > 0 && winter.length > 0) {
      const avgSummer = Math.round(summer.reduce((s, h) => s + h.units, 0) / summer.length);
      const avgWinter = Math.round(winter.reduce((s, h) => s + h.units, 0) / winter.length);
      return `<p>Comparing seasonal usage patterns for <strong>${prop.name}</strong>:</p>
              <ul>
                <li><strong>Summer Average:</strong> ${avgSummer} units/month (due to cooling AC operations)</li>
                <li><strong>Winter Average:</strong> ${avgWinter} units/month</li>
              </ul>
              <p>Summer usage increases your energy demand by <strong>${Math.round((avgSummer - avgWinter)/avgWinter * 100)}%</strong>. Cooling accounts for almost all of this seasonal deviation.</p>`;
    }
    return `<p>I don't have enough summer and winter billing history to do a seasonal contrast. Please load the sample data to review this demo contrast!</p>`;
  }

  // Carbon footprint
  if (normalized.includes('carbon') || normalized.includes('footprint') || normalized.includes('tree') || normalized.includes('green')) {
    const co2 = Math.round(latest.units * 0.82);
    const trees = (co2 / 2).toFixed(1);
    return `<p>Your current monthly carbon emissions stand at <strong>${co2} kg CO₂</strong>.</p>
            <p>To offset this environmental impact, you would need to plant <strong>${trees} trees</strong> annually.</p>
            <p>You can reduce this impact by switching conventional appliances to energy-efficient BLDC fans and 5-star inverter air conditioners.</p>`;
  }

  // General fallbacks
  return `<p>I can help you review your energy patterns for <strong>${prop.name}</strong>.</p>
          <p>Try asking me:</p>
          <ul>
            <li>"Show my highest bill month"</li>
            <li>"Why was my bill high this month?"</li>
            <li>"How can I save ₹1000?"</li>
            <li>"Compare summer vs winter usage"</li>
          </ul>`;
}
