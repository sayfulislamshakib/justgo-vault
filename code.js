figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

// Load all data from storage on startup
Promise.all([
  figma.clientStorage.getAsync('contentLibrary'),
  figma.clientStorage.getAsync('orgDetails')
]).then(([library, orgData]) => {
  figma.ui.postMessage({
    type: 'load-data',
    library: library || [],
    orgData: orgData || { name: '', site: '', tagline: '', logo: '' }
  });
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-data') {
    try {
      await figma.clientStorage.setAsync('contentLibrary', msg.library);
      if (msg.orgData) {
        await figma.clientStorage.setAsync('orgDetails', msg.orgData);
      }
    } catch (e) {
      figma.notify("⚠️ Vault is full (5MB limit). Please use smaller images or delete items.", { error: true });
      figma.ui.postMessage({ type: 'storage-full' });
    }
  }

  if (msg.type === 'notify') {
    figma.notify(msg.message);
  }

  if (msg.type === 'apply-content') {
    const { type, value } = msg.item;
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify("⚠️ Please select a layer first");
      return;
    }

    if (type === 'text') {
      let updatedCount = 0;
      for (const node of selection) {
        if (node.type === "TEXT") {
          try {
            // Load all fonts used in the text node
            await Promise.all(
              node.getRangeAllFontNames(0, node.characters.length)
                .map(font => figma.loadFontAsync(font))
            );
            node.characters = value;
            updatedCount++;
          } catch (e) {
            // Fallback
            try {
              await figma.loadFontAsync(node.fontName);
              node.characters = value;
              updatedCount++;
            } catch (innerE) {
              figma.notify("Failed to load font for text update");
            }
          }
        }
      }
      if (updatedCount === 0) figma.notify("❌ No text layers selected");
      else figma.notify(`✅ Applied to ${updatedCount} layer${updatedCount === 1 ? '' : 's'}`);
    }

    if (type === 'image') {
      try {
        const bytes = figma.base64Decode(value);
        const image = figma.createImage(bytes);

        let updatedCount = 0;
        for (const node of selection) {
          if ("fills" in node && node.type !== "TEXT") {
            node.fills = [{
              type: 'IMAGE',
              imageHash: image.hash,
              scaleMode: 'FILL'
            }];
            updatedCount++;
          }
        }

        if (updatedCount === 0) figma.notify("❌ Selection does not support fills");
        else figma.notify(`✅ Applied image to ${updatedCount} layer${updatedCount === 1 ? '' : 's'}`);
      } catch (e) {
        figma.notify("❌ Failed to process image");
      }
    }
  }
};