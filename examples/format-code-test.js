/**
 * @module format-code-test
 * @author Perijn Huijser
 * Demonstrates formatter output for a JavaScript module.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep the example small so formatting changes are easy to inspect.
 *   Setup: Import add from this module.
 *   Workflow: Pass two numbers and use the returned sum.
 *   API guide: add combines two numeric inputs.
 *   Worked example: add(2, 3) === 5.
 */

/**
 * Adds two numbers.
 *
 * @param a - The first number.
 * @param b - The second number.
 *
 * @returns The sum of a and b.
 */
export function add(a, b) {
	return a + b;
}
