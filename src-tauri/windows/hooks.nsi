; Trusts our self-signed code-signing certificate for the current user after
; install, so this and all future releases signed with the same certificate
; no longer trigger Windows SmartScreen / Authenticode "unknown publisher"
; warnings. Uses -user scope (not -addstore machine-wide) to match
; installMode=currentUser, which needs no admin elevation.
; Pre-0.2.1 releases installed perMachine (Program Files, HKLM). We've since
; switched to currentUser (no admin needed) to fix a broken self-update, but
; that means this new installer can't see or manage the old perMachine copy
; through the normal upgrade-detection path (that only checks the current
; mode's registry hive). This hook detects the old install and removes it
; via its own uninstaller, elevated. It's entirely best-effort: if the old
; install isn't found, the elevation prompt is declined, or anything else
; goes wrong, we swallow it and let the new (non-elevated) install proceed
; regardless — this must never be able to block or break the current install.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "UninstallString"
  ${If} $0 != ""
    ExecShellWait "runas" "$0" "/P /S" SW_HIDE $1
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; A self-signed cert is its own root, so it needs to be trusted as a root CA
  ; (not just a "trusted publisher") for Windows to build a valid chain and
  ; stop flagging it as an unknown/untrusted publisher.
  ExecWait '"certutil.exe" -addstore -user Root "$INSTDIR\windows\oscahs-codesign.cer"'
  ExecWait '"certutil.exe" -addstore -user TrustedPublisher "$INSTDIR\windows\oscahs-codesign.cer"'
!macroend
