# Reeracify: A Hybrid Agentic AI System for Resume Evaluation and Improvement

This project uses a hybrid resume evaluation pipeline made of three main parts:

1. Rule-based scoring layer
2. Evaluation Agent
3. Rewrite Agent

The reason for using this hybrid design is that resume evaluation requires both objective checks and contextual judgment. Some resume problems can be counted directly, such as missing sections, missing keywords, or weak phrases. However, other problems require deeper understanding, such as whether a project is strong enough for the target role, whether a bullet sounds vague, or whether the resume is competitive for the selected career level.

## 1. Rule-Based Scoring Layer

The rule-based scoring layer performs deterministic checks using fixed rules. 

This layer checks:

1. Section presence
   - Checks whether the resume includes important sections such as education, experience, projects, and skills.
   - This is important because ATS-friendly resumes should be clearly structured.

2. Experience bullet count
   - Counts how many bullet points exist under the experience section.
   - This helps estimate whether the resume provides enough evidence of work or activity.

3. Project count
   - Counts the number of projects in the resume.
   - This is especially useful for entry-level candidates who may not have much professional experience.

4. Project bullet count
   - Counts how many bullet points exist under project sections.
   - This helps check whether the user explains what they actually built, analyzed, or contributed.

5. Keyword matching
   - Compares the resume text with expected keywords for the selected target role and target level.
   - Example keywords for a Data Analyst role may include Python, SQL, Excel, Tableau, dashboard, statistics, and data analysis.

6. Measurable evidence detection
   - Checks whether bullets include numbers, percentages, or measurable results.
   - Example: “analyzed 10,000 rows”, “improved accuracy by 15%”, or “created 3 dashboards”.
   - This is important because stronger resumes usually show evidence of impact.

7. Weak phrase detection
   - Detects vague or passive phrases such as “responsible for”, “helped with”, “worked on”, and “participated in”.
   - These phrases are not always wrong, but they often make resume bullets sound less active or less specific.

8. Grammar/spelling signal
   - The local grammar checker can be used as a supporting signal to detect grammar, spelling, and some style issues.
   - This is not treated as a perfect grammar judge because rule-based grammar checkers may miss context-dependent errors.

9. ATS score calculation
   - Combines the rule-based signals into an ATS score percentage.
   - The score is intentionally simple and easy to tune for an MVP.

The rule-based layer is useful because it is explainable, fast, and transparent. It shows exactly why a resume gained or lost points. For example, if the score is low because many keywords are missing or because the resume has no measurable evidence, the system can clearly show that reason to the user.

However, rule-based scoring has limitations. It can detect whether a keyword exists, but it cannot always understand whether the keyword is used meaningfully. A resume could include many keywords but still have weak bullet points. For example, a bullet like “Used Python, SQL, Excel, Tableau, dashboard, data analysis” may score well for keywords, but it does not clearly explain what the candidate actually did or achieved.

Because of this limitation, rule-based scoring alone is not enough for the project.

## 2. Evaluation Agent

The Evaluation Agent is used to provide contextual resume judgment. It reads the structured resume JSON, the selected target role, the selected target level, and the rule-based scoring output. Then it evaluates whether the resume is competitive for that specific role and level.

The Evaluation Agent outputs:

1. Competitiveness category
   - The category is one of:
     - 하
     - 중
     - 상
   - This gives the user a simple and understandable competitiveness result.

2. Reasoning
   - Explains why the resume received that competitiveness category.
   - This helps the user understand the result instead of only seeing a score.

3. What stronger resumes usually have
   - Explains what high-quality resumes for the same role and level usually include.
   - This helps users compare their current resume with stronger examples.

4. Weak sections
   - Identifies weak resume sections such as experience, projects, skills, or education.
   - This helps users focus on the most important areas first.

5. Weak bullets
   - Identifies weak bullet points using bullet IDs such as exp_1_b2 or proj_1_b1.
   - This allows the frontend to highlight exactly which bullet needs improvement.

6. Improvement priorities
   - Gives the user a practical order of what to improve first.
   - This prevents the user from feeling overwhelmed by too many suggestions.

