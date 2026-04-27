export function parseResume(text) {

  // =========================
  // CLEAN TEXT
  // =========================
  function cleanText(text) {
    return text
      .replace(/\r/g, "")
      .replace(/\n+/g, "\n")
      .replace(/ +/g, " ")
      .trim();
  }

  const lines = cleanText(text)
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 1);

  // =========================
  // SECTION DETECTION
  // =========================
  let current = "summary";

  const sections = {
    summary: [],
    education: [],
    experience: [],
    projects: [],
    skills: []
  };

  lines.forEach(line => {
    const upper = line.toUpperCase();

    if (upper.includes("SUMMARY") || upper.includes("PROFILE")) current = "summary";
    else if (upper.includes("EDUCATION")) current = "education";
    else if (upper.includes("WORK EXPERIENCE") || upper.includes("EXPERIENCE")) current = "experience";
    else if (upper.includes("PROJECT")) current = "projects";
    else if (upper.includes("SKILLS")) current = "skills";
    else sections[current].push(line);
  });

  // =========================
  // BASIC EXTRACTION
  // =========================
  function extractName(text) {
    return text.split("\n")[0].split("|")[0].trim();
  }

  function cleanName(name) {
    return name.replace(/(Malaysia|Seoul|Melaka|Kuala Lumpur).*$/i, "").trim();
  }

  function extractEmail(text) {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
  }

  function extractPhone(text) {
    const match = text.match(/\+?\d[\d -]{8,}\d/);
    return match ? match[0].replace(/\s+/g, "") : "";
  }

  function isBullet(line) {
    return line.startsWith("•") || line.startsWith("·") || line.startsWith("-");
  }

  function isDateOnly(line) {
    return /^\w+\s\d{4}/i.test(line);
  }

  function extractDates(text) {
    const match = text.match(/(\w+\s)?\d{4}\s*[-–]\s*(Present|\w+\s?\d{4})/i);
    if (!match) return { start: "", end: "" };

    const parts = match[0].split(/[-–]/);
    return {
      start: parts[0].trim(),
      end: parts[1].trim()
    };
  }

  // =========================
  // EDUCATION
  // =========================
  function parseEducation(lines) {
    const results = [];
    let currentBlock = [];

    lines.forEach(line => {
      if (/University|College|Institute|School|Academy/i.test(line)) {
        if (currentBlock.length) processBlock(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    });

    if (currentBlock.length) processBlock(currentBlock);

    function processBlock(block) {
      const text = block.join(" ");

      const schoolMatch = text.match(/([A-Z][a-zA-Z&.\-\s]{5,}(University|College|Institute|School|Academy))/i);
      if (!schoolMatch) return;

      const degreeMatch = text.match(/(Bachelor|Master|PhD|Diploma|Foundation|Certificate)/i);
      const fieldMatch = text.match(/(in|of)\s([A-Za-z\s&]+)/i);

      const dateMatch = text.match(/(\w+\s)?\d{4}\s*[-–]\s*(Present|\w+\s?\d{4})/);
      let start = "", end = "";
      if (dateMatch) {
        const parts = dateMatch[0].split(/[-–]/);
        start = parts[0].trim();
        end = parts[1].trim();
      }

      // GPA (GPA / CGPA / Result)
      const gpaMatch =
        text.match(/(GPA|CGPA|Result)\s*[:\-]?\s*(\d\.\d{1,2})/i) ||
        text.match(/(\d\.\d{1,2})\/\d\.\d{1,2}/);

      const gpa = gpaMatch ? (gpaMatch[2] || gpaMatch[1]) : "";

      // Coursework
      const courseworkMatch = text.match(/(coursework|subjects|modules)\s*[:\-]?\s*(.*?)(?=\||$)/i);

      let coursework = [];
      if (courseworkMatch) {
        coursework = courseworkMatch[2]
          .split(",")
          .map(c => c.trim())
          .filter(c => c.length > 2);
      }

      results.push({
        school: schoolMatch[0].trim(),
        degree: degreeMatch ? degreeMatch[0] + " Degree" : "",
        field: fieldMatch ? fieldMatch[2].trim() : "",
        start_date: start,
        end_date: end,
        gpa: gpa,
        coursework: coursework
      });
    }

    return results;
  }

  // =========================
  // EXPERIENCE
  // =========================
  function parseExperience(lines) {
    const results = [];
    let current = null;

    lines.forEach(line => {

      if (/EXTRACURRICULAR|VOLUNTEERING|ACTIVITIES/i.test(line)) return;
      if (isDateOnly(line)) return;

      if (!isBullet(line)) {

        if (current) results.push(current);

        const dates = extractDates(line);

        let role = line;
        let company = "";

        if (line.includes("-")) {
          const parts = line.split("-");
          role = parts[0].trim();
          company = parts.slice(1).join("-").trim();
        }

        current = {
          company,
          role,
          start_date: dates.start,
          end_date: dates.end,
          bullets: []
        };
      }

      else if (current) {
        current.bullets.push(line.replace(/^[•·-]\s*/, "").trim());
      }

    });

    if (current) results.push(current);

    return results.filter(e => e.role.length > 2);
  }

  // =========================
  // PROJECTS
  // =========================
  function parseProjects(lines) {
    const results = [];
    let current = null;

    lines.forEach(line => {

      if (isDateOnly(line) && current) {
        const dates = extractDates(line);
        current.start_date = dates.start;
        current.end_date = dates.end;
        return;
      }

      if (!isBullet(line)) {

        if (current) results.push(current);

        const dates = extractDates(line);

        const name = line.replace(/(\w+\s)?\d{4}\s*[-–]\s*(Present|\w+\s?\d{4})/i, "").trim();

        current = {
          name,
          start_date: dates.start,
          end_date: dates.end,
          technologies: [],
          bullets: []
        };
      }

      else if (current) {
        current.bullets.push(line.replace(/^[•·-]\s*/, "").trim());
      }

    });

    if (current) results.push(current);

    return results.filter(p => p.name && p.name.length > 5);
  }

  // =========================
  // SKILLS
  // =========================
  function parseSkills(lines) {
    let skills = [];

    lines.forEach(line => {
      if (/skills/i.test(line)) {
        let cleaned = line
          .replace(/skills\s*:*/i, "")
          .replace(/\(.*?\)/g, "");

        skills.push(...cleaned.split(","));
      }
    });

    skills = skills.map(s =>
      s.replace(/^[•·-]\s*/, "").toLowerCase().trim()
    );

    skills = skills.filter(skill => {
      if (!skill) return false;
      if (skill.length > 30) return false;
      if (/language|hobbies|interest/i.test(skill)) return false;
      if (/\d/.test(skill)) return false;
      return true;
    });

    return [...new Set(skills)];
  }

  // =========================
  // FINAL OUTPUT
  // =========================
  return {
    target_role: "Data Analyst",
    target_level: "Entry-level",

    name: cleanName(extractName(text)),
    email: extractEmail(text),
    phone: extractPhone(text),
    address: null,

    summary: sections.summary.join(" "),

    education: parseEducation(sections.education),
    experience: parseExperience(sections.experience),
    projects: parseProjects(sections.projects),
    skills: parseSkills(lines),

    awards: []
  };
}