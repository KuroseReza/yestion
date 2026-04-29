export const mermaidThemeConfig = {
  startOnLoad: false,
  theme: 'base' as const,
  darkMode: true,
  // Keep HTML labels enabled: Mermaid's SVG-only labels can drop CJK node text
  // in our current dependency version. We force the HTML labels to light text
  // below and in the rendered preview container instead.
  flowchart: { htmlLabels: true },
  themeCSS: `
    .label text, .nodeLabel, .nodeLabel *, .edgeLabel, .edgeLabel *, .edgeLabel text, .edgeLabel tspan, text, tspan,
    foreignObject, foreignObject *, span, p {
      fill: #fffbeb !important;
      color: #fffbeb !important;
    }
    .node rect, .node circle, .node ellipse, .node polygon, .node path {
      fill: #451a03 !important;
      stroke: #d97706 !important;
    }
    .edgeLabel, .edgeLabel p, .labelBkg {
      background-color: #292524 !important;
      color: #fffbeb !important;
      fill: #292524 !important;
    }
  `,
  themeVariables: {
    // Amber-on-dark palette - sits on code block bg (#292524)
    background: 'transparent',
    primaryColor: '#f59e0b',
    primaryTextColor: '#fffbeb',
    textColor: '#fffbeb',
    mainText: '#fffbeb',
    classText: '#fffbeb',
    titleColor: '#fffbeb',
    primaryBorderColor: '#d97706',
    lineColor: '#fbbf24',
    secondaryColor: '#92400e',
    tertiaryColor: '#78350f',
    // Node boxes
    mainBkg: '#451a03',
    nodeBorder: '#d97706',
    nodeTextColor: '#fffbeb',
    // Edges
    edgeLabelBackground: '#292524',
    // Sequence diagrams
    actorBkg: '#78350f',
    actorBorder: '#d97706',
    actorTextColor: '#fffbeb',
    actorLineColor: '#fbbf24',
    signalColor: '#fbbf24',
    signalTextColor: '#fffbeb',
    // Labels and notes
    labelBoxBkgColor: '#451a03',
    labelBoxBorderColor: '#d97706',
    labelTextColor: '#fffbeb',
    loopTextColor: '#fffbeb',
    noteBkgColor: '#44403c',
    noteTextColor: '#fffbeb',
    noteBorderColor: '#a8a29e',
  }
}
