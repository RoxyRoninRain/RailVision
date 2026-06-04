---
name: ai_lab
description: A suite of tools for rigorous prompt engineering, automated testing, and failure analysis of AI-generated content.
---

# AI Lab Skill

The **AI Lab** skill standardizes the workflow for testing and refining AI prompts (specifically for the Railify visualizer). It replaces ad-hoc script editing with a structured CLI-based experiment loop.

## Capabilities

### 1. Run Experiment
Execute a generation run with a specific strategy and input set.

**Usage:**
```bash
node .agent/skills/ai_lab/scripts/run_experiment.js [flags]
```

**Flags:**
- `--strategy <name>`: The name of the strategy to test (e.g., "SolutionG", "StrictRenovator"). Defaults to "Default".
- `--input <name>`: Specific input file name (without extension) or "all". Defaults to "all".
- `--style <name>`: Style image to use. Defaults to "style_test_2".
- `--dry-run`: logic check without calling Vertex AI.

**Example:**
```bash
node .agent/skills/ai_lab/scripts/run_experiment.js --strategy="SolutionG" --input="input1"
```

## Directory Structure
- `scripts/`: Contains the executable logic.
- `results/`: Output directory for generated images and reports. Each run creates a timestamped folder.
