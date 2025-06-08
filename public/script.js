const API_KEY = "goldapi-pv9smbmkqkxq-io";

// Fetch spot prices for metals from API or fallback cache
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

    // Optional backend caching
    await fetch('/api/spot-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices)
    });

    return prices;
  } catch (error) {
    console.warn('⚠️ Spot price fetch failed. Falling back to local data.');
    console.debug(error.message);

    const cached = localStorage.getItem('spotPrices');
    if (cached) return JSON.parse(cached);

    try {
      const res = await fetch('/api/spot-prices');
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (fallbackErr) {
      console.debug('Fallback from server also failed:', fallbackErr.message);
    }

    // Default fallback prices
    return {
      gold: 0,
      silver: 0,
      copper: 1.99,
      lastUpdated: null
    };
  }
}

// Fetch wallet holdings array from backend
async function fetchHoldings() {
  const res = await fetch('/api/wallet');
  const wallet = await res.json();
  return wallet.holdings || [];
}

// Group holdings by metal + design, summing ounces and weighted avg buy price
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

  // Calculate average buy price per ounce
  Object.values(grouped).forEach(entry => {
    entry.buyPrice = entry.totalBuy / entry.ounces;
  });

  return Object.values(grouped);
}

// Render the wallet table and design datalist
async function renderWallet(spotPrices, holdings) {
  const grouped = groupHoldings(holdings);
  const table = document.getElementById('walletTable');
  table.innerHTML = '';

  // Populate datalist with unique design names
  const uniqueDesigns = [...new Set(holdings.map(h => h.design).filter(Boolean))];
  const datalist = document.getElementById('designs');
  datalist.innerHTML = uniqueDesigns.map(d => `<option value="${d}">`).join('');

  grouped.forEach(item => {
    const spot = spotPrices[item.metal] || 0;
    const value = (item.ounces * spot).toFixed(2);
    const cost = (item.ounces * item.buyPrice).toFixed(2);
    const gainLoss = (value - cost).toFixed(2);

    const row = `
      <tr>
        <td>${item.metal}</td>
        <td>${item.design || '-'}</td>
        <td>${item.ounces}</td>
        <td>$${item.buyPrice.toFixed(2)}</td>
        <td>$${spot.toFixed(2)}</td>
        <td style="color:${gainLoss >= 0 ? 'lightgreen' : 'lightblue'}">$${gainLoss}</td>
        <td style="color:green">$${value}</td>
      </tr>`;
    table.insertAdjacentHTML('beforeend', row);
  });
}

// Update the whole UI — spot prices, portfolio, wallet table
async function updateUI() {
  const spotPrices = await fetchSpotPrices();
  const holdings = await fetchHoldings();

  document.getElementById('goldSpot').textContent = `Gold: $${spotPrices.gold.toFixed(2)}`;
  document.getElementById('silverSpot').textContent = `Silver: $${spotPrices.silver.toFixed(2)}`;
  document.getElementById('copperSpot').textContent = `Copper: $${spotPrices.copper.toFixed(2)}`;

  await renderWallet(spotPrices, holdings);

  let totalValue = 0;
  holdings.forEach(item => {
    const spot = spotPrices[item.metal] || 0;
    totalValue += item.weight * item.quantity * spot;
  });

  document.getElementById('portfolioValue').textContent = `(Total: $${totalValue.toFixed(2)})`;

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
