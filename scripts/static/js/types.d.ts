export interface MetricRange {
  min: number;
  max: number;
}

export type MetricMap = Record<string, number | string | null | undefined>;

export interface GraphNode {
  id: string;
  generation?: number;
  island?: number;
  parent_id?: string | null;
  metrics?: MetricMap;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  archive?: string[];
  checkpoint_dir?: string;
}

declare global {
  interface Window {
    STATIC_DATA?: GraphData;
    updatePerformanceGraph?: (nodes: GraphNode[]) => void;
    g?: unknown;
  }
}
