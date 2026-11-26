/**
 * @author Perijn Huijser
 * Route queued messages to the handler registered for their topic.
 *
 * Description:
 *     Dispatcher holds one handler per topic. publish looks the topic up
 *     and hands the payload over; a payload for an unknown topic is
 *     counted, never thrown back at the caller. Unregistering is a no-op
 *     for a topic that was never registered, so shutdown code may be
 *     careless.
 *
 * Usage:
 *     Dispatcher dispatcher = new Dispatcher();
 *     dispatcher.subscribe("status", payload -> render(payload));
 *     dispatcher.publish("status", "up");   // renders "up"
 *
 * Changelog:
 *     2026-08: Added the unrouted counter.
 */
package com.example.queue;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Fan-out point between the message queue and the topic handlers.
 * Create one with new Dispatcher(); handlers may be called from any queue
 * thread, so they must be safe to run concurrently.
 */
public class Dispatcher {

	private final Map<String, Consumer<String>> handlers = new HashMap<>();
	private int unrouted = 0;

	/** Register a handler for a topic, replacing any handler registered before. */
	public void subscribe(String topic, Consumer<String> handler) {
		handlers.put(topic, handler);
	}

	/**
	 * Deliver a payload to the topic's handler.
	 * When no handler is registered the payload is counted instead and the
	 * call still returns normally; check unroutedCount to notice the gap.
	 */
	public void publish(String topic, String payload) {
		Consumer<String> handler = handlers.get(topic);
		if (handler == null) {
			unrouted += 1;
		} else {
			handler.accept(payload);
		}
	}

	/** Payloads published to topics that had no handler at publish time. */
	public int unroutedCount() {
		return unrouted;
	}
}
