/**
 * ElectraInsight - Electricity Bill Analyzer Logic
 * Client-Side JavaScript Application with LocalStorage Persistence
 */

// Initialize PDF.js worker using a Blob URL to avoid cross-origin (CORS) worker security blocks
let pdfWorkerPromise = null;

function initPdfWorker() {
  if (typeof pdfjsLib === 'undefined') return Promise.resolve();
  if (pdfWorkerPromise) return pdfWorkerPromise;
  
  pdfWorkerPromise = (async () => {
    try {
      console.log('Fetching PDF.js worker from CDN to create blob...');
      const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      const response = await fetch(workerUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const workerScript = await response.text();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl;
      console.log('PDF.js worker initialized successfully via Blob URL:', blobUrl);
    } catch (err) {
      console.error('Failed to initialize PDF.js worker via Blob URL, falling back to direct CDN:', err);
      // Fallback directly to the CDN worker URL
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }
  })();
  return pdfWorkerPromise;
}

// Start fetching/initializing the worker immediately
initPdfWorker();

// Sample Template Data (not saved persistently unless user overrides)
const SAMPLE_HISTORY = {
  'prop-home': [
    { month: 'Jan 2026', units: 180, amount: 1260, fixedCharges: 120, taxes: 108, consumerNo: '109843729' },
    { month: 'Feb 2026', units: 195, amount: 1365, fixedCharges: 120, taxes: 117, consumerNo: '109843729' },
    { month: 'Mar 2026', units: 220, amount: 1540, fixedCharges: 120, taxes: 132, consumerNo: '109843729' },
    { month: 'Apr 2026', units: 310, amount: 2480, fixedCharges: 120, taxes: 248, consumerNo: '109843729' },
    { month: 'May 2026', units: 410, amount: 3690, fixedCharges: 120, taxes: 369, consumerNo: '109843729' },
    { month: 'Jun 2026', units: 540, amount: 5130, fixedCharges: 120, taxes: 513, consumerNo: '109843729' }
  ],
  'prop-shop': [
    { month: 'Jan 2026', units: 450, amount: 4050, fixedCharges: 350, taxes: 360, consumerNo: '540928172' },
    { month: 'Feb 2026', units: 480, amount: 4320, fixedCharges: 350, taxes: 384, consumerNo: '540928172' },
    { month: 'Mar 2026', units: 520, amount: 4680, fixedCharges: 350, taxes: 416, consumerNo: '540928172' },
    { month: 'Apr 2026', units: 680, amount: 6800, fixedCharges: 350, taxes: 680, consumerNo: '540928172' },
    { month: 'May 2026', units: 820, amount: 8200, fixedCharges: 350, taxes: 820, consumerNo: '540928172' },
    { month: 'Jun 2026', units: 980, amount: 9800, fixedCharges: 350, taxes: 980, consumerNo: '540928172' }
  ]
};

const SAMPLE_RECHARGES = {
  'prop-shop': [
    { date: '2026-06-15', amount: 1000, receiptNo: 'RC-54092817A' },
    { date: '2026-06-01', amount: 2000, receiptNo: 'RC-54092811B' },
    { date: '2026-05-18', amount: 1500, receiptNo: 'RC-54092795C' }
  ]
};

// Default State Configuration
const DEFAULT_PROPERTIES = [
  {
    id: 'prop-home',
    name: 'Home Apartment',
    type: 'apartment',
    billingType: 'postpaid',
    sanctionedLoad: 3, // kW
    history: [],
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
    billingType: 'prepaid',
    sanctionedLoad: 8, // kW
    balance: 0, // start with 0
    dailyBurnRate: 85, // ₹ average burn per day
    recharges: [],
    history: [],
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
  // Deep clone appState to avoid mutating the in-memory state
  const stateClone = JSON.parse(JSON.stringify(appState));
  
  // Filter out any temporary demo data from the persisted storage
  if (stateClone.properties) {
    stateClone.properties.forEach(p => {
      if (p.isDemo) {
        p.history = [];
        p.recharges = [];
        p.balance = 0;
        delete p.isDemo;
      }
    });
  }
  
  localStorage.setItem('electra_insight_state', JSON.stringify(stateClone));
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

      // Close sidebar on mobile
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
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

  // Prepaid Recharge Form triggers
  const btnManualRecharge = document.getElementById('btnManualRecharge');
  if (btnManualRecharge) {
    btnManualRecharge.addEventListener('click', () => {
      document.getElementById('uploadDropzone').classList.add('hidden');
      document.getElementById('prepaidRechargeForm').classList.remove('hidden');
      document.getElementById('rechargeDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('rechargeAmount').value = '';
    });
  }

  const btnCancelRecharge = document.getElementById('btnCancelRecharge');
  if (btnCancelRecharge) {
    btnCancelRecharge.addEventListener('click', () => {
      document.getElementById('prepaidRechargeForm').classList.add('hidden');
      document.getElementById('uploadDropzone').classList.remove('hidden');
    });
  }

  const btnSaveRecharge = document.getElementById('btnSaveRecharge');
  if (btnSaveRecharge) {
    btnSaveRecharge.addEventListener('click', () => {
      const amountInput = document.getElementById('rechargeAmount');
      const dateInput = document.getElementById('rechargeDate');
      const amountVal = Number(amountInput.value);
      const dateVal = dateInput.value;

      if (!amountVal || amountVal <= 0) {
        alert('Please enter a valid recharge amount greater than ₹0.');
        return;
      }
      if (!dateVal) {
        alert('Please select a valid recharge date.');
        return;
      }

      const prop = getActiveProperty();
      const receiptNo = 'RC-' + Math.floor(10000000 + Math.random() * 90000000) + 'A';
      
      // Wipe demo history if any
      if (prop.isDemo) {
        prop.history = [];
        prop.recharges = [];
        prop.balance = 0;
        delete prop.isDemo;
      }
      
      if (!prop.recharges) {
        prop.recharges = [];
      }
      if (prop.balance === undefined) {
        prop.balance = 0;
      }
      
      prop.recharges.unshift({
        date: dateVal,
        amount: amountVal,
        receiptNo: receiptNo
      });
      prop.balance += amountVal;

      saveStateToStorage();
      
      // Reset form & show dropzone
      document.getElementById('prepaidRechargeForm').classList.add('hidden');
      document.getElementById('uploadDropzone').classList.remove('hidden');

      renderDashboard();
      updateGlobalHeaderMetrics();

      alert(`⚡ Recharge of ₹${amountVal} logged successfully!\nNew Balance: ₹${prop.balance}`);
    });
  }

  // Initialize Lucide Icons
  lucide.createIcons();
}

function updateGlobalHeaderMetrics() {
  const prop = getActiveProperty();
  
  // Dynamically calculate and update the saving streak based on history
  updateStreakValue(prop);
  
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
  
  // Dynamically calculate and update the saving streak based on history
  updateStreakValue(prop);
  
  const history = prop.history;

  if (!history || history.length === 0) {
    // Destroy trend chart instance if it exists to clear the old graph
    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }

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
    
    document.getElementById('avgCostPerUnit').innerText = '--';
    document.getElementById('peakMonthText').innerText = '--';
    document.getElementById('nextMonthPrediction').innerText = '--';
    
    document.getElementById('spikeAlertCard').classList.add('hidden');
    document.getElementById('smartRecommendationsContainer').innerHTML = `
      <div class="rec-empty-state">
        <i data-lucide="info" class="empty-icon"></i>
        <span>No recommendations. Load sample history below.</span>
      </div>
    `;

    const billBreakdownList = document.getElementById('billBreakdownList');
    if (billBreakdownList) {
      billBreakdownList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
          <i data-lucide="receipt" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.6;"></i>
          <p style="font-size: 13px;">No history loaded. Upload a bill or screenshot above.</p>
        </div>
      `;
    }

    lucide.createIcons();
    return;
  }

  // Retrieve latest bill
  const latest = history[history.length - 1];
  const units = latest.units;
  const amount = latest.amount;

  const card1Label = document.querySelector('.border-glow-purple .stat-label');
  const card2Label = document.querySelector('.border-glow-cyan .stat-label');

  if (prop.billingType === 'prepaid') {
    if (card1Label) card1Label.innerText = 'Avg. Daily Usage';
    if (card2Label) card2Label.innerText = 'Remaining Balance';

    // Show manual recharge button & adjust demo text
    const btnManual = document.getElementById('btnManualRecharge');
    if (btnManual) btnManual.classList.remove('hidden');
    const demoHelperText = document.getElementById('demoHelperText');
    if (demoHelperText) demoHelperText.innerText = 'Want to log a recharge manually?';
    
    // Update dropzone limits description
    const uploadOrText = document.querySelector('.upload-dropzone .upload-text');
    const uploadLimit = document.querySelector('.upload-dropzone .upload-limit');
    if (uploadOrText) uploadOrText.innerText = 'Drag & drop recharge receipt or screenshot here';
    if (uploadLimit) uploadLimit.innerText = 'Supports PDF bills, screenshots, and image receipts';

    // Update uploader card titles
    const uploaderCardTitle = document.getElementById('uploaderCardTitle');
    const uploaderCardDesc = document.getElementById('uploaderCardDesc');
    if (uploaderCardTitle) uploaderCardTitle.innerHTML = `<i data-lucide="receipt"></i> Log Recharge / OCR Receipt`;
    if (uploaderCardDesc) uploaderCardDesc.innerText = 'Drag and drop your smart meter recharge receipt image/PDF to run simulated OCR, or log your payments manually below.';

    // Calculate average daily usage based on latest bill / 30
    const dailyUnits = latest ? (latest.units / 30).toFixed(1) : 0;
    document.getElementById('statUnits').innerHTML = `${dailyUnits} <span class="unit-label">kWh/day</span>`;
    document.getElementById('statUnitsCompare').innerHTML = `Avg. Daily Cost: ~₹${prop.dailyBurnRate || 0}`;

    // Show remaining balance
    const balance = prop.balance !== undefined ? prop.balance : 0;
    document.getElementById('statAmount').innerText = `₹${balance}`;
    const daysLeft = prop.dailyBurnRate > 0 ? Math.round(balance / prop.dailyBurnRate) : 0;
    const daysClass = daysLeft < 3 ? 'text-red font-semibold' : 'text-green';
    document.getElementById('statAmountCompare').innerHTML = `<span class="${daysClass}">Est. Days Left: ${daysLeft} days</span>`;

    // Low Balance warning card trigger
    const alertCard = document.getElementById('spikeAlertCard');
    if (balance < 200 || daysLeft < 3) {
      alertCard.className = 'glass-card alert-card border-glow-yellow-dim'; // override borders
      alertCard.innerHTML = `
        <div class="alert-header">
          <div class="alert-icon bg-yellow-dim text-yellow pulsing-yellow-glow">
            <i data-lucide="alert-triangle"></i>
          </div>
          <div>
            <h4 class="alert-title text-yellow">Low Prepaid Balance Alert</h4>
            <span class="alert-subtitle text-yellow">Your smart meter wallet is running low!</span>
          </div>
        </div>
        <div class="alert-body">
          <p class="alert-desc">Your balance (<strong>₹${balance}</strong>) will last approximately <strong>${daysLeft} days</strong> at current consumption levels. Recharge soon to avoid automatic power cutoff.</p>
          <ul class="alert-list">
            <li><i data-lucide="indian-rupee" class="text-cyan"></i> Wallet Balance: ₹${balance}</li>
            <li><i data-lucide="zap" class="text-yellow"></i> Daily Burn Rate: ₹${prop.dailyBurnRate || 0}/day</li>
          </ul>
          <div class="alert-action" style="margin-top: 12px;">
            <button class="btn btn-glow btn-sm" id="btnShowRechargeFromAlert">Log Recharge Manually</button>
          </div>
        </div>
      `;
      alertCard.classList.remove('hidden');
      
      // Bind recharge trigger
      document.getElementById('btnShowRechargeFromAlert')?.addEventListener('click', () => {
        document.getElementById('uploadDropzone').classList.add('hidden');
        document.getElementById('prepaidRechargeForm').classList.remove('hidden');
        document.getElementById('rechargeDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('rechargeAmount').value = '';
      });
    } else {
      alertCard.classList.add('hidden');
    }

    // Details Card -> Recharge History Statement
    const detailsCardTitle = document.getElementById('detailsCardTitle');
    const detailsCardDesc = document.getElementById('detailsCardDesc');
    const billBreakdownList = document.getElementById('billBreakdownList');
    
    if (detailsCardTitle) detailsCardTitle.innerHTML = `<i data-lucide="history"></i> Prepaid Recharge History`;
    if (detailsCardDesc) detailsCardDesc.innerText = 'Recent recharge payments logged for this smart meter';

    if (billBreakdownList) {
      let rechargeRowsHTML = '';
      const recharges = prop.recharges || [];
      if (recharges.length === 0) {
        rechargeRowsHTML = `
          <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
            <i data-lucide="receipt" style="width: 28px; height: 28px; margin-bottom: 8px; opacity: 0.6;"></i>
            <p style="font-size: 13px;">No recharge transactions logged yet.</p>
          </div>
        `;
      } else {
        recharges.forEach((r, idx) => {
          rechargeRowsHTML += `
            <div class="breakdown-item" style="padding: 10px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div style="display: flex; flex-direction: column;">
                <span>${r.date}</span>
                <span style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Receipt: ${r.receiptNo || 'N/A'}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <strong class="text-green">+₹${r.amount}</strong>
                <button class="delete-recharge-btn btn-icon-only" data-idx="${idx}" style="background: none; border: none; color: var(--neon-red); cursor: pointer; opacity: 0.7; padding: 4px; transition: opacity 0.2s;" title="Delete this recharge">
                  <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>
          `;
        });
      }
      
      // Append manual log recharge button at the bottom of the history
      rechargeRowsHTML += `
        <div style="margin-top: 15px;">
          <button class="btn btn-outline btn-full btn-sm" id="btnShowRechargeFromHistory">
            <i data-lucide="plus" style="width: 14px; height: 14px; margin-right: 4px;"></i> Log Recharge Manually
          </button>
        </div>
      `;
      
      billBreakdownList.innerHTML = rechargeRowsHTML;

      // Bind manual recharge from history list
      document.getElementById('btnShowRechargeFromHistory')?.addEventListener('click', () => {
        document.getElementById('uploadDropzone').classList.add('hidden');
        document.getElementById('prepaidRechargeForm').classList.remove('hidden');
        document.getElementById('rechargeDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('rechargeAmount').value = '';
      });

      // Bind delete click handlers
      const deleteRechargeButtons = billBreakdownList.querySelectorAll('.delete-recharge-btn');
      deleteRechargeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idxToDelete = parseInt(btn.getAttribute('data-idx'));
          if (confirm(`Are you sure you want to delete this recharge record?`)) {
            deletePrepaidRechargeRecord(prop.id, idxToDelete);
          }
        });
      });
    }

  } else {
    // Postpaid connection layout
    if (card1Label) card1Label.innerText = 'Units Consumed';
    if (card2Label) card2Label.innerText = 'Total Bill Amount';

    // Hide manual recharge button & reset demo helper text
    const btnManual = document.getElementById('btnManualRecharge');
    if (btnManual) btnManual.classList.add('hidden');
    const demoHelperText = document.getElementById('demoHelperText');
    if (demoHelperText) demoHelperText.innerText = 'Want to test the features instantly?';

    // Reset dropzone description
    const uploadOrText = document.querySelector('.upload-dropzone .upload-text');
    const uploadLimit = document.querySelector('.upload-dropzone .upload-limit');
    if (uploadOrText) uploadOrText.innerText = 'Drag & drop PDF bill or screenshot image here';
    if (uploadLimit) uploadLimit.innerText = 'Supports PDF bills and screenshots (PNG, JPG, JPEG)';

    // Reset uploader titles
    const uploaderCardTitle = document.getElementById('uploaderCardTitle');
    const uploaderCardDesc = document.getElementById('uploaderCardDesc');
    if (uploaderCardTitle) uploaderCardTitle.innerHTML = `<i data-lucide="file-text"></i> Upload Electricity Bill / Screenshot`;
    if (uploaderCardDesc) uploaderCardDesc.innerText = 'Drag and drop your electricity bill PDF or screenshot image to automatically extract units, monthly trend, and savings opportunities.';

    // Render normal stats
    document.getElementById('statUnits').innerHTML = `${units} <span class="unit-label">kWh</span>`;
    document.getElementById('statAmount').innerText = `₹${amount}`;

    // Re-render standard MoM comparisons
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const unitsChange = ((units - prev.units) / prev.units * 100).toFixed(1);
      const unitsArrow = units > prev.units ? '↑' : '↓';
      const unitsClass = units > prev.units ? 'text-red' : 'text-green';
      document.getElementById('statUnitsCompare').innerHTML = `<span class="${unitsClass}">${unitsArrow} ${Math.abs(unitsChange)}%</span> vs last month`;

      const amountChange = ((amount - prev.amount) / prev.amount * 100).toFixed(1);
      const amountArrow = amount > prev.amount ? '↑' : '↓';
      const amountClass = amount > prev.amount ? 'text-red' : 'text-green';
      document.getElementById('statAmountCompare').innerHTML = `<span class="${amountClass}">${amountArrow} ${Math.abs(amountChange)}%</span> vs last month`;
    } else {
      document.getElementById('statUnitsCompare').innerText = '1 month loaded';
      document.getElementById('statAmountCompare').innerText = '1 month loaded';
    }

    // Spike Alert Panel (Spike > 20% Mom)
    let spiked = false;
    const alertCard = document.getElementById('spikeAlertCard');
    if (alertCard) {
      alertCard.className = 'glass-card alert-card hidden'; // reset class
      alertCard.innerHTML = `
        <div class="alert-header">
          <div class="alert-icon bg-red-dim text-red pulsing-red-glow">
            <i data-lucide="alert-triangle"></i>
          </div>
          <div>
            <h4 class="alert-title text-red">Bill Spike Detected</h4>
            <span class="alert-subtitle" id="spikeValueText">Consumption increased by 32%</span>
          </div>
        </div>
        <div class="alert-body">
          <p class="alert-desc">Possible factors causing this abnormal usage:</p>
          <ul class="alert-list">
            <li><i data-lucide="snowflake" class="text-cyan"></i> Summer cooling: Heavy AC operation</li>
            <li><i data-lucide="tv" class="text-purple"></i> New appliances running continuously</li>
            <li><i data-lucide="droplet" class="text-blue"></i> Water motor/pump left running</li>
          </ul>
          <div class="alert-action">
            <button class="btn btn-link btn-sm" id="viewSimulatorFromAlert">Run "What-If" Simulation <i data-lucide="chevron-right"></i></button>
          </div>
        </div>
      `;
      
      // Bind spike alert click
      document.getElementById('viewSimulatorFromAlert')?.addEventListener('click', () => {
        const simNav = document.querySelector('.nav-item[data-target="simulator"]');
        if (simNav) {
          simNav.click();
          document.getElementById('simAcHoursSlider').value = 2;
          updateWhatIfSimulator();
        }
      });

      if (history.length >= 2) {
        const prev = history[history.length - 2];
        const MoMChange = ((units - prev.units) / prev.units * 100);
        if (MoMChange >= 20) {
          spiked = true;
          alertCard.classList.remove('hidden');
          const spikeValueText = document.getElementById('spikeValueText');
          if (spikeValueText) spikeValueText.innerText = `Consumption increased by ${MoMChange.toFixed(0)}% this month`;
        }
      }
      if (!spiked) {
        alertCard.classList.add('hidden');
      }
    }

    // Details Card -> Current Bill Breakdown
    const detailsCardTitle = document.getElementById('detailsCardTitle');
    const detailsCardDesc = document.getElementById('detailsCardDesc');
    const billBreakdownList = document.getElementById('billBreakdownList');

    if (detailsCardTitle) detailsCardTitle.innerHTML = `<i data-lucide="receipt"></i> Current Bill Breakdown`;
    if (detailsCardDesc) detailsCardDesc.innerText = 'Line-item breakdown of your last uploaded bill';

    if (billBreakdownList) {
      const energyChg = amount - (latest.fixedCharges || 120) - (latest.taxes || Math.round(amount * 0.1));
      let html = `
        <div class="breakdown-item">
          <span>Consumer Number</span>
          <strong id="bdConsumerNo">${latest.consumerNo || 'N/A'}</strong>
        </div>
        <div class="breakdown-item">
          <span>Billing Period</span>
          <strong id="bdBillingMonth">${latest.month || 'Current'}</strong>
        </div>
        <div class="breakdown-item">
          <span>Energy Charges (Units Used)</span>
          <strong id="bdEnergyCharges">₹${energyChg}</strong>
        </div>
        <div class="breakdown-item">
          <span>Fixed/Sanctioned Load Charges</span>
          <strong id="bdFixedCharges">₹${latest.fixedCharges || 120}</strong>
        </div>
        <div class="breakdown-item">
          <span>Taxes & Duties</span>
          <strong id="bdTaxes">₹${latest.taxes || Math.round(amount * 0.1)}</strong>
        </div>
        <hr class="card-divider">
        <div class="breakdown-item total-item">
          <span>Grand Total</span>
          <span class="total-value text-cyan" id="bdGrandTotal">₹${amount}</span>
        </div>
      `;

      // Append list of all billing records with delete button
      html += `
        <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Delete History Bills</span>
          <div style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
      `;

      // Display newest bills first
      const sortedHistory = [...history].reverse();
      sortedHistory.forEach(h => {
        html += `
          <div class="breakdown-item" style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 500;">${h.month}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">${h.units} kWh • ₹${h.amount}</span>
            </div>
            <button class="delete-bill-btn btn-icon-only" data-month="${h.month}" style="background: none; border: none; color: var(--neon-red); cursor: pointer; opacity: 0.7; padding: 4px; transition: opacity 0.2s;" title="Delete this bill">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      billBreakdownList.innerHTML = html;

      // Bind delete click handlers
      const deleteButtons = billBreakdownList.querySelectorAll('.delete-bill-btn');
      deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const monthToDelete = btn.getAttribute('data-month');
          if (confirm(`Are you sure you want to delete the billing record for ${monthToDelete}?`)) {
            deletePostpaidBillRecord(prop.id, monthToDelete);
          }
        });
      });
    }
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
  
  // Populate history from static sample templates
  prop.history = JSON.parse(JSON.stringify(SAMPLE_HISTORY[prop.id] || []));
  const defaultProp = DEFAULT_PROPERTIES.find(p => p.id === prop.id) || DEFAULT_PROPERTIES[0];
  prop.appliances = JSON.parse(JSON.stringify(defaultProp.appliances));
  
  if (prop.billingType === 'prepaid') {
    prop.recharges = JSON.parse(JSON.stringify(SAMPLE_RECHARGES[prop.id] || []));
    prop.balance = 420; // reset to sample balance
  }

  // Mark this property as currently displaying demo data
  prop.isDemo = true;
  
  // Re-unlock some initial gamification achievements
  appState.gamification.points += 50;
  
  // Save state (which strips out demo data from localStorage, but updates points in localStorage!)
  saveStateToStorage();

  renderDashboard();
  updateGlobalHeaderMetrics();
  
  alert('Sample billing records and appliance parameters loaded successfully for: ' + prop.name + '\n(Note: This sample data is temporary and will be cleared when you close or reload the website.)');
}

