/**
 * @author Perijn Huijser
 * Route queued messages to the handler registered for their topic.
 *
 * Description:
 *     Dispatcher holds one handler per topic. publish looks the topic up
 *     and hands the payload over; a payload for an unknown topic is
 *     counted, never thrown back at the caller. Registry keeps one
 *     Dispatcher per queue name for the life of the process.
 *
 * Usage:
 *     val dispatcher = Registry.forQueue("events")
 *     dispatcher.subscribe("status") { render(it) }
 *     dispatcher.publish("status", "up")   // renders "up"
 *
 * Changelog:
 *     2026-08: Added the unrouted counter.
 */
package com.example.queue

/**
 * Fan-out point between the message queue and the topic handlers.
 * Create one with Dispatcher(); handlers may be called from any queue
 * thread, so they must be safe to run concurrently.
 */
class Dispatcher {

	private val handlers = mutableMapOf<String, (String) -> Unit>()
	private var unrouted = 0

	/** Register a handler for a topic, replacing any handler registered before. */
	fun subscribe(topic: String, handler: (String) -> Unit) {
		handlers[topic] = handler
	}

	/**
	 * Deliver a payload to the topic's handler.
	 * When no handler is registered the payload is counted instead and the
	 * call still returns normally; check unroutedCount to notice the gap.
	 */
	fun publish(topic: String, payload: String) {
		val handler = handlers[topic]
		if (handler == null) {
			unrouted += 1
		} else {
			handler(payload)
		}
	}

	/** Payloads published to topics that had no handler at publish time. */
	fun unroutedCount(): Int = unrouted
}

/** Process-wide registry of dispatchers, one per queue name. */
object Registry {

	private val dispatchers = mutableMapOf<String, Dispatcher>()

	/** Return the dispatcher for the queue name, creating it on first use. */
	fun forQueue(name: String): Dispatcher = dispatchers.getOrPut(name) { Dispatcher() }
}
