/**
 * @module coding-doc-standard-client-entry
 * @author Perijn Huijser
 * Loads the browser settings implementation from the package source tree.
 *
 * @remarks
 * Usage:
 *   Core principle: Preserve the DSH conventional client entry while keeping
 *   browser implementation code isolated under src/client.
 *   Setup: DSH serves this conventional package entry to the web client.
 *   Workflow: Load the settings implementation before Cordis client composition.
 *   API guide: This entry has no public API beyond package client discovery.
 *   Worked example: The web plugin roster requests /plugins/coding-doc-standard/client.js.
 */

import './src/client/index.js'