The Evaluation Agent is necessary because resume quality is not only about counting keywords or bullets. A strong resume also requires role alignment, clear impact, meaningful projects, appropriate skill depth, and professional wording. These qualities are difficult to judge with fixed rules only.

For example, the rule-based layer may detect that a bullet contains “Python” and “SQL”, but the Evaluation Agent can judge whether the bullet actually shows strong data analysis ability. It can recognize when a bullet is too vague, when a project lacks impact, or when the resume does not meet the expectations of an experienced-level role.

The Evaluation Agent also helps prevent keyword stuffing. If a user adds many keywords without meaningful context, the rule-based score may increase, but the Evaluation Agent can still identify that the resume lacks real evidence or strong achievements.

Therefore, the Evaluation Agent improves the system by adding human-like judgment and role-specific reasoning.

## 3. Rewrite Agent

The Rewrite Agent is used to turn feedback into practical improvement. After the system identifies a weak bullet, the Rewrite Agent generates improved bullet suggestions.

The Rewrite Agent receives:

1. Target role
2. Target level
3. Selected bullet text
4. Weakness reason
5. Missing keywords if relevant
6. Grammar or spelling flags if relevant

The Rewrite Agent outputs 1 to 3 rewrite suggestions.

The Rewrite Agent follows these rules:

1. Preserve the original meaning
   - The rewritten bullet must stay faithful to what the user actually did.

2. Do not invent facts
   - The agent must not create fake numbers, fake tools, fake achievements, or fake impact.

3. Improve ATS wording
   - The rewrite should use clearer and more role-relevant language.

4. Improve action verbs
   - Weak phrases such as “responsible for” or “helped with” should be replaced with stronger verbs such as “coordinated”, “analyzed”, “built”, “created”, or “managed” when appropriate.

5. Fix grammar and spelling
   - The rewrite should correct grammar, tense, word form, and awkward phrasing.

6. Add measurable impact only when appropriate
   - The agent should not add numbers unless the original bullet already provides enough evidence.
   - If metrics are missing, the agent can suggest that the user add real metrics manually.

The Rewrite Agent is necessary because evaluation alone is not enough. If the system only says “this bullet is weak”, the user may not know how to fix it. The Rewrite Agent makes the system actionable by giving the user improved bullet examples that can be directly reviewed, edited, or accepted.

For example:

Original bullet:
“Responsible for making sales reports.”

Improved rewrite:
“Created weekly sales reports using Excel to summarize revenue trends and support team decision-making.”

This rewrite is stronger because it uses an action verb, explains the task more clearly, improves professional wording, and keeps the original meaning without inventing fake numbers.

The Rewrite Agent helps users learn how to write stronger resume bullets instead of only receiving a score.

## Why This Project Uses Both Rule-Based Scoring and Agents

This project does not rely only on rules or only on an LLM. It combines both because each approach has different strengths.

Rule-based scoring is strong because:

1. It is transparent.
2. It is consistent.
3. It is easy to explain.
4. It is easy to tune.
5. It works well for ATS-style checks such as keywords, sections, bullet counts, and measurable evidence.

However, rule-based scoring is limited because:

1. It cannot deeply judge bullet quality.
2. It cannot fully understand role alignment.
3. It may reward keyword stuffing.
4. It cannot always tell whether a project is impressive or too simple.
5. It cannot provide strong contextual feedback by itself.

The Evaluation Agent is strong because:

1. It understands context.
2. It can judge resume competitiveness.
3. It can identify vague but keyword-rich bullets.
4. It can explain what stronger resumes usually have.
5. It can prioritize improvements based on the target role and level.

However, the Evaluation Agent alone is not ideal because:

1. It is less deterministic than fixed rules.
2. It may be harder to explain how every point was calculated.
3. It may be more expensive to use for every small check.
4. It may be less consistent than rule-based scoring for simple ATS signals.

The Rewrite Agent is strong because:

