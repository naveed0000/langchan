## Overview

Each API response returns an **array of question objects**. Every object represents a single question along with its content, solution, metadata, and categorization information. The structure is designed to support HTML rendering, LaTeX mathematical expressions, multiple question types, and taxonomy-based filtering.

---

## Field Descriptions

### `question`

- **Type:** `string`
- **Format:** HTML
- Contains the main question displayed to the student.
- Supports HTML formatting (`<p>`, `<b>`, `<ul>`, etc.).
- Mathematical expressions are referenced using LaTeX placeholders (e.g., `{{latex[0]}}`) instead of embedding raw LaTeX directly.

---

### `explanation`

- **Type:** `string`
- **Format:** HTML
- Provides the complete solution or explanation shown after the question is answered.
- Can contain HTML formatting and LaTeX placeholders.

---

### `hint`

- **Type:** `string`
- **Format:** HTML
- Contains a short conceptual hint to guide the student without revealing the complete solution.
- Supports HTML and LaTeX placeholders.

---

### `optionType`

- **Type:** `string`
- Determines how the answer should be evaluated.

Supported values:

| Value | Description |
| --- | --- |
| `Single` | Only one option is correct. |
| `Multiple` | More than one option may be correct. |
| `Numerical` | Student enters a numerical answer. |

---

### `difficultyLevel`

- **Type:** `string`
- Indicates the complexity of the question.

Supported values:

- `easy`
- `moderate`
- `hard`

---

### `role`

- **Type:** `enum` value `admin`
- Represents the owner or creator of the question.
- Useful for permission management, auditing, or administrative workflows.

---

### `latex`

- **Type:** `string[]`
- Stores all mathematical expressions separately from the HTML content.
- The question, explanation, hint, and options reference these expressions using placeholders such as:

```
{{latex[0]}}
{{latex[1]}}
{{latex[2]}}
```

**Purpose**

- Keeps mathematical expressions reusable.
- Simplifies MathJax/KaTeX rendering.
- Prevents duplication of identical expressions.
- Makes validation and processing easier.

---

### `options`

- **Type:** `array`
- Present only for objective-type questions.

Each option contains:

#### `name`

- **Type:** `string`
- The option text.
- May contain plain text or a LaTeX placeholder.

#### `isCorrect`

- **Type:** `boolean`
- Indicates whether the option is a correct answer.

---

### `inputBox`

- **Type:** `string`
- Used for numerical or text-input questions.
- Reserved for user-entered answers or future configuration.
- Typically empty for MCQs.

---

### `images`

- **Type:** `array`
- Contains references to images associated with the question.
- Allows support for diagrams, graphs, figures, and other visual resources.
- Empty when no images are required.

---

## Taxonomy Fields

These fields link a question to different entities in the platform's database. They are stored as arrays to allow future support for multiple associations.

### `subjectIds`

- **Type:** `integer[]`
- References the subject(s) to which the question belongs.

Example:

- Physics
- Chemistry
- Mathematics

---

### `subjectCategoryIds`

- **Type:** `integer[]`
- References subject categories or sections within a subject.

---

### `chapterIds`

- **Type:** `integer[]`
- Identifies the chapter associated with the question.

---

### `topicIds`

- **Type:** `integer[]`
- Identifies the specific topic or concept covered by the question.

---

### `examCategoryIds`

- **Type:** `integer[]`
- Associates the question with one or more examination categories.

Examples:

- JEE Main
- JEE Advanced
- NEET
- MHT-CET