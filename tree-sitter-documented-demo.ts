/**
 * @module tree-sitter-documented-demo
 * @author Perijn Huijser
 * Demonstrates documented TypeScript and managed Biome formatting.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep integer addition in one documented exported function.
 *   Setup: Import calculateTotal from this module.
 *   Workflow: Pass two numbers and use the returned sum.
 *   API guide: calculateTotal adds two numeric operands.
 *   Worked example: calculateTotal(1, 2) returns 3.
 */

/**
 * Adds two numeric operands.
 *
 * @param left - First numeric operand.
 * @param right - Second numeric operand.
 *
 * @returns The sum of both operands.
 */
export function calculateTotal(left: number, right: number): number {
	return left + right;
}
