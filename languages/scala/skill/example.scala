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
 *     val dispatcher = new Dispatcher()
 *     dispatcher.subscribe("status", render)
 *     dispatcher.publish("status", "up")   // renders "up"
 *
 * Changelog:
 *     2026-08: Added the unrouted counter.
 */
package com.example.queue

import scala.collection.mutable

/**
 * Fan-out point between the message queue and the topic handlers.
 * Create one with new Dispatcher(); handlers may be called from any queue
 * thread, so they must be safe to run concurrently.
 */
class Dispatcher {

	private val handlers = mutable.Map[String, String => Unit]()
	private var unrouted = 0

	/** Register a handler for a topic, replacing any handler registered before. */
	def subscribe(topic: String, handler: String => Unit): Unit = {
		handlers(topic) = handler
	}

	/**
	 * Deliver a payload to the topic's handler.
	 * When no handler is registered the payload is counted instead and the
	 * call still returns normally; check unroutedCount to notice the gap.
	 */
	def publish(topic: String, payload: String): Unit = {
		handlers.get(topic) match {
			case Some(handler) => handler(payload)
			case None          => unrouted += 1
		}
	}

	/** Payloads published to topics that had no handler at publish time. */
	def unroutedCount: Int = unrouted
}
