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
  const { groupedWords, lang } = req.body;
  console.log(lang);

  if (!groupedWords) {
    console.error("groupedWords is missing in the request body");
    return res.status(400).json({ error: "groupedWords is required" });
  }

  if (!lang) {
    console.error("lang is missing in the request body");
    return res.status(400).json({ error: "lang is required" });
  }

  try {
    let prompt;
    if (lang === "en") {
      prompt = `Given clusters and their respective lists of words, generate appropriate labels for each cluster.
      Please also consider the desired output language (Japanese or English) provided, and create a single category label that summarizes the cluster in the specified language.
      The labels must be very concise and accurate enough to distinguish between the clusters and any suggestions or requests outside of them.
      Label names must represent the characteristics of the words within the cluster, including words not contained in the cluster.
      Label names should be as concise as possible and, at most, fit within a single phrase.
      The words used in label names should be as general as possible.
      Please ensure that label names are written in the desired output English\n
      ## Desired Output Language: English \n
      ## Clusters and Their Word Lists:\n${JSON.stringify(groupedWords, null, 2)}`;
    } else if (lang === "ja") {
      prompt = `クラスタとそのクラスタに含まれる単語のリストを与えるので、それぞれのクラスタにふさわしいラベルを生成してください。
      出力して欲しい言語(日本語or英語)も併せて与えるのでクラスターを要約する1つのカテゴリーラベルを指定した言語で作成してください。
      ラベルは非常に簡潔でなければならず、クラスターとその外側にある提案or要望を区別するのに十分な正確さでなければならない。
      ラベル名は、そのクラスタに含まれない単語も含めて、クラスタに含まれる単語の特性を表すものでなければならない。
      ラベル名は可能な限り簡潔にし、長くても一つのフレーズに収まるようにしなければならない。
      ラベル名に使用する単語は、可能な限り一般的な単語でなければならない。
      ラベル名は、必ず出力して欲しい言語(日本語or英語)で記述してください:\n
      ## 出力して欲しい言語: 日本語\n
      ## 単語のクラスタとリスト:\n${JSON.stringify(groupedWords, null, 2)}`;
    }

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