/* Parses local PDF client-side using PDF.js and tries to extract billing items */
async function handleUploadedBillPDF(file) {
  if (!file) return;

  if (typeof pdfjsLib === 'undefined') {
    alert('PDF parsing library (PDF.js) is not loaded. Please check your internet connection or reload the page.');
    return;
  }

  const dropzone = document.getElementById('uploadDropzone');
  const loader = document.getElementById('parsingLoader');
  const statusText = document.getElementById('parsingStatusText');
  const ocrPreview = document.getElementById('ocrScannerPreview');
  const scannerImg = document.getElementById('scannerImg');

  // Check if image upload
  if (file.type.startsWith('image/')) {
    dropzone.classList.add('hidden');
    if (ocrPreview) ocrPreview.classList.remove('hidden');
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
      if (scannerImg) scannerImg.src = this.result;
      
      // Simulate OCR scanning
      setTimeout(() => {
        if (ocrPreview) ocrPreview.classList.add('hidden');
        dropzone.classList.remove('hidden');
        
        const prop = getActiveProperty();
        const nextMonthName = getNextAvailablePastMonth(prop);
        
        if (prop.billingType === 'prepaid') {
          // Log recharge from OCR statement
          const rechargeAmt = Math.round(500 + Math.random() * 1500);
          const receiptNo = 'RC-' + Math.floor(10000000 + Math.random() * 90000000) + 'A';
          
          if (prop.isDemo) {
            prop.history = [];
            prop.recharges = [];
            prop.balance = 0;
            delete prop.isDemo;
          }

          if (!prop.recharges) prop.recharges = [];
          if (prop.balance === undefined) prop.balance = 0;
          
          prop.recharges.unshift({
            date: new Date().toISOString().split('T')[0],
            amount: rechargeAmt,
            receiptNo: receiptNo
          });
          prop.balance += rechargeAmt;

          saveStateToStorage();
          renderDashboard();
          updateGlobalHeaderMetrics();
          
          alert(`⚡ Recharge Receipt OCR Scan Completed!\nReceipt logged: ₹${rechargeAmt}\nReceipt No: ${receiptNo}\nNew Balance: ₹${prop.balance}`);
        } else {
          // Postpaid bill simulated extraction
          const units = Math.round(300 + Math.random() * 200);
          const amount = Math.round(units * BASE_RATE + 200);
          const dummyText = `Consumer No: 109843729\nUnits Billed: ${units} kWh\nTotal Bill Amount: ₹${amount}\nBill Month: ${nextMonthName}`;
          parseBillTextAndAddRecord(dummyText);
        }
        
      }, 1800); // 1.8s simulation delay
    };
    fileReader.readAsDataURL(file);
    return;
  }

  // Toggle visibility loaders for standard PDF
  dropzone.classList.add('hidden');
  loader.classList.remove('hidden');
  statusText.innerText = 'Initializing PDF reader...';

  try {
    // Ensure worker is fully loaded from CDN and converted to Blob URL
    await initPdfWorker();
    
    statusText.innerText = `Reading "${file.name}"...`;
    
    const fileReader = new FileReader();
    fileReader.onload = async function() {
      try {
        const typedarray = new Uint8Array(this.result);
        
        statusText.innerText = 'Extracting PDF layout text...';
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        
        let fullText = '';
        // Only parse the first 2 pages (standard bills are 1-2 pages; prevents hanging on large PDFs)
        const pagesToParse = Math.min(2, pdf.numPages);
        for (let i = 1; i <= pagesToParse; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = (content.items || []).map(item => item ? item.str : '').join(' ');
          fullText += pageText + '\n';
        }
        
        statusText.innerText = 'Analyzing billing parameters...';
        // Reduced delay for faster user feedback
        setTimeout(() => {
          try {
            parseBillTextAndAddRecord(fullText);
          } catch (e) {
            console.error('Error during parsing/storing record:', e);
            alert('Failed to parse bill details. Please verify your PDF format.');
          } finally {
            loader.classList.add('hidden');
            dropzone.classList.remove('hidden');
          }
        }, 200);

      } catch (err) {
        console.error('PDF JS Extract Error:', err);
        showParsingError(err);
      }
    };
    fileReader.readAsArrayBuffer(file);

  } catch (err) {
    console.error('File Read Error:', err);
    showParsingError(err);
  }
}

