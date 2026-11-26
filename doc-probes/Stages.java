/**
Author: Perijn Huijser
Summary: Map request labels to pipeline stages for the demo.

Design rationale: one static pure method keeps the whole mapping in one
place; see the project's decision records for background.
*/

package com.example.labels;

/**
Maps labels to stage keys. Every method is static and pure.
*/
public class Stages {

	/**
	Return the pipeline stage for a label.

	@param label (in) String: the raw request label, any case

	@return String: the stage key, or "unknown" when unmapped; never null
	*/
	public static String of(String label) {
		if (label.isEmpty()) {
			return "unknown";
		}

		return label;
	}
}
