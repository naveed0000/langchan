1. DB ID resolution — replacing every "id": null in storage/initial.json with real subject/category/chapter/topic IDs. Blocked on you telling me where
those existing ID tables live.
    
    you have to read 
    
2. initial.json consumption logic — the "subtract as you go" behavior: nothing yet reads storage/initial.json, picks the next topic, or
marks/decrements it as questions get generated. It's currently just a static file sitting there.
    
    > Correct. `storage/initial.json` is **not** intended to be a static configuration file—it is the **persistent execution state** for the generation engine.
    > 
    > 
    > The implementation should:
    > 
    > 1. Load `storage/initial.json` when the generation process starts.
    > 2. Determine the next eligible topic based on the traversal rules.
    > 3. Reserve the next batch (e.g. 8 questions) from that topic.
    > 4. After a successful generation, decrement the topic's `remainingQuestions` by the batch size.
    > 5. Immediately persist the updated `initial.json` to disk.
    > 6. When `remainingQuestions` reaches `0`, mark the topic as `COMPLETED` and continue to the next topic.
    > 7. If the process stops or crashes, the next execution must resume from the persisted state rather than restarting from the beginning.
    > 
    > In other words, `initial.json` acts as a **checkpoint/state store**, not just an input file. Every successful batch must update it so the generator is resumable, deterministic, and never regenerates completed work.
    > 
3. error.json — the todo list names this specifically, but the detailed spec below it only describes error.log (JSONL). I built error.log per the
detailed spec; a separate error.json (if you actually want one, e.g. "last error" snapshot rather than an append-only log) is not built.
    
    > Good catch. The intention is to have **both** files, serving different purposes.
    > 
    > - **`error.log` (JSONL)** is the **append-only audit log**. Every error, retry failure, validation failure, or unexpected exception should be appended as a new JSON line. It provides the complete execution history for debugging and auditing.
    > - **`error.json`** is a **single-state snapshot** of the most recent error. It should always contain only the latest error information and be overwritten whenever a new error occurs. This file is intended for dashboards, monitoring, recovery logic, or quickly determining why the current or last execution failed without scanning the entire log.
    > 
    > **Expected behaviour:**
    > 
    > - On every error:
    >     1. Append the error to `error.log`.
    >     2. Overwrite `error.json` with the latest error snapshot.
    > 
    > A typical `error.json` structure could include:
    > 
    > ```json
    > error.log is appeded 
    > ```
    > 
    > If the current implementation only includes `error.log`, then the historical logging requirement has been met. Please add `error.json` as the latest-error snapshot so both requirements are fully satisfied.
    > 
4. Traversal flow — subject → category → chapter → topic walking, including "traverse the current topic 5 times first" before moving on. No code for
this yet.
    
    I'd answer Claude like this:
    
    ---
    
    Yes, this has changed with the move from n8n to LangGraph/LangChain.
    
    The traversal logic is **no longer a workflow concern**; it becomes the responsibility of the **Scheduler/State Manager**.
    
    The intended behaviour is:
    
    1. Read the current execution position from `state.json`.
    2. Resolve the current `subject → category → chapter → topic`.
    3. Allocate **5 batches** (`batchesPerExecution = 5`) for the current topic.
    4. After all 5 batches complete successfully, update `initial.json` by subtracting:
        - `batchSize × 5`
        - difficulty distribution × 5
        - question type distribution × 5
        - API calls − 5
    5. Persist both `initial.json` and `state.json`.
    6. If the current topic's `questioncount` reaches `0`, advance the traversal to the next topic. If there are no more topics, advance to the next chapter, then category, then subject in order.
    7. If the process stops before all 5 batches finish, do **not** advance the traversal. Resume from the same topic on the next execution using the persisted state.
    
    The code you've shown already implements the **state mutation and traversal advancement** after five completed batches. What remains is integrating it into the LangGraph execution flow:
    
    - A **Scheduler Node** reads `state.json`.
    - It creates **5 generation tasks** for the current topic.
    - A **Worker Pool** executes those tasks concurrently.
    - The scheduler waits until all workers complete successfully.
    - Only then does it execute the state update logic you've shown and persist the files.
    - Finally, the scheduler dispatches the next topic.
    
    In other words, the traversal algorithm itself is correct; the missing piece is wiring it into the LangGraph orchestration so that it is executed by the scheduler after the worker pool completes, rather than existing as standalone update logic.
    