1. It turns feedback into usable improvements.
2. It helps users fix weak bullets directly.
3. It improves action verbs and ATS wording.
4. It fixes grammar and awkward phrasing.
5. It preserves the original meaning while improving professionalism.

Together, these three parts create a more useful resume improvement system.

The rule-based layer provides explainable ATS-style signals. The Evaluation Agent interprets those signals and judges overall competitiveness. The Rewrite Agent helps the user take action by improving specific weak bullets.

## Final Justification

The goal of this project is not only to calculate a resume score. The goal is to help users understand how competitive their resume is and how to improve it.

A purely rule-based system would be explainable but too shallow. It could count keywords and sections, but it would struggle to judge whether the resume is truly strong for the selected role.

A purely LLM-based system would be more flexible, but it would be less transparent and harder to explain. Users may not know why they received a certain score.

Therefore, this project uses a hybrid approach.

The rule-based scoring layer gives transparent and measurable ATS signals. The Evaluation Agent provides role-aware competitiveness judgment using the categories 하, 중, and 상. The Rewrite Agent gives practical bullet-level improvements that preserve the user’s original meaning and avoid hallucinated achievements.

## Repo Structure

```text
backend/
├── requirements.txt                        # Python packages needed to run the backend
├── test_rule_scoring.py                    # Test script for original rule scoring + public LanguageTool API
├── test_rule_scoring_language_tool.py      # Test script for rule scoring + local language-tool-python
├── app/
│   ├── main.py                             # FastAPI endpoints: /evaluate, /rewrite, /reevaluate
│   ├── rule_scoring.py                     # Rule-based ATS scoring using CSV rubric + public LanguageTool API
│   ├── rule_scoring_language_tool.py       # Rule-based ATS scoring using local language-tool-python
│   ├── evaluation_agent.py                 # LLM Evaluation Agent for competitiveness category and weak areas
│   ├── rewrite_agent.py                    # LLM Rewrite Agent for selected bullet improvement
│   └── .env                                # Azure OpenAI keys and optional LanguageTool URL, not pushed to GitHub
├── config/
│   ├── role_level_rubrics.csv              # Editable role/level ATS rubric, keywords, and scoring thresholds
│   └── weak_phrases.csv                    # Editable weak/vague phrases to flag in resume bullets
└── examples/
    └── sample_resume.json                  # Dummy structured resume used for local testing
    └── sample_resume_wrong_grammar.json    # Dummy incorrect grammar structured resume used for local testing
```

## Install Package

```bash
pip install fastapi uvicorn python-dotenv requests openai
```

- Run

```bash
uvicorn app.main:app --reload
```

## Supported Target Roles and Levels

```bash
# Data / Software
Data Analyst:
  - Entry-level
  - Experienced

Backend Developer:
  - Entry-level
  - Experienced

# Marketing
Marketing Associate:
  - Entry-level
  - Experienced

Digital Marketing Specialist:
  - Entry-level
  - Experienced

# IT
IT Support Specialist:
  - Entry-level
  - Experienced

System Administrator:
  - Entry-level
  - Experienced

# Admin / Operations
Administrative Assistant:
  - Entry-level
  - Experienced

Operations Coordinator:
  - Entry-level
  - Experienced

Human Resources Assistant:
  - Entry-level
  - Experienced

Project Coordinator:
  - Entry-level
  - Experienced

Customer Success Associate:
  - Entry-level
  - Experienced

```

## Experiment 1: Rule based scoring using public API Language Tool

- Using https://dev.languagetool.org/public-http-api

```bash
{
  "rewrite_suggestions": [
    {
      "suggestion": "Coordinated student communication and community updates to improve information sharing across international student groups.",
      "why_it_is_better": "Uses a stronger action verb and clearer professional wording.",
      "caution": "Add real metrics only if you can verify them."
    }
  ]
}
```

- Output