function showParsingError(err) {
  const dropzone = document.getElementById('uploadDropzone');
  const loader = document.getElementById('parsingLoader');
  loader.classList.add('hidden');
  dropzone.classList.remove('hidden');
  
  let msg = 'Failed to read PDF. Please ensure it is a valid PDF file.';
  if (err && err.message) {
    msg += '\n\nDetails: ' + err.message;
  }
  alert(msg);
}

/* Helper to calculate closest past or present month that does not exist in history */
function getNextAvailablePastMonth(prop) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentDate = new Date();
  let checkYear = currentDate.getFullYear();
  let checkMonthIdx = currentDate.getMonth(); // 0-indexed
  
  // Look back up to 24 months to find a gap
  for (let i = 0; i < 24; i++) {
    const monthStr = monthNames[checkMonthIdx] + ' ' + checkYear;
    const exists = prop.history && prop.history.some(h => h.month.toLowerCase() === monthStr.toLowerCase());
    if (!exists) {
      return monthStr;
    }
    // Go backwards
    checkMonthIdx--;
    if (checkMonthIdx < 0) {
      checkMonthIdx = 11;
      checkYear--;
    }
  }
  
  // Absolute fallback if everything is filled
  return monthNames[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
}

/* Helper to update saving streak dynamically based on consecutive months with lower/equal consumption */
function updateStreakValue(prop) {
  if (!prop.history || prop.history.length < 2) {
    if (prop.isDemo) {
      appState.gamification.streak = 3;
    } else {
      appState.gamification.streak = 0;
    }
    return;
  }
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sorted = [...prop.history].sort((a, b) => {
    const partsA = a.month.split(' ');
    const partsB = b.month.split(' ');
    const yearDiff = parseInt(partsA[1]) - parseInt(partsB[1]);
    if (yearDiff !== 0) return yearDiff;
    return monthNames.indexOf(partsA[0]) - monthNames.indexOf(partsB[0]);
  });
  
  let streak = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].units <= sorted[i - 1].units) {
      streak++;
    } else {
      streak = 0;
    }
  }
  
  appState.gamification.streak = streak;
}

