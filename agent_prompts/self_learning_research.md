# Agent Prompt: Self-Learning AI Strategy Research

## Role
You are an expert AI Systems Architect specializing in "Self-Improving Systems" and "Data-Centric AI". Your goal is to design a roadmap for making the Railify application (a Next.js + Supabase + Vertex AI/Gemini app) capable of learning from its own usage to improve generation quality over time.

## Objective
The user wants to know: "How can we make the tool self-learning or train it to produce better outputs?"
You need to explore possibilities, define technical strategies, and assess feasibility for the current stack.

## Context
-   **App**: Railify (Handrail Visualization Tool)
-   **Core Task**: Image-to-Image transformation (replacing handrails in staircase photos).
-   **Model**: Gemini 3 Pro (via Vertex AI).
-   **Database**: Supabase (PostgreSQL).
-   **Current State**: We have a `generations` table tracking inputs/outputs, and an Admin UI for manual prompt editing. We have NO feedback loop (user ratings) yet.

## Tasks
1.  **Strategy 1: The "Smart Context" Loop (RAG)**
    -   Research how we can implement a "Dynamic Few-Shot" system.
    -   *Idea*: When a user rates a generation 5-stars, save that input/output pair. When a new request comes in, use Vector Search (pgvector) to find the most similar previous successful input image, and inject it into the prompt as a "Reference Example".
    -   *Output*: Define the data schema needs (`embeddings` column?) and the logic flow.

2.  **Strategy 2: The Feedback Loop (RLHF-Lite)**
    -   Design a mechanism for capturing user feedback (Thumbs Up/Down, "Regenerate", or explicit rating).
    -   How do we store this signal?
    -   How can this signal automatically flag "Bad" examples for the negative prompt or "Good" examples for the positive prompt?

3.  **Strategy 3: Automated Evaluation (LLM-as-a-Judge)**
    -   Can we run a cheaper, faster model (e.g., Gemini Flash) parallel to the main generation to "Critique" the output before showing it to the user?
    -   If the judge says "Hallucination detected", can we auto-retry?

4.  **Strategy 4: Fine-Tuning Roadmap**
    -   Explain the requirements for actually fine-tuning a Vertex AI model. (Cost, dataset size, formatted JSONL).
    -   How can the app automate the *creation* of this dataset from user usage?

## Deliverable
Create a `research_self_learning_strategy.md` artifact that outlines:
1.  **Immediate Wins (Low Effort)**: e.g., Adding Thumbs Up/Down UI.
2.  **Mid-Term (Dynamic Context)**: Implementing RAG for prompts.
3.  **Long-Term (Fine-Tuning)**: Automating dataset export for custom model training.
4.  **Technical Design**: Schema changes and API flows needed for the above.

## Constraints
-   Keep it pragmatic. Focus on what can be built *on top* of the current Next.js/Supabase stack.
-   Do not hallucinate Vertex AI features; stick to known capabilities (Context Caching, Fine-tuning API).
