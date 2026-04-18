// @ts-check
// main.js for OpenEvolve Evolution Visualizer

/** @typedef {import('./types').GraphData} GraphData */
/** @typedef {import('./types').GraphNode} GraphNode */
/** @typedef {import('./types').MetricMap} MetricMap */
/** @typedef {import('./types').MetricRange} MetricRange */

import { sidebarSticky, showSidebarContent } from './sidebar.js';
import { updateListSidebarLayout, renderNodeList } from './list.js';
import { renderGraph, g, getNodeRadius, animateGraphNodeAttributes } from './graph.js';

/** @type {GraphNode[]} */
export let allNodeData = [];
/** @type {Record<string, MetricRange>} */
let metricMinMax = {};

/** @type {string[]} */
let archiveProgramIds = [];

const sidebarEl = document.getElementById('sidebar');

/** @type {string | null} */
let lastDataStr = null;
/** @type {string | null} */
let selectedProgramId = null;

/**
 * @param {GraphNode[] | undefined} nodes
 */
function computeMetricMinMax(nodes) {
    metricMinMax = {};
    if (!nodes) return;
    nodes.forEach(n => {
        if (n.metrics && typeof n.metrics === 'object') {
            for (const [k, v] of Object.entries(n.metrics)) {
                if (typeof v === 'number' && isFinite(v)) {
                    if (!(k in metricMinMax)) {
                        metricMinMax[k] = {min: v, max: v};
                    } else {
                        metricMinMax[k].min = Math.min(metricMinMax[k].min, v);
                        metricMinMax[k].max = Math.max(metricMinMax[k].max, v);
                    }
                }
            }
        }
    });
    for (const k in metricMinMax) {
        if (metricMinMax[k].min === metricMinMax[k].max) {
            metricMinMax[k].min = 0;
            metricMinMax[k].max = 1;
        }
    }
}

/**
 * @param {MetricMap | undefined} metrics
 */
function formatMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return '';
    let rows = Object.entries(metrics).map(([k, v]) => {
        let min = 0, max = 1;
        if (metricMinMax[k]) {
            min = metricMinMax[k].min;
            max = metricMinMax[k].max;
        }
        let valStr = (typeof v === 'number' && isFinite(v)) ? v.toFixed(4) : String(v ?? '');
        return `<tr><td style='padding-right:0.7em;'><b>${k}</b></td><td style='padding-right:0.7em;'>${valStr}</td><td style='min-width:90px;'>${typeof v === 'number' ? renderMetricBar(v, min, max) : ''}</td></tr>`;
    }).join('');
    return `<table class='metrics-table'><tbody>${rows}</tbody></table>`;
}

/**
 * @param {number | string | null | undefined} value
 * @param {number} min
 * @param {number} max
 * @param {{vertical?: boolean}} [opts]
 */
function renderMetricBar(value, min, max, opts={}) {
    let percent = 0;
    if (typeof value === 'number' && isFinite(value)) {
        if (max > min) {
            percent = (value - min) / (max - min);
            percent = Math.max(0, Math.min(1, percent));
        } else if (max === min) {
            percent = 1;
        }
    }
    let minLabel = `<span class="metric-bar-min">${min.toFixed(2)}</span>`;
    let maxLabel = `<span class="metric-bar-max">${max.toFixed(2)}</span>`;
    if (opts.vertical) {
        minLabel = `<span class="fitness-bar-min" style="right:0;left:auto;">${min.toFixed(2)}</span>`;
        maxLabel = `<span class="fitness-bar-max" style="right:0;left:auto;">${max.toFixed(2)}</span>`;
    }
    return `<span class="metric-bar${opts.vertical ? ' vertical' : ''}" style="overflow:visible;">
        ${minLabel}${maxLabel}
        <span class="metric-bar-fill" style="width:${Math.round(percent*100)}%"></span>
    </span>`;
}

/** @param {GraphData} data */
function loadAndRenderData(data) {
    archiveProgramIds = Array.isArray(data.archive) ? data.archive : [];
    lastDataStr = JSON.stringify(data);
    setAllNodeData(data.nodes);
    renderGraph(data);
    renderNodeList(data.nodes);
    const checkpointLabel = document.getElementById('checkpoint-label');
    if (checkpointLabel) {
        checkpointLabel.textContent = "Checkpoint: " + (data.checkpoint_dir || 'static export');
    }
    const metricSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('metric-select'));
    if (!metricSelect) return;

    const prevMetric = metricSelect.value || localStorage.getItem('selectedMetric') || null;
    metricSelect.innerHTML = '';
    const metrics = new Set();
    data.nodes.forEach(node => {
        if (node.metrics) {
            Object.keys(node.metrics).forEach(metric => metrics.add(metric));
        }
    });
    metrics.forEach(metric => {
        const option = document.createElement('option');
        option.value = String(metric);
        option.textContent = String(metric);
        metricSelect.appendChild(option);
    });
    if (prevMetric && metrics.has(prevMetric)) {
        metricSelect.value = prevMetric;
    } else if (metricSelect.options.length > 0) {
        metricSelect.selectedIndex = 0;
    }
    metricSelect.addEventListener('change', function() {
        localStorage.setItem('selectedMetric', metricSelect.value);
    });
    const perfTab = document.getElementById('tab-performance');
    const perfView = document.getElementById('view-performance');
    if (perfTab && perfView && (perfTab.classList.contains('active') || perfView.style.display !== 'none')) {
        if (window.updatePerformanceGraph) {
            window.updatePerformanceGraph(data.nodes);
        }
    }
}

