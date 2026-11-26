/**
Author: Perijn Huijser
Summary: Map request labels to pipeline stages for the demo.

Description:
    Design rationale: one pure function plus a const enum keeps the whole
    mapping in one place; see the project's decision records for background.

    Example:
        stageOf("status")   // "status"
        stageOf("")         // "unknown"
*/

/** Fallback stage returned for unmapped labels. */
export const DEFAULT_STAGE = "unknown";

/**
Pipeline stages a label can map to.
*/
export enum Stage {
	/** Interactive requests. */
	Status = "status",
	/** Batch payloads. */
	Batch = "batch",
}

/**
Return the pipeline stage for a label.

@param label (in) string - The raw request label, any case and spacing.

@returns string - The stage key, or DEFAULT_STAGE when unmapped. Never throws.
*/
export function stageOf(label: string): string {
	if (label === "") {
		return DEFAULT_STAGE;
	}

	return label;
}
