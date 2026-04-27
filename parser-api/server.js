const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdf = require("pdf-text");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

function cleanText(text) {
  return text
    .replace(/\b([A-Za-z])\s+([a-z])/g, "$1$2")
    .replace(/\b([A-Z])\s+([A-Z][a-z])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSection(text, startKeywords, endKeywords) {
  const start = new RegExp(`(${startKeywords.join("|")})`, "i");
  const end = new RegExp(`(${endKeywords.join("|")})`, "i");

  const startMatch = text.match(start);
  if (!startMatch) return "";

  const startIndex = startMatch.index + startMatch[0].length;
  const rest = text.slice(startIndex);

  const endMatch = rest.match(end);
  if (!endMatch) return rest.trim();

  return rest.slice(0, endMatch.index).trim();
}

function cleanData(data) {
  return {
    ...data,

    summary: data.summary
      ? data.summary.replace(/\s+/g, " ").trim()
      : null,

    skills: (data.skills || []).filter(s =>
      s.length < 30 &&
      !s.toLowerCase().includes("availability") &&
      !s.includes(".")
    ),

    experience: (data.experience || []).filter(e =>
      e.description &&
      !e.description.toLowerCase().includes("team") &&
      !e.description.toLowerCase().includes("skills")
    )
  };
}

function parseResume(filePath) {
  return new Promise((resolve, reject) => {
    pdf(filePath, function (err, chunks) {
      if (err) {
        reject(err);
        return;
      }

      let text = cleanText(chunks.join(" "));

      text = text
        .replace(/\(Tip:[^)]+\)/gi, "")
        .replace(/E\s*-\s*M\s*ail/gi, "Email")
        .replace(/Phone\s*N\s*umber/gi, "Phone")
        .replace(/@\s+/g, "@")
        .replace(/\s+@/g, "@")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[•·●▪]/g, "\n")
        .replace(/\s+/g, " ")
        .trim();

      const email = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/) || [null])[0];

      let phone = (text.match(/\+?\d[\d\- ]{8,}/) || [null])[0];
      if (phone) phone = phone.replace(/\s+/g, "");

      const firstLine = chunks[0] || "";
      const name = firstLine.split(/(\d|,)/)[0].trim();

      const addressMatch = text.match(/\d{1,4}\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*\d{4}/);
      const address = addressMatch ? addressMatch[0] : null;

      let summary = text.split(/education|projects|skills/i)[0];
      summary = summary.trim();

      if (!summary || summary.length < 20) {
        const fallback = text.split(/\n/).slice(0, 5).join(" ");
        summary = fallback.length > 50 ? fallback : null;
      }

      const skillsText = extractSection(
        text,
        ["SKILLS", "KEY SKILLS", "TECHNICAL SKILLS"],
        ["EDUCATION", "PROJECT", "EXPERIENCE", "AWARDS"]
      );

      let skills = skillsText
        .split(/\n|,|\|/)
        .map(s => s.trim())
        .filter(s =>
          s.length > 2 &&
          s.length < 30 &&
          !s.match(/(and|the|with|for|responsible|objective)/i)
        )
        .map(s => s.replace(/[^\w\s+#]/g, "").trim());

      skills = [...new Set(skills)];

      const experienceText = extractSection(
        text,
        ["WORK EXPERIENCE", "EXPERIENCE"],
        ["PROJECT", "SKILLS", "EDUCATION", "AWARDS", "LEADERSHIP"]
      );

      const experienceBlocks = experienceText
        .split(/(?=\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\b)/i)
        .map(b => b.trim())
        .filter(b => b.length > 40);

      const experience = experienceBlocks.map(block => ({
        description: block
      }));

      const projectText = extractSection(
        text,
        ["PROJECT", "PROJECTS"],
        ["SKILLS", "EXPERIENCE", "EDUCATION", "AWARDS"]
      );

      const projectBlocks = projectText
        .split(/\n{2,}|•/)
        .map(p => p.trim())
        .filter(p => p.length > 30);

      const projects = projectBlocks.map(p => ({
        description: p
      }));

      const educationText = extractSection(
        text,
        ["EDUCATION", "ACADEMIC", "QUALIFICATIONS"],
        ["SKILLS", "PROJECT", "EXPERIENCE", "AWARDS"]
      );

      const educationBlocks = educationText
        .split(/(?=\d{4}\s*[-–]|Current)/i)
        .map(b => b.trim())
        .filter(b => b.length > 40);

      const education = educationBlocks.map(block => {
        const cgpaMatch = block.match(/CGPA\s*[: ]\s*(\d+\.\d+)/i);
        const yearMatch = block.match(/\d{4}\s*[-–]\s*(Present|\d{4})/);
        const isCurrent = block.match(/\b(Current|Present)\b/i);

        const year = yearMatch
          ? yearMatch[0]
          : isCurrent
          ? "Present"
          : null;

        const institutionMatch = block.match(
          /([A-Z][a-zA-Z&.\-\s]+(University|College|Institute|School|Secondary))/i
        );

        let institution = "";
        if (institutionMatch) {
          institution = institutionMatch[0]
            .replace(/^(Current|Present)\s+/i, "")
            .replace(/MINOR IN.*$/i, "")
            .trim();
        }

        const degree = block
          .split("|")[0]
          ?.replace(/CGPA.*$/i, "")
          .replace(/MINOR IN.*$/i, "")
          .replace(/([A-Z][a-zA-Z&.\-\s]+(University|College|Institute|School|Secondary)).*/i, "")
          .trim();

        return {
          institution,
          degree,
          year,
          cgpa: cgpaMatch ? cgpaMatch[1] : null,
          details: block.trim()
        };
      });

      const awardsText = extractSection(
        text,
        ["AWARDS", "CERTIFICATIONS"],
        ["SKILLS", "PROJECT", "EXPERIENCE", "EDUCATION"]
      );

      const awardBlocks = awardsText
        .split(/\n{2,}|•/)
        .map(a => a.trim())
        .filter(a => a.length > 30);

      const awards = awardBlocks.map(a => ({
        description: a
      }));

      const rawResult = {
        name,
        email,
        phone,
        address,
        summary,
        skills,
        experience,
        projects,
        education,
        awards
      };

      resolve(cleanData(rawResult));
    });
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Parser API is running"
  });
});

app.post("/parse-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded" });
    }

    const parsedResume = await parseResume(req.file.path);

    fs.unlinkSync(req.file.path);

    res.json(parsedResume);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to parse resume",
      detail: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Parser API running at http://127.0.0.1:${PORT}`);
});