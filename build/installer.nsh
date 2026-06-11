!macro customUnInstallCheck
  IfErrors 0 shellOldUninstallerStarted
    DetailPrint "Old uninstaller could not be launched. Continuing repair install."
    ClearErrors
    Return

  shellOldUninstallerStarted:
  ${if} $R0 != 0
    DetailPrint "Old uninstaller returned $R0. Continuing repair install."
    ClearErrors
  ${endif}
!macroend

!macro customUnInstallCheckCurrentUser
  IfErrors 0 currentUserOldUninstallerStarted
    DetailPrint "Old current-user uninstaller could not be launched. Continuing repair install."
    ClearErrors
    Return

  currentUserOldUninstallerStarted:
  ${if} $R0 != 0
    DetailPrint "Old uninstaller returned $R0. Continuing repair install."
    ClearErrors
  ${endif}
!macroend
