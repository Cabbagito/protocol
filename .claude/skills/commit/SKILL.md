---
disable-model-invocation: true
argument-hint: [optional commit message]
---

# /commit — Stage, Commit, and Push

Stage changes, generate a conventional commit message, commit, and push to the current branch.

## Steps

1. Run `git status` and `git diff --staged` and `git diff` to understand all changes (staged and unstaged).
2. Run `git log --oneline -5` to see recent commit style.
3. **Determine the commit message:**
   - If `$ARGUMENTS` is provided, use it as the commit message. It must still follow conventional commit format (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, etc.). If it doesn't have a prefix, infer the correct one and prepend it.
   - If no argument is provided, generate a concise conventional commit message from the diff. Focus on the "why" not the "what".
4. **Stage files:** Add relevant changed files by name. Do NOT use `git add .` or `git add -A` — explicitly list files to avoid accidentally staging secrets, `.env` files, or other sensitive files. If the committed changes relate to a feature that has a prototype HTML file in `frontend/design/`, include that prototype in the commit as well.
5. **Commit** the changes. Do NOT include a `Co-Authored-By` footer.
6. **Push** to the current branch with `git push`.
7. Show the final commit hash and summary.
