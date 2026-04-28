export function parseResume(text) {
  // ============================================================
  // Clean text
  // ============================================================

  function cleanText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\n{2,}/g, "\n")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  }

  const cleanedText = cleanText(text);

  const lines = cleanedText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 1);

  // ============================================================
  // Basic extraction helpers
  // ============================================================

  function extractName(rawText) {
    const firstUsefulLine = rawText
      .split("\n")
      .map(line => line.trim())
      .find(line => line && !line.includes("@"));

    if (!firstUsefulLine) return "";

    return firstUsefulLine
      .split("|")[0]
      .replace(/\+?\d[\d\s-]{8,}\d/g, "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .trim();
  }

  function cleanName(name) {
    return String(name || "")
      .replace(/(Malaysia|Seoul|Melaka|Kuala Lumpur|Republic of Korea).*$/i, "")
      .replace(/[|•·]/g, "")
      .trim();
  }

  function extractEmail(rawText) {
    const match = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
  }

  function extractPhone(rawText) {
    const match = rawText.match(/(\+?\d[\d\s-]{8,}\d)/);
    return match ? match[0].replace(/\s+/g, " ").trim() : "";
  }

  function isBullet(line) {
    return /^[•·\-–]\s+/.test(line.trim());
  }

  function cleanBullet(line) {
    return line
      .replace(/^[•·\-–]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isLikelySectionHeader(line) {
    const upper = line.trim().toUpperCase();

    const headers = [
      "SUMMARY",
      "PROFILE",
      "EDUCATION",
      "WORK EXPERIENCE",
      "EXPERIENCE",
      "PROFESSIONAL EXPERIENCE",
      "PROJECT",
      "PROJECTS",
      "SKILLS",
      "SKILLS & INTERESTS",
      "AWARDS",
      "CERTIFICATIONS",
      "EXTRACURRICULAR",
      "VOLUNTEERING",
      "ACTIVITIES",
      "LEADERSHIP"
    ];

    return headers.some(header => upper === header || upper.includes(header));
  }

  function extractDates(line) {
    const match = line.match(
      /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4})\s*[-–]\s*(Present|Current|Now|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4}))/i
    );

    if (!match) {
      return {
        start_date: "",
        end_date: ""
      };
    }

    const parts = match[0].split(/[-–]/);

    return {
      start_date: parts[0]?.trim() || "",
      end_date: parts[1]?.trim() || ""
    };
  }

  function removeDates(line) {
    return line
      .replace(
        /((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4})\s*[-–]\s*(Present|Current|Now|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\.?\s*\d{4}))/i,
        ""
      )
      .trim();
  }

  function splitCommaList(value) {
    return String(value || "")
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(item => item.length > 1);
  }

  // ============================================================
  // Section detection
  // ============================================================

  function splitIntoSections(inputLines) {
    let current = "summary";

    const sections = {
      summary: [],
      education: [],
      experience: [],
      projects: [],
      skills: [],
      awards: []
    };

    inputLines.forEach(line => {
      const upper = line.toUpperCase();

      if (upper === "SUMMARY" || upper.includes("PROFILE")) {
        current = "summary";
        return;
      }

      if (upper.includes("EDUCATION")) {
        current = "education";
        return;
      }

      if (
        upper.includes("WORK EXPERIENCE") ||
        upper.includes("PROFESSIONAL EXPERIENCE") ||
        upper === "EXPERIENCE"
      ) {
        current = "experience";
        return;
      }

      if (upper === "PROJECT" || upper.includes("PROJECTS")) {
        current = "projects";
        return;
      }

      if (upper.includes("SKILLS")) {
        current = "skills";
        return;
      }

      if (
        upper.includes("AWARDS") ||
        upper.includes("CERTIFICATION") ||
        upper.includes("ACHIEVEMENT")
      ) {
        current = "awards";
        return;
      }

      sections[current].push(line);
    });

    return sections;
  }

  const sections = splitIntoSections(lines);

  // ============================================================
  // Education parser
  // ============================================================

  function parseEducation(sectionLines) {
    const results = [];
    let currentBlock = [];

    function isEducationStart(line) {
      return /University|College|Institute|School|Academy|Korea University|UniKL|Hanyang/i.test(line);
    }

    function processBlock(block) {
      if (!block.length) return;

      const blockText = block.join(" ");
      const dates = extractDates(blockText);

      const schoolMatch = blockText.match(
        /([A-Z][A-Za-z&.'’\-\s]{2,}(University|College|Institute|School|Academy|MIIT))/i
      );

      const degreeMatch = blockText.match(
        /(Bachelor|Master|PhD|Diploma|Foundation|Certificate|B\.S\.|BSc|M\.S\.|MSc)/i
      );

      const fieldMatch =
        blockText.match(/(?:in|of)\s+([A-Za-z\s&]+?)(?:,|\||\.|CGPA|GPA|Result|\d{4}|$)/i) ||
        blockText.match(/Data Science|Computer Science|Information Technology|Software Engineering|Business|Marketing/i);

      const gpaMatch =
        blockText.match(/(?:GPA|CGPA|Result)\s*[:\-]?\s*(\d\.\d{1,2}(?:\/\d\.\d{1,2})?)/i) ||
        blockText.match(/(\d\.\d{1,2}\/\d\.\d{1,2})/);

      const school = schoolMatch ? schoolMatch[0].trim() : block[0].trim();

      results.push({
        school,
        degree: degreeMatch ? degreeMatch[0].trim() : "",
        field: fieldMatch ? (fieldMatch[1] || fieldMatch[0]).trim() : "",
        start_date: dates.start_date,
        end_date: dates.end_date,
        gpa: gpaMatch ? (gpaMatch[1] || "").trim() : ""
      });
    }

    sectionLines.forEach(line => {
      if (isEducationStart(line) && currentBlock.length) {
        processBlock(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    });

    processBlock(currentBlock);

    return results.filter(item => item.school && item.school.length > 2);
  }

  // ============================================================
  // Experience parser
  // ============================================================

  function parseExperience(sectionLines) {
    const results = [];
    let current = null;

    function pushCurrent() {
      if (!current) return;

      const hasContent =
        current.role ||
        current.company ||
        current.bullets.length > 0;

      if (hasContent) {
        results.push(current);
      }
    }

    sectionLines.forEach(line => {
      if (!line || isLikelySectionHeader(line)) return;

      if (isBullet(line)) {
        if (!current) {
          current = {
            company: "",
            role: "Experience",
            start_date: "",
            end_date: "",
            bullets: []
          };
        }

        current.bullets.push(cleanBullet(line));
        return;
      }

      const dates = extractDates(line);
      const titleLine = removeDates(line);

      const looksLikeTitle =
        titleLine.length > 2 &&
        !titleLine.includes("@") &&
        !/^skills/i.test(titleLine);

      if (looksLikeTitle) {
        pushCurrent();

        let role = titleLine;
        let company = "";

        if (titleLine.includes(" - ")) {
          const parts = titleLine.split(" - ");
          role = parts[0].trim();
          company = parts.slice(1).join(" - ").trim();
        } else if (titleLine.includes("|")) {
          const parts = titleLine.split("|");
          role = parts[0].trim();
          company = parts[1]?.trim() || "";
        } else if (titleLine.includes(",")) {
          const parts = titleLine.split(",");
          role = parts[0].trim();
          company = parts[1]?.trim() || "";
        }

        current = {
          company,
          role,
          start_date: dates.start_date,
          end_date: dates.end_date,
          bullets: []
        };
      }
    });

    pushCurrent();

    return results
      .map(item => ({
        ...item,
        bullets: item.bullets.filter(bullet => bullet.length > 2)
      }))
      .filter(item => item.role.length > 1 || item.bullets.length > 0);
  }

  // ============================================================
  // Project parser
  // ============================================================

  function parseProjects(sectionLines) {
    const results = [];
    let current = null;

    function pushCurrent() {
      if (!current) return;

      if (current.name || current.bullets.length > 0) {
        results.push(current);
      }
    }

    sectionLines.forEach(line => {
      if (!line || isLikelySectionHeader(line)) return;

      if (isBullet(line)) {
        if (!current) {
          current = {
            name: "Project",
            start_date: "",
            end_date: "",
            technologies: [],
            bullets: []
          };
        }

        const bullet = cleanBullet(line);
        current.bullets.push(bullet);

        const techMatches = bullet.match(
          /\b(Python|Java|JavaScript|TypeScript|React|Next\.js|FastAPI|Flask|Django|SQL|MySQL|PostgreSQL|MongoDB|Docker|Azure|OpenAI|PyTorch|TensorFlow|scikit-learn|Pandas|NumPy|Excel|Power BI|Tableau|Git)\b/gi
        );

        if (techMatches) {
          current.technologies.push(...techMatches);
          current.technologies = [...new Set(current.technologies)];
        }

        return;
      }

      const dates = extractDates(line);
      const name = removeDates(line);

      if (name.length > 2) {
        pushCurrent();

        current = {
          name,
          start_date: dates.start_date,
          end_date: dates.end_date,
          technologies: [],
          bullets: []
        };
      }
    });

    pushCurrent();

    return results
      .map(item => ({
        ...item,
        technologies: [...new Set(item.technologies)],
        bullets: item.bullets.filter(bullet => bullet.length > 2)
      }))
      .filter(item => item.name && item.name.length > 2);
  }

  // ============================================================
  // Skills parser
  // ============================================================

  function parseSkills(allLines, skillsSectionLines) {
    let skills = [];

    const commonSkillPattern =
      /\b(Python|Java|JavaScript|TypeScript|React|Next\.js|Node\.js|Express|FastAPI|Flask|Django|SQL|MySQL|PostgreSQL|MongoDB|Docker|Git|GitHub|Azure|OpenAI|Machine Learning|Deep Learning|NLP|Pandas|NumPy|scikit-learn|PyTorch|TensorFlow|Excel|Power BI|Tableau|HTML|CSS|Tailwind|Linux|Firebase|REST API|API)\b/gi;

    const combinedSkillsText = skillsSectionLines.join(" ");
    const matchedSkills = combinedSkillsText.match(commonSkillPattern);

    if (matchedSkills) {
      skills.push(...matchedSkills);
    }

    skillsSectionLines.forEach(line => {
      const cleaned = line
        .replace(/skills\s*:*/i, "")
        .replace(/languages\s*:*/i, "")
        .replace(/hobbies\s*:*/i, "")
        .replace(/\(.*?\)/g, "");

      skills.push(...splitCommaList(cleaned));
    });

    skills = skills
      .map(skill => skill.replace(/^[•·\-–]\s*/, "").trim())
      .filter(skill => {
        if (!skill) return false;
        if (skill.length > 35) return false;
        if (/language|hobbies|interest|native|fluent|conversational/i.test(skill)) return false;
        if (/^\d+$/.test(skill)) return false;
        return true;
      });

    return [...new Set(skills)];
  }

  // ============================================================
  // Awards parser
  // ============================================================

  function parseAwards(sectionLines) {
    return sectionLines
      .filter(line => line && !isLikelySectionHeader(line))
      .map(line => ({
        title: cleanBullet(line),
        issuer: "",
        date: "",
        bullets: []
      }))
      .filter(item => item.title.length > 2);
  }

  // ============================================================
  // Final output
  // This structure matches FastAPI ResumeInput.
  // ============================================================

  return {
    target_role: "Data Analyst",
    target_level: "Entry-level",

    name: cleanName(extractName(cleanedText)),
    email: extractEmail(cleanedText),
    phone: extractPhone(cleanedText),
    address: null,
    summary: sections.summary.join(" "),

    education: parseEducation(sections.education),
    experience: parseExperience(sections.experience),
    projects: parseProjects(sections.projects),
    skills: parseSkills(lines, sections.skills),
    awards: parseAwards(sections.awards)
  };
}