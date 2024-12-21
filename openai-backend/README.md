## OpenAI API 使い方

- `.env` ファイルを `/openai-backend` 配下に作成する
- 以下の環境変数を設定する

```
OPENAI_API_KEY= OpenAIのAPIkey
PORT=5000
```

- `/openai-backend` 配下で `nodemon index.js` を実行
- rootで `npm run start` を実行し、通常通りボロノイツリーマップを描画すると「Send to OpenAI」というボタンが出現する
- 「Send to OpenAI」ボタンをクリックするとコンソール上にAPIからのレスポンスが出力される
