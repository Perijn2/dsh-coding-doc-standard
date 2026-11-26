; Names public items only: each item kind carries a visibility_modifier child
; exactly when it is pub, so private items are never units. Trait method
; signatures are function_signature_item nodes and stay unlisted.
((function_item (visibility_modifier)) @unit)
((struct_item (visibility_modifier)) @unit)
((enum_item (visibility_modifier)) @unit)
((trait_item (visibility_modifier)) @unit)
((mod_item (visibility_modifier)) @unit)