```bash
==============================
ATS SCORE
==============================
68

==============================
RUBRIC USED
==============================
{'expected_keywords': ['python',
                       'sql',
                       'excel',
                       'tableau',
                       'power bi',
                       'data analysis',
                       'visualization',
                       'statistics',
                       'dashboard',
                       'pandas'],
 'expected_skills': ['python', 'sql', 'excel', 'tableau', 'power bi'],
 'notes': 'Entry-level data analyst resumes should show tools, projects, '
          'dashboards, and measurable analysis outcomes.',
 'preferred_min_experience_bullets': 3,
 'preferred_min_project_bullets': 2,
 'preferred_min_projects': 2,
 'target_level': 'Entry-level',
 'target_role': 'Data Analyst'}

==============================
SECTION PRESENCE
==============================
{'education': True, 'experience': True, 'projects': True, 'skills': True}

==============================
BULLET COUNTS
==============================
Experience bullet count: 7
Project count: 3
Project bullet count: 9

==============================
KEYWORD RESULT
==============================
{'missing_keywords': [],
 'present_keywords': ['python',
                      'sql',
                      'excel',
                      'tableau',
                      'power bi',
                      'data analysis',
                      'visualization',
                      'statistics',
                      'dashboard',
                      'pandas']}

==============================
MEASURABLE EVIDENCE
==============================
{'bullets_with_metrics': ['exp_1_b1',
                          'exp_1_b3',
                          'exp_2_b1',
                          'exp_2_b2',
                          'proj_1_b1',
                          'proj_3_b1'],
 'bullets_without_metrics': ['exp_1_b2',
                             'exp_1_b4',
                             'exp_2_b3',
                             'proj_1_b2',
                             'proj_1_b3',
                             'proj_2_b1',
                             'proj_2_b2',
                             'proj_2_b3',
                             'proj_3_b2',
                             'proj_3_b3'],
 'metric_bullet_count': 6}

==============================
WEAK PHRASE FLAGS
==============================
[{'id': 'exp_1_b4',
  'reason': "Uses weak phrase: 'helped manage'",
  'text': 'Prepared weekly data summaries that helped managers track '
          'slow-moving inventory and seasonal demand patterns.',
  'weak_phrase': 'helped manage'},
 {'id': 'exp_2_b2',
  'reason': "Uses weak phrase: 'used'",
  'text': 'Used Excel pivot tables to compare attendance trends across 8 '
          'career events.',
  'weak_phrase': 'used'},
 {'id': 'exp_2_b3',
  'reason': "Uses weak phrase: 'helped with'",
  'text': 'Helped with preparing monthly reports for staff meetings.',
  'weak_phrase': 'helped with'},
 {'id': 'proj_3_b1',
  'reason': "Uses weak phrase: 'handled'",
  'text': 'Cleaned survey data from 300+ student responses and handled missing '
          'values before analysis.',
  'weak_phrase': 'handled'}]

==============================
GRAMMAR FLAGS FROM LANGUAGETOOL
==============================
[]

```

- Problem: 
```bash
    - free version does have limitation → only check spelling ??
    - i deliberately did grammar mistakes → to identifies but not detected
    - this Language Tool also use API calls ?? redundant 
    - so maybe its better to ask evaluation agent to check grammar checker 
```

## Experiment 2: Rule based scoring using local Python Language Tool

- https://pypi.org/project/language_tool_python/

```bash 
# Local LanguageTool grammar checker wrapper
# Requires Java installed on your machine
# Took a long time to Download LanguageTool 6.8-SNAPSHOT for the first time 259MB
language-tool-python
```

- Running the second time 
```bash
export LTP_PATH="$HOME/.cache/language_tool_python"
```

