//! Author: Perijn Huijser
//! Summary: Map request labels to pipeline stages for the demo.
//!
//! Design rationale: one pure function and a const keep the mapping in one
//! place; see the project's decision records for background.

/// Fallback stage returned for unmapped labels.
pub const DEFAULT_STAGE: &str = "unknown";

/// Return the pipeline stage for a label.
///
/// # Arguments
///
/// * `label` (in) - the raw request label, any case and spacing.
///
/// # Returns
///
/// The stage key, or DEFAULT_STAGE when unmapped. Never panics.
pub fn stage_of(label: &str) -> &str {
    if label.is_empty() {
        return DEFAULT_STAGE;
    }

    label
}
