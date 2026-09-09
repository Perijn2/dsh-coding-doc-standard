/**
 * @file calculator.cpp
 * @author Perijn Huijser
 * @brief Implements the documented integer addition helper.
 *
 * @par Usage
 * Core principle: Keep the arithmetic implementation separate from the public API.
 *
 * Setup: Compile this file together with the matching calculator header.
 *
 * Workflow: Link the translation unit into the consuming executable.
 *
 * API guide: The implementation fulfills add declared in calculator.h.
 *
 * Worked example:
 * @code{.cpp}
 * #include "calculator.h"
 *
 * const int total = add(20, 22);
 * @endcode
 */
#include "calculator.h"

int add(int left, int right) {
	return left + right;
}
