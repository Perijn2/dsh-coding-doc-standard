// Author: Perijn Huijser
// Summary: Map request labels to pipeline stages for the demo.
//
// Description:
//     Design rationale: one pure function and a const keep the whole
//     mapping in one place; see the project's decision records for
//     background. stageOf never fails: unmapped labels return DEFAULT_STAGE.

package main

// DEFAULT_STAGE is the fallback stage returned for unmapped labels.
const DEFAULT_STAGE = "unknown"

// stageOf returns the pipeline stage for a label.
//
// Parameters:
//   label (in) string: the raw request label, any case.
//
// Returns: the stage key, or DEFAULT_STAGE when unmapped. Never fails.
func stageOf(label string) string {
	if label == "" {
		return DEFAULT_STAGE
	}

	return label
}

// main prints the stage for one hard-coded label and exits 0.
func main() {
	println(stageOf("status"))
}
