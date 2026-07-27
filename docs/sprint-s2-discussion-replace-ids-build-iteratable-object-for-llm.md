### Todos

- [ ]  we have to replace id with database exisiting ids so we actual exisiting id’s
- [ ]  now we have to create a state.json and error.json every state modification you have to change initial.json i mean you have to subtracted, question you are taking from that
    
    ### Logging Architecture for AI Question Generation Pipeline
    
    > These logs are designed for a **parallel AI generation system (5 concurrent workers)** with checkpoint recovery, provider failover, retry tracking, validation auditing, and execution resumption.
    > 
    
    ---
    
    # 1. `state.json`
    
    The **single source of truth** for the current execution.
    
    It should always contain the latest execution state and be updated after every successful batch.
    
    ```json
    {
      "executionId": "GEN-20260727-001",
      "status": "RUNNING",
    
      "startedAt": "2026-07-27T02:00:00Z",
      "updatedAt": "2026-07-27T02:13:20Z",
      "lastCheckpoint": "2026-07-27T02:13:20Z",
    
      "current": {
        "categoryIndex": 0,
        "chapterIndex": 5,
        "topicIndex": 2,
        "batchIndex": 4,
    
        "category": "Mechanics",
        "chapter": "Gravitation",
        "topic": "Satellites",
    
        "subtopics": [
          "Escape Velocity",
          "Orbital Velocity"
        ]
      },
    
      "provider": {
        "current": "Gemini",
        "model": "gemini-2.5-flash",
        "fallback": "Gemma 4"
      },
    
      "worker": {
        "parallelWorkers": 5,
        "activeWorkers": 5,
        "idleWorkers": 0
      },
    
      "progress": {
        "questionsGenerated": 144,
        "questionsRemaining": 1986,
    
        "apiCallsCompleted": 24,
        "apiCallsRemaining": 331,
    
        "duplicatesRejected": 7,
        "validationFailed": 2,
        "retries": 3
      },
    
      "memory": {
        "ram": "4.2 GB",
        "cpu": "18%"
      }
    }
    ```
    
    ---
    
    # 2. `api.log`
    
    Every successful API request should be recorded.
    
    ```json
    {
      "timestamp": "DD-MM-YYYY HH:MM:SS AM/PM",
      "executionId": "GEN-20260727-001",
    
      "workerId": 3,
    
      "batchId": 25,
    
      "provider": "Gemini",
    
      "model": "gemini-2.5-flash",
    
      "requestId": "REQ-23445",
    
      "category": "Mechanics",
    
      "chapter": "Gravitation",
    
      "topic": "Satellites",
    
      "promptTokens": 8452,
    
      "completionTokens": 4120,
    
      "totalTokens": 12572,
    
      "latencyMs": 4125,
    
      "httpStatus": 200,
    
      "questionsRequested": 6,
    
      "questionsReceived": 6,
    
      "cost": 0,
    
      "status": "SUCCESS"
    }
    ```
    
    ---
    
    # 3. `error.log`
    
    Every error must include the **entire execution state** so the system can reproduce the exact failure.
    
    ```json
    {
      "timestamp": "2026-07-27T02:20:10Z",
    
      "executionId": "GEN-20260727-001",
    
      "workerId": 4,
    
      "batchId": 26,
    
      "provider": "Gemini",
    
      "model": "gemini-2.5-flash",
    
      "currentState": {
        "...": "Entire contents of state.json at the moment the error occurred"
      },
    
      "error": {
        "type": "RateLimitError",
    
        "httpStatus": 429,
    
        "message": "Quota exceeded",
    
        "stack": "...",
    
        "retryable": true
      },
    
      "attempt": 2,
    
      "nextRetryAfter": 8000,
    
      "fallbackProvider": "Gemma 4",
    
      "status": "RETRYING"
    }
    ```
    
    ---
    
    # 4. `validation.log`
    
    Every validation result should capture the exact execution state.
    
    ```json
    {
      "timestamp": "2026-07-27T02:25:11Z",
    
      "executionId": "GEN-20260727-001",
    
      "questionId": "PHY-234",
    
      "batchId": 40,
    
      "currentState": {
        "...": "Entire contents of state.json"
      },
    
      "validator": "QuestionSchemaValidator",
    
      "checks": {
        "latex": true,
        "options": true,
        "duplicate": true,
        "difficulty": false,
        "chapter": true,
        "topic": true,
        "grammar": true,
        "explanation": false
      },
    
      "status": "FAILED"
    }
    ```
    
    ---
    
    # 5. `retry.log`
    
    Track every retry attempt.
    
    ```json
    {
      "timestamp": "2026-07-27T02:21:15Z",
    
      "executionId": "GEN-20260727-001",
    
      "batchId": 26,
    
      "attempt": 3,
    
      "currentState": {
        "...": "Entire contents of state.json"
      },
    
      "reason": "HTTP 429",
    
      "strategy": "ExponentialBackoff",
    
      "wait": 16000,
    
      "provider": "Gemini",
    
      "fallback": false
    }
    ```
    
    ---
    
    # 6. `provider.log`
    
    Track every provider/model switch.
    
    ```json
    {
      "timestamp": "2026-07-27T02:30:11Z",
    
      "executionId": "GEN-20260727-001",
    
      "currentState": {
        "...": "Entire contents of state.json"
      },
    
      "from": {
        "provider": "Gemini",
        "model": "gemini-2.5-flash"
      },
    
      "to": {
        "provider": "Gemma 4",
        "model": "gemma-4"
      },
    
      "reason": "Quota Exhausted",
    
      "batchId": 44
    }
    ```
    
    ---
    
    # 7. `worker.log`
    
    Monitor all **5 parallel workers**.
    
    Each worker periodically reports its status.
    
    ```json
    [
      {
        "workerId": 1,
        "status": "Running",
        "currentBatch": 61,
        "completedBatches": 30,
        "failedBatches": 0,
        "averageExecutionTime": 5.2
         "currentState": {
        "...": "Entire contents of state.json"
      },
      },
      {
        "workerId": 2,
        "status": "Running",
        "currentBatch": 62,
        "completedBatches": 28,
        "failedBatches": 1,
        "averageExecutionTime": 5.5
         "currentState": {
        "...": "Entire contents of state.json"
      },
      },
      {
        "workerId": 3,
        "status": "Running",
        "currentBatch": 63,
        "completedBatches": 31,
        "failedBatches": 0,
        "averageExecutionTime": 5.0
         "currentState": {
        "...": "Entire contents of state.json"
      },
      },
      {
        "workerId": 4,
        "status": "Running",
        "currentBatch": 64,
        "completedBatches": 29,
        "failedBatches": 2,
        "averageExecutionTime": 5.7
         "currentState": {
        "...": "Entire contents of state.json"
      },
      },
      {
        "workerId": 5,
        "status": "Idle",
        "currentBatch": 66,
        "completedBatches": 25,
        "failedBatches": 1,
        "averageExecutionTime": 5.4
         "currentState": {
        "...": "Entire contents of state.json"
      },
      },
       {
        "workerId": 6,
        "status": "Idle",
        "currentBatch": 66,
        "completedBatches": 25,
        "failedBatches": 1,
        "averageExecutionTime": 5.4
         "currentState": {
        "...": "Entire contents of state.json"
      },
      }
    ]
    ```
    
    ---
    
    # 8. `checkpoint.log`
    
    A checkpoint is created after every successful batch save.
    
    ```json
    {
      "checkpointId": "CP-223",
    
      "executionId": "GEN-20260727-001",
    
      "batchId": 60,
    
      "categoryIndex": 2,
    
      "chapterIndex": 1,
    
      "topicIndex": 3,
    
      "generatedQuestions": 360,
    
      "apiCallsCompleted": 60,
    
      "savedAt": "2026-07-27T03:02:11Z",
    
      "currentState": {
        "...": "Entire contents of state.json"
      }
    }
    ```
    
    ---
    
    # Recommended Logging Flow
    
    ```
    Start Execution
           │
           ▼
    Update state.json
           │
           ▼
    Assign Batch → Worker (1–5)
           │
           ▼
    Call LLM
           │
           ├──────────────► api.log
           │
           ├──────────────► validation.log
           │
           ├──────────────► checkpoint.log
           │
           ▼
    Update state.json
           │
           ▼
    Next Batch
    ```
    
    ---
    
    ## Error Flow
    
    ```
    LLM Request
         │
         ▼
    Error?
         │
         ├── No
         │      │
         │      ▼
         │   api.log
         │      │
         │      ▼
         │ validation.log
         │      │
         │      ▼
         │ checkpoint.log
         │      │
         │      ▼
         │ state.json
         │
         └── Yes
                │
                ▼
           error.log
                │
                ▼
           retry.log
                │
                ▼
       Retry Available?
          │           │
          │Yes        │No
          ▼           ▼
     Retry Batch   provider.log
                       │
                       ▼
              Switch Provider
                       │
                       ▼
                Retry Batch
    ```
    
    ---
    
    # Logging Best Practices
    
    - **`state.json`** should always represent the latest recoverable execution state.
    - Include **`currentState` (entire `state.json`)** in `error.log`, `validation.log`, `retry.log`, `provider.log`, and `checkpoint.log` for complete reproducibility.
    - Configure exactly **5 parallel workers**, each processing one batch at a time.
    - Append log entries as **JSON Lines (JSONL)**—one JSON object per line—for efficient streaming and parsing.
    - Use **UTC timestamps (ISO 8601)** consistently across all logs.
    - Assign globally unique identifiers for `executionId`, `batchId`, `requestId`, and `checkpointId`.
    - Keep logs immutable: append new records instead of modifying existing ones.
    - Periodically archive or rotate log files to prevent unbounded growth.
    - Ensure checkpoint creation and `state.json` updates are atomic so recovery always starts from a consistent state.
    - Include provider, model, worker, batch, and execution identifiers in every log to simplify debugging, analytics, and distributed tracing.
