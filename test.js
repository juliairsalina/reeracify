const pdf = require('pdf-text');
const fs = require('fs');

function cleanText(text) {
  return text
    .replace(/\b([A-Za-z])\s+([a-z])/g, "$1$2")
    .replace(/\b([A-Z])\s+([A-Z][a-z])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------
// SECTION EXTRACTOR
// ------------------------
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

// ------------------------
// CLEANING LAYER
// ------------------------
function cleanData(data) {
  return {
    ...data,

    summary: data.summary
      ? data.summary.replace(/\s+/g, " ").trim()
      : null,

    skills: data.skills.filter(s =>
      s.length < 30 &&
      !s.toLowerCase().includes("availability") &&
      !s.includes(".")
    ),

    experience: data.experience.filter(e =>
      !e.description.toLowerCase().includes("team") &&
      !e.description.toLowerCase().includes("skills")
    )
  };
}

// ------------------------
// MAIN PROCESS
// ------------------------
pdf('resume.pdf', function(err, chunks) {
  if (err) {
    console.error(err);
    return;
  }

  let text = cleanText(chunks.join(" "));

  // ------------------------
  // CLEAN TEXT
  // ------------------------
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

  // ------------------------
  // BASIC FIELDS
  // ------------------------
  let email = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/) || [null])[0];

  let phone = (text.match(/\+?\d[\d\- ]{8,}/) || [null])[0];
  if (phone) phone = phone.replace(/\s+/g, "");

  let firstLine = chunks[0] || "";
  let name = firstLine.split(/(\d|,)/)[0].trim();

  let addressMatch = text.match(/\d{1,4}\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*\d{4}/);
  let address = addressMatch ? addressMatch[0] : null;

  // ------------------------
  // SUMMARY
  // ------------------------
  let summary = text.split(/education|projects|skills/i)[0];

  summary = summary.trim();

  if (!summary || summary.length < 20) {
    let fallback = text.split(/\n/).slice(0, 5).join(" ");
    summary = fallback.length > 50 ? fallback : null;
  }

  // ------------------------
  // SKILLS
  // ------------------------
  let skillsText = extractSection(
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

  // ------------------------
  // EXPERIENCE
  // ------------------------
  let experienceText = extractSection(
    text,
    ["WORK EXPERIENCE", "EXPERIENCE"],
    ["PROJECT", "SKILLS", "EDUCATION", "AWARDS", "LEADERSHIP"]
  );

  let experienceBlocks = experienceText
    .split(/(?=\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\b)/i)
    .map(b => b.trim())
    .filter(b => b.length > 40);

  let experience = experienceBlocks.map(block => ({
    description: block
  }));

  // ------------------------
  // PROJECTS
  // ------------------------
  let projectText = extractSection(
    text,
    ["PROJECT", "PROJECTS"],
    ["SKILLS", "EXPERIENCE", "EDUCATION", "AWARDS"]
  );

  let projectBlocks = projectText
    .split(/\n{2,}|•/)
    .map(p => p.trim())
    .filter(p => p.length > 30);

  let projects = projectBlocks.map(p => ({
    description: p
  }));

  // ------------------------
  // EDUCATION (FIXED)
  // ------------------------
  let educationText = extractSection(
    text,
    ["EDUCATION", "ACADEMIC", "QUALIFICATIONS"],
    ["SKILLS", "PROJECT", "EXPERIENCE", "AWARDS"]
  );

  let educationBlocks = educationText
    .split(/(?=\d{4}\s*[-–]|Current)/i)
    .map(b => b.trim())
    .filter(b => b.length > 40);

  let education = educationBlocks.map(block => {

    let cgpaMatch = block.match(/CGPA\s*[: ]\s*(\d+\.\d+)/i);

    let yearMatch = block.match(/\d{4}\s*[-–]\s*(Present|\d{4})/);
    let isCurrent = block.match(/\b(Current|Present)\b/i);

    let year = yearMatch
      ? yearMatch[0]
      : isCurrent
      ? "Present"
      : null;

    let institutionMatch = block.match(
      /([A-Z][a-zA-Z&.\-\s]+(University|College|Institute|School|Secondary))/i
    );

    let institution = "";
    if (institutionMatch) {
      institution = institutionMatch[0]
        .replace(/^(Current|Present)\s+/i, "") 
        .replace(/MINOR IN.*$/i, "")
        .trim();
    }

    let degree = block
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

  // ------------------------
  // AWARDS
  // ------------------------
  let awardsText = extractSection(
    text,
    ["AWARDS", "CERTIFICATIONS"],
    ["SKILLS", "PROJECT", "EXPERIENCE", "EDUCATION"]
  );

  let awardBlocks = awardsText
    .split(/\n{2,}|•/)
    .map(a => a.trim())
    .filter(a => a.length > 30);

  let awards = awardBlocks.map(a => ({
    description: a
  }));

  // ------------------------
  // FINAL OUTPUT
  // ------------------------
  let rawResult = {
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

  let result = cleanData(rawResult);

  fs.writeFileSync('output.json', JSON.stringify(result, null, 2));

  console.log("✅ CLEANED JSON:");
  console.log(result);
});