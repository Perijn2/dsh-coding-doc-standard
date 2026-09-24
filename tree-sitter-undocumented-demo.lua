--- Author: Perijn Huijser
--- Summary: Demonstrates documentation enforcement for a Lua declaration.
---
--- Usage:
---   Core principle: Exercise the pending-write documentation guard.
---   Setup: Submit this candidate through the write tool.
---   Workflow: The guard parses the candidate before it reaches disk.
---   API guide: calculate_total adds two values.
---   Worked example: calculate_total(1, 2) returns 3.

function calculate_total(left, right)
  return left + right
end
