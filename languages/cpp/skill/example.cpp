/**
 * @author Perijn Huijser
 * @brief Buffer incoming status lines for one batched write.
 *
 * @details
 *     StatusBuffer collects status lines from one connection and hands
 *     them to the writer in a single flush. Construct one per
 *     connection; the buffer holds no live socket, so it is safe to
 *     keep between reads.
 *
 *     Quickstart — wrap one connection:
 *
 *         StatusBuffer buffer;
 *         buffer.push(line);
 *         if (buffer.pending() > 0)
 *             writer.write_all(pending_bytes);
 *
 * @changelog
 *     2026-08: Added pending() for drain checks.
 */

#include <string>
#include <vector>

/**
 * @brief Buffer status lines until a caller flushes them in one batch.
 */
class StatusBuffer {
public:
	/**
	 * @brief Append one status line to the buffer.
	 */
	void push(const std::string& line) { lines_.push_back(line); }

	/**
	 * @brief Return how many lines are waiting to be flushed.
	 */
	int pending() const { return (int)lines_.size(); }

	/**
	 * @brief Drop every buffered line without writing it.
	 */
	void clear() { lines_.clear(); }

private:
	std::vector<std::string> lines_;
};

/**
 * @brief Copy a status label into out, trimming trailing blanks.
 *
 * @param label (in) const char*: NUL-terminated source label
 * @param out (out) char*: destination buffer, at least strlen(label) + 1 bytes
 * @return length int: bytes written to out, not counting the terminator
 */
int trim_label(const char* label, char* out) {
	int n = 0;
	while (label[n] != '\0') {
		out[n] = label[n];
		n += 1;
	}
	while (n > 0 && out[n - 1] == ' ') {
		n -= 1;
	}
	out[n] = '\0';
	return n;
}
