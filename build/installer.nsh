; SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors.
!macro customInstall
  ; Only an installed copy should offer automatic installation. Source and unpacked
  ; preview folders never receive this marker.
  FileOpen $0 "$INSTDIR\resources\tablelight-installed" w
  FileWrite $0 "nsis"
  FileClose $0
!macroend
