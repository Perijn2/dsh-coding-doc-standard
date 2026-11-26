; Names every declaration kind as a documentable unit.
; This grammar models classes, structs, and enums all as class_declaration,
; so one pattern covers those three kinds; protocol and function declarations
; carry their own kinds. Protocol requirements are not units.
(class_declaration) @unit
(protocol_declaration) @unit
(function_declaration) @unit
