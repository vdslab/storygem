const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { default: OpenAI } = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = ["http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
  }),
);

app.use(express.json());

const configuration = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAI(configuration);

app.post("/api/generate", async (req, res) => {
  const { groupedWords } = req.body;
  if (!groupedWords) {
    return res.status(400).json({ error: "groupedWords is required" });
  }

  try {
    const prompt = `クラスタとそのクラスタに含まれる単語のリストを与えるので、それぞれのクラスタにふさわしいラベルを生成してください。
    出力して欲しい言語(日本語or英語)も併せて与えるのでクラスターを要約する1つのカテゴリーラベルを指定した言語で作成してください。
    ラベルは非常に簡潔でなければならず、クラスターとその外側にある提案or要望を区別するのに十分な正確さでなければならない。
    ラベル名は、必ず出力して欲しい言語(日本語or英語)で記述してください:\n
    ## 出力して欲しい言語: 英語\n
    ## 単語のクラスタとリスト \n${JSON.stringify(groupedWords, null, 2)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ text: response.choices[0].message.content });
  } catch (error) {
    console.error("Error while communicating with OpenAI:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