- [ ]  traversal flow is subject cateogory → subject chapter → subject topic
    - [ ]  first traveler on current topics for 5 times
- [ ]  We are gonna used 5 worker at a time do one api calls to llm so we can complete current topic
    - [ ]  worker one have must be create
        
        ```json
        {
          "generation": {
            "exam": "jee main",
            "year": 2026,
            "language": "english",
            "perApiCallQuestion": 6,
            "strictMode": true
          },
        
          "subject": {
            "id": 1,
            "name": "physics"
          },
        
          "category": {
            "id": 10,
            "name": "mechanics"
          },
        
          "chapter": {
            "id": 101,
            "name": "units & measurements"
          },
        
          "topic": {
            "id": 1001,
            "name": "units"
          },
        
          "subtopics": [
            "units of measurement",
            "system of units",
            "si units",
            "fundamental and derived units"
          ],
        
          "distribution": {
            "difficulty": {
              "easy": 2,
              "moderate": 3,
              "hard": 1
            },
            "questionType": {
              "single": 4,
              "multiple": 1,
              "numerical": 1
            }
          },
        
          "responseschema": {
            "requiredfields": [
              "role",
              "question",
              "optiontype",
              "inputBox",
              "difficultylevel",
              "options",
              "correctanswer",
              "explanation",
              "subject",
              "category",
              "chapter",
              "topic",
              "subtopic",
              "questionid",
              "batchid"
            ],
            "fieldconstraints": {
              "optiontype": ["Single", "Multiple", "Numerical"],
              "role": "admin",
              "inputBox": "",
              "difficultylevel": ["easy", "moderate", "hard"],
              "subject": "physics",
              "options": {
                "Single": "array of exactly 4 choices (a, b, c, d)",
                "Multiple": "array of exactly 4 choices (a, b, c, d); one or more may be correct",
                "Numerical": "empty string; answer is a numeric value in a string"
              },
              "correctanswer": {
                "Single": "single option key, e.g. 'a'",
                "Multiple": "array of correct option keys, e.g. ['a', 'c']",
                "Numerical": "numeric value as a string, e.g. '4.50'"
              }
            },
            "example": {
              "question": "What is the SI unit of force?",
              "optiontype": "Single",
              "difficultylevel": "easy",
              "options": ["Newton", "Joule", "Watt", "Pascal"],
              "correctanswer": "a",
              "explanation": "Newton is the SI unit of force, named after Sir Isaac Newton."
            }
          }}
        ```
        
