const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printerAPI', {
  printReceipt: async (content) => {
    const port = await ipcRenderer.invoke('get-print-port');
    // const port = 5050;

    console.log("Sending content to print service...",port);

    try {
      // const response = await fetch("http://localhost:5052/print", {
    const response = await fetch(`http://localhost:${port}/print`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: content
            // content
        })
      });

      if (!response.ok) {
        throw new Error("Failed to print");
      }

      const result = await response.text();
      console.log("Print result:", result);
    } catch (err) {
      console.error("Print error:", err);
      alert("Failed to send print job");
    }
  }
});



