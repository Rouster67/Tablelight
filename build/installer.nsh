; SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors.

; Only the dedicated test app may redirect cleanup into a synthetic test directory.
!if "${APP_ID}" == "io.github.rouster67.tablelight.updatetest"
  !ifndef TABLELIGHT_UNINSTALL_TEST_ROOT
    !error "The test uninstaller requires an isolated data root."
  !endif
  !define TABLELIGHT_DATA_DIR "${TABLELIGHT_UNINSTALL_TEST_ROOT}\data"
  !define TABLELIGHT_CACHE_DIR "${TABLELIGHT_UNINSTALL_TEST_ROOT}\cache"
!else
  !ifdef TABLELIGHT_UNINSTALL_TEST_ROOT
    !error "Production uninstallers cannot redirect saved-data cleanup."
  !endif
  !define TABLELIGHT_DATA_DIR "$APPDATA\Tablelight"
  !define TABLELIGHT_CACHE_DIR "$LOCALAPPDATA\tablelight-updater"
!endif

!ifdef BUILD_UNINSTALLER
  !include Sections.nsh
  Var tlDeleteConfirmed
  Var tlCleanupFailed
  Var tlCleanupRoot
  Var tlUnsafeTree
  Var tlUninstallDir

  ; electron-builder inserts the components page before the normal welcome page.
  ; Use that page as the single keep/remove choice, without a redundant welcome.
  !define removeDefaultUninstallWelcomePage
  !define UNINSTALL_SECTION_NAME "Tablelight program and shortcuts"
  !define MUI_PAGE_HEADER_TEXT "Uninstall Tablelight"
  !define MUI_PAGE_HEADER_SUBTEXT "Keep your saved data or remove it permanently."
  !define MUI_COMPONENTSPAGE_TEXT_TOP "Saved data is kept by default for a later reinstall.$\r$\n$\r$\nSelect the optional box below to remove all characters, abilities, conditions, libraries, portraits, resources, notes and settings."
  !define MUI_COMPONENTSPAGE_TEXT_COMPLIST "Remove:"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE un.TablelightShowChoice
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.TablelightConfirmRemoval
!endif

!macro customInstall
  ; Only an installed copy should offer automatic installation. Source and unpacked
  ; preview folders never receive this marker.
  FileOpen $0 "$INSTDIR\resources\tablelight-installed" w
  FileWrite $0 "nsis"
  FileClose $0
!macroend

!macro customUnInit
  StrCpy $tlDeleteConfirmed 0
  StrCpy $tlCleanupFailed 0
  ; The vendor saves the original uninstaller folder in $OUTDIR before its
  ; registry lookup can replace $INSTDIR with the default installation folder.
  GetFullPathName $tlUninstallDir "$OUTDIR"
  ${GetRoot} "$tlUninstallDir" $0
  ${If} $tlUninstallDir == ""
  ${OrIf} $tlUninstallDir == "$0\"
    SetErrorLevel 2
    Abort
  ${EndIf}
  ClearErrors
  FileOpen $0 "$tlUninstallDir\resources\tablelight-installed" r
  IfErrors invalidInstall
  FileRead $0 $1
  FileClose $0
  ${If} $1 != "nsis"
    invalidInstall:
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "Tablelight's installed files could not be identified. Run the uninstaller from the Tablelight installation folder. Your saved data was kept."
    ${EndIf}
    SetErrorLevel 2
    Abort
  ${EndIf}
  Call un.TablelightUseInstallFolder
  Call un.TablelightKeepData
  ; Reject the vendor's legacy flag before it can bypass the interactive choice.
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--delete-app-data" $R1
  ${IfNot} ${Errors}
    ${IfNot} ${Silent}
    ${AndIfNot} ${isUpdated}
      MessageBox MB_OK|MB_ICONEXCLAMATION "To remove saved data, run the uninstaller normally and select Remove all saved data."
    ${EndIf}
    SetErrorLevel 2
    Abort
  ${EndIf}
!macroend

!macro customInstallMode
  !ifdef BUILD_UNINSTALLER
    ; This is a per-user application. Keep the original folder instead of
    ; letting the mode page perform another installation-path lookup.
    Call un.TablelightUseInstallFolder
    Abort
  !endif
!macroend

!macro customUnInstall
  ; Without a registry record, the vendor falls back to the product name.
  ; Use this build's actual shortcut names so custom shortcuts are removed too.
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" ShortcutName
  ${If} $0 == ""
    StrCpy $oldDesktopLink $newDesktopLink
    StrCpy $oldStartMenuLink $newStartMenuLink
  ${EndIf}
!macroend

