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

// AIチャットプロキシAPI (Gemini & ChatGPT 両対応)
app.post('/api/chat', async (req, res) => {
  const { contents } = req.body;
  
  // フロントエンドから個人のキーが渡されているか、無ければサーバーの環境変数を使用
  let clientApiKey = req.body.apiKey || "";
  clientApiKey = clientApiKey.trim();

  let useOpenAI = false;
  let finalApiKey = "";

  if (clientApiKey) {
    useOpenAI = clientApiKey.startsWith("sk-");
    finalApiKey = clientApiKey;
  } else {
    // サーバーの環境変数を確認 (OpenAIを優先、無ければGemini)
    if (process.env.OPENAI_API_KEY) {
      useOpenAI = true;
      finalApiKey = process.env.OPENAI_API_KEY;
    } else if (process.env.GEMINI_API_KEY) {
      useOpenAI = false;
      finalApiKey = process.env.GEMINI_API_KEY;
    }
  }

  if (!finalApiKey) {
    console.error("AI API key (Gemini/OpenAI) is not configured on Render server environment.");
    return res.status(400).json({ error: 'AI API key (GEMINI_API_KEY or OPENAI_API_KEY) is not configured on the server.' });
  }

  try {
    if (useOpenAI) {
      // 1. OpenAI (ChatGPT: gpt-4o-mini) の呼び出し
      // Geminiのcontentsフォーマット [ { role: "user"|"model", parts: [{ text: "..." }] } ] を
      // OpenAIの messages フォーマット [ { role: "system"|"user"|"assistant", content: "..." } ] に変換
      const systemInstruction = contents[0] && contents[0].parts ? contents[0].parts[0].text : "";
      
      const messages = [
        { role: "system", content: systemInstruction }
      ];

      // 履歴を追加 (最初の指示プロンプトは除外)
      for (let i = 1; i < contents.length; i++) {
        const item = contents[i];
        if (item.parts && item.parts[0]) {
          messages.push({
            role: item.role === 'user' ? 'user' : 'assistant',
            content: item.parts[0].text
          });
        }
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${finalApiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // 高速・格安・高性能
          messages: messages
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenAI API proxy error:", errText);
        return res.status(response.status).json({ error: `OpenAI API error (Status ${response.status})` });
      }

      const resJson = await response.json();
      const text = resJson.choices[0].message.content;
      
      // フロントエンドのコードを壊さないよう、Gemini風のレスポンスオブジェクトに翻訳して返す
      return res.json({
        candidates: [{
          content: {
            parts: [{ text: text }]
          }
        }]
      });

    } else {
      // 2. Gemini (Gemini Flash Latest) の呼び出し
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": finalApiKey
        },
        body: JSON.stringify({ contents: contents })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API proxy error:", errText);
        return res.status(response.status).json({ error: `Gemini API error (Status ${response.status})` });
      }

      const resJson = await response.json();
      return res.json(resJson);
    }
  } catch (error) {
    console.error("Failed to proxy chat to AI:", error);
    return res.status(500).json({ error: 'Failed to communicate with AI API via server proxy' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
