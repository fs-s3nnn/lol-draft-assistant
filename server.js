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

// データ保存API (セーブと同時に、環境変数がある場合は自動でGitHubにもコミット＆プッシュ)
app.post('/api/data', (req, res) => {
  const data = req.body;
  
  // 1. ローカルの data.json を上書き保存
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8', async (err) => {
    if (err) {
      console.error('Failed to write data.json:', err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    console.log('Successfully updated local data.json');

    // 2. 環境変数が設定されていれば、GitHubにバックグラウンド自動コミット
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;

    if (owner && repo && token) {
      try {
        const filePath = 'data.json';
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        // A. 既存ファイルの sha を取得（上書き時に必須）
        let sha = null;
        const getRes = await fetch(apiUrl, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Shirosaba-Lol-Draft-Server'
          }
        });

        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }

        // B. データをBase64にエンコード
        const jsonStr = JSON.stringify(data, null, 2);
        const base64Content = Buffer.from(jsonStr).toString('base64');

        // C. 上書きコミットを実行
        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Shirosaba-Lol-Draft-Server'
          },
          body: JSON.stringify({
            message: 'Auto-save draft data from Shirosaba LOL Draft Server',
            content: base64Content,
            sha: sha
          })
        });

        if (!putRes.ok) {
          const errDetail = await putRes.json();
          console.error("GitHub API commit error from Server:", errDetail);
        } else {
          console.log("Successfully auto-committed to GitHub repository!");
        }
      } catch (gitErr) {
        console.error("Error during auto-commit to GitHub:", gitErr);
      }
    }

    return res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
