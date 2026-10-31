#!/usr/bin/env bash
# Author: Perijn Huijser
# Summary: Demonstrates documentation enforcement for a Shell function.
#
# Usage:
#   Core principle: Keep integer addition in one documented function.
#   Setup: Run this file with Bash and pass two integer arguments.
#   Workflow: The script passes both arguments to calculate_total and prints the result.
#   API guide: calculate_total adds two integer arguments and writes the sum.
#   Worked example: ./tree-sitter-documented-demo.sh 1 2 prints 3.

# Summary: Adds two integer arguments and writes their sum.
# Parameters:
#   $1: First integer operand.
#   $2: Second integer operand.
# Returns:
#   Writes the integer sum to standard output.
calculate_total() {
  printf '%s\n' "$(( $1 + $2 ))"
}

calculate_total "$1" "$2"
