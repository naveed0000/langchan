You are a senior Node.js/TypeScript backend engineer responsible for implementing the Question Rendering Pipeline.

Your task is to build a production-ready pipeline that converts every LaTeX placeholder inside a question into MathML using the existing MathJax conversion service.

The project already has a MathJax microservice that converts LaTeX → MathML.

DO NOT change the question schema stored in the database.

--------------------------------------------------
BACKGROUND
--------------------------------------------------

Questions are stored in the database with HTML fields.

Mathematical expressions are NOT embedded directly.

Instead, every mathematical expression is stored inside

latex: string[]

and referenced from HTML using placeholders.

Example:

Question

<p>Solve {{latex[0]}}</p>

Explanation

<p>Using {{latex[1]}}</p>

Hint

<p>Remember {{latex[2]}}</p>

Options

[
 {
   "name":"{{latex[3]}}",
   "isCorrect":true
 }
]

latex

[
 "x^2+5x+6=0",
 "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
 "a\\neq0",
 "\\sqrt{2}"
]

The client MUST NEVER receive placeholders.

The client must receive HTML containing MathML.

--------------------------------------------------
OBJECTIVE
--------------------------------------------------

Create a rendering layer that transforms

{{latex[index]}}

into

<math>...</math>

using the existing MathJax Batch API.

--------------------------------------------------
RULES
--------------------------------------------------

DO NOT modify the database.

DO NOT save MathML.

LaTeX remains the single source of truth.

MathML is generated dynamically.

Batch convert ALL expressions in one request.

Never call MathJax once per placeholder.

--------------------------------------------------
FIELDS TO PROCESS
--------------------------------------------------

Replace placeholders inside every HTML field.

Mandatory fields

question

explanation

hint

Every option.name

Any future HTML field

Do NOT process

role

difficultyLevel

optionType

images

subjectIds

chapterIds

topicIds

examCategoryIds

subjectCategoryIds

inputBox

latex

--------------------------------------------------
PLACEHOLDER FORMAT
--------------------------------------------------

Valid

{{latex[0]}}

{{latex[15]}}

{{latex[99]}}

Invalid

{{latex[-1]}}

{{latex[abc]}}

{{latex[1.2]}}

{{latex}}

{{latex []}}

{{Latex[0]}}

--------------------------------------------------
STEP 1
--------------------------------------------------

Read

question.latex

If latex array is empty

return original object unchanged.

--------------------------------------------------
STEP 2
--------------------------------------------------

Collect every expression.

Example

[
 "x^2",
 "\\frac{1}{2}",
 "\\sqrt{x}"
]

--------------------------------------------------
STEP 3
--------------------------------------------------

Call

POST /api/mathml/batch

Request

{
  "expressions":[...]
}

Receive

[
 {
   "latex":"x^2",
   "mathml":"<math>...</math>"
 }
]

--------------------------------------------------
STEP 4
--------------------------------------------------

Build lookup table

placeholder

↓

mathml

Example

{{latex[0]}}
↓

<math>...</math>

--------------------------------------------------
STEP 5
--------------------------------------------------

Replace placeholders inside HTML.

Example

Before

<p>Solve {{latex[0]}}</p>

After

<p>Solve
<math>...</math>
</p>

--------------------------------------------------
STEP 6
--------------------------------------------------

Return rendered object.

Do NOT include placeholder text.

--------------------------------------------------
ERROR HANDLING
--------------------------------------------------

If MathJax returns an error

Return

400

Invalid LaTeX

If placeholder index exceeds latex array

Example

{{latex[7]}}

latex contains only 3 items

Throw descriptive validation error.

Example

Placeholder index 7 does not exist.

If placeholder format is invalid

Throw validation error.

--------------------------------------------------
PERFORMANCE
--------------------------------------------------

Only ONE MathJax Batch API request per question.

Never perform N API requests.

Cache duplicate expressions inside the same question.

Example

latex

[
 "x^2",
 "x^2",
 "x^2"
]

Convert once.

Reuse three times.

--------------------------------------------------
HTML RULES
--------------------------------------------------

Preserve every HTML tag.

Never escape HTML.

Never remove formatting.

Only replace placeholders.

--------------------------------------------------
OUTPUT
--------------------------------------------------

Return

{
  question,
  explanation,
  hint,
  optionType,
  difficultyLevel,
  role,
  options,
  images,
  inputBox,
  subjectIds,
  subjectCategoryIds,
  chapterIds,
  topicIds,
  examCategoryIds
}

The latex array should NOT be returned to the frontend after rendering unless explicitly requested by the API.

--------------------------------------------------
CODE QUALITY
--------------------------------------------------

Use TypeScript.

Create reusable services.

Suggested architecture

QuestionRendererService

MathMLClient

PlaceholderParser

PlaceholderValidator

PlaceholderReplacer

Implement unit-testable functions.

Avoid duplicated logic.

Use async/await.

Handle failures gracefully.

Write clean, modular, production-ready code following SOLID principles.

--------------------------------------------------
SUCCESS CRITERIA
--------------------------------------------------

✓ Database remains unchanged

✓ LaTeX is the only persisted math format

✓ Exactly one batch MathJax request per question

✓ Duplicate LaTeX expressions are converted only once

✓ Every placeholder is replaced

✓ HTML structure is preserved

✓ Invalid placeholders are detected

✓ Invalid LaTeX is reported clearly

✓ Frontend receives HTML containing MathML with no remaining {{latex[index]}} placeholders