5. The 5-worker pool — nothing calls the LLM concurrently, assigns batches to workers, or builds the per-call request object (the
generation/subject/category/chapter/topic/subtopics/distribution/responseschema JSON shown in the doc). This is the actual question-generation loop —
doesn't exist yet.
    
    
    A senior engineer response would be:
    
    > Correct. The worker pool implementation is still pending, but the request contract is already defined. The JSON payload you've shared becomes the **canonical request object** that every worker must construct before invoking the LLM. It encapsulates the execution context (generation settings, hierarchy, topic, subtopics, distribution, and response schema) and is sufficient to generate a single batch of questions. This is consistent with the current prompt/request builder already implemented in the existing n8n workflow.
    > 
    > 
    > **Expected implementation:**
    > 
    > 1. The **Scheduler** reads the current execution state from `state.json` and `initial.json`.
    > 2. It allocates up to **5 batches** for the current topic (or fewer if fewer batches remain).
    > 3. For each batch, it builds a request object using the current subject, category, chapter, topic, subtopics, distribution, and response schema.
    > 4. Each request is assigned to an available worker in the pool.
    > 5. Workers execute the LLM call independently, validate the response, and persist the generated questions.
    > 6. After all assigned workers complete successfully, the scheduler updates `initial.json` and `state.json`, then allocates the next set of batches.
    > 
    > The worker itself should remain generic:
    > 
    > - Accept a request object.
    > - Execute the configured LLM provider.
    > - Return validated questions or a structured error.
    > 
    > It must **not** contain scheduling, traversal, or state-management logic.
    > 
    > The scheduler remains the single source of truth for:
    > 
    > - work allocation
    > - concurrency control
    > - rate-limit enforcement
    > - retry policy
    > - provider failover
    > - state persistence
    > 
    > This separation of concerns keeps the worker pool stateless and reusable while allowing the scheduler to evolve independently (e.g., different batch sizes, worker counts, or LLM providers) without modifying worker logic.bleow we have code snippet and prompt as which you have to give to llm using state.json and initial.json
    > 
    > ```json
    > const item = $input.first().json;
    > 
    > const {
    >   categoryId,
    >   categoryName,
    >   chapterId,
    >   chapterName,
    >   topicId,
    >   topicName,
    >   subtopicsName = [],
    >   optionType,
    >   difficultyLevel,
    >   questionNumber = 6,
    >   perbatchdistribution,
    >   responseSchema = {}
    > } = item;
    > 
    > console.log("item", item);
    > 
    > // Extract the distribution from the new JSON format
    > const questionTypeDistribution = optionType;
    > const difficultyDistribution = difficultyLevel;
    > 
    > const systemPrompt = `
    > You are an expert JEE Main Physics question setter, examiner, and psychometric analyst.
    > 
    > Generate EXACTLY ${questionNumber} unique JEE Main Physics questions.
    > 
    > ═══════════════════════════════════════
    > CONTEXT
    > ═══════════════════════════════════════
    > 
    > Category: ${categoryName}
    > Chapter: ${chapterName}
    > Topic: ${topicName}
    > 
    > Subtopics:
    > ${subtopicsName.join("\n")}
    > 
    > ═══════════════════════════════════════
    > QUESTION DISTRIBUTION
    > ═══════════════════════════════════════
    > 
    > You must generate EXACTLY:
    > 
    > By Difficulty:
    > - ${difficultyDistribution.easy} easy questions
    > - ${difficultyDistribution.moderate} moderate questions
    > - ${difficultyDistribution.hard} hard questions
    > 
    > By Question Type:
    > - ${questionTypeDistribution.single} Single Choice questions (exactly 4 options, 1 correct)
    > - ${questionTypeDistribution.multiple} Multiple Choice questions (exactly 4 options, 1+ correct)
    > - ${questionTypeDistribution.numerical} Numerical questions (numeric answer)
    > 
    > Total: ${questionNumber} questions
    > 
    > ═══════════════════════════════════════
    > QUESTION REQUIREMENTS
    > ═══════════════════════════════════════
    > 
    > 1. Generate EXACTLY ${questionNumber} questions with the exact distribution specified above.
    > 2. Use ONLY the provided subtopics.
    > 3. Follow JEE Main standards strictly.
    > 4. Questions must test conceptual understanding, not rote memorization.
    > 5. Avoid duplicate concepts, formulas, numerical values, and question patterns.
    > 6. Use realistic Physics values and units.
    > 7. Explanation must clearly justify the correct answer step-by-step.
    > 8. Never reveal chain-of-thought reasoning.
    > 9. Output ONLY valid JSON. Do NOT wrap output in markdown or code fences.
    > 10. Every question must belong to Category: ${categoryName}, Chapter: ${chapterName}, Topic: ${topicName}.
    > 11. Tag each question with the correct difficulty and type according to the distribution.
    > 
    > ═══════════════════════════════════════
    > QUESTION TYPE RULES
    > ═══════════════════════════════════════
    > 
    > Single:
    > - Exactly 4 options
    > - Exactly 1 correct option (isCorrect: true)
    > - optionType: "Single"
    > 
    > Multiple:
    > - Exactly 4 options
    > - One or more correct options
    > - optionType: "Multiple"
    > 
    > Numerical:
    > - No options array
    > - optionType: "Numerical"
    > - inputbox must be an empty string ""
    > - Answer must be a numeric value
    > 
    > ═══════════════════════════════════════
    > HTML RULES
    > ═══════════════════════════════════════
    > 
    > Allowed tags ONLY: <p> <b> <i> <sub> <sup>
    > 
    > FORBIDDEN tags: <div> <table> <style> <script> <svg> <span> <br> <ul> <li> <ol>
    > 
    > Do NOT use Unicode math symbols anywhere:
    >   WRONG: ×, ÷, →, ←, ≤, ≥, ≠, α, β, γ, ², ³, √, ∞, Δ, θ, π, μ, ω, λ
    >   RIGHT: Use {{latex[n]}} placeholder instead
    > 
    > Do NOT use superscripts or subscripts as plain HTML for math:
    >   WRONG: v<sup>2</sup>  OR  x<sub>0</sub>
    >   RIGHT: {{latex[n]}} where latex[n] = "v^{2}"  OR  "x_{0}"
    > 
    > ═══════════════════════════════════════
    > MATH TOKENIZATION — CRITICAL RULES
    > ═══════════════════════════════════════
    > 
    > RULE 1 — EXTRACT ALL MATH TO LATEX ARRAY
    > Every mathematical expression MUST be extracted into the top-level "latex" array.
    > Replace it in question/explanation/hint/options with {{latex[n]}}.
    > 
    > RULE 2 — NEVER EMBED MATH IN HTML
    > NEVER write math directly inside question, explanation, hint, or options[].name.
    > 
    > RULE 3 — VALID JSON ESCAPING (MOST COMMON BUG)
    > LaTeX backslashes MUST be double-escaped in JSON strings.
    >   WRONG (breaks JSON):  "\\frac{1}{2}mv^{2}"   ← single backslash
    >   CORRECT:              "\\\\frac{1}{2}mv^{2}"  ← double backslash
    > 
    > Wait — in a JSON string value, a single LaTeX backslash becomes two characters: \\ 
    > So in the raw JSON you write:
    >   "latex": ["\\frac{1}{2}mv^{2}"]
    > Which represents the LaTeX string: \frac{1}{2}mv^{2}  ✓
    > 
    > RULE 4 — LATEX SYNTAX MUST BE VALID
    > Use standard LaTeX. Every command must use correct syntax:
    > 
    > Fractions:        \\frac{numerator}{denominator}
    > Square root:      \\sqrt{expression}
    > Nth root:         \\sqrt[n]{expression}
    > Powers:           x^{2}  OR  x^{10}   (always use braces for multi-char exponents)
    > Subscripts:       x_{0}  OR  v_{max}  (always use braces)
    > Greek letters:    \\alpha  \\beta  \\gamma  \\delta  \\theta  \\phi  \\omega  \\lambda  \\mu  \\pi  \\eta  \\rho  \\sigma
    > Vectors:          \\vec{F}  OR  \\hat{n}
    > Absolute value:   |x|  OR  \\left|x\\right|
    > Parentheses:      \\left( ... \\right)
    > Brackets:         \\left[ ... \\right]
    > Multiplication:   \\times  OR  \\cdot
    > Division:         \\div
    > Arrows:           \\rightarrow  \\leftarrow  \\Rightarrow
    > Approx:           \\approx
    > Not equal:        \\neq
    > Less/greater:     \\leq  \\geq
    > Infinity:         \\infty
    > Integral:         \\int_{a}^{b} f(x)\\,dx
    > Sum:              \\sum_{i=1}^{n}
    > Partial:          \\frac{\\partial f}{\\partial x}
    > Proportional:     \\propto
    > Degree symbol:    30^{\\circ}
    > Units in math:    \\text{m/s}  OR  \\mathrm{kg}
    > Scientific nota:  3.0 \\times 10^{8}
    > 
    > RULE 5 — PHYSICS UNIT FORMATTING
    > Units that appear inside equations must be in \\text{} or \\mathrm{}:
    >   CORRECT: "v = 3.0 \\times 10^{8} \\text{ m/s}"
    >   CORRECT: "F = 10 \\text{ N}"
    > 
    > Units that appear as plain text in HTML do NOT need tokenization:
    >   CORRECT in HTML: <p>A force of 10 N acts on...</p>
    > 
    > RULE 6 — DEDUPLICATION
    > If the same mathematical expression appears more than once across question, explanation, hint, and options, reuse the SAME placeholder index.
    >   WRONG: latex[3] = "mv^{2}" and latex[7] = "mv^{2}"  ← duplicate
    >   RIGHT: both use {{latex[3]}}
    > 
    > RULE 7 — ORDERED BY FIRST APPEARANCE
    > The latex array must be ordered by the first appearance of each expression in this order:
    >   question → options → hint → explanation
    > 
    > RULE 8 — EVERY OBJECT MUST HAVE LATEX KEY
    > Every question object must include "latex": []
    > If a question has no math at all, use "latex": []
    > 
    > RULE 9 — PLACEHOLDER FORMAT
    > Placeholders are always: {{latex[0]}}  {{latex[1]}}  {{latex[2]}} etc.
    > Index must be a valid integer referencing an existing entry in the latex array.
    > No placeholder may reference an index that doesn't exist.
    > 
    > RULE 10 — WHAT COUNTS AS MATH (must be tokenized)
    > - Any equation, formula, or expression
    > - Fractions, roots, powers, subscripts
    > - Greek letters (α β γ θ etc.)
    > - Vectors, unit vectors
    > - Trigonometric expressions: sin, cos, tan, sin²θ etc.
    > - Logarithms: log, ln, log₁₀
    > - Scientific notation: 3×10⁸
    > - Dimensional formulas: [MLT⁻²]
    > - Physics symbols in equations: F, v, a, E, B, etc. when part of an expression
    > - Coordinates: (x₁, y₁)
    > - Matrices and determinants
    > - Inequalities with symbols
    > - Integrals, derivatives, partial derivatives
    > - Anything with ², ³, √, Δ, ∑, ∫
    > 
    > RULE 11 — WHAT DOES NOT NEED TOKENIZATION
    > - Plain integers or decimals used as text: "A rod of length 5 m"
    > - Named quantities in text: "A particle of mass m moves..."  ← 'm' here is text
    > - Numbered lists or answer choices as plain letters: A, B, C, D
    > 
    > RULE 12 — LATEX MUST CONTAIN ONLY MATHEMATICS
    > Store only mathematical expressions in the latex array.
    > 
    > FORBIDDEN:
    > - \\text{(1)}, \\text{(2)}, equation numbers
    > - Labels, step numbers
    > - Explanatory text
    > - Sentences or words
    > 
    > WRONG:
    > "a+c=1 \\quad \\text{(1)}"
    > 
    > CORRECT:
    > "a+c=1"
    > 
    > RULE 13 — DIMENSIONS
    > Default: M, L, T notation without square brackets.
    > 
    > CORRECT:
    > "M^{-1}L^{3}T^{-2}"
    > 
    > ALLOWED ONLY IF REQUIRED BY THE QUESTION:
    > "[M^{-1}L^{3}T^{-2}]"
    > 
    > ═══════════════════════════════════════
    > EXAMPLES OF CORRECT LATEX IN JSON
    > ═══════════════════════════════════════
    > 
    > Example 1 — Kinematic equation:
    > "latex": [
    >   "v^{2} = u^{2} + 2as",
    >   "v",
    >   "u",
    >   "a",
    >   "s"
    > ]
    > 
    > Example 2 — Energy formula:
    > "latex": [
    >   "E = \\frac{1}{2}mv^{2}",
    >   "m",
    >   "v"
    > ]
    > 
    > Example 3 — Dimensional analysis:
    > "latex": [
    >   "[M^{1}L^{1}T^{-2}]",
    >   "[M^{0}L^{1}T^{-1}]",
    >   "F = \\frac{Gm_{1}m_{2}}{r^{2}}"
    > ]
    > 
    > Example 4 — Trigonometry:
    > "latex": [
    >   "\\sin^{2}\\theta + \\cos^{2}\\theta = 1",
    >   "\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}"
    > ]
    > 
    > Example 5 — Vectors:
    > "latex": [
    >   "\\vec{F} = m\\vec{a}",
    >   "\\vec{v} = \\vec{u} + \\vec{a}t"
    > ]
    > 
    > Example 6 — Fractions with Greek:
    > "latex": [
    >   "\\omega = \\frac{2\\pi}{T}",
    >   "T",
    >   "\\omega"
    > ]
    > 
    > Example 7 — Full question structure (Single):
    > {
    >   "question": "<p>A body of mass {{latex[0]}} moves with velocity {{latex[1]}}. Its kinetic energy is:</p>",
    >   "options": [
    >     { "name": "<p>{{latex[2]}}</p>", "isCorrect": false },
    >     { "name": "<p>{{latex[3]}}</p>", "isCorrect": true },
    >     { "name": "<p>{{latex[4]}}</p>", "isCorrect": false },
    >     { "name": "<p>{{latex[5]}}</p>", "isCorrect": false }
    >   ],
    >   "hint": "<p>Recall the formula for kinetic energy: {{latex[3]}}.</p>",
    >   "explanation": "<p>Kinetic energy is given by {{latex[3]}}. Substituting {{latex[0]}} and {{latex[1]}}, we get the result.</p>",
    >   "latex": [
    >     "m",
    >     "v",
    >     "\\frac{1}{4}mv^{2}",
    >     "\\frac{1}{2}mv^{2}",
    >     "mv^{2}",
    >     "2mv^{2}"
    >   ],
    >   "optionType": "Single",
    >   "difficultyLevel": "easy"
    > }
    > 
    > Example 8 — Numerical question:
    > {
    >   "question": "<p>Calculate the value of {{latex[0]}} if {{latex[1]}}.</p>",
    >   "hint": "<p>Use the formula {{latex[2]}}.</p>",
    >   "explanation": "<p>Substituting the values gives {{latex[3]}}.</p>",
    >   "latex": [
    >     "g",
    >     "g = 9.8 \\text{ m/s}^{2}",
    >     "F = mg",
    >     "F = 98 \\text{ N}"
    >   ],
    >   "optionType": "Numerical",
    >   "difficultyLevel": "moderate",
    >   "inputbox": ""
    > }
    > 
    > ═══════════════════════════════════════
    > FINAL VALIDATION CHECKLIST
    > ═══════════════════════════════════════
    > 
    > Before outputting, verify every question:
    > 
    > [ ] Array length is EXACTLY ${questionNumber}
    > [ ] Distribution matches: ${difficultyDistribution.easy} easy, ${difficultyDistribution.moderate} moderate, ${difficultyDistribution.hard} hard
    > [ ] Distribution matches: ${questionTypeDistribution.single} single, ${questionTypeDistribution.multiple} multiple, ${questionTypeDistribution.numerical} numerical
    > [ ] JSON is valid and parseable
    > [ ] All questions are unique
    > [ ] All match Category, Chapter, Topic
    > [ ] Every question has: question, explanation, hint, options/answer, latex, images, subjectIds, subjectCategoryIds, chapterIds, topicIds, examCategoryIds
    > [ ] Every {{latex[n]}} references a valid index in the latex array
    > [ ] No math is written directly in question/explanation/hint/options HTML
    > [ ] latex array contains ONLY valid LaTeX strings with double-escaped backslashes
    > [ ] No Unicode math symbols (×, →, ², α, etc.) appear anywhere in HTML
    > [ ] Duplicate expressions reuse the same placeholder index
    > [ ] latex array is ordered by first appearance
    > [ ] Every question contains "role": "admin"
    > [ ] Numerical questions contain inputbox as an empty string
    > [ ] Single/Multiple questions contain options array with exactly 4 options
    > • Same derivation
    > • Same numerical values
    > • Same physical situation
    > • Same formula application
    > • Same reasoning
    > 
    > Return ONLY a valid JSON array. No markdown. No code fences. No explanation text.
    > `;
    > 
    > // Create a flexible output schema that can handle different question types
    > const createOutputSchema = (type, difficulty) => {
    >   const baseSchema = {
    >     question: "<p>Question HTML</p>",
    >     explanation: "<p>Explanation HTML</p>",
    >     hint: "<p>Hint HTML</p>",
    >     optionType: type,
    >     difficultyLevel: difficulty,
    >     role: "admin",
    >     ...(type === "Numerical"
    >       ? { inputbox: "" }
    >       : {
    >           options: [
    >             {
    >               name: "Option A",
    >               isCorrect: false
    >             },
    >             {
    >               name: "Option B",
    >               isCorrect: true
    >             },
    >             {
    >               name: "Option C",
    >               isCorrect: false
    >             },
    >             {
    >               name: "Option D",
    >               isCorrect: false
    >             }
    >           ]
    >         }),
    >     images: [],
    >     subjectIds: [1],
    >     subjectCategoryIds: [categoryId],
    >     chapterIds: [chapterId],
    >     topicIds: [topicId],
    >     examCategoryIds: [1]
    >   };
    >   return baseSchema;
    > };
    > 
    > // Create a sample schema showing the mix
    > const sampleSchemas = [];
    > sampleSchemas.push(createOutputSchema("Single", "easy"));
    > sampleSchemas.push(createOutputSchema("Multiple", "moderate"));
    > sampleSchemas.push(createOutputSchema("Numerical", "hard"));
    > 
    > const requestBody = {
    >   systemInstruction: {
    >     parts: [
    >       {
    >         text: systemPrompt
    >       }
    >     ]
    >   },
    > 
    >   contents: [
    >     {
    >       parts: [
    >         {
    >           text: "EXAM INFORMATION"
    >         },
    >         {
    >           text: "Exam: JEE Main"
    >         },
    >         {
    >           text: "Subject: Physics"
    >         },
    >         {
    >           text: `Category: ${categoryName}`
    >         },
    >         {
    >           text: `Chapter: ${chapterName}`
    >         },
    >         {
    >           text: `Topic: ${topicName}`
    >         },
    >         {
    >           text: `SubTopics: ${subtopicsName.join(", ")}`
    >         }
    >       ]
    >     },
    > 
    >     {
    >       parts: [
    >         {
    >           text: "OUTPUT SCHEMA (Example showing mixed types)"
    >         },
    >         {
    >           text: JSON.stringify(sampleSchemas)
    >         }
    >       ]
    >     },
    > 
    >     {
    >       parts: [
    >         {
    >           text: `FINAL VALIDATION - Generate EXACTLY ${questionNumber} questions with this EXACT distribution:
    > 
    > Difficulty Distribution:
    > - ${difficultyDistribution.easy} easy questions
    > - ${difficultyDistribution.moderate} moderate questions  
    > - ${difficultyDistribution.hard} hard questions
    > 
    > Question Type Distribution:
    > - ${questionTypeDistribution.single} Single Choice questions
    > - ${questionTypeDistribution.multiple} Multiple Choice questions
    > - ${questionTypeDistribution.numerical} Numerical questions
    > 
    > Return ONLY a valid JSON array.
    > `
    >         }
    >       ]
    >     }
    >   ],
    > 
    >   "generationConfig": {
    >       "temperature": 0.8,
    >       "topP": 0.95,
    >       "candidateCount": 1,
    >       "maxOutputTokens": 20000,
    >       "responseMimeType": "application/json",
    >       "responseSchema": {
    >         "type": "ARRAY",
    >         "items": {
    >           "type": "OBJECT",
    >           "properties": {
    >             "question": {
    >               "type": "STRING"
    >             },
    >             "explanation": {
    >               "type": "STRING"
    >             },
    >             "hint": {
    >               "type": "STRING"
    >             },
    >             "optionType": {
    >               "type": "STRING",
    >               "enum": [
    >                 "Single",
    >                 "Multiple",
    >                 "Numerical"
    >               ]
    >             },
    >             "difficultyLevel": {
    >               "type": "STRING",
    >               "enum": [
    >                 "easy",
    >                 "moderate",
    >                 "hard"
    >               ]
    >             },
    >             "role": {
    >               "type": "STRING"
    >             },
    >             "latex": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "STRING"
    >               }
    >             },
    >             "options": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "OBJECT",
    >                 "properties": {
    >                   "name": {
    >                     "type": "STRING"
    >                   },
    >                   "isCorrect": {
    >                     "type": "BOOLEAN"
    >                   }
    >                 },
    >                 "required": [
    >                   "name",
    >                   "isCorrect"
    >                 ]
    >               }
    >             },
    >             "inputBox": {
    >               "type": "STRING"
    >             },
    >             "images": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "STRING"
    >               }
    >             },
    >             "subjectIds": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "INTEGER"
    >               }
    >             },
    >             "subjectCategoryIds": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "INTEGER"
    >               }
    >             },
    >             "chapterIds": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "INTEGER"
    >               }
    >             },
    >             "topicIds": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "INTEGER"
    >               }
    >             },
    >             "examCategoryIds": {
    >               "type": "ARRAY",
    >               "items": {
    >                 "type": "INTEGER"
    >               }
    >             }
    >           },
    >           "required": [
    >             "question",
    >             "explanation",
    >             "latex",
    >             "hint",
    >             "optionType",
    >             "difficultyLevel",
    >             "role",
    >             "images",
    >             "subjectIds",
    >             "subjectCategoryIds",
    >             "chapterIds",
    >             "topicIds",
    >             "examCategoryIds"
    >           ]
    >         }
    >       }
    >     }
    > };
    > 
    > console.log("requestBody", requestBody);
    > return [
    >   {
    >     json: requestBody
    >   }
    > ];
    > ```
    > 
6. Wiring the log writers into that loop — the 7 writers I built are standalone and unused; nothing calls logApiCall, logRetry, etc. yet because
    
    do it 
    
7. docs/sprint-s2-output.md — the doc's own last checklist item; not written.