// Figma Plugin Sandbox — runs in Figma's main thread.
// Accesses the scene graph, exports layers as PNG, and sends bytes to the UI.

figma.showUI(__html__, { width: 360, height: 520 });

interface ExportRequest {
  type: "export";
  fitMode: "fill" | "fit" | "stretch";
  scale: number;
  selectedOnly: boolean;
}

interface LayerImage {
  name: string;
  bytes: number[];
  width: number;
  height: number;
}

figma.ui.onmessage = async (msg: ExportRequest) => {
  if (msg.type !== "export") return;

  const nodes = msg.selectedOnly
    ? figma.currentPage.selection
    : figma.currentPage.children;

  if (nodes.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "내보낼 레이어가 없습니다. 레이어를 선택하거나 페이지에 요소를 추가해주세요.",
    });
    return;
  }

  figma.ui.postMessage({ type: "progress", current: 0, total: nodes.length });

  const layers: LayerImage[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Only export nodes that support exportAsync
    if (!("exportAsync" in node)) continue;

    try {
      const bytes = await (node as SceneNode & ExportMixin).exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: msg.scale },
      });

      layers.push({
        name: node.name,
        bytes: Array.from(bytes),
        width: Math.round(node.width * msg.scale),
        height: Math.round(node.height * msg.scale),
      });
    } catch (err) {
      console.error(`Failed to export layer "${node.name}":`, err);
    }

    figma.ui.postMessage({
      type: "progress",
      current: i + 1,
      total: nodes.length,
    });
  }

  if (layers.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "내보낼 수 있는 레이어가 없습니다.",
    });
    return;
  }

  figma.ui.postMessage({ type: "layers", layers });
};
