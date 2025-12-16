---
description: Generate a comprehensive handover prompt for a new agent
---
# Handover Prompt Generation Workflow

1.  **Analyze Project Structure**:
    - Run `list_dir` on the project root (or `tree` if available and preferred) to get a full file tree.
    - // turbo
    - Identify key configuration files (e.g., `package.json`, `tsconfig.json`, `pyproject.toml`, `README.md`, `.env.example`).

2.  **Read Key Files**:
    - Read the contents of the identified configuration files.
    - // turbo
    - Read any other highly relevant files based on the user's specific request (e.g., if they ask for a handover regarding the "auth system", read auth-related files).

3.  **Generate Prompt**:
    - Create a markdown code block containing the following template, filling in the placeholders with the real data you gathered.

    **Template:**
    \`\`\`markdown
    # New Agent Handover Prompt

    You are an expert software engineer joining an existing project.
    Your goal is to: {{USER_GOAL}}

    ## Project Context

    ### 1. File Structure
    The project file structure is as follows:
    \`\`\`
    {{FILE_TREE}}
    \`\`\`

    ### 2. Key Files
    Here are the contents of the most critical files for understanding the project state:

    {{FILE_CONTENTS}}

    ### 3. Tech Stack & Configuration
    - **OS**: {{OS_INFO}}
    - **Dependencies**: See config files above.
    - **Environment**: {{ENV_DETAILS}}

    ## Instructions
    1. Analyze the file structure and key file contents above.
    2. Adopt the coding style and conventions observed in the existing codebase.
    3. Proceed with the user's request:
       > {{USER_SPECIFIC_INSTRUCTIONS}}
    \`\`\`

4.  **Final Output**:
    - Present this code block to the user.