- Output
```bash
==============================
ATS SCORE
==============================
63

==============================
RUBRIC USED
==============================
{'expected_keywords': ['python',
                       'sql',
                       'excel',
                       'tableau',
                       'power bi',
                       'data analysis',
                       'visualization',
                       'statistics',
                       'dashboard',
                       'pandas'],
 'expected_skills': ['python', 'sql', 'excel', 'tableau', 'power bi'],
 'notes': 'Entry-level data analyst resumes should show tools, projects, '
          'dashboards, and measurable analysis outcomes.',
 'preferred_min_experience_bullets': 3,
 'preferred_min_project_bullets': 2,
 'preferred_min_projects': 2,
 'target_level': 'Entry-level',
 'target_role': 'Data Analyst'}

==============================
SECTION PRESENCE
==============================
{'education': True, 'experience': True, 'projects': True, 'skills': True}

==============================
BULLET COUNTS
==============================
Experience bullet count: 7
Project count: 3
Project bullet count: 9

==============================
KEYWORD RESULT
==============================
{'missing_keywords': ['sql'],
 'present_keywords': ['python',
                      'excel',
                      'tableau',
                      'power bi',
                      'data analysis',
                      'visualization',
                      'statistics',
                      'dashboard',
                      'pandas']}

==============================
MEASURABLE EVIDENCE
==============================
{'bullets_with_metrics': ['exp_1_b1',
                          'exp_1_b3',
                          'exp_2_b1',
                          'exp_2_b2',
                          'proj_1_b1',
                          'proj_3_b1'],
 'bullets_without_metrics': ['exp_1_b2',
                             'exp_1_b4',
                             'exp_2_b3',
                             'proj_1_b2',
                             'proj_1_b3',
                             'proj_2_b1',
                             'proj_2_b2',
                             'proj_2_b3',
                             'proj_3_b2',
                             'proj_3_b3'],
 'metric_bullet_count': 6}

==============================
WEAK PHRASE FLAGS
==============================
[{'id': 'exp_1_b4',
  'reason': "Uses weak phrase: 'helped manage'",
  'text': 'Prepared weekly data summaries that helped managers track '
          'slow-moving inventory and seasonal demand patterns.',
  'weak_phrase': 'helped manage'},
 {'id': 'exp_2_b2',
  'reason': "Uses weak phrase: 'used'",
  'text': 'Used Excel pivot tables to compare attendance trends across 8 '
          'career events.',
  'weak_phrase': 'used'},
 {'id': 'exp_2_b3',
  'reason': "Uses weak phrase: 'helped with'",
  'text': 'Helped with preparing monthly reports for staff meetings.',
  'weak_phrase': 'helped with'},
 {'id': 'proj_3_b1',
  'reason': "Uses weak phrase: 'handled'",
  'text': 'Cleaned survey data from 300+ student responses and handled missing '
          'values before analysis.',
  'weak_phrase': 'handled'}]

==============================
GRAMMAR FLAGS FROM LOCAL LANGUAGETOOL
==============================
[{'id': 'exp_1_b1',
  'issue_count': 2,
  'issues': [{'category': 'TYPOS',
              'message': 'Possible spelling mistake. ‘Analyse’ is British '
                         'English.',
              'rule_id': 'MORFOLOGIK_RULE_EN_US',
              'short_message': '',
              'suggestions': ['Analyze']},
             {'category': 'TYPOS',
              'message': 'Possible spelling mistake found.',
              'rule_id': 'MORFOLOGIK_RULE_EN_US',
              'short_message': '',
              'suggestions': ['weekly']}],
  'text': 'Analyse weeekly sale data using Excel to identifies category-level '
          'revenue trends across 12 store location.'}]
```

### Local Grammar/Spelling Check with language-tool-python

The backend can use language-tool-python as a local grammar checker.
It runs LanguageTool locally through Java, so it avoids paid public API calls.

What language-tool-python checks:
1) Spelling
   Example: "recieve" → "receive"

2) Grammar
   Example: "He have experience" → "He has experience"

3) Subject-verb agreement
   Example: "The reports was completed" → "The reports were completed"

4) Article usage
   Example: "built a API" → "built an API"

5) Word form / awkward grammar
   Example: "to identifies trends" may be flagged, but not always

6) Casing and punctuation
   Example: lowercase proper nouns, missing punctuation, repeated punctuation

7) Style suggestions
    - Picky mode enables more detailed or stricter suggestions.
    - Example:
      - tool.picky = True

Important note:
language-tool-python is used as a supporting grammar signal only.
It may not catch every grammar mistake, so the Evaluation Agent also checks bullet clarity,
professionalism, and awkward wording.