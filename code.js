"use strict";
(() => {
  // code.ts
  figma.showUI(__html__, { width: 360, height: 520 });
  figma.ui.onmessage = async (msg) => {
    if (msg.type !== "export")
      return;
    const nodes = msg.selectedOnly ? figma.currentPage.selection : figma.currentPage.children;
    if (nodes.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "\uB0B4\uBCF4\uB0BC \uB808\uC774\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB808\uC774\uC5B4\uB97C \uC120\uD0DD\uD558\uAC70\uB098 \uD398\uC774\uC9C0\uC5D0 \uC694\uC18C\uB97C \uCD94\uAC00\uD574\uC8FC\uC138\uC694."
      });
      return;
    }
    figma.ui.postMessage({ type: "progress", current: 0, total: nodes.length });
    const layers = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!("exportAsync" in node))
        continue;
      try {
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: msg.scale }
        });
        layers.push({
          name: node.name,
          bytes: Array.from(bytes),
          width: Math.round(node.width * msg.scale),
          height: Math.round(node.height * msg.scale)
        });
      } catch (err) {
        console.error(`Failed to export layer "${node.name}":`, err);
      }
      figma.ui.postMessage({
        type: "progress",
        current: i + 1,
        total: nodes.length
      });
    }
    if (layers.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "\uB0B4\uBCF4\uB0BC \uC218 \uC788\uB294 \uB808\uC774\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
      });
      return;
    }
    figma.ui.postMessage({ type: "layers", layers });
  };
})();
