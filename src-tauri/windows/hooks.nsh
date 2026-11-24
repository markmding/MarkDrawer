; Extra registration so Mark Drawer also shows up in Explorer's "Open with" list
; when another editor already owns the .md default (Tauri's APP_ASSOCIATE only
; sets the default value). Choosing "Mark Drawer 文屉" there, or "Always use this
; app", routes the file to `Mark Drawer.exe "%1"` — see src/launch.rs.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "MarkDrawer.Markdown" ""
  WriteRegStr SHCTX "Software\Classes\.markdown\OpenWithProgids" "MarkDrawer.Markdown" ""
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.md\OpenWithProgids" "MarkDrawer.Markdown"
  DeleteRegValue SHCTX "Software\Classes\.markdown\OpenWithProgids" "MarkDrawer.Markdown"
!macroend
