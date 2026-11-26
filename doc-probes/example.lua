#!/usr/bin/env lua
--- Author: Perijn Huijser
--- Summary: Map request labels to pipeline stages for the demo.
---
--- Design rationale: one pure function and a const keep the whole mapping
--- in one place; see the project's decision records for background.

local DEFAULT_STAGE = "unknown"

--- Return the pipeline stage for a label.
---
--- @param label (in) string: the raw request label, any case
---
--- @return string: the stage key, or DEFAULT_STAGE when unmapped
local function stageOf(label)
	if label == "" then
		return DEFAULT_STAGE
	end

	return label
end

return { stageOf = stageOf, DEFAULT_STAGE = DEFAULT_STAGE }
