; Mycelium-for-Qonic — NSIS installer script
; Build: makensis installers\windows\mycelium-qonic.nsi
; Requires: install.ps1 copied next to this file before building (done by CI).

Unicode True

!define APPNAME    "Mycelium-for-Qonic"
!define APPVERSION "0.1.0"
!define PUBLISHER  "Mycelium / thomhoffer-arch"
!define WEBSITE    "https://github.com/thomhoffer-arch/Mycelium-for-Qonic"

Name    "${APPNAME} ${APPVERSION}"
OutFile "mycelium-for-qonic-setup.exe"

; No elevated rights needed — installs to user profile
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show

;── Pages ──────────────────────────────────────────────────────────────────────
!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

;── Install ────────────────────────────────────────────────────────────────────
Section "Install" SecMain
    SetOutPath "$LOCALAPPDATA\${APPNAME}-installer"
    File "install.ps1"

    DetailPrint "Running setup (PowerShell)..."
    nsExec::ExecToLog \
        'powershell.exe -NoProfile -ExecutionPolicy Bypass \
         -File "$LOCALAPPDATA\${APPNAME}-installer\install.ps1"'
    Pop $0
    ${If} $0 != 0
        MessageBox MB_OK|MB_ICONSTOP \
            "Setup failed (exit $0).$\nCheck that you are online and try again."
        Abort
    ${EndIf}

    ; Clean up temp files
    Delete "$LOCALAPPDATA\${APPNAME}-installer\install.ps1"
    RMDir  "$LOCALAPPDATA\${APPNAME}-installer"
SectionEnd
