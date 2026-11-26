/**
 * @author Perijn Huijser
 * @brief Map raw codec status bytes to pipeline stages.
 *
 * @details
 *     status_stage expands a raw byte into the pipeline stage that
 *     produced it. A caller feeds the byte off the wire in and gets a
 *     stage index back; an unknown byte maps to STAGE_NONE so the caller
 *     logs the raw value instead of guessing.
 *
 *     Quickstart — decode one frame at the ingest edge:
 *
 *         int stage = status_stage(frame[0]);
 *         if (stage != STAGE_NONE)
 *             route(stage, frame);
 *         else
 *             log_warn("unknown status", frame[0]);
 *
 * @changelog
 *     2026-08: Added the BUSY status byte 0x04, mapped to STAGE_NONE.
 */

#include <stdint.h>

#define STAGE_NONE (-1)
#define STAGE_INGEST 0
#define STAGE_DECODE 1
#define STAGE_SINK 2

/**
 * @brief Map a status byte to the pipeline stage that produced it.
 *
 * @param status (in) uint8_t: the raw status byte off the wire
 * @return stage int: the stage index; STAGE_NONE when the byte is unknown
 */
int status_stage(uint8_t status) {
	if (status == 0x01) {
		return STAGE_INGEST;
	}
	if (status == 0x02) {
		return STAGE_DECODE;
	}
	if (status == 0x03) {
		return STAGE_SINK;
	}
	return STAGE_NONE;
}
