// wallet_ui.js
const API_KEY = "goldapi-pv9smbmkqkxq-io";

// Fetch spot prices
async function fetchSpotPrices() {
  const headers = {
    "x-access-token": API_KEY,
    "Content-Type": "application/json"
  };

  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch("https://www.goldapi.io/api/XAU/USD", { headers }),
      fetch("https://www.goldapi.io/api/XAG/USD", { headers })
    ]);

    if (!goldRes.ok || !silverRes.ok) {
      const status = !goldRes.ok ? goldRes.status : silverRes.status;
      throw new Error(`GoldAPI response not ok (status ${status})`);
    }

    const goldData = await goldRes.json();
    const silverData = await silverRes.json();

    const prices = {
      gold: goldData.price,
      silver: silverData.price,
      copper: 1.99,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('spotPrices', JSON.stringify(prices));

    await fetch('/api/spot-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices)
    });

    return prices;
  } catch (error) {
    console.warn('⚠️ Spot price fetch failed. Falling back to local data.');
    const cached = localStorage.getItem('spotPrices');
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch('/api/spot-prices');
      if (res.ok) return await res.json();
    } catch {}

    return {
      gold: 0,
      silver: 0,
      copper: 1.99,
      lastUpdated: null
    };
  }
}

async function fetchHoldings() {
  const res = await fetch('/api/wallet');
  const wallet = await res.json();
  return wallet.holdings || [];
}

function groupHoldings(holdings) {
  const grouped = {};
  holdings.forEach(item => {
    const key = `${item.metal}|${item.design || ''}`;
    if (!grouped[key]) {
      grouped[key] = {
        metal: item.metal,
        design: item.design,
        ounces: item.weight * item.quantity,
        totalBuy: item.buyPrice * item.weight * item.quantity
      };
    } else {
      grouped[key].ounces += item.weight * item.quantity;
      grouped[key].totalBuy += item.buyPrice * item.weight * item.quantity;
    }
  });
  Object.values(grouped).forEach(entry => {
    entry.buyPrice = entry.totalBuy / entry.ounces;
  });
  return Object.values(grouped);
}

let currentFilter = null;

async function renderWallet(spotPrices, holdings, filterMetal = null) {
  const grouped = groupHoldings(holdings);
  const table = document.getElementById('walletTable');
  table.innerHTML = '';

  const uniqueDesigns = [...new Set(holdings.map(h => h.design).filter(Boolean))];
  const datalist = document.getElementById('designs');
  datalist.innerHTML = uniqueDesigns.map(d => `<option value="${d}">`).join('');

  let totalValue = 0;

  grouped.forEach(item => {
    if (filterMetal && item.metal !== filterMetal) return;

    const spot = spotPrices[item.metal] || 0;
    const value = item.ounces * spot;
    const cost = item.ounces * item.buyPrice;
    const gainLoss = value - cost;

    totalValue += value;

    const row = document.createElement('tr');
    row.setAttribute('data-metal', item.metal);

    row.innerHTML = `
      <td class="metal-cell" style="cursor:pointer">${item.metal}</td>
      <td>${item.design || '-'}</td>
      <td>${item.ounces}</td>
      <td>$${item.buyPrice.toFixed(2)}</td>
      <td>$${spot.toFixed(2)}</td>
      <td style="color:${gainLoss >= 0 ? 'lightgreen' : 'lightblue'}">$${gainLoss.toFixed(2)}</td>
      <td style="color:green">$${value.toFixed(2)}</td>
    `;

    table.appendChild(row);

    const metalCell = row.querySelector('.metal-cell');
    metalCell.addEventListener('click', () => {
      if (currentFilter === item.metal) {
        currentFilter = null;
        renderWallet(spotPrices, holdings, null);
      } else {
        currentFilter = item.metal;
        renderWallet(spotPrices, holdings, item.metal);
      }
    });
  });

  document.getElementById('portfolioValue').textContent = `(Total: $${totalValue.toFixed(2)})`;
}

async function updateUI() {
  const spotPrices = await fetchSpotPrices();
  const holdings = await fetchHoldings();

  document.getElementById('goldSpot').textContent = `Gold: $${spotPrices.gold.toFixed(2)}`;
  document.getElementById('silverSpot').textContent = `Silver: $${spotPrices.silver.toFixed(2)}`;
  document.getElementById('copperSpot').textContent = `Copper: $${spotPrices.copper.toFixed(2)}`;

  await renderWallet(spotPrices, holdings, currentFilter);

  if (spotPrices.lastUpdated) {
    const date = new Date(spotPrices.lastUpdated);
    document.getElementById('lastUpdated').textContent = `Last updated: ${date.toLocaleString()}`;
  } else {
    document.getElementById('lastUpdated').textContent = 'Last updated: N/A';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const metalInput = document.getElementById('metal');
  const weightSelect = document.getElementById('weightSelect');
  const quantityInput = document.getElementById('quantity');
  const buyPriceInput = document.getElementById('buyPrice');
  const designInput = document.getElementById('design');
  const submitBtn = document.getElementById('submitBtn');
  const toggleBtn = document.getElementById('toggleFormBtn');
  const formWrapper = document.getElementById('formWrapper');

  toggleBtn.addEventListener('click', () => {
    formWrapper.classList.toggle('open');
  });

  function validateForm() {
    const metal = metalInput.value.trim();
    const weight = parseFloat(weightSelect.value);
    const quantity = parseInt(quantityInput.value, 10);
    const buyPrice = parseFloat(buyPriceInput.value);
    const design = designInput.value.trim();

    const isValid =
      metal !== '' &&
      !isNaN(weight) && weight > 0 &&
      !isNaN(quantity) && quantity > 0 &&
      !isNaN(buyPrice) && buyPrice >= 0 &&
      design !== '';

    submitBtn.disabled = !isValid;
    submitBtn.style.backgroundColor = isValid ? '#4CAF50' : '#ccc';
    submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  }

  [metalInput, weightSelect, quantityInput, buyPriceInput, designInput].forEach(input => {
    input.addEventListener('input', validateForm);
  });

  document.getElementById('entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const metal = metalInput.value.trim();
    const weight = parseFloat(weightSelect.value);
    const quantity = parseInt(quantityInput.value, 10);
    const buyPrice = parseFloat(buyPriceInput.value);
    const design = designInput.value.trim();

    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metal, weight, quantity, buyPrice, design })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Server error:', text);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }

    await updateUI();
    e.target.reset();
    validateForm();
  });

  validateForm();
});

updateUI();
