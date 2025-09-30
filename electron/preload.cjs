// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node integration process to the renderer process. This allows us to
// use the browsers and node integration APIs from the renderer process.
contextBridge.exposeInMainWorld('electronAPI', {
  // You can expose functions, variables, or objects here
  // For example:
  // sendMessage: (message) => ipcRenderer.send('message', message),
  // onMessage: (callback) => ipcRenderer.on('message', callback)
});