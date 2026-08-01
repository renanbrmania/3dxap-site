' Inicia o printer-agent em segundo plano (sem janela preta).
' Deve ficar DENTRO da pasta printer-agent.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = folder
' 0 = janela oculta
sh.Run "cmd /c node server.mjs", 0, False
