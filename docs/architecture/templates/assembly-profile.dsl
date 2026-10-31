# LOLa DSL — assembly profile.
# Home, clamp to the clamp position, settle, then feed to the feed position.

on-start:
    log "assembly starting"
end

on-abort:
    log "assembly aborted"
end

# This step gives the operator to acquire all required tools for the profile to run
step preperation:
    # Wait for human input to happen with a timeout of 3000 seconds
    await: {
        duration=3000:
        timeout : [abort]
    }
end

step clear-machine:
    # Wait for human input to happen with a timeout of 3000 seconds
    await: {
        duration=3000:
        timeout : [abort]
    }
end

step home-cylinder:
    home: {
        timeout=500:
        on-fail : [abort]
    }

    # Disables the position control block
    pos_ctrl state=true
end

step init-position:
    move_to pos={init-pos}
end

# In this step the cylinder is moved to a position where to operator
# needs to insert the pin mannually into the body
step manual-position:

    # Wait for human input to happen with a timeout of 3000 seconds
    await: {
        duration=3000:
        timeout : [abort]
    }

    move_to pos={feed_pos}
    hold {settle_ms} ms
end

on-complete:
    log "assembly complete"
end
