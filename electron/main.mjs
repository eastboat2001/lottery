import path from "node:path";

import { app, BrowserWindow } from "electron";

function projectPath(...segments) {
  return path.join(app.getAppPath(), ...segments);
}

async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#003bc0",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadFile(projectPath("app", "index.html"));
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