!macro customUnInstallSection
  Section /o "un.Remove all saved data" TABLELIGHT_REMOVE_DATA
    ; A selected section alone is never permission to delete data during an update.
    ${IfNot} ${isUpdated}
    ${AndIfNot} ${Silent}
    ${AndIf} $tlDeleteConfirmed == 1
      IfFileExists "$tlUninstallDir\${APP_EXECUTABLE_FILENAME}" 0 +4
        MessageBox MB_OK|MB_ICONSTOP "Tablelight could not be fully removed. Your saved data was kept. Close Tablelight and run the uninstaller again."
        SetErrorLevel 2
        Abort
      StrCpy $tlCleanupRoot "${TABLELIGHT_DATA_DIR}"
      Call un.TablelightRemoveFolder
    ${EndIf}
  SectionEnd

  Section "un.-Tablelight cache cleanup"
    ; An updating installer may be running from this cache: never touch it then.
    ${IfNot} ${isUpdated}
      IfFileExists "$tlUninstallDir\*.*" 0 +3
        StrCpy $tlCleanupFailed 1
        DetailPrint "Could not completely remove the installed program: $tlUninstallDir"
      StrCpy $tlCleanupRoot "${TABLELIGHT_CACHE_DIR}"
      Call un.TablelightRemoveFolder
      ${If} $tlCleanupFailed == 1
        SetDetailsView show
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONEXCLAMATION "Some Tablelight files could not be removed. Check the uninstall details for their locations. Files outside Tablelight's installation and data folders were not removed."
        ${EndIf}
        SetErrorLevel 2
      ${EndIf}
    ${EndIf}
  SectionEnd

  Function un.TablelightKeepData
    SectionSetFlags ${TABLELIGHT_REMOVE_DATA} 0
  FunctionEnd

  Function un.TablelightUseInstallFolder
    StrCpy $INSTDIR $tlUninstallDir
    StrCpy $installMode CurrentUser
    SetShellVarContext current
  FunctionEnd

  Function un.TablelightShowChoice
    ${If} ${isUpdated}
      Abort
    ${EndIf}
  FunctionEnd

  Function un.TablelightConfirmRemoval
    StrCpy $tlDeleteConfirmed 0
    SectionGetFlags ${TABLELIGHT_REMOVE_DATA} $0
    IntOp $0 $0 & ${SF_SELECTED}
    ${If} $0 != 0
      MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Permanently delete all Tablelight saved data for this Windows user?$\r$\n$\r$\nThis includes characters, abilities, conditions, libraries, portraits, resources, notes and settings. This cannot be undone.$\r$\n$\r$\nExport any backups you want to keep to a separate folder, such as Documents, before continuing. Backups outside Tablelight's folders are kept." IDYES confirmed
      Abort
      confirmed:
        StrCpy $tlDeleteConfirmed 1
    ${EndIf}
  FunctionEnd

  Function un.TablelightRemoveFolder
    ; Only the two fixed app folders are valid. No command-line deletion path exists.
    ${If} $tlCleanupRoot != "${TABLELIGHT_DATA_DIR}"
    ${AndIf} $tlCleanupRoot != "${TABLELIGHT_CACHE_DIR}"
      StrCpy $tlCleanupFailed 1
      Return
    ${EndIf}
    StrCpy $tlUnsafeTree 0
    Push $tlCleanupRoot
    Call un.TablelightCheckTree
    ${If} $tlUnsafeTree == 1
      StrCpy $tlCleanupFailed 1
      DetailPrint "Kept a folder containing a link or unreadable directory: $tlCleanupRoot"
      Return
    ${EndIf}
    IfFileExists "$tlCleanupRoot" 0 done
    ; NSIS cannot normalize a path that is already absent.
    GetFullPathName $0 "$tlCleanupRoot"
    ${If} $0 != $tlCleanupRoot
      StrCpy $tlCleanupFailed 1
      Return
    ${EndIf}
    ClearErrors
    RMDir /r "$tlCleanupRoot"
    IfErrors 0 done
      StrCpy $tlCleanupFailed 1
      DetailPrint "Could not completely remove: $tlCleanupRoot"
    done:
  FunctionEnd

  ; Refuse linked directories rather than following them outside the app's data.
  Function un.TablelightCheckTree
    Exch $0
    Push $1
    Push $2
    System::Call 'kernel32::GetFileAttributesW(w r0) i .r1 ?e'
    Pop $2
    ${If} $1 == -1
      ; Missing folders are already clean; other inspection failures retain data.
      ${If} $2 != 2
      ${AndIf} $2 != 3
        StrCpy $tlUnsafeTree 1
      ${EndIf}
      Goto checked
    ${EndIf}
    IntOp $2 $1 & 0x400
    ${If} $2 != 0
      StrCpy $tlUnsafeTree 1
      Goto checked
    ${EndIf}
    IntOp $2 $1 & 0x10
    ${If} $2 != 0
      ClearErrors
      FindFirst $1 $2 "$0\*"
      ${If} ${Errors}
        StrCpy $tlUnsafeTree 1
        Goto checked
      ${EndIf}
      ${DoWhile} $2 != ""
        ${If} $2 != "."
        ${AndIf} $2 != ".."
          Push "$0\$2"
          Call un.TablelightCheckTree
        ${EndIf}
        FindNext $1 $2
      ${Loop}
      FindClose $1
    ${EndIf}
    checked:
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd
!macroend
