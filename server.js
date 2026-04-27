import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

import {
  DocumentAnalysisClient,
  AzureKeyCredential
} from "@azure/ai-form-recognizer";

import { parseResume } from "./parser.js";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

const client = new DocumentAnalysisClient(
  process.env.AZURE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_KEY)
);

app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      fs.createReadStream(filePath)
    );

    const result = await poller.pollUntilDone();
    const text = result.content;

    const finalJson = parseResume(text);

    res.json(finalJson);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse resume" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});