- [ ]  Generate a developer-focused `sprint-s2-output.md` that documents everything completed in Sprint 2.
    
    Keep the document concise, practical, and implementation-oriented.
    
    Include:
    
    - Sprint summary (goals, completed work, outcomes)
    - System architecture overview
    - End-to-end data flow (input → processing → output)
    - Module and folder responsibilities
    - Key implementation decisions and trade-offs
    - APIs, services, and database interactions
    - State management and error handling
    - Performance, security, and scalability recommendations
    - Known issues, limitations, and technical debt
    - Developer recommendations and best practices
    - Action items and pending tasks
    
    Use clear headings, bullet points, simple diagrams where helpful, and avoid unnecessary theory. The document should allow a new developer to quickly understand the project, the architecture, the development decisions, and what needs to be done next.
    

---

```json
{
  "generationconfig": {
    "exam": "jee main",
    "year": 2026,
    "subject": "physics",
    "language": "english",
    "totalquestions": 2130,
    "batchsize": 6,
    "strictmode": true,
    "outputformat": "json",
    "questionsperapicall": 6,
    "totalapicalls": 355
  },
  "metadata": {
    "version": "2.0",
    "totalcategories": 7,
    "totalchapters": 20,
    "difficultyratio": "30% easy : 50% moderate : 20% hard",
    "questiontyperatio": "60% single : 20% multiple : 20% numerical",
    "note": "each chapter's difficultydistribution and questiontypedistribution must each sum exactly to that chapter's questioncount (30). category questioncounts sum to totalquestions (2130).",
    "apicallsummary": {
      "totalapicalls": 355,
      "questionspercall": 6,
      "batchesperchapter": "varies by chapter questioncount",
      "distributionstrategy": "distribute questions evenly across batches with rotation for remainders"
    }
  },
  "categories": [
    {
      "id": null,
      "name": "mechanics",
      "questioncount": 900,
      "apicalls": 150,
      "chapters": [
        {
          "id": null,
          "name": "units & measurements",
          "questioncount": 90,
          "apicalls": 15,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 30,
              "moderate": 45,
              "hard": 15
            },
            "questiontypedistribution": {
              "single": 60,
              "multiple": 15,
              "numerical": 15
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "units",
              "subtopics": [
                "units of measurement; system of units; si units",
                "fundamental and derived units"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "errors & significant figures",
              "subtopics": [
                "least count; significant figures",
                "errors in measurements; absolute, relative and percentage error",
                "combination of errors in arithmetic operations"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "dimensions",
              "subtopics": [
                "dimensions of physical quantities",
                "dimensional analysis and its applications"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "kinematics",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "1d motion",
              "subtopics": [
                "frame of reference; motion in a straight line",
                "speed and velocity; uniform and non-uniform motion",
                "average speed and instantaneous velocity",
                "uniformly accelerated motion; equations of motion in a straight line",
                "velocity-time and position-time graphs",
                "relative velocity"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "2d motion",
              "subtopics": [
                "motion in a plane; cases of uniform velocity and uniform acceleration",
                "projectile motion",
                "uniform circular motion"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "laws of motion",
          "questioncount": 150,
          "apicalls": 25,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 50,
              "moderate": 75,
              "hard": 25
            },
            "questiontypedistribution": {
              "single": 100,
              "multiple": 25,
              "numerical": 25
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "newton's laws",
              "subtopics": [
                "force and inertia; newton's first law of motion",
                "momentum; newton's second law of motion; impulse",
                "newton's third law of motion"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "conservation",
              "subtopics": [
                "law of conservation of linear momentum and its applications"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "equilibrium-phy",
              "subtopics": [
                "equilibrium of concurrent forces"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "friction",
              "subtopics": [
                "static and kinetic friction; laws of friction",
                "rolling friction"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "circular motion",
              "subtopics": [
                "dynamics of uniform circular motion; centripetal force",
                "motion of a vehicle on a level road and a banked road"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "work, energy & power",
          "questioncount": 120,
          "apicalls": 20,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 40,
              "moderate": 60,
              "hard": 20
            },
            "questiontypedistribution": {
              "single": 80,
              "multiple": 20,
              "numerical": 20
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "work",
              "subtopics": [
                "work done by a constant and a variable force",
                "work-energy theorem"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "energy",
              "subtopics": [
                "kinetic energy; potential energy",
                "potential energy of a spring",
                "conservation of mechanical energy",
                "conservative and non-conservative forces",
                "motion in a vertical circle"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "power",
              "subtopics": [
                "definition and calculation of power"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "collisions",
              "subtopics": [
                "elastic and inelastic collisions in one and two dimensions"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "rotational motion",
          "questioncount": 150,
          "apicalls": 25,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 50,
              "moderate": 75,
              "hard": 25
            },
            "questiontypedistribution": {
              "single": 100,
              "multiple": 25,
              "numerical": 25
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "centre of mass",
              "subtopics": [
                "centre of mass of a two-particle system",
                "centre of mass of a rigid body"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "rotational concepts",
              "subtopics": [
                "moment of a force; torque; angular momentum",
                "conservation of angular momentum and its applications"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "moment of inertia",
              "subtopics": [
                "definition of moment of inertia; radius of gyration",
                "values for simple geometrical objects (ring, disc, cylinder, sphere, rod)",
                "parallel axes and perpendicular axes theorems"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "equations of motion",
              "subtopics": [
                "equations of rotational motion; rolling motion"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "equilibrium-rotation",
              "subtopics": [
                "equilibrium of rigid bodies; conditions for equilibrium"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "gravitation",
          "questioncount": 150,
          "apicalls": 25,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 50,
              "moderate": 75,
              "hard": 25
            },
            "questiontypedistribution": {
              "single": 100,
              "multiple": 25,
              "numerical": 25
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "gravitation-basics",
              "subtopics": [
                "universal law of gravitation; gravitational constant"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "variation of g",
              "subtopics": [
                "variation of acceleration due to gravity with altitude and depth"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "planetary motion",
              "subtopics": [
                "kepler's laws of planetary motion"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "gravitational potential & energy",
              "subtopics": [
                "gravitational potential energy; gravitational potential"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "satellites",
              "subtopics": [
                "escape velocity; orbital velocity of a satellite",
                "time period and energy of a satellite in circular orbit"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "properties of solids & liquids",
          "questioncount": 180,
          "apicalls": 30,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 60,
              "moderate": 90,
              "hard": 30
            },
            "questiontypedistribution": {
              "single": 120,
              "multiple": 30,
              "numerical": 30
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "elasticity",
              "subtopics": [
                "elastic behaviour of solids; stress-strain relationship; hooke's law",
                "young's modulus; bulk modulus; modulus of rigidity"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "fluid statics",
              "subtopics": [
                "pressure due to a fluid column; pascal's law and its applications",
                "effect of gravity on fluid pressure; archimedes' principle; buoyancy"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "fluid dynamics",
              "subtopics": [
                "viscosity; stokes' law; terminal velocity",
                "streamline and turbulent flow; reynolds number; critical velocity",
                "bernoulli's theorem and its applications"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "surface tension",
              "subtopics": [
                "surface energy and surface tension; cohesion and adhesion",
                "angle of contact; excess pressure in a curved liquid surface",
                "application to drops, bubbles and capillary rise"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "heat & calorimetry",
              "subtopics": [
                "heat, temperature; thermal expansion of solids, liquids and gases",
                "specific heat capacity; calorimetry; latent heat"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "heat transfer",
              "subtopics": [
                "modes of heat transfer: conduction, convection and radiation",
                "newton's law of cooling; stefan's law; wien's displacement law"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "thermodynamics-phy",
      "questioncount": 150,
      "apicalls": 25,
      "chapters": [
        {
          "id": null,
          "name": "thermodynamics-phy",
          "questioncount": 90,
          "apicalls": 15,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 30,
              "moderate": 45,
              "hard": 15
            },
            "questiontypedistribution": {
              "single": 60,
              "multiple": 15,
              "numerical": 15
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "thermodynamics-basics",
              "subtopics": [
                "thermal equilibrium; definition of temperature; zeroth law of thermodynamics"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "first law",
              "subtopics": [
                "heat, work and internal energy; first law of thermodynamics",
                "isothermal and adiabatic processes"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "second law",
              "subtopics": [
                "second law of thermodynamics; reversible and irreversible processes",
                "carnot engine; efficiency of carnot cycle; heat pumps and refrigerators"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "kinetic-theory-of-gases-phy",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "kinetic-theory-of-gases-basics",
              "subtopics": [
                "equation of state of a perfect gas; work done on compressing a gas"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "kinetic theory",
              "subtopics": [
                "assumptions of kinetic theory of gases; concept of pressure",
                "kinetic interpretation of temperature; rms speed of gas molecules",
                "degrees of freedom; law of equipartition of energy",
                "specific heat capacities of gases (cp, cv); relationship between them",
                "mean free path; avogadro's number"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "oscillations & waves",
      "questioncount": 60,
      "apicalls": 10,
      "chapters": [
        {
          "id": null,
          "name": "oscillations & waves",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "oscillations",
              "subtopics": [
                "periodic motion: time period, frequency and periodic functions",
                "simple harmonic motion (shm): equation of motion, phase",
                "oscillations of a spring: force constant; energy in shm",
                "simple pendulum: derivation of expression for time period"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "waves",
              "subtopics": [
                "wave motion: longitudinal and transverse waves; speed of a wave",
                "displacement relation for a progressive wave",
                "principle of superposition of waves; reflection of waves at rigid and free boundaries",
                "standing waves in strings and organ pipes; fundamental mode and harmonics",
                "beats"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "electromagnetism",
      "questioncount": 480,
      "apicalls": 80,
      "chapters": [
        {
          "id": null,
          "name": "electrostatics",
          "questioncount": 150,
          "apicalls": 25,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 50,
              "moderate": 75,
              "hard": 25
            },
            "questiontypedistribution": {
              "single": 100,
              "multiple": 25,
              "numerical": 25
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "charge & forces",
              "subtopics": [
                "conservation of charge; coulomb's law; forces between multiple charges",
                "superposition principle; continuous charge distribution"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "electric field",
              "subtopics": [
                "electric field due to a point charge; electric field lines",
                "electric dipole; electric field due to a dipole; torque on a dipole in uniform field"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "gauss's law",
              "subtopics": [
                "electric flux; gauss's law and its applications",
                "field due to: infinitely long straight wire, uniformly charged infinite plane sheet, uniformly charged thin spherical shell"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "electrostatic potential & energy",
              "subtopics": [
                "electric potential due to a point charge, an electric dipole and a system of charges",
                "potential difference; equipotential surfaces; relation between e and v",
                "electrical potential energy of a system of two point charges; potential energy of a dipole in an external field"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "capacitors",
              "subtopics": [
                "dielectrics and electric polarisation",
                "capacitance of a parallel plate capacitor with and without dielectric medium",
                "combination of capacitors in series and parallel",
                "energy stored in a capacitor; energy density"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "current electricity",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "current electricity basics",
              "subtopics": [
                "drift velocity; mobility and their relation with electric current",
                "ohm's law; electrical resistance; v-i characteristics (linear and non-linear)",
                "electrical energy and power; electrical resistivity and conductivity"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "circuits",
              "subtopics": [
                "series and parallel combinations of resistors; equivalent resistance",
                "temperature dependence of resistance",
                "internal resistance; emf; terminal voltage; combination of cells in series and parallel",
                "kirchhoff's laws and their applications; wheatstone bridge; metre bridge"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "magnetic effects & magnetism",
          "questioncount": 120,
          "apicalls": 20,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 40,
              "moderate": 60,
              "hard": 20
            },
            "questiontypedistribution": {
              "single": 80,
              "multiple": 20,
              "numerical": 20
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "biot-savart & ampere",
              "subtopics": [
                "biot-savart law and its application to a current-carrying circular loop",
                "ampere's law and its applications to an infinitely long wire and a solenoid"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "force on charge/conductor",
              "subtopics": [
                "force on a moving charge in uniform magnetic and electric fields; cyclotron",
                "force on a current-carrying conductor in a uniform magnetic field",
                "force between two parallel current-carrying conductors; definition of ampere"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "galvanometer",
              "subtopics": [
                "torque on a current loop in a uniform magnetic field; moving coil galvanometer",
                "conversion of galvanometer to ammeter and voltmeter; their use"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "magnetism",
              "subtopics": [
                "current loop as a magnetic dipole; magnetic dipole moment; bar magnet as an equivalent solenoid",
                "magnetic field due to a bar magnet along its axis and perpendicular bisector",
                "torque on a magnetic dipole in a uniform magnetic field",
                "para-, dia- and ferromagnetic substances; effect of temperature on magnetic properties"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "electromagnetic induction & ac",
          "questioncount": 90,
          "apicalls": 15,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 30,
              "moderate": 45,
              "hard": 15
            },
            "questiontypedistribution": {
              "single": 60,
              "multiple": 15,
              "numerical": 15
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "emi",
              "subtopics": [
                "electromagnetic induction; faraday's law; induced emf and current; lenz's law",
                "eddy currents and their applications; self-inductance and mutual inductance"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "ac circuits",
              "subtopics": [
                "peak and rms values of alternating current and voltage",
                "reactance and impedance; lcr series circuit; resonance; power factor",
                "power in ac circuits; wattless current"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "devices",
              "subtopics": [
                "ac generator: principle and working",
                "transformer: principle, working, efficiency and uses"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "electromagnetic waves",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "electromagnetic waves basics",
              "subtopics": [
                "displacement current; need for modification of ampere's law",
                "electromagnetic waves: characteristics, transverse nature; speed in vacuum"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "spectrum",
              "subtopics": [
                "electromagnetic spectrum: radio waves, microwaves, infrared, visible, ultraviolet, x-rays, gamma rays",
                "approximate wavelengths and applications of different electromagnetic waves"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "optics",
      "questioncount": 90,
      "apicalls": 15,
      "chapters": [
        {
          "id": null,
          "name": "optics",
          "questioncount": 90,
          "apicalls": 15,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 30,
              "moderate": 45,
              "hard": 15
            },
            "questiontypedistribution": {
              "single": 60,
              "multiple": 15,
              "numerical": 15
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "ray optics",
              "subtopics": [
                "reflection of light; spherical mirrors; mirror formula",
                "refraction of light at plane and spherical surfaces; refractive index",
                "thin lens formula; lens maker's formula; magnification; power of a lens",
                "total internal reflection and its applications",
                "combination of thin lenses in contact; equivalent focal length",
                "refraction of light through a prism; dispersion of light; rainbow"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "optical instruments",
              "subtopics": [
                "compound microscope: magnifying power",
                "astronomical telescope (reflecting and refracting): magnifying power"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "wave optics",
              "subtopics": [
                "wavefront and huygens' principle",
                "laws of reflection and refraction using huygens' principle",
                "interference: young's double-slit experiment; fringe width; coherent sources; sustained interference",
                "diffraction due to a single slit; width of central maximum",
                "polarisation: plane-polarised light; brewster's law; polaroids"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "modern physics",
      "questioncount": 210,
      "apicalls": 35,
      "chapters": [
        {
          "id": null,
          "name": "dual nature of matter & radiation",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "photoelectric effect",
              "subtopics": [
                "hertz and lenard's observations on photoelectric effect",
                "einstein's photoelectric equation; particle nature of light; work function; threshold frequency"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "matter waves",
              "subtopics": [
                "wave nature of matter particles; de broglie relation; de broglie wavelength of an electron"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "atoms & nuclei",
          "questioncount": 60,
          "apicalls": 10,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 20,
              "moderate": 30,
              "hard": 10
            },
            "questiontypedistribution": {
              "single": 40,
              "multiple": 10,
              "numerical": 10
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "atomic models",
              "subtopics": [
                "alpha-particle scattering experiment; rutherford's model of the atom",
                "bohr model of the hydrogen atom; energy levels; spectral series of hydrogen"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "nucleus",
              "subtopics": [
                "composition and size of nucleus; atomic masses; isotopes, isobars and isotones",
                "radioactivity: alpha, beta and gamma particles; laws of radioactive decay; half-life",
                "mass-energy relation; mass defect; binding energy per nucleon",
                "variation of binding energy with mass number; nuclear stability",
                "nuclear fission and nuclear fusion; energy released"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        },
        {
          "id": null,
          "name": "electronic devices",
          "questioncount": 90,
          "apicalls": 15,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 30,
              "moderate": 45,
              "hard": 15
            },
            "questiontypedistribution": {
              "single": 60,
              "multiple": 15,
              "numerical": 15
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "semiconductors",
              "subtopics": [
                "semiconductor diode: i-v characteristics in forward and reverse bias",
                "diode as a rectifier; half-wave and full-wave rectification"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "special diodes",
              "subtopics": [
                "i-v characteristics of led, photodiode and solar cell",
                "zener diode; zener diode as a voltage regulator"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "logic gates",
              "subtopics": [
                "or, and, not, nand and nor gates; truth tables; boolean expressions"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    },
    {
      "id": null,
      "name": "experimental skills",
      "questioncount": 240,
      "apicalls": 40,
      "chapters": [
        {
          "id": null,
          "name": "experimental skills",
          "questioncount": 240,
          "apicalls": 40,
          "generationconfig": {
            "batchsize": 6,
            "difficultydistribution": {
              "easy": 80,
              "moderate": 120,
              "hard": 40
            },
            "questiontypedistribution": {
              "single": 160,
              "multiple": 40,
              "numerical": 40
            },
            "perbatchdistribution": {
              "difficulty": {
                "easy": 2,
                "moderate": 3,
                "hard": 1
              },
              "questiontype": {
                "single": 4,
                "multiple": 1,
                "numerical": 1
              }
            }
          },
          "topics": [
            {
              "name": "length measurement",
              "subtopics": [
                "vernier calipers: measuring internal/external diameter and depth of a vessel",
                "screw gauge: measuring thickness/diameter of thin sheet or wire"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "mechanics",
              "subtopics": [
                "simple pendulum: plotting l vs t² graph; energy dissipation",
                "metre scale: measuring mass by principle of moments"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "material properties",
              "subtopics": [
                "young's modulus of elasticity of material of a metallic wire",
                "surface tension of water by capillary rise method; effect of detergents",
                "coefficient of viscosity by stokes' terminal velocity method"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "waves & sound",
              "subtopics": [
                "speed of sound in air using resonance tube; two-resonance method"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "heat",
              "subtopics": [
                "specific heat capacity of solid and liquid by method of mixtures"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "electricity",
              "subtopics": [
                "resistivity of material of wire using metre bridge; verification of ohm's law",
                "resistance of galvanometer by half-deflection method; figure of merit"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "optics",
              "subtopics": [
                "focal length of convex mirror, concave mirror and convex lens using parallax method",
                "angle of deviation vs. angle of incidence for a triangular prism",
                "refractive index of glass slab using travelling microscope"
              ],
              "id": null,
              "questioncount": 30
            },
            {
              "name": "electronics",
              "subtopics": [
                "characteristic curves of p-n junction diode in forward and reverse bias",
                "characteristic curves of zener diode; determination of reverse breakdown voltage",
                "identification of diode, led, resistor and capacitor from a mixed collection"
              ],
              "id": null,
              "questioncount": 30
            }
          ]
        }
      ]
    }
  ],
  "questiondistribution": {
    "difficulty": {
      "easy": 710,
      "moderate": 1065,
      "hard": 355
    },
    "questiontype": {
      "single": 1420,
      "multiple": 355,
      "numerical": 355
    }
  },
  "apicallsummary": {
    "totalapicalls": 355,
    "questionspercall": 6,
    "totalquestions": 2130,
    "distributionmethod": "chapter-wise batching with rotation strategy",
    "executionplan": {
      "parallelcalls": "Maximum 10 concurrent API calls",
      "retrypolicy": "3 retries with exponential backoff",
      "timeout": "30 seconds per call"
    }
  },
  "responseschema": {
    "requiredfields": [
      "role",
      "question",
      "optiontype",
      "inputBox",
      "difficultylevel",
      "options",
      "correctanswer",
      "explanation",
      "subject",
      "category",
      "chapter",
      "topic",
      "subtopic",
      "questionid",
      "batchid"
    ],
    "fieldconstraints": {
      "optiontype": [
        "Single",
        "Multiple",
        "Numerical"
      ],
      "role": "admin",
      "inputBox": "",
      "difficultylevel": [
        "easy",
        "moderate",
        "hard"
      ],
      "subject": "physics",
      "options": {
        "Single": "array of exactly 4 choices (a, b, c, d)",
        "Multiple": "array of exactly 4 choices (a, b, c, d); one or more may be correct",
        "Numerical": "empty string; answer is a numeric value in a string"
      },
      "correctanswer": {
        "Single": "single option key, e.g. 'a'",
        "Multiple": "array of correct option keys, e.g. ['a', 'c']",
        "Numerical": "numeric value as a string, e.g. '4.50'"
      }
    },
    "example": {
      "question": "What is the SI unit of force?",
      "optiontype": "Single",
      "difficultylevel": "easy",
      "options": [
        "Newton",
        "Joule",
        "Watt",
        "Pascal"
      ],
      "correctanswer": "a",
      "explanation": "Newton is the SI unit of force, named after Sir Isaac Newton."
    }
  }
}
```