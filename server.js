const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

const walletFile = path.join(__dirname, 'data', 'wallet.json');
const spotPriceFile = path.join(__dirname, 'data', 'spotPrices.json');

function loadWallet(callback) {
    fs.readFile(walletFile, 'utf-8', (err, data) => {
      if (err) return callback(err);
  
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        parsed = { holdings: [] };
      }
  
      if (!parsed.holdings || !Array.isArray(parsed.holdings)) {
        parsed.holdings = [];
      }
  
      callback(null, parsed);
    });
  }
  
// GET full wallet 
app.get('/api/wallet', (req, res) => {
  loadWallet((err, data) => {
    if (err) return res.status(500).send('Error reading wallet file');
    res.json(data);
  });
});

// POST new holding to wallet
app.post('/api/wallet', (req, res) => {
    const newEntry = req.body;
    console.log('Received entry:', newEntry);
  
    // Validate input
    if (
      !newEntry.metal ||
      typeof newEntry.weight !== 'number' ||
      typeof newEntry.quantity !== 'number' ||
      typeof newEntry.buyPrice !== 'number'
    ) {
      return res.status(400).send('Invalid entry');
    }
  
    // Optional: enforce positive values
    if (newEntry.weight <= 0 || newEntry.quantity <= 0 || newEntry.buyPrice < 0) {
      return res.status(400).send('Invalid values: weight/quantity/buyPrice must be positive');
    }
  
    // Add optional design fallback
    if (!newEntry.design) newEntry.design = '';
  
    // Load, update, and save wallet
    fs.readFile(walletFile, 'utf8', (err, data) => {
      if (err) return res.status(500).send('Read error');
  
      let wallet = {};
      try {
        wallet = JSON.parse(data);
      } catch {
        wallet = { holdings: [] };
      }
  
      if (!Array.isArray(wallet.holdings)) wallet.holdings = [];
  
      wallet.holdings.push(newEntry);
  
      fs.writeFile(walletFile, JSON.stringify(wallet, null, 2), err => {
        if (err) return res.status(500).send('Write error');
        res.json({ success: true });
      });
    });
  });  
  
  
// DELETE a holding by index
app.delete('/api/wallet/:index', (req, res) => {
  const index = parseInt(req.params.index);

  loadWallet((err, data) => {
    if (err) return res.status(500).send('Read error');
    if (index < 0 || index >= data.holdings.length) {
      return res.status(400).send('Invalid index');
    }
    data.holdings.splice(index, 1);
    fs.writeFile(walletFile, JSON.stringify(data, null, 2), err => {
      if (err) return res.status(500).send('Write error');
      res.json({ success: true });
    });
  });
});

// ✅ GET spot prices
app.get('/api/spot-prices', (req, res) => {
    fs.readFile(spotPriceFile, 'utf8', (err, data) => {
      if (err) return res.status(500).send('Error reading spot prices');
      res.json(JSON.parse(data));
    });
  });
  
  // ✅ POST spot prices to spotPrices.json only
  app.post('/api/spot-prices', (req, res) => {
    const prices = req.body;
    fs.writeFile(spotPriceFile, JSON.stringify(prices, null, 2), err => {
      if (err) return res.status(500).send('Error saving spot prices');
      res.json({ success: true });
    });
  });
  

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
