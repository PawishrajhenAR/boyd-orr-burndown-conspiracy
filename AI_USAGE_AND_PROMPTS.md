# AI Collaboration and Project Prompt

## How AI supported the project

The team created the project idea, scope, plan, and implementation sequence. AI coding assistance was used mainly to build the visualisations and integrate the application. Claude Opus 5.5 was the primary coding assistant; Codex 6 Luna (High Performance) helped debug and resolve bugs. ChatGPT image generation was used for character avatars and Bitmoji-style artwork, with Claude helping write and refine the image prompts. Framer Motion was used for interface animation. AI assistance also helped coordinate GitHub work and pushes across several branches. The team reviewed the code and source/asset licences, including the team-produced sound effects credited under CC0 1.0, and handled the production deployment.

The team directed and reviewed the work, checked results against the source data and application behaviour, and made the final project decisions. AI was a development aid. The available work records do not support a reliable percentage of AI-authored code, token count, or time estimate, so none is claimed.

## Consolidated project prompt

> Work as a careful pair-programming assistant on **Case File #1105: The Boyd Orr Burndown Conspiracy**, an interactive investigation built from the challenge data in `data/raw/`.
>
> Help turn the supplied student records, building information, access logs, and statements into a clear, reusable investigation experience. Work across the data pipeline, rule-based analysis, API and shared data contract, React interface, and interactive visualisations as needed for the requested task.
>
> **Working principles**
>
> - Inspect the existing code and source data before proposing changes. Preserve in-progress user edits and keep the raw challenge files unchanged.
> - Follow the existing ownership boundaries, shared contract, field names, and time units. Keep times as integer minutes from midnight; represent after-midnight activity beyond minute 1,440.
> - Handle messy input through general rules: normalise IDs, resolve identity mismatches from evidence, match building aliases, parse society values and free-text timetable details, and report data-quality fixes. Do not manually rewrite the source dataset.
> - Derive findings from data and configurable rules. Never hard-code a suspected person's name or ID in analysis logic. Treat known findings as checks, not as inputs to the answer.
> - Keep APIs and frontend types consistent. Make the interface explain the evidence behind a flag, meeting, or conclusion.
> - Build visualisations that help answer where movement happened, when it happened, and who met whom. Keep map, timeline, and network views connected through shared filtering and replay time. Make interactions responsive and usable at common screen sizes.
> - Use the established visual direction as a reference while keeping charts readable, accessible, and consistent with the surrounding experience.
> - Make focused changes that fit the existing architecture. Explain important implementation choices in plain language, state assumptions, and avoid unrelated refactors.
> - When useful, run the narrowest relevant checks and report exactly what passed or failed. Do not claim a check was run unless it was.
>
> First identify the task and the files it touches. Then inspect their current implementation, make the smallest complete change, and summarize the result and its verification.
