; Inno Setup 6 — установщик Велес
; Сборка: py build/build.py --installer (из корня проекта)
; Иконка: build/favicon.ico (копируется из build/icon.ico)

#define MyAppName "Велес"
#ifndef MyAppVersion
  #define MyAppVersion "0.1.0.0"
#endif
#define MyAppPublisher "Велес"
#define MyAppExeName "Veles.exe"
#ifndef MyAppDistDir
  #define MyAppDistDir "veles"
#endif

[Setup]
AppId={{E4C8A0B1-5D27-4F9A-8B13-7C6E5D4A3B21}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Veles
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Veles_Setup
#ifexist "favicon.ico"
SetupIconFile=favicon.ico
#endif
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AllowNoIcons=yes
MinVersion=10.0
SetupLogging=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[CustomMessages]
russian.DeleteDataQuestion=Удалить также данные приложения (дерево, фото, база SQLite в папке data)?

[Tasks]
Name: "desktopicon"; Description: "Создать значок на рабочем столе"; GroupDescription: "Дополнительно:"; Flags: unchecked
Name: "launchafter"; Description: "Запустить {#MyAppName} после установки"; GroupDescription: "Дополнительно:"; Flags: unchecked

[Files]
Source: "dist\{#MyAppDistDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Удалить {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Запустить {#MyAppName}"; Flags: nowait postinstall skipifsilent; Tasks: launchafter

[UninstallDelete]
Type: dirifempty; Name: "{app}"

[Code]
var
  UninstallDeleteData: Boolean;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  UninstallDeleteData := False;
  if DirExists(ExpandConstant('{app}\data')) then
    UninstallDeleteData := (MsgBox(CustomMessage('DeleteDataQuestion'), mbConfirmation, MB_YESNO) = IDYES);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usPostUninstall) and UninstallDeleteData then
    DelTree(ExpandConstant('{app}\data'), True, True, True);
end;
