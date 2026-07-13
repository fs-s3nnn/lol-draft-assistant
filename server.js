const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// データ取得API
app.get('/api/data', (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        console.error('Failed to read data.json:', err);
        return res.status(500).json({ error: 'Failed to read data' });
      }
      try {
        return res.json(JSON.parse(data));
      } catch (e) {
        return res.status(500).json({ error: 'Invalid JSON data' });
      }
    });
  } else {
    // データファイルが存在しない場合は初期の空データを返す
    return res.json({
      playerMaster: [],
      teamData: { blue: null, red: null },
      customDatabase: { counters: {}, synergy: {}, champDetails: {} },
      draftHistory: [],
      draftMode: "custom"
    });
  }
});

// データ保存API
app.post('/api/data', (req, res) => {
  const data = req.body;
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to write data.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    console.log('Successfully updated data.json');
    return res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
