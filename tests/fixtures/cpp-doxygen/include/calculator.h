/**
 * @file calculator.h
 * @author Perijn Huijser
 * @brief Declares the public integer addition API.
 *
 * @par Usage
 * Core principle: Expose one documented arithmetic operation through a header.
 *
 * Setup: Include calculator.h in a C++ translation unit and link calculator.cpp.
 *
 * Workflow: Pass two initialized integers to add and use the returned sum.
 *
 * API guide: add is the only public API and returns the sum of its operands.
 *
 * Worked example:
 * @code{.cpp}
 * #include "calculator.h"
 *
 * const int total = add(20, 22);
 * @endcode
 */
#pragma once

/**
 * @brief Return the sum of two integer operands.
 *
 * @param[in] left The first operand.
 * @param[in] right The second operand.
 *
 * @return The arithmetic sum of left and right.
 */
int add(int left, int right);
