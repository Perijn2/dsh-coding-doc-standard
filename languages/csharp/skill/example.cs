/// Author: Perijn Huijser
/// Summary: Route queued messages to the handler registered for their topic.
/// Description:
///     Dispatcher holds one handler per topic. Publish looks the topic up
///     and hands the payload over; a payload for an unknown topic is
///     counted, never thrown back at the caller. Unregistering is a no-op
///     for a topic that was never registered, so shutdown code may be
///     careless.
/// Usage:
///     var dispatcher = new Dispatcher();
///     dispatcher.Subscribe("status", Render);
///     dispatcher.Publish("status", "up");   // renders "up"
/// Changelog:
///     2026-08: Added the unrouted counter.

namespace Example.Queue;

using System;
using System.Collections.Generic;

/// Fan-out point between the message queue and the topic handlers.
/// Create one with new Dispatcher(); handlers may be called from any
/// queue thread, so they must be safe to run concurrently.
public class Dispatcher
{
    private readonly Dictionary<string, Action<string>> handlers = new();
    private int unrouted;

    /// Register a handler for a topic, replacing any handler registered before.
    public void Subscribe(string topic, Action<string> handler)
    {
        handlers[topic] = handler;
    }

    /// Deliver a payload to the topic's handler; count it when none exists.
    public void Publish(string topic, string payload)
    {
        if (!handlers.TryGetValue(topic, out var handler))
        {
            unrouted += 1;
            return;
        }
        handler(payload);
    }

    /// Payloads published to topics that had no handler at publish time.
    public int UnroutedCount => unrouted;
}