if (window.STATIC_DATA) {
    loadAndRenderData(window.STATIC_DATA);
} else {
    function fetchAndRender() {
        fetch('/api/data')
            .then(resp => resp.json())
            .then(/** @param {GraphData} data */ (data) => {
                const dataStr = JSON.stringify(data);
                if (dataStr === lastDataStr) {
                    return;
                }
                lastDataStr = dataStr;
                loadAndRenderData(data);
            });
    }
    fetchAndRender();
    setInterval(fetchAndRender, 2000);
}

export let width = window.innerWidth;
export let height = window.innerHeight;

function resize() {
    width = window.innerWidth;
    const toolbarHeight = document.getElementById('toolbar')?.offsetHeight ?? 0;
    height = window.innerHeight - toolbarHeight;
    if (allNodeData && allNodeData.length > 0) {
        /** @type {import('./types').GraphEdge[]} */
        let edges = [];
        if (typeof lastDataStr === 'string') {
            try {
                const parsed = /** @type {GraphData} */ (JSON.parse(lastDataStr));
                edges = parsed.edges || [];
            } catch {}
        }
        renderGraph({ nodes: allNodeData, edges });
    }
}
window.addEventListener('resize', resize);

/**
 * @param {GraphNode[]} nodes
 * @param {string} filter
 * @param {string} metric
 */
function getHighlightNodes(nodes, filter, metric) {
    if (!filter) return [];
    if (filter === 'top') {
        let best = -Infinity;
        nodes.forEach(n => {
            const mv = n.metrics?.[metric];
            if (typeof mv === 'number' && mv > best) best = mv;
        });
        return nodes.filter(n => n.metrics?.[metric] === best);
    } else if (filter === 'first') {
        return nodes.filter(n => n.generation === 0);
    } else if (filter === 'failed') {
        return nodes.filter(n => n.metrics && n.metrics.error != null);
    } else if (filter === 'unset') {
        return nodes.filter(n => !n.metrics || n.metrics[metric] == null);
    } else if (filter === 'archive') {
        return nodes.filter(n => archiveProgramIds.includes(n.id));
    }
    return [];
}

function getSelectedMetric() {
    const metricSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('metric-select'));
    return metricSelect && metricSelect.value ? metricSelect.value : 'combined_score';
}

(function() {
    const toolbar = document.getElementById('toolbar');
    const metricSelect = document.getElementById('metric-select');
    const highlightSelect = document.getElementById('highlight-select');
    if (toolbar && metricSelect && highlightSelect) {
        if (
            metricSelect.parentElement === toolbar &&
            highlightSelect.parentElement === toolbar &&
            toolbar.children.length > 0 &&
            highlightSelect.previousElementSibling !== metricSelect
        ) {
            toolbar.insertBefore(metricSelect, highlightSelect);
        }
    }
})();

const highlightSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('highlight-select'));
if (highlightSelect) {
    highlightSelect.addEventListener('change', function() {
        animateGraphNodeAttributes();
        const container = document.getElementById('node-list-container');
        if (container) {
            Array.from(container.children).forEach(div => {
                const nodeId = div.innerHTML.match(/<b>ID:<\/b>\s*([^<]+)/);
                if (nodeId && nodeId[1]) {
                    div.classList.toggle('highlighted', getHighlightNodes(allNodeData, highlightSelect.value, getSelectedMetric()).map(n => n.id).includes(nodeId[1]));
                }
            });
        }
    });
}


/** @param {GraphNode[]} nodes */
export function setAllNodeData(nodes) {
    allNodeData = nodes;
    computeMetricMinMax(nodes);
}

export { computeMetricMinMax, formatMetrics, getHighlightNodes, selectedProgramId, lastDataStr, archiveProgramIds, renderMetricBar, getSelectedMetric };

/** @param {string | null} id */
export function setSelectedProgramId(id) {
    selectedProgramId = id;
}
