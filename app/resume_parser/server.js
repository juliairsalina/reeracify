import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

import {
  DocumentAnalysisClient,
  AzureKeyCredential
} from "@azure/ai-form-recognizer";

import { parseResume } from "./parser.js";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const client = new DocumentAnalysisClient(
  process.env.AZURE_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_KEY)
);

const FINAL_JSON_PATH = path.join(process.cwd(), "..", "sample", "final.json");

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Resume parser backend is running."
  });
});

app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No resume file uploaded. Expected field name: resume"
      });
    }

    const filePath = req.file.path;

    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      fs.createReadStream(filePath)
    );

    const result = await poller.pollUntilDone();
    const text = result.content || "";

    const finalJson = parseResume(text);

    finalJson.target_role = req.body.target_role || finalJson.target_role || "Data Analyst";
    finalJson.target_level = req.body.target_level || finalJson.target_level || "Entry-level";

    fs.mkdirSync(path.dirname(FINAL_JSON_PATH), { recursive: true });

    fs.writeFileSync(
      FINAL_JSON_PATH,
      JSON.stringify(finalJson, null, 2),
      "utf-8"
    );

    fs.unlinkSync(filePath);

    res.json({
      status: "parsed",
      message: "Resume parsed and saved to sample/final.json.",
      final_json_path: FINAL_JSON_PATH,
      final_json: finalJson
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to parse resume",
      detail: err.message
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Parser server running at http://127.0.0.1:3000");
});