/* Deletion handler for postpaid billing records */
function deletePostpaidBillRecord(propertyId, month) {
  const property = appState.properties.find(p => p.id === propertyId);
  if (property) {
    property.history = property.history.filter(h => h.month.toLowerCase() !== month.toLowerCase());
    saveStateToStorage();
    renderDashboard();
    updateGlobalHeaderMetrics();
    alert(`Deleted billing record for ${month}.`);
  }
}

/* Deletion handler for prepaid recharge transactions */
function deletePrepaidRechargeRecord(propertyId, index) {
  const property = appState.properties.find(p => p.id === propertyId);
  if (property && property.recharges) {
    const deletedRecharge = property.recharges[index];
    if (deletedRecharge) {
      property.recharges.splice(index, 1);
      property.balance = Math.max(0, property.balance - deletedRecharge.amount);
      saveStateToStorage();
      renderDashboard();
      updateGlobalHeaderMetrics();
      alert(`Deleted recharge record of ₹${deletedRecharge.amount}.`);
    }
  }
}

/* Helper to parse text using regex rules and push to property history */
function parseBillTextAndAddRecord(text) {
  console.log("PDF parsed raw text length:", text.length);
  
  const prop = getActiveProperty();
  
  // Wipe demo history first if any upon actual user action
  if (prop.isDemo) {
    prop.history = [];
    prop.recharges = [];
    prop.balance = 0;
    delete prop.isDemo;
  }
  
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
  // Fallback engine for missing units or amount
  if (!units || !amount) {
    console.log("Regex parameters failed. Generating simulated fallback billing card.");
    units = Math.round(300 + Math.random() * 200);
    amount = Math.round(units * BASE_RATE + 200);
  }

  // Fallback engine for missing month
  if (!monthStr) {
    monthStr = getNextAvailablePastMonth(prop);
  }

  // Real-time tracking check: prevent future month bills
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth(); // 0-indexed
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const parts = monthStr.split(' ');
  const billMonthIdx = monthNames.indexOf(parts[0]);
  const billYear = parseInt(parts[1]);
  
  let isFuture = false;
  if (!isNaN(billYear)) {
    if (billYear > currentYear) {
      isFuture = true;
    } else if (billYear === currentYear && billMonthIdx > currentMonthIdx) {
      isFuture = true;
    }
  }
  
  if (isFuture) {
    alert(`⚠️ Access Denied: Cannot add bill for a future period (${monthStr}).\nOnly present or past month bills can be uploaded.\n(Current Month: ${monthNames[currentMonthIdx]} ${currentYear})`);
    return;
  }

  // Duplicate Check: exact same month, units, and amount
  const isDuplicate = prop.history.some(h => 
    h.month.toLowerCase() === monthStr.toLowerCase() && 
    h.units === units && 
    h.amount === amount
  );
  if (isDuplicate) {
    alert(`⚠️ Duplicate Bill Detected!\nA billing record for ${monthStr} with ${units} kWh and ₹${amount} already exists in your history. Upload ignored.`);
    return;
  }

  // Handle month overwrite if same month but different units/amount
  const exists = prop.history.some(h => h.month.toLowerCase() === monthStr.toLowerCase());
  if (exists) {
    if (confirm(`A billing record already exists for ${monthStr} with different parameters.\nWould you like to overwrite it with this new bill?`)) {
      prop.history = prop.history.filter(h => h.month.toLowerCase() !== monthStr.toLowerCase());
    } else {
      return; // Cancel upload
    }
  }

  taxes = Math.round(amount * 0.1);
  fixedCharges = prop.type === 'commercial' ? 350 : 120;

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
  } else {
    document.getElementById('calcBillPct').innerText = '0%';
    document.getElementById('calcBillPctFill').style.width = '0%';
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
  const prop = getActiveProperty();
  updateStreakValue(prop);
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
    let billText = '';
    if (p.billingType === 'prepaid') {
      billText = `Wallet Balance: ₹${p.balance || 0}`;
    } else {
      billText = latestBill ? `Last Bill: ₹${latestBill.amount} (${latestBill.month})` : 'No bill history';
    }

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

  const billingType = document.getElementById('propBillingType').value;

  const newProp = {
    id: `prop-${Date.now()}`,
    name: name,
    type: type,
    billingType: billingType,
    sanctionedLoad: load,
    history: [],
    appliances: [
      { id: `app-fan-${Date.now()}`, name: 'Ceiling Fan', icon: 'wind', wattage: 75, quantity: 2, hours: 10 },
      { id: `app-led-${Date.now()}`, name: 'LED Bulbs', icon: 'lightbulb', wattage: 9, quantity: 5, hours: 6 }
    ]
  };

  if (billingType === 'prepaid') {
    newProp.balance = 1000; // Starting demo balance
    newProp.dailyBurnRate = 50; // Starting daily burn rate
    newProp.recharges = [
      { date: new Date().toISOString().split('T')[0], amount: 1000, receiptNo: `RC-${Math.floor(10000000 + Math.random() * 90000000)}` }
    ];
  } else {
    // Empty history
    newProp.history = [];
  }

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

  // Prepaid balance or recharge queries
  if (normalized.includes('balance') || normalized.includes('days left') || normalized.includes('recharge') || normalized.includes('burn rate') || normalized.includes('prepaid') || normalized.includes('wallet')) {
    if (prop.billingType !== 'prepaid') {
      return `<p><strong>${prop.name}</strong> is currently configured as a <strong>Postpaid</strong> property.</p>
              <p>Prepaid wallet balances, daily burn rates, and recharge logging are only active for Prepaid properties. You can switch to the <strong>Retail Shop</strong> (prepaid demo property) or create a new property with connection type set to <i>Prepaid</i> under the <strong>Manage Properties</strong> tab.</p>`;
    }
    
    const balance = prop.balance !== undefined ? prop.balance : 0;
    const daysLeft = prop.dailyBurnRate > 0 ? Math.round(balance / prop.dailyBurnRate) : 0;
    const lastRecharge = prop.recharges && prop.recharges.length > 0 ? prop.recharges[0] : null;
    const rechargeInfo = lastRecharge ? `Your last recharge of <strong>₹${lastRecharge.amount}</strong> was on <strong>${lastRecharge.date}</strong>.` : 'No recharge transactions logged.';
    
    return `<p>Here is the smart meter prepaid wallet status for <strong>${prop.name}</strong>:</p>
            <ul>
              <li><strong>Current Balance:</strong> ₹${balance}</li>
              <li><strong>Daily Burn Rate:</strong> ~₹${prop.dailyBurnRate || 50}/day</li>
              <li><strong>Estimated Wallet Life:</strong> <strong>${daysLeft} days</strong></li>
              <li><strong>Total Recharges:</strong> ${(prop.recharges || []).length} payments logged</li>
            </ul>
            <p>${rechargeInfo}</p>
            <p>💡 To prolong your wallet duration, try adjusting AC hours in the <strong>"What-If" Simulator</strong> or replacing old bulbs with LEDs.</p>`;
  }

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

// Expose functions globally for inline HTML event handlers
window.adjustQty = adjustQty;
window.updateApplianceHours = updateApplianceHours;
window.deleteAppliance = deleteAppliance;
window.selectProperty = selectProperty;
window.deleteProperty = deleteProperty;

